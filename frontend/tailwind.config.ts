import type { Config } from "tailwindcss";

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
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['var(--font-fraunces)', 'Fraunces', 'Georgia', 'serif'],
        syne: ['var(--font-fraunces)', 'Fraunces', 'Georgia', 'serif'],
        dm: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          dark: "hsl(var(--primary))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* Ink & Paper — these track the CSS vars so dark mode works, unlike
           the hardcoded teal hex values they replace. The sidebar stays a
           fixed ink-black panel in both modes (a book spine), so it's the
           one color here that intentionally doesn't flip with the theme. */
        "sidebar-dark": "#181410",
        "bg-light": "hsl(var(--background))",
        "border-light": "hsl(var(--border))",
        "text-dark": "hsl(var(--foreground))",
        "text-muted": "hsl(var(--muted-foreground))",
        success: "#4a8a5c",
        warning: "#b8783a",
        danger: "hsl(var(--destructive))",
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      boxShadow: {
        "soft": "0 2px 10px rgba(47,58,58,0.06)",
        "card-hover": "0 16px 36px rgba(31,111,106,0.14)",
        "button": "0 8px 24px -8px rgba(31,111,106,0.45)",
        "glass": "0 8px 32px -8px rgba(13,43,41,0.25)",
        "bezel-inset": "inset 0 1px 1px rgba(255,255,255,0.6), inset 0 -1px 1px rgba(31,111,106,0.04)",
        "ambient": "0 1px 2px rgba(31,41,41,0.04), 0 12px 32px -8px rgba(31,111,106,0.10)",
        "ambient-lg": "0 2px 4px rgba(31,41,41,0.04), 0 24px 56px -12px rgba(31,111,106,0.16)",
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.32,0.72,0,1)",
        "spring-soft": "cubic-bezier(0.22,1,0.36,1)",
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
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
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        }
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
