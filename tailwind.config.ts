import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: "#F2EBDD",
        ink: "#203326",
        leaf: "#4B7C50",
        moss: "#2E4D37",
        blush: "#D97B63",
        cream: "#FBF8F1",
        sage: "#E4E8DC",
        peach: "#F5D8CD",
        line: "#DED8CC",
      },
      boxShadow: {
        panel: "0 16px 40px rgba(32, 51, 38, 0.08)",
        float: "0 18px 42px rgba(32, 51, 38, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
