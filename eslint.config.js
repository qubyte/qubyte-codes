import globals from 'globals';
import config from 'eslint-config-qubyte';

export default [
  {
    ignores: ['public/**/*.js', '.netlify/**/*.js']
  },
  {
    languageOptions: {
      ...config.languageOptions,
      globals: globals.node
    },
    rules: config.rules
  },
  {
    files: ['scripts/**/*.js', 'functions/**/*.js', 'plugins/**/*.js'],
    languageOptions: {
      ...config.languageOptions,
      globals: globals.node
    },
    rules: {
      ...config.rules,
      'no-console': 'off'
    }
  },
  {
    files: ['content/scripts/**/*.js'],
    languageOptions: {
      ...config.languageOptions,
      globals: globals.browser
    },
    rules: {
      ...config.rules,
      'no-console': 'off'
    }
  }
];
