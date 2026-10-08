import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#c2410c",
        "primary-hover": "#9a3412",
        "primary-bright": "#ea580c",
        secondary: "#18181b",
        tertiary: "#15803d",
        neutral: "#faf6f0",
        surface: "#ffffff",
        "text-muted": "#71717a",
        "success-bg": "#dcfce7",
        warning: "#92400e",
        "warning-bg": "#fef3c7",
        danger: "#b91c1c",
        "danger-bg": "#fef2f2",
        "accent-bg": "#fff7ed",
      },
      fontFamily: {
        h1: ["Inter"],
        h2: ["Inter"],
        "body-md": ["Inter"],
        "body-sm": ["Inter"],
        "label-sm": ["Inter"],
        receipt: ["ui-monospace, SFMono-Regular, Menlo, monospace"],
      },
      fontSize: {
        h1: ["1.5rem", { letterSpacing: "-0.01em", fontWeight: "700" }],
        h2: ["1.125rem", { fontWeight: "700" }],
        "body-md": ["1rem", { fontWeight: "400" }],
        "body-sm": ["0.875rem", { fontWeight: "400" }],
        "label-sm": ["0.75rem", { letterSpacing: "0.01em", fontWeight: "600" }],
        receipt: ["0.75rem", { fontWeight: "400" }],
      },
      borderRadius: {
        md: "6px",
        lg: "8px",
        xl: "12px",
        full: "9999px",
      },
      spacing: {
        sm: "8px",
        md: "16px",
        lg: "24px",
      },
    },
  },
  plugins: [],
};
export default config;
