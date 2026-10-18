import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6f3",
          100: "#d7ebe4",
          500: "#2f7d63",
          600: "#256550",
          700: "#1d5040"
        }
      },
      fontFamily: {
        sans: ["Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
