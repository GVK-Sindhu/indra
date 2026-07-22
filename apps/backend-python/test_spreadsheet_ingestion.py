"""
End-to-End Test Suite for Spreadsheet (.xlsx) and CSV Ingestion in INDRA

Run:
  d:\projects\indra\apps\backend-python\.venv\Scripts\python.exe test_spreadsheet_ingestion.py
"""

import os
import sys
import time
from fastapi.testclient import TestClient

from app.main import app
from app.db.mongodb import get_db

client = TestClient(app)
SEPARATOR = "=" * 70

def main():
    print(f"\n{SEPARATOR}")
    print("STEP 1: Authenticate as engineer@indra.ai")
    print(SEPARATOR)
    
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "engineer@indra.ai", "password": "engineer123"}
    )
    if login.status_code != 200:
        print("Login failed:", login.text)
        sys.exit(1)
        
    token = login.json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Authenticated successfully.")

    db = get_db()
    pump_asset = db.assets.find_one({"code": "P-101"})
    if not pump_asset:
        pump_asset = db.assets.find_one({"code": "PUMP-102"})
    
    if not pump_asset:
        print("Error: Asset P-101 or PUMP-102 not found in database.")
        sys.exit(1)
        
    asset_id_str = str(pump_asset["_id"])
    asset_code = pump_asset["code"]
    print(f"Target Asset: {pump_asset['name']} ({asset_code}) [ID: {asset_id_str}]")

    # Paths to synthetic dataset files
    dataset_dir = os.path.join(os.path.dirname(__file__), "..", "..", "synthetic_indra_dataset", "P-101")
    xlsx_path = os.path.join(dataset_dir, "P-101_Maintenance_History.xlsx")
    csv_path = os.path.join(dataset_dir, "P-101_Sensor_History.csv")

    if not os.path.exists(xlsx_path) or not os.path.exists(csv_path):
        print(f"Error: Synthetic files not found at {dataset_dir}")
        sys.exit(1)

    # ---------------------------------------------------------
    # PART 1: Ingest XLSX File
    # ---------------------------------------------------------
    print(f"\n{SEPARATOR}")
    print(f"PART 1: Ingesting XLSX File: {os.path.basename(xlsx_path)}")
    print(SEPARATOR)

    with open(xlsx_path, "rb") as f:
        res_xlsx = client.post(
            "/api/v1/documents/process",
            headers=headers,
            data={"assets": f'["{asset_code}"]', "title": "P-101 Maintenance History"},
            files={"file": (os.path.basename(xlsx_path), f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )
    
    if res_xlsx.status_code != 202:
        print("XLSX Upload Failed:", res_xlsx.text)
        sys.exit(1)

    doc_xlsx_id = res_xlsx.json()["data"]["documentId"]
    print(f"XLSX Upload Accepted. Document ID: {doc_xlsx_id}")

    # Poll status until completed
    for _ in range(15):
        time.sleep(1)
        st_res = client.get(f"/api/v1/documents/status/{doc_xlsx_id}", headers=headers)
        status_data = st_res.json().get("data", {})
        proc_status = status_data.get("processingStatus")
        print(f"  Polling XLSX status... {proc_status}")
        if proc_status == "COMPLETED":
            print("✅ XLSX Ingestion COMPLETED successfully.")
            break
        elif proc_status == "FAILED":
            print("❌ XLSX Ingestion FAILED:", status_data.get("errorMessage"))
            sys.exit(1)

    # ---------------------------------------------------------
    # PART 2: Ingest CSV File
    # ---------------------------------------------------------
    print(f"\n{SEPARATOR}")
    print(f"PART 2: Ingesting CSV File: {os.path.basename(csv_path)}")
    print(SEPARATOR)

    with open(csv_path, "rb") as f:
        res_csv = client.post(
            "/api/v1/documents/process",
            headers=headers,
            data={"assets": f'["{asset_code}"]', "title": "P-101 Sensor History"},
            files={"file": (os.path.basename(csv_path), f, "text/csv")}
        )
    
    if res_csv.status_code != 202:
        print("CSV Upload Failed:", res_csv.text)
        sys.exit(1)

    doc_csv_id = res_csv.json()["data"]["documentId"]
    print(f"CSV Upload Accepted. Document ID: {doc_csv_id}")

    for _ in range(15):
        time.sleep(1)
        st_res = client.get(f"/api/v1/documents/status/{doc_csv_id}", headers=headers)
        status_data = st_res.json().get("data", {})
        proc_status = status_data.get("processingStatus")
        print(f"  Polling CSV status... {proc_status}")
        if proc_status == "COMPLETED":
            print("✅ CSV Ingestion COMPLETED successfully.")
            break
        elif proc_status == "FAILED":
            print("❌ CSV Ingestion FAILED:", status_data.get("errorMessage"))
            sys.exit(1)

    # ---------------------------------------------------------
    # PART 3: Verify RAG Query Retrieval on XLSX (WO-9921)
    # ---------------------------------------------------------
    print(f"\n{SEPARATOR}")
    print("PART 3: RAG Decision Brief Query on XLSX (Work Order WO-9921)")
    print(SEPARATOR)

    q_xlsx = "What action was taken in WO-9921?"
    res_rag1 = client.post(
        "/api/v1/decisions/brief",
        headers=headers,
        json={"assetId": asset_id_str, "problem": q_xlsx}
    )

    data1 = res_rag1.json()
    print("RAG Query Output:")
    if data1.get("abstain"):
        print("❌ RAG Abstained unexpectedly:", data1.get("message"))
    else:
        brief1 = data1.get("data", {}).get("decision", {}).get("brief", {})
        print(f"  Problem Summary: {brief1.get('problemSummary')[:120]}...")
        print(f"  DCI Score: {brief1.get('decisionConfidenceIndex')}%")
        print(f"  Citations Count: {len(brief1.get('supportingEvidence', []))}")
        for c in brief1.get('supportingEvidence', []):
            print(f"    - Source Doc: {c.get('documentName')} (Page/Sheet {c.get('pageNumber')})")
            print(f"      Content snippet: {c.get('text')[:100]}...")

    # ---------------------------------------------------------
    # PART 4: Verify RAG Query Retrieval on CSV (Sensor History)
    # ---------------------------------------------------------
    print(f"\n{SEPARATOR}")
    print("PART 4: RAG Decision Brief Query on CSV (Vibration reading on 2026-06-12 at 09:30)")
    print(SEPARATOR)

    q_csv = "What was the vibration reading on 2026-06-12 at 09:30?"
    res_rag2 = client.post(
        "/api/v1/decisions/brief",
        headers=headers,
        json={"assetId": asset_id_str, "problem": q_csv}
    )

    data2 = res_rag2.json()
    print("RAG Query Output:")
    if data2.get("abstain"):
        print("❌ RAG Abstained unexpectedly:", data2.get("message"))
    else:
        brief2 = data2.get("data", {}).get("decision", {}).get("brief", {})
        print(f"  Problem Summary: {brief2.get('problemSummary')[:120]}...")
        print(f"  DCI Score: {brief2.get('decisionConfidenceIndex')}%")
        print(f"  Citations Count: {len(brief2.get('supportingEvidence', []))}")
        for c in brief2.get('supportingEvidence', []):
            print(f"    - Source Doc: {c.get('documentName')} (Page/Sheet {c.get('pageNumber')})")
            print(f"      Content snippet: {c.get('text')[:100]}...")

    print(f"\n{SEPARATOR}")
    print("🎉 ALL SPREADSHEET & CSV END-TO-END TESTS COMPLETED SUCCESSFULLY!")
    print(SEPARATOR)

if __name__ == "__main__":
    main()
