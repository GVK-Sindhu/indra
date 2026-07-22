import os
from dotenv import load_dotenv

# Load standard .env configuration file from project root or current working directory
load_dotenv()

class Settings:
    NODE_ENV: str = os.getenv("NODE_ENV", "development")
    PORT: int = int(os.getenv("PORT", "5000"))
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017/indra_db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "indra_super_secret_hackathon_key_2026")
    JWT_EXPIRES_IN: str = os.getenv("JWT_EXPIRES_IN", "24h")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    CHROMA_DB_PATH: str = os.getenv("CHROMA_DB_PATH", "./chroma_db")
    SEED_DB: str = os.getenv("SEED_DB", "false")

settings = Settings()
