import base from '@silk/config/eslint';
import globals from 'globals';

export default [
  ...base,
  { languageOptions: { globals: { ...globals.browser } } },
  {
    rules: {
      // Teks UI dari berkas pesan; console dilarang kecuali error.
      'no-console': ['error', { allow: ['error'] }],
    },
  },
];
