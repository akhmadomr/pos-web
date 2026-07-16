import Dexie from 'dexie'

export const db = new Dexie('KopirexPOSDatabase')

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
