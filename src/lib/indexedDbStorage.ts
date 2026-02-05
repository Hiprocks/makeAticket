import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'jbc-storage';
const STORE_NAME = 'keyval';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return dbPromise;
}

async function withStore<T>(
    type: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, type);
        const store = tx.objectStore(STORE_NAME);
        const request = callback(store);

        tx.oncomplete = () => resolve(request.result as T);
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
        request.onerror = () => reject(request.error);
    });
}

export const indexedDbStorage: StateStorage = {
    getItem: async (name) => {
        const value = await withStore<string | null>('readonly', (store) => store.get(name));
        return value ?? null;
    },
    setItem: async (name, value) => {
        await withStore('readwrite', (store) => store.put(value, name));
    },
    removeItem: async (name) => {
        await withStore('readwrite', (store) => store.delete(name));
    },
};

export function getPersistStorage(): StateStorage {
    if (typeof window === 'undefined') {
        return {
            getItem: async () => null,
            setItem: async () => {},
            removeItem: async () => {},
        };
    }
    if (!('indexedDB' in window)) return window.localStorage;
    return indexedDbStorage;
}
