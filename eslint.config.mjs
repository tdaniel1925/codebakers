import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { createRequire } from "module";

// Import custom CodeBakers rules
const require = createRequire(import.meta.url);
const codebakersRules = require("./eslint-rules/index.js");

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // CodeBakers coherence rules
  {
    plugins: {
      codebakers: codebakersRules,
    },
    rules: {
      // Enforce centralized constants usage
      "codebakers/no-hardcoded-constants": "warn", // Start as warning, upgrade to error once code is fixed
      // Enforce service layer for database operations
      "codebakers/enforce-service-layer": "warn", // Start as warning, upgrade to error once code is fixed
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Also ignore our ESLint rules (they're CommonJS, not TypeScript)
    "eslint-rules/**",
  ]),
]);

export default eslintConfig;
