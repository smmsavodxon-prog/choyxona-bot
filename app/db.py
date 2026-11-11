import json
import time
from typing import Any

import aiosqlite

from .config import DB_PATH, OWNER_ID

DEFAULT_SETTINGS: dict[str, Any] = {
    # Brend
    "brand_name": "Choyxona",
    "brand_tagline": "Milliy taomlar · iliq suhbat",
    "brand_emoji": "🫖",
    "brand_logo": "",
    # Bot matnlari
    "welcome_text": "Assalomu alaykum, <b>{name}</b>! 🫖\n\n<b>{brand}</b>ga xush kelibsiz.\nMenyuni oching, sevimli taomlaringizni tanlang — biz darhol tayyorlaymiz.",
    "table_text": "📍 Siz <b>{table}-stol</b>da o'tiribsiz.",
    "no_table_text": "📷 Stolingizdagi QR kodni skanerlang yoki menyu ichida stol raqamini tanlang.",
    "contact_text": "📍 Manzil: shahar, ko'cha, uy\n📞 Telefon: +998 90 000 00 00\n🕐 Ish vaqti: 10:00 — 02:00",
    "accepted_text": "👨‍🍳 <b>#{order}</b> buyurtmangiz qabul qilindi va tayyorlanmoqda.",
    "paid_text": "✅ <b>#{order}</b> to'lovingiz tasdiqlandi! Buyurtmangiz oshxonaga yuborildi. 👨‍🍳",
    "reject_text": "⚠️ <b>#{order}</b> buyurtma bo'yicha to'lov topilmadi. Iltimos, to'lovni amalga oshirib, chekni qaytadan yuklang.",
    "ready_text": "✅ <b>#{order} buyurtmangiz tayyor!</b>\nIltimos, kelib olib keting. Yoqimli ishtaha! 😋",
    "cancel_text": "❌ <b>#{order}</b> buyurtmangiz bekor qilindi. Savollar bo'lsa, ofitsiantga murojaat qiling.",
    "waiter_text": "🙋 Ofitsiant chaqirildi, hozir yetib keladi.",
    # Bot tugmalari
    "btn_menu": "🍽 Menyuni ochish",
    "btn_orders": "🧾 Buyurtmalarim",
    "btn_waiter": "🙋 Ofitsiant chaqirish",
    "btn_contact": "📞 Aloqa",
    "btn_admin": "⚙️ Admin panel",
    "menu_button_text": "Menyu",
    # Ilova matnlari / tugmalari
    "app_hero_title": "Bugun nima tanovul qilamiz?",
    "app_search_placeholder": "Taom yoki ichimlik qidiring…",
    "app_btn_add": "Qo'shish",
    "app_btn_cart": "Savat",
    "app_btn_checkout": "Buyurtma berish",
    "app_btn_paid": "To'lov qildim",
    "app_banner_text": "🔥 Bugun: issiq non va choy bepul!",
    "pay_note": "Ikkala kartaga ko'rsatilgan summani o'tkazing va chek rasmini yuklang.",
    # To'lov
    "pay_mode": "split",  # split = 2 karta, single = 1 karta, online = Click/Payme
    "card0_label": "To'lov kartasi",
    "card0_number": "",
    "card0_holder": "",
    "payment_token": "",
    "online_title": "To'lash",
    "service_percent": 15,
    "currency": "so'm",
    "card1_label": "Xizmat haqi",
    "card1_number": "",
    "card1_holder": "",
    "card2_label": "Taomlar uchun",
    "card2_number": "",
    "card2_holder": "",
    "require_receipt": True,
    "verify_payment": True,
    # Ishlash
    "tables_count": 20,
    "staff_chat_id": "",
    "orders_open": True,
    # Ranglar
    "color_accent": "#E8B04B",
    "color_accent2": "#D9772B",
    "color_bg": "#0E0C0A",
    "color_surface": "#1A1612",
    "color_text": "#F7F0E6",
    "color_muted": "#A6978A",
}

# Hostingdagi SETTING_<KALIT> o'zgaruvchilari standart qiymatni almashtiradi (masalan SETTING_CARD1_NUMBER)
import os as _os
for _k, _v in list(DEFAULT_SETTINGS.items()):
    _env = _os.getenv("SETTING_" + _k.upper())
    if _env is not None and not isinstance(_v, (bool, int)):
        DEFAULT_SETTINGS[_k] = _env

PUBLIC_EXCLUDE = {"staff_chat_id", "payment_token"}

SEED_CATEGORIES = [
    ("Milliy taomlar", "🍛"),
    ("Shashliklar", "🍢"),
    ("Salatlar", "🥗"),
    ("Non va pishiriqlar", "🫓"),
    ("Choy va ichimliklar", "🫖"),
    ("Shirinliklar", "🍰"),
]

SEED_PRODUCTS = [
    (1, "Choyxona oshi", "Devzira guruch, qo'y go'shti, sariq sabzi, no'xat va bedana tuxumi", 45000, "350 g", "🔥 Hit"),
    (1, "Qozon kabob", "Kartoshka bilan qozonda dimlangan yumshoq qo'y go'shti", 65000, "400 g", ""),
    (1, "Lag'mon", "Qo'lda cho'zilgan xamir, go'sht va sabzavotli sous", 38000, "450 g", ""),
    (1, "Manti", "Bug'da pishgan, qo'y go'shtli 5 dona manti", 35000, "5 dona", ""),
    (1, "Shurva", "Qo'y go'shtidan tayyorlangan quyuq sho'rva", 32000, "400 ml", ""),
    (2, "Qo'y go'shti shashlik", "Mangalda pishgan, piyoz va ziravorlar bilan", 22000, "1 six", "⭐ Tavsiya"),
    (2, "Jigar shashlik", "Yangi qo'y jigari, dumba bilan", 18000, "1 six", ""),
    (2, "Lyulya kabob", "Qiyma go'shtdan, zira bilan", 20000, "1 six", ""),
    (3, "Achchiq-chuchuk", "Pomidor, piyoz, achchiq qalampir, rayhon", 15000, "250 g", ""),
    (3, "Toshkent salati", "Mol go'shti, turp, tuxum, qovurilgan piyoz", 28000, "250 g", ""),
    (4, "Tandir non", "Issiq, qarsildoq patir", 6000, "1 dona", ""),
    (4, "Tandir somsa", "Qo'y go'shti va piyozli", 12000, "1 dona", "🔥 Hit"),
    (5, "Ko'k choy", "Choynakda damlangan ko'k choy", 8000, "1 choynak", ""),
    (5, "Qora choy limon bilan", "Limon va asal bilan", 12000, "1 choynak", ""),
    (5, "Kompot", "Uy kompoti, mavsumiy mevalardan", 15000, "1 l", ""),
    (6, "Chak-chak", "Asal bilan, uy usulida", 18000, "200 g", ""),
    (6, "Navvot va parvarda", "Choy bilan ajoyib", 10000, "150 g", ""),
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admins (
    user_id INTEGER PRIMARY KEY, name TEXT DEFAULT '', added_by INTEGER, created_at INTEGER
);
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY, name TEXT DEFAULT '', username TEXT DEFAULT '',
    table_no INTEGER, created_at INTEGER, last_seen INTEGER
);
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, emoji TEXT DEFAULT '',
    sort INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER, name TEXT NOT NULL,
    description TEXT DEFAULT '', price INTEGER NOT NULL DEFAULT 0, unit TEXT DEFAULT '',
    badge TEXT DEFAULT '', photo TEXT DEFAULT '', sort INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, user_name TEXT, username TEXT,
    table_no INTEGER, items TEXT, items_total INTEGER, service_percent REAL, service INTEGER,
    total INTEGER, comment TEXT DEFAULT '', status TEXT DEFAULT 'new', paid INTEGER DEFAULT 0,
    receipt INTEGER DEFAULT 0, staff_chat_id TEXT, staff_msg_id INTEGER, created_at INTEGER, updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id);
"""


class DB:
    def __init__(self) -> None:
        self.conn: aiosqlite.Connection | None = None
        self._settings: dict[str, Any] = {}

    async def connect(self) -> None:
        self.conn = await aiosqlite.connect(DB_PATH)
        self.conn.row_factory = aiosqlite.Row
        await self.conn.execute("PRAGMA journal_mode=WAL")
        await self.conn.executescript(SCHEMA)
        await self.conn.commit()
        await self._load_settings()
        await self._seed()

    async def close(self) -> None:
        if self.conn:
            await self.conn.close()

    # ---------------- Settings ----------------
    async def _load_settings(self) -> None:
        self._settings = dict(DEFAULT_SETTINGS)
        async with self.conn.execute("SELECT key, value FROM settings") as cur:
            async for row in cur:
                try:
                    self._settings[row["key"]] = json.loads(row["value"])
                except Exception:
                    self._settings[row["key"]] = row["value"]

    def get(self, key: str, default: Any = None) -> Any:
        return self._settings.get(key, DEFAULT_SETTINGS.get(key, default))

    def all_settings(self, public: bool = False) -> dict[str, Any]:
        data = dict(self._settings)
        if public:
            for k in PUBLIC_EXCLUDE:
                data.pop(k, None)
        return data

    async def set_many(self, values: dict[str, Any]) -> None:
        for key, value in values.items():
            if key not in DEFAULT_SETTINGS:
                continue
            default = DEFAULT_SETTINGS[key]
            if isinstance(default, bool):
                value = bool(value)
            elif isinstance(default, int):
                try:
                    value = int(float(value))
                except (TypeError, ValueError):
                    continue
            else:
                value = "" if value is None else str(value)
            self._settings[key] = value
            await self.conn.execute(
                "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, json.dumps(value, ensure_ascii=False)),
            )
        await self.conn.commit()

    async def reset_settings(self, keys: list[str]) -> None:
        for key in keys:
            self._settings[key] = DEFAULT_SETTINGS.get(key)
            await self.conn.execute("DELETE FROM settings WHERE key=?", (key,))
        await self.conn.commit()

    async def _seed(self) -> None:
        async with self.conn.execute("SELECT COUNT(*) FROM categories") as cur:
            (count,) = await cur.fetchone()
        if count:
            return
        for i, (name, emoji) in enumerate(SEED_CATEGORIES):
            await self.conn.execute(
                "INSERT INTO categories(name, emoji, sort) VALUES(?,?,?)", (name, emoji, i)
            )
        for i, (cat, name, desc, price, unit, badge) in enumerate(SEED_PRODUCTS):
            await self.conn.execute(
                "INSERT INTO products(category_id, name, description, price, unit, badge, sort) VALUES(?,?,?,?,?,?,?)",
                (cat, name, desc, price, unit, badge, i),
            )
        await self.conn.commit()

    # ---------------- Admins ----------------
    async def is_admin(self, user_id: int) -> bool:
        if user_id == OWNER_ID:
            return True
        async with self.conn.execute("SELECT 1 FROM admins WHERE user_id=?", (user_id,)) as cur:
            return await cur.fetchone() is not None

    async def list_admins(self) -> list[dict]:
        async with self.conn.execute("SELECT * FROM admins ORDER BY created_at") as cur:
            return [dict(r) for r in await cur.fetchall()]

    async def add_admin(self, user_id: int, name: str, added_by: int) -> None:
        await self.conn.execute(
            "INSERT OR REPLACE INTO admins(user_id, name, added_by, created_at) VALUES(?,?,?,?)",
            (user_id, name, added_by, int(time.time())),
        )
        await self.conn.commit()

    async def remove_admin(self, user_id: int) -> None:
        await self.conn.execute("DELETE FROM admins WHERE user_id=?", (user_id,))
        await self.conn.commit()

    # ---------------- Users ----------------
    async def upsert_user(self, user_id: int, name: str, username: str | None, table_no: int | None = None) -> None:
        now = int(time.time())
        await self.conn.execute(
            """INSERT INTO users(user_id, name, username, table_no, created_at, last_seen) VALUES(?,?,?,?,?,?)
               ON CONFLICT(user_id) DO UPDATE SET name=excluded.name, username=excluded.username,
               table_no=COALESCE(excluded.table_no, users.table_no), last_seen=excluded.last_seen""",
            (user_id, name, username or "", table_no, now, now),
        )
        await self.conn.commit()

    async def get_user(self, user_id: int) -> dict | None:
        async with self.conn.execute("SELECT * FROM users WHERE user_id=?", (user_id,)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None

    async def find_user_by_username(self, username: str) -> dict | None:
        async with self.conn.execute(
            "SELECT * FROM users WHERE lower(username)=lower(?)", (username.lstrip("@"),)
        ) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None

    # ---------------- Catalog ----------------
    async def categories(self, only_active: bool = False) -> list[dict]:
        q = "SELECT * FROM categories"
        if only_active:
            q += " WHERE is_active=1"
        q += " ORDER BY sort, id"
        async with self.conn.execute(q) as cur:
            return [dict(r) for r in await cur.fetchall()]

    async def products(self, only_active: bool = False) -> list[dict]:
        q = "SELECT * FROM products"
        if only_active:
            q += " WHERE is_active=1"
        q += " ORDER BY sort, id"
        async with self.conn.execute(q) as cur:
            return [dict(r) for r in await cur.fetchall()]

    async def get_product(self, pid: int) -> dict | None:
        async with self.conn.execute("SELECT * FROM products WHERE id=?", (pid,)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None

    async def save_category(self, data: dict) -> int:
        fields = (data.get("name", "").strip(), data.get("emoji", "").strip(),
                  int(data.get("sort") or 0), 1 if data.get("is_active", True) else 0)
        if data.get("id"):
            await self.conn.execute(
                "UPDATE categories SET name=?, emoji=?, sort=?, is_active=? WHERE id=?", (*fields, int(data["id"]))
            )
            cid = int(data["id"])
        else:
            cur = await self.conn.execute(
                "INSERT INTO categories(name, emoji, sort, is_active) VALUES(?,?,?,?)", fields
            )
            cid = cur.lastrowid
        await self.conn.commit()
        return cid

    async def delete_category(self, cid: int) -> None:
        await self.conn.execute("DELETE FROM products WHERE category_id=?", (cid,))
        await self.conn.execute("DELETE FROM categories WHERE id=?", (cid,))
        await self.conn.commit()

    async def save_product(self, data: dict) -> int:
        fields = (
            int(data.get("category_id") or 0), data.get("name", "").strip(),
            data.get("description", "").strip(), max(0, int(float(data.get("price") or 0))),
            data.get("unit", "").strip(), data.get("badge", "").strip(), data.get("photo", "").strip(),
            int(data.get("sort") or 0), 1 if data.get("is_active", True) else 0,
        )
        if data.get("id"):
            await self.conn.execute(
                """UPDATE products SET category_id=?, name=?, description=?, price=?, unit=?, badge=?, photo=?,
                   sort=?, is_active=? WHERE id=?""",
                (*fields, int(data["id"])),
            )
            pid = int(data["id"])
        else:
            cur = await self.conn.execute(
                """INSERT INTO products(category_id, name, description, price, unit, badge, photo, sort, is_active)
                   VALUES(?,?,?,?,?,?,?,?,?)""",
                fields,
            )
            pid = cur.lastrowid
        await self.conn.commit()
        return pid

    async def delete_product(self, pid: int) -> None:
        await self.conn.execute("DELETE FROM products WHERE id=?", (pid,))
        await self.conn.commit()

    async def reorder(self, table: str, ids: list[int]) -> None:
        if table not in ("categories", "products"):
            return
        for i, item_id in enumerate(ids):
            await self.conn.execute(f"UPDATE {table} SET sort=? WHERE id=?", (i, int(item_id)))
        await self.conn.commit()

    # ---------------- Orders ----------------
    async def create_order(self, **o: Any) -> int:
        now = int(time.time())
        cur = await self.conn.execute(
            """INSERT INTO orders(user_id, user_name, username, table_no, items, items_total, service_percent,
               service, total, comment, status, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (o["user_id"], o["user_name"], o["username"], o["table_no"], json.dumps(o["items"], ensure_ascii=False),
             o["items_total"], o["service_percent"], o["service"], o["total"], o.get("comment", ""), o.get("status", "new"), now, now),
        )
        await self.conn.commit()
        return cur.lastrowid

    async def get_order(self, oid: int) -> dict | None:
        async with self.conn.execute("SELECT * FROM orders WHERE id=?", (oid,)) as cur:
            row = await cur.fetchone()
        if not row:
            return None
        d = dict(row)
        d["items"] = json.loads(d["items"] or "[]")
        return d

    async def update_order(self, oid: int, **fields: Any) -> None:
        if not fields:
            return
        fields["updated_at"] = int(time.time())
        cols = ", ".join(f"{k}=?" for k in fields)
        await self.conn.execute(f"UPDATE orders SET {cols} WHERE id=?", (*fields.values(), oid))
        await self.conn.commit()

    async def user_orders(self, user_id: int, limit: int = 10) -> list[dict]:
        async with self.conn.execute(
            "SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT ?", (user_id, limit)
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]
        for r in rows:
            r["items"] = json.loads(r["items"] or "[]")
        return rows

    async def recent_orders(self, limit: int = 50) -> list[dict]:
        async with self.conn.execute("SELECT * FROM orders ORDER BY id DESC LIMIT ?", (limit,)) as cur:
            rows = [dict(r) for r in await cur.fetchall()]
        for r in rows:
            r["items"] = json.loads(r["items"] or "[]")
        return rows

    async def stats(self, since: int) -> dict:
        async with self.conn.execute(
            """SELECT COUNT(*) AS cnt, COALESCE(SUM(items_total),0) AS items, COALESCE(SUM(service),0) AS service,
               COALESCE(SUM(total),0) AS total FROM orders WHERE created_at>=? AND status!='cancelled'""",
            (since,),
        ) as cur:
            row = dict(await cur.fetchone())
        async with self.conn.execute(
            "SELECT COUNT(*) FROM orders WHERE status IN ('pending','new','accepted')"
        ) as cur:
            (active,) = await cur.fetchone()
        async with self.conn.execute("SELECT COUNT(*) FROM users") as cur:
            (users,) = await cur.fetchone()
        row["active"] = active
        row["users"] = users
        return row


db = DB()
