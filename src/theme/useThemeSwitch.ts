import { useCallback, useEffect, useMemo, useState } from "react";
import type { ThemeMode } from "./antd.theme.config";

const STORAGE_KEY = "ds-theme-mode";

function getInitialMode(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}

export function useThemeSwitch() {
  const [mode, setMode] = useState<ThemeMode>(() => getInitialMode());

  useEffect(() => {
    document.body.dataset.theme = mode;
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const setCssToken = useCallback((tokenName: string, value: string) => {
    document.body.style.setProperty(`--ds-${tokenName}`, value);
    window.dispatchEvent(new CustomEvent("ds-token-change"));
  }, []);

  const api = useMemo(
    () => ({
      mode,
      setMode,
      toggle,
      setCssToken,
    }),
    [mode, setMode, toggle, setCssToken],
  );

  return api;
}
