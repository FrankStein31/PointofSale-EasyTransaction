<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$DB_FILE = __DIR__ . '/db.json';

function readDB($file) {
    if (!file_exists($file)) {
        $default = ['kategori' => [], 'pelanggan' => [], 'produk' => [], 'riwayat' => []];
        file_put_contents($file, json_encode($default, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        return $default;
    }
    $content = file_get_contents($file);
    $data = json_decode($content, true);
    if (!$data) $data = [];
    if (!isset($data['kategori']))  $data['kategori']  = [];
    if (!isset($data['pelanggan'])) $data['pelanggan'] = [];
    if (!isset($data['produk']))    $data['produk']    = [];
    if (!isset($data['riwayat']))   $data['riwayat']   = [];
    return $data;
}

function writeDB($file, $data) {
    return file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function nextId($list) {
    if (empty($list)) return 1;
    return max(array_column($list, 'id')) + 1;
}

// ── GET ──────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $type = $_GET['type'] ?? 'all';
    $db   = readDB($DB_FILE);

    if ($type === 'produk')    respond(['success' => true, 'data' => $db['produk']]);
    if ($type === 'riwayat')   respond(['success' => true, 'data' => $db['riwayat']]);
    if ($type === 'kategori')  respond(['success' => true, 'data' => $db['kategori']]);
    if ($type === 'pelanggan') respond(['success' => true, 'data' => $db['pelanggan']]);
    respond(['success' => true, 'data' => $db]);
}

// ── POST ─────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw    = file_get_contents('php://input');
    $body   = json_decode($raw, true);
    $action = $body['action'] ?? '';
    $db     = readDB($DB_FILE);

    // ── Produk: Add ─────────────────────────────────────
    if ($action === 'add_produk') {
        $d = $body['data'];
        $item = [
            'id'         => nextId($db['produk']),
            'nama'       => trim($d['nama'] ?? ''),
            'kategori'   => trim($d['kategori'] ?? ''),
            'stok'       => (int)($d['stok'] ?? 0),
            'hargaModal' => (int)($d['hargaModal'] ?? 0),
            'hargaJual'  => (int)($d['hargaJual'] ?? 0),
        ];
        if ($item['nama'] === '') respond(['success' => false, 'message' => 'Nama tidak boleh kosong'], 400);

        // Auto-add kategori if new
        if ($item['kategori'] !== '' && !in_array($item['kategori'], $db['kategori'])) {
            $db['kategori'][] = $item['kategori'];
        }

        $db['produk'][] = $item;
        writeDB($DB_FILE, $db);
        respond(['success' => true, 'data' => $item, 'kategori' => $db['kategori']]);
    }

    // ── Produk: Update ──────────────────────────────────
    if ($action === 'update_produk') {
        $d  = $body['data'];
        $id = (int)($d['id'] ?? 0);
        $idx = null;
        foreach ($db['produk'] as $i => $p) { if ($p['id'] === $id) { $idx = $i; break; } }
        if ($idx === null) respond(['success' => false, 'message' => 'Produk tidak ditemukan'], 404);

        $db['produk'][$idx] = array_merge($db['produk'][$idx], [
            'nama'       => trim($d['nama'] ?? $db['produk'][$idx]['nama']),
            'kategori'   => trim($d['kategori'] ?? $db['produk'][$idx]['kategori'] ?? ''),
            'stok'       => (int)($d['stok'] ?? $db['produk'][$idx]['stok']),
            'hargaModal' => (int)($d['hargaModal'] ?? $db['produk'][$idx]['hargaModal']),
            'hargaJual'  => (int)($d['hargaJual'] ?? $db['produk'][$idx]['hargaJual']),
        ]);

        // Auto-add kategori if new
        $kat = $db['produk'][$idx]['kategori'];
        if ($kat !== '' && !in_array($kat, $db['kategori'])) {
            $db['kategori'][] = $kat;
        }

        writeDB($DB_FILE, $db);
        respond(['success' => true, 'data' => $db['produk'][$idx], 'kategori' => $db['kategori']]);
    }

    // ── Produk: Delete ──────────────────────────────────
    if ($action === 'delete_produk') {
        $id = (int)($body['id'] ?? 0);
        $idx = null;
        foreach ($db['produk'] as $i => $p) { if ($p['id'] === $id) { $idx = $i; break; } }
        if ($idx === null) respond(['success' => false, 'message' => 'Produk tidak ditemukan'], 404);
        $nama = $db['produk'][$idx]['nama'];
        array_splice($db['produk'], $idx, 1);
        writeDB($DB_FILE, $db);
        respond(['success' => true, 'message' => "Produk \"$nama\" dihapus"]);
    }

    // ── Kategori: Add ───────────────────────────────────
    if ($action === 'add_kategori') {
        $nama = trim($body['nama'] ?? '');
        if ($nama === '') respond(['success' => false, 'message' => 'Nama kategori kosong'], 400);
        if (!in_array($nama, $db['kategori'])) {
            $db['kategori'][] = $nama;
            writeDB($DB_FILE, $db);
        }
        respond(['success' => true, 'data' => $db['kategori']]);
    }

    // ── Pelanggan: Add (auto from transaksi) ────────────
    if ($action === 'add_pelanggan') {
        $nama = trim($body['nama'] ?? '');
        if ($nama !== '' && $nama !== 'Anonim' && !in_array($nama, $db['pelanggan'])) {
            $db['pelanggan'][] = $nama;
            writeDB($DB_FILE, $db);
        }
        respond(['success' => true, 'data' => $db['pelanggan']]);
    }

    // ── Riwayat: Add ────────────────────────────────────
    if ($action === 'add_riwayat') {
        $entry = $body['data'];
        $entry['id'] = nextId($db['riwayat']);

        // Reduce stock
        if (!empty($entry['items'])) {
            foreach ($entry['items'] as $item) {
                $pid = (int)($item['produkId'] ?? 0);
                $qty = (int)($item['qty'] ?? 0);
                foreach ($db['produk'] as $i => $p) {
                    if ($p['id'] === $pid) {
                        $db['produk'][$i]['stok'] = max(0, $db['produk'][$i]['stok'] - $qty);
                        break;
                    }
                }
            }
        }

        // Save pelanggan name
        $pembeli = trim($entry['pembeli'] ?? '');
        if ($pembeli !== '' && $pembeli !== 'Anonim' && !in_array($pembeli, $db['pelanggan'])) {
            $db['pelanggan'][] = $pembeli;
        }

        array_unshift($db['riwayat'], $entry);
        writeDB($DB_FILE, $db);
        respond(['success' => true, 'data' => $entry, 'produk' => $db['produk'], 'pelanggan' => $db['pelanggan']]);
    }

    // ── Riwayat: Delete all ─────────────────────────────
    if ($action === 'delete_all_riwayat') {
        $db['riwayat'] = [];
        writeDB($DB_FILE, $db);
        respond(['success' => true, 'message' => 'Semua riwayat dihapus']);
    }

    respond(['success' => false, 'message' => 'Action tidak dikenal'], 400);
}

respond(['success' => false, 'message' => 'Method tidak diizinkan'], 405);
