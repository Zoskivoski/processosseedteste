import { useEffect } from "react";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";

export type ThemePreference = "light" | "dark";

const STORAGE_KEY = "processseed-theme";

function applyTheme(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);
}

export function useThemePreference() {
  const [theme, setTheme] = useLocalStorageState<ThemePreference>(STORAGE_KEY, "light");

  useEffect(() => {
    const normalizedTheme = theme === "dark" ? "dark" : "light";
    applyTheme(normalizedTheme);
  }, [theme]);

  return {
    theme: theme === "dark" ? "dark" : "light",
    isDark: theme === "dark",
    setTheme,
    toggleTheme: () => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark")),
  };
}
