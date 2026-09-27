import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const CHROME_RESTRICTION = {
  name: 'chrome',
  message:
    'Call chrome.* only through adapters in src/core/chrome (or wire them in an entrypoint).',
};
const FETCH_RESTRICTION = {
  name: 'fetch',
  message: 'Only src/core/github may call fetch(); use the typed GitHub client.',
};
const FETCH_PROPERTY_RESTRICTIONS = ['window', 'globalThis', 'self'].map((object) => ({
  object,
  property: 'fetch',
  message: 'Only src/core/github may call fetch(); use the typed GitHub client.',
}));

const layerImportRule = (patterns) => ['error', { patterns }];
const TEST_PATTERN = {
  group: ['@test/*'],
  message: 'Test utilities may only be imported from *.test.ts(x) files.',
};

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.serviceworker },
    },
    plugins: { 'import-x': importX, 'react-hooks': reactHooks },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: './tsconfig.json' })],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'import-x/no-cycle': ['error', { ignoreExternal: true }],
      'import-x/no-self-import': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
          pathGroups: [{ pattern: '@{shared,core,features,test}/**', group: 'internal' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
      'id-length': ['error', { min: 2, exceptions: ['_'], properties: 'never' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-globals': ['error', CHROME_RESTRICTION, FETCH_RESTRICTION],
      'no-restricted-properties': ['error', ...FETCH_PROPERTY_RESTRICTIONS],
      'no-restricted-imports': layerImportRule([TEST_PATTERN]),
    },
  },
  {
    files: ['src/shared/**'],
    rules: {
      'no-restricted-imports': layerImportRule([
        TEST_PATTERN,
        {
          group: ['@core/*', '@features/*', '**/core/**', '**/features/**'],
          message: 'shared/ depends on nothing else in src.',
        },
      ]),
    },
  },
  {
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': layerImportRule([
        TEST_PATTERN,
        { group: ['@features/*', '**/features/**'], message: 'core/ may depend on shared/ only.' },
      ]),
    },
  },
  {
    files: ['src/features/**'],
    rules: {
      'no-restricted-imports': layerImportRule([
        TEST_PATTERN,
        {
          group: ['@features/*'],
          message:
            'Features may not import other features; promote shared code to core/ or shared/.',
        },
      ]),
    },
  },
  {
    files: [
      'src/core/chrome/**',
      'src/background/**',
      'src/popup/**',
      'src/offscreen/**',
      'src/test/**',
    ],
    rules: { 'no-restricted-globals': ['error', FETCH_RESTRICTION] },
  },
  {
    files: ['src/core/github/**', 'src/test/**'],
    rules: {
      'no-restricted-globals': ['error', CHROME_RESTRICTION],
      'no-restricted-properties': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  {
    files: ['scripts/**', '*.config.{ts,js}', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off', 'no-restricted-globals': 'off' },
  },
  { files: ['**/*.js'], ...tseslint.configs.disableTypeChecked },
  prettierConfig,
);
