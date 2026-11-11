import asyncio
import logging

from aiohttp import web

from app import bot as tg
from app.config import BOT_TOKEN, DISABLE_BOT, PORT, webapp_url
from app.db import db
from app.web import build_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("main")


async def main() -> None:
    await db.connect()
    app = build_app()
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", PORT).start()
    log.info("Web server: http://0.0.0.0:%s  |  Mini App URL: %s", PORT, webapp_url() or "(sozlanmagan!)")

    if DISABLE_BOT:
        log.warning("DISABLE_BOT=1 — bot ishlamaydi (faqat sinov rejimi)")
        await asyncio.Event().wait()
        return
    if not BOT_TOKEN:
        raise SystemExit("BOT_TOKEN topilmadi! Hostingda BOT_TOKEN o'zgaruvchisini kiriting.")
    if not webapp_url():
        log.warning("WEBAPP_URL sozlanmagan — Mini App tugmalari ishlamaydi!")

    bot = tg.create_bot()
    await bot.delete_webhook(drop_pending_updates=False)
    me = await bot.me()
    log.info("Bot ishga tushdi: @%s", me.username)
    await tg.setup_bot_ui()
    try:
        await tg.run_polling()
    finally:
        await bot.session.close()
        await db.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit) as e:
        if isinstance(e, SystemExit) and e.code:
            raise
