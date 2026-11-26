import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';
import { angular22Rules } from '../../eslint.angular.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  angular22Rules,
  {
    // Keep admin code out of the public bundle: public pages never import from admin/.
    // (The admin editor plugs into the public plain view through RESUME_EDIT_SLOTS instead.)
    // Specs are exempt: they may reuse the admin test fixtures.
    files: ['src/app/public/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)admin/',
              message:
                'Public code must not import admin code (it would ship in the public bundle).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
