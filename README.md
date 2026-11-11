# 🫖 Choyxona — Telegram bot + Mini App

Mijoz stolga o'tiradi → QR kodni skanerlaydi → bot ochiladi → **Menyu** (Mini App) → taom tanlaydi → savat → buyurtma.
To'lov ikkiga bo'linadi: **xizmat haqi (15%) → 1-karta**, **taomlar summasi → 2-karta**.
Buyurtma xodimlar guruhiga keladi → xodim **«Tayyor»** ni bosadi → mijozga bot orqali xabar boradi.

## Imkoniyatlar
- Bo'limlar, qidiruv, rasm, narx, hajm, belgi (🔥 Hit, ⭐ Tavsiya…), stop-list
- Savat, izoh, stol tanlash, 15% xizmat haqi avtomatik hisoblanadi
- 2 ta karta, «Nusxa» tugmalari, chek rasmini yuklash, «To'lov qildim»
- Buyurtma holati jonli: Qabul qilindi → Tayyorlanmoqda → Tayyor
- Bot: Buyurtmalarim, Ofitsiant chaqirish, Aloqa
- **Admin panel** (ilova ichida, egasi va adminlar uchun): statistika, buyurtmalar, mahsulotlar (rasm yuklash bilan),
  bo'limlar, kartalar va foiz, dizayn (6 ta tayyor mavzu + istalgan rang, logo), bot va ilovadagi barcha tugma/matnlar,
  adminlar, stollar soni va QR kodlarni chop etish

## O'rnatish (qisqacha)
Batafsil qadamlar `QOLLANMA.md` faylida.

Muhit o'zgaruvchilari:
| Nomi | Qiymati |
|---|---|
| `BOT_TOKEN` | BotFather bergan token |
| `OWNER_ID` | `8427771708` |
| `DATA_DIR` | `/data` (Railway Volume) |
| `WEBAPP_URL` | ixtiyoriy, Railway'da avtomatik |

Lokal ishga tushirish: `pip install -r requirements.txt && python main.py`

Bot buyruqlari: `/start`, `/menu`, `/admin`, `/id`, `/setgroup` (guruhda), `/addadmin ID`.
