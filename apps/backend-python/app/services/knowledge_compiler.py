from bson import ObjectId
from datetime import datetime

from app.db.mongodb import get_db
from app.services.knowledge_integrity import validate_asset_integrity

def compile_extracted_data(document_id: str, version_number: int, facts: list, contradictions: list, procedures: list) -> None:
    """
    Cleans up old versions and stores newly extracted document facts, SOP checklists,
    and alerts relations. Then triggers asset KRI updates.
    """
    db = get_db()
    doc_oid = ObjectId(document_id)

    # 1. Clean up old facts for version idempotency
    db.facts.delete_many({"documentId": doc_oid})
    
    # Load document info to resolve mapped assets
    document = db.documents.find_one({"_id": doc_oid})
    if not document:
        print(f"[KnowledgeCompiler] Error: Document {document_id} not found.")
        return

    doc_assets = document.get("assets") or []
    affected_asset_ids = set()

    # 2. Store facts
    facts = facts or []
    for f in facts:
        fact_val = f.get("value", f.get("value", ""))
        fact_type = f.get("type", f.get("type", "Asset"))
        page_num = f.get("pageNumber", f.get("pageNumber", 1))
        confidence = f.get("confidence", 0.95)

        # Resolve assetId matching document linked codes
        asset_id = None
        for code in doc_assets:
            asset = db.assets.find_one({"code": code})
            if asset and (code.upper() in fact_val.upper() or len(doc_assets) == 1):
                asset_id = asset["_id"]
                affected_asset_ids.add(str(asset_id))
                break

        # Fallback to first asset
        if not asset_id and doc_assets:
            asset = db.assets.find_one({"code": doc_assets[0]})
            if asset:
                asset_id = asset["_id"]
                affected_asset_ids.add(str(asset_id))

        if not asset_id:
            continue

        db.facts.insert_one({
            "type": fact_type,
            "value": fact_val,
            "parameter": f.get("parameter"),
            "numericValue": f.get("numericValue"),
            "unit": f.get("unit"),
            "assetId": asset_id,
            "documentId": doc_oid,
            "pageNumber": page_num,
            "confidence": confidence,
            "status": "Extracted", # requires human validation for DCI scoring
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        })

    # Fetch stored facts to map contradiction relations
    saved_facts = list(db.facts.find({"documentId": doc_oid}))
    
    # Query all facts related to affected assets for cross-document checking
    all_asset_facts = list(db.facts.find({"assetId": {"$in": [ObjectId(aid) for aid in affected_asset_ids]}}))

    # Helper function to find a matching fact in the list of facts (exact or fuzzy)
    def find_matching_fact(val_str: str, facts_list: list):
        if not val_str:
            return None
        val_clean = val_str.strip().lower().rstrip('.')
        # 1. Exact match (case insensitive, stripped)
        for f in facts_list:
            f_val_clean = f["value"].strip().lower().rstrip('.')
            if f_val_clean == val_clean:
                return f
        # 2. Substring/Superstring fallback
        for f in facts_list:
            f_val_clean = f["value"].strip().lower()
            if val_clean in f_val_clean or f_val_clean in val_clean:
                return f
        return None

    # 3. Map contradictions
    
    # 3a. Programmatic Normalized Contradiction Detection
    for f_new in saved_facts:
        if f_new.get("type") == "Limit" and f_new.get("parameter") and f_new.get("numericValue") is not None:
            for f_old in all_asset_facts:
                if f_old.get("documentId") != doc_oid and f_old.get("type") == "Limit" and f_old.get("assetId") == f_new.get("assetId"):
                    if (f_old.get("parameter", "").lower() == f_new.get("parameter").lower() and 
                        f_old.get("unit", "") == f_new.get("unit")):
                        
                        if f_old.get("numericValue") != f_new.get("numericValue"):
                            # Normalized Contradiction Found!
                            print(f"[KnowledgeCompiler] Programmatic contradiction detected: {f_old.get('value')} vs {f_new.get('value')}")
                            # Append to contradictions list to be processed by existing logic
                            contradictions = contradictions or []
                            contradictions.append({
                                "factValueA": f_old.get("value"),
                                "factValueB": f_new.get("value"),
                                "severity": "High",
                                "description": f"Conflicting values for parameter '{f_new.get('parameter')}': {f_old.get('numericValue')} {f_old.get('unit')} vs {f_new.get('numericValue')} {f_new.get('unit')}."
                            })

    contradictions = contradictions or []
    for c in contradictions:
        val_a = c.get("factValueA")
        val_b = c.get("factValueB")
        severity = c.get("severity", "High")
        desc = c.get("description", "")

        f1 = find_matching_fact(val_a, saved_facts)
        if not f1:
            f1 = find_matching_fact(val_a, all_asset_facts)
            
        f2 = find_matching_fact(val_b, saved_facts)
        if not f2:
            f2 = find_matching_fact(val_b, all_asset_facts)

        if f1 and f2:
            print(f"[KnowledgeCompiler] Logged logical contradiction: '{f1['value'][:30]}' <-> '{f2['value'][:30]}'")
            
            # Set status to Contradictory in database
            db.facts.update_many(
                {"_id": {"$in": [f1["_id"], f2["_id"]]}},
                {"$set": {"status": "Contradictory", "updatedAt": datetime.utcnow()}}
            )

            # Insert contradiction relationship relation
            db.relations.insert_one({
                "sourceId": f1["_id"],
                "sourceType": "Fact",
                "targetId": f2["_id"],
                "targetType": "Fact",
                "type": "contradicts",
                "confidence": 0.95,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            })

            # Create an Integrity Alert for the affected asset
            db.integrityalerts.insert_one({
                "assetId": f1["assetId"],
                "type": "Contradiction",
                "severity": severity,
                "description": f"Logical limit contradiction: {desc}",
                "details": {
                    "factIdA": str(f1["_id"]),
                    "factIdB": str(f2["_id"]),
                    "valueA": f1["value"],
                    "valueB": f2["value"]
                },
                "status": "Active",
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            })

    # 4. Store Procedures
    procedures = procedures or []
    for p in procedures:
        name = p.get("name", "")
        desc = p.get("description", "")
        steps_data = p.get("steps") or []

        # Find target asset
        asset_id = None
        for code in doc_assets:
            asset = db.assets.find_one({"code": code})
            if asset and (code.upper() in name.upper() or len(doc_assets) == 1):
                asset_id = asset["_id"]
                affected_asset_ids.add(str(asset_id))
                break

        if not asset_id and doc_assets:
            asset = db.assets.find_one({"code": doc_assets[0]})
            if asset:
                asset_id = asset["_id"]
                affected_asset_ids.add(str(asset_id))

        if not asset_id:
            continue

        # Prevent duplicate procedures by name to keep seeder clean
        duplicate = db.procedures.find_one({"assetId": asset_id, "name": name})
        if not duplicate:
            steps = []
            for s in steps_data:
                measurements = []
                measurements_list = s.get("measurements")
                if measurements_list:
                    for m in measurements_list:
                        measurements.append({
                            "name": m.get("name"),
                            "unit": m.get("unit"),
                            "minLimit": m.get("minLimit"),
                            "maxLimit": m.get("maxLimit")
                        })
                
                steps.append({
                    "stepNumber": s.get("stepNumber"),
                    "instruction": s.get("instruction"),
                    "validationType": s.get("validationType", "None"),
                    "measurements": measurements,
                    "safetyNote": s.get("safetyNote"),
                    "warning": s.get("warning"),
                    "docReferences": [{
                        "documentId": doc_oid,
                        "pageNumber": s.get("pageNumber", 1)
                    }]
                })

            db.procedures.insert_one({
                "name": name,
                "description": desc,
                "assetId": asset_id,
                "steps": steps,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            })
            print(f"[KnowledgeCompiler] Saved Procedure SOP: '{name}'")

    # 5. Trigger Asset integrity scan updates
    for asset_id_str in affected_asset_ids:
        print(f"[KnowledgeCompiler] Recalculating metrics for asset: {asset_id_str}")
        validate_asset_integrity(asset_id_str)
