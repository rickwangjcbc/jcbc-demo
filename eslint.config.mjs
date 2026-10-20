import gts from 'gts';

export default [
  {ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**']},
  ...gts,
];
