"use client";

const DB_NAME = "ttl-uploads";
const STORE_NAME = "hero-upload";
const DB_VERSION = 1;
const KEY = "latest";

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB error"));
  });

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB error"));
  });

const transactionDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB tx error"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB tx aborted"));
  });

export const saveHeroUpload = async (file: File) => {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  await requestToPromise(store.put(file, KEY));
  await transactionDone(tx);
  db.close();
};

export const loadHeroUpload = async (): Promise<File | null> => {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const result = await requestToPromise(store.get(KEY));
    await transactionDone(tx);
    db.close();
    return result instanceof File ? result : null;
  } catch {
    return null;
  }
};

export const clearHeroUpload = async () => {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  await requestToPromise(store.delete(KEY));
  await transactionDone(tx);
  db.close();
};
