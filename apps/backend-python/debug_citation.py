"""
Sprint 3 — End-to-End Citation Trace Test
==========================================
Verifies that citations returned in a Decision Brief come directly
from ChromaDB retrieved chunk metadata, NOT from Gemini LLM output.

Run:  python debug_citation.py   (with venv activated and backend dependencies)
Requires: MongoDB running, ChromaDB populated with at least one ingested PDF.
"""

from bson import ObjectId
from fastapi.testclient import TestClient

from app.db.mongodb import get_db
from app.main import app
from app.services.vector_store import get_collection

SEPARATOR = "=" * 70

client = TestClient(app)

# 1. Authenticate
print(f"\n{SEPARATOR}")
print("STEP 1: Authenticate as engineer@indra.ai")
print(SEPARATOR)
login = client.post(
    "/api/v1/auth/login",
    json={"email": "engineer@indra.ai", "password": "engineer123"},
)
assert login.status_code == 200, f"Login failed: {login.text}"
token = login.json()["data"]["token"]
headers = {"Authorization": f"Bearer {token}"}
print(f"  ✓ Authenticated. Token: {token[:20]}...")

# 2. Find asset PUMP-102
print(f"\n{SEPARATOR}")
print("STEP 2: Look up asset PUMP-102")
print(SEPARATOR)
asset = get_db().assets.find_one({"code": "PUMP-102"})
assert asset, "Asset PUMP-102 not found in MongoDB"
print(f"  ✓ Asset found: {asset['name']} (id={asset['_id']})")

# 3. Submit diagnostic question
question = "What is the maximum allowable casing gauge pressure for PUMP-102?"
print(f"\n{SEPARATOR}")
print(f"STEP 3: Submit diagnostic question")
print(f"  Question: \"{question}\"")
print(SEPARATOR)
response = client.post(
    "/api/v1/decisions/brief",
    headers=headers,
    json={"assetId": str(asset["_id"]), "problem": question},
)
assert response.status_code == 200, f"Brief generation failed: {response.text}"
payload = response.json()
brief = payload["data"]["decision"]["brief"]

print(f"  ✓ Response status: {response.status_code}")
print(f"  ✓ LLM Analysis Summary: {brief['problemSummary'][:120]}...")
print(f"  ✓ Risk Level: {brief['riskLevel']}")
print(f"  ✓ DCI Score: {brief['decisionConfidenceIndex']}%")

# 4. Extract first citation from supportingEvidence
print(f"\n{SEPARATOR}")
print("STEP 4: Extract citation from supportingEvidence")
print(SEPARATOR)
evidence = brief["supportingEvidence"]
assert len(evidence) > 0, "No supporting evidence returned"

citation = evidence[0]
assert isinstance(citation, dict), f"Citation is not a dict (type={type(citation)}), got: {citation}"
print(f"  ✓ Citation chunkId:      {citation.get('chunkId')}")
print(f"  ✓ Citation documentId:   {citation.get('documentId')}")
print(f"  ✓ Citation documentName: {citation.get('documentName')}")
print(f"  ✓ Citation pageNumber:   {citation.get('pageNumber')}")
print(f"  ✓ Citation text (first 150 chars): {citation.get('text', '')[:150]}...")

# 5. Cross-reference with MongoDB stored document
print(f"\n{SEPARATOR}")
print("STEP 5: Cross-reference with MongoDB document record")
print(SEPARATOR)
stored_document = get_db().documents.find_one({"_id": ObjectId(citation["documentId"])})
assert stored_document, f"Document {citation['documentId']} NOT found in MongoDB!"
stored_filename = stored_document["versions"][0]["fileName"] if stored_document.get("versions") else stored_document.get("title", "unknown")
print(f"  ✓ MongoDB document _id: {stored_document['_id']}")
print(f"  ✓ MongoDB document file: {stored_filename}")

# 6. Cross-reference with ChromaDB vector store
print(f"\n{SEPARATOR}")
print("STEP 6: Cross-reference with ChromaDB vector store")
print(SEPARATOR)
chroma_result = get_collection().get(
    ids=[citation["chunkId"]],
    include=["documents", "metadatas"],
)
assert chroma_result["ids"] and len(chroma_result["ids"]) > 0, f"Chunk {citation['chunkId']} NOT found in ChromaDB!"
chroma_text = chroma_result["documents"][0]
chroma_meta = chroma_result["metadatas"][0]
print(f"  ✓ ChromaDB chunk ID:       {chroma_result['ids'][0]}")
print(f"  ✓ ChromaDB documentName:   {chroma_meta.get('documentName')}")
print(f"  ✓ ChromaDB documentId:     {chroma_meta.get('documentId')}")
print(f"  ✓ ChromaDB pageNumber:     {chroma_meta.get('pageNumber')}")
print(f"  ✓ ChromaDB text (first 150 chars): {chroma_text[:150]}...")

# 7. ASSERTION: Citation provenance matches ChromaDB metadata exactly
print(f"\n{SEPARATOR}")
print("STEP 7: VERIFY — Citation matches ChromaDB metadata (not LLM-invented)")
print(SEPARATOR)

assert citation["documentId"] == str(stored_document["_id"]), \
    f"FAIL: documentId mismatch: citation={citation['documentId']} vs mongo={stored_document['_id']}"
print("  ✓ PASS: citation.documentId == MongoDB document._id")

assert citation["text"] == chroma_text, \
    f"FAIL: text mismatch between citation and ChromaDB chunk"
print("  ✓ PASS: citation.text == ChromaDB chunk text (exact match)")

assert citation["documentName"] == chroma_meta["documentName"], \
    f"FAIL: documentName mismatch: citation={citation['documentName']} vs chroma={chroma_meta['documentName']}"
print("  ✓ PASS: citation.documentName == ChromaDB metadata.documentName")

assert citation["pageNumber"] == chroma_meta["pageNumber"], \
    f"FAIL: pageNumber mismatch: citation={citation['pageNumber']} vs chroma={chroma_meta['pageNumber']}"
print("  ✓ PASS: citation.pageNumber == ChromaDB metadata.pageNumber")

# 8. Final summary
print(f"\n{SEPARATOR}")
print("COMPLETE CITATION TRACE — VERIFIED")
print(SEPARATOR)
print(f"  Question:       {question}")
print(f"  → LLM Answer:  {brief['problemSummary'][:100]}...")
print(f"  → Evidence:     {citation['text'][:100]}...")
print(f"  → Chunk ID:     {citation['chunkId']}")
print(f"  → Document ID:  {citation['documentId']}")
print(f"  → Document:     {citation['documentName']}")
print(f"  → Page:         {citation['pageNumber']}")
print(f"  → Source:       ChromaDB metadata (NOT Gemini)")
print(f"\n  citation_trace=PASS ✅")
print(SEPARATOR)
