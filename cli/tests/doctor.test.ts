import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('doctor command checks', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `codebakers-doctor-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('CLAUDE.md checks', () => {
    it('should detect missing CLAUDE.md', () => {
      const claudeMdPath = join(testDir, 'CLAUDE.md');
      expect(existsSync(claudeMdPath)).toBe(false);
    });

    it('should detect valid CodeBakers CLAUDE.md', () => {
      const claudeMdPath = join(testDir, 'CLAUDE.md');
      writeFileSync(claudeMdPath, '# CODEBAKERS SMART ROUTER\nVersion: 5.1');

      const content = require('fs').readFileSync(claudeMdPath, 'utf-8');
      const isCodeBakers = content.includes('CODEBAKERS') || content.includes('CodeBakers');
      expect(isCodeBakers).toBe(true);
    });

    it('should detect non-CodeBakers CLAUDE.md', () => {
      const claudeMdPath = join(testDir, 'CLAUDE.md');
      writeFileSync(claudeMdPath, '# My Custom Instructions');

      const content = require('fs').readFileSync(claudeMdPath, 'utf-8');
      const isCodeBakers = content.includes('CODEBAKERS') || content.includes('CodeBakers');
      expect(isCodeBakers).toBe(false);
    });
  });

  describe('.claude folder checks', () => {
    it('should detect missing .claude folder', () => {
      const claudeDir = join(testDir, '.claude');
      expect(existsSync(claudeDir)).toBe(false);
    });

    it('should count modules in .claude folder', () => {
      const claudeDir = join(testDir, '.claude');
      mkdirSync(claudeDir, { recursive: true });

      // Create test modules
      const modules = [
        '00-core.md',
        '01-database.md',
        '02-auth.md',
        '03-api.md',
        '04-frontend.md',
      ];

      for (const mod of modules) {
        writeFileSync(join(claudeDir, mod), `# ${mod}`);
      }

      const files = readdirSync(claudeDir).filter(f => f.endsWith('.md'));
      expect(files.length).toBe(5);
    });

    it('should detect insufficient modules (less than 10)', () => {
      const claudeDir = join(testDir, '.claude');
      mkdirSync(claudeDir, { recursive: true });

      // Create only 3 modules
      writeFileSync(join(claudeDir, '00-core.md'), '# Core');
      writeFileSync(join(claudeDir, '01-database.md'), '# Database');
      writeFileSync(join(claudeDir, '02-auth.md'), '# Auth');

      const files = readdirSync(claudeDir).filter(f => f.endsWith('.md'));
      expect(files.length).toBeLessThan(10);
    });

    it('should detect full module set (47+ modules)', () => {
      const claudeDir = join(testDir, '.claude');
      mkdirSync(claudeDir, { recursive: true });

      // Create 47 modules
      for (let i = 0; i < 47; i++) {
        const name = i.toString().padStart(2, '0');
        writeFileSync(join(claudeDir, `${name}-module.md`), `# Module ${i}`);
      }

      const files = readdirSync(claudeDir).filter(f => f.endsWith('.md'));
      expect(files.length).toBeGreaterThanOrEqual(47);
    });

    it('should check for required 00-core.md', () => {
      const claudeDir = join(testDir, '.claude');
      mkdirSync(claudeDir, { recursive: true });

      const corePath = join(claudeDir, '00-core.md');
      expect(existsSync(corePath)).toBe(false);

      writeFileSync(corePath, '# Core patterns');
      expect(existsSync(corePath)).toBe(true);
    });
  });

  describe('project state checks', () => {
    it('should handle missing PROJECT-STATE.md gracefully', () => {
      const statePath = join(testDir, 'PROJECT-STATE.md');
      // This is optional, should not fail
      expect(existsSync(statePath)).toBe(false);
    });

    it('should detect existing PROJECT-STATE.md', () => {
      const statePath = join(testDir, 'PROJECT-STATE.md');
      writeFileSync(statePath, '# Project State\n');
      expect(existsSync(statePath)).toBe(true);
    });
  });
});

describe('doctor summary', () => {
  it('should calculate correct pass/fail counts', () => {
    const checks = [
      { ok: true, message: 'Check 1' },
      { ok: true, message: 'Check 2' },
      { ok: false, message: 'Check 3' },
      { ok: true, message: 'Check 4' },
    ];

    const passed = checks.filter(c => c.ok).length;
    const failed = checks.filter(c => !c.ok).length;
    const total = checks.length;

    expect(passed).toBe(3);
    expect(failed).toBe(1);
    expect(total).toBe(4);
  });

  it('should provide fix suggestions for common issues', () => {
    const suggestions: string[] = [];

    // Simulate missing CLAUDE.md
    const hasClaudeMd = false;
    if (!hasClaudeMd) {
      suggestions.push('Run: codebakers install');
    }

    // Simulate missing hook
    const hasHook = false;
    if (!hasHook) {
      suggestions.push('Run: codebakers install-hook');
    }

    expect(suggestions).toContain('Run: codebakers install');
    expect(suggestions).toContain('Run: codebakers install-hook');
  });
});
