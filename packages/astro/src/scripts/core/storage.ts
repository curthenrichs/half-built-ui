/* The localStorage read/validate/write codec (step 10), one home for
   the pattern henry-loose.ts and stasis-state.ts each carried: parse is
   the validator (junk parses to null and read() then removes the key),
   and every storage touch sits inside try/catch so private mode or
   disabled storage degrades to in-page-only state, never a thrown
   error. */
export interface StoredJson<T> {
  read(): T | null;
  write(v: T): void;
  clear(): void;
}

export function storedJson<T>(
  key: string,
  parse: (raw: string | null) => T | null,
  serialize: (v: T) => string = JSON.stringify,
): StoredJson<T> {
  return {
    read(): T | null {
      try {
        const raw = localStorage.getItem(key);
        const v = parse(raw);
        if (v === null && raw !== null) localStorage.removeItem(key);
        return v;
      } catch {
        return null;
      }
    },
    write(v: T): void {
      try {
        localStorage.setItem(key, serialize(v));
      } catch {
        /* State lives for this page only. */
      }
    },
    clear(): void {
      try {
        localStorage.removeItem(key);
      } catch {
        /* Nothing to clear. */
      }
    },
  };
}
