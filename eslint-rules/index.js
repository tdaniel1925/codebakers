/**
 * CodeBakers ESLint Plugin
 *
 * Custom rules for enforcing code coherence and consistency.
 *
 * Rules:
 * - no-hardcoded-constants: Prevents hardcoding business values
 * - enforce-service-layer: Requires using service classes for db operations
 */

module.exports = {
  rules: {
    'no-hardcoded-constants': require('./no-hardcoded-constants'),
    'enforce-service-layer': require('./enforce-service-layer'),
  },
  configs: {
    recommended: {
      plugins: ['codebakers'],
      rules: {
        'codebakers/no-hardcoded-constants': 'error',
        'codebakers/enforce-service-layer': 'error',
      },
    },
  },
};
