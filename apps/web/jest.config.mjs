import base from '@finances/config/jest/node.mjs';

/** @type {import('jest').Config} */
export default {
  ...base,
  // JSX compilado pelo ts-jest (o tsconfig do app usa "preserve", que é do Next)
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
};
