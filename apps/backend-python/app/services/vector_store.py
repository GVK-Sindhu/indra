import os
import chromadb
from app.core.config import settings

# Read Chroma persistent directory path from configuration settings
CHROMA_PATH = settings.CHROMA_DB_PATH

_chroma_client = None

def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        os.makedirs(CHROMA_PATH, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
    return _chroma_client

def get_collection():
    client = get_chroma_client()
    # Returns or creates the default indra_knowledge index collection
    return client.get_or_create_collection(name="indra_knowledge")

def add_chunks_to_vector_store(ids: list, embeddings: list, metadatas: list, documents: list):
    """
    Saves document chunk text content, embeddings, and page-level metadata into ChromaDB.
    """
    if not ids:
        return
    collection = get_collection()
    collection.add(
        ids=ids,
        embeddings=embeddings,
        metadatas=metadatas,
        documents=documents
    )

def search_similar_chunks(query_embedding: list, asset_id: str = None, limit: int = 6) -> list:
    """
    Queries ChromaDB vector collection for similar context.
    Optionally applies a metadata filter on assetId.
    """
    collection = get_collection()
    
    # Construct ChromaDB metadata filter dictionary
    where_filter = {}
    if asset_id:
        where_filter["assetId"] = asset_id

    # Execute query
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=limit,
        where=where_filter if where_filter else None
    )

    hits = []
    if not results or not results["ids"] or not results["ids"][0]:
        return hits

    # Re-structure ChromaDB raw response list into a clean dictionary
    for i in range(len(results["ids"][0])):
        hits.append({
            "chunkId": results["ids"][0][i],
            "content": results["documents"][0][i],
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i] if results.get("distances") else 0.0
        })

    return hits
