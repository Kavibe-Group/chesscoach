// Safe storage wrapper for browser localStorage and Node/test environments

class MemoryStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

class SafeStorage {
  durable = false;
  private fallback = new MemoryStorage();

  getItem(key: string): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch {
      // Falha defensiva para modo anônimo
    }
    return this.fallback.getItem(key);
  }

  setItem(key: string, value: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        this.durable = localStorage.getItem(key) === value;
        return;
      }
    } catch {
      // Falha defensiva para modo anônimo / quota
    }
    this.durable = false;
    this.fallback.setItem(key, value);
  }

  removeItem(key: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
    } catch {
      // Fallback
    }
    this.fallback.removeItem(key);
  }

  clear(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
    } catch {
      // Fallback
    }
    this.fallback.clear();
  }
}

const safeStorageInstance = new SafeStorage();

export function getStorage(): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
} {
  return safeStorageInstance;
}

/** True only after a write was read back from browser storage. */
export function isStorageDurable(): boolean { return safeStorageInstance.durable; }

/** Node tests may use memory; a browser that denies storage must report failure. */
export function storageWriteSucceeded(): boolean {
  try { return typeof localStorage === 'undefined' || isStorageDurable(); }
  catch { return false; }
}
