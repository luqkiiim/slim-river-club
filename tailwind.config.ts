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
        sand: "#f6efe4",
        ink: "#1f2a1f",
        leaf: "#4d8b5b",
        moss: "#274235",
        blush: "#e88f74",
        cream: "#fffdf8",
      },
      boxShadow: {
        panel: "0 18px 40px rgba(35, 49, 35, 0.12)",
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top left, rgba(255, 220, 195, 0.8), transparent 35%), radial-gradient(circle at top right, rgba(128, 181, 144, 0.45), transparent 30%), linear-gradient(180deg, #fffdf8 0%, #f6efe4 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
