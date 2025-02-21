import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

const esModules = ['lodash-es']
// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  testMatch: ["**/*.test.js", "**/*.test.ts", "**/*.test.jsx", "**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transformIgnorePatterns: [`/node_modules/(?!(${esModules.join('|')})/)`],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
// eslint-disable-next-line import/no-anonymous-default-export
export default async function () {
  const jestConfig = await createJestConfig(config)()
  return {
    ...jestConfig,
    transformIgnorePatterns: jestConfig.transformIgnorePatterns!.filter(
      (ptn) => ptn !== '/node_modules/'
    ), // ['^.+\\.module\\.(css|sass|scss)$', '/node_modules/(?!(package1|package2)/']
  }
};
