import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  // ts-jest handles TypeScript; nanoid v5 is ESM-only so we transform it too
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { module: "commonjs" } }],
    "^.+\\.js$": ["ts-jest", { tsconfig: { module: "commonjs", allowJs: true } }],
  },
  // Allow ts-jest to transform nanoid (ESM-only package)
  transformIgnorePatterns: ["node_modules/(?!(nanoid)/)"],
};

export default config;
