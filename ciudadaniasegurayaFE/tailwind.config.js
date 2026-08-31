/** @type {import("tailwindcss").Config} */
const config = {
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
    "./src/features/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--background-primary)",
        panel: "var(--background-panel)",
        ink: "var(--foreground-primary)",
        muted: "var(--foreground-secondary)",
        warning: "var(--accent-warning)",
        information: "var(--accent-information)",
        success: "var(--accent-success)",
      },
      fontFamily: {
        sans: ["Inter", "IBM Plex Sans", "Arial", "sans-serif"],
        mono: ["Geist Mono", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
