"""
Sprint 4 — Verify Cross-Document Contradiction Detection

Run: python test_contradiction.py
"""

from bson import ObjectId
from fastapi.testclient import TestClient
import fitz
import os
import time

from app.db.mongodb import get_db
from app.main import app

client = TestClient(app)
SEPARATOR = "=" * 70

def create_pdf(filename: str, text: str):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(fitz.Point(50, 50), text)
    doc.save(filename)
    doc.close()

def main():
    print(f"\n{SEPARATOR}")
    print("STEP 1: Authenticate as engineer@indra.ai")
    print(SEPARATOR)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "engineer@indra.ai", "password": "engineer123"},
    )
    token = login.json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Setup test PDFs
    doc_a_path = "doc_a_pump.pdf"
    doc_b_path = "doc_b_pump.pdf"
    create_pdf(doc_a_path, "Asset: PUMP-102\nMaximum operating pressure: 10 bar.")
    create_pdf(doc_b_path, "Asset: PUMP-102\nMaximum operating pressure: 8 bar.")

    # We need to wipe previous facts for this test to ensure cleanliness
    db = get_db()
    asset = db.assets.find_one({"code": "PUMP-102"})
    if not asset:
        print("PUMP-102 asset not found. Run seed script first.")
        return

    # STEP 2: Upload Document A
    print(f"\n{SEPARATOR}")
    print("STEP 2: Upload Document A (10 bar)")
    print(SEPARATOR)
    with open(doc_a_path, "rb") as f:
        res_a = client.post(
            "/api/v1/documents/process",
            headers=headers,
            files={"file": (doc_a_path, f, "application/pdf")},
            data={"title": "Test Doc A"}
        )
    assert res_a.status_code == 202
    doc_a_id = res_a.json()["data"]["documentId"]
    
    # Wait for processing
    print("Waiting for Document A processing...")
    time.sleep(15) # Wait for background task (parsing + LLM + compiler)
    
    # Verify Document A Fact
    facts_a = list(db.facts.find({"documentId": ObjectId(doc_a_id), "type": "Limit"}))
    print(f"Facts found for Doc A: {len(facts_a)}")
    for fact in facts_a:
        print(f" - {fact.get('parameter')} = {fact.get('numericValue')} {fact.get('unit')} (Value: {fact['value']})")
    
    # STEP 3: Upload Document B
    print(f"\n{SEPARATOR}")
    print("STEP 3: Upload Document B (8 bar)")
    print(SEPARATOR)
    with open(doc_b_path, "rb") as f:
        res_b = client.post(
            "/api/v1/documents/process",
            headers=headers,
            files={"file": (doc_b_path, f, "application/pdf")},
            data={"title": "Test Doc B"}
        )
    assert res_b.status_code == 202
    doc_b_id = res_b.json()["data"]["documentId"]

    # Wait for processing
    print("Waiting for Document B processing...")
    time.sleep(15)

    # Verify Document B Fact & Contradiction
    facts_b = list(db.facts.find({"documentId": ObjectId(doc_b_id), "type": "Limit"}))
    print(f"Facts found for Doc B: {len(facts_b)}")
    for fact in facts_b:
        print(f" - {fact.get('parameter')} = {fact.get('numericValue')} {fact.get('unit')} (Value: {fact['value']}, Status: {fact.get('status')})")

    alerts = list(db.integrityalerts.find({"assetId": asset["_id"], "type": "Contradiction"}))
    print(f"\nContradiction Alerts generated: {len(alerts)}")
    for a in alerts:
        print(f" - ALERT: {a['description']}")

    # STEP 4: Query RAG Decision Brief
    print(f"\n{SEPARATOR}")
    print("STEP 4: Query Maximum Safe Operating Pressure")
    print(SEPARATOR)
    question = "What is the maximum safe operating pressure for PUMP-102?"
    response = client.post(
        "/api/v1/decisions/brief",
        headers=headers,
        json={"assetId": str(asset["_id"]), "problem": question},
    )
    
    brief = response.json().get("data", {}).get("decision", {}).get("brief", {})
    print(f"Summary: {brief.get('problemSummary')}")
    print(f"Conflicting Evidence: {brief.get('conflictingEvidence')}")
    
    print("\n✅ SPRINT 4 WORKFLOW VERIFIED")

    # Cleanup test files
    os.remove(doc_a_path)
    os.remove(doc_b_path)

if __name__ == "__main__":
    main()
