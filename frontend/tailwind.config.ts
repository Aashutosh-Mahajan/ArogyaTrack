import type { Config } from "tailwindcss";

const sans = ['"Geist Variable"', 'Geist', 'var(--font-deva)', 'var(--font-tamil)', 'var(--font-telugu)', 'var(--font-bengali)', 'ui-sans-serif', 'system-ui', 'sans-serif'];

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.25rem",
      screens: {
        "2xl": "1320px",
      },
    },
    extend: {
      fontFamily: {
        sans,
        display: sans,
        syne: sans,
        dm: sans,
        serif: ['var(--font-instrument)', '"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        sunken: "hsl(var(--surface-sunken))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          dark: "hsl(var(--primary))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
        danger: "hsl(var(--destructive))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        /* Legacy aliases — older markup still references these names. */
        "sidebar-dark": "hsl(var(--card))",
        "bg-light": "hsl(var(--background))",
        "border-light": "hsl(var(--border))",
        "text-dark": "hsl(var(--foreground))",
        "text-muted": "hsl(var(--muted-foreground))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 3px)",
        sm: "calc(var(--radius) - 6px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        soft: "0 1px 2px hsl(var(--shadow-color) / 0.05), 0 2px 8px -2px hsl(var(--shadow-color) / 0.06)",
        "card-hover": "0 14px 32px -14px hsl(var(--primary) / 0.3)",
        button: "0 1px 0 hsl(0 0% 100% / 0.18) inset, 0 6px 18px -6px hsl(var(--primary) / 0.55)",
        glass: "0 12px 32px -12px hsl(var(--shadow-color) / 0.25)",
        ambient: "0 1px 2px hsl(var(--shadow-color) / 0.04), 0 12px 32px -10px hsl(var(--shadow-color) / 0.12)",
        "ambient-lg": "0 2px 4px hsl(var(--shadow-color) / 0.04), 0 28px 60px -18px hsl(var(--shadow-color) / 0.22)",
        pop: "0 16px 48px -12px hsl(var(--shadow-color) / 0.28), 0 0 0 1px hsl(var(--border))",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.32,0.72,0,1)",
        "spring-soft": "cubic-bezier(0.22,1,0.36,1)",
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 7s ease-in-out infinite",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
