from pymongo import MongoClient
import sys
from app.core.config import settings

_mongo_client = None

def get_mongo_client() -> MongoClient:
    """
    Returns the global cache client instance of PyMongo.
    """
    global _mongo_client
    if _mongo_client is None:
        try:
            print(f"[Database] Connecting to MongoDB at {settings.MONGODB_URI}...")
            _mongo_client = MongoClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=5000 # fail-fast on startup if connection times out
            )
            # Trigger server selection to force verification of connection status
            _mongo_client.server_info()
            print("[Database] MongoDB connection established successfully.")
        except Exception as e:
            print(f"[Database] CRITICAL: Failed to connect to MongoDB: {str(e)}", file=sys.stderr)
            raise e
    return _mongo_client

def get_db():
    """
    Gets the database object instance using the database name configured in settings.
    """
    client = get_mongo_client()
    # Resolve database name from URI (e.g. mongodb://host/database_name)
    uri_parts = settings.MONGODB_URI.split('/')
    db_name = "indra_db"
    if len(uri_parts) > 3:
        db_name = uri_parts[3].split('?')[0] or "indra_db"
    return client[db_name]
