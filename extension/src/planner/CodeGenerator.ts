/**
 * Code Generator - Generates code files from the build plan
 *
 * Takes plan nodes and generates production-ready code using CodeBakers patterns.
 * Handles all node types: pages, components, APIs, database schemas, types, etc.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  Plan,
  PlanNode,
  GeneratedFile,
  GenerationRequest,
  GenerationResult,
  PlanNodeType,
} from './types';

// ============================================================================
// Code Generator Class
// ============================================================================

export class CodeGenerator {
  private workspaceRoot: string;
  private apiEndpoint: string;

  constructor() {
    console.log('CodeGenerator: Initializing...');

    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      this.workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';

      const config = vscode.workspace.getConfiguration('codebakers');
      this.apiEndpoint = config.get('apiEndpoint') || 'https://www.codebakers.ai';

      console.log('CodeGenerator: Initialized with workspace:', this.workspaceRoot || '(no workspace)');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('CodeGenerator: Initialization failed:', errorMessage);
      this.workspaceRoot = '';
      this.apiEndpoint = 'https://www.codebakers.ai';
    }
  }

  // ==========================================================================
  // Main Generation Method
  // ==========================================================================

  async generate(
    plan: Plan,
    request: GenerationRequest,
    onProgress?: (nodeId: string, status: 'generating' | 'done' | 'error', file?: GeneratedFile) => void
  ): Promise<GenerationResult> {
    console.log('CodeGenerator: Starting generation, dryRun:', request.dryRun, 'usePatterns:', request.usePatterns);
    const startTime = Date.now();
    const files: GeneratedFile[] = [];
    const errors: { nodeId: string; error: string }[] = [];

    try {
      // Determine which nodes to generate
      const nodesToGenerate =
        request.nodes.length > 0
          ? plan.nodes.filter((n) => request.nodes.includes(n.id))
          : plan.nodes;

      console.log('CodeGenerator: Generating', nodesToGenerate.length, 'nodes');

      // Sort nodes by dependency order (types first, then database, then APIs, etc.)
      const sortedNodes = this.sortByDependency(nodesToGenerate, plan);
      console.log('CodeGenerator: Sorted nodes by dependency order');

      for (const node of sortedNodes) {
        try {
          console.log('CodeGenerator: Generating node:', node.name, 'type:', node.type);
          onProgress?.(node.id, 'generating');

          const generatedFile = await this.generateNode(node, plan, request.usePatterns);
          console.log('CodeGenerator: Generated file:', generatedFile.path);

          if (!request.dryRun) {
            console.log('CodeGenerator: Writing file to disk...');
            await this.writeFile(generatedFile);
            generatedFile.status = 'written';
            console.log('CodeGenerator: File written successfully');
          } else {
            generatedFile.status = 'pending';
          }

          files.push(generatedFile);
          onProgress?.(node.id, 'done', generatedFile);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('CodeGenerator: Failed to generate node:', node.name, 'error:', errorMessage);
          errors.push({ nodeId: node.id, error: errorMessage });
          onProgress?.(node.id, 'error', {
            path: '',
            content: '',
            nodeId: node.id,
            status: 'error',
            error: errorMessage,
          });
        }
      }

      const duration = Date.now() - startTime;
      console.log('CodeGenerator: Generation completed in', duration, 'ms,', files.length, 'files,', errors.length, 'errors');

      return {
        success: errors.length === 0,
        files,
        errors,
        duration,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('CodeGenerator: Generation failed:', errorMessage);
      console.error('CodeGenerator: Stack:', error instanceof Error ? error.stack : 'No stack');

      return {
        success: false,
        files,
        errors: [...errors, { nodeId: 'unknown', error: errorMessage }],
        duration: Date.now() - startTime,
      };
    }
  }

  // ==========================================================================
  // Node-Specific Code Generation
  // ==========================================================================

  private async generateNode(
    node: PlanNode,
    plan: Plan,
    usePatterns: boolean
  ): Promise<GeneratedFile> {
    console.log('CodeGenerator: generateNode called for:', node.name, 'type:', node.type);

    let filePath: string;
    let content: string;

    try {
      switch (node.type) {
      case 'page':
        filePath = this.getPagePath(node);
        content = this.generatePageCode(node, plan);
        break;

      case 'component':
        filePath = this.getComponentPath(node);
        content = this.generateComponentCode(node, plan);
        break;

      case 'api':
        filePath = this.getApiPath(node);
        content = this.generateApiCode(node, plan);
        break;

      case 'database':
        filePath = this.getDatabasePath(node);
        content = this.generateDatabaseCode(node, plan);
        break;

      case 'type':
        filePath = this.getTypePath(node);
        content = this.generateTypeCode(node, plan);
        break;

      case 'hook':
        filePath = this.getHookPath(node);
        content = this.generateHookCode(node, plan);
        break;

      case 'service':
        filePath = this.getServicePath(node);
        content = this.generateServiceCode(node, plan);
        break;

      case 'middleware':
        filePath = this.getMiddlewarePath(node);
        content = this.generateMiddlewareCode(node, plan);
        break;

      case 'context':
        filePath = this.getContextPath(node);
        content = this.generateContextCode(node, plan);
        break;

      case 'action':
        filePath = this.getActionPath(node);
        content = this.generateActionCode(node, plan);
        break;

      case 'job':
        filePath = this.getJobPath(node);
        content = this.generateJobCode(node, plan);
        break;

      default:
        throw new Error(`Unknown node type: ${(node as PlanNode).type}`);
    }

      console.log('CodeGenerator: Generated file path:', filePath);
      return {
        path: filePath,
        content,
        nodeId: node.id,
        status: 'pending',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('CodeGenerator: generateNode failed for:', node.name, 'error:', errorMessage);
      throw error;
    }
  }

  // ==========================================================================
  // Path Generators
  // ==========================================================================

  private getPagePath(node: PlanNode): string {
    const route = node.details.route || this.nameToRoute(node.name);
    // Convert /user-profile to app/user-profile/page.tsx
    const routePath = route === '/' ? '' : route.replace(/^\//, '');
    return path.join('src', 'app', routePath, 'page.tsx');
  }

  private getComponentPath(node: PlanNode): string {
    const componentName = this.toPascalCase(node.name);
    return path.join('src', 'components', `${componentName}.tsx`);
  }

  private getApiPath(node: PlanNode): string {
    const apiName = this.toKebabCase(node.name.replace(/Api$|Route$/i, ''));
    return path.join('src', 'app', 'api', apiName, 'route.ts');
  }

  private getDatabasePath(node: PlanNode): string {
    const tableName = this.toKebabCase(node.name.replace(/Table$/i, ''));
    return path.join('src', 'db', 'schema', `${tableName}.ts`);
  }

  private getTypePath(node: PlanNode): string {
    const typeName = this.toKebabCase(node.name.replace(/Type$/i, ''));
    return path.join('src', 'types', `${typeName}.ts`);
  }

  private getHookPath(node: PlanNode): string {
    const hookName = node.name.startsWith('use') ? node.name : `use${this.toPascalCase(node.name)}`;
    return path.join('src', 'hooks', `${hookName}.ts`);
  }

  private getServicePath(node: PlanNode): string {
    const serviceName = this.toKebabCase(node.name.replace(/Service$/i, ''));
    return path.join('src', 'services', `${serviceName}.ts`);
  }

  private getMiddlewarePath(node: PlanNode): string {
    return path.join('src', 'middleware', `${this.toKebabCase(node.name)}.ts`);
  }

  private getContextPath(node: PlanNode): string {
    const contextName = this.toPascalCase(node.name.replace(/Context$|Provider$/i, ''));
    return path.join('src', 'contexts', `${contextName}Context.tsx`);
  }

  private getActionPath(node: PlanNode): string {
    const actionName = this.toKebabCase(node.name.replace(/Action$/i, ''));
    return path.join('src', 'actions', `${actionName}.ts`);
  }

  private getJobPath(node: PlanNode): string {
    const jobName = this.toKebabCase(node.name.replace(/Job$/i, ''));
    return path.join('src', 'jobs', `${jobName}.ts`);
  }

  // ==========================================================================
  // Code Generators
  // ==========================================================================

  private generatePageCode(node: PlanNode, plan: Plan): string {
    const pageName = this.toPascalCase(node.name.replace(/Page$/i, '')) + 'Page';
    const isProtected = node.details.isProtected ?? false;

    // Find components this page renders
    const renderedComponents = plan.edges
      .filter((e) => e.source === node.id && e.type === 'renders')
      .map((e) => plan.nodes.find((n) => n.id === e.target))
      .filter(Boolean) as PlanNode[];

    const imports: string[] = [];

    if (isProtected) {
      imports.push(`import { auth } from '@/lib/auth';`);
      imports.push(`import { redirect } from 'next/navigation';`);
    }

    renderedComponents.forEach((comp) => {
      const compName = this.toPascalCase(comp.name);
      imports.push(`import { ${compName} } from '@/components/${compName}';`);
    });

    let code = `/**
 * ${node.description || pageName}
 * Route: ${node.details.route || '/'}
 * Generated by CodeBakers Build Planner
 */

${imports.join('\n')}

export default async function ${pageName}() {
`;

    if (isProtected) {
      code += `  const session = await auth();

  if (!session) {
    redirect('/login');
  }

`;
    }

    code += `  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">${node.name.replace(/Page$/i, '')}</h1>
`;

    if (renderedComponents.length > 0) {
      renderedComponents.forEach((comp) => {
        const compName = this.toPascalCase(comp.name);
        code += `      <${compName} />\n`;
      });
    } else {
      code += `      {/* Add your page content here */}\n`;
    }

    code += `    </div>
  );
}
`;

    return code;
  }

  private generateComponentCode(node: PlanNode, plan: Plan): string {
    const componentName = this.toPascalCase(node.name);
    const props = node.details.props || [];

    let propsInterface = '';
    let propsDestructure = '';

    if (props.length > 0) {
      propsInterface = `interface ${componentName}Props {\n`;
      props.forEach((prop) => {
        const optional = prop.required ? '' : '?';
        propsInterface += `  ${prop.name}${optional}: ${prop.type};\n`;
      });
      propsInterface += `}\n\n`;

      propsDestructure = `{ ${props.map((p) => p.name).join(', ')} }: ${componentName}Props`;
    }

    const code = `/**
 * ${node.description || componentName}
 * Generated by CodeBakers Build Planner
 */

'use client';

import { useState } from 'react';

${propsInterface}export function ${componentName}(${propsDestructure}) {
  ${node.details.hasState ? "const [state, setState] = useState();\n" : ''}
  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-xl font-semibold">${componentName}</h2>
      {/* Add component content here */}
    </div>
  );
}
`;

    return code;
  }

  private generateApiCode(node: PlanNode, plan: Plan): string {
    const method = node.details.httpMethod || 'GET';
    const requiresAuth = node.details.requiresAuth ?? true;

    // Find database tables this API queries/mutates
    const dbConnections = plan.edges
      .filter((e) => e.source === node.id && (e.type === 'queries' || e.type === 'mutates'))
      .map((e) => ({
        table: plan.nodes.find((n) => n.id === e.target),
        type: e.type,
      }))
      .filter((c) => c.table) as { table: PlanNode; type: string }[];

    const imports = [`import { NextRequest, NextResponse } from 'next/server';`];

    if (requiresAuth) {
      imports.push(`import { auth } from '@/lib/auth';`);
    }

    if (dbConnections.length > 0) {
      imports.push(`import { db } from '@/db';`);
      dbConnections.forEach(({ table }) => {
        const tableName = this.toCamelCase(table.name.replace(/Table$/i, ''));
        imports.push(`import { ${tableName} } from '@/db/schema/${this.toKebabCase(table.name.replace(/Table$/i, ''))}';`);
      });
    }

    let code = `/**
 * ${node.description || node.name}
 * ${method} /api/${this.toKebabCase(node.name.replace(/Api$|Route$/i, ''))}
 * Generated by CodeBakers Build Planner
 */

${imports.join('\n')}

export async function ${method}(request: NextRequest) {
  try {
`;

    if (requiresAuth) {
      code += `    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

`;
    }

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      code += `    const body = await request.json();

    // TODO: Validate input with Zod
    // const validated = schema.parse(body);

`;
    }

    if (dbConnections.length > 0 && dbConnections[0].type === 'queries') {
      const tableName = this.toCamelCase(dbConnections[0].table.name.replace(/Table$/i, ''));
      code += `    const result = await db.select().from(${tableName});

    return NextResponse.json(result);
`;
    } else if (dbConnections.length > 0 && dbConnections[0].type === 'mutates') {
      const tableName = this.toCamelCase(dbConnections[0].table.name.replace(/Table$/i, ''));
      code += `    const result = await db.insert(${tableName}).values(body).returning();

    return NextResponse.json(result[0], { status: 201 });
`;
    } else {
      code += `    // TODO: Implement ${method} logic

    return NextResponse.json({ message: 'Success' });
`;
    }

    code += `  } catch (error) {
    console.error('${node.name} error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
`;

    return code;
  }

  private generateDatabaseCode(node: PlanNode, plan: Plan): string {
    const tableName = node.details.tableName || this.toSnakeCase(node.name.replace(/Table$/i, '')) + 's';
    const columns = node.details.columns || [];
    const relations = node.details.relations || [];

    let code = `/**
 * ${node.description || node.name}
 * Table: ${tableName}
 * Generated by CodeBakers Build Planner
 */

import { pgTable, serial, text, timestamp, integer, boolean, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const ${this.toCamelCase(tableName)} = pgTable('${tableName}', {
`;

    // Add columns
    if (columns.length === 0) {
      // Default columns
      code += `  id: serial('id').primaryKey(),\n`;
      code += `  createdAt: timestamp('created_at').defaultNow().notNull(),\n`;
      code += `  updatedAt: timestamp('updated_at').defaultNow().notNull(),\n`;
    } else {
      columns.forEach((col) => {
        const drizzleType = this.sqlToDrizzleType(col.type);
        let line = `  ${this.toCamelCase(col.name)}: ${drizzleType}('${col.name}')`;

        if (col.name === 'id' && col.type === 'serial') {
          line += '.primaryKey()';
        }
        if (col.required) {
          line += '.notNull()';
        }
        if (col.defaultValue) {
          line += `.default(${col.defaultValue})`;
        }
        if (col.name.includes('created') || col.name.includes('updated')) {
          line += '.defaultNow()';
        }

        code += line + ',\n';
      });
    }

    code += `});\n`;

    // Add relations if any
    if (relations.length > 0) {
      const varName = this.toCamelCase(tableName);
      code += `\nexport const ${varName}Relations = relations(${varName}, ({ one, many }) => ({\n`;

      relations.forEach((rel) => {
        const targetTable = this.toCamelCase(rel.target);
        const relType = rel.type === 'one-to-one' || rel.type === 'many-to-many' ? 'one' : 'many';
        code += `  ${targetTable}: ${relType}(${targetTable}),\n`;
      });

      code += `}));\n`;
    }

    // Add type export
    code += `\nexport type ${this.toPascalCase(node.name.replace(/Table$/i, ''))} = typeof ${this.toCamelCase(tableName)}.$inferSelect;\n`;
    code += `export type New${this.toPascalCase(node.name.replace(/Table$/i, ''))} = typeof ${this.toCamelCase(tableName)}.$inferInsert;\n`;

    return code;
  }

  private generateTypeCode(node: PlanNode, plan: Plan): string {
    const typeName = this.toPascalCase(node.name.replace(/Type$/i, ''));
    const fields = node.details.fields || [];
    const extendsType = node.details.extends;

    let code = `/**
 * ${node.description || typeName}
 * Generated by CodeBakers Build Planner
 */

`;

    const extendsClause = extendsType ? ` extends ${extendsType}` : '';

    code += `export interface ${typeName}${extendsClause} {\n`;

    if (fields.length === 0) {
      code += `  id: string;\n`;
      code += `  createdAt: Date;\n`;
      code += `  updatedAt: Date;\n`;
    } else {
      fields.forEach((field) => {
        const optional = field.required ? '' : '?';
        if (field.description) {
          code += `  /** ${field.description} */\n`;
        }
        code += `  ${field.name}${optional}: ${field.type};\n`;
      });
    }

    code += `}\n`;

    return code;
  }

  private generateHookCode(node: PlanNode, plan: Plan): string {
    const hookName = node.name.startsWith('use') ? node.name : `use${this.toPascalCase(node.name)}`;
    const dependencies = node.details.dependencies || [];
    const returnValue = node.details.returnValue || 'void';

    // Find APIs this hook calls
    const apiCalls = plan.edges
      .filter((e) => e.source === node.id && e.type === 'calls')
      .map((e) => plan.nodes.find((n) => n.id === e.target && n.type === 'api'))
      .filter(Boolean) as PlanNode[];

    const imports = [`import { useState, useEffect } from 'react';`];

    let code = `/**
 * ${node.description || hookName}
 * Generated by CodeBakers Build Planner
 */

${imports.join('\n')}

export function ${hookName}(${dependencies.map((d) => `${d}: any`).join(', ')}) {
  const [data, setData] = useState<${returnValue} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

`;

    if (apiCalls.length > 0) {
      const api = apiCalls[0];
      const apiPath = `/api/${this.toKebabCase(api.name.replace(/Api$|Route$/i, ''))}`;

      code += `  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('${apiPath}');

        if (!response.ok) {
          throw new Error('Failed to fetch');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [${dependencies.join(', ')}]);

`;
    }

    code += `  return { data, loading, error };
}
`;

    return code;
  }

  private generateServiceCode(node: PlanNode, plan: Plan): string {
    const serviceName = this.toPascalCase(node.name.replace(/Service$/i, '')) + 'Service';
    const methods = node.details.methods || [];

    let code = `/**
 * ${node.description || serviceName}
 * Generated by CodeBakers Build Planner
 */

export const ${this.toCamelCase(serviceName)} = {
`;

    if (methods.length === 0) {
      code += `  // TODO: Add service methods\n`;
    } else {
      methods.forEach((method, index) => {
        const asyncKeyword = method.isAsync ? 'async ' : '';
        code += `  ${asyncKeyword}${method.name}(${method.params}): ${method.returnType} {\n`;
        code += `    // TODO: Implement ${method.name}\n`;
        code += `    throw new Error('Not implemented');\n`;
        code += `  }${index < methods.length - 1 ? ',' : ''}\n`;
      });
    }

    code += `};\n`;

    return code;
  }

  private generateMiddlewareCode(node: PlanNode, plan: Plan): string {
    const middlewareName = this.toCamelCase(node.name);

    const code = `/**
 * ${node.description || middlewareName}
 * Generated by CodeBakers Build Planner
 */

import { NextRequest, NextResponse } from 'next/server';

export function ${middlewareName}(request: NextRequest) {
  // TODO: Implement middleware logic

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Add route matchers here
    '/api/:path*',
  ],
};
`;

    return code;
  }

  private generateContextCode(node: PlanNode, plan: Plan): string {
    const contextName = this.toPascalCase(node.name.replace(/Context$|Provider$/i, ''));

    const code = `/**
 * ${node.description || contextName + 'Context'}
 * Generated by CodeBakers Build Planner
 */

'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface ${contextName}ContextType {
  // TODO: Define context type
  value: unknown;
  setValue: (value: unknown) => void;
}

const ${contextName}Context = createContext<${contextName}ContextType | undefined>(undefined);

export function ${contextName}Provider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<unknown>(null);

  return (
    <${contextName}Context.Provider value={{ value, setValue }}>
      {children}
    </${contextName}Context.Provider>
  );
}

export function use${contextName}() {
  const context = useContext(${contextName}Context);

  if (context === undefined) {
    throw new Error('use${contextName} must be used within a ${contextName}Provider');
  }

  return context;
}
`;

    return code;
  }

  private generateActionCode(node: PlanNode, plan: Plan): string {
    const actionName = this.toCamelCase(node.name.replace(/Action$/i, ''));
    const formFields = node.details.formFields || [];

    let code = `/**
 * ${node.description || actionName}
 * Server Action
 * Generated by CodeBakers Build Planner
 */

'use server';

import { revalidatePath } from 'next/cache';

`;

    // Generate Zod schema if there are form fields
    if (formFields.length > 0) {
      code += `import { z } from 'zod';\n\n`;
      code += `const ${actionName}Schema = z.object({\n`;
      formFields.forEach((field) => {
        let zodType = 'z.string()';
        if (field.type === 'number') zodType = 'z.number()';
        if (field.type === 'boolean') zodType = 'z.boolean()';
        if (!field.required) zodType += '.optional()';
        code += `  ${field.name}: ${zodType},\n`;
      });
      code += `});\n\n`;
    }

    code += `export async function ${actionName}(formData: FormData) {
  try {
`;

    if (formFields.length > 0) {
      code += `    const rawData = Object.fromEntries(formData);\n`;
      code += `    const validated = ${actionName}Schema.parse(rawData);\n\n`;
      code += `    // TODO: Implement action logic with validated data\n`;
    } else {
      code += `    // TODO: Implement action logic\n`;
    }

    code += `
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('${actionName} error:', error);
    return { success: false, error: 'Action failed' };
  }
}
`;

    return code;
  }

  private generateJobCode(node: PlanNode, plan: Plan): string {
    const jobName = this.toCamelCase(node.name.replace(/Job$/i, ''));
    const schedule = node.details.schedule || '0 0 * * *'; // Default: daily at midnight

    const code = `/**
 * ${node.description || jobName}
 * Schedule: ${schedule}
 * Generated by CodeBakers Build Planner
 */

import { inngest } from '@/lib/inngest';

export const ${jobName} = inngest.createFunction(
  { id: '${this.toKebabCase(jobName)}' },
  { cron: '${schedule}' },
  async ({ event, step }) => {
    // TODO: Implement job logic

    await step.run('process', async () => {
      console.log('Running ${jobName}...');
    });

    return { success: true };
  }
);
`;

    return code;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private sortByDependency(nodes: PlanNode[], plan: Plan): PlanNode[] {
    const order: Record<PlanNodeType, number> = {
      type: 1,
      database: 2,
      service: 3,
      middleware: 4,
      context: 5,
      hook: 6,
      action: 7,
      api: 8,
      component: 9,
      page: 10,
      job: 11,
    };

    return [...nodes].sort((a, b) => order[a.type] - order[b.type]);
  }

  private async writeFile(file: GeneratedFile): Promise<void> {
    console.log('CodeGenerator: Writing file:', file.path);

    try {
      const fullPath = path.join(this.workspaceRoot, file.path);
      const uri = vscode.Uri.file(fullPath);

      // Ensure directory exists
      const dirPath = path.dirname(fullPath);
      console.log('CodeGenerator: Creating directory:', dirPath);
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));

      // Write file
      console.log('CodeGenerator: Writing', file.content.length, 'bytes to:', fullPath);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(file.content, 'utf8'));
      console.log('CodeGenerator: File written successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('CodeGenerator: writeFile failed:', file.path, 'error:', errorMessage);
      throw error;
    }
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, (_, c) => c.toUpperCase());
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .toLowerCase();
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
  }

  private nameToRoute(name: string): string {
    return '/' + this.toKebabCase(name.replace(/Page$/i, ''));
  }

  private sqlToDrizzleType(sqlType: string): string {
    const mapping: Record<string, string> = {
      serial: 'serial',
      integer: 'integer',
      int: 'integer',
      bigint: 'integer',
      text: 'text',
      varchar: 'varchar',
      boolean: 'boolean',
      timestamp: 'timestamp',
      date: 'timestamp',
    };
    return mapping[sqlType.toLowerCase()] || 'text';
  }
}
