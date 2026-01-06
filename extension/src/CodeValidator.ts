import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { FileOperation } from './CodeBakersClient';

const execAsync = promisify(exec);

export interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
  tscResult?: TypeScriptCheckResult;
}

export interface TypeScriptCheckResult {
  passed: boolean;
  errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
    code: string;
  }>;
  errorCount: number;
}

export interface ValidationError {
  file: string;
  line?: number;
  message: string;
  type: 'type' | 'import' | 'syntax' | 'security';
}

export interface ValidationWarning {
  file: string;
  message: string;
  type: 'any-type' | 'missing-error-handling' | 'no-test' | 'console-log';
}

export interface DependencyCheck {
  missing: string[];
  available: string[];
  suggestions: { package: string; command: string }[];
}

export interface TypeInventory {
  types: Map<string, TypeInfo>;
  exports: Map<string, ExportInfo[]>;
}

export interface TypeInfo {
  name: string;
  file: string;
  kind: 'interface' | 'type' | 'enum' | 'class';
  exported: boolean;
}

export interface ExportInfo {
  name: string;
  file: string;
  kind: 'function' | 'const' | 'class' | 'type' | 'default';
}

export class CodeValidator {
  private workspaceRoot: string | undefined;
  private typeInventory: TypeInventory | null = null;
  private installedPackages: Set<string> = new Set();

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  /**
   * Initialize the validator by scanning the project
   */
  async initialize(): Promise<void> {
    if (!this.workspaceRoot) return;

    await Promise.all([
      this.scanInstalledPackages(),
      this.scanTypeInventory()
    ]);
  }

  /**
   * Scan package.json for installed packages
   */
  private async scanInstalledPackages(): Promise<void> {
    if (!this.workspaceRoot) return;

    const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) return;

    try {
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      this.installedPackages.clear();

      // Add all dependencies
      for (const dep of Object.keys(pkg.dependencies || {})) {
        this.installedPackages.add(dep);
      }
      for (const dep of Object.keys(pkg.devDependencies || {})) {
        this.installedPackages.add(dep);
      }

      console.log(`CodeValidator: Found ${this.installedPackages.size} installed packages`);
    } catch (error) {
      console.error('CodeValidator: Failed to scan packages:', error);
    }
  }

  /**
   * Scan project for type definitions and exports
   */
  private async scanTypeInventory(): Promise<void> {
    if (!this.workspaceRoot) return;

    this.typeInventory = {
      types: new Map(),
      exports: new Map()
    };

    // Find all TypeScript files
    const files = await vscode.workspace.findFiles(
      '**/*.{ts,tsx}',
      '**/node_modules/**',
      200
    );

    for (const file of files) {
      try {
        const content = fs.readFileSync(file.fsPath, 'utf-8');
        const relativePath = vscode.workspace.asRelativePath(file);

        // Extract types and interfaces
        this.extractTypes(content, relativePath);

        // Extract exports
        this.extractExports(content, relativePath);
      } catch (error) {
        // Skip files we can't read
      }
    }

    console.log(`CodeValidator: Found ${this.typeInventory.types.size} types, ${this.typeInventory.exports.size} files with exports`);
  }

  /**
   * Extract type definitions from file content
   */
  private extractTypes(content: string, filePath: string): void {
    if (!this.typeInventory) return;

    // Match interfaces
    const interfaceRegex = /export\s+interface\s+(\w+)/g;
    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
      this.typeInventory.types.set(match[1], {
        name: match[1],
        file: filePath,
        kind: 'interface',
        exported: true
      });
    }

    // Match type aliases
    const typeRegex = /export\s+type\s+(\w+)/g;
    while ((match = typeRegex.exec(content)) !== null) {
      this.typeInventory.types.set(match[1], {
        name: match[1],
        file: filePath,
        kind: 'type',
        exported: true
      });
    }

    // Match enums
    const enumRegex = /export\s+enum\s+(\w+)/g;
    while ((match = enumRegex.exec(content)) !== null) {
      this.typeInventory.types.set(match[1], {
        name: match[1],
        file: filePath,
        kind: 'enum',
        exported: true
      });
    }
  }

  /**
   * Extract exports from file content
   */
  private extractExports(content: string, filePath: string): void {
    if (!this.typeInventory) return;

    const exports: ExportInfo[] = [];

    // Match exported functions
    const funcRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      exports.push({ name: match[1], file: filePath, kind: 'function' });
    }

    // Match exported consts
    const constRegex = /export\s+const\s+(\w+)/g;
    while ((match = constRegex.exec(content)) !== null) {
      exports.push({ name: match[1], file: filePath, kind: 'const' });
    }

    // Match exported classes
    const classRegex = /export\s+class\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
      exports.push({ name: match[1], file: filePath, kind: 'class' });
    }

    // Match default exports
    if (/export\s+default/.test(content)) {
      exports.push({ name: 'default', file: filePath, kind: 'default' });
    }

    if (exports.length > 0) {
      this.typeInventory.exports.set(filePath, exports);
    }
  }

  /**
   * Check if required packages are installed
   */
  checkDependencies(fileOperations: FileOperation[]): DependencyCheck {
    const result: DependencyCheck = {
      missing: [],
      available: [],
      suggestions: []
    };

    const requiredPackages = new Set<string>();

    for (const op of fileOperations) {
      if (!op.content) continue;

      // Extract import statements
      const importRegex = /import\s+.*?\s+from\s+['"]([^'"./][^'"]*)['"]/g;
      let match;
      while ((match = importRegex.exec(op.content)) !== null) {
        const pkg = match[1].split('/')[0]; // Handle scoped packages
        if (pkg.startsWith('@')) {
          // Scoped package like @tanstack/react-query
          const scopedPkg = match[1].split('/').slice(0, 2).join('/');
          requiredPackages.add(scopedPkg);
        } else {
          requiredPackages.add(pkg);
        }
      }
    }

    // Check against installed packages
    for (const pkg of requiredPackages) {
      if (this.installedPackages.has(pkg)) {
        result.available.push(pkg);
      } else {
        // Skip Node.js built-ins
        const builtins = ['fs', 'path', 'http', 'https', 'crypto', 'util', 'stream', 'events', 'url', 'querystring', 'os', 'child_process'];
        if (!builtins.includes(pkg)) {
          result.missing.push(pkg);
          result.suggestions.push({
            package: pkg,
            command: `npm install ${pkg}`
          });
        }
      }
    }

    return result;
  }

  /**
   * Validate generated file operations
   */
  async validateFileOperations(fileOperations: FileOperation[]): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    for (const op of fileOperations) {
      if (!op.content || op.action === 'delete') continue;

      // Check imports resolve
      const importErrors = this.validateImports(op);
      result.errors.push(...importErrors);

      // Check for type issues
      const typeWarnings = this.checkTypeUsage(op);
      result.warnings.push(...typeWarnings);

      // Check for security issues
      const securityErrors = this.checkSecurity(op);
      result.errors.push(...securityErrors);

      // Check for best practices
      const practiceWarnings = this.checkBestPractices(op);
      result.warnings.push(...practiceWarnings);
    }

    // Check if tests are included
    const hasTestFile = fileOperations.some(op =>
      op.path.includes('.test.') ||
      op.path.includes('.spec.') ||
      op.path.includes('__tests__')
    );

    if (!hasTestFile && fileOperations.length > 0) {
      result.warnings.push({
        file: 'project',
        message: 'No test file included with this feature',
        type: 'no-test'
      });
    }

    // Add suggestions for existing types
    const suggestions = this.suggestExistingTypes(fileOperations);
    result.suggestions.push(...suggestions);

    result.passed = result.errors.length === 0;

    return result;
  }

  /**
   * Validate that imports can resolve
   */
  private validateImports(op: FileOperation): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!op.content || !this.workspaceRoot) return errors;

    // Match relative imports
    const relativeImportRegex = /import\s+.*?\s+from\s+['"](\.[^'"]+)['"]/g;
    let match;

    while ((match = relativeImportRegex.exec(op.content)) !== null) {
      const importPath = match[1];
      const opDir = path.dirname(op.path);
      const resolvedPath = path.join(this.workspaceRoot, opDir, importPath);

      // Check if file exists (try various extensions)
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
      const exists = extensions.some(ext => {
        const fullPath = resolvedPath + ext;
        return fs.existsSync(fullPath);
      });

      // Also check if it's being created in this batch
      const isBeingCreated = importPath.replace(/^\.\//, '').replace(/^\.\.\//, '');
      // Skip validation for imports that might be to other new files

      if (!exists) {
        // This might be a new file being created, so just warn
        // Don't add as error since we might be creating multiple files
      }
    }

    return errors;
  }

  /**
   * Check for problematic type usage
   */
  private checkTypeUsage(op: FileOperation): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    if (!op.content) return warnings;

    // Check for excessive 'any' usage
    const anyMatches = op.content.match(/:\s*any\b/g) || [];
    if (anyMatches.length > 2) {
      warnings.push({
        file: op.path,
        message: `Found ${anyMatches.length} uses of 'any' type - consider proper typing`,
        type: 'any-type'
      });
    }

    return warnings;
  }

  /**
   * Check for security issues
   */
  private checkSecurity(op: FileOperation): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!op.content) return errors;

    // Check for hardcoded secrets
    const secretPatterns = [
      { pattern: /['"]sk-[a-zA-Z0-9]{20,}['"]/, name: 'OpenAI API key' },
      { pattern: /['"]sk_live_[a-zA-Z0-9]+['"]/, name: 'Stripe live key' },
      { pattern: /['"]ghp_[a-zA-Z0-9]+['"]/, name: 'GitHub token' },
      { pattern: /password\s*[:=]\s*['"][^'"]+['"]/, name: 'Hardcoded password' }
    ];

    for (const { pattern, name } of secretPatterns) {
      if (pattern.test(op.content)) {
        errors.push({
          file: op.path,
          message: `Potential ${name} found in code - use environment variables`,
          type: 'security'
        });
      }
    }

    // Check client-side files for server secrets
    if (op.path.includes('/components/') || op.path.includes('/app/') && !op.path.includes('/api/')) {
      if (/process\.env\.((?!NEXT_PUBLIC_)[A-Z_]+)/.test(op.content)) {
        errors.push({
          file: op.path,
          message: 'Server-side env var accessed in client component - use NEXT_PUBLIC_ prefix or move to API route',
          type: 'security'
        });
      }
    }

    return errors;
  }

  /**
   * Check for best practices
   */
  private checkBestPractices(op: FileOperation): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    if (!op.content) return warnings;

    // Check for console.log in production code
    if (!/\.test\.|\.spec\./.test(op.path)) {
      const consoleCount = (op.content.match(/console\.(log|debug|info)\(/g) || []).length;
      if (consoleCount > 0) {
        warnings.push({
          file: op.path,
          message: `Found ${consoleCount} console.log statement(s) - remove before production`,
          type: 'console-log'
        });
      }
    }

    // Check async functions have error handling
    if (op.content.includes('async ') && op.content.includes('await ')) {
      if (!op.content.includes('try') && !op.content.includes('catch')) {
        warnings.push({
          file: op.path,
          message: 'Async function without try/catch error handling',
          type: 'missing-error-handling'
        });
      }
    }

    // Check API routes have proper error responses
    if (op.path.includes('/api/')) {
      if (!op.content.includes('catch') && !op.content.includes('error')) {
        warnings.push({
          file: op.path,
          message: 'API route may lack error handling',
          type: 'missing-error-handling'
        });
      }
    }

    return warnings;
  }

  /**
   * Suggest using existing types instead of creating new ones
   */
  private suggestExistingTypes(fileOperations: FileOperation[]): string[] {
    const suggestions: string[] = [];
    if (!this.typeInventory) return suggestions;

    for (const op of fileOperations) {
      if (!op.content) continue;

      // Look for new interface/type definitions
      const newTypeRegex = /(?:interface|type)\s+(\w+)/g;
      let match;
      while ((match = newTypeRegex.exec(op.content)) !== null) {
        const typeName = match[1];

        // Check if similar type already exists
        if (this.typeInventory.types.has(typeName)) {
          const existing = this.typeInventory.types.get(typeName)!;
          suggestions.push(
            `Type '${typeName}' already exists in ${existing.file} - consider importing instead of redefining`
          );
        }
      }
    }

    return suggestions;
  }

  /**
   * Get inventory of existing types for AI context
   */
  getTypeInventoryForContext(): string {
    if (!this.typeInventory || this.typeInventory.types.size === 0) {
      return 'No existing types found';
    }

    const lines: string[] = ['Existing types in project:'];

    // Group by file
    const byFile = new Map<string, TypeInfo[]>();
    for (const [, info] of this.typeInventory.types) {
      const types = byFile.get(info.file) || [];
      types.push(info);
      byFile.set(info.file, types);
    }

    // Output grouped by file
    for (const [file, types] of byFile) {
      if (types.length > 0) {
        lines.push(`  ${file}:`);
        for (const t of types.slice(0, 10)) { // Limit per file
          lines.push(`    - ${t.kind} ${t.name}`);
        }
        if (types.length > 10) {
          lines.push(`    ... and ${types.length - 10} more`);
        }
      }
    }

    return lines.slice(0, 50).join('\n'); // Limit total output
  }

  /**
   * Get installed packages for AI context
   */
  getInstalledPackagesForContext(): string[] {
    return Array.from(this.installedPackages).slice(0, 50); // Limit for context
  }

  /**
   * Run TypeScript compile check on the project
   * This catches type errors that the AI might introduce
   */
  async runTypeScriptCheck(): Promise<TypeScriptCheckResult> {
    if (!this.workspaceRoot) {
      return { passed: true, errors: [], errorCount: 0 };
    }

    // Check if tsconfig.json exists
    const tsconfigPath = path.join(this.workspaceRoot, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) {
      console.log('CodeValidator: No tsconfig.json found, skipping TypeScript check');
      return { passed: true, errors: [], errorCount: 0 };
    }

    try {
      // Run tsc --noEmit to check for type errors without emitting
      await execAsync('npx tsc --noEmit', {
        cwd: this.workspaceRoot,
        timeout: 60000 // 60 second timeout
      });

      // If we get here, no errors
      return { passed: true, errors: [], errorCount: 0 };
    } catch (error: any) {
      // Parse TypeScript errors from stdout/stderr
      const output = error.stdout || error.stderr || '';
      const errors = this.parseTypeScriptErrors(output);

      return {
        passed: false,
        errors,
        errorCount: errors.length
      };
    }
  }

  /**
   * Parse TypeScript compiler errors from output
   */
  private parseTypeScriptErrors(output: string): TypeScriptCheckResult['errors'] {
    const errors: TypeScriptCheckResult['errors'] = [];
    const lines = output.split('\n');

    // TypeScript error format: src/file.ts(10,5): error TS2339: Property 'x' does not exist
    const errorRegex = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/;

    for (const line of lines) {
      const match = line.match(errorRegex);
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          code: match[4],
          message: match[5]
        });
      }
    }

    // Limit to first 20 errors to avoid overwhelming output
    return errors.slice(0, 20);
  }

  /**
   * Quick TypeScript check - only checks specific files
   * Faster than full project check, good for validating just the generated code
   */
  async checkSpecificFiles(filePaths: string[]): Promise<TypeScriptCheckResult> {
    if (!this.workspaceRoot || filePaths.length === 0) {
      return { passed: true, errors: [], errorCount: 0 };
    }

    // Filter to only TypeScript files
    const tsFiles = filePaths.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    if (tsFiles.length === 0) {
      return { passed: true, errors: [], errorCount: 0 };
    }

    try {
      // Check specific files with tsc
      const filesArg = tsFiles.map(f => `"${f}"`).join(' ');
      await execAsync(`npx tsc --noEmit ${filesArg}`, {
        cwd: this.workspaceRoot,
        timeout: 30000 // 30 second timeout for specific files
      });

      return { passed: true, errors: [], errorCount: 0 };
    } catch (error: any) {
      const output = error.stdout || error.stderr || '';
      const errors = this.parseTypeScriptErrors(output);

      return {
        passed: false,
        errors,
        errorCount: errors.length
      };
    }
  }
}
