import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#121212",
        card: "#1E1E1E",
        foreground: "#F5F5F5",
        muted: "#888888",
        primary: "#FF6B2C",
        danger: "#FF3B30",
        border: "#2A2A2A",
      },
      fontFamily: {
        sans: ["Freesentation", "Noto Sans KR", "system-ui", "sans-serif"],
      },
      maxWidth: {
        mobile: "430px",
      },
    },
  },
  plugins: [],
};
export default config;
