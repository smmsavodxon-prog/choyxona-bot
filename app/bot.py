import asyncio
import html
import logging
import time

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ChatType, ParseMode
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import (
    BotCommand,
    BufferedInputFile,
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    LabeledPrice,
    PreCheckoutQuery,
    MenuButtonWebApp,
    Message,
    ReplyKeyboardMarkup,
    WebAppInfo,
)

from .config import BOT_TOKEN, OWNER_ID, local_time, webapp_url
from .db import db

log = logging.getLogger("bot")

bot: Bot | None = None
dp = Dispatcher()
router = Router()
dp.include_router(router)

STATUS_LABELS = {
    "new": "🆕 Yangi",
    "accepted": "👨‍🍳 Tayyorlanmoqda",
    "ready": "✅ Tayyor",
    "done": "🏁 Berildi",
    "cancelled": "❌ Bekor qilindi",
}

_waiter_cooldown: dict[int, float] = {}


def create_bot() -> Bot:
    global bot
    bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    return bot


# ---------------------------------------------------------------- helpers
def money(value: int | float) -> str:
    return f"{int(round(value)):,}".replace(",", " ") + " " + str(db.get("currency"))


def esc(text) -> str:
    return html.escape(str(text or ""))


def fill(template: str, **kw) -> str:
    """Matn shablonlarini xavfsiz to'ldirish ({name}, {table}, {order}, {brand})."""
    text = str(template or "")
    for key, value in kw.items():
        text = text.replace("{" + key + "}", str(value))
    return text


def app_url(table: int | None = None, admin: bool = False) -> str:
    base = webapp_url()
    if not base:
        return ""
    url = base + "/"
    params = []
    if table:
        params.append(f"table={table}")
    params.append(f"v={int(time.time()) // 600}")
    url += "?" + "&".join(params)
    if admin:
        url += "#admin"
    return url


def parse_table(payload: str | None) -> int | None:
    if not payload:
        return None
    p = payload.lower().replace("table_", "").replace("table", "").replace("stol", "").lstrip("t_")
    if p.isdigit():
        n = int(p)
        if 0 < n <= max(500, int(db.get("tables_count") or 0)):
            return n
    return None


async def main_keyboard(user_id: int) -> ReplyKeyboardMarkup:
    rows = [
        [KeyboardButton(text=db.get("btn_orders")), KeyboardButton(text=db.get("btn_waiter"))],
        [KeyboardButton(text=db.get("btn_contact"))],
    ]
    if await db.is_admin(user_id):
        rows[1].append(KeyboardButton(text=db.get("btn_admin")))
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True, is_persistent=True)


def menu_inline(table: int | None) -> InlineKeyboardMarkup | None:
    url = app_url(table)
    if not url:
        return None
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text=db.get("btn_menu"), web_app=WebAppInfo(url=url))]]
    )


async def set_menu_button(chat_id: int | None = None, table: int | None = None) -> None:
    url = app_url(table)
    if not url or not bot:
        return
    try:
        await bot.set_chat_menu_button(
            chat_id=chat_id,
            menu_button=MenuButtonWebApp(text=str(db.get("menu_button_text"))[:16] or "Menyu",
                                         web_app=WebAppInfo(url=url)),
        )
    except Exception as e:  # noqa: BLE001
        log.warning("menu button: %s", e)


async def staff_targets() -> list[int | str]:
    chat = str(db.get("staff_chat_id") or "").strip()
    if chat:
        return [chat]
    ids = [OWNER_ID] + [a["user_id"] for a in await db.list_admins()]
    return list(dict.fromkeys(ids))


# ---------------------------------------------------------------- order rendering
def render_order(o: dict) -> str:
    who = esc(o.get("user_name") or "Mijoz")
    if o.get("username"):
        who += f" (@{esc(o['username'])})"
    lines = [
        f"🧾 <b>Buyurtma #{o['id']}</b>   {STATUS_LABELS.get(o['status'], o['status'])}",
        f"📍 <b>Stol: {o['table_no']}</b>",
        f"👤 <a href=\"tg://user?id={o['user_id']}\">{who}</a>",
        "━━━━━━━━━━━━━━",
    ]
    for it in o["items"]:
        lines.append(f"▫️ {it['qty']} × {esc(it['name'])} — {money(it['price'] * it['qty'])}")
    lines.append("━━━━━━━━━━━━━━")
    pct = o.get("service_percent") or 0
    pct_s = f"{pct:g}"
    lines.append(f"🍽 Taomlar: <b>{money(o['items_total'])}</b>")
    lines.append(f"🤝 Xizmat ({pct_s}%): <b>{money(o['service'])}</b>")
    lines.append(f"💰 Jami: <b>{money(o['total'])}</b>")
    if o.get("comment"):
        lines.append(f"\n💬 Izoh: <i>{esc(o['comment'])}</i>")
    if o.get("paid") and o.get("receipt") == 2:
        pay = "✅ ONLAYN TO'LANDI (Click/Payme)"
    elif o.get("paid"):
        pay = "✅ Mijoz to'lov qildim dedi"
        if o.get("receipt"):
            pay += " (chek yuborildi)"
    else:
        pay = "⏳ To'lov kutilmoqda"
    lines.append(f"\n💳 {pay}")
    lines.append(f"🕐 {time.strftime('%d.%m %H:%M', local_time(o['created_at']))}")
    return "\n".join(lines)


def order_keyboard(o: dict) -> InlineKeyboardMarkup | None:
    oid = o["id"]
    st = o["status"]
    rows: list[list[InlineKeyboardButton]] = []
    if st == "new":
        rows.append([InlineKeyboardButton(text="✅ Qabul qilish", callback_data=f"o:accept:{oid}")])
        rows.append([
            InlineKeyboardButton(text="🍽 Tayyor", callback_data=f"o:ready:{oid}"),
            InlineKeyboardButton(text="❌ Bekor", callback_data=f"o:cancel:{oid}"),
        ])
    elif st == "accepted":
        rows.append([InlineKeyboardButton(text="🍽 Tayyor", callback_data=f"o:ready:{oid}")])
        rows.append([InlineKeyboardButton(text="❌ Bekor", callback_data=f"o:cancel:{oid}")])
    elif st == "ready":
        rows.append([InlineKeyboardButton(text="🏁 Mijozga berildi", callback_data=f"o:done:{oid}")])
    if not rows:
        return None
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def notify_new_order(oid: int) -> None:
    if not bot:
        return
    o = await db.get_order(oid)
    if not o:
        return
    for target in await staff_targets():
        try:
            msg = await bot.send_message(target, render_order(o), reply_markup=order_keyboard(o))
            if not o.get("staff_msg_id"):
                await db.update_order(oid, staff_chat_id=str(msg.chat.id), staff_msg_id=msg.message_id)
                o["staff_msg_id"] = msg.message_id
        except Exception as e:  # noqa: BLE001
            log.warning("staff notify %s: %s", target, e)


async def refresh_staff_message(oid: int) -> None:
    if not bot:
        return
    o = await db.get_order(oid)
    if not o or not o.get("staff_msg_id"):
        return
    try:
        await bot.edit_message_text(
            chat_id=o["staff_chat_id"], message_id=o["staff_msg_id"],
            text=render_order(o), reply_markup=order_keyboard(o),
        )
    except Exception as e:  # noqa: BLE001
        log.debug("refresh staff: %s", e)


async def send_receipt(oid: int, data: bytes, filename: str) -> None:
    if not bot:
        return
    o = await db.get_order(oid)
    if not o:
        return
    caption = f"🧾 <b>#{oid}</b> buyurtma uchun to'lov cheki · Stol {o['table_no']} · {money(o['total'])}"
    file = BufferedInputFile(data, filename=filename or "chek.jpg")
    targets = [o["staff_chat_id"]] if o.get("staff_chat_id") else await staff_targets()
    for target in targets:
        try:
            kwargs = {}
            if o.get("staff_msg_id") and str(target) == str(o.get("staff_chat_id")):
                kwargs["reply_to_message_id"] = o["staff_msg_id"]
            await bot.send_photo(target, file, caption=caption, **kwargs)
        except Exception as e:  # noqa: BLE001
            log.warning("receipt send: %s", e)


async def notify_customer(o: dict, key: str) -> None:
    if not bot:
        return
    text = fill(db.get(key), order=o["id"], table=o["table_no"], brand=db.get("brand_name"))
    try:
        await bot.send_message(o["user_id"], text)
    except Exception as e:  # noqa: BLE001
        log.warning("customer notify: %s", e)


# ---------------------------------------------------------------- online payment
async def invoice_link(o: dict) -> str:
    prices = [LabeledPrice(label="Taomlar", amount=int(o["items_total"]) * 100)]
    if o["service"]:
        prices.append(LabeledPrice(label=f"Xizmat haqi ({o['service_percent']:g}%)", amount=int(o["service"]) * 100))
    names = ", ".join(f"{i['qty']}× {i['name']}" for i in o["items"])
    return await bot.create_invoice_link(
        title=f"Buyurtma #{o['id']} · {o['table_no']}-stol"[:32],
        description=(f"{db.get('brand_name')}: {names}")[:255],
        payload=f"order:{o['id']}",
        provider_token=str(db.get("payment_token")).strip(),
        currency="UZS",
        prices=prices,
    )


@router.pre_checkout_query()
async def on_pre_checkout(q: PreCheckoutQuery) -> None:
    try:
        oid = int(q.invoice_payload.split(":")[1])
    except (IndexError, ValueError):
        await q.answer(ok=False, error_message="Buyurtma topilmadi")
        return
    o = await db.get_order(oid)
    if not o or o["status"] == "cancelled":
        await q.answer(ok=False, error_message="Buyurtma bekor qilingan yoki topilmadi")
    elif o["paid"] and o["receipt"] == 2:
        await q.answer(ok=False, error_message="Bu buyurtma allaqachon to'langan")
    elif q.total_amount != int(o["total"]) * 100:
        await q.answer(ok=False, error_message="Summa o'zgargan, qaytadan urinib ko'ring")
    else:
        await q.answer(ok=True)


@router.message(F.successful_payment)
async def on_paid(message: Message) -> None:
    sp = message.successful_payment
    try:
        oid = int(sp.invoice_payload.split(":")[1])
    except (IndexError, ValueError):
        return
    await db.update_order(oid, paid=1, receipt=2)
    await refresh_staff_message(oid)
    o = await db.get_order(oid)
    for target in ([o["staff_chat_id"]] if o.get("staff_chat_id") else await staff_targets()):
        try:
            kwargs = {"reply_to_message_id": o["staff_msg_id"]} if o.get("staff_msg_id") and str(target) == str(o.get("staff_chat_id")) else {}
            await bot.send_message(target, f"💳 <b>#{oid}</b> onlayn to'landi: {money(sp.total_amount / 100)} · Stol {o['table_no']}", **kwargs)
        except Exception as e:  # noqa: BLE001
            log.warning("paid notify: %s", e)
    await message.answer(f"✅ To'lov qabul qilindi! Rahmat. <b>#{oid}</b> buyurtmangiz tayyorlanmoqda.")


# ---------------------------------------------------------------- handlers
@router.message(CommandStart(), F.chat.type == ChatType.PRIVATE)
async def on_start(message: Message, command: CommandObject) -> None:
    user = message.from_user
    table = parse_table(command.args)
    await db.upsert_user(user.id, user.full_name, user.username, table)
    saved = await db.get_user(user.id)
    table = table or (saved or {}).get("table_no")

    brand = db.get("brand_name")
    text = fill(db.get("welcome_text"), name=esc(user.first_name), brand=esc(brand))
    await message.answer(text, reply_markup=await main_keyboard(user.id))

    if not webapp_url():
        await message.answer("⚠️ Mini App manzili (WEBAPP_URL) hali sozlanmagan. Admin uni hostingda kiritishi kerak.")
        return
    second = fill(db.get("table_text"), table=table) if table else db.get("no_table_text")
    await message.answer(second, reply_markup=menu_inline(table))
    if table:
        await set_menu_button(user.id, table)


@router.message(Command("menu"), F.chat.type == ChatType.PRIVATE)
async def on_menu(message: Message) -> None:
    u = await db.get_user(message.from_user.id)
    table = (u or {}).get("table_no")
    await message.answer(db.get("brand_emoji") + " " + esc(db.get("brand_name")), reply_markup=menu_inline(table))


@router.message(Command("id"))
async def on_id(message: Message) -> None:
    text = f"👤 Sizning ID: <code>{message.from_user.id}</code>"
    if message.chat.type != ChatType.PRIVATE:
        text += f"\n💬 Guruh ID: <code>{message.chat.id}</code>"
    await message.answer(text)


@router.message(Command("setgroup"))
async def on_setgroup(message: Message) -> None:
    if message.chat.type == ChatType.PRIVATE:
        await message.answer("Bu buyruqni xodimlar guruhida yozing (botni avval guruhga qo'shing).")
        return
    if not await db.is_admin(message.from_user.id):
        await message.answer("⛔ Faqat adminlar bu buyruqni ishlata oladi.")
        return
    await db.set_many({"staff_chat_id": str(message.chat.id)})
    await message.answer(
        "✅ Tayyor! Endi barcha buyurtmalar shu guruhga keladi.\n"
        "Guruhdagi har bir xodim <b>Qabul qilish</b> va <b>Tayyor</b> tugmalarini bosa oladi."
    )


@router.message(Command("unsetgroup"))
async def on_unsetgroup(message: Message) -> None:
    if not await db.is_admin(message.from_user.id):
        return
    await db.set_many({"staff_chat_id": ""})
    await message.answer("Buyurtmalar endi egasi va adminlarga shaxsiy xabar bo'lib keladi.")


@router.message(Command("admin"), F.chat.type == ChatType.PRIVATE)
async def on_admin(message: Message) -> None:
    await open_admin(message)


async def open_admin(message: Message) -> None:
    if not await db.is_admin(message.from_user.id):
        await message.answer("⛔ Bu bo'lim faqat adminlar uchun.")
        return
    url = app_url(admin=True)
    if not url:
        await message.answer("⚠️ WEBAPP_URL sozlanmagan.")
        return
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="⚙️ Admin panelni ochish",
                                                                      web_app=WebAppInfo(url=url))]])
    await message.answer(
        "⚙️ <b>Admin panel</b>\n\nBu yerda bo'limlar, mahsulotlar, narxlar, rasmlar, kartalar, adminlar, "
        "tugmalar, matnlar va ranglarni o'zgartirasiz.\n\n"
        "Foydali buyruqlar:\n"
        "/setgroup — xodimlar guruhida yozing, buyurtmalar o'sha yerga keladi\n"
        "/addadmin ID — admin qo'shish\n/id — ID raqamingizni bilish",
        reply_markup=kb,
    )


@router.message(Command("addadmin"))
async def on_addadmin(message: Message, command: CommandObject) -> None:
    if not await db.is_admin(message.from_user.id):
        return
    arg = (command.args or "").strip()
    target = None
    name = ""
    if arg.isdigit():
        target = int(arg)
        u = await db.get_user(target)
        name = (u or {}).get("name", "")
    elif arg.startswith("@"):
        u = await db.find_user_by_username(arg)
        if u:
            target, name = u["user_id"], u["name"]
    elif message.reply_to_message and message.reply_to_message.from_user:
        target = message.reply_to_message.from_user.id
        name = message.reply_to_message.from_user.full_name
    if not target:
        await message.answer("Foydalanish: <code>/addadmin 123456789</code>\n"
                             "(@username faqat u botga /start bosgan bo'lsa ishlaydi)")
        return
    await db.add_admin(target, name, message.from_user.id)
    await message.answer(f"✅ Admin qo'shildi: <code>{target}</code> {esc(name)}")


@router.message(F.chat.type == ChatType.PRIVATE, F.text)
async def on_text(message: Message) -> None:
    text = message.text.strip()
    uid = message.from_user.id
    if text == db.get("btn_orders"):
        orders = await db.user_orders(uid, 5)
        if not orders:
            await message.answer("Sizda hali buyurtmalar yo'q. Menyuni ochib, birinchisini bering! 😊",
                                 reply_markup=menu_inline((await db.get_user(uid) or {}).get("table_no")))
            return
        parts = []
        for o in orders:
            parts.append(f"<b>#{o['id']}</b> · {STATUS_LABELS.get(o['status'], o['status'])} · "
                         f"Stol {o['table_no']} · {money(o['total'])}")
        await message.answer("🧾 <b>Oxirgi buyurtmalaringiz</b>\n\n" + "\n".join(parts))
    elif text == db.get("btn_waiter"):
        await call_waiter(message)
    elif text == db.get("btn_contact"):
        await message.answer(db.get("contact_text"))
    elif text == db.get("btn_admin"):
        await open_admin(message)
    elif text == db.get("btn_menu"):
        await on_menu(message)
    else:
        u = await db.get_user(uid)
        await message.answer("Menyuni ochish uchun pastdagi tugmani bosing 👇",
                             reply_markup=menu_inline((u or {}).get("table_no")))


async def call_waiter(message: Message) -> None:
    uid = message.from_user.id
    u = await db.get_user(uid)
    table = (u or {}).get("table_no")
    if not table:
        await message.answer(db.get("no_table_text"))
        return
    now = time.time()
    if now - _waiter_cooldown.get(uid, 0) < 60:
        await message.answer("⏳ Ofitsiant allaqachon chaqirildi, biroz kuting.")
        return
    _waiter_cooldown[uid] = now
    for target in await staff_targets():
        try:
            await bot.send_message(target, f"🙋 <b>Stol {table}</b> ofitsiant chaqiryapti!\n👤 {esc(message.from_user.full_name)}")
        except Exception as e:  # noqa: BLE001
            log.warning("waiter: %s", e)
    await message.answer(db.get("waiter_text"))


@router.callback_query(F.data.startswith("o:"))
async def on_order_action(cb: CallbackQuery) -> None:
    try:
        _, action, oid_s = cb.data.split(":")
        oid = int(oid_s)
    except ValueError:
        await cb.answer()
        return
    # Xodimlar guruhida har kim bosa oladi, shaxsiy chatda faqat adminlar
    if cb.message and cb.message.chat.type == ChatType.PRIVATE and not await db.is_admin(cb.from_user.id):
        await cb.answer("⛔ Ruxsat yo'q", show_alert=True)
        return
    o = await db.get_order(oid)
    if not o:
        await cb.answer("Buyurtma topilmadi", show_alert=True)
        return
    transitions = {
        "accept": ("accepted", "accepted_text", {"new"}),
        "ready": ("ready", "ready_text", {"new", "accepted"}),
        "done": ("done", None, {"ready"}),
        "cancel": ("cancelled", "cancel_text", {"new", "accepted"}),
    }
    if action not in transitions:
        await cb.answer()
        return
    new_status, notify_key, allowed = transitions[action]
    if o["status"] not in allowed:
        await cb.answer(f"Holat allaqachon: {STATUS_LABELS.get(o['status'])}", show_alert=True)
        await refresh_staff_message(oid)
        return
    await db.update_order(oid, status=new_status)
    o["status"] = new_status
    if notify_key:
        await notify_customer(o, notify_key)
    who = esc(cb.from_user.first_name)
    try:
        # Bosilgan xabarni yangilash (bir nechta adminga yuborilgan bo'lsa ham)
        await cb.message.edit_text(render_order(o) + f"\n\n👤 Oxirgi amal: {who}", reply_markup=order_keyboard(o))
    except Exception:  # noqa: BLE001
        pass
    await cb.answer(STATUS_LABELS.get(new_status, "OK"))


@router.message(F.chat.type.in_({ChatType.GROUP, ChatType.SUPERGROUP}), F.new_chat_members)
async def on_added_to_group(message: Message) -> None:
    me = await bot.me()
    if any(m.id == me.id for m in message.new_chat_members):
        await message.answer("👋 Salom! Buyurtmalarni shu guruhga yuborishim uchun admin <b>/setgroup</b> deb yozsin.")


async def setup_bot_ui() -> None:
    """Bot buyruqlari va menyu tugmasini sozlash (ishga tushganda va sozlama o'zgarganda)."""
    if not bot:
        return
    try:
        await bot.set_my_commands([
            BotCommand(command="start", description="Boshlash"),
            BotCommand(command="menu", description="Menyuni ochish"),
            BotCommand(command="admin", description="Admin panel"),
            BotCommand(command="id", description="ID raqamim"),
        ])
        await bot.set_my_short_description(
            f"{db.get('brand_emoji')} {db.get('brand_name')} — stolingizdan turib buyurtma bering"[:120]
        )
    except Exception as e:  # noqa: BLE001
        log.warning("commands: %s", e)
    await set_menu_button()


async def run_polling() -> None:
    while True:
        try:
            await dp.start_polling(bot, handle_signals=False, allowed_updates=dp.resolve_used_update_types())
            return
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001
            log.error("polling crashed: %s — 5 soniyadan so'ng qayta", e)
            await asyncio.sleep(5)
