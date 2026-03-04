module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#c73b2f',
          redDark: '#a73027',
          charcoal: '#1f2329',
          ink: '#111111',
          sand: '#f4f1ee',
          amber: '#df8a56',
        },
      },
      fontFamily: {
        heading: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Source Sans 3', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
