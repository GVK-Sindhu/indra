import os
from dotenv import load_dotenv
from google import genai

# Load standard .env configuration file
load_dotenv(dotenv_path="d:/projects/indra/.env")

api_key = os.getenv("GEMINI_API_KEY")
print(f"Loaded API key (first 5 chars): {api_key[:5] if api_key else 'None'}")

client = genai.Client(api_key=api_key)
try:
    response = client.models.embed_content(
        model="gemini-embedding-2",
        contents="INDRA Industrial Knowledge Intelligence test"
    )
    vector = response.embeddings[0].values
    print(f"Success! Vector dimension: {len(vector)}")
except Exception as e:
    print(f"Error calling embedding API: {str(e)}")
