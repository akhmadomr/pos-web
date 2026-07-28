import Dexie from 'dexie'

export const db = new Dexie('KopirexPOSDatabase')

// v1–v2: skema lama (legacy), tetap ada agar tidak error saat upgrade
db.version(1).stores({
  products: 'id, name, category_id, is_active',
  categories: 'id, name',
  offline_orders: '++id, sync_status, created_at, payload'
})

db.version(2).stores({
  products: 'id, name, category_id, is_active',
  categories: 'id, name',
  offline_orders: '++id, sync_status, created_at'
})

// v3: skema penuh untuk Full Offline POS
db.version(3).stores({
  // Produk & kategori (cache 24 jam)
  products: 'id, name, category_id, is_active, cached_at',
  categories: 'id, name, cached_at',
  
  // Pesanan (online & offline)
  offline_orders: '++id, sync_status, created_at, shift_local_id',
  
  // Shift (support offline open/close)
  shifts: 'local_id, server_id, status, opened_at, closed_at, outlet_id, sync_status',
  
  // Pengeluaran shift
  expenses: 'local_id, shift_local_id, sync_status, created_at',
  
  // Antrian sinkronisasi universal
  sync_queue: '++id, type, status, created_at, attempts',
  
  // Pengaturan sistem
  settings: 'key',
})
