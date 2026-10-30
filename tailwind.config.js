/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#13213A",
        poliscope: "#3157A5",
        canvas: "#F7F8FA",
      },
      fontFamily: {
        sans: ["IBM Plex Sans Thai", "Noto Sans Thai", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 18px 50px rgba(19, 33, 58, 0.08)",
      },
    },
  },
  plugins: [],
};
