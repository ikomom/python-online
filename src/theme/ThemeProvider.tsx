import React, { useEffect, useMemo, useState } from "react";
import { ConfigProvider } from "antd";
import type { ThemeConfig } from "antd";
import { getAntdThemeConfig } from "./antd.theme.config";
import type { ThemeMode } from "./antd.theme.config";

function readNumberFromCssVar(varName: string, fallback: number): number {
  const raw = getComputedStyle(document.body).getPropertyValue(varName).trim();
  const num = Number.parseFloat(raw);
  return Number.isFinite(num) ? num : fallback;
}

function useAntdThemeConfig(mode: ThemeMode): ThemeConfig {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onChange = () => setVersion((v) => v + 1);
    window.addEventListener("ds-token-change", onChange as EventListener);
    return () =>
      window.removeEventListener("ds-token-change", onChange as EventListener);
  }, []);

  return useMemo(() => {
    void version;
    const borderRadius = readNumberFromCssVar("--ds-radius-base", 10);
    const fontSize = readNumberFromCssVar("--ds-font-size-base", 14);
    return getAntdThemeConfig(mode, { borderRadius, fontSize });
  }, [mode, version]);
}

export function ThemeProvider(props: {
  mode: ThemeMode;
  children: React.ReactNode;
}) {
  const theme = useAntdThemeConfig(props.mode);
  return <ConfigProvider theme={theme}>{props.children}</ConfigProvider>;
}
