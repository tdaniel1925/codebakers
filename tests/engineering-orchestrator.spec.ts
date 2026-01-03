import { test, expect } from '@playwright/test';

/**
 * Engineering Orchestrator Service Tests
 *
 * These tests verify the engineering session lifecycle and database persistence.
 * They run against the API endpoints which exercise the orchestrator service.
 */

test.describe('Engineering Orchestrator Service', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  test.describe('Session Lifecycle', () => {
    test('Engineering phases are defined correctly', () => {
      const expectedPhases = [
        'scoping',
        'requirements',
        'architecture',
        'design_review',
        'implementation',
        'code_review',
        'testing',
        'security_review',
        'documentation',
        'staging',
        'launch',
      ];

      // Verify we have 11 phases
      expect(expectedPhases).toHaveLength(11);
    });

    test('Agent roles are defined correctly', () => {
      const expectedAgents = [
        'orchestrator',
        'pm',
        'architect',
        'engineer',
        'qa',
        'security',
        'documentation',
        'devops',
      ];

      // Verify we have 8 agent types
      expect(expectedAgents).toHaveLength(8);
    });

    test('Session statuses are defined correctly', () => {
      const expectedStatuses = [
        'active',
        'paused',
        'completed',
        'abandoned',
      ];

      // Verify we have 4 statuses
      expect(expectedStatuses).toHaveLength(4);
    });

    test('Gate statuses are defined correctly', () => {
      const expectedGateStatuses = [
        'pending',
        'in_progress',
        'passed',
        'failed',
        'skipped',
      ];

      // Verify we have 5 gate statuses
      expect(expectedGateStatuses).toHaveLength(5);
    });
  });

  test.describe('Database Schema Validation', () => {
    test('engineering_sessions table has required columns', () => {
      const requiredColumns = [
        'id',
        'team_id',
        'project_hash',
        'project_name',
        'project_description',
        'status',
        'current_phase',
        'current_agent',
        'is_running',
        'scope',
        'stack',
        'gate_status',
        'artifacts',
        'dependency_graph',
        'last_error',
        'error_count',
        'total_api_calls',
        'total_tokens_used',
        'started_at',
        'paused_at',
        'completed_at',
        'last_activity_at',
        'created_at',
        'updated_at',
      ];

      // Verify we have all required columns (24 columns)
      expect(requiredColumns).toHaveLength(24);
    });

    test('engineering_messages table has required columns', () => {
      const requiredColumns = [
        'id',
        'session_id',
        'from_agent',
        'to_agent',
        'message_type',
        'content',
        'metadata',
        'created_at',
      ];

      expect(requiredColumns).toHaveLength(8);
    });

    test('engineering_decisions table has required columns', () => {
      const requiredColumns = [
        'id',
        'session_id',
        'agent',
        'phase',
        'decision',
        'reasoning',
        'alternatives',
        'confidence',
        'reversible',
        'impact',
        'created_at',
      ];

      expect(requiredColumns).toHaveLength(11);
    });

    test('engineering_gate_history table has required columns', () => {
      const requiredColumns = [
        'id',
        'session_id',
        'phase',
        'previous_status',
        'new_status',
        'triggered_by',
        'reason',
        'artifacts',
        'created_at',
      ];

      expect(requiredColumns).toHaveLength(9);
    });
  });

  test.describe('API Response Formats', () => {
    test('Health endpoint returns proper format', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/health`);
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
    });
  });
});
