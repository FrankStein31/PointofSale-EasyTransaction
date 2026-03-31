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
    const matches = pelangganList.filter(n => n.toLowerCase().includes(val));
    if (matches.length === 0) { dropdown.classList.remove('open'); return; }
    matches.forEach(name => {
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
  const editId     = parseInt(document.getElementById('editId').value)     || 0;

  if (!nama) { toast('Nama produk harus diisi!', 'error'); return; }
  if (!hargaJual) { toast('Harga jual harus diisi!', 'error'); return; }

  setLoading(true);
  try {
    let res;
    if (editId > 0) {
      res = await apiPost({ action: 'update_produk', data: { id: editId, nama, kategori, stok, hargaModal, hargaJual } });
      if (res.success) {
        const idx = produkList.findIndex(p => p.id === editId);
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
  document.getElementById('editId').value = 0;
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
        <button class="qty-btn" onclick="changeQty(${p.id},-1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${p.id},1)">+</button>
      </div>
      <button class="ci-remove" onclick="removeFromCart(${p.id})">✕</button>`;
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

  const entry = { tanggal: new Date().toISOString(), pembeli, items, total, totalModal, totalUntung, bayar, kembalian };

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
    updateBadge();

    const extra = totalUntung > 0 ? ` · Untung: ${fmt(totalUntung)}` : '';
    toast(`Transaksi berhasil!${extra}`, 'success');
  } catch { toast('Gagal terhubung!', 'error'); }
  finally { setLoading(false); }
});

/* ══════════════════════════════════════════════════════════
   RIWAYAT
══════════════════════════════════════════════════════════ */
function renderRiwayat(filterDate = '') {
  const tbody = document.getElementById('tbodyRiwayat');
  tbody.innerHTML = '';

  let list = [...riwayatList];
  if (filterDate) list = list.filter(r => r.tanggal.startsWith(filterDate));

  // summary (always all data, not filtered)
  const tP = riwayatList.reduce((a, r) => a + r.total, 0);
  const tM = riwayatList.reduce((a, r) => a + r.totalModal, 0);
  const tU = riwayatList.reduce((a, r) => a + r.totalUntung, 0);
  document.getElementById('totalPendapatan').textContent = fmt(tP);
  document.getElementById('totalModal').textContent      = fmt(tM);
  document.getElementById('totalUntung').textContent     = fmt(tU);
  document.getElementById('totalTransaksi').textContent  = riwayatList.length;
  updateBadge();

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state sm">
        <div class="empty-icon">📊</div>
        <p>${filterDate ? 'Tidak ada transaksi tanggal ini.' : 'Belum ada transaksi.'}</p>
      </div></td></tr>`;
    return;
  }

  list.forEach((r, i) => {
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
}

document.getElementById('filterTanggal').addEventListener('change', e => renderRiwayat(e.target.value));
document.getElementById('btnResetFilter').addEventListener('click', () => {
  document.getElementById('filterTanggal').value = '';
  renderRiwayat();
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
    updateBadge();
    setupAutocomplete();
  }
}

init();
