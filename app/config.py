import os
from pathlib import Path


def _load_dotenv() -> None:
    """Oddiy .env o'quvchi (qo'shimcha kutubxonasiz)."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
WEBAPP_DIR = BASE_DIR / "webapp"

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
OWNER_ID = int(os.getenv("OWNER_ID", "8427771708") or 0)
PORT = int(os.getenv("PORT", "8080"))
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data"))).resolve()
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "choyxona.db"

# Vaqt mintaqasi (O'zbekiston: +5)
TZ_OFFSET = float(os.getenv("TZ_OFFSET", "5"))


def local_time(ts: float | None = None):
    import time as _t
    return _t.gmtime((ts if ts is not None else _t.time()) + TZ_OFFSET * 3600)


# Faqat sinov uchun: botni Telegramga ulamasdan ishga tushirish
DISABLE_BOT = os.getenv("DISABLE_BOT", "") == "1"


def webapp_url() -> str:
    url = os.getenv("WEBAPP_URL", "").strip()
    if not url:
        domain = os.getenv("RAILWAY_PUBLIC_DOMAIN") or os.getenv("RENDER_EXTERNAL_HOSTNAME") or ""
        if domain:
            url = f"https://{domain}"
    return url.rstrip("/")


DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
