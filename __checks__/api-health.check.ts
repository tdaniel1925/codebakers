import { ApiCheck, AssertionBuilder } from 'checkly/constructs';

/**
 * API Health Check
 * Monitors the /api/health endpoint for availability and database connectivity
 */
new ApiCheck('api-health-check', {
  name: 'API Health Check',
  activated: true,
  frequency: 5, // Every 5 minutes
  locations: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
  tags: ['api', 'health', 'critical'],
  degradedResponseTime: 2000,
  maxResponseTime: 5000,
  request: {
    url: 'https://codebakers.ai/api/health',
    method: 'GET',
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.jsonBody('$.status').equals('healthy'),
      AssertionBuilder.jsonBody('$.checks[0].status').equals('healthy'),
      AssertionBuilder.responseTime().lessThan(3000),
    ],
  },
  alertChannels: [],
});

/**
 * API Content Check
 * Monitors the /api/content endpoint for pattern delivery
 */
new ApiCheck('api-content-check', {
  name: 'API Content Delivery',
  activated: true,
  frequency: 10, // Every 10 minutes
  locations: ['us-east-1'],
  tags: ['api', 'content'],
  degradedResponseTime: 3000,
  maxResponseTime: 10000,
  request: {
    url: 'https://codebakers.ai/api/content/trial',
    method: 'GET',
    headers: [
      { key: 'X-Trial-ID', value: 'health-check-probe' },
    ],
    assertions: [
      // Expect 401 for invalid trial ID, but endpoint should respond
      AssertionBuilder.statusCode().greaterThan(0),
      AssertionBuilder.responseTime().lessThan(5000),
    ],
  },
  alertChannels: [],
});

/**
 * Homepage Check
 * Monitors the marketing site availability
 */
new ApiCheck('homepage-check', {
  name: 'Homepage Availability',
  activated: true,
  frequency: 5,
  locations: ['us-east-1', 'eu-west-1'],
  tags: ['web', 'marketing'],
  degradedResponseTime: 2000,
  maxResponseTime: 5000,
  request: {
    url: 'https://codebakers.ai',
    method: 'GET',
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.responseTime().lessThan(3000),
    ],
  },
  alertChannels: [],
});
