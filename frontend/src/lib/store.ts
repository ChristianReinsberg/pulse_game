export function createStore<T>(key: string, parse: (raw: string | null) => T, empty: () => T) {
  let cache: T | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const load = (): T => {
    try {
      return parse(localStorage.getItem(key));
    } catch {
      return empty();
    }
  };

  return {
    getSnapshot: (): T => (cache ??= load()),

    subscribe(onChange: () => void): () => void {
      listeners.add(onChange);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key || e.key === null) {
          cache = null;
          onChange();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onStorage);
      };
    },

    set(next: T): void {
      cache = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      notify();
    },

    reset(): void {
      cache = empty();
      try {
        localStorage.removeItem(key);
      } catch {}
      notify();
    },
  };
}
