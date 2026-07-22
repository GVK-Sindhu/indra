from datetime import datetime
from bson import ObjectId

from app.core.config import settings
from app.db.mongodb import get_db
from app.core.security import hash_password

def seed_database_if_needed() -> None:
    """
    Seeds default assets, user accounts, and checklist procedures into MongoDB.
    Executes only if settings.SEED_DB is set to "true".
    """
    if settings.SEED_DB.lower() != "true":
        print("[Seeder] SEED_DB is not enabled. Skipping seeder checks.")
        return

    db = get_db()
    
    # 1. Check if seeding is already complete
    if db.users.count_documents({}) > 0:
        print("[Seeder] Users collection already populated.")
        ensure_sample_documents_seeded()
        return

    print("[Seeder] SEED_DB is enabled and database is empty. Starting seeding...")

    # Wipe collections for clean state
    db.users.delete_many({})
    db.assets.delete_many({})
    db.procedures.delete_many({})
    db.facts.delete_many({})
    db.integrityalerts.delete_many({})
    db.decisions.delete_many({})
    db.executionsessions.delete_many({})

    # 2. Seed Users
    print("[Seeder] Seeding default user accounts...")
    db.users.insert_many([
        {
            "_id": ObjectId("60d5ec49f390000000000001"),
            "email": "engineer@indra.ai",
            "password": hash_password("engineer123"),
            "name": "Alex Doe",
            "role": "ENGINEER",
            "experienceLevel": "Junior",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        },
        {
            "_id": ObjectId("60d5ec49f390000000000003"),
            "email": "manager@indra.ai",
            "password": hash_password("manager123"),
            "name": "Sarah Smith",
            "role": "MANAGER",
            "experienceLevel": "Senior",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        },
        {
            "_id": ObjectId("60d5ec49f390000000000005"),
            "email": "admin@indra.ai",
            "password": hash_password("admin123"),
            "name": "Sys Admin",
            "role": "ADMIN",
            "experienceLevel": "Senior",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
    ])

    # 3. Seed Assets
    print("[Seeder] Seeding assets...")
    pump_oid = ObjectId("60d5ec49f390000000000002")
    boiler_oid = ObjectId("60d5ec49f390000000000004")
    turb_oid = ObjectId("60d5ec49f390000000000006")
    val_oid = ObjectId("60d5ec49f390000000000008")

    db.assets.insert_many([
        {
            "_id": pump_oid,
            "name": "Centrifugal Feed Water Pump",
            "code": "PUMP-102",
            "type": "Pump",
            "description": "High-pressure boiler feedwater system centrifugal pump.",
            "kriScore": 85.0,
            "dciScore": 90.0,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        },
        {
            "_id": boiler_oid,
            "name": "High-Pressure Steam Boiler",
            "code": "BOILER-04",
            "type": "Boiler",
            "description": "Superheated steam generation utility. Casing limits: max 45 bar.",
            "kriScore": 100.0,
            "dciScore": 100.0,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        },
        {
            "_id": turb_oid,
            "name": "Steam Turbine Generator",
            "code": "TURB-01",
            "type": "Turbine",
            "description": "Electrical power generator powered by superheated steam.",
            "kriScore": 95.0,
            "dciScore": 95.0,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        },
        {
            "_id": val_oid,
            "name": "Safety Relief Valve",
            "code": "VAL-201",
            "type": "Valve",
            "description": "Overpressure protection safety safety relief valve.",
            "kriScore": 100.0,
            "dciScore": 100.0,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
    ])

    # 4. Seed Procedures
    print("[Seeder] Seeding checklist procedures SOPs...")
    db.procedures.insert_many([
        {
            "_id": ObjectId("60d5ec49f390000000000010"),
            "name": "PUMP-102 Mechanical Impeller Check",
            "description": "Standard Operating Procedure checklist for checking centrifugal pump clearances and bearing temperature bounds.",
            "assetId": pump_oid,
            "steps": [
                {
                    "stepNumber": 1,
                    "instruction": "Lockout and tagout (LOTO) electrical energy source to PUMP-102 motor drive.",
                    "validationType": "None",
                    "measurements": [],
                    "safetyNote": "Ensure physical padlocks are attached.",
                    "warning": "HIGH SHOCK RISK. Do not touch terminal boxes before lockout.",
                    "docReferences": []
                },
                {
                    "stepNumber": 2,
                    "instruction": "Measure radial impeller clearance using feeler gauge gauges.",
                    "validationType": "Measurement",
                    "measurements": [
                        {
                            "name": "Impeller Clearance",
                            "unit": "mm",
                            "minLimit": 0.25,
                            "maxLimit": 0.45
                        }
                    ],
                    "safetyNote": "Insert feeler blades parallel to shaft axes.",
                    "warning": None,
                    "docReferences": []
                },
                {
                    "stepNumber": 3,
                    "instruction": "Check lubricating oil level in pump bearing housing housing.",
                    "validationType": "Visual",
                    "measurements": [],
                    "safetyNote": "Level should align with center marker on sight glass glass.",
                    "warning": None,
                    "docReferences": []
                }
            ],
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        },
        {
            "_id": ObjectId("60d5ec49f390000000000020"),
            "name": "BOILER-04 Safety Vent Verification",
            "description": "Guided testing steps for safety vent checks and overpressure locks.",
            "assetId": boiler_oid,
            "steps": [
                {
                    "stepNumber": 1,
                    "instruction": "Manually open safety vent exhaust valves for visual steam venting.",
                    "validationType": "None",
                    "measurements": [],
                    "safetyNote": "Stand behind safety shields.",
                    "warning": "SCALD HAZARD. Stay clear of discharge nozzles.",
                    "docReferences": []
                },
                {
                    "stepNumber": 2,
                    "instruction": "Record boiler header steam gauge operating pressure pressure.",
                    "validationType": "Measurement",
                    "measurements": [
                        {
                            "name": "Operating Pressure",
                            "unit": "bar",
                            "minLimit": 2.0,
                            "maxLimit": 45.0
                        }
                    ],
                    "safetyNote": "Read digital header pressure panel.",
                    "warning": "OVERPRESSURE WARNING. Values exceeding 45.0 bar violate structural integrity limits.",
                    "docReferences": []
                }
            ],
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
    ])

    ensure_sample_documents_seeded()
    print("[Seeder] Database seeding completed successfully.")

def ensure_sample_documents_seeded() -> None:
    """
    Ensures default sample document records and facts are present in MongoDB.
    """
    db = get_db()
    if db.documents.count_documents({}) > 0:
        return

    print("[Seeder] Populating default sample technical documents and extracted facts...")
    pump_doc = db.assets.find_one({"code": "PUMP-102"})
    boiler_doc = db.assets.find_one({"code": "BOILER-04"})
    
    pump_oid = pump_doc["_id"] if pump_doc else ObjectId("60d5ec49f390000000000002")
    boiler_oid = boiler_doc["_id"] if boiler_doc else ObjectId("60d5ec49f390000000000004")

    doc1_oid = ObjectId("60d5ec49f390000000000030")
    doc2_oid = ObjectId("60d5ec49f390000000000040")

    db.documents.insert_many([
        {
            "_id": doc1_oid,
            "title": "PUMP-102 OEM Maintenance Manual",
            "description": "Manufacturer specifications, clearance tolerances, and lubrication parameters for PUMP-102.",
            "type": "PDF",
            "assets": ["PUMP-102"],
            "versions": [{
                "versionNumber": 1,
                "fileName": "pump_102_manual.pdf",
                "filePath": "./uploads/pump_102_manual.pdf",
                "contentId": "./uploads/pump_102_manual.pdf",
                "mimeType": "application/pdf",
                "size": 1048576,
                "uploadedBy": ObjectId("60d5ec49f390000000000001"),
                "uploadedAt": datetime.utcnow()
            }],
            "tags": ["OEM_MANUAL", "PUMP", "SPECIFICATIONS"],
            "processingStatus": "COMPLETED",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        },
        {
            "_id": doc2_oid,
            "title": "BOILER-04 Operating Limit & Safety Guideline",
            "description": "High pressure boiler safety parameters, pressure thresholds, and emergency shutoff procedures.",
            "type": "PDF",
            "assets": ["BOILER-04"],
            "versions": [{
                "versionNumber": 1,
                "fileName": "boiler_04_specs.pdf",
                "filePath": "./uploads/boiler_04_specs.pdf",
                "contentId": "./uploads/boiler_04_specs.pdf",
                "mimeType": "application/pdf",
                "size": 2097152,
                "uploadedBy": ObjectId("60d5ec49f390000000000001"),
                "uploadedAt": datetime.utcnow()
            }],
            "tags": ["SAFETY", "BOILER", "OPERATING_LIMITS"],
            "processingStatus": "COMPLETED",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
    ])

    if db.facts.count_documents({}) == 0:
        db.facts.insert_many([
            {
                "_id": ObjectId("60d5ec49f390000000000050"),
                "assetId": pump_oid,
                "documentId": doc1_oid,
                "type": "Limit",
                "value": "Impeller radial clearance tolerance: 0.25 mm to 0.45 mm.",
                "pageNumber": 12,
                "confidence": 0.98,
                "status": "Validated",
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            },
            {
                "_id": ObjectId("60d5ec49f390000000000051"),
                "assetId": boiler_oid,
                "documentId": doc2_oid,
                "type": "Limit",
                "value": "Maximum allowable casing steam pressure: 45.0 bar.",
                "pageNumber": 5,
                "confidence": 0.99,
                "status": "Validated",
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }
        ])
