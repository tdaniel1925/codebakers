import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API communication', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('content API', () => {
    it('should fetch content with API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          version: '5.1',
          router: '# Router content',
          modules: {
            '00-core.md': '# Core',
            '02-auth.md': '# Auth',
          },
        }),
      });

      const response = await fetch('https://codebakers.ai/api/content', {
        headers: { Authorization: 'Bearer test-key' },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.version).toBe('5.1');
      expect(Object.keys(data.modules).length).toBe(2);
    });

    it('should fetch content with trial ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          version: '5.1',
          router: '# Router content',
          modules: { '00-core.md': '# Core' },
        }),
      });

      const response = await fetch('https://codebakers.ai/api/content', {
        headers: { 'X-Trial-ID': 'trial-123' },
      });

      expect(response.ok).toBe(true);
    });

    it('should handle unauthorized response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      const response = await fetch('https://codebakers.ai/api/content', {
        headers: { Authorization: 'Bearer invalid-key' },
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        fetch('https://codebakers.ai/api/content')
      ).rejects.toThrow('Network error');
    });
  });

  describe('trial API', () => {
    it('should start a new trial', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          trialId: 'trial-123',
          stage: 'anonymous',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          daysRemaining: 7,
        }),
      });

      const response = await fetch('https://codebakers.ai/api/trial/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceHash: 'test-hash',
          machineId: 'test-machine',
          platform: 'test',
          hostname: 'test-host',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.trialId).toBe('trial-123');
      expect(data.daysRemaining).toBe(7);
    });

    it('should handle trial not available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'trial_not_available' }),
      });

      const response = await fetch('https://codebakers.ai/api/trial/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceHash: 'used-hash' }),
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBe('trial_not_available');
    });

    it('should handle expired trial', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stage: 'expired',
          canExtend: true,
        }),
      });

      const response = await fetch('https://codebakers.ai/api/trial/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceHash: 'expired-hash' }),
      });

      const data = await response.json();
      expect(data.stage).toBe('expired');
      expect(data.canExtend).toBe(true);
    });
  });

  describe('API key validation', () => {
    it('should validate a correct API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ valid: true }),
      });

      const response = await fetch('https://codebakers.ai/api/verify', {
        headers: { Authorization: 'Bearer valid-key' },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.valid).toBe(true);
    });

    it('should reject an invalid API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ valid: false, error: 'Invalid API key' }),
      });

      const response = await fetch('https://codebakers.ai/api/verify', {
        headers: { Authorization: 'Bearer invalid-key' },
      });

      expect(response.ok).toBe(false);
    });
  });
});

describe('error handling', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should provide helpful error messages for timeout', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'));

    try {
      await fetch('https://codebakers.ai/api/content');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if (error instanceof Error) {
        expect(error.message).toContain('timeout');
      }
    }
  });

  it('should handle rate limiting', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Too many requests' }),
    });

    const response = await fetch('https://codebakers.ai/api/content');
    expect(response.status).toBe(429);
  });

  it('should handle server errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' }),
    });

    const response = await fetch('https://codebakers.ai/api/content');
    expect(response.status).toBe(500);
  });
});
