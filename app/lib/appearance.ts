import type { CSSProperties } from "react";
import { appearanceSchema, type FormSpec } from "./definitions";

export type Appearance = {
  theme: "light" | "dark";
  accent: "neutral" | "blue" | "violet" | "green" | "orange" | "rose";
  radius: "none" | "md" | "xl";
  width: "sm" | "md" | "lg";
  submitWidth: "auto" | "full";
};

export const defaultAppearance: Appearance = {
  theme: "dark",
  accent: "neutral",
  radius: "md",
  width: "md",
  submitWidth: "auto",
};

const surfaces = {
  light: {
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(0.145 0 0)",
    "--card": "oklch(1 0 0)",
    "--card-foreground": "oklch(0.145 0 0)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(0.145 0 0)",
    "--secondary": "oklch(0.97 0 0)",
    "--secondary-foreground": "oklch(0.205 0 0)",
    "--muted": "oklch(0.97 0 0)",
    "--muted-foreground": "oklch(0.556 0 0)",
    "--accent": "oklch(0.97 0 0)",
    "--accent-foreground": "oklch(0.205 0 0)",
    "--border": "oklch(0.922 0 0)",
    "--input": "oklch(0.922 0 0)",
  },
  dark: {
    "--background": "oklch(0.145 0 0)",
    "--foreground": "oklch(0.985 0 0)",
    "--card": "oklch(0.205 0 0)",
    "--card-foreground": "oklch(0.985 0 0)",
    "--popover": "oklch(0.205 0 0)",
    "--popover-foreground": "oklch(0.985 0 0)",
    "--secondary": "oklch(0.269 0 0)",
    "--secondary-foreground": "oklch(0.985 0 0)",
    "--muted": "oklch(0.269 0 0)",
    "--muted-foreground": "oklch(0.708 0 0)",
    "--accent": "oklch(0.269 0 0)",
    "--accent-foreground": "oklch(0.985 0 0)",
    "--border": "oklch(1 0 0 / 10%)",
    "--input": "oklch(1 0 0 / 15%)",
  },
} as const;

const accents = {
  neutral: {
    light: { "--primary": "oklch(0.205 0 0)", "--primary-foreground": "oklch(0.985 0 0)", "--ring": "oklch(0.708 0 0)" },
    dark: { "--primary": "oklch(0.922 0 0)", "--primary-foreground": "oklch(0.205 0 0)", "--ring": "oklch(0.556 0 0)" },
  },
  blue: {
    light: { "--primary": "oklch(0.488 0.243 264.376)", "--primary-foreground": "oklch(0.985 0 0)", "--ring": "oklch(0.488 0.243 264.376)" },
    dark: { "--primary": "oklch(0.623 0.214 259.815)", "--primary-foreground": "oklch(0.145 0 0)", "--ring": "oklch(0.623 0.214 259.815)" },
  },
  violet: {
    light: { "--primary": "oklch(0.541 0.281 293.009)", "--primary-foreground": "oklch(0.985 0 0)", "--ring": "oklch(0.541 0.281 293.009)" },
    dark: { "--primary": "oklch(0.702 0.183 293.541)", "--primary-foreground": "oklch(0.145 0 0)", "--ring": "oklch(0.702 0.183 293.541)" },
  },
  green: {
    light: { "--primary": "oklch(0.527 0.154 150.069)", "--primary-foreground": "oklch(0.985 0 0)", "--ring": "oklch(0.527 0.154 150.069)" },
    dark: { "--primary": "oklch(0.723 0.219 149.579)", "--primary-foreground": "oklch(0.145 0 0)", "--ring": "oklch(0.723 0.219 149.579)" },
  },
  orange: {
    light: { "--primary": "oklch(0.646 0.222 41.116)", "--primary-foreground": "oklch(0.985 0 0)", "--ring": "oklch(0.646 0.222 41.116)" },
    dark: { "--primary": "oklch(0.769 0.188 70.08)", "--primary-foreground": "oklch(0.145 0 0)", "--ring": "oklch(0.769 0.188 70.08)" },
  },
  rose: {
    light: { "--primary": "oklch(0.586 0.253 17.585)", "--primary-foreground": "oklch(0.985 0 0)", "--ring": "oklch(0.586 0.253 17.585)" },
    dark: { "--primary": "oklch(0.712 0.194 13.428)", "--primary-foreground": "oklch(0.145 0 0)", "--ring": "oklch(0.712 0.194 13.428)" },
  },
} as const;

const radii = {
  none: "0px",
  md: "0.625rem",
  xl: "1.25rem",
} as const;

const widths = {
  sm: "max-w-sm",
  md: "max-w-xl",
  lg: "max-w-3xl",
} as const;

export function resolveAppearance(spec: Pick<FormSpec, "appearance">): Appearance {
  return appearanceSchema.parse({ ...defaultAppearance, ...spec.appearance });
}

export function appearanceStyle(appearance: Appearance): CSSProperties {
  return {
    ...surfaces[appearance.theme],
    ...accents[appearance.accent][appearance.theme],
    "--radius": radii[appearance.radius],
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
  } as unknown as CSSProperties;
}

export function appearanceClassName(appearance: Appearance) {
  return `mx-auto w-full ${widths[appearance.width]} ${appearance.theme}`;
}

export function submitClassName(appearance: Appearance) {
  return appearance.submitWidth === "full" ? "w-full" : "";
}
