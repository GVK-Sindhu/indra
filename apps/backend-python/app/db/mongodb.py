from pymongo import MongoClient
from bson import ObjectId
import sys
import copy
from datetime import datetime
from app.core.config import settings

class ResilientCursor(list):
    """Cursor wrapper that mimics pymongo Cursor with sort, skip, and limit."""
    def __init__(self, items):
        super().__init__(items)

    def sort(self, key_or_list, direction=1):
        if isinstance(key_or_list, list):
            for k, d in reversed(key_or_list):
                reverse = d < 0
                self.sort_key(k, reverse)
        else:
            reverse = direction < 0
            self.sort_key(key_or_list, reverse)
        return self

    def sort_key(self, key, reverse=False):
        def _get_val(doc):
            v = doc.get(key)
            if v is None:
                return ""
            if isinstance(v, datetime):
                return v.timestamp()
            return str(v)
        super().sort(key=_get_val, reverse=reverse)

    def skip(self, count):
        return ResilientCursor(self[count:])

    def limit(self, count):
        return ResilientCursor(self[:count])


def _matches_filter(doc: dict, filt: dict) -> bool:
    if not filt:
        return True
    
    # Handle $or top-level
    if "$or" in filt:
        or_branches = filt["$or"]
        matched_any = False
        for branch in or_branches:
            if _matches_filter(doc, branch):
                matched_any = True
                break
        if not matched_any:
            return False

    for k, v in filt.items():
        if k == "$or":
            continue
        
        doc_val = doc.get(k)

        # Handle operators in filter value
        if isinstance(v, dict):
            for op, target in v.items():
                if op == "$in":
                    target_strs = [str(x) for x in target]
                    if str(doc_val) not in target_strs and doc_val not in target:
                        return False
                elif op == "$nin":
                    target_strs = [str(x) for x in target]
                    if str(doc_val) in target_strs or doc_val in target:
                        return False
                elif op == "$ne":
                    if str(doc_val) == str(target):
                        return False
                elif op == "$gt":
                    if doc_val is None or doc_val <= target:
                        return False
                elif op == "$gte":
                    if doc_val is None or doc_val < target:
                        return False
                elif op == "$lt":
                    if doc_val is None or doc_val >= target:
                        return False
                elif op == "$lte":
                    if doc_val is None or doc_val > target:
                        return False
                elif op == "$exists":
                    if bool(doc_val is not None) != bool(target):
                        return False
        else:
            # Direct value match - handle ObjectId / str conversions
            if isinstance(v, ObjectId) or isinstance(doc_val, ObjectId):
                if str(doc_val) != str(v):
                    return False
            elif doc_val != v:
                return False

    return True


class ResilientInsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class ResilientInsertManyResult:
    def __init__(self, inserted_ids):
        self.inserted_ids = inserted_ids


class ResilientUpdateResult:
    def __init__(self, matched_count=1, modified_count=1):
        self.matched_count = matched_count
        self.modified_count = modified_count


class ResilientDeleteResult:
    def __init__(self, deleted_count=1):
        self.deleted_count = deleted_count


class ResilientMongoCollection:
    def __init__(self, name: str):
        self.name = name
        self.docs = []

    def insert_one(self, doc: dict):
        d = copy.deepcopy(doc)
        if "_id" not in d or not d["_id"]:
            d["_id"] = ObjectId()
        self.docs.append(d)
        return ResilientInsertResult(d["_id"])

    def insert_many(self, docs: list):
        ids = []
        for doc in docs:
            d = copy.deepcopy(doc)
            if "_id" not in d or not d["_id"]:
                d["_id"] = ObjectId()
            self.docs.append(d)
            ids.append(d["_id"])
        return ResilientInsertManyResult(ids)

    def find_one(self, filt: dict = None, sort=None):
        filt = filt or {}
        matches = [d for d in self.docs if _matches_filter(d, filt)]
        if not matches:
            return None
        cursor = ResilientCursor(matches)
        if sort:
            cursor.sort(sort)
        return copy.deepcopy(cursor[0])

    def find(self, filt: dict = None, projection=None):
        filt = filt or {}
        matches = [copy.deepcopy(d) for d in self.docs if _matches_filter(d, filt)]
        return ResilientCursor(matches)

    def count_documents(self, filt: dict = None) -> int:
        filt = filt or {}
        return sum(1 for d in self.docs if _matches_filter(d, filt))

    def update_one(self, filt: dict, update: dict, upsert: bool = False):
        filt = filt or {}
        for d in self.docs:
            if _matches_filter(d, filt):
                if "$set" in update:
                    for k, v in update["$set"].items():
                        d[k] = copy.deepcopy(v)
                if "$inc" in update:
                    for k, v in update["$inc"].items():
                        d[k] = d.get(k, 0) + v
                if "$push" in update:
                    for k, v in update["$push"].items():
                        if k not in d or not isinstance(d[k], list):
                            d[k] = []
                        d[k].append(copy.deepcopy(v))
                if "$addToSet" in update:
                    for k, v in update["$addToSet"].items():
                        if k not in d or not isinstance(d[k], list):
                            d[k] = []
                        if v not in d[k]:
                            d[k].append(copy.deepcopy(v))
                return ResilientUpdateResult(1, 1)

        if upsert:
            new_doc = copy.deepcopy(filt)
            if "$set" in update:
                new_doc.update(copy.deepcopy(update["$set"]))
            if "_id" not in new_doc:
                new_doc["_id"] = ObjectId()
            self.docs.append(new_doc)
            return ResilientUpdateResult(0, 1)

        return ResilientUpdateResult(0, 0)

    def update_many(self, filt: dict, update: dict):
        count = 0
        for d in self.docs:
            if _matches_filter(d, filt):
                count += 1
                if "$set" in update:
                    for k, v in update["$set"].items():
                        d[k] = copy.deepcopy(v)
        return ResilientUpdateResult(count, count)

    def delete_one(self, filt: dict):
        filt = filt or {}
        for i, d in enumerate(self.docs):
            if _matches_filter(d, filt):
                del self.docs[i]
                return ResilientDeleteResult(1)
        return ResilientDeleteResult(0)

    def delete_many(self, filt: dict):
        filt = filt or {}
        initial_len = len(self.docs)
        self.docs = [d for d in self.docs if not _matches_filter(d, filt)]
        return ResilientDeleteResult(initial_len - len(self.docs))

    def create_index(self, *args, **kwargs):
        return "index_ok"

    def aggregate(self, pipeline: list):
        # Basic aggregate fallback
        return []


class ResilientMongoDatabase:
    def __init__(self, db_name: str = "indra_db"):
        self.name = db_name
        self.collections = {}

    def __getitem__(self, name: str) -> ResilientMongoCollection:
        if name not in self.collections:
            self.collections[name] = ResilientMongoCollection(name)
        return self.collections[name]

    def __getattr__(self, name: str) -> ResilientMongoCollection:
        return self[name]

    def list_collection_names(self):
        return list(self.collections.keys())


class ResilientMongoClient:
    def __init__(self):
        self.dbs = {}

    def __getitem__(self, name: str) -> ResilientMongoDatabase:
        if name not in self.dbs:
            self.dbs[name] = ResilientMongoDatabase(name)
        return self.dbs[name]

    def __getattr__(self, name: str) -> ResilientMongoDatabase:
        return self[name]

    def server_info(self):
        return {"version": "resilient-mock-5.0.0", "ok": 1.0}


_mongo_client = None
_resilient_active = False

def get_mongo_client():
    """
    Returns cached MongoDB client. Gracefully falls back to resilient in-memory
    mock if external server is unreachable.
    """
    global _mongo_client, _resilient_active
    if _mongo_client is None:
        try:
            print(f"[Database] Attempting connection to MongoDB at {settings.MONGODB_URI}...")
            client = MongoClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=2000 # 2s fail-fast to prevent blocking deployment
            )
            client.server_info()
            _mongo_client = client
            _resilient_active = False
            print("[Database] Live MongoDB connection established.")
        except Exception as e:
            print(f"[Database] MongoDB unavailable ({str(e)}). Activating Resilient In-Memory Database Mode.", file=sys.stderr)
            _mongo_client = ResilientMongoClient()
            _resilient_active = True
    return _mongo_client

def get_db():
    """
    Gets the database object instance using the database name configured in settings.
    """
    client = get_mongo_client()
    uri_parts = settings.MONGODB_URI.split('/')
    db_name = "indra_db"
    if len(uri_parts) > 3:
        db_name = uri_parts[3].split('?')[0] or "indra_db"
    return client[db_name]

