/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./mobile/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        greenTheme: '#10b981',
        greenBright: '#01eb53',
        redTheme: '#c64d53',
        greenForm: '#02782399',
        // Gradient color stops
        themeStart: '#01eb53',
        themeEnd: '#2dd4bf',
      },
      backgroundImage: {
        buttonGradientTheme: 'linear-gradient(to right, #01eb53, #2dd4bf)',
      },
    },
  },
  plugins: [],
}