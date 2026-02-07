/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0f14",
          900: "#111827",
          800: "#1f2937",
        },
        jade: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        amber: {
          400: "#fbbf24",
          500: "#f59e0b",
        },
        slate: {
          300: "#cbd5f5",
          400: "#94a3b8",
          500: "#64748b",
        },
      },
      fontFamily: {
        sans: ["\"Space Grotesk\"", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-jade": "0 0 24px rgba(16, 185, 129, 0.25)",
      },
    },
  },
  plugins: [],
};
