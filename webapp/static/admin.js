/* Choyxona Mini App — admin panel */
(() => {
  'use strict';
  const App = () => window.App;
  const A = { data: null, tab: 'home', root: null, prodCat: 'all', dirty: false };

  const TABS = [
    ['home', '📊 Asosiy'], ['orders', '🧾 Buyurtmalar'], ['products', '🍽 Mahsulotlar'], ['cats', "🗂 Bo'limlar"],
    ['pay', "💳 To'lov"], ['design', '🎨 Dizayn'], ['texts', '🔘 Tugma va matnlar'], ['admins', '👥 Adminlar'], ['qr', '🔳 QR kodlar'],
  ];

  const PRESETS = [
    { name: 'Oltin kecha', c: { color_accent: '#E8B04B', color_accent2: '#D9772B', color_bg: '#0E0C0A', color_surface: '#1A1612', color_text: '#F7F0E6', color_muted: '#A6978A' } },
    { name: 'Zumrad', c: { color_accent: '#34D399', color_accent2: '#0EA5A4', color_bg: '#07110E', color_surface: '#0F1D18', color_text: '#ECFDF5', color_muted: '#8FB3A5' } },
    { name: 'Anor', c: { color_accent: '#F43F5E', color_accent2: '#F97316', color_bg: '#120A0B', color_surface: '#1F1214', color_text: '#FFF1F2', color_muted: '#B8959A' } },
    { name: 'Lojuvard', c: { color_accent: '#60A5FA', color_accent2: '#A78BFA', color_bg: '#090C14', color_surface: '#121826', color_text: '#EEF2FF', color_muted: '#94A0BC' } },
    { name: 'Qahva', c: { color_accent: '#C08552', color_accent2: '#8C5A3C', color_bg: '#16110D', color_surface: '#221A14', color_text: '#F5EBDD', color_muted: '#AD9A88' } },
    { name: 'Oq marmar', c: { color_accent: '#C9902F', color_accent2: '#B4542A', color_bg: '#F7F3EC', color_surface: '#FFFFFF', color_text: '#1E1812', color_muted: '#7D7064' } },
  ];

  const COLOR_FIELDS = [
    ['color_accent', 'Asosiy rang'], ['color_accent2', 'Ikkinchi rang'], ['color_bg', 'Fon'],
    ['color_surface', 'Kartochkalar'], ['color_text', 'Matn'], ['color_muted', 'Kulrang matn'],
  ];

  const TEXT_GROUPS = [
    ['🤖 Bot tugmalari', [
      ['btn_menu', 'Menyuni ochish tugmasi'], ['btn_orders', 'Buyurtmalarim tugmasi'], ['btn_waiter', 'Ofitsiant chaqirish tugmasi'],
      ['btn_contact', 'Aloqa tugmasi'], ['btn_admin', 'Admin panel tugmasi'], ['menu_button_text', 'Chap pastdagi menyu tugmasi (16 belgigacha)'],
    ]],
    ['📱 Ilova tugmalari va matnlari', [
      ['app_hero_title', 'Asosiy sarlavha'], ['app_banner_text', 'Banner (aksiya) matni — bo\'sh qoldirsangiz ko\'rinmaydi'],
      ['app_search_placeholder', 'Qidiruv maydoni matni'], ['app_btn_add', "Qo'shish tugmasi"], ['app_btn_cart', 'Savat yozuvi'],
      ['app_btn_checkout', 'Buyurtma berish tugmasi'], ['app_btn_paid', "To'lov qildim tugmasi"],
    ]],
    ['💬 Bot xabarlari', [
      ['welcome_text', 'Salomlashish ( {name} — mijoz ismi, {brand} — nom )', true],
      ['table_text', 'Stol xabari ( {table} — stol raqami )', true],
      ['no_table_text', 'Stol tanlanmaganda', true],
      ['contact_text', 'Aloqa ma\'lumotlari', true],
      ['accepted_text', 'Buyurtma qabul qilinganda ( {order} — raqam )', true],
      ['ready_text', 'Buyurtma tayyor bo\'lganda', true],
      ['cancel_text', 'Bekor qilinganda', true],
      ['waiter_text', 'Ofitsiant chaqirilganda', true],
    ]],
  ];

  const { esc } = { esc: (v) => App().esc(v) };
  const S = () => A.data.settings;
  const STATUS = { new: '🆕 Yangi', accepted: '👨‍🍳 Tayyorlanmoqda', ready: '✅ Tayyor', done: '🏁 Berildi', cancelled: '❌ Bekor' };

  /* ------------------------------------------------------------ helpers */
  function field(key, label, opts = {}) {
    const v = S()[key] ?? '';
    const ph = opts.ph ? ` placeholder="${esc(opts.ph)}"` : '';
    const input = opts.area
      ? `<textarea class="field" data-key="${key}" rows="3"${ph}>${esc(v)}</textarea>`
      : `<input class="field" data-key="${key}" type="${opts.type || 'text'}" value="${esc(v)}"${ph}${opts.inputmode ? ` inputmode="${opts.inputmode}"` : ''}>`;
    return `<label class="lbl">${esc(label)}</label>${input}${opts.hint ? `<div class="hint">${esc(opts.hint)}</div>` : ''}`;
  }
  function toggle(key, title, sub) {
    return `<div class="switch"><div><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div><button class="tgl ${S()[key] ? 'on' : ''}" data-tgl="${key}"></button></div>`;
  }
  function saveBar() { return `<div class="savebar" id="savebar"><button class="btn" data-adm="save">💾 O'zgarishlarni saqlash</button></div>`; }
  function markDirty() { A.dirty = true; document.getElementById('savebar')?.classList.add('show'); }
  function collect() {
    const values = {};
    A.root.querySelectorAll('[data-key]').forEach((el) => { values[el.dataset.key] = el.value; });
    A.root.querySelectorAll('[data-tgl]').forEach((el) => { values[el.dataset.tgl] = el.classList.contains('on'); });
    return values;
  }
  async function saveSettings(values, silent) {
    const res = await App().api('/api/admin/settings', { json: { values } });
    A.data.settings = res.settings;
    Object.assign(App().S.settings, res.settings);
    App().applyTheme(res.settings);
    A.dirty = false;
    if (!silent) { App().notifyHaptic('success'); App().toast('Saqlandi ✓'); }
  }
  async function load() {
    A.data = await App().api('/api/admin/data');
  }
  function syncCatalog() {
    const s = App().S;
    s.categories = A.data.categories.filter((c) => c.is_active);
    const active = new Set(s.categories.map((c) => c.id));
    s.products = A.data.products.filter((p) => p.is_active && active.has(p.category_id));
  }

  /* ------------------------------------------------------------ mount / render */
  async function mount(root) {
    A.root = root;
    root.innerHTML = `<div class="page-head" style="padding:14px 16px 6px"><button class="back" data-back>‹</button><h2>Admin panel</h2></div><div class="adm"><div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:220px;margin-top:12px"></div></div>`;
    try { await load(); } catch (e) { root.innerHTML = `<div class="empty-state" style="padding-top:25vh"><div class="e">⛔</div><b>${esc(e.message)}</b></div>`; return; }
    render();
  }
  function render() {
    if (!A.root || !A.data) return;
    const tabs = TABS.map(([k, l]) => `<button class="chip ${A.tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('');
    A.root.innerHTML = `<div class="page-head" style="padding:14px 16px 6px"><button class="back" data-back>‹</button><h2>Admin panel</h2></div>
      <nav class="adm-tabs" id="adm-tabs">${tabs}</nav><div class="adm" id="adm-body">${VIEWS[A.tab]()}</div>`;
    const active = A.root.querySelector('.adm-tabs .chip.active');
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest' });
    A.dirty = false;
  }
  async function setTab(t) {
    if (A.dirty && !(await App().ask("Saqlanmagan o'zgarishlar bor. Saqlamasdan chiqamizmi?"))) return;
    if (A.dirty) App().applyTheme(S());
    A.tab = t; render(); window.scrollTo(0, 0); App().haptic();
  }

  /* ------------------------------------------------------------ views */
  const VIEWS = {
    home() {
      const { today, all } = A.data.stats;
      const m = App().moneyText;
      const staff = S().staff_chat_id;
      return `<div class="stats">
        <div class="stat hl"><div class="k">Bugun tushum</div><div class="v">${m(today.total)}</div></div>
        <div class="stat"><div class="k">Bugun buyurtma</div><div class="v">${today.cnt}</div></div>
        <div class="stat"><div class="k">Xizmat haqi (bugun)</div><div class="v">${m(today.service)}</div></div>
        <div class="stat"><div class="k">Faol buyurtmalar</div><div class="v">${today.active}</div></div>
        <div class="stat"><div class="k">Jami buyurtma</div><div class="v">${all.cnt}</div></div>
        <div class="stat"><div class="k">Mijozlar</div><div class="v">${all.users}</div></div></div>
      <div class="panel">${toggle('orders_open', 'Buyurtma qabul qilish', "O'chirsangiz, mijozlar buyurtma bera olmaydi")}</div>
      <div class="panel"><h4>👨‍🍳 Xodimlar guruhi</h4>
        ${staff ? `<p style="margin:0 0 10px">✅ Buyurtmalar guruhga keladi: <code>${esc(staff)}</code></p>` : `<p style="margin:0 0 10px">⚠️ Guruh ulanmagan — buyurtmalar hozircha egasi va adminlarga shaxsiy keladi.</p>`}
        <p class="hint" style="margin-bottom:12px">Ulash: Telegramda guruh oching → botni guruhga qo'shing → guruhda <b>/setgroup</b> deb yozing.</p>
        <button class="btn sm ghost" data-adm="test-staff">📨 Sinov xabarini yuborish</button></div>
      <div class="panel"><h4>⚡ Tezkor</h4><div class="btn-row" style="flex-wrap:wrap">
        <button class="btn sm ghost" data-tab="products">➕ Mahsulot</button><button class="btn sm ghost" data-tab="pay">💳 Kartalar</button><button class="btn sm ghost" data-tab="qr">🔳 QR</button></div></div>`;
    },

    orders() {
      const list = A.data.orders;
      if (!list.length) return `<div class="empty-state"><div class="e">🧾</div><b>Hali buyurtma yo'q</b></div>`;
      return list.map((o) => {
        const d = new Date(o.created_at * 1000);
        const t = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const acts = [];
        if (o.status === 'new') acts.push(['accepted', '✅ Qabul']);
        if (['new', 'accepted'].includes(o.status)) acts.push(['ready', '🍽 Tayyor']);
        if (o.status === 'ready') acts.push(['done', '🏁 Berildi']);
        if (['new', 'accepted'].includes(o.status)) acts.push(['cancelled', '❌']);
        return `<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <b style="font-size:17px">#${o.id} · ${o.table_no}-stol</b><span class="st ${o.status}">${STATUS[o.status]}</span></div>
          <div class="hint" style="margin:4px 0 8px">${esc(o.user_name)}${o.username ? ' @' + esc(o.username) : ''} · ${t} · ${o.paid ? (o.receipt ? '💳 chek bor' : "💳 to'ladim dedi") : "⏳ to'lov kutilmoqda"}</div>
          ${o.items.map((i) => `<div class="sum-row" style="padding:3px 0"><span>${i.qty} × ${esc(i.name)}</span><b>${App().moneyText(i.qty * i.price)}</b></div>`).join('')}
          ${o.comment ? `<div class="hint">💬 ${esc(o.comment)}</div>` : ''}
          <div class="sum-row total" style="font-size:16px"><span>Jami (xizmat ${App().moneyText(o.service)})</span><b>${App().moneyText(o.total)}</b></div>
          ${acts.length ? `<div class="btn-row">${acts.map(([s, l]) => `<button class="btn sm ${s === 'cancelled' ? 'danger' : s === 'ready' ? '' : 'ghost'}" data-ostatus="${s}" data-oid="${o.id}">${l}</button>`).join('')}</div>` : ''}
        </div>`;
      }).join('') + '<div class="btn-row"><button class="btn ghost" data-adm="reload">🔄 Yangilash</button></div>';
    },

    cats() {
      const cats = A.data.categories;
      return `<button class="btn" data-adm="cat-new">➕ Yangi bo'lim</button>
        <div class="panel">${cats.length ? cats.map((c, i) => {
          const n = A.data.products.filter((p) => p.category_id === c.id).length;
          return `<div class="row"><div class="thumb">${esc(c.emoji || '🗂')}</div><div class="grow"><b>${esc(c.name)}</b><span>${n} ta mahsulot${c.is_active ? '' : ' · 🙈 yashirin'}</span></div>
            <button class="mini" data-move="categories:${c.id}:-1" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>↑</button>
            <button class="mini" data-move="categories:${c.id}:1" ${i === cats.length - 1 ? 'disabled style="opacity:.3"' : ''}>↓</button>
            <button class="mini" data-cat-edit="${c.id}">✏️</button></div>`;
        }).join('') : '<div class="hint">Bo\'limlar yo\'q</div>'}</div>`;
    },

    products() {
      const cats = A.data.categories;
      let list = A.data.products;
      if (A.prodCat !== 'all') list = list.filter((p) => p.category_id === Number(A.prodCat));
      const q = (A.prodSearch || '').toLowerCase();
      if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
      const chips = [`<button class="chip ${A.prodCat === 'all' ? 'active' : ''}" data-pcat="all">Hammasi</button>`]
        .concat(cats.map((c) => `<button class="chip ${String(A.prodCat) === String(c.id) ? 'active' : ''}" data-pcat="${c.id}">${esc(c.emoji)} ${esc(c.name)}</button>`)).join('');
      const canMove = A.prodCat !== 'all' && !q;
      return `<button class="btn" data-adm="prod-new">➕ Yangi mahsulot</button>
        <label class="search" style="margin:12px 0 0">🔍<input id="prod-search" placeholder="Mahsulot qidirish" value="${esc(A.prodSearch || '')}"></label>
        <nav class="chips" style="padding:12px 0 2px">${chips}</nav>
        <div class="panel">${list.length ? list.map((p, i) => `<div class="row">
          <div class="thumb">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : esc((cats.find((c) => c.id === p.category_id) || {}).emoji || '🍽')}</div>
          <div class="grow"><b>${esc(p.name)}</b><span>${App().moneyText(p.price)}${p.is_active ? '' : ' · 🙈 yashirin'}${p.badge ? ' · ' + esc(p.badge) : ''}</span></div>
          ${canMove ? `<button class="mini" data-move="products:${p.id}:-1" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>↑</button><button class="mini" data-move="products:${p.id}:1" ${i === list.length - 1 ? 'disabled style="opacity:.3"' : ''}>↓</button>` : ''}
          <button class="mini" data-prod-edit="${p.id}">✏️</button></div>`).join('') : '<div class="hint">Mahsulot topilmadi</div>'}</div>
        ${A.prodCat === 'all' ? '<p class="hint">Tartibni o\'zgartirish uchun yuqoridan bo\'limni tanlang.</p>' : ''}`;
    },

    pay() {
      const pct = S().service_percent;
      const mode = S().pay_mode || 'split';
      const modes = [
        ['split', '2 ta karta', `Xizmat haqi (${pct}%) 1-kartaga, taomlar 2-kartaga. Mijoz 2 marta o'tkazadi.`],
        ['single', '1 ta karta', "Jami summa bitta kartaga. Mijoz 1 marta o'tkazadi."],
        ['online', 'Click / Payme', "Ilovada bitta tugma, mijoz 1 marta to'laydi. Pul avtomatik tasdiqlanadi."],
      ];
      const modeBtns = modes.map(([k, t, d]) => `<button class="mode ${mode === k ? 'on' : ''}" data-mode="${k}"><b>${t}</b><span>${d}</span></button>`).join('');
      const show = (m) => (mode === m ? '' : 'hidden');
      return `<div class="panel"><h4>🧭 To'lov turi</h4><div class="modes">${modeBtns}</div>
          <input type="hidden" data-key="pay_mode" value="${esc(mode)}"></div>
        <div class="panel ${show('online')}" data-mode-box="online"><h4>⚡ Click / Payme (onlayn)</h4>
          ${field('payment_token', 'To\'lov tokeni (BotFather beradi)', { ph: '398062629:TEST:...' })}
          <div class="hint" style="line-height:1.6">Tokenni olish:<br>1. @BotFather → <b>/mybots</b> → botingiz → <b>Payments</b><br>2. <b>Click</b> yoki <b>Payme</b> ni tanlang va ko'rsatmalarga amal qiling (shartnoma tuzasiz)<br>3. BotFather bergan tokenni shu yerga qo'ying. Pul shartnomadagi hisobingizga tushadi.<br>Sinov uchun avval «Test» tokenini qo'yib ko'ring.</div>
          ${field('online_title', 'Tugma yozuvi')}</div>
        <div class="panel ${show('single')}" data-mode-box="single"><h4>💳 To'lov kartasi (jami summa)</h4>
          ${field('card0_label', 'Karta nomi (mijozga ko\'rinadi)')}
          ${field('card0_number', 'Karta raqami', { inputmode: 'numeric', ph: '8600 0000 0000 0000' })}
          ${field('card0_holder', 'Karta egasi', { ph: 'ISM FAMILIYA' })}</div>
        <div class="${show('split')}" data-mode-box="split"><div class="panel"><h4>💳 1-karta — xizmat haqi (${esc(pct)}%)</h4>
          ${field('card1_label', 'Karta nomi (mijozga ko\'rinadi)')}
          ${field('card1_number', 'Karta raqami', { inputmode: 'numeric', ph: '8600 0000 0000 0000' })}
          ${field('card1_holder', 'Karta egasi', { ph: 'ISM FAMILIYA' })}</div>
        <div class="panel"><h4>💳 2-karta — taomlar summasi</h4>
          ${field('card2_label', 'Karta nomi (mijozga ko\'rinadi)')}
          ${field('card2_number', 'Karta raqami', { inputmode: 'numeric', ph: '9860 0000 0000 0000' })}
          ${field('card2_holder', 'Karta egasi', { ph: 'ISM FAMILIYA' })}</div></div>
        <div class="panel"><h4>⚙️ Hisob-kitob</h4>
          ${field('service_percent', 'Xizmat haqi foizi (%)', { type: 'number', inputmode: 'numeric', hint: "Masalan 15. 0 qilsangiz xizmat haqi olinmaydi." })}
          ${field('currency', 'Valyuta yozuvi')}
          ${field('pay_note', "Karta orqali to'lovdagi izoh", { area: true })}
          ${toggle('require_receipt', 'Chek majburiy', 'Karta orqali to\'lashda chek rasmini yuklash shart bo\'ladi')}</div>
        ${saveBar()}`;
    },

    design() {
      const s = S();
      const presets = PRESETS.map((p, i) => `<button class="preset" data-preset="${i}" style="background:${p.c.color_surface};color:${p.c.color_text}">
        <div class="sw">${[p.c.color_accent, p.c.color_accent2, p.c.color_bg].map((c) => `<i style="background:${c}"></i>`).join('')}</div>${esc(p.name)}</button>`).join('');
      const colors = COLOR_FIELDS.map(([k, l]) => `<label class="color"><input type="color" data-key="${k}" value="${esc(s[k])}"><span>${l}<small>${esc(s[k])}</small></span></label>`).join('');
      return `<div class="panel"><h4>🏷 Brend</h4>
          <div class="upload"><div class="prev" id="logo-prev">${s.brand_logo ? `<img src="${esc(s.brand_logo)}">` : esc(s.brand_emoji)}</div>
            <div style="flex:1"><label class="btn sm ghost" style="width:100%">📷 Logo yuklash<input type="file" accept="image/*" id="logo-file" hidden></label>
            ${s.brand_logo ? '<button class="btn sm danger" data-adm="logo-remove" style="width:100%;margin-top:8px">Logoni olib tashlash</button>' : ''}</div></div>
          <input type="hidden" data-key="brand_logo" value="${esc(s.brand_logo)}">
          ${field('brand_name', 'Choyxona nomi')}
          ${field('brand_tagline', 'Qisqa shior')}
          ${field('brand_emoji', 'Emoji (logo bo\'lmasa ko\'rinadi)')}</div>
        <div class="panel"><h4>✨ Tayyor mavzular</h4><div class="presets">${presets}</div></div>
        <div class="panel"><h4>🎨 Ranglar</h4><div class="colors">${colors}</div>
          <button class="btn sm ghost" data-adm="colors-reset" style="margin-top:12px">↺ Standart ranglar</button></div>
        ${saveBar()}`;
    },

    texts() {
      return TEXT_GROUPS.map(([title, fields]) => `<div class="panel"><h4>${title}</h4>${fields.map(([k, l, area]) => field(k, l, { area })).join('')}</div>`).join('')
        + `<p class="hint">Matnlarda &lt;b&gt;qalin&lt;/b&gt; va &lt;i&gt;qiya&lt;/i&gt; yozish mumkin (bot xabarlarida).</p>
        <div class="btn-row"><button class="btn ghost" data-adm="texts-reset">↺ Barcha matnlarni standartga qaytarish</button></div>${saveBar()}`;
    },

    admins() {
      const owner = A.data.owner_id;
      const list = A.data.admins;
      return `<div class="panel"><h4>➕ Admin qo'shish</h4>
          <input class="field" id="new-admin" placeholder="Telegram ID yoki @username" autocomplete="off">
          <input class="field" id="new-admin-name" placeholder="Ismi (ixtiyoriy)" style="margin-top:8px">
          <p class="hint">ID ni bilish uchun u odam botga <b>/id</b> deb yozsin. @username faqat u botga /start bosgan bo'lsa ishlaydi.</p>
          <button class="btn" data-adm="admin-add" style="margin-top:12px">Qo'shish</button></div>
        <div class="panel"><h4>👥 Adminlar</h4>
          <div class="row"><div class="thumb">👑</div><div class="grow"><b>Bot egasi</b><span>ID: ${owner}</span></div></div>
          ${list.map((a) => `<div class="row"><div class="thumb">🛡</div><div class="grow"><b>${esc(a.name || 'Admin')}</b><span>ID: ${a.user_id}</span></div>
            ${a.user_id !== A.data.me ? `<button class="mini danger" data-admin-del="${a.user_id}">✕</button>` : '<span class="hint">siz</span>'}</div>`).join('')}
        </div><p class="hint">Adminlar hamma narsani o'zgartira oladi: menyu, narx, kartalar, dizayn, adminlar. Bot egasini o'chirib bo'lmaydi.</p>`;
    },

    qr() {
      const u = A.data.bot_username;
      const n = Number(S().tables_count) || 1;
      const base = location.origin;
      const thumbs = [];
      for (let i = 1; i <= Math.min(n, 9); i++) thumbs.push(`<a href="${base}/qr/${i}.png" data-ext><img src="/qr/${i}.png" alt="" loading="lazy">${i}-stol</a>`);
      return `<div class="panel"><h4>🪑 Stollar</h4>${field('tables_count', 'Stollar soni', { type: 'number', inputmode: 'numeric' })}
          <button class="btn sm" data-adm="save" style="margin-top:12px">Saqlash</button></div>
        <div class="panel"><h4>🔗 Stol havolasi</h4><div class="code">https://t.me/${esc(u)}?start=t5</div>
          <p class="hint">Oxiridagi raqam — stol raqami. Har bir stolda shu havolaning QR kodi turadi. Mijoz skanerlasa, bot uning stolini o'zi biladi.</p></div>
        <div class="panel"><h4>🖨 QR kodlarni chop etish</h4>
          <button class="btn" data-ext-url="${base}/qr/print">🖨 Barcha QR kodlarni ochish (${n} ta)</button>
          <p class="hint">Brauzerda ochiladi — u yerdan chop etasiz yoki PDF qilib saqlaysiz.</p>
          <div class="qr-grid" style="margin-top:12px">${thumbs.join('')}</div></div>`;
    },
  };

  /* ------------------------------------------------------------ product / category editors */
  function catEditor(c) {
    c = c || { name: '', emoji: '🍽', is_active: 1 };
    App().openSheet(`<div class="pad"><h3>${c.id ? "Bo'limni tahrirlash" : "Yangi bo'lim"}</h3>
      <label class="lbl">Nomi</label><input class="field" id="c-name" value="${esc(c.name)}" placeholder="Masalan: Shashliklar">
      <label class="lbl">Emoji</label><input class="field" id="c-emoji" value="${esc(c.emoji)}" placeholder="🍢">
      <div class="switch"><div><b>Ko'rinadi</b><span>O'chirsangiz, mijozlar bu bo'limni ko'rmaydi</span></div><button class="tgl ${c.is_active ? 'on' : ''}" id="c-active" data-local-tgl></button></div>
      <button class="btn" data-adm="cat-save" data-id="${c.id || ''}">💾 Saqlash</button>
      ${c.id ? `<button class="btn danger" data-adm="cat-del" data-id="${c.id}" style="margin-top:10px">🗑 O'chirish (ichidagi mahsulotlar ham)</button>` : ''}</div>`);
  }

  function prodEditor(p) {
    const cats = A.data.categories;
    if (!cats.length) { App().toast("Avval bo'lim qo'shing", true); return; }
    p = p || { name: '', description: '', price: '', unit: '', badge: '', photo: '', is_active: 1, category_id: A.prodCat !== 'all' ? Number(A.prodCat) : cats[0].id };
    const opts = cats.map((c) => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`).join('');
    const badges = ['', '🔥 Hit', '⭐ Tavsiya', '🆕 Yangi', '🌶 Achchiq', '💚 Vegetarian', '🏷 Aksiya'];
    App().openSheet(`<div class="pad"><h3>${p.id ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}</h3>
      <div class="upload"><div class="prev" id="p-prev">${p.photo ? `<img src="${esc(p.photo)}">` : '📷'}</div>
        <div style="flex:1"><label class="btn sm ghost" style="width:100%">📷 Rasm yuklash<input type="file" accept="image/*" id="p-file" hidden></label>
        <button class="btn sm danger" id="p-photo-del" style="width:100%;margin-top:8px" ${p.photo ? '' : 'hidden'}>Rasmni olib tashlash</button></div></div>
      <input type="hidden" id="p-photo" value="${esc(p.photo)}">
      <label class="lbl">Nomi *</label><input class="field" id="p-name" value="${esc(p.name)}" placeholder="Masalan: Choyxona oshi">
      <label class="lbl">Narxi (${esc(S().currency)}) *</label><input class="field" id="p-price" type="number" inputmode="numeric" value="${esc(p.price)}" placeholder="45000">
      <label class="lbl">Bo'lim *</label><select class="field" id="p-cat">${opts}</select>
      <label class="lbl">Tavsif</label><textarea class="field" id="p-desc" rows="3" placeholder="Tarkibi, qanday tayyorlanadi…">${esc(p.description)}</textarea>
      <label class="lbl">Hajmi / miqdori</label><input class="field" id="p-unit" value="${esc(p.unit)}" placeholder="350 g, 1 dona, 1 choynak">
      <label class="lbl">Belgi (badge)</label><input class="field" id="p-badge" value="${esc(p.badge)}" placeholder="🔥 Hit" list="badge-list">
      <datalist id="badge-list">${badges.map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
      <div class="chips" style="padding:8px 0 0">${badges.slice(1).map((b) => `<button class="chip" data-badge="${esc(b)}">${esc(b)}</button>`).join('')}</div>
      <div class="switch"><div><b>Sotuvda bor</b><span>O'chirsangiz, menyuda ko'rinmaydi (stop-list)</span></div><button class="tgl ${p.is_active ? 'on' : ''}" id="p-active" data-local-tgl></button></div>
      <button class="btn" data-adm="prod-save" data-id="${p.id || ''}">💾 Saqlash</button>
      ${p.id ? `<button class="btn danger" data-adm="prod-del" data-id="${p.id}" style="margin-top:10px">🗑 O'chirish</button>` : ''}</div>`);
  }

  async function uploadImage(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await App().api('/api/admin/upload', { body: fd });
    return res.url;
  }

  /* ------------------------------------------------------------ actions */
  async function action(name, el) {
    const api = App().api;
    const toast = App().toast;
    try {
      switch (name) {
        case 'save': {
          await saveSettings(collect());
          document.getElementById('savebar')?.classList.remove('show');
          if (A.tab === 'qr') render();
          break;
        }
        case 'reload': await load(); render(); break;
        case 'test-staff': { const r = await api('/api/admin/test-staff', { method: 'POST' }); toast(`Yuborildi ✓ (${r.sent})`); break; }
        case 'cat-new': catEditor(); break;
        case 'cat-save': {
          const body = { id: el.dataset.id || null, name: document.getElementById('c-name').value, emoji: document.getElementById('c-emoji').value, is_active: document.getElementById('c-active').classList.contains('on') };
          const existing = A.data.categories.find((c) => String(c.id) === String(body.id));
          body.sort = existing ? existing.sort : A.data.categories.length;
          const r = await api('/api/admin/category', { json: body });
          A.data.categories = r.categories; syncCatalog(); App().closeSheet(); render(); toast('Saqlandi ✓');
          break;
        }
        case 'cat-del': {
          if (!(await App().ask("Bo'lim va undagi barcha mahsulotlar o'chiriladi. Ishonchingiz komilmi?"))) return;
          await api(`/api/admin/category/${el.dataset.id}`, { method: 'DELETE' });
          await load(); syncCatalog(); App().closeSheet(); render(); toast("O'chirildi");
          break;
        }
        case 'prod-new': prodEditor(); break;
        case 'prod-save': {
          const g = (id) => document.getElementById(id);
          const body = {
            id: el.dataset.id || null, name: g('p-name').value, price: g('p-price').value, category_id: Number(g('p-cat').value),
            description: g('p-desc').value, unit: g('p-unit').value, badge: g('p-badge').value, photo: g('p-photo').value,
            is_active: g('p-active').classList.contains('on'),
          };
          if (!body.name.trim()) { toast('Nomini kiriting', true); return; }
          if (!(Number(body.price) >= 0) || body.price === '') { toast('Narxni kiriting', true); return; }
          const existing = A.data.products.find((x) => String(x.id) === String(body.id));
          body.sort = existing ? existing.sort : A.data.products.length;
          const r = await api('/api/admin/product', { json: body });
          const idx = A.data.products.findIndex((x) => x.id === r.product.id);
          if (idx >= 0) A.data.products[idx] = r.product; else A.data.products.push(r.product);
          syncCatalog(); App().closeSheet(); render(); toast('Saqlandi ✓');
          break;
        }
        case 'prod-del': {
          if (!(await App().ask("Mahsulot o'chiriladi. Ishonchingiz komilmi?"))) return;
          await api(`/api/admin/product/${el.dataset.id}`, { method: 'DELETE' });
          A.data.products = A.data.products.filter((x) => String(x.id) !== String(el.dataset.id));
          syncCatalog(); App().closeSheet(); render(); toast("O'chirildi");
          break;
        }
        case 'admin-add': {
          const v = document.getElementById('new-admin').value.trim();
          if (!v) { toast('ID yoki @username kiriting', true); return; }
          const r = await api('/api/admin/admins', { json: { user: v, name: document.getElementById('new-admin-name').value } });
          A.data.admins = r.admins; render(); toast("Admin qo'shildi ✓");
          break;
        }
        case 'logo-remove': {
          await saveSettings({ brand_logo: '' }); render(); break;
        }
        case 'colors-reset': {
          await saveSettings(PRESETS[0].c); render(); break;
        }
        case 'texts-reset': {
          if (!(await App().ask('Barcha tugma va matnlar standart holatga qaytadi. Davom etamizmi?'))) return;
          const keys = TEXT_GROUPS.flatMap(([, f]) => f.map((x) => x[0]));
          const r = await api('/api/admin/settings/reset', { json: { keys } });
          A.data.settings = r.settings; Object.assign(App().S.settings, r.settings); render(); toast('Qaytarildi ✓');
          break;
        }
        default: break;
      }
    } catch (e) { toast(e.message, true); }
  }

  async function move(spec) {
    const [table, id, dir] = spec.split(':');
    const arr = table === 'categories' ? A.data.categories : A.data.products.filter((p) => p.category_id === Number(A.prodCat));
    const i = arr.findIndex((x) => x.id === Number(id));
    const j = i + Number(dir);
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    arr.forEach((x, k) => { x.sort = k; });
    if (table === 'categories') A.data.categories = arr;
    else A.data.products.sort((a, b) => (a.category_id - b.category_id) || (a.sort - b.sort));
    App().haptic();
    render();
    try { await App().api('/api/admin/reorder', { json: { table, ids: arr.map((x) => x.id) } }); syncCatalog(); } catch (e) { App().toast(e.message, true); }
  }

  function openExternal(url) {
    const tg = App().tg;
    if (tg && tg.openLink && tg.initData) tg.openLink(url); else window.open(url, '_blank');
  }

  /* ------------------------------------------------------------ events */
  document.addEventListener('click', async (e) => {
    if (App().S.view !== 'admin') return;
    const t = e.target.closest('button, a');
    if (!t) return;
    const d = t.dataset;
    if (d.tab) { setTab(d.tab); return; }
    if (d.adm) { e.preventDefault(); action(d.adm, t); return; }
    if (d.tgl) { t.classList.toggle('on'); App().haptic(); if (A.tab === 'home') { saveSettings({ [d.tgl]: t.classList.contains('on') }); } else markDirty(); return; }
    if (d.localTgl !== undefined) { t.classList.toggle('on'); App().haptic(); return; }
    if (d.catEdit) { catEditor(A.data.categories.find((c) => c.id === Number(d.catEdit))); return; }
    if (d.prodEdit) { prodEditor(A.data.products.find((p) => p.id === Number(d.prodEdit))); return; }
    if (d.pcat) { A.prodCat = d.pcat; render(); return; }
    if (d.mode) {
      A.root.querySelector('[data-key="pay_mode"]').value = d.mode;
      A.root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === d.mode));
      A.root.querySelectorAll('[data-mode-box]').forEach((b) => b.classList.toggle('hidden', b.dataset.modeBox !== d.mode));
      App().haptic(); markDirty(); return;
    }
    if (d.move) { move(d.move); return; }
    if (d.badge !== undefined) { document.getElementById('p-badge').value = d.badge; App().haptic(); return; }
    if (d.preset) {
      const p = PRESETS[Number(d.preset)].c;
      Object.entries(p).forEach(([k, v]) => { const inp = A.root.querySelector(`[data-key="${k}"]`); if (inp) { inp.value = v; const sm = inp.parentElement.querySelector('small'); if (sm) sm.textContent = v; } });
      App().applyTheme({ ...S(), ...p }); App().haptic('medium'); markDirty(); return;
    }
    if (d.adminDel) {
      if (!(await App().ask('Adminni o\'chiramizmi?'))) return;
      try { const r = await App().api(`/api/admin/admins/${d.adminDel}`, { method: 'DELETE' }); A.data.admins = r.admins; render(); App().toast("O'chirildi"); } catch (er) { App().toast(er.message, true); }
      return;
    }
    if (d.ostatus) {
      try {
        await App().api(`/api/admin/orders/${d.oid}/status`, { json: { status: d.ostatus } });
        const o = A.data.orders.find((x) => x.id === Number(d.oid)); if (o) o.status = d.ostatus;
        App().notifyHaptic('success'); render();
      } catch (er) { App().toast(er.message, true); }
      return;
    }
    if (d.extUrl) { openExternal(d.extUrl); return; }
    if (d.ext !== undefined) { e.preventDefault(); openExternal(t.href); return; }
    if (t.id === 'p-photo-del') { document.getElementById('p-photo').value = ''; document.getElementById('p-prev').innerHTML = '📷'; t.hidden = true; }
  });

  document.addEventListener('input', (e) => {
    if (App().S.view !== 'admin') return;
    const el = e.target;
    if (el.id === 'prod-search') { A.prodSearch = el.value; clearTimeout(A.ps); A.ps = setTimeout(() => { render(); const i = document.getElementById('prod-search'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300); return; }
    if (el.dataset && el.dataset.key) {
      markDirty();
      if (el.type === 'color') {
        const sm = el.parentElement.querySelector('small'); if (sm) sm.textContent = el.value;
        App().applyTheme({ ...S(), ...collect() });
      }
    }
  });

  document.addEventListener('change', async (e) => {
    if (App().S.view !== 'admin') return;
    const el = e.target;
    if (el.id === 'p-file' || el.id === 'logo-file') {
      const file = el.files[0];
      if (!file) return;
      const prev = document.getElementById(el.id === 'p-file' ? 'p-prev' : 'logo-prev');
      prev.innerHTML = '<span class="spin"></span>';
      try {
        const url = await uploadImage(file);
        prev.innerHTML = `<img src="${esc(url)}">`;
        if (el.id === 'p-file') { document.getElementById('p-photo').value = url; document.getElementById('p-photo-del').hidden = false; }
        else { await saveSettings({ brand_logo: url }); render(); }
        App().notifyHaptic('success');
      } catch (er) { prev.innerHTML = '⚠️'; App().toast(er.message, true); }
      el.value = '';
    }
  });

  window.Admin = {
    mount,
    back() { return false; },
  };
})();
