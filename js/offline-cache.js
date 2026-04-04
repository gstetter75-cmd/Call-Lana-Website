// IndexedDB offline cache for critical dashboard data
// Depends on: supabase-init.js, auth.js
const OfflineCache = {
  DB_NAME: 'clana-offline',
  DB_VERSION: 1,
  _db: null,

  async init() {
    if (!('indexedDB' in window)) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('calls')) {
          db.createObjectStore('calls', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('appointments')) {
          db.createObjectStore('appointments', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      request.onsuccess = (e) => {
        this._db = e.target.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },

  async _put(storeName, data) {
    if (!this._db) return;
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      if (Array.isArray(data)) {
        data.forEach(item => store.put(item));
      } else {
        store.put(data);
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  async _getAll(storeName) {
    if (!this._db) return [];
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async _clear(storeName) {
    if (!this._db) return;
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  // Cache recent calls (last 50)
  async cacheCalls(calls) {
    await this._clear('calls');
    await this._put('calls', calls.slice(0, 50));
    await this._put('meta', { key: 'calls_cached_at', value: Date.now() });
  },

  async getCachedCalls() {
    return this._getAll('calls');
  },

  // Cache upcoming appointments (next 7 days)
  async cacheAppointments(appointments) {
    await this._clear('appointments');
    await this._put('appointments', appointments);
    await this._put('meta', { key: 'appointments_cached_at', value: Date.now() });
  },

  async getCachedAppointments() {
    return this._getAll('appointments');
  },

  // Cache user profile
  async cacheProfile(profile) {
    await this._put('profile', profile);
  },

  async getCachedProfile() {
    const all = await this._getAll('profile');
    return all[0] || null;
  },

  // Check cache freshness (max 5 minutes)
  async isFresh(key, maxAgeMs = 300000) {
    try {
      const meta = await new Promise((resolve) => {
        const tx = this._db.transaction('meta', 'readonly');
        const request = tx.objectStore('meta').get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });
      if (!meta) return false;
      return (Date.now() - meta.value) < maxAgeMs;
    } catch {
      return false;
    }
  },

  // Sync pending operations when back online
  async syncPending() {
    // Future: process queued operations created while offline
    if (typeof Logger !== 'undefined') Logger.info('OfflineCache', 'Sync pending operations');
  }
};

window.OfflineCache = OfflineCache;
