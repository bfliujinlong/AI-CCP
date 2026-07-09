/**
 * 持久化存储模块：IndexedDB（自动持久化）+ File System Access API（手动导出/导入）
 *
 * 设计：
 * - 同步内存缓存（Map）+ 异步 IndexedDB 持久化，API 兼容 localStorage
 * - 启动时从 IndexedDB 加载全部数据到内存缓存
 * - setItem 立即写缓存 + 异步写 IndexedDB
 * - getItem 同步读缓存（零延迟）
 * - 自动迁移 localStorage 旧数据到 IndexedDB
 * - 支持 File System Access API 导出/导入 JSON 文件
 */

const DB_NAME = 'aicc_platform'
const DB_VERSION = 1
const STORE_NAME = 'kv_store'

// 内存缓存（同步读写，零延迟）
const memoryCache = new Map()
let dbReady = false
let dbInstance = null

// ==================== IndexedDB 初始化 ====================

function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

async function idbGet(key) {
  const db = dbInstance || (dbInstance = await openDB())
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function idbGetAll() {
  const db = dbInstance || (dbInstance = await openDB())
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAllKeys()
    const entries = {}
    req.onsuccess = () => {
      const keys = req.result
      const store = tx.objectStore(STORE_NAME)
      let done = 0
      if (keys.length === 0) { resolve(entries); return }
      keys.forEach(k => {
        const r = store.get(k)
        r.onsuccess = () => {
          entries[k] = r.result
          if (++done === keys.length) resolve(entries)
        }
        r.onerror = () => reject(r.error)
      })
    }
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key, value) {
  const db = dbInstance || (dbInstance = await openDB())
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function idbDelete(key) {
  const db = dbInstance || (dbInstance = await openDB())
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function idbClear() {
  const db = dbInstance || (dbInstance = await openDB())
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ==================== 初始化 + 迁移 ====================

/**
 * 初始化：从 IndexedDB 加载全部数据到内存缓存，并迁移 localStorage 旧数据
 */
export async function initStorage() {
  try {
    // 1. 从 IndexedDB 加载所有数据到内存缓存
    const entries = await idbGetAll()
    for (const [key, value] of Object.entries(entries)) {
      memoryCache.set(key, typeof value === 'string' ? value : JSON.stringify(value))
    }

    // 2. 迁移 localStorage 旧数据（仅在 IndexedDB 中不存在时迁移）
    let migrated = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      // 跳过非 aicc_ 前缀和 token
      if (!key.startsWith('aicc_') && key !== 'token') continue
      if (!memoryCache.has(key)) {
        const val = localStorage.getItem(key)
        memoryCache.set(key, val)
        await idbSet(key, val)
        migrated++
      }
    }

    dbReady = true
    if (migrated > 0) {
      console.log(`[Storage] Migrated ${migrated} items from localStorage to IndexedDB`)
    }
    console.log(`[Storage] Loaded ${memoryCache.size} items from IndexedDB`)
  } catch (e) {
    console.warn('[Storage] IndexedDB init failed, falling back to localStorage:', e)
    // 降级：从 localStorage 加载
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) memoryCache.set(key, localStorage.getItem(key))
    }
  }
}

// ==================== localStorage 兼容 API ====================

export function getItem(key) {
  return memoryCache.get(key) ?? null
}

export function setItem(key, value) {
  const val = typeof value === 'string' ? value : String(value)
  memoryCache.set(key, val)
  // 异步写入 IndexedDB（不阻塞主线程）
  if (dbReady) {
    idbSet(key, val).catch(e => console.warn('[Storage] IDB write failed:', e))
  }
  // 同时写 localStorage 作为降级备份
  try { localStorage.setItem(key, val) } catch {}
}

export function removeItem(key) {
  memoryCache.delete(key)
  if (dbReady) {
    idbDelete(key).catch(e => console.warn('[Storage] IDB delete failed:', e))
  }
  try { localStorage.removeItem(key) } catch {}
}

// ==================== 批量导出/导入 ====================

/**
 * 导出全部数据为 JSON 对象
 */
export function exportAllData() {
  const data = {}
  for (const [key, value] of memoryCache.entries()) {
    if (key.startsWith('aicc_') || key === 'token') {
      try { data[key] = JSON.parse(value) } catch { data[key] = value }
    }
  }
  return {
    _meta: {
      app: 'AICC Platform',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      item_count: Object.keys(data).length - 1,
    },
    ...data,
  }
}

/**
 * 从 JSON 对象导入数据（覆盖现有）
 */
export async function importAllData(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid data format')
  let count = 0
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('_')) continue
    const val = typeof value === 'string' ? value : JSON.stringify(value)
    memoryCache.set(key, val)
    if (dbReady) await idbSet(key, val)
    try { localStorage.setItem(key, val) } catch {}
    count++
  }
  return count
}

/**
 * 清除所有数据
 */
export async function clearAllData() {
  memoryCache.clear()
  if (dbReady) await idbClear()
  // 清除 localStorage 中的 aicc_ 数据
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.startsWith('aicc_') || key === 'token')) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k))
}

/**
 * 获取存储统计信息
 */
export async function getStorageInfo() {
  let dbSize = 0
  const itemCount = memoryCache.size
  // 估算大小
  for (const [, value] of memoryCache.entries()) {
    dbSize += value ? value.length : 0
  }
  // 尝试获取 IndexedDB 估计大小
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate()
      return {
        itemCount,
        cacheSizeKB: Math.round(dbSize / 1024),
        totalUsageKB: Math.round((est.usage || 0) / 1024),
        quotaKB: Math.round((est.quota || 0) / 1024),
      }
    } catch {}
  }
  return { itemCount, cacheSizeKB: Math.round(dbSize / 1024) }
}

// ==================== File System Access API ====================

let fileHandle = null

/**
 * 导出数据到文件（File System Access API，支持选择目录）
 * 如果浏览器不支持，降级为下载文件
 */
export async function exportToFile() {
  const data = exportAllData()
  const json = JSON.stringify(data, null, 2)
  const fileName = `aicc_backup_${new Date().toISOString().slice(0, 10)}.json`

  // 尝试使用 File System Access API
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(json)
      await writable.close()
      fileHandle = handle
      return { method: 'file_system', fileName: handle.name }
    } catch (e) {
      if (e.name === 'AbortError') return null
      // 降级
    }
  }

  // 降级：下载文件
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return { method: 'download', fileName }
}

/**
 * 从文件导入数据（File System Access API 或文件选择）
 */
export async function importFromFile() {
  // 尝试使用 File System Access API
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }],
      })
      const file = await handle.getFile()
      const text = await file.text()
      const data = JSON.parse(text)
      const count = await importAllData(data)
      return { count, fileName: handle.name }
    } catch (e) {
      if (e.name === 'AbortError') return null
      throw e
    }
  }

  // 降级：input file
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) { resolve(null); return }
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        const count = await importAllData(data)
        resolve({ count, fileName: file.name })
      } catch (err) {
        reject(err)
      }
    }
    input.click()
  })
}

// ==================== 便捷方法 ====================

export function getJSON(key, defaultValue = null) {
  const raw = getItem(key)
  if (raw === null) return defaultValue
  try { return JSON.parse(raw) } catch { return defaultValue }
}

export function setJSON(key, value) {
  setItem(key, JSON.stringify(value))
}
