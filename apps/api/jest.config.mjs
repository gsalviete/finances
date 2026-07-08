import base from '@finances/config/jest/node.mjs';

/** @type {import('jest').Config} */
export default {
  ...base,
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
};
