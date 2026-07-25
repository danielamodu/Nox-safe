/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#ffe17c",
        charcoal: "#171e19",
        sage: "#b7c6c2",
        brutal: {
          black: "#000000",
          white: "#ffffff",
          dark: "#272727",
        },
      },
      fontFamily: {
        heading: ['"Space Grotesk"', "sans-serif"],
        body: ['"DM Sans"', "sans-serif"],
        mono: ['"DM Mono"', "monospace"],
      },
      boxShadow: {
        "brutal-sm": "4px 4px 0px 0px #000000",
        "brutal-md": "6px 6px 0px 0px #000000",
        "brutal-lg": "8px 8px 0px 0px #000000",
        "brutal-none": "0px 0px 0px 0px #000000",
      },
      borderWidth: {
        brutal: "2px",
      },
    },
  },
  plugins: [],
};
