from google import genai
import sys
from app.core.config import settings

# Cache the client instance to prevent re-initialization overhead
_genai_client = None

def get_genai_client():
    global _genai_client
    if _genai_client is None:
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            print("[EmbeddingService] WARNING: GEMINI_API_KEY environment variable is not set. API calls will fail.", file=sys.stderr)
        # Initializes the standard Client (auto-detects GEMINI_API_KEY)
        _genai_client = genai.Client(api_key=api_key)
    return _genai_client

def get_embedding(text: str) -> list:
    """
    Generates a single vector embedding using gemini-embedding-2.
    """
    client = get_genai_client()
    try:
        response = client.models.embed_content(
            model="gemini-embedding-2",
            contents=text
        )
        return response.embeddings[0].values
    except Exception as e:
        print(f"[EmbeddingService] Failed to generate embedding: {str(e)}", file=sys.stderr)
        raise e

def get_embeddings_bulk(texts: list) -> list:
    """
    Generates a batch of vector embeddings in a single API call for fast ingestion.
    """
    if not texts:
        return []
    client = get_genai_client()
    try:
        response = client.models.embed_content(
            model="gemini-embedding-2",
            contents=texts
        )
        return [e.values for e in response.embeddings]
    except Exception as e:
        print(f"[EmbeddingService] Failed to generate bulk embeddings: {str(e)}", file=sys.stderr)
        raise e
