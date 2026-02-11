import type { ThemeConfig } from "antd";
import { theme as antdTheme } from "antd";

export type ThemeMode = "light" | "dark";

export type AntdNumericTokenOverrides = {
  borderRadius?: number;
  fontSize?: number;
};

export function getAntdThemeConfig(
  mode: ThemeMode,
  numericOverrides: AntdNumericTokenOverrides = {},
): ThemeConfig {
  const algorithm =
    mode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;

  return {
    algorithm,
    token: {
      colorPrimary: "var(--ds-color-primary)",
      colorInfo: "var(--ds-color-info)",
      colorSuccess: "var(--ds-color-success)",
      colorWarning: "var(--ds-color-warning)",
      colorError: "var(--ds-color-error)",
      colorTextBase: "var(--ds-color-text)",
      colorBgBase: "var(--ds-color-bg)",
      colorBgContainer: "var(--ds-color-surface)",
      colorBorder: "var(--ds-color-border)",
      fontFamily: "var(--ds-font-family)",
      borderRadius: numericOverrides.borderRadius,
      fontSize: numericOverrides.fontSize,
      motionEaseInOut: "var(--ds-motion-ease)",
      motionDurationFast: "var(--ds-motion-duration-fast)",
      motionDurationMid: "var(--ds-motion-duration-normal)",
      motionDurationSlow: "var(--ds-motion-duration-slow)",
    },
    components: {
      Button: {
        borderRadius: numericOverrides.borderRadius,
      },
      Card: {
        borderRadiusLG: numericOverrides.borderRadius,
      },
    },
  };
}
