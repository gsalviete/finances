// Base Jest compartilhada (ambiente Node). Cada workspace estende via spread:
//   import base from '@finances/config/jest/node.mjs';
//   export default { ...base };
/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  passWithNoTests: true,
  clearMocks: true,
  // Alias "@/..." → "src/..." (mesma convenção dos tsconfig dos apps).
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
