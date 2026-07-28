/**
 * SyncService – Mesin sinkronisasi antrian (sync_queue) ke server.
 * Dipanggil saat browser kembali online atau manual setelah login.
 */

import { db } from '@/utils/db'
import * as ordersApi from '@/api/orders'
import * as shiftsApi from '@/api/shifts'
import * as paymentsApi from '@/api/payments'

const SYNC_TYPE = {
  OPEN_SHIFT: 'open_shift',
  CLOSE_SHIFT: 'close_shift',
  ORDER: 'order',
  EXPENSE: 'expense',
}

const MAX_ATTEMPTS = 3

let isSyncing = false

/**
 * Tambahkan item ke antrian sinkronisasi.
 * @param {string} type - SYNC_TYPE
 * @param {object} payload - Data yang akan dikirim ke server
 * @param {string|null} localRefId - ID lokal entitas terkait (untuk update setelah sync)
 */
export async function enqueue(type, payload, localRefId = null) {
  const raw = JSON.parse(JSON.stringify(payload)) // strip Vue proxy
  await db.sync_queue.add({
    type,
    payload: raw,
    local_ref_id: localRefId,
    status: 'pending',
    created_at: new Date().toISOString(),
    attempts: 0,
  })
}

/**
 * Proses semua antrian yang pending, dari yang terlama.
 * Dipanggil saat online kembali, atau dari App.vue secara periodik.
 */
export async function processQueue() {
  if (isSyncing || !navigator.onLine) return
  isSyncing = true

  try {
    const queue = await db.sync_queue
      .where('status').equals('pending')
      .sortBy('created_at')

    for (const item of queue) {
      if (item.attempts >= MAX_ATTEMPTS) {
        await db.sync_queue.update(item.id, { status: 'failed' })
        continue
      }

      try {
        await processItem(item)
        await db.sync_queue.update(item.id, { status: 'synced' })
      } catch (err) {
        const attempts = item.attempts + 1
        const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'
        await db.sync_queue.update(item.id, { attempts, status })
        // Jika network error, hentikan loop — tidak ada gunanya lanjut
        if (!navigator.onLine || err.message === 'Network Error') break
      }
    }
  } finally {
    isSyncing = false
  }
}

/**
 * Proses satu item dari antrian berdasarkan tipe-nya.
 */
async function processItem(item) {
  switch (item.type) {
    case SYNC_TYPE.OPEN_SHIFT:
      await syncOpenShift(item)
      break
    case SYNC_TYPE.CLOSE_SHIFT:
      await syncCloseShift(item)
      break
    case SYNC_TYPE.ORDER:
      await syncOrder(item)
      break
    case SYNC_TYPE.EXPENSE:
      await syncExpense(item)
      break
    default:
      console.warn('[SyncService] Unknown type:', item.type)
  }
}

async function syncOpenShift(item) {
  const result = await shiftsApi.openShift(item.payload)
  // Perbarui shift lokal dengan server_id yang asli
  if (item.local_ref_id && result?.id) {
    await db.shifts.where('local_id').equals(item.local_ref_id).modify({
      server_id: result.id,
      sync_status: 'synced',
    })
  }
}

async function syncCloseShift(item) {
  await shiftsApi.closeShift(item.payload)
  if (item.local_ref_id) {
    await db.shifts.where('local_id').equals(item.local_ref_id).modify({
      sync_status: 'synced',
    })
  }
}

async function syncOrder(item) {
  const { orderPayload, methodData } = item.payload
  const order = await ordersApi.createOrder(orderPayload)
  if (order?.id) {
    await paymentsApi.createPayment({
      order_id: order.id,
      payment_method: methodData.payment_method,
      amount: methodData.amount,
      reference_number: methodData.reference_number ?? null,
    })
    // Tandai offline order sebagai synced
    if (item.local_ref_id) {
      await db.offline_orders.update(Number(item.local_ref_id), { sync_status: 'synced', server_order_id: order.id })
    }
  }
}

async function syncExpense(item) {
  await shiftsApi.addExpense(item.payload)
  if (item.local_ref_id) {
    await db.expenses.where('local_id').equals(item.local_ref_id).modify({ sync_status: 'synced' })
  }
}

/**
 * Jumlah item yang masih menunggu sinkronisasi (untuk UI indikator).
 */
export async function getPendingCount() {
  return db.sync_queue.where('status').equals('pending').count()
}

export { SYNC_TYPE }
