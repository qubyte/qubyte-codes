import config from 'eslint-config-qubyte';

export default [
  config,
  {
    ignores: ['public', '.netlify']
  },
  {
    files: ['index.js', 'lib/**/*.js', 'tests/**/*.js', 'scripts/**/*.js', 'plugins/**/*.js', 'functions/**/*.js'],
    languageOptions: {
      globals: {
        Buffer: false,
        console: false,
        fetch: false,
        process: false,
        setTimeout: false,
        setInterval: false,
        clearInterval: false,
        URL: false,
        URLSearchParams: false,
        FormData: false,
        Blob: false,
        Response: false
      }
    }
  },
  {
    files: ['scripts/**/*.js', 'plugins/**/*.js'],
    rules: { 'no-console': 'off' }
  },
  {
    files: ['functions/**/*.js'],
    languageOptions: { globals: { Netlify: false } },
    rules: { 'no-console': 'off' }
  },
  {
    files: ['content/scripts/**/*.js'],
    languageOptions: {
      globals: {
        document: false,
        window: false,
        localStorage: false,
        console: false,
        crypto: false,
        URLSearchParams: false,
        location: false,
        CSS: false,
        setTimeout: false,
        getComputedStyle: false,
        URL: false,
        Blob: false
      }
    },
    rules: { 'no-console': 'off' }
  }
];
