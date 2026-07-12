/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./*.html", "./src/**/*.{js,html}"],
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--primary) / <alpha-value>)",
        "background-light": "#cccccc",
        "background-dark": "#212121",
        // Neutral surface scale (replaces magic grays) — P3.9
        surface: {
          1: "rgb(var(--surface-1))",
          2: "rgb(var(--surface-2))",
          3: "rgb(var(--surface-3))",
          4: "rgb(var(--surface-4))",
          ink: "rgb(var(--surface-ink))",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "ui-monospace", "monospace"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      // Industrial sharp corners — but "full" stays default 9999px (P2.12 bug fix)
      borderRadius: {
        DEFAULT: "0.125rem",
        sm: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries"),
  ],
};
