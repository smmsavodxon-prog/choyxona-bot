import asyncio
import hashlib
import hmac
import io
import json
import logging
import time
import uuid
from urllib.parse import parse_qsl

import qrcode
from aiohttp import web
from PIL import Image, ImageOps

from . import bot as tg
from .config import BOT_TOKEN, OWNER_ID, TZ_OFFSET, UPLOAD_DIR, WEBAPP_DIR
from .db import DEFAULT_SETTINGS, db

log = logging.getLogger("web")

INIT_DATA_MAX_AGE = 7 * 24 * 3600
_last_order_at: dict[int, float] = {}
_bot_username: str = ""
UI_KEYS = {"btn_menu", "menu_button_text", "brand_name", "brand_emoji"}


# ---------------------------------------------------------------- auth
def check_init_data(init_data: str) -> dict | None:
    if not init_data or not BOT_TOKEN:
        return None
    try:
        parsed = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=True))
    except ValueError:
        return None
    received = parsed.pop("hash", "")
    check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    calculated = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calculated, received):
        return None
    if time.time() - int(parsed.get("auth_date", "0") or 0) > INIT_DATA_MAX_AGE:
        return None
    try:
        user = json.loads(parsed.get("user", "{}"))
    except ValueError:
        return None
    if not user.get("id"):
        return None
    return user


def get_user(request: web.Request) -> dict:
    user = check_init_data(request.headers.get("X-Init-Data", ""))
    if not user:
        raise web.HTTPUnauthorized(text=json.dumps({"error": "Iltimos, ilovani Telegram ichida oching"}),
                                   content_type="application/json")
    return user


async def require_admin(request: web.Request) -> dict:
    user = get_user(request)
    if not await db.is_admin(int(user["id"])):
        raise web.HTTPForbidden(text=json.dumps({"error": "Faqat adminlar uchun"}), content_type="application/json")
    return user


def full_name(user: dict) -> str:
    return " ".join(x for x in [user.get("first_name"), user.get("last_name")] if x) or "Mijoz"


def err(msg: str, status: int = 400) -> web.Response:
    return web.json_response({"error": msg}, status=status)


async def bot_username() -> str:
    global _bot_username
    if not _bot_username and tg.bot:
        try:
            _bot_username = (await tg.bot.me()).username or ""
        except Exception:  # noqa: BLE001
            pass
    return _bot_username


def public_order(o: dict) -> dict:
    keys = ["id", "table_no", "items", "items_total", "service_percent", "service", "total",
            "comment", "status", "paid", "receipt", "created_at"]
    return {k: o.get(k) for k in keys}


def payment_info() -> dict:
    return {
        "card1": {"label": db.get("card1_label"), "number": db.get("card1_number"), "holder": db.get("card1_holder")},
        "card2": {"label": db.get("card2_label"), "number": db.get("card2_number"), "holder": db.get("card2_holder")},
        "note": db.get("pay_note"),
        "require_receipt": db.get("require_receipt"),
    }


# ---------------------------------------------------------------- public api
async def bootstrap(request: web.Request) -> web.Response:
    user = get_user(request)
    uid = int(user["id"])
    await db.upsert_user(uid, full_name(user), user.get("username"))
    u = await db.get_user(uid)
    return web.json_response({
        "settings": db.all_settings(public=True),
        "categories": await db.categories(only_active=True),
        "products": await db.products(only_active=True),
        "user": {"id": uid, "name": full_name(user)},
        "table": (u or {}).get("table_no"),
        "is_admin": await db.is_admin(uid),
        "is_owner": uid == OWNER_ID,
        "bot_username": await bot_username(),
    })


async def set_table(request: web.Request) -> web.Response:
    user = get_user(request)
    body = await request.json()
    try:
        table = int(body.get("table"))
    except (TypeError, ValueError):
        return err("Stol raqami noto'g'ri")
    if not 1 <= table <= int(db.get("tables_count") or 1):
        return err("Bunday stol yo'q")
    await db.upsert_user(int(user["id"]), full_name(user), user.get("username"), table)
    asyncio.create_task(tg.set_menu_button(int(user["id"]), table))
    return web.json_response({"ok": True, "table": table})


async def create_order(request: web.Request) -> web.Response:
    user = get_user(request)
    uid = int(user["id"])
    if not db.get("orders_open"):
        return err("Hozircha buyurtmalar qabul qilinmayapti")
    body = await request.json()
    try:
        table = int(body.get("table"))
    except (TypeError, ValueError):
        return err("Stol raqamini tanlang")
    if not 1 <= table <= int(db.get("tables_count") or 1):
        return err("Bunday stol yo'q")
    now = time.time()
    if now - _last_order_at.get(uid, 0) < 8:
        return err("Iltimos, bir oz kuting va qayta urinib ko'ring")

    items, items_total = [], 0
    for raw in (body.get("items") or [])[:60]:
        try:
            pid, qty = int(raw.get("id")), int(raw.get("qty"))
        except (TypeError, ValueError, AttributeError):
            continue
        if not 1 <= qty <= 99:
            continue
        p = await db.get_product(pid)
        if not p or not p["is_active"]:
            continue
        items.append({"id": pid, "name": p["name"], "price": p["price"], "qty": qty})
        items_total += p["price"] * qty
    if not items:
        return err("Savat bo'sh yoki mahsulotlar mavjud emas")

    pct = float(db.get("service_percent") or 0)
    service = int(round(items_total * pct / 100))
    comment = str(body.get("comment") or "")[:500]
    _last_order_at[uid] = now
    await db.upsert_user(uid, full_name(user), user.get("username"), table)
    oid = await db.create_order(
        user_id=uid, user_name=full_name(user), username=user.get("username") or "", table_no=table,
        items=items, items_total=items_total, service_percent=pct, service=service,
        total=items_total + service, comment=comment,
    )
    asyncio.create_task(tg.notify_new_order(oid))
    order = await db.get_order(oid)
    return web.json_response({"order": public_order(order), "payment": payment_info()})


async def _own_order(request: web.Request) -> tuple[dict, dict]:
    user = get_user(request)
    try:
        oid = int(request.match_info["oid"])
    except ValueError:
        raise web.HTTPNotFound()
    o = await db.get_order(oid)
    if not o or (o["user_id"] != int(user["id"]) and not await db.is_admin(int(user["id"]))):
        raise web.HTTPNotFound(text=json.dumps({"error": "Buyurtma topilmadi"}), content_type="application/json")
    return user, o


async def get_order(request: web.Request) -> web.Response:
    _, o = await _own_order(request)
    return web.json_response({"order": public_order(o), "payment": payment_info()})


async def my_orders(request: web.Request) -> web.Response:
    user = get_user(request)
    orders = await db.user_orders(int(user["id"]), 20)
    return web.json_response({"orders": [public_order(o) for o in orders]})


async def mark_paid(request: web.Request) -> web.Response:
    _, o = await _own_order(request)
    if o["status"] == "cancelled":
        return err("Buyurtma bekor qilingan")
    if db.get("require_receipt") and not o["receipt"]:
        return err("Iltimos, avval chek rasmini yuklang")
    await db.update_order(o["id"], paid=1)
    asyncio.create_task(tg.refresh_staff_message(o["id"]))
    o = await db.get_order(o["id"])
    return web.json_response({"order": public_order(o)})


async def upload_receipt(request: web.Request) -> web.Response:
    _, o = await _own_order(request)
    data, filename = await _read_file(request)
    if not data:
        return err("Rasm topilmadi")
    jpg = await asyncio.get_running_loop().run_in_executor(None, _process_image, data, 1600)
    if not jpg:
        return err("Faqat rasm yuklash mumkin")
    await db.update_order(o["id"], receipt=1, paid=1)
    asyncio.create_task(tg.send_receipt(o["id"], jpg, f"chek_{o['id']}.jpg"))
    asyncio.create_task(tg.refresh_staff_message(o["id"]))
    o = await db.get_order(o["id"])
    return web.json_response({"order": public_order(o)})


async def _read_file(request: web.Request) -> tuple[bytes, str]:
    reader = await request.multipart()
    async for part in reader:
        if part.name == "file":
            buf = bytearray()
            while chunk := await part.read_chunk(64 * 1024):
                buf.extend(chunk)
                if len(buf) > 15 * 1024 * 1024:
                    raise web.HTTPRequestEntityTooLarge(max_size=15 * 1024 * 1024, actual_size=len(buf))
            return bytes(buf), part.filename or "file.jpg"
    return b"", ""


def _process_image(data: bytes, max_side: int = 1000) -> bytes | None:
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        else:
            img = img.convert("RGB")
        img.thumbnail((max_side, max_side))
        out = io.BytesIO()
        img.save(out, "JPEG", quality=85, optimize=True, progressive=True)
        return out.getvalue()
    except Exception:  # noqa: BLE001
        return None


# ---------------------------------------------------------------- admin api
async def admin_data(request: web.Request) -> web.Response:
    user = await require_admin(request)
    off = TZ_OFFSET * 3600
    day_start = int((time.time() + off) // 86400 * 86400 - off)
    admins = await db.list_admins()
    return web.json_response({
        "settings": db.all_settings(),
        "defaults": DEFAULT_SETTINGS,
        "categories": await db.categories(),
        "products": await db.products(),
        "admins": admins,
        "owner_id": OWNER_ID,
        "me": int(user["id"]),
        "stats": {"today": await db.stats(day_start), "all": await db.stats(0)},
        "orders": await db.recent_orders(40),
        "bot_username": await bot_username(),
    })


async def admin_settings(request: web.Request) -> web.Response:
    await require_admin(request)
    body = await request.json()
    values = body.get("values") or {}
    if "tables_count" in values:
        values["tables_count"] = max(1, min(500, int(float(values["tables_count"] or 1))))
    if "service_percent" in values:
        values["service_percent"] = max(0, min(100, int(float(values["service_percent"] or 0))))
    await db.set_many(values)
    if UI_KEYS & set(values):
        asyncio.create_task(tg.setup_bot_ui())
    return web.json_response({"ok": True, "settings": db.all_settings()})


async def admin_settings_reset(request: web.Request) -> web.Response:
    await require_admin(request)
    body = await request.json()
    keys = [k for k in (body.get("keys") or []) if k in DEFAULT_SETTINGS]
    await db.reset_settings(keys)
    asyncio.create_task(tg.setup_bot_ui())
    return web.json_response({"ok": True, "settings": db.all_settings()})


async def admin_save_category(request: web.Request) -> web.Response:
    await require_admin(request)
    body = await request.json()
    if not str(body.get("name", "")).strip():
        return err("Bo'lim nomini kiriting")
    cid = await db.save_category(body)
    return web.json_response({"ok": True, "id": cid, "categories": await db.categories()})


async def admin_delete_category(request: web.Request) -> web.Response:
    await require_admin(request)
    await db.delete_category(int(request.match_info["id"]))
    return web.json_response({"ok": True})


async def admin_save_product(request: web.Request) -> web.Response:
    await require_admin(request)
    body = await request.json()
    if not str(body.get("name", "")).strip():
        return err("Mahsulot nomini kiriting")
    if not body.get("category_id"):
        return err("Bo'limni tanlang")
    pid = await db.save_product(body)
    return web.json_response({"ok": True, "id": pid, "product": await db.get_product(pid)})


async def admin_delete_product(request: web.Request) -> web.Response:
    await require_admin(request)
    await db.delete_product(int(request.match_info["id"]))
    return web.json_response({"ok": True})


async def admin_reorder(request: web.Request) -> web.Response:
    await require_admin(request)
    body = await request.json()
    await db.reorder(body.get("table", ""), body.get("ids") or [])
    return web.json_response({"ok": True})


async def admin_upload(request: web.Request) -> web.Response:
    await require_admin(request)
    data, _ = await _read_file(request)
    if not data:
        return err("Fayl topilmadi")
    jpg = await asyncio.get_running_loop().run_in_executor(None, _process_image, data, 1000)
    if not jpg:
        return err("Faqat rasm (JPG, PNG, WEBP) yuklash mumkin")
    name = f"{uuid.uuid4().hex}.jpg"
    (UPLOAD_DIR / name).write_bytes(jpg)
    return web.json_response({"ok": True, "url": f"/uploads/{name}"})


async def admin_add_admin(request: web.Request) -> web.Response:
    user = await require_admin(request)
    body = await request.json()
    raw = str(body.get("user", "")).strip()
    name = str(body.get("name", "")).strip()
    target = None
    if raw.lstrip("-").isdigit():
        target = int(raw)
        if not name:
            u = await db.get_user(target)
            name = (u or {}).get("name", "")
    elif raw.startswith("@") or raw:
        u = await db.find_user_by_username(raw)
        if not u:
            return err("Bu foydalanuvchi topilmadi. U avval botga /start bosishi kerak yoki ID raqamini kiriting.")
        target, name = u["user_id"], name or u["name"]
    if not target or target <= 0:
        return err("Telegram ID yoki @username kiriting")
    if target == OWNER_ID:
        return err("Bu bot egasi — u allaqachon to'liq huquqqa ega")
    await db.add_admin(target, name, int(user["id"]))
    if tg.bot:
        try:
            await tg.bot.send_message(target, "🎉 Siz botga <b>admin</b> qilib tayinlandingiz! /admin buyrug'ini bosing.")
        except Exception:  # noqa: BLE001
            pass
    return web.json_response({"ok": True, "admins": await db.list_admins()})


async def admin_remove_admin(request: web.Request) -> web.Response:
    await require_admin(request)
    target = int(request.match_info["id"])
    if target == OWNER_ID:
        return err("Bot egasini o'chirib bo'lmaydi")
    await db.remove_admin(target)
    return web.json_response({"ok": True, "admins": await db.list_admins()})


async def admin_order_status(request: web.Request) -> web.Response:
    await require_admin(request)
    oid = int(request.match_info["oid"])
    body = await request.json()
    status = body.get("status")
    notify = {"accepted": "accepted_text", "ready": "ready_text", "cancelled": "cancel_text", "done": None}
    if status not in notify:
        return err("Noto'g'ri holat")
    o = await db.get_order(oid)
    if not o:
        return err("Topilmadi", 404)
    await db.update_order(oid, status=status)
    o["status"] = status
    if notify[status]:
        asyncio.create_task(tg.notify_customer(o, notify[status]))
    asyncio.create_task(tg.refresh_staff_message(oid))
    return web.json_response({"ok": True})


async def admin_test_staff(request: web.Request) -> web.Response:
    await require_admin(request)
    if not tg.bot:
        return err("Bot ulanmagan")
    sent = 0
    for target in await tg.staff_targets():
        try:
            await tg.bot.send_message(target, "✅ Sinov xabari: buyurtmalar shu yerga keladi.")
            sent += 1
        except Exception as e:  # noqa: BLE001
            return err(f"Yuborib bo'lmadi: {e}")
    return web.json_response({"ok": True, "sent": sent})


# ---------------------------------------------------------------- QR
def _table_link(username: str, table: int) -> str:
    return f"https://t.me/{username}?start=t{table}"


async def qr_png(request: web.Request) -> web.Response:
    table = int(request.match_info["table"])
    username = await bot_username()
    if not username:
        return web.Response(status=503, text="Bot ulanmagan")
    img = qrcode.make(_table_link(username, table), box_size=12, border=2)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return web.Response(body=buf.getvalue(), content_type="image/png",
                        headers={"Content-Disposition": f'inline; filename="stol_{table}.png"'})


async def qr_print(request: web.Request) -> web.Response:
    username = await bot_username()
    count = int(db.get("tables_count") or 1)
    brand = tg.esc(db.get("brand_name"))
    emoji = tg.esc(db.get("brand_emoji"))
    accent = tg.esc(db.get("color_accent"))
    cards = "".join(
        f"""<div class="c"><div class="b">{emoji} {brand}</div><img src="/qr/{i}.png" alt="QR {i}">
        <div class="t">{i}-stol</div><div class="s">Kamerani QR kodga qarating va buyurtma bering</div>
        <div class="u">t.me/{username}?start=t{i}</div></div>"""
        for i in range(1, count + 1)
    )
    page = f"""<!doctype html><html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>QR kodlar — {brand}</title>
<style>body{{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#f4f1ec;color:#1c1712}}
.top{{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}}
button{{background:{accent};border:0;border-radius:12px;padding:12px 20px;font-weight:700;font-size:16px;cursor:pointer}}
.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}}
.c{{background:#fff;border-radius:20px;padding:20px;text-align:center;border:3px solid {accent};break-inside:avoid}}
.c img{{width:100%;max-width:220px}}.b{{font-weight:800;font-size:18px}}.t{{font-size:34px;font-weight:900;margin:4px 0}}
.s{{font-size:13px;color:#555}}.u{{font-size:11px;color:#999;margin-top:6px;word-break:break-all}}
@media print{{.top{{display:none}}body{{background:#fff}}.g{{grid-template-columns:repeat(3,1fr)}}}}</style></head>
<body><div class="top"><h2 style="margin:0">QR kodlar · {count} ta stol</h2>
<button onclick="print()">🖨 Chop etish / PDF saqlash</button></div><div class="g">{cards}</div></body></html>"""
    return web.Response(text=page, content_type="text/html")


# ---------------------------------------------------------------- static
async def index(request: web.Request) -> web.Response:
    resp = web.FileResponse(WEBAPP_DIR / "index.html")
    resp.headers["Cache-Control"] = "no-cache"
    return resp


async def health(request: web.Request) -> web.Response:
    return web.json_response({"ok": True})


@web.middleware
async def error_middleware(request: web.Request, handler):
    try:
        return await handler(request)
    except web.HTTPException:
        raise
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as e:
        log.warning("bad request %s: %s", request.path, e)
        return err("Noto'g'ri so'rov")
    except Exception:  # noqa: BLE001
        log.exception("server error %s", request.path)
        return err("Serverda xatolik. Keyinroq urinib ko'ring.", 500)


@web.middleware
async def static_cache(request: web.Request, handler):
    resp = await handler(request)
    if request.path.startswith("/uploads/"):
        resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif request.path.startswith("/static/"):
        resp.headers["Cache-Control"] = "no-cache"
    return resp


def build_app() -> web.Application:
    app = web.Application(client_max_size=20 * 1024 * 1024, middlewares=[error_middleware, static_cache])
    r = app.router
    r.add_get("/", index)
    r.add_get("/health", health)
    r.add_get("/api/bootstrap", bootstrap)
    r.add_post("/api/table", set_table)
    r.add_post("/api/orders", create_order)
    r.add_get("/api/orders", my_orders)
    r.add_get("/api/orders/{oid}", get_order)
    r.add_post("/api/orders/{oid}/paid", mark_paid)
    r.add_post("/api/orders/{oid}/receipt", upload_receipt)
    r.add_get("/api/admin/data", admin_data)
    r.add_post("/api/admin/settings", admin_settings)
    r.add_post("/api/admin/settings/reset", admin_settings_reset)
    r.add_post("/api/admin/category", admin_save_category)
    r.add_delete("/api/admin/category/{id}", admin_delete_category)
    r.add_post("/api/admin/product", admin_save_product)
    r.add_delete("/api/admin/product/{id}", admin_delete_product)
    r.add_post("/api/admin/reorder", admin_reorder)
    r.add_post("/api/admin/upload", admin_upload)
    r.add_post("/api/admin/admins", admin_add_admin)
    r.add_delete("/api/admin/admins/{id}", admin_remove_admin)
    r.add_post("/api/admin/orders/{oid}/status", admin_order_status)
    r.add_post("/api/admin/test-staff", admin_test_staff)
    r.add_get("/qr/{table:\\d+}.png", qr_png)
    r.add_get("/qr/print", qr_print)
    r.add_static("/static/", WEBAPP_DIR / "static")
    r.add_static("/uploads/", UPLOAD_DIR)
    return app
