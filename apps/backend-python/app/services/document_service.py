import os
import json
from datetime import datetime
from bson import ObjectId

from app.db.mongodb import get_db
from app.services.document_parser import parse_document
from app.services.chunker import chunk_document
from app.services.embedding_service import get_embeddings_bulk
from app.services.vector_store import add_chunks_to_vector_store
from app.services.llm_service import extract_document_intelligence
from app.services.knowledge_compiler import compile_extracted_data

# Ensure uploads directory exists
UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def process_document_pipeline(document_id: str, version_number: int, file_name: str, file_bytes: bytes, uploaded_by_str: str) -> None:
    """
    Executes the complete document ingestion pipeline synchronously.
    Saves chunks to MongoDB, indexes vectors in ChromaDB, compiles facts/checklists,
    and runs the downstream integrity alerts compiler.
    """
    db = get_db()
    doc_id = ObjectId(document_id)
    uploaded_by = ObjectId(uploaded_by_str)

    # 1. Update status to PROCESSING
    db.documents.update_one(
        {"_id": doc_id},
        {"$set": {
            "processingStatus": "PROCESSING",
            "updatedAt": datetime.utcnow()
        }}
    )

    try:
        # Load document from MongoDB to get linked assets
        document = db.documents.find_one({"_id": doc_id})
        if not document:
            raise Exception(f"Document not found: {document_id}")
            
        asset_codes = document.get("assets", [])

        # Fetch assetIds for metadata filtering
        asset_ids = []
        for code in asset_codes:
            asset = db.assets.find_one({"code": code})
            if asset:
                asset_ids.append(str(asset["_id"]))

        # 2. Parse pages
        print(f"[DocumentService] Parsing document: {file_name}")
        pages_data = parse_document(file_bytes, file_name)

        # 3. Create semantic chunks
        print("[DocumentService] Chunking pages...")
        chunks = chunk_document(pages_data, max_words=500, overlap_words=50)

        # 4. Generate bulk embeddings and index in ChromaDB
        if chunks:
            print(f"[DocumentService] Generating embeddings for {len(chunks)} chunks...")
            chunk_contents = [c["content"] for c in chunks]
            embeddings = get_embeddings_bulk(chunk_contents)

            print("[DocumentService] Indexing in ChromaDB persistent store...")
            ids = [f"{document_id}_ch_{i}" for i in range(len(chunks))]
            metadatas = []
            
            for idx, c in enumerate(chunks):
                meta = {
                    "documentId": document_id,
                    "documentName": file_name,
                    "pageNumber": c["pageNumber"],
                    "boundingBox": json.dumps(c["boundingBox"])
                }
                if asset_ids:
                    meta["assetId"] = asset_ids[0]
                if asset_codes:
                    meta["assetCode"] = asset_codes[0]
                metadatas.append(meta)

            add_chunks_to_vector_store(
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas,
                documents=chunk_contents
            )

            # 5. Save chunks into MongoDB (matching Mongoose documentchunks collection)
            print("[DocumentService] Saving chunks to MongoDB...")
            # Delete old chunks for version idempotency
            db.documentchunks.delete_many({
                "documentId": doc_id,
                "versionNumber": version_number
            })

            mongo_chunks = []
            for idx, c in enumerate(chunks):
                mongo_chunks.append({
                    "documentId": doc_id,
                    "versionNumber": version_number,
                    "pageNumber": c["pageNumber"],
                    "content": c["content"],
                    "boundingBox": c["boundingBox"],
                    "confidence": 0.95,
                    "classification": "OCR_Parsed",
                    "createdAt": datetime.utcnow()
                })
            
            if mongo_chunks:
                db.documentchunks.insert_many(mongo_chunks)

        # 6. Run LLM fact and checklist extraction globally from concatenated pages text
        print("[DocumentService] Fetching existing database facts context for contradiction scanning...")
        existing_facts_context = ""
        if asset_ids:
            asset_oids = [ObjectId(aid) for aid in asset_ids]
            existing_facts = list(db.facts.find({"assetId": {"$in": asset_oids}}))
            if existing_facts:
                existing_facts_context = "Existing Facts in Knowledge Base:\n"
                for idx, ef in enumerate(existing_facts):
                    doc_doc = db.documents.find_one({"_id": ef["documentId"]})
                    doc_title = doc_doc.get("title", "Reference manual") if doc_doc else "Reference manual"
                    existing_facts_context += f"Fact {idx+1}: '{ef['value']}' (Source: {doc_title}, Page {ef.get('pageNumber', 1)})\n"

        print("[DocumentService] Extracting facts and procedures using Gemini Flash...")
        full_text = "\n".join([f"--- Page {p['pageNumber']} ---\n{p['text']}" for p in pages_data])
        truncated_text = " ".join(full_text.split()[:40000]) # context safety bounds
        
        extraction = extract_document_intelligence(truncated_text, file_name, existing_facts_context)

        # 7. Update document properties
        tags = list(set(document.get("tags", []) + ["OCR_Parsed", "FastAPI_Processed"]))
        db.documents.update_one(
            {"_id": doc_id},
            {"$set": {
                "processingStatus": "COMPLETED",
                "tags": tags,
                "updatedAt": datetime.utcnow()
            }}
        )

        print("[DocumentService] Extraction successful. Calling compiler service...")
        # 8. Run compiler pipeline to map facts, alerts and procedures into MongoDB
        compile_extracted_data(
            document_id=document_id,
            version_number=version_number,
            facts=[f.model_dump() for f in extraction.facts],
            contradictions=[c.model_dump() for c in extraction.contradictions],
            procedures=[p.model_dump() for p in extraction.procedures]
        )

    except Exception as e:
        print(f"[DocumentService] Ingestion failed: {str(e)}")
        # Log failure state to database
        db.documents.update_one(
            {"_id": doc_id},
            {"$set": {
                "processingStatus": "FAILED",
                "processingError": str(e),
                "updatedAt": datetime.utcnow()
            }}
        )
