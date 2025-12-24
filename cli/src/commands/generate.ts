import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

async function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Convert to PascalCase
function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

// Convert to kebab-case
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

// Convert to camelCase
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// Component template
function componentTemplate(name: string, hasProps: boolean): string {
  const pascalName = toPascalCase(name);

  if (hasProps) {
    return `import { cn } from '@/lib/utils';

interface ${pascalName}Props {
  className?: string;
  children?: React.ReactNode;
}

export function ${pascalName}({ className, children }: ${pascalName}Props) {
  return (
    <div className={cn('', className)}>
      {children}
    </div>
  );
}
`;
  }

  return `import { cn } from '@/lib/utils';

export function ${pascalName}() {
  return (
    <div>
      {/* ${pascalName} content */}
    </div>
  );
}
`;
}

// API route template
function apiRouteTemplate(name: string, methods: string[]): string {
  const lines: string[] = [
    `import { NextRequest, NextResponse } from 'next/server';`,
    `import { z } from 'zod';`,
    `import { db } from '@/db';`,
    ``,
  ];

  if (methods.includes('GET')) {
    lines.push(`export async function GET(request: NextRequest) {
  try {
    // TODO: Implement GET logic
    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    console.error('GET /${name} error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
`);
  }

  if (methods.includes('POST')) {
    const schemaName = `Create${toPascalCase(name)}Schema`;
    lines.push(`const ${schemaName} = z.object({
  // TODO: Define your schema
  name: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = ${schemaName}.parse(body);

    // TODO: Implement POST logic
    return NextResponse.json({ message: 'Created', data: validated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /${name} error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
`);
  }

  if (methods.includes('PUT')) {
    const schemaName = `Update${toPascalCase(name)}Schema`;
    lines.push(`const ${schemaName} = z.object({
  // TODO: Define your update schema
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = ${schemaName}.parse(body);

    // TODO: Implement PUT logic
    return NextResponse.json({ message: 'Updated', data: validated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('PUT /${name} error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
`);
  }

  if (methods.includes('DELETE')) {
    lines.push(`export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    // TODO: Implement DELETE logic
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    console.error('DELETE /${name} error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
`);
  }

  return lines.join('\n');
}

// Service template
function serviceTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);

  return `import { db } from '@/db';
import { z } from 'zod';

// Validation schemas
export const Create${pascalName}Schema = z.object({
  // TODO: Define your schema
  name: z.string().min(1),
});

export const Update${pascalName}Schema = Create${pascalName}Schema.partial();

export type Create${pascalName}Input = z.infer<typeof Create${pascalName}Schema>;
export type Update${pascalName}Input = z.infer<typeof Update${pascalName}Schema>;

/**
 * ${pascalName} Service
 * Handles all ${camelName}-related business logic
 */
export const ${camelName}Service = {
  /**
   * Get all ${camelName}s
   */
  async getAll() {
    // TODO: Implement
    return [];
  },

  /**
   * Get a single ${camelName} by ID
   */
  async getById(id: string) {
    // TODO: Implement
    return null;
  },

  /**
   * Create a new ${camelName}
   */
  async create(input: Create${pascalName}Input) {
    const validated = Create${pascalName}Schema.parse(input);
    // TODO: Implement
    return validated;
  },

  /**
   * Update an existing ${camelName}
   */
  async update(id: string, input: Update${pascalName}Input) {
    const validated = Update${pascalName}Schema.parse(input);
    // TODO: Implement
    return { id, ...validated };
  },

  /**
   * Delete a ${camelName}
   */
  async delete(id: string) {
    // TODO: Implement
    return true;
  },
};
`;
}

// Hook template
function hookTemplate(name: string): string {
  const hookName = name.startsWith('use') ? name : `use${toPascalCase(name)}`;
  const pascalName = toPascalCase(name.replace(/^use/i, ''));

  return `'use client';

import { useState, useEffect, useCallback } from 'react';

interface ${pascalName}State {
  data: unknown | null;
  isLoading: boolean;
  error: Error | null;
}

interface ${hookName}Options {
  // TODO: Add options if needed
}

export function ${hookName}(options?: ${hookName}Options) {
  const [state, setState] = useState<${pascalName}State>({
    data: null,
    isLoading: false,
    error: null,
  });

  const fetch${pascalName} = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // TODO: Implement fetch logic
      const data = null;
      setState({ data, isLoading: false, error: null });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));
    }
  }, []);

  useEffect(() => {
    fetch${pascalName}();
  }, [fetch${pascalName}]);

  return {
    ...state,
    refetch: fetch${pascalName},
  };
}
`;
}

// Page template
function pageTemplate(name: string, isServer: boolean): string {
  const pascalName = toPascalCase(name);

  if (isServer) {
    return `import { Suspense } from 'react';

export const metadata = {
  title: '${pascalName}',
  description: '${pascalName} page',
};

async function ${pascalName}Content() {
  // TODO: Fetch data server-side
  const data = null;

  return (
    <div>
      <h1 className="text-2xl font-bold">${pascalName}</h1>
      {/* Content here */}
    </div>
  );
}

export default function ${pascalName}Page() {
  return (
    <main className="container mx-auto py-8">
      <Suspense fallback={<div>Loading...</div>}>
        <${pascalName}Content />
      </Suspense>
    </main>
  );
}
`;
  }

  return `'use client';

import { useState } from 'react';

export default function ${pascalName}Page() {
  const [loading, setLoading] = useState(false);

  return (
    <main className="container mx-auto py-8">
      <h1 className="text-2xl font-bold">${pascalName}</h1>
      {/* Content here */}
    </main>
  );
}
`;
}

// Schema template for Drizzle
function schemaTemplate(name: string): string {
  const tableName = toKebabCase(name).replace(/-/g, '_');
  const pascalName = toPascalCase(name);

  return `import { pgTable, text, timestamp, uuid, boolean } from 'drizzle-orm/pg-core';

export const ${tableName} = pgTable('${tableName}', {
  id: uuid('id').primaryKey().defaultRandom(),
  // TODO: Add your columns
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ${pascalName} = typeof ${tableName}.$inferSelect;
export type New${pascalName} = typeof ${tableName}.$inferInsert;
`;
}

// Form template
function formTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);

  return `'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const ${camelName}Schema = z.object({
  // TODO: Define your form fields
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
});

type ${pascalName}FormData = z.infer<typeof ${camelName}Schema>;

interface ${pascalName}FormProps {
  onSubmit: (data: ${pascalName}FormData) => void | Promise<void>;
  defaultValues?: Partial<${pascalName}FormData>;
  isLoading?: boolean;
}

export function ${pascalName}Form({ onSubmit, defaultValues, isLoading }: ${pascalName}FormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<${pascalName}FormData>({
    resolver: zodResolver(${camelName}Schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input
          {...register('name')}
          type="text"
          id="name"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          disabled={isLoading}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          {...register('email')}
          type="email"
          id="email"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          disabled={isLoading}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
`;
}

interface GenerateOptions {
  type?: string;
  name?: string;
}

/**
 * Generate code from templates
 */
export async function generate(options: GenerateOptions): Promise<void> {
  console.log(chalk.blue(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold('CodeBakers Code Generator')}                            ║
  ║                                                           ║
  ║   Generate production-ready code from templates           ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  const cwd = process.cwd();

  // Check if we're in a project
  const hasPackageJson = existsSync(join(cwd, 'package.json'));
  if (!hasPackageJson) {
    console.log(chalk.yellow('  No package.json found. Run this in a project directory.\n'));
    console.log(chalk.gray('  Use `codebakers scaffold` to create a new project first.\n'));
    return;
  }

  // Available generators
  const generators = [
    { key: '1', name: 'component', desc: 'React component with TypeScript' },
    { key: '2', name: 'api', desc: 'Next.js API route with validation' },
    { key: '3', name: 'service', desc: 'Business logic service with CRUD' },
    { key: '4', name: 'hook', desc: 'React hook with state management' },
    { key: '5', name: 'page', desc: 'Next.js page (server or client)' },
    { key: '6', name: 'schema', desc: 'Drizzle database table schema' },
    { key: '7', name: 'form', desc: 'Form with React Hook Form + Zod' },
  ];

  let type = options.type;
  let name = options.name;

  // If type not provided, ask
  if (!type) {
    console.log(chalk.white('  What would you like to generate?\n'));
    console.log(chalk.gray('    0. ') + chalk.magenta('You Decide') + chalk.gray(' - Let AI pick based on context'));
    for (const gen of generators) {
      console.log(chalk.gray(`    ${gen.key}. `) + chalk.cyan(gen.name) + chalk.gray(` - ${gen.desc}`));
    }
    console.log('');

    let choice = '';
    while (!['0', '1', '2', '3', '4', '5', '6', '7'].includes(choice)) {
      choice = await prompt('  Enter 0-7: ');
    }

    // "You Decide" defaults to component (most common)
    if (choice === '0') {
      console.log(chalk.magenta('  → AI chose: component (most common)\n'));
      choice = '1';
    }

    type = generators.find(g => g.key === choice)?.name;
  }

  // If name not provided, ask
  if (!name) {
    name = await prompt(`  ${toPascalCase(type!)} name: `);
    if (!name) {
      console.log(chalk.red('\n  Name is required.\n'));
      return;
    }
  }

  const spinner = ora('  Generating...').start();

  try {
    let filePath: string;
    let content: string;

    switch (type) {
      case 'component': {
        const hasProps = await prompt('  Include props interface? (Y/n): ');
        content = componentTemplate(name, hasProps.toLowerCase() !== 'n');
        const componentDir = join(cwd, 'src/components');
        if (!existsSync(componentDir)) {
          mkdirSync(componentDir, { recursive: true });
        }
        filePath = join(componentDir, `${toPascalCase(name)}.tsx`);
        break;
      }

      case 'api': {
        console.log(chalk.gray('\n  Select HTTP methods (comma-separated):'));
        console.log(chalk.gray('  Examples: GET,POST or GET,POST,PUT,DELETE\n'));
        const methodsInput = await prompt('  Methods (GET,POST): ') || 'GET,POST';
        const methods = methodsInput.toUpperCase().split(',').map(m => m.trim());
        content = apiRouteTemplate(name, methods);
        const apiDir = join(cwd, 'src/app/api', toKebabCase(name));
        if (!existsSync(apiDir)) {
          mkdirSync(apiDir, { recursive: true });
        }
        filePath = join(apiDir, 'route.ts');
        break;
      }

      case 'service': {
        content = serviceTemplate(name);
        const serviceDir = join(cwd, 'src/services');
        if (!existsSync(serviceDir)) {
          mkdirSync(serviceDir, { recursive: true });
        }
        filePath = join(serviceDir, `${toKebabCase(name)}.ts`);
        break;
      }

      case 'hook': {
        content = hookTemplate(name);
        const hookDir = join(cwd, 'src/hooks');
        if (!existsSync(hookDir)) {
          mkdirSync(hookDir, { recursive: true });
        }
        const hookName = name.startsWith('use') ? name : `use${toPascalCase(name)}`;
        filePath = join(hookDir, `${hookName}.ts`);
        break;
      }

      case 'page': {
        const isServer = await prompt('  Server component? (Y/n): ');
        content = pageTemplate(name, isServer.toLowerCase() !== 'n');
        const pageDir = join(cwd, 'src/app', toKebabCase(name));
        if (!existsSync(pageDir)) {
          mkdirSync(pageDir, { recursive: true });
        }
        filePath = join(pageDir, 'page.tsx');
        break;
      }

      case 'schema': {
        content = schemaTemplate(name);
        const schemaDir = join(cwd, 'src/db/schemas');
        if (!existsSync(schemaDir)) {
          mkdirSync(schemaDir, { recursive: true });
        }
        filePath = join(schemaDir, `${toKebabCase(name)}.ts`);
        break;
      }

      case 'form': {
        content = formTemplate(name);
        const formDir = join(cwd, 'src/components/forms');
        if (!existsSync(formDir)) {
          mkdirSync(formDir, { recursive: true });
        }
        filePath = join(formDir, `${toPascalCase(name)}Form.tsx`);
        break;
      }

      default:
        spinner.fail('Unknown generator type');
        return;
    }

    // Check if file already exists
    if (existsSync(filePath)) {
      spinner.warn('File already exists');
      const overwrite = await prompt('  Overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log(chalk.gray('\n  Skipped.\n'));
        return;
      }
    }

    // Write the file
    writeFileSync(filePath, content);

    const relativePath = filePath.replace(cwd, '').replace(/\\/g, '/');
    spinner.succeed(`Generated ${relativePath}`);

    console.log(chalk.green(`
  ╔═══════════════════════════════════════════════════════════╗
  ║   ${chalk.bold('✓ Code generated successfully!')}                        ║
  ╚═══════════════════════════════════════════════════════════╝
    `));

    console.log(chalk.white('  Created:\n'));
    console.log(chalk.cyan(`    ${relativePath}\n`));

    // Show next steps based on type
    console.log(chalk.white('  Next steps:\n'));
    switch (type) {
      case 'component':
        console.log(chalk.gray('    1. Import and use the component in your page'));
        console.log(chalk.gray('    2. Add any additional props you need'));
        console.log(chalk.gray('    3. Style it with Tailwind classes\n'));
        break;
      case 'api':
        console.log(chalk.gray('    1. Implement the TODO sections'));
        console.log(chalk.gray('    2. Add authentication if needed'));
        console.log(chalk.gray('    3. Test with curl or your frontend\n'));
        break;
      case 'service':
        console.log(chalk.gray('    1. Update the Zod schemas'));
        console.log(chalk.gray('    2. Implement database queries'));
        console.log(chalk.gray('    3. Import and use in your API routes\n'));
        break;
      case 'hook':
        console.log(chalk.gray('    1. Implement the fetch logic'));
        console.log(chalk.gray('    2. Update the return type'));
        console.log(chalk.gray('    3. Use it in your components\n'));
        break;
      case 'page':
        console.log(chalk.gray(`    1. Visit /${toKebabCase(name)} in your browser`));
        console.log(chalk.gray('    2. Add your page content'));
        console.log(chalk.gray('    3. Update the metadata\n'));
        break;
      case 'schema':
        console.log(chalk.gray('    1. Add your column definitions'));
        console.log(chalk.gray('    2. Export from src/db/schema.ts'));
        console.log(chalk.gray('    3. Run `npm run db:push` to sync\n'));
        break;
      case 'form':
        console.log(chalk.gray('    1. Update the Zod schema with your fields'));
        console.log(chalk.gray('    2. Add form inputs for each field'));
        console.log(chalk.gray('    3. Handle form submission in parent\n'));
        break;
    }

  } catch (error) {
    spinner.fail('Generation failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));
    process.exit(1);
  }
}
