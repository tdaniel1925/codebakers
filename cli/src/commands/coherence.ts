import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, relative, resolve, dirname, basename, extname } from 'path';

interface CoherenceIssue {
  category: 'import' | 'export' | 'type' | 'schema' | 'api' | 'env' | 'circular' | 'dead-code';
  severity: 'error' | 'warning' | 'info';
  file: string;
  line?: number;
  message: string;
  fix?: string;
  autoFixable: boolean;
}

interface CoherenceOptions {
  focus?: string;
  fix?: boolean;
  verbose?: boolean;
}

/**
 * CLI coherence command - checks wiring and dependencies
 */
export async function coherence(options: CoherenceOptions = {}): Promise<void> {
  const { focus = 'all', fix = false, verbose = false } = options;
  const cwd = process.cwd();

  console.log(chalk.blue(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold.white('🔗 CodeBakers Coherence Audit')}                         ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  const spinner = ora('Scanning codebase for coherence issues...').start();

  const issues: CoherenceIssue[] = [];
  const stats = {
    filesScanned: 0,
    importsChecked: 0,
    exportsFound: 0,
    envVarsFound: 0,
  };

  // Helper to extract imports from a file
  const extractImports = (content: string): Array<{ path: string; names: string[]; line: number }> => {
    const imports: Array<{ path: string; names: string[]; line: number }> = [];
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      // Match: import { X, Y } from 'path'
      const namedMatch = line.match(/import\s+(type\s+)?{([^}]+)}\s+from\s+['"]([^'"]+)['"]/);
      if (namedMatch) {
        const names = namedMatch[2].split(',').map(n => n.trim().split(' as ')[0].trim()).filter(Boolean);
        imports.push({ path: namedMatch[3], names, line: i + 1 });
      }

      // Match: import X from 'path'
      const defaultMatch = line.match(/import\s+(type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/);
      if (defaultMatch && !namedMatch) {
        imports.push({ path: defaultMatch[3], names: ['default'], line: i + 1 });
      }
    });

    return imports;
  };

  // Helper to extract exports from a file
  const extractExports = (content: string): string[] => {
    const exports: string[] = [];

    // Named exports: export { X, Y }
    const namedExportMatches = content.matchAll(/export\s+{([^}]+)}/g);
    for (const match of namedExportMatches) {
      const names = match[1].split(',').map(n => n.trim().split(' as ').pop()?.trim() || '').filter(Boolean);
      exports.push(...names);
    }

    // Direct exports: export const/function/class/type/interface X
    const directExportMatches = content.matchAll(/export\s+(const|let|var|function|class|type|interface|enum)\s+(\w+)/g);
    for (const match of directExportMatches) {
      exports.push(match[2]);
    }

    // Default export
    if (content.includes('export default')) {
      exports.push('default');
    }

    return exports;
  };

  // Helper to resolve import path to file
  const resolveImportPath = (importPath: string, fromFile: string): string | null => {
    if (!importPath.startsWith('.') && !importPath.startsWith('@/') && !importPath.startsWith('~/')) {
      return null;
    }

    let resolvedPath = importPath;
    if (importPath.startsWith('@/')) {
      resolvedPath = join(cwd, 'src', importPath.slice(2));
    } else if (importPath.startsWith('~/')) {
      resolvedPath = join(cwd, importPath.slice(2));
    } else {
      resolvedPath = resolve(dirname(fromFile), importPath);
    }

    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
    for (const ext of extensions) {
      const fullPath = resolvedPath + ext;
      if (existsSync(fullPath) && statSync(fullPath).isFile()) {
        return fullPath;
      }
    }

    return null;
  };

  const searchDirs = ['src', 'app', 'lib', 'components', 'services', 'types', 'utils', 'hooks', 'pages'];
  const fileExtensions = ['.ts', '.tsx', '.js', '.jsx'];

  // Build export map
  const exportMap: Map<string, string[]> = new Map();
  const importGraph: Map<string, string[]> = new Map();
  const usedExports: Set<string> = new Set();

  // First pass: collect all exports
  const collectExports = (dir: string) => {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        collectExports(fullPath);
      } else if (entry.isFile() && fileExtensions.some(ext => entry.name.endsWith(ext))) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const exports = extractExports(content);
          exportMap.set(fullPath, exports);
          stats.exportsFound += exports.length;
          stats.filesScanned++;
        } catch {
          // Skip unreadable files
        }
      }
    }
  };

  spinner.text = 'Collecting exports...';
  for (const dir of searchDirs) {
    collectExports(join(cwd, dir));
  }

  // Second pass: check imports
  const checkImports = (dir: string) => {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        checkImports(fullPath);
      } else if (entry.isFile() && fileExtensions.some(ext => entry.name.endsWith(ext))) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const imports = extractImports(content);
          const relativePath = relative(cwd, fullPath);
          const importedFiles: string[] = [];

          for (const imp of imports) {
            stats.importsChecked++;
            const resolvedPath = resolveImportPath(imp.path, fullPath);

            if (resolvedPath === null) continue;

            importedFiles.push(resolvedPath);

            if (!existsSync(resolvedPath)) {
              if (focus === 'all' || focus === 'imports') {
                issues.push({
                  category: 'import',
                  severity: 'error',
                  file: relativePath,
                  line: imp.line,
                  message: `Import target not found: '${imp.path}'`,
                  fix: `Create the file or update the import path`,
                  autoFixable: false,
                });
              }
              continue;
            }

            const targetExports = exportMap.get(resolvedPath) || [];

            for (const name of imp.names) {
              if (name === '*' || name === 'default') {
                if (name === 'default' && !targetExports.includes('default')) {
                  if (focus === 'all' || focus === 'imports') {
                    issues.push({
                      category: 'import',
                      severity: 'error',
                      file: relativePath,
                      line: imp.line,
                      message: `No default export in '${imp.path}'`,
                      fix: `Add 'export default' or change to named import`,
                      autoFixable: false,
                    });
                  }
                }
                continue;
              }

              usedExports.add(`${resolvedPath}:${name}`);

              if (!targetExports.includes(name)) {
                if (focus === 'all' || focus === 'imports') {
                  issues.push({
                    category: 'export',
                    severity: 'error',
                    file: relativePath,
                    line: imp.line,
                    message: `'${name}' is not exported from '${imp.path}'`,
                    fix: `Add 'export { ${name} }' to ${basename(resolvedPath)} or update import`,
                    autoFixable: false,
                  });
                }
              }
            }
          }

          importGraph.set(fullPath, importedFiles);
        } catch {
          // Skip unreadable files
        }
      }
    }
  };

  spinner.text = 'Checking imports...';
  for (const dir of searchDirs) {
    checkImports(join(cwd, dir));
  }

  // Check for circular dependencies
  if (focus === 'all' || focus === 'circular') {
    spinner.text = 'Detecting circular dependencies...';
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circularPaths: string[][] = [];

    const detectCircular = (file: string, pathStack: string[]) => {
      if (recursionStack.has(file)) {
        const cycleStart = pathStack.indexOf(file);
        if (cycleStart !== -1) {
          circularPaths.push(pathStack.slice(cycleStart).concat(file));
        }
        return;
      }

      if (visited.has(file)) return;

      visited.add(file);
      recursionStack.add(file);

      const imports = importGraph.get(file) || [];
      for (const imported of imports) {
        detectCircular(imported, [...pathStack, file]);
      }

      recursionStack.delete(file);
    };

    for (const file of importGraph.keys()) {
      detectCircular(file, []);
    }

    const seenCycles = new Set<string>();
    for (const cycle of circularPaths) {
      const cycleKey = cycle.map(f => relative(cwd, f)).sort().join(' -> ');
      if (!seenCycles.has(cycleKey)) {
        seenCycles.add(cycleKey);
        issues.push({
          category: 'circular',
          severity: 'warning',
          file: relative(cwd, cycle[0]),
          message: `Circular dependency: ${cycle.map(f => basename(f)).join(' → ')}`,
          fix: 'Break the cycle by extracting shared code to a separate module',
          autoFixable: false,
        });
      }
    }
  }

  // Check environment variables
  if (focus === 'all' || focus === 'env') {
    spinner.text = 'Checking environment variables...';
    const envVarsUsed = new Set<string>();
    const envVarsDefined = new Set<string>();

    const scanEnvUsage = (dir: string) => {
      if (!existsSync(dir)) return;
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scanEnvUsage(fullPath);
        } else if (entry.isFile() && fileExtensions.some(ext => entry.name.endsWith(ext))) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            const envMatches = content.matchAll(/process\.env\.(\w+)|process\.env\[['"](\w+)['"]\]/g);
            for (const match of envMatches) {
              const varName = match[1] || match[2];
              envVarsUsed.add(varName);
              stats.envVarsFound++;
            }
          } catch {
            // Skip
          }
        }
      }
    };

    for (const dir of searchDirs) {
      scanEnvUsage(join(cwd, dir));
    }

    const envFiles = ['.env', '.env.local', '.env.example', '.env.development'];
    for (const envFile of envFiles) {
      const envPath = join(cwd, envFile);
      if (existsSync(envPath)) {
        try {
          const content = readFileSync(envPath, 'utf-8');
          const lines = content.split('\n');
          for (const line of lines) {
            const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
            if (match) {
              envVarsDefined.add(match[1]);
            }
          }
        } catch {
          // Skip
        }
      }
    }

    for (const varName of envVarsUsed) {
      if (varName.startsWith('NEXT_') || varName === 'NODE_ENV') continue;

      if (!envVarsDefined.has(varName)) {
        issues.push({
          category: 'env',
          severity: 'warning',
          file: '.env.example',
          message: `Environment variable '${varName}' is used but not defined in .env files`,
          fix: `Add ${varName}= to .env.example`,
          autoFixable: true,
        });
      }
    }
  }

  spinner.succeed('Coherence audit complete!');

  // Display results
  console.log('');
  console.log(chalk.white('  📊 Summary'));
  console.log(chalk.gray('  ─────────────────────────────────────'));
  console.log(`  Files scanned:    ${chalk.cyan(stats.filesScanned)}`);
  console.log(`  Imports checked:  ${chalk.cyan(stats.importsChecked)}`);
  console.log(`  Exports found:    ${chalk.cyan(stats.exportsFound)}`);

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos = issues.filter(i => i.severity === 'info');

  console.log('');
  console.log(`  ${chalk.red('🔴 Errors:')}     ${errors.length}`);
  console.log(`  ${chalk.yellow('🟡 Warnings:')}   ${warnings.length}`);
  console.log(`  ${chalk.blue('🔵 Info:')}       ${infos.length}`);
  console.log('');

  if (issues.length === 0) {
    console.log(chalk.green('  ✅ No coherence issues found! Your codebase wiring is solid.\n'));
    return;
  }

  // Group issues by category
  const categories: Record<string, CoherenceIssue[]> = {
    import: [],
    export: [],
    circular: [],
    env: [],
    'dead-code': [],
  };

  for (const issue of issues) {
    if (categories[issue.category]) {
      categories[issue.category].push(issue);
    }
  }

  const categoryLabels: Record<string, string> = {
    import: '🔴 Broken Imports',
    export: '🔴 Missing Exports',
    circular: '⚪ Circular Dependencies',
    env: '🟡 Environment Variables',
    'dead-code': '🔵 Dead Code',
  };

  for (const [category, catIssues] of Object.entries(categories)) {
    if (catIssues.length === 0) continue;

    console.log(chalk.white(`  ${categoryLabels[category]} (${catIssues.length})`));
    console.log(chalk.gray('  ─────────────────────────────────────'));

    const displayIssues = verbose ? catIssues : catIssues.slice(0, 5);
    for (const issue of displayIssues) {
      const severityColor = issue.severity === 'error' ? chalk.red : issue.severity === 'warning' ? chalk.yellow : chalk.blue;
      console.log(`  ${severityColor('•')} ${chalk.gray(issue.file)}${issue.line ? chalk.gray(`:${issue.line}`) : ''}`);
      console.log(`    ${issue.message}`);
      if (issue.fix) {
        console.log(chalk.gray(`    Fix: ${issue.fix}`));
      }
    }

    if (!verbose && catIssues.length > 5) {
      console.log(chalk.gray(`    ... and ${catIssues.length - 5} more (use --verbose to see all)`));
    }
    console.log('');
  }

  // Save state
  const statePath = join(cwd, '.codebakers', 'coherence-state.json');
  try {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify({
      lastAudit: new Date().toISOString(),
      stats,
      issues,
      summary: { errors: errors.length, warnings: warnings.length, info: infos.length },
    }, null, 2));
  } catch {
    // Ignore write errors
  }

  console.log(chalk.gray('  Run ') + chalk.cyan('npx tsc --noEmit') + chalk.gray(' to verify TypeScript compiles'));
  console.log(chalk.gray('  Run ') + chalk.cyan('codebakers heal') + chalk.gray(' to auto-fix what\'s possible\n'));
}
