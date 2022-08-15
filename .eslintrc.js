/* eslint-env node */

module.exports = {
  extends: [
    'plugin:@shopify/typescript',
    'plugin:@shopify/jest',
    'plugin:@shopify/prettier',
  ],
  ignorePatterns: [
    'examples/',
    'node_modules/',
    'packages/*/build/',
    'packages/*/*.d.ts',
    'packages/*/*.js',
    '!packages/*/.eslintrc.js',
    'packages/*/*.mjs',
    'packages/*/*.node',
    'packages/*/*.esnext',
    'packages/cli/src/commands/develop/schema.ts',
    '*.graphql',
  ],
  rules: {
    // Shopify naming rules are too strict
    '@typescript-eslint/naming-convention': 'off',
    'import/order': 'off',
    '@typescript-eslint/array-type': 'off',
  },
  overrides: [
    {
      files: ['loom.config.ts', 'config/loom/**/*'],
      rules: {
        // Doesn’t understand that loom dependencies come from the root package.json
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
