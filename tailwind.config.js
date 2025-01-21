/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/pages/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}', './src/app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#1a202c',
            a: {
              color: '#3182ce',
              '&:hover': {
                color: '#2c5282',
              },
            },
            strong: {
              color: '#1a202c',
            },
            h1: {
              color: '#1a202c',
            },
            h2: {
              color: '#1a202c',
            },
            h3: {
              color: '#1a202c',
            },
            h4: {
              color: '#1a202c',
            },
            code: {
              color: '#1a202c',
            },
            blockquote: {
              color: '#4a5568',
            },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
  // This is important for the markdown editor
  safelist: [
    {
      pattern: /^w-md-/,
    },
  ],
};
