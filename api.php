<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$DB_FILE = __DIR__ . '/db.json';

function readDB($file) {
    if (!file_exists($file)) {
        $default = ['produk' => [], 'riwayat' => []];
        file_put_contents($file, json_encode($default, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        return $default;
    }
    $content = file_get_contents($file);
    return json_decode($content, true) ?: ['produk' => [], 'riwayat' => []];
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

// ── GET requests ─────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $type = $_GET['type'] ?? 'all';
    $db   = readDB($DB_FILE);

    if ($type === 'produk') {
        respond(['success' => true, 'data' => $db['produk']]);
    } elseif ($type === 'riwayat') {
        respond(['success' => true, 'data' => $db['riwayat']]);
    } else {
        respond(['success' => true, 'data' => $db]);
    }
}

// ── POST requests ─────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw    = file_get_contents('php://input');
    $body   = json_decode($raw, true);
    $action = $body['action'] ?? '';
    $db     = readDB($DB_FILE);

    // ── Produk: Add ──────────────────────────────────────
    if ($action === 'add_produk') {
        $d = $body['data'];
        $item = [
            'id'         => nextId($db['produk']),
            'nama'       => trim($d['nama'] ?? ''),
            'stok'       => (int)($d['stok'] ?? 0),
            'hargaModal' => (int)($d['hargaModal'] ?? 0),
            'hargaJual'  => (int)($d['hargaJual'] ?? 0),
        ];
        if ($item['nama'] === '') respond(['success' => false, 'message' => 'Nama tidak boleh kosong'], 400);
        $db['produk'][] = $item;
        writeDB($DB_FILE, $db);
        respond(['success' => true, 'data' => $item]);
    }

    // ── Produk: Update ───────────────────────────────────
    if ($action === 'update_produk') {
        $d   = $body['data'];
        $id  = (int)($d['id'] ?? 0);
        $idx = array_search($id, array_column($db['produk'], 'id'));
        if ($idx === false) respond(['success' => false, 'message' => 'Produk tidak ditemukan'], 404);
        $db['produk'][$idx] = array_merge($db['produk'][$idx], [
            'nama'       => trim($d['nama'] ?? $db['produk'][$idx]['nama']),
            'stok'       => (int)($d['stok'] ?? $db['produk'][$idx]['stok']),
            'hargaModal' => (int)($d['hargaModal'] ?? $db['produk'][$idx]['hargaModal']),
            'hargaJual'  => (int)($d['hargaJual'] ?? $db['produk'][$idx]['hargaJual']),
        ]);
        writeDB($DB_FILE, $db);
        respond(['success' => true, 'data' => $db['produk'][$idx]]);
    }

    // ── Produk: Delete ───────────────────────────────────
    if ($action === 'delete_produk') {
        $id  = (int)($body['id'] ?? 0);
        $idx = array_search($id, array_column($db['produk'], 'id'));
        if ($idx === false) respond(['success' => false, 'message' => 'Produk tidak ditemukan'], 404);
        $nama = $db['produk'][$idx]['nama'];
        array_splice($db['produk'], $idx, 1);
        writeDB($DB_FILE, $db);
        respond(['success' => true, 'message' => "Produk \"$nama\" dihapus"]);
    }

    // ── Riwayat: Add (after transaction) ─────────────────
    if ($action === 'add_riwayat') {
        $entry = $body['data'];
        $entry['id'] = nextId($db['riwayat']);

        // Reduce stock for each item
        if (!empty($entry['items'])) {
            foreach ($entry['items'] as $item) {
                $pid = (int)($item['produkId'] ?? 0);
                $qty = (int)($item['qty'] ?? 0);
                $idx = array_search($pid, array_column($db['produk'], 'id'));
                if ($idx !== false) {
                    $db['produk'][$idx]['stok'] = max(0, $db['produk'][$idx]['stok'] - $qty);
                }
            }
        }

        array_unshift($db['riwayat'], $entry);
        writeDB($DB_FILE, $db);
        respond(['success' => true, 'data' => $entry, 'produk' => $db['produk']]);
    }

    // ── Riwayat: Delete all ───────────────────────────────
    if ($action === 'delete_all_riwayat') {
        $db['riwayat'] = [];
        writeDB($DB_FILE, $db);
        respond(['success' => true, 'message' => 'Semua riwayat dihapus']);
    }

    respond(['success' => false, 'message' => 'Action tidak dikenal'], 400);
}

respond(['success' => false, 'message' => 'Method tidak diizinkan'], 405);
