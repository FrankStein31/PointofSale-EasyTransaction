/* ============================================================
   GAME STUFF — APP.JS
   db.json backend · kategori · pelanggan autocomplete
   ============================================================ */

'use strict';

const API = 'api.php';

/* ── State ────────────────────────────────────────────── */
let produkList    = [];
let riwayatList   = [];
let kategoriList  = [];
let pelangganList = [];
let cart          = [];

/* ── Format ───────────────────────────────────────────── */
function fmt(n) {
  return 'Rp\u00A0' + Number(n || 0).toLocaleString('id-ID');
}

/* ── Loading ──────────────────────────────────────────── */
function setLoading(v) {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !v);
}

/* ── API ──────────────────────────────────────────────── */
async function apiGet(type) {
  const r = await fetch(`${API}?type=${type}`);
  return r.json();
}
async function apiPost(body) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

/* ── Toast ────────────────────────────────────────────── */
function toast(msg, type = 'success') {
  const icons = { success: '✓', error: '✕', info: '·', warn: '!' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  document.getElementById('toastContainer').prepend(el);
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 250); }, 3200);
}

/* ── Modal: Confirm ───────────────────────────────────── */
let _modalResolve = null;
function confirmModal(title, msg) {
  return new Promise(res => {
    _modalResolve = res;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMsg').textContent   = msg;
    document.getElementById('modalOverlay').classList.add('open');
  });
}
document.getElementById('modalCancel').onclick = () => {
  document.getElementById('modalOverlay').classList.remove('open');
  if (_modalResolve) _modalResolve(false);
};
document.getElementById('modalConfirm').onclick = () => {
  document.getElementById('modalOverlay').classList.remove('open');
  if (_modalResolve) _modalResolve(true);
};

/* ══════════════════════════════════════════════════════════
   TAB NAVIGATION
══════════════════════════════════════════════════════════ */
function switchTab(tab) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn, .drawer-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab' + cap(tab)).classList.add('active');
  document.querySelectorAll(`[data-tab="${tab}"]`).forEach(b => b.classList.add('active'));
  closeDrawer();
  if (tab === 'transaksi') renderShopGrid();
  if (tab === 'riwayat')   renderRiwayat();
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

document.querySelectorAll('.nav-btn, .drawer-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

/* ── Drawer ───────────────────────────────────────────── */
function openDrawer() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('hamburger').addEventListener('click', openDrawer);
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);

/* ══════════════════════════════════════════════════════════
   KATEGORI DROPDOWN
══════════════════════════════════════════════════════════ */
function renderKategoriDropdown(selectEl, selected = '') {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">Pilih kategori…</option>';
  kategoriList.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = k;
    if (k === selected) opt.selected = true;
    selectEl.appendChild(opt);
  });
  const addOpt = document.createElement('option');
  addOpt.value = '__add_new__';
  addOpt.textContent = '+ Tambah kategori baru…';
  addOpt.style.fontWeight = '600';
  selectEl.appendChild(addOpt);
}

function renderFilterKategori() {
  const sel = document.getElementById('filterKategori');
  sel.innerHTML = '<option value="">Semua Kategori</option>';
  kategoriList.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = k;
    sel.appendChild(opt);
  });
}

// Handle "add new" in category select
document.getElementById('kategoriProduk').addEventListener('change', e => {
  if (e.target.value === '__add_new__') {
    e.target.value = '';
    openKatModal();
  }
});

// ── Kategori Modal ──
function openKatModal() {
  document.getElementById('katBaruInput').value = '';
  document.getElementById('katModalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('katBaruInput').focus(), 80);
}
document.getElementById('katCancel').onclick = () => {
  document.getElementById('katModalOverlay').classList.remove('open');
};
document.getElementById('katSave').onclick = async () => {
  const nama = document.getElementById('katBaruInput').value.trim();
  if (!nama) return;
  setLoading(true);
  try {
    const res = await apiPost({ action: 'add_kategori', nama });
    if (res.success) {
      kategoriList = res.data;
      renderKategoriDropdown(document.getElementById('kategoriProduk'), nama);
      document.getElementById('kategoriProduk').value = nama;
      renderFilterKategori();
      toast(`Kategori "${nama}" ditambahkan.`, 'success');
    }
  } catch { toast('Gagal menyimpan kategori!', 'error'); }
  finally { setLoading(false); }
  document.getElementById('katModalOverlay').classList.remove('open');
};
// Submit on Enter in modal
document.getElementById('katBaruInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('katSave').click(); }
});

/* ══════════════════════════════════════════════════════════
   PELANGGAN AUTOCOMPLETE
══════════════════════════════════════════════════════════ */
function setupAutocomplete() {
  const input    = document.getElementById('namaPembeli');
  const dropdown = document.getElementById('pembeliDropdown');

  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    dropdown.innerHTML = '';
    if (!val) { dropdown.classList.remove('open'); return; }

    const matches = pelangganList.filter(p => {
      const n = typeof p === 'string' ? p : (p.nama || '');
      return n.toLowerCase().includes(val);
    });
    
    if (matches.length === 0) { dropdown.classList.remove('open'); return; }
    matches.forEach(p => {
      const name = typeof p === 'string' ? p : (p.nama || '');
      const el = document.createElement('div');
      el.className = 'ac-option';
      // Highlight match
      const idx = name.toLowerCase().indexOf(val);
      el.innerHTML = name.slice(0, idx) + '<b>' + name.slice(idx, idx + val.length) + '</b>' + name.slice(idx + val.length);
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = name;
        dropdown.classList.remove('open');
      });
      dropdown.appendChild(el);
    });
    dropdown.classList.add('open');
  });

  input.addEventListener('blur', () => {
    setTimeout(() => dropdown.classList.remove('open'), 150);
  });
  input.addEventListener('focus', () => {
    if (input.value.trim()) input.dispatchEvent(new Event('input'));
  });
}

/* ══════════════════════════════════════════════════════════
   PRODUK
══════════════════════════════════════════════════════════ */
function renderProdukGrid(filter = '', katFilter = '') {
  const grid = document.getElementById('produkGrid');
  grid.innerHTML = '';

  let list = produkList;
  if (filter) list = list.filter(p => p.nama.toLowerCase().includes(filter.toLowerCase()));
  if (katFilter) list = list.filter(p => p.kategori === katFilter);

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">📦</div>
      <p>${filter || katFilter ? 'Produk tidak ditemukan.' : 'Belum ada produk.'}</p>
    </div>`;
    updateStats(); return;
  }

  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'p-card';
    card.innerHTML = `
      ${p.kategori ? `<div class="p-kat">${p.kategori}</div>` : ''}
      <div class="p-name">${p.nama}</div>
      <div class="p-stock ${p.stok === 0 ? 'out' : ''}">Stok: ${p.stok === 0 ? 'Habis' : p.stok}</div>
      <div class="p-price">${fmt(p.hargaJual)}</div>`;
    card.addEventListener('click', () => openProdukModal(p.id));
    grid.appendChild(card);
  });
  updateStats();
}

function updateStats() {
  const total = produkList.length;
  const stok  = produkList.reduce((a, p) => a + p.stok, 0);
  const inv   = produkList.reduce((a, p) => a + p.hargaJual * p.stok, 0);
  document.getElementById('totalProdukVal').textContent    = total;
  document.getElementById('totalStokVal').textContent      = stok;
  document.getElementById('nilaiInventoryVal').textContent = fmt(inv);
}

// Search + filter
document.getElementById('searchProduk').addEventListener('input', () => applyProdukFilter());
document.getElementById('filterKategori').addEventListener('change', () => applyProdukFilter());
function applyProdukFilter() {
  renderProdukGrid(
    document.getElementById('searchProduk').value,
    document.getElementById('filterKategori').value
  );
}

/* ── Produk Action Modal ──────────────────────────────── */
let _selectedProdukId = null;

function openProdukModal(id) {
  const p = produkList.find(x => x.id === id);
  if (!p) return;
  _selectedProdukId = id;
  document.getElementById('pmTitle').textContent = p.nama;

  const info = document.getElementById('pmInfo');
  const margin = p.hargaModal > 0 ? (p.hargaJual - p.hargaModal) : null;
  info.innerHTML = `
    <div class="pm-info-row"><span class="pm-info-label">Kategori</span><span class="pm-info-value">${p.kategori || '—'}</span></div>
    <div class="pm-info-row"><span class="pm-info-label">Stok</span><span class="pm-info-value">${p.stok}</span></div>
    <div class="pm-info-row"><span class="pm-info-label">Harga Jual</span><span class="pm-info-value">${fmt(p.hargaJual)}</span></div>
    <div class="pm-info-row"><span class="pm-info-label">Harga Modal</span><span class="pm-info-value">${p.hargaModal > 0 ? fmt(p.hargaModal) : '—'}</span></div>
    ${margin !== null ? `<div class="pm-info-row"><span class="pm-info-label">Margin</span><span class="pm-info-value profit-pos">+${fmt(margin)}</span></div>` : ''}`;

  document.getElementById('produkModalOverlay').classList.add('open');
}

function closeProdukModal() {
  document.getElementById('produkModalOverlay').classList.remove('open');
  _selectedProdukId = null;
}
document.getElementById('pmClose').onclick = closeProdukModal;
document.getElementById('produkModalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('produkModalOverlay')) closeProdukModal();
});

// Edit
document.getElementById('pmEdit').onclick = () => {
  const p = produkList.find(x => x.id === _selectedProdukId);
  if (!p) return;
  closeProdukModal();
  document.getElementById('editId').value        = p.id;
  document.getElementById('namaProduk').value    = p.nama;
  document.getElementById('stokProduk').value    = p.stok;
  document.getElementById('hargaJual').value     = p.hargaJual;
  document.getElementById('hargaModal').value    = p.hargaModal || '';
  renderKategoriDropdown(document.getElementById('kategoriProduk'), p.kategori || '');
  document.getElementById('formTitleText').textContent = '✏️ Edit Produk';
  document.getElementById('btnSimpan').textContent     = 'Update Produk';
  document.getElementById('btnBatal').style.display    = 'inline-flex';
  document.getElementById('cardFormProduk').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Delete
document.getElementById('pmDelete').onclick = async () => {
  const p = produkList.find(x => x.id === _selectedProdukId);
  if (!p) return;
  closeProdukModal();
  const ok = await confirmModal('Hapus Produk', `Yakin ingin menghapus "${p.nama}"?`);
  if (!ok) return;
  setLoading(true);
  try {
    const res = await apiPost({ action: 'delete_produk', id: p.id });
    if (res.success) {
      produkList = produkList.filter(x => x.id !== p.id);
      toast(`"${p.nama}" dihapus.`, 'info');
      applyProdukFilter();
    } else { toast(res.message || 'Gagal menghapus.', 'error'); }
  } catch { toast('Gagal terhubung!', 'error'); }
  finally { setLoading(false); }
};

/* ── Form Submit ──────────────────────────────────────── */
document.getElementById('formProduk').addEventListener('submit', async e => {
  e.preventDefault();
  const nama       = document.getElementById('namaProduk').value.trim();
  const kategori   = document.getElementById('kategoriProduk').value;
  const stok       = parseInt(document.getElementById('stokProduk').value) || 0;
  const hargaJual  = parseInt(document.getElementById('hargaJual').value)  || 0;
  const hargaModal = parseInt(document.getElementById('hargaModal').value) || 0;
  const editId     = document.getElementById('editId').value.trim();

  if (!nama) { toast('Nama produk harus diisi!', 'error'); return; }
  if (!hargaJual) { toast('Harga jual harus diisi!', 'error'); return; }

  setLoading(true);
  try {
    let res;
    if (editId && editId !== '0' && editId !== '') {
      res = await apiPost({ action: 'update_produk', data: { id: editId, nama, kategori, stok, hargaModal, hargaJual } });
      if (res.success) {
        const idx = produkList.findIndex(p => String(p.id) === editId);
        if (idx !== -1) produkList[idx] = res.data;
        if (res.kategori) { kategoriList = res.kategori; renderFilterKategori(); }
        toast(`"${nama}" diperbarui.`, 'info');
      }
    } else {
      res = await apiPost({ action: 'add_produk', data: { nama, kategori, stok, hargaModal, hargaJual } });
      if (res.success) {
        produkList.push(res.data);
        if (res.kategori) { kategoriList = res.kategori; renderFilterKategori(); }
        toast(`"${nama}" ditambahkan.`, 'success');
      }
    }
    if (!res.success) { toast(res.message || 'Gagal menyimpan.', 'error'); return; }
    resetForm();
    applyProdukFilter();
  } catch { toast('Gagal terhubung!', 'error'); }
  finally { setLoading(false); }
});

function resetForm() {
  document.getElementById('formProduk').reset();
  document.getElementById('editId').value = '';
  document.getElementById('hargaModal').value = '';
  document.getElementById('formTitleText').textContent = '➕ Tambah Produk';
  document.getElementById('btnSimpan').textContent     = 'Simpan Produk';
  document.getElementById('btnBatal').style.display    = 'none';
  renderKategoriDropdown(document.getElementById('kategoriProduk'));
}
document.getElementById('btnBatal').addEventListener('click', resetForm);

/* ══════════════════════════════════════════════════════════
   TRANSAKSI
══════════════════════════════════════════════════════════ */
function renderShopGrid(filter = '') {
  const grid = document.getElementById('shopGrid');
  grid.innerHTML = '';
  let list = produkList;
  if (filter) list = list.filter(p => p.nama.toLowerCase().includes(filter.toLowerCase()));

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state sm" style="grid-column:1/-1">
      <div class="empty-icon">📦</div>
      <p>Produk tidak ditemukan.</p></div>`;
    return;
  }

  list.forEach(p => {
    const inCart = cart.find(c => c.produkId === p.id);
    const card = document.createElement('div');
    card.className = 'shop-card' + (p.stok === 0 ? ' out-of-stock' : '') + (inCart ? ' in-cart' : '');
    card.innerHTML = `
      <div class="sc-name">${p.nama}</div>
      <div class="sc-stock">Stok: ${p.stok === 0 ? 'Habis' : p.stok}</div>
      <div class="sc-price">${fmt(p.hargaJual)}</div>`;
    card.addEventListener('click', () => addToCart(p.id));
    grid.appendChild(card);
  });
}

function addToCart(produkId) {
  const p = produkList.find(x => x.id === produkId);
  if (!p || p.stok < 1) return;
  const item = cart.find(c => c.produkId === produkId);
  if (item) {
    if (item.qty >= p.stok) { toast('Stok tidak mencukupi!', 'warn'); return; }
    item.qty++;
  } else {
    cart.push({ produkId, qty: 1 });
  }
  renderCart();
  renderShopGrid(document.getElementById('searchTransaksi').value);
  toast(`${p.nama} ditambahkan.`, 'info');
}

function changeQty(produkId, delta) {
  const item = cart.find(c => c.produkId === produkId);
  const p    = produkList.find(x => x.id === produkId);
  if (!item || !p) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(c => c.produkId !== produkId);
  else if (item.qty > p.stok) { item.qty = p.stok; toast('Stok tidak mencukupi!', 'warn'); }
  renderCart();
  renderShopGrid(document.getElementById('searchTransaksi').value);
}

function removeFromCart(produkId) {
  cart = cart.filter(c => c.produkId !== produkId);
  renderCart();
  renderShopGrid(document.getElementById('searchTransaksi').value);
}

function renderCart() {
  const cl = document.getElementById('cartList');
  cl.innerHTML = '';

  if (cart.length === 0) {
    cl.innerHTML = `<div class="empty-state sm"><div class="empty-icon">🛒</div><p>Keranjang kosong</p></div>`;
    updateCartSummary(0); return;
  }

  cart.forEach(item => {
    const p = produkList.find(x => x.id === item.produkId);
    if (!p) return;
    const sub = p.hargaJual * item.qty;
    const el = document.createElement('div');
    el.className = 'cart-item';
    el.innerHTML = `
      <div class="ci-info">
        <div class="ci-name">${p.nama}</div>
        <div class="ci-price">${fmt(p.hargaJual)} × ${item.qty} = ${fmt(sub)}</div>
      </div>
      <div class="ci-qty">
        <button class="qty-btn" onclick="changeQty('${p.id}',-1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty('${p.id}',1)">+</button>
      </div>
      <button class="ci-remove" onclick="removeFromCart('${p.id}')">✕</button>`;
    cl.appendChild(el);
  });

  const total = cart.reduce((a, c) => {
    const p = produkList.find(x => x.id === c.produkId);
    return a + (p ? p.hargaJual * c.qty : 0);
  }, 0);
  updateCartSummary(total);
}

function updateCartSummary(total) {
  document.getElementById('cartSubtotal').textContent = fmt(total);
  document.getElementById('cartTotal').textContent    = fmt(total);
  updateKembalian();
}

function updateKembalian() {
  const total = cart.reduce((a, c) => {
    const p = produkList.find(x => x.id === c.produkId);
    return a + (p ? p.hargaJual * c.qty : 0);
  }, 0);
  const bayar = parseInt(document.getElementById('inputBayar').value) || 0;
  const k     = bayar - total;
  const el    = document.getElementById('kembalianVal');
  if (bayar === 0)   { el.textContent = 'Rp 0'; el.className = ''; }
  else if (k < 0)    { el.textContent = `−${fmt(Math.abs(k))}`; el.className = 'neg'; }
  else               { el.textContent = fmt(k); el.className = ''; }
}
document.getElementById('inputBayar').addEventListener('input', updateKembalian);

document.getElementById('btnClearCart').addEventListener('click', async () => {
  if (cart.length === 0) return;
  const ok = await confirmModal('Kosongkan Keranjang', 'Hapus semua item dari keranjang?');
  if (!ok) return;
  cart = [];
  renderCart();
  renderShopGrid(document.getElementById('searchTransaksi').value);
});

document.getElementById('searchTransaksi').addEventListener('input', e => {
  renderShopGrid(e.target.value);
});

/* Proses Transaksi */
document.getElementById('btnBayar').addEventListener('click', async () => {
  if (cart.length === 0) { toast('Keranjang kosong!', 'error'); return; }

  const total = cart.reduce((a, c) => {
    const p = produkList.find(x => x.id === c.produkId);
    return a + (p ? p.hargaJual * c.qty : 0);
  }, 0);

  const bayar   = parseInt(document.getElementById('inputBayar').value) || 0;
  if (bayar > 0 && bayar < total) {
    toast(`Uang kurang! Minimal ${fmt(total)}.`, 'error'); return;
  }

  const pembeli = document.getElementById('namaPembeli').value.trim() || 'Anonim';
  const items = cart.map(c => {
    const p = produkList.find(x => x.id === c.produkId);
    return {
      produkId: p.id, nama: p.nama, qty: c.qty,
      hargaJual: p.hargaJual, hargaModal: p.hargaModal,
      subtotal: p.hargaJual * c.qty,
      modal:    p.hargaModal * c.qty,
      untung:   (p.hargaJual - p.hargaModal) * c.qty,
    };
  });

  const totalModal  = items.reduce((a, i) => a + i.modal, 0);
  const totalUntung = items.reduce((a, i) => a + i.untung, 0);
  const kembalian   = bayar > 0 ? bayar - total : 0;

  const dVal = document.getElementById('inputTanggalTransaksi').value;
  const tglT  = dVal ? new Date(dVal).toISOString() : new Date().toISOString();

  const entry = { tanggal: tglT, pembeli, items, total, totalModal, totalUntung, bayar, kembalian };

  setLoading(true);
  try {
    const res = await apiPost({ action: 'add_riwayat', data: entry });
    if (!res.success) { toast('Gagal menyimpan transaksi!', 'error'); return; }

    if (res.produk)    produkList    = res.produk;
    if (res.pelanggan) pelangganList = res.pelanggan;
    riwayatList.unshift(res.data);

    cart = [];
    renderCart();
    renderShopGrid(document.getElementById('searchTransaksi').value);
    applyProdukFilter();
    document.getElementById('namaPembeli').value = '';
    document.getElementById('inputBayar').value  = '';
    initDateTransaksi();
    updateBadge();

    const extra = totalUntung > 0 ? ` · Untung: ${fmt(totalUntung)}` : '';
    toast(`Transaksi berhasil!${extra}`, 'success');
  } catch { toast('Gagal terhubung!', 'error'); }
  finally { setLoading(false); }
});

/* ══════════════════════════════════════════════════════════
   RIWAYAT — CHART & FILTERS
══════════════════════════════════════════════════════════ */
let revenueChart = null;
let activeFilter = 'all';
let customFrom   = '';
let customTo     = '';

// ── Date helpers ───────────────────────────────────────
function toDateStr(d) { return d.toISOString().slice(0, 10); }
function startOfDay(d) { const c = new Date(d); c.setHours(0,0,0,0); return c; }
function endOfDay(d)   { const c = new Date(d); c.setHours(23,59,59,999); return c; }

function getStartOfWeek(d) {
  const c = new Date(d); c.setHours(0,0,0,0);
  const day = c.getDay(); // 0=Sun
  c.setDate(c.getDate() - (day === 0 ? 6 : day - 1)); // Monday start
  return c;
}
function getStartOfMonth(d) {
  const c = new Date(d); c.setHours(0,0,0,0); c.setDate(1); return c;
}

function filterByRange(list) {
  const now = new Date();
  if (activeFilter === 'all') return [...list];
  if (activeFilter === 'today') {
    const s = startOfDay(now), e = endOfDay(now);
    return list.filter(r => { const d = new Date(r.tanggal); return d >= s && d <= e; });
  }
  if (activeFilter === 'week') {
    const s = getStartOfWeek(now), e = endOfDay(now);
    return list.filter(r => { const d = new Date(r.tanggal); return d >= s && d <= e; });
  }
  if (activeFilter === 'month') {
    const s = getStartOfMonth(now), e = endOfDay(now);
    return list.filter(r => { const d = new Date(r.tanggal); return d >= s && d <= e; });
  }
  if (activeFilter === 'custom' && customFrom && customTo) {
    const s = startOfDay(new Date(customFrom));
    const e = endOfDay(new Date(customTo));
    return list.filter(r => { const d = new Date(r.tanggal); return d >= s && d <= e; });
  }
  return [...list];
}

// ── Filter pills ───────────────────────────────────────
document.querySelectorAll('.pill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const f = btn.dataset.filter;
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    activeFilter = f;
    const customRow = document.getElementById('filterCustomRow');
    if (f === 'custom') {
      customRow.style.display = 'flex';
    } else {
      customRow.style.display = 'none';
      renderRiwayat();
    }
  });
});
document.getElementById('btnApplyCustom').addEventListener('click', () => {
  customFrom = document.getElementById('filterDateFrom').value;
  customTo   = document.getElementById('filterDateTo').value;
  if (!customFrom || !customTo) { toast('Pilih tanggal dari & sampai.', 'warn'); return; }
  if (customFrom > customTo)    { toast('Tanggal "dari" harus sebelum "sampai".', 'error'); return; }
  renderRiwayat();
});

// ── Chart ──────────────────────────────────────────────
function buildChartData(filteredList) {
  // Group by date
  const map = {};
  filteredList.forEach(r => {
    const key = new Date(r.tanggal).toLocaleDateString('id-ID', { day:'2-digit', month:'short' });
    if (!map[key]) map[key] = { revenue: 0, profit: 0, count: 0 };
    map[key].revenue += r.total;
    map[key].profit  += r.totalUntung;
    map[key].count   += 1;
  });
  const labels = Object.keys(map);
  return {
    labels,
    revenue: labels.map(l => map[l].revenue),
    profit:  labels.map(l => map[l].profit),
    count:   labels.map(l => map[l].count),
  };
}

function renderChart(filteredList) {
  const ctx = document.getElementById('revenueChart');
  if (!ctx) return;
  const data = buildChartData(filteredList);
  const type = document.getElementById('chartType').value;

  const labelMap  = { revenue: 'Pendapatan', profit: 'Keuntungan', count: 'Transaksi' };
  const colorMap  = { revenue: '#1d1d1f', profit: '#34c759', count: '#6e6e73' };
  const bgMap     = { revenue: 'rgba(29,29,31,.08)', profit: 'rgba(52,199,89,.1)', count: 'rgba(110,110,115,.08)' };

  const dataset = {
    label: labelMap[type],
    data: data[type],
    borderColor: colorMap[type],
    backgroundColor: bgMap[type],
    borderWidth: 2,
    fill: true,
    tension: .35,
    pointRadius: data.labels.length <= 14 ? 4 : 2,
    pointBackgroundColor: colorMap[type],
    pointHoverRadius: 6,
  };

  if (revenueChart) revenueChart.destroy();
  revenueChart = new Chart(ctx, {
    type: 'line',
    data: { labels: data.labels, datasets: [dataset] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1d1d1f',
          titleFont: { family: 'Inter', weight: '700', size: 12 },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y;
              return type === 'count' ? `${v} transaksi` : fmt(v);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Inter', size: 11, weight: '500' }, color: '#aeaeb2' },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,.04)' },
          ticks: {
            font: { family: 'Inter', size: 11 }, color: '#aeaeb2',
            callback: v => type === 'count' ? v : (v >= 1000000 ? (v/1000000).toFixed(1)+'jt' : v >= 1000 ? (v/1000)+'rb' : v)
          },
          border: { display: false },
        }
      }
    }
  });
}

document.getElementById('chartType').addEventListener('change', () => {
  const filteredList = filterByRange(riwayatList);
  renderChart(filteredList);
});

// ── Render Riwayat ─────────────────────────────────────
function renderRiwayat() {
  if ($.fn.DataTable.isDataTable('#tableRiwayat')) {
    $('#tableRiwayat').DataTable().destroy();
  }

  const tbody = document.getElementById('tbodyRiwayat');
  tbody.innerHTML = '';

  const filteredList = filterByRange(riwayatList);

  // Stats based on filter
  const tP = filteredList.reduce((a, r) => a + r.total, 0);
  const tM = filteredList.reduce((a, r) => a + r.totalModal, 0);
  const tU = filteredList.reduce((a, r) => a + r.totalUntung, 0);
  document.getElementById('totalPendapatan').textContent = fmt(tP);
  document.getElementById('totalModal').textContent      = fmt(tM);
  document.getElementById('totalUntung').textContent     = fmt(tU);
  document.getElementById('totalTransaksi').textContent  = filteredList.length;
  updateBadge();

  // Label
  const rangeLabels = {
    all: 'Pendapatan', today: 'Hari Ini', week: 'Minggu Ini',
    month: 'Bulan Ini', custom: 'Rentang Dipilih'
  };
  document.getElementById('statsRangeLabel').textContent = rangeLabels[activeFilter] || 'Pendapatan';

  // Chart
  renderChart(filteredList);

  // Table
  if (filteredList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state sm">
        <div class="empty-icon">📊</div>
        <p>Tidak ada transaksi pada periode ini.</p>
      </div></td></tr>`;
    return;
  }

  filteredList.forEach((r, i) => {
    const dt    = new Date(r.tanggal);
    const dtStr = dt.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })
                + ' ' + dt.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
    const items = r.items.map(it => `${it.nama} ×${it.qty}`).join(', ');
    const cls   = r.totalUntung > 0 ? 'profit-pos' : 'profit-zero';
    const sign  = r.totalUntung > 0 ? '+' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-muted" style="font-size:.72rem">${i + 1}</td>
      <td style="font-size:.75rem;color:var(--text2);white-space:nowrap">${dtStr}</td>
      <td class="fw-700">${r.pembeli}</td>
      <td style="max-width:170px;font-size:.75rem;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${items}">${items}</td>
      <td class="fw-700">${fmt(r.total)}</td>
      <td class="text-muted">${r.totalModal > 0 ? fmt(r.totalModal) : '—'}</td>
      <td class="${cls}">${sign}${fmt(r.totalUntung)}</td>
      <td class="text-muted">${r.bayar > 0 ? fmt(r.bayar) : '—'}</td>
      <td class="text-muted">${r.kembalian > 0 ? fmt(r.kembalian) : '—'}</td>`;
    tbody.appendChild(tr);
  });

  if (filteredList.length > 0) {
    $('#tableRiwayat').DataTable({
      pageLength: 5,
      lengthMenu: [[5, 15, 20, 50, 100], [5, 15, 20, 50, 100]],
      order: [],
      language: {
        lengthMenu: "Tampil _MENU_ data",
        info: "Menampilkan _START_ sampai _END_ dari _TOTAL_ data",
        infoEmpty: "Data tidak ditemukan",
        search: "Cari:",
        paginate: {
          first: "Awal",
          last: "Akhir",
          next: "Lanjut",
          previous: "Balik"
        }
      }
    });

    const $tbl = $('#tableRiwayat');
    if (!$tbl.parent().hasClass('table-responsive')) {
      $tbl.wrap('<div class="table-responsive" style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;"></div>');
    }
  }
}

/* ── Download PDF ──────────────────────────────────────── */
document.getElementById('btnDownloadPdf').addEventListener('click', () => {
  const filteredList = filterByRange(riwayatList);
  if (filteredList.length === 0) { toast('Tidak ada data untuk di-download.', 'warn'); return; }

  const jsPDFKlass = window.jsPDF || window.jspdf?.jsPDF;
  if (!jsPDFKlass) { toast('Penghasil PDF belum dimuat, coba lagi.', 'error'); return; }

  const doc = new jsPDFKlass({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();

  // ── Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(29, 29, 31);
  doc.text('Naya Game Stuff', 14, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 115);

  const rangeLabels = {
    all: 'Semua Waktu', today: 'Hari Ini', week: 'Minggu Ini',
    month: 'Bulan Ini', custom: `${customFrom} s/d ${customTo}`
  };
  const periodLabel = rangeLabels[activeFilter] || 'Semua Waktu';
  const now = new Date();
  doc.text(`Laporan Riwayat Transaksi  |  Periode: ${periodLabel}  |  Dicetak: ${now.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })} ${now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}`, 14, 22);

  // ── Summary
  const tP = filteredList.reduce((a, r) => a + r.total, 0);
  const tM = filteredList.reduce((a, r) => a + r.totalModal, 0);
  const tU = filteredList.reduce((a, r) => a + r.totalUntung, 0);

  const boxY = 28;
  const boxH = 14;
  const boxGap = 4;
  const boxW = (pageW - 28 - boxGap * 3) / 4;
  const boxes = [
    { label: 'Pendapatan', value: fmt(tP) },
    { label: 'Modal', value: fmt(tM) },
    { label: 'Keuntungan', value: fmt(tU) },
    { label: 'Transaksi', value: String(filteredList.length) },
  ];

  boxes.forEach((b, i) => {
    const x = 14 + i * (boxW + boxGap);
    doc.setFillColor(245, 245, 247);
    doc.roundedRect(x, boxY, boxW, boxH, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(174, 174, 178);
    doc.text(b.label.toUpperCase(), x + 4, boxY + 5);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(29, 29, 31);
    doc.text(b.value, x + 4, boxY + 11);
  });

  // ── Table
  const tableData = filteredList.map((r, i) => {
    const dt = new Date(r.tanggal);
    const dtStr = dt.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })
                + ' ' + dt.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
    const items = r.items.map(it => `${it.nama} x${it.qty}`).join(', ');
    const sign  = r.totalUntung > 0 ? '+' : '';
    return [
      i + 1, dtStr, r.pembeli, items,
      fmt(r.total),
      r.totalModal > 0 ? fmt(r.totalModal) : '-',
      sign + fmt(r.totalUntung),
      r.bayar > 0 ? fmt(r.bayar) : '-',
      r.kembalian > 0 ? fmt(r.kembalian) : '-',
    ];
  });

  doc.autoTable({
    startY: boxY + boxH + 6,
    head: [['#', 'Waktu', 'Pembeli', 'Item', 'Total', 'Modal', 'Untung', 'Bayar', 'Kembali']],
    body: tableData,
    theme: 'grid',
    styles: {
      font: 'helvetica', fontSize: 8, cellPadding: 3,
      textColor: [29, 29, 31], lineColor: [229, 229, 231], lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [245, 245, 247], textColor: [110, 110, 115],
      fontStyle: 'bold', fontSize: 7,
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      3: { cellWidth: 55 },
      4: { fontStyle: 'bold' },
      6: { textColor: [52, 199, 89], fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(174, 174, 178);
      doc.text('Naya Game Stuff — Point of Sale', 14, pageH - 6);
      doc.text(`Halaman ${doc.internal.getCurrentPageInfo().pageNumber}`, pageW - 14, pageH - 6, { align: 'right' });
    }
  });
  // Save via direct Blob to bypass internal doc.save() silent failures
  const dateStr = now.toISOString().slice(0, 10);
  const pdfName = `Riwayat_Transaksi_${dateStr}.pdf`;
  
  try {
    const blob = doc.output('blob');
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(blob, pdfName); // For IE/Edge legacy
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 500);
    }
    toast('PDF berhasil di-download!', 'success');
  } catch(err) {
    console.error(err);
    toast('Gagal mendownload PDF!', 'error');
  }
});

document.getElementById('btnHapusRiwayat').addEventListener('click', async () => {
  if (!riwayatList.length) return;
  const ok = await confirmModal('Hapus Semua', 'Semua riwayat transaksi akan dihapus permanen.');
  if (!ok) return;
  setLoading(true);
  try {
    const res = await apiPost({ action: 'delete_all_riwayat' });
    if (res.success) { riwayatList = []; renderRiwayat(); toast('Riwayat dihapus.', 'info'); }
  } catch { toast('Gagal terhubung!', 'error'); }
  finally { setLoading(false); }
});

function updateBadge() {
  document.getElementById('riwayatBadge').textContent = riwayatList.length;
}

function initDateTransaksi() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('inputTanggalTransaksi').value = now.toISOString().slice(0, 16);
}
document.getElementById('btnDateToday').addEventListener('click', initDateTransaksi);

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
async function init() {
  setLoading(true);
  try {
    const res = await apiGet('all');
    if (res.success) {
      produkList    = res.data.produk    || [];
      riwayatList   = res.data.riwayat   || [];
      kategoriList  = res.data.kategori  || [];
      pelangganList = res.data.pelanggan || [];
    }
  } catch { toast('Gagal memuat data!', 'error'); }
  finally {
    setLoading(false);
    renderKategoriDropdown(document.getElementById('kategoriProduk'));
    renderFilterKategori();
    applyProdukFilter();
    renderShopGrid();
    initDateTransaksi();
    updateBadge();
    setupAutocomplete();
  }
}

init();
