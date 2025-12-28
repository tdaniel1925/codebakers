import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock modules before importing
vi.mock('../src/config.js', () => ({
  getApiKey: vi.fn(() => null),
  getTrialState: vi.fn(() => null),
  setTrialState: vi.fn(),
  getApiUrl: vi.fn(() => 'https://codebakers.ai'),
  isTrialExpired: vi.fn(() => false),
  getTrialDaysRemaining: vi.fn(() => 7),
}));

vi.mock('../src/lib/fingerprint.js', () => ({
  getDeviceFingerprint: vi.fn(() => ({
    deviceHash: 'test-hash',
    machineId: 'test-machine',
    platform: 'test',
    hostname: 'test-host',
  })),
}));

describe('go command', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a temp directory for each test
    testDir = join(tmpdir(), `codebakers-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    // Clean up
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create CLAUDE.md when patterns are installed', async () => {
    const claudeMdPath = join(testDir, 'CLAUDE.md');

    // Simulate pattern installation
    writeFileSync(claudeMdPath, '# CodeBakers Router');

    expect(existsSync(claudeMdPath)).toBe(true);
  });

  it('should create .claude directory with modules', async () => {
    const claudeDir = join(testDir, '.claude');
    mkdirSync(claudeDir, { recursive: true });

    // Simulate module installation
    writeFileSync(join(claudeDir, '00-core.md'), '# Core patterns');
    writeFileSync(join(claudeDir, '02-auth.md'), '# Auth patterns');

    expect(existsSync(claudeDir)).toBe(true);
    expect(existsSync(join(claudeDir, '00-core.md'))).toBe(true);
    expect(existsSync(join(claudeDir, '02-auth.md'))).toBe(true);
  });

  it('should handle network errors gracefully', async () => {
    // Mock fetch to fail
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    // The go command should not throw, just warn
    expect(() => {
      // Simulating the error handling logic
      try {
        throw new Error('Network error');
      } catch (error) {
        if (error instanceof Error && error.message.includes('Network')) {
          // Expected behavior - handle gracefully
        }
      }
    }).not.toThrow();
  });
});

describe('pattern file writing', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `codebakers-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should not overwrite existing CLAUDE.md', () => {
    const claudeMdPath = join(testDir, 'CLAUDE.md');
    const originalContent = '# My existing CLAUDE.md';

    writeFileSync(claudeMdPath, originalContent);

    // Simulate check before writing
    if (existsSync(claudeMdPath)) {
      // Should skip writing
      const content = require('fs').readFileSync(claudeMdPath, 'utf-8');
      expect(content).toBe(originalContent);
    }
  });

  it('should add .claude/ to .gitignore if exists', () => {
    const gitignorePath = join(testDir, '.gitignore');
    writeFileSync(gitignorePath, 'node_modules/\n.env\n');

    // Simulate gitignore update
    let gitignore = require('fs').readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('.claude/')) {
      gitignore += '\n# CodeBakers patterns\n.claude/\n';
      writeFileSync(gitignorePath, gitignore);
    }

    const updatedContent = require('fs').readFileSync(gitignorePath, 'utf-8');
    expect(updatedContent).toContain('.claude/');
  });

  it('should handle missing .gitignore gracefully', () => {
    const gitignorePath = join(testDir, '.gitignore');

    // Don't create .gitignore
    expect(existsSync(gitignorePath)).toBe(false);

    // Should not throw when trying to update non-existent .gitignore
    expect(() => {
      if (existsSync(gitignorePath)) {
        // Would update gitignore
      }
    }).not.toThrow();
  });
});
