/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stadium: {
          bg: '#090d16',
          card: '#121824',
          border: '#1f293d',
          accent: '#00f2fe', // vibrant cyan glow
          glow: '#005f73',
          danger: '#ff4d4d',
          warning: '#ffb703',
          text: '#f8fafc',
          muted: '#94a3b8'
        }
      },
      fontFamily: {
        mono: ['Courier New', 'Courier', 'monospace']
      }
    },
  },
  plugins: [],
}
