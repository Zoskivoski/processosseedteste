import { useEffect, useState } from "react";

function readStoredValue<T>(key: string, initialValue: T): T {
  if (typeof window === "undefined") return initialValue;

  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as T) : initialValue;
  } catch {
    return initialValue;
  }
}

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => readStoredValue(key, initialValue));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore storage failures and keep the in-memory state.
    }
  }, [key, state]);

  return [state, setState] as const;
}
