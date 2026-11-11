/* Choyxona Mini App — mijoz qismi */
(() => {
  'use strict';
  const tg = window.Telegram && window.Telegram.WebApp;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const S = {
    settings: {}, categories: [], products: [], user: null, isAdmin: false, isOwner: false,
    table: null, cart: {}, view: 'menu', stack: [], search: '', activeCat: null,
    order: null, payment: null, freshOrder: false, poll: null, botUsername: '',
  };

  /* ------------------------------------------------------------ utils */
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const cur = () => esc(S.settings.currency || "so'm");
  const money = (n) => `${fmt(n)} <small>${cur()}</small>`;
  const moneyText = (n) => `${fmt(n)} ${S.settings.currency || "so'm"}`;
  const haptic = (type = 'light') => { try { tg.HapticFeedback.impactOccurred(type); } catch (e) { /* */ } };
  const notifyHaptic = (type = 'success') => { try { tg.HapticFeedback.notificationOccurred(type); } catch (e) { /* */ } };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } },
  };

  function toast(msg, isErr = false) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('err', isErr);
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 2600);
    if (isErr) notifyHaptic('error');
  }

  async function api(path, opts = {}) {
    const headers = { 'X-Init-Data': (tg && tg.initData) || '' };
    if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.json); }
    let res;
    try {
      res = await fetch(path, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers, body: opts.body });
    } catch (e) {
      throw new Error("Internet aloqasi yo'q. Qayta urinib ko'ring.");
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* */ }
    if (!res.ok) throw new Error(data.error || `Xatolik (${res.status})`);
    return data;
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (er) { /* */ }
      ta.remove();
    }
    notifyHaptic('success');
    toast('Nusxa olindi ✓');
  }

  function hexRgb(hex) {
    const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  function applyTheme(s) {
    const root = document.documentElement.style;
    const map = { accent: 'color_accent', accent2: 'color_accent2', bg: 'color_bg', surface: 'color_surface', text: 'color_text', muted: 'color_muted' };
    for (const [v, k] of Object.entries(map)) if (hexRgb(s[k])) root.setProperty(`--${v}`, s[k]);
    const t = hexRgb(s.color_text); if (t) root.setProperty('--text-rgb', t.join(','));
    const a = hexRgb(s.color_accent); if (a) { root.setProperty('--accent-rgb', a.join(',')); root.setProperty('--on-accent', lum(a) > 0.55 ? '#1A1208' : '#FFFFFF'); }
    const b = hexRgb(s.color_bg); if (b) root.setProperty('--bg-rgb', b.join(','));
    if (tg) {
      try { tg.setHeaderColor(s.color_bg); tg.setBackgroundColor(s.color_bg); } catch (e) { /* */ }
      try { if (tg.setBottomBarColor) tg.setBottomBarColor(s.color_bg); } catch (e) { /* */ }
    }
    document.title = s.brand_name || 'Menyu';
  }

  /* ------------------------------------------------------------ sheet */
  function openSheet(html, onMount) {
    closeSheet(true);
    const root = $('#sheet-root');
    root.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet"><div class="grab"></div>${html}</div>`;
    const bd = $('.sheet-backdrop', root), sh = $('.sheet', root);
    requestAnimationFrame(() => { bd.classList.add('show'); sh.classList.add('show'); });
    bd.addEventListener('click', () => closeSheet());
    let startY = null;
    sh.addEventListener('touchstart', (e) => { if (sh.scrollTop <= 0) startY = e.touches[0].clientY; }, { passive: true });
    sh.addEventListener('touchmove', (e) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) sh.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    sh.addEventListener('touchend', (e) => {
      if (startY === null) return;
      const dy = e.changedTouches[0].clientY - startY;
      startY = null;
      sh.style.transform = '';
      if (dy > 110) closeSheet();
    });
    S.sheetOpen = true;
    updateBack();
    if (onMount) onMount(sh);
    return sh;
  }
  function closeSheet(instant) {
    const root = $('#sheet-root');
    if (!root.firstChild) return;
    S.sheetOpen = false;
    if (instant) { root.innerHTML = ''; return; }
    $('.sheet-backdrop', root)?.classList.remove('show');
    $('.sheet', root)?.classList.remove('show');
    setTimeout(() => { if (!S.sheetOpen) root.innerHTML = ''; }, 300);
    updateBack();
  }

  /* ------------------------------------------------------------ navigation */
  function go(view, push = true) {
    if (push && S.view !== view) S.stack.push(S.view);
    S.view = view;
    stopPoll();
    render();
    window.scrollTo(0, 0);
    updateBack();
  }
  function back() {
    if (S.sheetOpen) { closeSheet(); return; }
    if (S.view === 'admin' && window.Admin && window.Admin.back()) return;
    const prev = S.stack.pop() || 'menu';
    go(prev, false);
  }
  function updateBack() {
    if (!tg || !tg.BackButton) return;
    if (S.view !== 'menu' || S.sheetOpen) tg.BackButton.show(); else tg.BackButton.hide();
  }

  /* ------------------------------------------------------------ cart */
  const cartKey = () => `cart_${S.user ? S.user.id : 0}`;
  const productById = (id) => S.products.find((p) => p.id === Number(id));
  function cartItems() {
    return Object.entries(S.cart).map(([id, qty]) => ({ p: productById(id), qty })).filter((x) => x.p && x.qty > 0);
  }
  function cartTotals() {
    const items = cartItems();
    const count = items.reduce((a, x) => a + x.qty, 0);
    const itemsTotal = items.reduce((a, x) => a + x.qty * x.p.price, 0);
    const pct = Number(S.settings.service_percent) || 0;
    const service = Math.round(itemsTotal * pct / 100);
    return { items, count, itemsTotal, service, pct, total: itemsTotal + service };
  }
  function setQty(id, qty) {
    id = Number(id);
    qty = Math.max(0, Math.min(99, qty));
    const prev = S.cart[id] || 0;
    if (qty === 0) delete S.cart[id]; else S.cart[id] = qty;
    store.set(cartKey(), S.cart);
    haptic(qty > prev ? 'light' : 'soft');
    refreshControls(id);
    updateCartBar(qty > prev);
  }
  function controlHtml(id, big = false) {
    const q = S.cart[id] || 0;
    if (!q) return `<button class="add" data-add="${id}" aria-label="Qo'shish">+</button>`;
    return `<div class="stepper ${big ? 'lg' : ''}"><button data-dec="${id}">−</button><b>${q}</b><button data-inc="${id}">+</button></div>`;
  }
  function refreshControls(id) {
    $$(`[data-ctl="${id}"]`).forEach((el) => { el.innerHTML = controlHtml(id, el.dataset.big === '1'); });
    $$(`[data-sheetctl="${id}"]`).forEach((el) => { el.innerHTML = sheetControl(id); });
    if (S.view === 'cart') renderCartBody();
  }
  function updateCartBar(bump) {
    const bar = $('#cartbar');
    if (!bar) return;
    const t = cartTotals();
    bar.classList.toggle('show', t.count > 0 && S.view === 'menu');
    $('.cnt', bar).textContent = t.count;
    $('.cb-lbl', bar).innerHTML = `${moneyText(t.total)}<small>${esc(S.settings.app_btn_cart)} · ${t.count} ta</small>`;
    if (bump) { bar.classList.remove('bump'); void bar.offsetWidth; bar.classList.add('bump'); }
  }

  /* ------------------------------------------------------------ media */
  function catEmoji(catId) { const c = S.categories.find((x) => x.id === catId); return (c && c.emoji) || '🍽'; }
  function photoHtml(p) {
    if (p.photo) return `<img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy" onerror="this.outerHTML='<div class=ph-empty>${esc(catEmoji(p.category_id))}</div>'">`;
    return `<div class="ph-empty">${esc(catEmoji(p.category_id))}</div>`;
  }

  /* ------------------------------------------------------------ render: root */
  function render() {
    const app = $('#app');
    if (S.view === 'menu') app.innerHTML = menuHtml();
    else if (S.view === 'cart') app.innerHTML = cartHtml();
    else if (S.view === 'order') app.innerHTML = orderHtml();
    else if (S.view === 'orders') app.innerHTML = `<div class="page"><div class="page-head"><button class="back" data-back>‹</button><h2>Buyurtmalarim</h2></div><div id="orders-list"><div class="skeleton" style="height:74px;margin-top:10px"></div><div class="skeleton" style="height:74px;margin-top:10px"></div></div></div>`;
    else if (S.view === 'admin') { app.innerHTML = '<div id="admin-root"></div>'; window.Admin && window.Admin.mount($('#admin-root')); }
    app.insertAdjacentHTML('beforeend', `<div class="cartbar" id="cartbar"><div class="cnt">0</div><div class="cb-lbl"></div><button class="go" data-go="cart">${esc(S.settings.app_btn_checkout)} →</button></div>`);
    updateCartBar(false);
    if (S.view === 'menu') { bindScrollSpy(); }
    if (S.view === 'cart') renderCartBody();
    if (S.view === 'order') startPoll();
    if (S.view === 'orders') loadOrders();
  }

  /* ------------------------------------------------------------ menu */
  function headerHtml() {
    const s = S.settings;
    const logo = s.brand_logo ? `<img src="${esc(s.brand_logo)}" alt="">` : esc(s.brand_emoji || '🫖');
    const tableBtn = S.table
      ? `<button class="table-pill" data-table>📍 ${S.table}-stol</button>`
      : `<button class="table-pill empty" data-table>📍 Stolni tanlang</button>`;
    return `<header class="top">
      <div class="logo">${logo}</div>
      <div class="brand"><h1>${esc(s.brand_name)}</h1><p>${esc(s.brand_tagline)}</p></div>
      ${S.isAdmin ? '<button class="icon-btn" data-go="admin" aria-label="Admin">⚙️</button>' : ''}
      <button class="icon-btn" data-go="orders" aria-label="Buyurtmalar">🧾${S.hasActive ? '<span class="dot"></span>' : ''}</button>
    </header>
    <div style="padding:0 16px 4px">${tableBtn}</div>`;
  }

  function heroTitle() {
    const t = esc(S.settings.app_hero_title || '');
    const words = t.split(' ');
    if (words.length < 2) return t;
    const last = words.pop();
    return `${words.join(' ')} <em>${last}</em>`;
  }

  function productCard(p, i = 0) {
    return `<article class="card" data-open="${p.id}" style="animation-delay:${Math.min(i, 10) * 30}ms">
      <div class="ph">${photoHtml(p)}${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}</div>
      <div class="body">
        <div class="name">${esc(p.name)}</div>
        ${p.unit ? `<div class="unit">${esc(p.unit)}</div>` : ''}
        <div class="foot"><div class="price">${money(p.price)}</div><div data-ctl="${p.id}">${controlHtml(p.id)}</div></div>
      </div></article>`;
  }

  function menuHtml() {
    const s = S.settings;
    const cats = S.categories.filter((c) => S.products.some((p) => p.category_id === c.id));
    const chips = cats.map((c) => `<button class="chip ${S.activeCat === c.id ? 'active' : ''}" data-cat="${c.id}">${esc(c.emoji)} ${esc(c.name)}</button>`).join('');
    return `${headerHtml()}
      <section class="hero"><h2>${heroTitle()}</h2></section>
      ${s.app_banner_text ? `<div class="banner">${esc(s.app_banner_text)}</div>` : ''}
      <div class="sticky">
        <label class="search">🔍<input id="search" type="search" enterkeyhint="search" placeholder="${esc(s.app_search_placeholder)}" value="${esc(S.search)}" autocomplete="off"><button class="clear ${S.search ? '' : 'hidden'}" data-clear>✕</button></label>
        <nav class="chips" id="chips">${chips}</nav>
      </div>
      <main id="catalog">${catalogHtml()}</main>
      <div class="spacer"></div>`;
  }

  function norm(t) { return String(t || '').toLowerCase().replace(/[ʻʼ‘’`']/g, "'").replace(/ё/g, 'е'); }

  function catalogHtml() {
    if (!S.products.length) return `<div class="empty-state"><div class="e">🍽</div><b>Menyu hali bo'sh</b>Tez orada taomlar qo'shiladi</div>`;
    const q = norm(S.search.trim());
    if (q) {
      const found = S.products.filter((p) => norm(p.name + ' ' + p.description + ' ' + p.unit).includes(q));
      if (!found.length) return `<div class="empty-state"><div class="e">🔎</div><b>Hech narsa topilmadi</b>Boshqa so'z bilan qidirib ko'ring</div>`;
      return `<section class="section"><div class="section-title"><h3>Natijalar</h3><span>${found.length} ta</span></div><div class="grid">${found.map(productCard).join('')}</div></section>`;
    }
    return S.categories.map((c) => {
      const items = S.products.filter((p) => p.category_id === c.id);
      if (!items.length) return '';
      return `<section class="section" id="cat-${c.id}" data-section="${c.id}"><div class="section-title"><h3>${esc(c.emoji)} ${esc(c.name)}</h3><span>${items.length} ta</span></div><div class="grid">${items.map(productCard).join('')}</div></section>`;
    }).join('');
  }

  let spyHandler = null;
  function bindScrollSpy() {
    if (spyHandler) window.removeEventListener('scroll', spyHandler);
    spyHandler = () => {
      if (S.search || S.lockSpy) return;
      const secs = $$('[data-section]');
      let curId = secs.length ? Number(secs[0].dataset.section) : null;
      for (const s of secs) if (s.getBoundingClientRect().top < 170) curId = Number(s.dataset.section);
      if (curId !== S.activeCat) setActiveChip(curId);
    };
    window.addEventListener('scroll', spyHandler, { passive: true });
    spyHandler();
  }
  function setActiveChip(id) {
    S.activeCat = id;
    $$('#chips .chip').forEach((c) => {
      const on = Number(c.dataset.cat) === id;
      c.classList.toggle('active', on);
      if (on) { const nav = $('#chips'); nav.scrollTo({ left: c.offsetLeft - nav.clientWidth / 2 + c.clientWidth / 2, behavior: 'smooth' }); }
    });
  }

  /* ------------------------------------------------------------ product sheet */
  function sheetControl(id) {
    const q = S.cart[id] || 0;
    const p = productById(id);
    if (!q) return `<button class="btn" data-add="${id}">${esc(S.settings.app_btn_add)} · ${moneyText(p.price)}</button>`;
    return `<div style="display:flex;gap:12px;align-items:center"><div class="stepper lg"><button data-dec="${id}">−</button><b>${q}</b><button data-inc="${id}">+</button></div><button class="btn" data-sheet-done style="flex:1">${moneyText(p.price * q)} ✓</button></div>`;
  }
  function openProduct(id) {
    const p = productById(id);
    if (!p) return;
    haptic();
    openSheet(`<div class="hero-img">${photoHtml(p)}</div>
      <div class="pad">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-top:8px">
          <h3 style="margin:0">${esc(p.name)}</h3>
          <div class="price" style="font-size:19px">${money(p.price)}</div>
        </div>
        ${p.unit || p.badge ? `<div style="display:flex;gap:8px;margin:8px 0 2px;flex-wrap:wrap">${p.unit ? `<span class="st done">${esc(p.unit)}</span>` : ''}${p.badge ? `<span class="st new">${esc(p.badge)}</span>` : ''}</div>` : ''}
        <p class="desc">${esc(p.description || '')}</p>
        <div data-sheetctl="${p.id}">${sheetControl(p.id)}</div>
      </div>`);
  }

  /* ------------------------------------------------------------ table */
  function openTablePicker(then) {
    const n = Number(S.settings.tables_count) || 20;
    let btns = '';
    for (let i = 1; i <= n; i++) btns += `<button class="${S.table === i ? 'on' : ''}" data-pick-table="${i}">${i}</button>`;
    S.afterTable = then || null;
    openSheet(`<div class="pad"><h3>Qaysi stolda o'tiribsiz?</h3><p class="desc">Stol raqami odatda stol ustidagi QR kod yonida yozilgan.</p><div class="table-grid">${btns}</div></div>`);
  }
  async function pickTable(n) {
    S.table = n;
    haptic('medium');
    closeSheet();
    try { await api('/api/table', { json: { table: n } }); } catch (e) { /* */ }
    if (S.view === 'menu') { const pill = $('[data-table]'); if (pill) { pill.className = 'table-pill'; pill.textContent = `📍 ${n}-stol`; } }
    if (S.view === 'cart') renderCartBody();
    const fn = S.afterTable; S.afterTable = null;
    if (fn) fn();
  }

  /* ------------------------------------------------------------ cart page */
  function cartHtml() {
    return `<div class="page"><div class="page-head"><button class="back" data-back>‹</button><h2>Savat</h2>
      <button class="mini danger" data-clear-cart aria-label="Tozalash">🗑</button></div><div id="cart-body"></div></div>
      <div class="fixed-cta"><button class="btn" id="checkout-btn" data-checkout></button></div>`;
  }
  function renderCartBody() {
    const body = $('#cart-body');
    if (!body) return;
    const t = cartTotals();
    const btn = $('#checkout-btn');
    if (!t.count) {
      body.innerHTML = `<div class="empty-state"><div class="e">🛒</div><b>Savat bo'sh</b>Menyudan sevimli taomlaringizni tanlang<div style="margin-top:18px"><button class="btn sm" data-back style="margin:0 auto">Menyuga qaytish</button></div></div>`;
      btn.parentElement.classList.add('hidden');
      return;
    }
    btn.parentElement.classList.remove('hidden');
    const comment = $('#comment') ? $('#comment').value : (S.comment || '');
    body.innerHTML = `
      <div class="panel">${t.items.map(({ p, qty }) => `<div class="line-item">
        <div class="thumb">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : esc(catEmoji(p.category_id))}</div>
        <div class="info"><b>${esc(p.name)}</b><span>${moneyText(p.price)}</span></div>
        <div class="stepper"><button data-dec="${p.id}">−</button><b>${qty}</b><button data-inc="${p.id}">+</button></div></div>`).join('')}</div>
      <div class="panel table-select"><div><h4 style="margin:0 0 2px">Stol</h4><div class="big">${S.table ? `${S.table}-stol` : '—'}</div></div><button class="btn sm ghost" data-table>${S.table ? "O'zgartirish" : 'Tanlash'}</button></div>
      <div class="panel"><h4>Izoh (ixtiyoriy)</h4><textarea id="comment" class="field" maxlength="500" placeholder="Masalan: achchiq bo'lmasin, choy keyinroq…">${esc(comment)}</textarea></div>
      <div class="panel">
        <div class="sum-row"><span>Taomlar</span><b>${moneyText(t.itemsTotal)}</b></div>
        <div class="sum-row"><span>Xizmat haqi (${t.pct}%)</span><b>${moneyText(t.service)}</b></div>
        <div class="sum-row total"><span>Jami</span><b>${moneyText(t.total)}</b></div>
      </div>`;
    btn.innerHTML = `${esc(S.settings.app_btn_checkout)} · ${moneyText(t.total)}`;
  }

  async function checkout() {
    const t = cartTotals();
    if (!t.count) return;
    if (!S.table) { openTablePicker(checkout); return; }
    const btn = $('#checkout-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>';
    S.comment = $('#comment') ? $('#comment').value : '';
    try {
      const data = await api('/api/orders', { json: { table: S.table, comment: S.comment, items: t.items.map((x) => ({ id: x.p.id, qty: x.qty })) } });
      S.cart = {}; S.comment = '';
      store.set(cartKey(), S.cart);
      S.order = data.order; S.payment = data.payment; S.freshOrder = true; S.hasActive = true;
      notifyHaptic('success');
      S.stack = ['menu'];
      go('order', false);
    } catch (e) {
      toast(e.message, true);
      btn.disabled = false;
      renderCartBody();
    }
  }

  /* ------------------------------------------------------------ order page */
  const STATUS = { new: '🆕 Yangi', accepted: '👨‍🍳 Tayyorlanmoqda', ready: '✅ Tayyor', done: '🏁 Berildi', cancelled: '❌ Bekor qilindi' };
  function stepsHtml(st) {
    const order = ['new', 'accepted', 'ready'];
    let idx = order.indexOf(st);
    if (st === 'done') idx = 2;
    const labels = [['🧾', 'Qabul qilindi'], ['👨‍🍳', 'Tayyorlanmoqda'], ['🍽', 'Tayyor']];
    const width = idx <= 0 ? 0 : idx === 1 ? 50 : 100;
    return `<div class="steps"><div class="bar" style="width:calc((100% - 36px) * ${width / 100})"></div>${labels.map(([i, l], k) => `<div class="step ${k <= idx ? 'on' : ''} ${k === idx && st !== 'done' && st !== 'ready' ? 'cur' : ''}"><i>${i}</i>${l}</div>`).join('')}</div>`;
  }
  function payCard(cls, card, amount) {
    const num = String(card.number || '').replace(/\s+/g, '');
    const pretty = num ? num.replace(/(.{4})/g, '$1 ').trim() : 'Karta kiritilmagan';
    return `<div class="paycard ${cls}">
      <div><div class="pc-lbl">${esc(card.label)}</div><div class="amt">${moneyText(amount)}<button class="copy amt-copy" data-copy="${Math.round(amount)}">Summa</button></div></div>
      <div><div class="num"><span>${esc(pretty)}</span>${num ? `<button class="copy" data-copy="${esc(num)}">Nusxa</button>` : ''}</div>
      ${card.holder ? `<div class="holder">${esc(card.holder)}</div>` : ''}</div></div>`;
  }
  function orderHtml() {
    const o = S.order, pay = S.payment || {};
    if (!o) return '';
    const final = ['cancelled'].includes(o.status);
    const head = S.freshOrder
      ? `<div class="success"><div class="ring">✓</div><h2>Buyurtma #${o.id} qabul qilindi!</h2><p>${o.table_no}-stol · Oshxonaga yuborildi</p></div>`
      : `<div class="page-head"><button class="back" data-back>‹</button><h2>Buyurtma #${o.id}</h2><span class="st ${o.status}">${STATUS[o.status] || o.status}</span></div>`;
    const mode = pay.mode || 'split';
    let payInner = '';
    if (o.paid && o.receipt === 2) {
      payInner = '<div class="receipt-ok">✅ Onlayn to\'landi. Rahmat!</div>';
    } else if (mode === 'online') {
      payInner = `<button class="btn" data-online style="margin-top:14px">💳 ${esc(pay.online_title || "To'lash")} · ${moneyText(o.total)}</button>
        <p class="note">Click yoki Payme orqali bir martada to'laysiz. To'lov Telegram ichida xavfsiz amalga oshadi.</p>`;
    } else {
      payInner = (mode === 'single'
        ? payCard('c1', pay.card0 || {}, o.total)
        : payCard('c1', pay.card1 || {}, o.service) + payCard('c2', pay.card2 || {}, o.items_total))
        + `<p class="note">${esc(pay.note || '')}</p>
        ${o.receipt ? '<div class="receipt-ok">✅ Chek yuborildi. Rahmat!</div>' : ''}
        ${o.paid && !o.receipt ? '<div class="receipt-ok">✅ To\'lov haqida xabar berildi</div>' : ''}
        ${!o.receipt ? `<div class="btn-row"><label class="btn ghost" style="cursor:pointer">📎 Chek yuklash<input type="file" accept="image/*" id="receipt" hidden></label>
          ${!o.paid ? `<button class="btn" data-paid>${esc(S.settings.app_btn_paid)}</button>` : ''}</div>` : ''}`;
    }
    const payBlock = o.status === 'cancelled' ? '' : `
      <div class="panel" style="padding-bottom:16px"><h4>💳 To'lov</h4>
        <div class="sum-row"><span>Taomlar</span><b>${moneyText(o.items_total)}</b></div>
        <div class="sum-row"><span>Xizmat haqi (${Number(o.service_percent)}%)</span><b>${moneyText(o.service)}</b></div>
        <div class="sum-row total"><span>Jami</span><b>${moneyText(o.total)}</b></div>
        ${payInner}
      </div>`;
    return `<div class="page">${head}
      ${final ? '<div class="panel" style="text-align:center;color:var(--danger);font-weight:700">Bu buyurtma bekor qilingan</div>' : `<div class="panel">${stepsHtml(o.status)}</div>`}
      ${payBlock}
      <div class="panel"><h4>🧾 Buyurtma tarkibi</h4>${o.items.map((it) => `<div class="sum-row"><span>${it.qty} × ${esc(it.name)}</span><b>${moneyText(it.qty * it.price)}</b></div>`).join('')}
        ${o.comment ? `<p class="hint">💬 ${esc(o.comment)}</p>` : ''}</div>
      <div class="btn-row"><button class="btn ghost" data-home>🍽 Menyuga qaytish</button></div>
    </div>`;
  }
  async function refreshOrder() {
    if (!S.order) return;
    try {
      const prevStatus = S.order.status;
      const data = await api(`/api/orders/${S.order.id}`);
      const changed = JSON.stringify(data.order) !== JSON.stringify(S.order) || JSON.stringify(data.payment) !== JSON.stringify(S.payment);
      S.order = data.order; S.payment = data.payment;
      if (changed && S.view === 'order') {
        if (data.order.status === 'ready' && prevStatus !== 'ready') { notifyHaptic('success'); toast('🍽 Buyurtmangiz tayyor!'); }
        const y = window.scrollY; render(); window.scrollTo(0, y);
      }
    } catch (e) { /* */ }
  }
  function startPoll() {
    stopPoll();
    if (!S.order || ['done', 'cancelled'].includes(S.order.status)) return;
    S.poll = setInterval(refreshOrder, 6000);
  }
  function stopPoll() { if (S.poll) clearInterval(S.poll); S.poll = null; }

  async function uploadReceipt(file) {
    if (!file) return;
    const label = $('#receipt').parentElement;
    label.innerHTML = '<span class="spin"></span> Yuklanmoqda…';
    const fd = new FormData();
    fd.append('file', file);
    try {
      const data = await api(`/api/orders/${S.order.id}/receipt`, { body: fd });
      S.order = data.order;
      notifyHaptic('success');
      toast('Chek yuborildi ✓');
    } catch (e) { toast(e.message, true); }
    const y = window.scrollY; render(); window.scrollTo(0, y);
  }
  async function payOnline(btn) {
    const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    try {
      const { link } = await api(`/api/orders/${S.order.id}/invoice`, { method: 'POST' });
      if (tg && tg.openInvoice) {
        tg.openInvoice(link, (status) => {
          if (status === 'paid') { notifyHaptic('success'); toast("✅ To'lov qabul qilindi!"); setTimeout(refreshOrder, 1500); setTimeout(refreshOrder, 4000); }
          else if (status === 'failed') toast("To'lov amalga oshmadi", true);
        });
      } else { window.open(link, '_blank'); }
    } catch (e) { toast(e.message, true); }
    btn.disabled = false; btn.innerHTML = old;
  }
  async function markPaid() {
    try {
      const data = await api(`/api/orders/${S.order.id}/paid`, { method: 'POST' });
      S.order = data.order;
      notifyHaptic('success');
      toast("Rahmat! Xodimlarga xabar berildi");
      const y = window.scrollY; render(); window.scrollTo(0, y);
    } catch (e) { toast(e.message, true); }
  }

  /* ------------------------------------------------------------ orders list */
  async function loadOrders() {
    const box = $('#orders-list');
    try {
      const { orders } = await api('/api/orders');
      S.hasActive = orders.some((o) => ['new', 'accepted', 'ready'].includes(o.status));
      if (!orders.length) { box.innerHTML = `<div class="empty-state"><div class="e">🧾</div><b>Hali buyurtma yo'q</b>Birinchi buyurtmangizni bering!</div>`; return; }
      S.ordersCache = orders;
      box.innerHTML = orders.map((o) => {
        const d = new Date(o.created_at * 1000);
        const time = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return `<button class="order-row" data-order="${o.id}"><div class="n">#${o.id}</div><div class="info"><b>${moneyText(o.total)}</b><span>${o.table_no}-stol · ${time} · ${o.items.reduce((a, i) => a + i.qty, 0)} ta</span></div><span class="st ${o.status}">${STATUS[o.status] || o.status}</span></button>`;
      }).join('');
    } catch (e) { box.innerHTML = `<div class="empty-state"><div class="e">⚠️</div><b>Yuklab bo'lmadi</b>${esc(e.message)}</div>`; }
  }

  /* ------------------------------------------------------------ events */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, [data-open], label');
    if (!t) return;
    const d = t.dataset;
    if (d.add) { e.stopPropagation(); setQty(d.add, (S.cart[d.add] || 0) + 1); return; }
    if (d.inc) { e.stopPropagation(); setQty(d.inc, (S.cart[d.inc] || 0) + 1); return; }
    if (d.dec) { e.stopPropagation(); setQty(d.dec, (S.cart[d.dec] || 0) - 1); return; }
    if (d.sheetDone !== undefined) { closeSheet(); return; }
    if (d.open && !e.target.closest('[data-ctl]')) { openProduct(d.open); return; }
    if (d.go) { haptic(); go(d.go); return; }
    if (d.back !== undefined) { back(); return; }
    if (d.home !== undefined) { S.stack = []; S.freshOrder = false; go('menu', false); return; }
    if (d.table !== undefined) { openTablePicker(); return; }
    if (d.pickTable) { pickTable(Number(d.pickTable)); return; }
    if (d.cat) {
      const id = Number(d.cat);
      const sec = $(`#cat-${id}`);
      setActiveChip(id);
      haptic();
      if (sec) {
        S.lockSpy = true;
        window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - 128, behavior: 'smooth' });
        setTimeout(() => { S.lockSpy = false; }, 700);
      }
      return;
    }
    if (d.clear !== undefined) { S.search = ''; const i = $('#search'); i.value = ''; onSearch(); i.focus(); return; }
    if (d.clearCart !== undefined) {
      const doClear = () => { S.cart = {}; store.set(cartKey(), S.cart); renderCartBody(); updateCartBar(); };
      ask('Savatni tozalaymizmi?').then((ok) => ok && doClear());
      return;
    }
    if (d.checkout !== undefined) { checkout(); return; }
    if (d.copy) { copyText(d.copy); return; }
    if (d.paid !== undefined) { markPaid(); return; }
    if (d.online !== undefined) { payOnline(t); return; }
    if (d.order) {
      const o = (S.ordersCache || []).find((x) => x.id === Number(d.order));
      if (o) { S.order = o; S.freshOrder = false; go('order'); refreshOrder(); }
    }
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'receipt') uploadReceipt(e.target.files[0]); });
  function onSearch() {
    const i = $('#search');
    S.search = i ? i.value : '';
    $('.search .clear')?.classList.toggle('hidden', !S.search);
    $('#catalog').innerHTML = catalogHtml();
    if (S.search) $$('#chips .chip').forEach((c) => c.classList.remove('active'));
  }
  document.addEventListener('input', (e) => {
    if (e.target.id === 'search') { clearTimeout(onSearch.t); onSearch.t = setTimeout(onSearch, 120); }
    if (e.target.id === 'comment') S.comment = e.target.value;
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'search') e.target.blur(); });

  /* ------------------------------------------------------------ boot */
  async function boot() {
    if (tg) {
      tg.ready();
      tg.expand();
      try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (e) { /* */ }
      tg.BackButton && tg.BackButton.onClick(back);
    }
    const params = new URLSearchParams(location.search);
    const startParam = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || '';
    const urlTable = Number(params.get('table') || String(startParam).replace(/\D/g, '')) || null;
    try {
      const data = await api('/api/bootstrap');
      Object.assign(S, {
        settings: data.settings, categories: data.categories, products: data.products, user: data.user,
        isAdmin: data.is_admin, isOwner: data.is_owner, botUsername: data.bot_username,
      });
      S.table = urlTable || data.table || null;
      if (urlTable && urlTable !== data.table) api('/api/table', { json: { table: urlTable } }).catch(() => {});
      S.cart = store.get(cartKey(), {});
      for (const id of Object.keys(S.cart)) if (!productById(id)) delete S.cart[id];
      applyTheme(S.settings);
      S.activeCat = S.categories.length ? S.categories[0].id : null;
      if (location.hash === '#admin' && S.isAdmin) { S.view = 'admin'; S.stack = ['menu']; }
      render();
      updateBack();
      api('/api/orders').then(({ orders }) => {
        S.hasActive = orders.some((o) => ['new', 'accepted', 'ready'].includes(o.status));
        if (S.hasActive && S.view === 'menu') { const b = $('[data-go="orders"]'); if (b && !$('.dot', b)) b.insertAdjacentHTML('beforeend', '<span class="dot"></span>'); }
      }).catch(() => {});
    } catch (e) {
      $('#app').innerHTML = `<div class="empty-state" style="padding-top:30vh"><div class="e">🫖</div><b>${esc(e.message)}</b>Botga qaytib, «Menyu» tugmasini bosing.<div style="margin-top:18px"><button class="btn sm" onclick="location.reload()" style="margin:0 auto">Qayta urinish</button></div></div>`;
    }
  }

  function ask(msg) {
    return new Promise((resolve) => {
      if (tg && tg.initData && tg.showConfirm) { try { tg.showConfirm(msg, (ok) => resolve(!!ok)); return; } catch (e) { /* */ } }
      resolve(window.confirm(msg));
    });
  }

  window.App = { ask, S, api, esc, fmt, money, moneyText, toast, openSheet, closeSheet, go, back, applyTheme, haptic, notifyHaptic, copyText, render, $, $$, tg, store };
  document.addEventListener('DOMContentLoaded', boot);
})();
