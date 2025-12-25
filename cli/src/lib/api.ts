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
 */
export async function checkForUpdates(): Promise<{
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
} | null> {
  try {
    const currentVersion = getCliVersion();
    const response = await fetch('https://registry.npmjs.org/@codebakers/cli/latest', {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const latestVersion = data.version;

    return {
      currentVersion,
      latestVersion,
      updateAvailable: currentVersion !== latestVersion,
    };
  } catch {
    return null;
  }
}
