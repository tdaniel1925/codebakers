# WORDPRESS INTEGRATION
# Module: 06g-wordpress.md
# Load with: 00-core.md
# Related: 03-api.md (API patterns)

---

## When to Use This Pattern

Use this when:
- Building tools that integrate with WordPress sites
- Managing WordPress content from external apps
- Syncing content between WordPress and your app
- Building WordPress site management dashboards

Don't use this when:
- Building WordPress plugins (different development model)
- Working with WordPress.com hosted sites (different API)

---

## 🔌 WORDPRESS REST API SETUP

### Client Configuration

```typescript
// lib/wordpress/client.ts

export interface WordPressConfig {
  siteUrl: string;          // e.g., "https://example.com"
  username: string;         // WordPress username
  applicationPassword: string; // NOT the regular password
}

export class WordPressClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: WordPressConfig) {
    // Ensure no trailing slash
    this.baseUrl = config.siteUrl.replace(/\/$/, '') + '/wp-json/wp/v2';

    // WordPress uses Basic Auth with Application Passwords
    const credentials = Buffer.from(
      `${config.username}:${config.applicationPassword}`
    ).toString('base64');

    this.authHeader = `Basic ${credentials}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new WordPressError(
        error.message || `WordPress API error: ${response.status}`,
        response.status,
        error.code
      );
    }

    return response.json() as Promise<T>;
  }

  // Public methods below...
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export class WordPressError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'WordPressError';
  }
}
```

---

## 📄 PAGE & POST OPERATIONS

### Types

```typescript
// lib/wordpress/types.ts

export interface WPPost {
  id: number;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  slug: string;
  status: 'publish' | 'draft' | 'pending' | 'private' | 'trash';
  type: 'post' | 'page';
  link: string;
  title: {
    rendered: string;
    raw?: string;
  };
  content: {
    rendered: string;
    raw?: string;
    protected: boolean;
  };
  excerpt: {
    rendered: string;
    raw?: string;
    protected: boolean;
  };
  author: number;
  featured_media: number;
  parent?: number; // For pages
  menu_order?: number; // For pages
  template?: string; // Page template
  categories?: number[];
  tags?: number[];
  meta?: Record<string, unknown>;
}

export interface WPMedia {
  id: number;
  date: string;
  slug: string;
  type: string;
  link: string;
  title: { rendered: string };
  author: number;
  caption: { rendered: string };
  alt_text: string;
  media_type: 'image' | 'file';
  mime_type: string;
  source_url: string;
  media_details?: {
    width: number;
    height: number;
    file: string;
    sizes?: Record<string, {
      file: string;
      width: number;
      height: number;
      mime_type: string;
      source_url: string;
    }>;
  };
}

export interface WPCategory {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
  parent: number;
}

export interface WPUser {
  id: number;
  username: string;
  name: string;
  email?: string;
  url: string;
  description: string;
  link: string;
  slug: string;
  roles?: string[];
  avatar_urls?: Record<string, string>;
}

export interface WPListParams {
  page?: number;
  per_page?: number;
  search?: string;
  after?: string;
  before?: string;
  order?: 'asc' | 'desc';
  orderby?: 'date' | 'id' | 'title' | 'slug' | 'modified';
  status?: 'publish' | 'draft' | 'pending' | 'private' | 'trash' | 'any';
}
```

### WordPress Service

```typescript
// services/wordpress-service.ts
import { WordPressClient, WordPressError } from '@/lib/wordpress/client';
import type { WPPost, WPMedia, WPCategory, WPListParams } from '@/lib/wordpress/types';

export class WordPressService {
  private client: WordPressClient;

  constructor(siteUrl: string, username: string, appPassword: string) {
    this.client = new WordPressClient({
      siteUrl,
      username,
      applicationPassword: appPassword,
    });
  }

  // ========== POSTS ==========

  async getPosts(params: WPListParams = {}): Promise<WPPost[]> {
    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();

    return this.client.get<WPPost[]>(`/posts?${queryString}`);
  }

  async getPost(id: number): Promise<WPPost> {
    return this.client.get<WPPost>(`/posts/${id}?context=edit`);
  }

  async createPost(data: {
    title: string;
    content: string;
    status?: 'publish' | 'draft';
    excerpt?: string;
    categories?: number[];
    tags?: number[];
    featured_media?: number;
  }): Promise<WPPost> {
    return this.client.post<WPPost>('/posts', data);
  }

  async updatePost(id: number, data: Partial<{
    title: string;
    content: string;
    status: 'publish' | 'draft' | 'pending' | 'private';
    excerpt: string;
    categories: number[];
    tags: number[];
    featured_media: number;
  }>): Promise<WPPost> {
    return this.client.put<WPPost>(`/posts/${id}`, data);
  }

  async deletePost(id: number, force = false): Promise<WPPost> {
    const endpoint = force ? `/posts/${id}?force=true` : `/posts/${id}`;
    return this.client.delete<WPPost>(endpoint);
  }

  // ========== PAGES ==========

  async getPages(params: WPListParams = {}): Promise<WPPost[]> {
    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();

    return this.client.get<WPPost[]>(`/pages?${queryString}`);
  }

  async getPage(id: number): Promise<WPPost> {
    return this.client.get<WPPost>(`/pages/${id}?context=edit`);
  }

  async createPage(data: {
    title: string;
    content: string;
    status?: 'publish' | 'draft';
    parent?: number;
    menu_order?: number;
    template?: string;
  }): Promise<WPPost> {
    return this.client.post<WPPost>('/pages', data);
  }

  async updatePage(id: number, data: Partial<{
    title: string;
    content: string;
    status: 'publish' | 'draft' | 'pending' | 'private';
    parent: number;
    menu_order: number;
    template: string;
  }>): Promise<WPPost> {
    return this.client.put<WPPost>(`/pages/${id}`, data);
  }

  // ========== MEDIA ==========

  async getMedia(params: WPListParams = {}): Promise<WPMedia[]> {
    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();

    return this.client.get<WPMedia[]>(`/media?${queryString}`);
  }

  async uploadMedia(file: Buffer | Blob, filename: string, mimeType: string): Promise<WPMedia> {
    const formData = new FormData();
    formData.append('file', new Blob([file], { type: mimeType }), filename);

    // Note: Need custom request for multipart
    const response = await fetch(`${this.client['baseUrl']}/media`, {
      method: 'POST',
      headers: {
        'Authorization': this.client['authHeader'],
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: file,
    });

    if (!response.ok) {
      throw new WordPressError('Failed to upload media', response.status);
    }

    return response.json() as Promise<WPMedia>;
  }

  // ========== CATEGORIES ==========

  async getCategories(): Promise<WPCategory[]> {
    return this.client.get<WPCategory[]>('/categories?per_page=100');
  }

  async createCategory(data: {
    name: string;
    slug?: string;
    parent?: number;
    description?: string;
  }): Promise<WPCategory> {
    return this.client.post<WPCategory>('/categories', data);
  }

  // ========== UTILITIES ==========

  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/users/me');
      return true;
    } catch {
      return false;
    }
  }

  async getSiteInfo(): Promise<{
    name: string;
    description: string;
    url: string;
    timezone: string;
  }> {
    // Use the base site endpoint
    const response = await fetch(
      this.client['baseUrl'].replace('/wp/v2', ''),
      { headers: { 'Authorization': this.client['authHeader'] } }
    );
    return response.json();
  }
}
```

---

## 🔍 PAGE BUILDER DETECTION

```typescript
// lib/wordpress/detect-builder.ts

export type PageBuilder =
  | 'gutenberg'      // WordPress default (blocks)
  | 'elementor'      // Elementor
  | 'divi'           // Divi Builder
  | 'wpbakery'       // WPBakery (Visual Composer)
  | 'beaver'         // Beaver Builder
  | 'oxygen'         // Oxygen Builder
  | 'bricks'         // Bricks Builder
  | 'classic'        // Classic Editor (no blocks)
  | 'unknown';

export function detectPageBuilder(content: string): PageBuilder {
  // Check for Elementor
  if (content.includes('data-elementor') || content.includes('elementor-element')) {
    return 'elementor';
  }

  // Check for Divi
  if (content.includes('et_pb_') || content.includes('et_builder_')) {
    return 'divi';
  }

  // Check for WPBakery (Visual Composer)
  if (content.includes('[vc_') || content.includes('wpb_')) {
    return 'wpbakery';
  }

  // Check for Beaver Builder
  if (content.includes('fl-builder') || content.includes('fl-node')) {
    return 'beaver';
  }

  // Check for Oxygen
  if (content.includes('ct-') || content.includes('oxygen-')) {
    return 'oxygen';
  }

  // Check for Bricks
  if (content.includes('brxe-') || content.includes('bricks-')) {
    return 'bricks';
  }

  // Check for Gutenberg blocks
  if (content.includes('<!-- wp:') || content.includes('wp-block-')) {
    return 'gutenberg';
  }

  // No builder detected - likely classic editor
  if (content.includes('<p>') || content.includes('<div>')) {
    return 'classic';
  }

  return 'unknown';
}

export function parseGutenbergBlocks(content: string): Array<{
  name: string;
  attributes: Record<string, unknown>;
  innerContent: string[];
}> {
  const blocks: Array<{
    name: string;
    attributes: Record<string, unknown>;
    innerContent: string[];
  }> = [];

  // Match Gutenberg block comments
  const blockRegex = /<!-- wp:(\S+)(?:\s+(\{[^}]+\}))?\s*(?:\/)?-->([\s\S]*?)(?:<!-- \/wp:\1 -->)?/g;

  let match;
  while ((match = blockRegex.exec(content)) !== null) {
    const [, name, attributesJson, innerContent] = match;

    let attributes = {};
    if (attributesJson) {
      try {
        attributes = JSON.parse(attributesJson);
      } catch {
        // Invalid JSON, skip attributes
      }
    }

    blocks.push({
      name: `wp/${name}`,
      attributes,
      innerContent: innerContent ? [innerContent.trim()] : [],
    });
  }

  return blocks;
}
```

---

## 🔗 API ROUTE EXAMPLES

### Sync WordPress Content

```typescript
// app/api/wordpress/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { WordPressService } from '@/services/wordpress-service';
import { db } from '@/db';
import { wordpressSites, wordpressContent } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const SyncSchema = z.object({
  siteId: z.string().uuid(),
  contentType: z.enum(['posts', 'pages']).default('posts'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { siteId, contentType } = SyncSchema.parse(body);

    // Get site credentials
    const site = await db.query.wordpressSites.findFirst({
      where: eq(wordpressSites.id, siteId),
    });

    if (!site || site.userId !== session.user.id) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const wp = new WordPressService(
      site.siteUrl,
      site.username,
      site.appPassword // Should be encrypted in DB
    );

    // Fetch content
    const items = contentType === 'posts'
      ? await wp.getPosts({ per_page: 100, status: 'any' })
      : await wp.getPages({ per_page: 100, status: 'any' });

    // Sync to local database
    let synced = 0;
    for (const item of items) {
      await db.insert(wordpressContent).values({
        siteId,
        wpId: item.id,
        type: contentType === 'posts' ? 'post' : 'page',
        title: item.title.rendered,
        content: item.content.raw || item.content.rendered,
        status: item.status,
        slug: item.slug,
        link: item.link,
        wpModified: new Date(item.modified_gmt),
      }).onConflictDoUpdate({
        target: [wordpressContent.siteId, wordpressContent.wpId],
        set: {
          title: item.title.rendered,
          content: item.content.raw || item.content.rendered,
          status: item.status,
          slug: item.slug,
          link: item.link,
          wpModified: new Date(item.modified_gmt),
          syncedAt: new Date(),
        },
      });
      synced++;
    }

    return NextResponse.json({
      success: true,
      synced,
      message: `Synced ${synced} ${contentType}`,
    });
  } catch (error) {
    console.error('WordPress sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync WordPress content' },
      { status: 500 }
    );
  }
}
```

### Test WordPress Connection

```typescript
// app/api/wordpress/test-connection/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { WordPressService } from '@/services/wordpress-service';
import { z } from 'zod';

const TestSchema = z.object({
  siteUrl: z.string().url(),
  username: z.string().min(1),
  appPassword: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { siteUrl, username, appPassword } = TestSchema.parse(body);

    const wp = new WordPressService(siteUrl, username, appPassword);
    const connected = await wp.testConnection();

    if (!connected) {
      return NextResponse.json({
        success: false,
        error: 'Could not connect. Check credentials and ensure Application Passwords are enabled.',
      });
    }

    const siteInfo = await wp.getSiteInfo();

    return NextResponse.json({
      success: true,
      site: {
        name: siteInfo.name,
        url: siteInfo.url,
      },
    });
  } catch (error) {
    console.error('WordPress connection test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}
```

---

## 📋 ENVIRONMENT VARIABLES

```bash
# .env.local

# WordPress sites are stored per-user in database
# No global env vars needed unless you have a single WordPress site

# Example for single-site integration:
# WORDPRESS_SITE_URL=https://your-site.com
# WORDPRESS_USERNAME=api_user
# WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

---

## 🔐 APPLICATION PASSWORDS

WordPress Application Passwords are required for REST API authentication.

### How to Create:
1. Log into WordPress admin
2. Go to Users → Your Profile
3. Scroll to "Application Passwords"
4. Enter a name (e.g., "My App Integration")
5. Click "Add New Application Password"
6. Copy the generated password (spaces included)

### Requirements:
- WordPress 5.6+ (Application Passwords built-in)
- HTTPS required for production
- User must have appropriate capabilities

---

## ⚠️ COMMON ISSUES & SOLUTIONS

### Issue: 401 Unauthorized
```typescript
// Check these:
// 1. Application Password correct (include spaces)?
// 2. HTTPS enabled on WordPress site?
// 3. User has 'edit_posts' capability?

// Test with curl first:
// curl -u "username:app password" https://site.com/wp-json/wp/v2/users/me
```

### Issue: REST API disabled
```typescript
// Some security plugins disable REST API
// Check if endpoint is accessible:
const response = await fetch(`${siteUrl}/wp-json/wp/v2/`);
// Should return API index, not 404 or error
```

### Issue: CORS errors
```typescript
// WordPress REST API allows CORS by default
// If blocked, check for security plugins or .htaccess rules
// For server-side requests (Next.js API routes), CORS doesn't apply
```

### Issue: Content contains shortcodes
```typescript
// WordPress shortcodes like [gallery] won't render via API
// Option 1: Request rendered content (default)
// Option 2: Parse and handle shortcodes client-side
// Option 3: Use ?context=edit for raw content + metadata
```

---

## 🧪 TESTING

### Mock WordPress API

```typescript
// tests/mocks/wordpress.ts
import { rest } from 'msw';

export const wordpressHandlers = [
  rest.get('*/wp-json/wp/v2/posts', (req, res, ctx) => {
    return res(ctx.json([
      {
        id: 1,
        title: { rendered: 'Test Post' },
        content: { rendered: '<p>Content</p>' },
        status: 'publish',
        slug: 'test-post',
      },
    ]));
  }),

  rest.get('*/wp-json/wp/v2/users/me', (req, res, ctx) => {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Basic ')) {
      return res(ctx.status(401));
    }
    return res(ctx.json({ id: 1, name: 'Test User' }));
  }),
];
```

### Integration Test Example

```typescript
// tests/wordpress.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { WordPressService } from '@/services/wordpress-service';

describe('WordPress Integration', () => {
  let wp: WordPressService;

  beforeAll(() => {
    // Use test/sandbox WordPress site
    wp = new WordPressService(
      process.env.TEST_WP_URL!,
      process.env.TEST_WP_USER!,
      process.env.TEST_WP_PASS!
    );
  });

  it('should connect successfully', async () => {
    const connected = await wp.testConnection();
    expect(connected).toBe(true);
  });

  it('should fetch posts', async () => {
    const posts = await wp.getPosts({ per_page: 5 });
    expect(Array.isArray(posts)).toBe(true);
  });

  it('should create and delete a draft post', async () => {
    const post = await wp.createPost({
      title: 'Test Post - Delete Me',
      content: 'Test content',
      status: 'draft',
    });

    expect(post.id).toBeDefined();
    expect(post.status).toBe('draft');

    // Clean up
    await wp.deletePost(post.id, true);
  });
});
```
