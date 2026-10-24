const DB_NAME = "fitsync-db";
const DB_VERSION = 4;

export const STORES = {
  profiles: "profiles",
  workoutPlans: "workout_plans",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function planRecordId(profileId: string, weekStart: string): string {
  return `${profileId}:${weekStart}`;
}

export function resetDbConnection(): void {
  dbPromise = null;
}

function ensureStores(db: IDBDatabase, transaction: IDBTransaction | null): void {
  if (!db.objectStoreNames.contains(STORES.profiles)) {
    db.createObjectStore(STORES.profiles, { keyPath: "id" });
  }

  if (!db.objectStoreNames.contains(STORES.workoutPlans)) {
    const store = db.createObjectStore(STORES.workoutPlans, { keyPath: "id" });
    store.createIndex("profileId", "profileId", { unique: false });
    store.createIndex("byProfileWeek", ["profileId", "weekStart"], {
      unique: true,
    });
    return;
  }

  if (!transaction) return;
  const store = transaction.objectStore(STORES.workoutPlans);

  // Pre–multi-profile schema had a unique `weekStart` index — breaks multiple people.
  if (store.indexNames.contains("weekStart")) {
    store.deleteIndex("weekStart");
  }

  if (!store.indexNames.contains("profileId")) {
    store.createIndex("profileId", "profileId", { unique: false });
  }
  if (!store.indexNames.contains("byProfileWeek")) {
    store.createIndex("byProfileWeek", ["profileId", "weekStart"], {
      unique: true,
    });
  }
}

const OPEN_DB_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = withTimeout(
    new Promise<IDBDatabase>((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB is not available in this browser."));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      const fail = (err: unknown) => {
        resetDbConnection();
        reject(err instanceof Error ? err : new Error("IndexedDB open failed"));
      };

      request.onerror = () => fail(request.error);
      request.onblocked = () => {
        fail(
          new Error(
            "Database upgrade blocked — close other FitSync tabs and refresh.",
          ),
        );
      };

      request.onupgradeneeded = () => {
        try {
          const db = request.result;
          ensureStores(db, request.transaction);
        } catch (err) {
          fail(err);
        }
      };

      request.onsuccess = () => resolve(request.result);
    }),
    OPEN_DB_TIMEOUT_MS,
    "Database open timed out — close other FitSync tabs and refresh.",
  );

  return dbPromise;
}

export function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(storeName)) {
          reject(new Error(`IndexedDB store missing: ${storeName}`));
          return;
        }

        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        let result: T;

        const request = fn(store);
        request.onsuccess = () => {
          result = request.result as T;
        };
        request.onerror = () =>
          reject(request.error ?? new Error("IndexedDB request failed"));

        transaction.onerror = () =>
          reject(transaction.error ?? new Error("IndexedDB transaction failed"));

        transaction.onabort = () =>
          reject(transaction.error ?? new Error("IndexedDB transaction aborted"));

        transaction.oncomplete = () => resolve(result);
      }),
  );
}

/** Run multiple writes in one transaction without returning a single request. */
export function txWrite(
  storeName: string,
  fn: (store: IDBObjectStore) => void,
): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(storeName)) {
          reject(new Error(`IndexedDB store missing: ${storeName}`));
          return;
        }
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        try {
          fn(store);
        } catch (err) {
          reject(err);
          return;
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(transaction.error ?? new Error("IndexedDB transaction failed"));
        transaction.onabort = () =>
          reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
      }),
  );
}
