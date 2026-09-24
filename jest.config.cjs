/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          esModuleInterop: true,
          jsx: "react-jsx",
          module: "commonjs",
          moduleResolution: "node",
          strict: true,
          target: "ES2022",
        },
      },
    ],
  },
};

module.exports = config;
