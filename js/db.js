// Единое хранилище приложения (IndexedDB). Все экраны работают только через этот модуль.
const DB_NAME = 'money-tracker';
const DB_VERSION = 1;

export const STORES = {
  operations: 'operations',   // доходы, расходы, переводы
  debts: 'debts',             // долги (выданные и полученные)
  debtReturns: 'debtReturns', // возвраты по долгам
  limits: 'limits',           // лимиты по категориям и месячный бюджет
  settings: 'settings',       // настройки (ключ → значение)
};

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.operations)) {
        const s = db.createObjectStore(STORES.operations, { keyPath: 'id' });
        s.createIndex('ts', 'ts');
        s.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains(STORES.debts)) {
        const s = db.createObjectStore(STORES.debts, { keyPath: 'id' });
        s.createIndex('ts', 'ts');
        s.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains(STORES.debtReturns)) {
        const s = db.createObjectStore(STORES.debtReturns, { keyPath: 'id' });
        s.createIndex('debtId', 'debtId');
        s.createIndex('ts', 'ts');
      }
      if (!db.objectStoreNames.contains(STORES.limits)) {
        db.createObjectStore(STORES.limits, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); location.reload(); };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('База данных занята другой вкладкой'));
  });
  // Просим браузер не удалять данные при нехватке места
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (_) {}
  return dbPromise;
}

function run(store, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const os = tx.objectStore(store);
    let result;
    const r = fn(os);
    if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export function uid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(store) { listeners.forEach(fn => { try { fn(store); } catch (e) { console.error(e); } }); }

export const db = {
  get: (store, id) => run(store, 'readonly', os => os.get(id)),
  all: (store) => run(store, 'readonly', os => os.getAll()),
  range: (store, index, from, to) =>
    run(store, 'readonly', os => os.index(index).getAll(IDBKeyRange.bound(from, to, false, true))),
  async put(store, obj) {
    const now = Date.now();
    const rec = { ...obj, id: obj.id || uid(), createdAt: obj.createdAt || now, updatedAt: now };
    await run(store, 'readwrite', os => os.put(rec));
    emit(store);
    return rec;
  },
  async del(store, id) {
    await run(store, 'readwrite', os => os.delete(id));
    emit(store);
  },
};

// Настройки с значениями по умолчанию
export const DEFAULT_SETTINGS = {
  currency: 'TRY',
  dayStartMinutes: 0, // финансовый день начинается в 00:00
  monthlyBudget: 0,
  lockEnabled: false,
  lockAfter: 60, // секунд до блокировки: 0, 60, 300
  passHash: null,
  passSalt: null,
  faceIdCred: null,
};
export async function getSetting(key) {
  const r = await db.get(STORES.settings, key);
  return r ? r.value : DEFAULT_SETTINGS[key];
}
export async function setSetting(key, value) {
  await run(STORES.settings, 'readwrite', os => os.put({ key, value }));
  emit(STORES.settings);
}
