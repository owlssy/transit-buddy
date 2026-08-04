/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Override Tailwind's default cool-gray "slate" with a warm neutral
        // tuned to the ink (#100f0d) / paper (#fffefc) palette, so every
        // existing text-slate-*/bg-slate-*/border-slate-* class in the app
        // reads as part of the same warm system instead of clashing blue-gray.
        slate: {
          50: "#faf9f6",
          100: "#f1efe9",
          200: "#e6e3da",
          300: "#d1cdc0",
          400: "#a3a099",
          500: "#726f68",
          600: "#4a4844",
          700: "#383630",
          800: "#211f1c",
          900: "#100f0d",
          950: "#0b0a09",
        },
        // TransitBuddy brand palette
        brand: {
          50: "#e8faf4",
          100: "#c8f1e2",
          200: "#94e3c8",
          300: "#5dd2ac",
          400: "#3ec69c",
          500: "#25b890", // primary
          600: "#1a9d7a",
          700: "#04946d", // deep accent green
          800: "#067057",
          900: "#065441",
        },
        accent: {
          // cyan — secondary highlight, live/tracking states
          50: "#e6fbfd",
          100: "#c0f4f9",
          200: "#8ce9f3",
          300: "#4fd8e7",
          400: "#22c6da",
          500: "#0abace",
          600: "#0899ab",
          700: "#077483",
        },
        navy: {
          // deep blue — headers, dark UI accents
          500: "#0d55a3",
          600: "#013d7d",
          700: "#012f61",
          800: "#022449",
        },
        transit: {
          green: "#25b890",
          amber: "#e0a000",
          red: "#e0503f",
        },
        surface: {
          light: "#fffefc",
          soft: "#faf9f6",
          muted: "#f1efe9",
          dark: "#100f0d",
          card: "#1c1b18",
        },
        ink: "#100f0d",
        paper: "#fffefc",
        // Poster / pitch-deck accents — used on the Home screen hero to match
        // the brand style guide (cream + sage block + dark coffee wordmark).
        cream: "#f4f1e8",
        sage: {
          DEFAULT: "#a9d6c4",
          100: "#d3ead9",
          600: "#7ec2a8",
        },
        coffee: "#2a1c12",
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
