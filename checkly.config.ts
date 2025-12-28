import { defineConfig } from 'checkly';

/**
 * Checkly Monitoring Configuration
 * https://www.checklyhq.com/docs/cli/
 *
 * Setup:
 * 1. Sign up at https://www.checklyhq.com
 * 2. Get your API key from Settings > API Keys
 * 3. Run: npx checkly login
 * 4. Deploy: npx checkly deploy
 */
export default defineConfig({
  projectName: 'CodeBakers',
  logicalId: 'codebakers-monitoring',
  repoUrl: 'https://github.com/your-org/codebakers-server',
  checks: {
    activated: true,
    muted: false,
    runtimeId: '2024.02',
    frequency: 5, // Check every 5 minutes
    locations: ['us-east-1', 'eu-west-1'],
    tags: ['api', 'production'],
    checkMatch: '**/*.check.ts',
    ignoreDirectoriesMatch: [],
    browserChecks: {
      frequency: 10,
      testMatch: '**/*.spec.ts',
    },
  },
  cli: {
    runLocation: 'us-east-1',
  },
});
