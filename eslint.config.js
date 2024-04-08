import globals from 'globals';
import config from 'eslint-config-qubyte';

export default [
  config,
  {
    ignores: ['public', '.netlify']
  },
  {
    files: ['index.js', 'lib/**/*.js', 'tests/**/*.js', 'scripts/**/*.js', 'plugins/**/*.js', 'functions/**/*.js'],
    languageOptions: { globals: { ...globals.nodeBuiltin, Intl: true } }
  },
  {
    files: ['scripts/**/*.js', 'plugins/**/*.js'],
    rules: { 'no-console': 'off' }
  },
  {
    files: ['functions/**/*.js'],
    languageOptions: { globals: { Netlify: true } },
    rules: { 'no-console': 'off' }
  },
  {
    files: ['content/scripts/**/*.js'],
    languageOptions: { globals: globals.browser },
    rules: { 'no-console': 'off' }
  }
];
