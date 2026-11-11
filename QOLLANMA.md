# 📘 Qadam-baqadam qo'llanma (hech qanday dasturlash bilmasdan)

Jami ~20–30 daqiqa. Kerak bo'ladi: telefon yoki kompyuter, Telegram, GitHub va Railway akkaunti.

---

## 1-qadam. Bot tokenini yangilang (MUHIM ⚠️)
Token chatda ochiq yozilgani uchun uni yangilash kerak:
1. Telegramda **@BotFather** ni oching.
2. `/revoke` yozing → `@avtomatizatsiya1bot` ni tanlang.
3. BotFather yangi token beradi (`123456:ABC...` ko'rinishida). Uni **hech kimga yubormang**, faqat 4-qadamda kiritasiz.

## 2-qadam. Kodni GitHub'ga joylang
1. https://github.com ga kiring (akkaunt bo'lmasa — **Sign up**).
2. O'ng yuqorida **+** → **New repository**.
   - Repository name: `choyxona-bot`
   - **Private** ni tanlang → **Create repository**.
3. Ochilgan sahifada **«uploading an existing file»** havolasini bosing.
4. `choyxona-bot.zip` arxivini kompyuteringizda oching (Extract). Ichidagi **barcha fayl va papkalarni**
   (`app`, `webapp`, `main.py`, `requirements.txt`, `Dockerfile` …) brauzer oynasiga sudrab tashlang.
   > Papkaning o'zini emas, **ichidagilarni** tashlang — `main.py` repozitoriyning eng yuqorisida turishi kerak.
5. Pastda **Commit changes** ni bosing.

## 3-qadam. Railway'da serverni ishga tushiring
Railway — bot 24/7 ishlaydigan server (oyiga taxminan $5, boshida sinov krediti beriladi).
1. https://railway.com ga kiring → **Login with GitHub**.
2. **New Project** → **Deploy from GitHub repo** → `choyxona-bot` ni tanlang
   (ruxsat so'rasa — **Configure GitHub App** → repoga ruxsat bering).
3. Loyiha ochiladi. Servis kartochkasini bosing.

## 4-qadam. Sozlamalarni kiriting
Servis ichida **Variables** bo'limi → **New Variable** orqali qo'shing:

| Nomi | Qiymati |
|---|---|
| `BOT_TOKEN` | 1-qadamdagi **yangi** token |
| `OWNER_ID` | `8427771708` |
| `DATA_DIR` | `/data` |

## 5-qadam. Ma'lumotlar o'chib ketmasligi uchun disk (Volume)
1. Loyiha oynasida bo'sh joyga o'ng tugma (yoki **+ Create**) → **Volume**.
2. Servisni tanlang, **Mount path**: `/data` → yarating.
> Bu bo'lmasa, har yangilanishda menyu va buyurtmalar o'chib ketadi!

## 6-qadam. Internet manzil (domen)
1. Servis → **Settings** → **Networking** → **Generate Domain**.
2. Port so'rasa: `8080`.
3. `https://choyxona-bot-production.up.railway.app` kabi manzil chiqadi — bot uni o'zi topadi.
4. **Deployments** bo'limida oxirgi deploy ✅ yashil bo'lishini kuting. Loglarda `Bot ishga tushdi: @avtomatizatsiya1bot` yozuvi chiqadi.

## 7-qadam. Tekshirish 🎉
1. Telegramda `@avtomatizatsiya1bot` → **/start**.
2. **🍽 Menyuni ochish** tugmasi → chiroyli menyu ochiladi (namuna taomlar bilan).
3. **/admin** yoki pastdagi **⚙️ Admin panel** → boshqaruv paneli.

## 8-qadam. Xodimlar guruhi (buyurtmalar shu yerga keladi)
1. Telegramda yangi guruh yarating (masalan «Oshxona buyurtmalari»), oshpaz va ofitsiantlarni qo'shing.
2. Guruhga `@avtomatizatsiya1bot` ni qo'shing.
3. Guruhda **/setgroup** deb yozing (buni egasi yoki admin yozadi).
4. Admin panel → **📊 Asosiy** → «Sinov xabarini yuborish» — guruhga xabar kelsa, hammasi joyida.

Har bir buyurtmada tugmalar bo'ladi: **✅ Qabul qilish → 🍽 Tayyor → 🏁 Mijozga berildi** (yoki ❌ Bekor).
Har birida mijozga avtomatik xabar boradi. Mijoz chek yuklasa, rasm buyurtma ostiga keladi.

## 9-qadam. Admin panelda sozlang
- **💳 To'lov** — 1-karta (xizmat haqi 15%) va 2-karta (taomlar) raqami va egasi. Foizni ham o'zgartirish mumkin.
- **🍽 Mahsulotlar** — namuna taomlarni o'zingiznikiga almashtiring: rasm yuklang, nom, narx, tavsif.
  «Sotuvda bor» ni o'chirsangiz — taom vaqtincha yashiriladi (stop-list).
- **🗂 Bo'limlar** — qo'shish, o'chirish, ↑↓ bilan tartiblash.
- **🎨 Dizayn** — nom, logo, shior, 6 ta tayyor mavzu yoki o'z ranglaringiz.
- **🔘 Tugma va matnlar** — botdagi va ilovadagi har bir tugma va xabar matni.
- **👥 Adminlar** — ID yoki @username bilan admin qo'shing (ID ni bilish uchun u botga `/id` yozadi).
- **🔳 QR kodlar** — stollar sonini kiriting → «Barcha QR kodlarni ochish» → chop eting yoki PDF saqlang
  → har bir stolga o'z raqamli QR kodini yopishtiring.

## 10-qadam (ixtiyoriy). Botni bezash — @BotFather'da
- `/setuserpic` — bot rasmi (choyxona logosi)
- `/setdescription` — «Stolingizdan turib buyurtma bering!» kabi matn
- `/setname` — bot nomi

---

### Kodni yangilash
GitHub'dagi fayllarni almashtirsangiz, Railway avtomatik qayta ishga tushiradi. Menyu va buyurtmalar Volume'da saqlanib qoladi.

### Muammo bo'lsa
| Belgi | Yechim |
|---|---|
| Bot javob bermaydi | Railway → Deployments → loglarni ko'ring. `BOT_TOKEN` to'g'riligini tekshiring. |
| «Menyuni ochish» tugmasi yo'q | 6-qadam (domen) bajarilmagan. Domen yaratib, servisni **Redeploy** qiling. |
| «Ilovani Telegram ichida oching» | Saytni brauzerda emas, bot tugmasi orqali oching. |
| Buyurtma guruhga kelmaydi | Guruhda `/setgroup` yozing; bot guruhdan chiqarilmaganini tekshiring. |
| Menyu o'chib qoldi | 5-qadam (Volume `/data` va `DATA_DIR=/data`) bajarilmagan. |
