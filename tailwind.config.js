/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Neutral / surface palette (shadcn-inspired)
        background: '#f8fafc',
        surface: '#ffffff',
        border: '#e2e8f0',
        muted: '#f1f5f9',
        'muted-foreground': '#64748b',
        foreground: '#0f172a',
        // Brand
        primary: '#0f766e', // teal-700 — bookkeeping/finance feel
        'primary-foreground': '#ffffff',
        // Status colors used by badges
        success: '#16a34a',
        'success-bg': '#dcfce7',
        warning: '#d97706',
        'warning-bg': '#fef3c7',
        danger: '#dc2626',
        'danger-bg': '#fee2e2',
        info: '#2563eb',
        'info-bg': '#dbeafe',
      },
    },
  },
  plugins: [],
};
