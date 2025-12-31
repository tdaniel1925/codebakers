import { getApiUrl } from '../config.js';

/**
 * API client utilities for CodeBakers CLI
 * This is the single source of truth for API validation and error handling
 */

export interface ApiError {
  error: string;
  code?: string;
  recoverySteps?: string[];
}

/**
 * Validate an API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') return false;
  // Keys should start with cb_ and be at least 20 characters
  return apiKey.startsWith('cb_') && apiKey.length >= 20;
}

/**
 * Validate an API key against the server
 * Returns true if valid, throws an ApiError if not
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  // First check format
  if (!isValidApiKeyFormat(apiKey)) {
    throw createApiError('Invalid API key format. Keys start with "cb_"', 'INVALID_FORMAT', [
      'Check that you copied the full API key',
      'Get your API key from: https://codebakers.ai/dashboard',
    ]);
  }

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/content`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return true;
    }

    // Parse error response
    const errorBody = await response.json().catch(() => ({}));
    const errorMessage = errorBody.error || errorBody.message || 'API key validation failed';

    if (response.status === 401) {
      throw createApiError(errorMessage, 'UNAUTHORIZED', [
        'Your API key may have been revoked or expired',
        'Generate a new key at: https://codebakers.ai/dashboard',
      ]);
    }

    if (response.status === 403) {
      throw createApiError(errorMessage, 'FORBIDDEN', [
        'Your subscription may have expired',
        'Check your account status at: https://codebakers.ai/settings',
      ]);
    }

    throw createApiError(errorMessage, 'UNKNOWN', [
      'Try again in a few moments',
      'If the problem persists, contact support',
    ]);
  } catch (error) {
    // If it's already an ApiError, rethrow it
    if (error && typeof error === 'object' && 'recoverySteps' in error) {
      throw error;
    }

    // Network error
    throw createApiError('Could not connect to CodeBakers server', 'NETWORK_ERROR', [
      'Check your internet connection',
      'Try again in a few moments',
      'If using a VPN or proxy, try disabling it',
    ]);
  }
}

/**
 * Create a structured API error
 */
export function createApiError(message: string, code: string, recoverySteps: string[]): ApiError {
  return {
    error: message,
    code,
    recoverySteps,
  };
}

/**
 * Format an API error for display
 */
export function formatApiError(error: ApiError): string {
  let output = error.error;

  if (error.recoverySteps && error.recoverySteps.length > 0) {
    output += '\n\n  Try:';
    for (const step of error.recoverySteps) {
      output += `\n    • ${step}`;
    }
  }

  return output;
}

/**
 * Check if the current API key is valid (for doctor command)
 */
export async function checkApiKeyValidity(): Promise<{
  valid: boolean;
  error?: ApiError;
}> {
  const { getApiKey } = await import('../config.js');
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      valid: false,
      error: createApiError('No API key configured', 'NOT_CONFIGURED', [
        'Run: codebakers setup',
      ]),
    };
  }

  try {
    await validateApiKey(apiKey);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error as ApiError,
    };
  }
}

/**
 * Get the current CLI version
 */
export function getCliVersion(): string {
  try {
    // Try to read from package.json
    const packageJson = require('../../package.json');
    return packageJson.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Check if there's a newer version of the CLI available
 * Uses the CodeBakers API for controlled rollouts (only recommends stable, tested versions)
 * Falls back to npm registry if API is unavailable
 */
export async function checkForUpdates(): Promise<{
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  autoUpdateEnabled: boolean;
  autoUpdateVersion: string | null;
  isBlocked: boolean;
} | null> {
  try {
    const currentVersion = getCliVersion();
    const apiUrl = getApiUrl();

    // First, try the CodeBakers API for controlled rollout info
    try {
      const response = await fetch(`${apiUrl}/api/cli/version`, {
        headers: {
          'Accept': 'application/json',
          'X-CLI-Version': currentVersion,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const latestVersion = data.stableVersion || data.latestVersion;
        const autoUpdateVersion = data.autoUpdateVersion;
        const isBlocked = data.isBlocked === true;

        return {
          currentVersion,
          latestVersion,
          updateAvailable: latestVersion !== currentVersion,
          autoUpdateEnabled: data.autoUpdateEnabled === true,
          autoUpdateVersion: autoUpdateVersion || null,
          isBlocked,
        };
      }
    } catch {
      // API unavailable, fall through to npm
    }

    // Fallback: check npm registry directly
    const npmResponse = await fetch('https://registry.npmjs.org/@codebakers/cli/latest', {
      headers: { 'Accept': 'application/json' },
    });

    if (!npmResponse.ok) return null;

    const npmData = await npmResponse.json();
    const latestVersion = npmData.version;

    return {
      currentVersion,
      latestVersion,
      updateAvailable: currentVersion !== latestVersion,
      autoUpdateEnabled: false, // npm fallback doesn't have controlled rollout
      autoUpdateVersion: null,
      isBlocked: false,
    };
  } catch {
    return null;
  }
}

/**
 * Report a CLI error to the server for tracking
 * This helps identify problematic versions for blocking
 */
export async function reportCliError(
  errorType: string,
  errorMessage: string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    const apiUrl = getApiUrl();
    const cliVersion = getCliVersion();

    // Fire and forget - don't block on error reporting
    fetch(`${apiUrl}/api/cli/error-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CLI-Version': cliVersion,
      },
      body: JSON.stringify({
        cliVersion,
        errorType,
        errorMessage,
        stackTrace: context?.stack,
        context: JSON.stringify({
          ...context,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        }),
      }),
    }).catch(() => {
      // Ignore reporting failures
    });
  } catch {
    // Never fail on error reporting
  }
}

// ============================================================================
// PROJECT TRACKING API
// ============================================================================

export interface ProjectSyncData {
  // Project updates
  project?: {
    status?: 'discovery' | 'planning' | 'building' | 'testing' | 'completed' | 'paused' | 'failed';
    overallProgress?: number;
    prdContent?: string;
    discoveryAnswers?: Record<string, unknown>;
    patternsUsed?: string[];
    detectedStack?: Record<string, string>;
  };

  // Phases to sync
  phases?: Array<{
    id?: string;
    phaseNumber: number;
    phaseName: string;
    phaseDescription?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
    progress?: number;
    requiredPatterns?: string[];
    aiConfidence?: number;
    aiNotes?: string;
    alternativesConsidered?: string[];
    requiresApproval?: boolean;
  }>;

  // Events to record
  events?: Array<{
    eventType: string;
    eventTitle: string;
    eventDescription?: string;
    eventData?: Record<string, unknown>;
    phaseId?: string;
    featureId?: string;
    filePath?: string;
    fileAction?: string;
    linesChanged?: number;
    aiConfidence?: number;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    riskReason?: string;
  }>;

  // Test runs to record
  testRuns?: Array<{
    testType: string;
    testCommand?: string;
    passed: boolean;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    durationMs?: number;
    phaseId?: string;
    featureId?: string;
  }>;

  // Files to track
  files?: Array<{
    filePath: string;
    fileName: string;
    fileType?: string;
    lineCount?: number;
    complexity?: number;
    parentPath?: string;
    depth?: number;
    status?: 'active' | 'deleted' | 'renamed';
    featureId?: string;
  }>;

  // Dependencies to track
  dependencies?: Array<{
    sourceFile: string;
    sourceType?: string;
    targetFile: string;
    targetType?: string;
    dependencyType?: string;
    importName?: string;
    featureId?: string;
  }>;

  // Risk flags to create
  riskFlags?: Array<{
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskCategory: string;
    riskTitle: string;
    riskDescription?: string;
    triggerFile?: string;
    triggerCode?: string;
    triggerReason?: string;
    aiRecommendation?: string;
    phaseId?: string;
    featureId?: string;
  }>;

  // Resource usage to track
  resources?: Array<{
    resourceType: string;
    apiEndpoint?: string;
    apiMethod?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    durationMs?: number;
    estimatedCostMillicents?: number;
    phaseId?: string;
    featureId?: string;
  }>;

  // Create snapshot
  createSnapshot?: {
    snapshotName: string;
    snapshotDescription?: string;
    isAutomatic?: boolean;
    gitCommitHash?: string;
    gitBranch?: string;
    projectState?: Record<string, unknown>;
    fileTree?: Array<Record<string, unknown>>;
    phaseId?: string;
  };
}

export interface ProjectSyncResult {
  projectId: string;
  synced: {
    project: boolean;
    phases: number;
    events: number;
    testRuns: number;
    files: number;
    dependencies: number;
    riskFlags: number;
    resources: number;
    snapshot: boolean;
  };
}

/**
 * Get or create a project on the server
 */
export async function getOrCreateProject(
  projectHash: string,
  projectName: string,
  projectDescription?: string,
  detectedStack?: Record<string, string>,
  authHeaders?: Record<string, string>
): Promise<{ projectId: string; isNew: boolean }> {
  const apiUrl = getApiUrl();

  const response = await fetch(`${apiUrl}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      projectHash,
      projectName,
      projectDescription,
      detectedStack,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw createApiError(
      error.error || 'Failed to create/get project',
      'PROJECT_ERROR',
      ['Check your internet connection', 'Verify your API key is valid']
    );
  }

  const result = await response.json();
  return {
    projectId: result.data?.id || result.id,
    isNew: result.data?.isNew || result.isNew || false,
  };
}

/**
 * Sync project data to the server
 * This is the main endpoint for keeping the server updated with local state
 */
export async function syncProjectData(
  projectId: string,
  data: ProjectSyncData,
  authHeaders?: Record<string, string>
): Promise<ProjectSyncResult> {
  const apiUrl = getApiUrl();

  const response = await fetch(`${apiUrl}/api/projects/${projectId}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw createApiError(
      error.error || 'Failed to sync project data',
      'SYNC_ERROR',
      ['Check your internet connection', 'Try again in a few moments']
    );
  }

  const result = await response.json();
  return result.data || result;
}

/**
 * Get project dashboard data from the server
 */
export async function getProjectDashboard(
  projectId: string,
  authHeaders?: Record<string, string>
): Promise<Record<string, unknown>> {
  const apiUrl = getApiUrl();

  const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      ...authHeaders,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw createApiError(
      error.error || 'Failed to get project dashboard',
      'PROJECT_ERROR',
      ['Check your internet connection', 'Verify the project exists']
    );
  }

  const result = await response.json();
  return result.data || result;
}

/**
 * Create a project hash from the project directory
 * Uses a combination of directory path and package.json name for uniqueness
 */
export function createProjectHash(projectDir: string, packageName?: string): string {
  const crypto = require('crypto');
  const hashInput = packageName ? `${projectDir}:${packageName}` : projectDir;
  return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}
