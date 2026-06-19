import type { Config } from "tailwindcss";

/**
 * Tailwind theme references the CSS variables declared in src/app/globals.css
 * (the authoritative design tokens, docs/10-design-system.md §1). Keeping values
 * in CSS vars — not hard-coded here — lets shadcn/ui and raw CSS share one source.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
          inset: "var(--surface-inset)",
        },
        // text → `ink` to avoid colliding with the `text-*` utility prefix
        ink: {
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
        },
        // border → `hairline` (docs/10 「克制细描边」)
        hairline: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
          brand: "var(--border-brand)",
        },
        ok: "var(--ok)",
        running: "var(--running)",
        pending: "var(--pending)",
        warn: "var(--warn)",
        danger: "var(--danger)",
        canceled: "var(--canceled)",
        // gradient endpoints for solid-color needs (docs/10 §品牌渐变)
        brand: {
          magenta: "#FF3BA7",
          purple: "#C03BFF",
          cyan: "#27E0FF",
          blue: "#3B82F6",
        },
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
        pill: "var(--r-pill)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)"],
      },
      backgroundImage: {
        "grad-play": "var(--grad-play)",
        "grad-create": "var(--grad-create)",
      },
      boxShadow: {
        focus: "0 0 0 2px rgba(39,224,255,.6)",
        modal: "0 12px 40px rgba(0,0,0,.5)",
      },
    },
  },
  plugins: [],
};

export default config;
