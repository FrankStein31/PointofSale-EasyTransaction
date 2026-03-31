/* ============================================================
   GAME STUFF – APP.JS
   db.json backend via api.php · Monochrome theme
   ============================================================ */

'use strict';

const API = 'api.php';

/* ── State ────────────────────────────────────────────────── */
let produkList  = [];
let riwayatList = [];
let cart        = [];

/* ── Format currency ──────────────────────────────────────── */
function fmt(n) {
  return 'Rp\u00A0' + Number(n || 0).toLocaleString('id-ID');
}

/* ── Loading overlay ──────────────────────────────────────── */
function setLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
}

/* ── API helper ───────────────────────────────────────────── */
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

/* ── Toast ────────────────────────────────────────────────── */
const TOAST_ICONS = { success: '✓', error: '✕', info: '·', warn: '!' };
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-ico">${TOAST_ICONS[type]}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').prepend(el);
  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

/* ── Modal ────────────────────────────────────────────────── */
let modalResolve = null;
function confirm(title, msg, icon = '?') {
  return new Promise(resolve => {
    modalResolve = resolve;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMsg').textContent   = msg;
    document.getElementById('modalIcon').textContent  = icon;
    document.getElementById('modalOverlay').classList.add('open');
  });
}
document.getElementById('modalCancel').addEventListener('click', () => {
  document.getElementById('modalOverlay').classList.remove('open');
  if (modalResolve) modalResolve(false);
});
document.getElementById('modalConfirm').addEventListener('click', () => {
  document.getElementById('modalOverlay').classList.remove('open');
  if (modalResolve) modalResolve(true);
});

/* ══════════════════════════════════════════════════════════════
   TAB NAVIGATION
══════════════════════════════════════════════════════════════ */
function switchTab(tab) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn, .drawer-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab' + cap(tab)).classList.add('active');
  document.querySelectorAll(`[data-tab="${tab}"]`).forEach(b => b.classList.add('active'));
  closeDrawer();
  if (tab === 'transaksi') renderProductGrid();
  if (tab === 'riwayat')   renderRiwayat();
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

document.querySelectorAll('.nav-btn, .drawer-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

/* ── Drawer ───────────────────────────────────────────────── */
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

/* ══════════════════════════════════════════════════════════════
   PRODUK
══════════════════════════════════════════════════════════════ */
function renderProduk(filter = '') {
  const tbody = document.getElementById('tbodyProduk');
  const list  = produkList.filter(p =>
    p.nama.toLowerCase().includes(filter.toLowerCase()));

  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <p>${filter ? 'Produk tidak ditemukan.' : 'Belum ada produk.'}</p>
      </div></td></tr>`;
    updateStats(); return;
  }

  list.forEach((p, i) => {
    const margin = p.hargaModal > 0 ? (p.hargaJual - p.hargaModal) : null;
    const pct    = margin !== null && p.hargaModal > 0
                   ? ((margin / p.hargaModal) * 100).toFixed(0) : null;

    let stockPill;
    if (p.stok === 0)     stockPill = `<span class="pill pill-empty">Habis</span>`;
    else if (p.stok < 5)  stockPill = `<span class="pill pill-low">${p.stok}</span>`;
    else                  stockPill = `<span class="pill pill-ok">${p.stok}</span>`;

    let marginHtml;
    if (margin === null) {
      marginHtml = `<span class="margin-zero text-muted">—</span>`;
    } else {
      marginHtml = `<span class="margin-text">+${fmt(margin)}&nbsp;<span class="text-muted">(${pct}%)</span></span>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-muted" style="font-size:.75rem">${i + 1}</td>
      <td class="cell-name">${p.nama}</td>
      <td>${stockPill}</td>
      <td class="text-muted">${p.hargaModal > 0 ? fmt(p.hargaModal) : '<span class="text-muted opacity-50">—</span>'}</td>
      <td class="fw-700 text-white">${fmt(p.hargaJual)}</td>
      <td>${marginHtml}</td>
      <td>
        <div class="action-row">
          <button class="btn-icon" title="Edit" onclick="startEdit(${p.id})">✏</button>
          <button class="btn-icon del" title="Hapus" onclick="hapusProduk(${p.id})">✕</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
  updateStats();
}

function updateStats() {
  const totalProduk = produkList.length;
  const totalStok   = produkList.reduce((a, p) => a + p.stok, 0);
  const nilaiInv    = produkList.reduce((a, p) => a + p.hargaJual * p.stok, 0);
  document.getElementById('totalProdukVal').textContent    = totalProduk;
  document.getElementById('totalStokVal').textContent      = totalStok;
  document.getElementById('nilaiInventoryVal').textContent = fmt(nilaiInv);
}

/* ── Form Submit ──────────────────────────────────────────── */
document.getElementById('formProduk').addEventListener('submit', async e => {
  e.preventDefault();
  const nama       = document.getElementById('namaProduk').value.trim();
  const stok       = parseInt(document.getElementById('stokProduk').value) || 0;
  const hargaModal = parseInt(document.getElementById('hargaModal').value) || 0;
  const hargaJual  = parseInt(document.getElementById('hargaJual').value)  || 0;
  const editId     = parseInt(document.getElementById('editId').value)     || 0;

  if (!nama) { toast('Nama produk tidak boleh kosong!', 'error'); return; }
  if (hargaJual === 0) { toast('Harga jual harus diisi!', 'error'); return; }

  setLoading(true);
  try {
    let res;
    if (editId > 0) {
      res = await apiPost({ action: 'update_produk', data: { id: editId, nama, stok, hargaModal, hargaJual } });
      if (res.success) {
        const idx = produkList.findIndex(p => p.id === editId);
        if (idx !== -1) produkList[idx] = res.data;
        toast(`"${nama}" diperbarui.`, 'info');
      }
    } else {
      res = await apiPost({ action: 'add_produk', data: { nama, stok, hargaModal, hargaJual } });
      if (res.success) {
        produkList.push(res.data);
        toast(`"${nama}" ditambahkan.`, 'success');
      }
    }
    if (!res.success) { toast(res.message || 'Gagal menyimpan.', 'error'); }
    else { resetForm(); renderProduk(document.getElementById('searchProduk').value); }
  } catch { toast('Koneksi ke server gagal!', 'error'); }
  finally { setLoading(false); }
});

function resetForm() {
  document.getElementById('formProduk').reset();
  document.getElementById('editId').value          = 0;
  document.getElementById('hargaModal').value      = '';
  document.getElementById('formTitleText').textContent = 'Tambah Produk';
  document.getElementById('btnSimpan').innerHTML   = '+ Simpan Produk';
  document.getElementById('btnBatal').style.display = 'none';
}

function startEdit(id) {
  const p = produkList.find(p => p.id === id);
  if (!p) return;
  document.getElementById('editId').value         = p.id;
  document.getElementById('namaProduk').value     = p.nama;
  document.getElementById('stokProduk').value     = p.stok;
  document.getElementById('hargaModal').value     = p.hargaModal || '';
  document.getElementById('hargaJual').value      = p.hargaJual;
  document.getElementById('formTitleText').textContent = 'Edit Produk';
  document.getElementById('btnSimpan').innerHTML  = '✓ Update Produk';
  document.getElementById('btnBatal').style.display = 'inline-flex';
  document.getElementById('cardTambahProduk').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('btnBatal').addEventListener('click', resetForm);

async function hapusProduk(id) {
  const p = produkList.find(p => p.id === id);
  if (!p) return;
  const ok = await confirm('Hapus Produk', `Hapus "${p.nama}"?`, '✕');
  if (!ok) return;
  setLoading(true);
  try {
    const res = await apiPost({ action: 'delete_produk', id });
    if (res.success) {
      produkList = produkList.filter(p => p.id !== id);
      toast(`"${p.nama}" dihapus.`, 'error');
      renderProduk(document.getElementById('searchProduk').value);
    } else { toast(res.message || 'Gagal menghapus.', 'error'); }
  } catch { toast('Koneksi ke server gagal!', 'error'); }
  finally { setLoading(false); }
}

document.getElementById('searchProduk').addEventListener('input', e => {
  renderProduk(e.target.value);
});

/* ══════════════════════════════════════════════════════════════
   TRANSAKSI
══════════════════════════════════════════════════════════════ */
function renderProductGrid(filter = '') {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';
  const list = produkList.filter(p =>
    p.nama.toLowerCase().includes(filter.toLowerCase()));

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">📦</div>
      <p>${filter ? 'Produk tidak ditemukan.' : 'Belum ada produk.'}</p>
    </div>`;
    return;
  }

  list.forEach(p => {
    const inCart = cart.find(c => c.produkId === p.id);
    const card   = document.createElement('div');
    card.className = 'product-card' + (p.stok === 0 ? ' out-of-stock' : '') + (inCart ? ' selected' : '');
    card.innerHTML = `
      <div class="pc-name">${p.nama}</div>
      <div class="pc-stock">Stok: ${p.stok === 0 ? 'Habis' : p.stok}</div>
      <div class="pc-price">${fmt(p.hargaJual)}</div>`;
    card.addEventListener('click', () => addToCart(p.id));
    grid.appendChild(card);
  });
}

function addToCart(produkId) {
  const p    = produkList.find(x => x.id === produkId);
  const item = cart.find(c => c.produkId === produkId);
  if (!p || p.stok < 1) return;
  if (item) {
    if (item.qty >= p.stok) { toast('Stok tidak mencukupi!', 'warn'); return; }
    item.qty++;
  } else {
    cart.push({ produkId, qty: 1 });
  }
  renderCart();
  renderProductGrid(document.getElementById('searchTransaksi').value);
}

function changeQty(produkId, delta) {
  const item = cart.find(c => c.produkId === produkId);
  const p    = produkList.find(x => x.id === produkId);
  if (!item || !p) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(c => c.produkId !== produkId);
  } else if (item.qty > p.stok) {
    item.qty = p.stok;
    toast('Stok tidak mencukupi!', 'warn');
  }
  renderCart();
  renderProductGrid(document.getElementById('searchTransaksi').value);
}

function removeFromCart(produkId) {
  cart = cart.filter(c => c.produkId !== produkId);
  renderCart();
  renderProductGrid(document.getElementById('searchTransaksi').value);
}

function renderCart() {
  const cartList = document.getElementById('cartList');
  cartList.innerHTML = '';

  if (cart.length === 0) {
    cartList.innerHTML = `<div class="empty-state" style="padding:32px 20px">
      <div class="empty-icon" style="font-size:1.8rem">🛒</div>
      <p>Keranjang kosong</p>
    </div>`;
    updateCartSummary(0);
    return;
  }

  cart.forEach(item => {
    const p    = produkList.find(x => x.id === item.produkId);
    if (!p) return;
    const sub  = p.hargaJual * item.qty;
    const el   = document.createElement('div');
    el.className = 'cart-item';
    el.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name">${p.nama}</div>
        <div class="cart-item-price">${fmt(p.hargaJual)} × ${item.qty} = ${fmt(sub)}</div>
      </div>
      <div class="cart-qty">
        <button class="qty-btn" onclick="changeQty(${p.id}, -1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${p.id}, 1)">+</button>
      </div>
      <button class="cart-remove" onclick="removeFromCart(${p.id})">✕</button>`;
    cartList.appendChild(el);
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
  const total  = cart.reduce((a, c) => {
    const p = produkList.find(x => x.id === c.produkId);
    return a + (p ? p.hargaJual * c.qty : 0);
  }, 0);
  const bayar  = parseInt(document.getElementById('inputBayar').value) || 0;
  const kemb   = bayar - total;
  const el     = document.getElementById('kembalianVal');
  el.textContent = kemb < 0 ? `−${fmt(Math.abs(kemb))}` : fmt(Math.max(0, kemb));
  el.className   = kemb < 0 ? 'kembalian-negative' : '';
}

document.getElementById('inputBayar').addEventListener('input', updateKembalian);

document.getElementById('btnClearCart').addEventListener('click', async () => {
  if (cart.length === 0) return;
  const ok = await confirm('Kosongkan Keranjang', 'Hapus semua item dari keranjang?', '✕');
  if (!ok) return;
  cart = [];
  renderCart();
  renderProductGrid(document.getElementById('searchTransaksi').value);
});

document.getElementById('searchTransaksi').addEventListener('input', e => {
  renderProductGrid(e.target.value);
});

/* Proses Transaksi */
document.getElementById('btnBayar').addEventListener('click', async () => {
  if (cart.length === 0) { toast('Keranjang kosong!', 'error'); return; }

  const total  = cart.reduce((a, c) => {
    const p = produkList.find(x => x.id === c.produkId);
    return a + (p ? p.hargaJual * c.qty : 0);
  }, 0);
  const bayar  = parseInt(document.getElementById('inputBayar').value) || 0;

  if (bayar > 0 && bayar < total) {
    toast(`Uang kurang! Butuh minimal ${fmt(total)}.`, 'error'); return;
  }

  const pembeli = document.getElementById('namaPembeli').value.trim() || 'Anonim';

  const items = cart.map(c => {
    const p = produkList.find(x => x.id === c.produkId);
    return {
      produkId:   p.id,
      nama:       p.nama,
      qty:        c.qty,
      hargaJual:  p.hargaJual,
      hargaModal: p.hargaModal,
      subtotal:   p.hargaJual * c.qty,
      modal:      p.hargaModal * c.qty,
      untung:     (p.hargaJual - p.hargaModal) * c.qty,
    };
  });

  const totalModal  = items.reduce((a, i) => a + i.modal, 0);
  const totalUntung = items.reduce((a, i) => a + i.untung, 0);
  const kembalian   = bayar > 0 ? bayar - total : 0;

  const entry = {
    tanggal: new Date().toISOString(),
    pembeli, items, total, totalModal, totalUntung, bayar, kembalian,
  };

  setLoading(true);
  try {
    const res = await apiPost({ action: 'add_riwayat', data: entry });
    if (!res.success) { toast('Gagal menyimpan transaksi!', 'error'); return; }

    // Update produk stok from server response
    if (res.produk) produkList = res.produk;
    riwayatList.unshift(res.data);

    cart = [];
    renderCart();
    renderProductGrid(document.getElementById('searchTransaksi').value);
    renderProduk(document.getElementById('searchProduk').value);
    document.getElementById('namaPembeli').value = '';
    document.getElementById('inputBayar').value  = '';
    updateBadge();

    const untungStr = totalUntung > 0 ? ` · Untung: ${fmt(totalUntung)}` : '';
    toast(`Transaksi berhasil${untungStr}`, 'success');
  } catch { toast('Koneksi ke server gagal!', 'error'); }
  finally { setLoading(false); }
});

/* ══════════════════════════════════════════════════════════════
   RIWAYAT
══════════════════════════════════════════════════════════════ */
function renderRiwayat(filter = '') {
  const tbody = document.getElementById('tbodyRiwayat');
  tbody.innerHTML = '';

  let list = [...riwayatList];
  if (filter) list = list.filter(r => r.tanggal.startsWith(filter));

  // Update summary stats
  const tPendapatan = riwayatList.reduce((a, r) => a + r.total, 0);
  const tModal      = riwayatList.reduce((a, r) => a + r.totalModal, 0);
  const tUntung     = riwayatList.reduce((a, r) => a + r.totalUntung, 0);
  document.getElementById('totalPendapatan').textContent = fmt(tPendapatan);
  document.getElementById('totalModal').textContent      = fmt(tModal);
  document.getElementById('totalUntung').textContent     = fmt(tUntung);
  document.getElementById('totalTransaksi').textContent  = riwayatList.length;
  updateBadge();

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>${filter ? 'Tidak ada transaksi pada tanggal ini.' : 'Belum ada transaksi.'}</p>
      </div></td></tr>`;
    return;
  }

  list.forEach((r, i) => {
    const dt     = new Date(r.tanggal);
    const dtStr  = dt.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })
                 + ' · ' + dt.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
    const items  = r.items.map(it => `${it.nama} ×${it.qty}`).join(', ');
    const pfxCls = r.totalUntung > 0 ? 'profit-pos' : r.totalUntung === 0 ? 'profit-zero' : 'profit-neg';
    const pfxSign = r.totalUntung > 0 ? '+' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-muted" style="font-size:.75rem">${i + 1}</td>
      <td style="font-size:.78rem;color:var(--text3);white-space:nowrap">${dtStr}</td>
      <td class="fw-700">${r.pembeli}</td>
      <td style="max-width:180px;font-size:.78rem;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${items}</td>
      <td class="fw-700 text-white">${fmt(r.total)}</td>
      <td class="text-muted">${r.totalModal > 0 ? fmt(r.totalModal) : '<span class="opacity-50">—</span>'}</td>
      <td class="${pfxCls}">${pfxSign}${fmt(r.totalUntung)}</td>
      <td class="text-muted">${r.bayar > 0 ? fmt(r.bayar) : '<span class="opacity-50">—</span>'}</td>
      <td class="text-muted">${r.kembalian > 0 ? fmt(r.kembalian) : '<span class="opacity-50">—</span>'}</td>`;
    tbody.appendChild(tr);
  });
}

document.getElementById('filterTanggal').addEventListener('change', e => {
  renderRiwayat(e.target.value);
});
document.getElementById('btnResetFilter').addEventListener('click', () => {
  document.getElementById('filterTanggal').value = '';
  renderRiwayat();
});

document.getElementById('btnHapusRiwayat').addEventListener('click', async () => {
  if (riwayatList.length === 0) return;
  const ok = await confirm('Hapus Semua Riwayat', 'Semua data transaksi akan dihapus permanen.', '✕');
  if (!ok) return;
  setLoading(true);
  try {
    const res = await apiPost({ action: 'delete_all_riwayat' });
    if (res.success) {
      riwayatList = [];
      renderRiwayat();
      toast('Semua riwayat dihapus.', 'error');
    }
  } catch { toast('Gagal terhubung ke server!', 'error'); }
  finally { setLoading(false); }
});

function updateBadge() {
  document.getElementById('riwayatBadge').textContent = riwayatList.length;
}

/* ══════════════════════════════════════════════════════════════
   INIT – Load data from db.json
══════════════════════════════════════════════════════════════ */
async function init() {
  setLoading(true);
  try {
    const res = await apiGet('all');
    if (res.success) {
      produkList  = res.data.produk  || [];
      riwayatList = res.data.riwayat || [];
    }
  } catch {
    toast('Gagal memuat data dari server!', 'error');
  } finally {
    setLoading(false);
    renderProduk();
    updateBadge();
  }
}

init();
