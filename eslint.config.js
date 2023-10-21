import globals from 'globals';
import config from 'eslint-config-qubyte';

export default [
  {
    ignores: ['public/*', '.netlify/*']
  },
  {
    languageOptions: {
      ...config.languageOptions,
      globals: globals.nodeBuiltin
    },
    rules: config.rules
  },
  {
    files: ['scripts/**/*.js', 'plugins/**/*.js'],
    languageOptions: {
      ...config.languageOptions,
      globals: globals.nodeBuiltin
    },
    rules: {
      ...config.rules,
      'no-console': 'off'
    }
  },
  {
    files: ['functions/**/*.js'],
    languageOptions: {
      ...config.languageOptions,
      globals: {
        ...globals.nodeBuiltin,
        Netlify: true
      }
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
