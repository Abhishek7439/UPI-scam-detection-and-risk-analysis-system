"""Config loader — reads .env and exposes typed settings."""
import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_TIMEOUT_S: float = float(os.getenv("GROQ_TIMEOUT_S", "2"))
ENABLE_LIVE_LOOKUPS: bool = os.getenv("ENABLE_LIVE_LOOKUPS", "true").lower() == "true"
