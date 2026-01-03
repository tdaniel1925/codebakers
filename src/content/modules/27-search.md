# Search Module
# Full-Text Search, Autocomplete, Faceted Search, Search Analytics

---

## PostgreSQL Full-Text Search

### Basic Setup

```typescript
// db/schema/search.ts
import { pgTable, text, timestamp, uuid, index, tsvector } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  tags: text('tags').array(),
  // Generated tsvector column for search
  searchVector: tsvector('search_vector').generatedAlwaysAs(
    sql`to_tsvector('english', coalesce(${products.name}, '') || ' ' || coalesce(${products.description}, ''))`
  ),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  searchIdx: index('products_search_idx').using('gin', table.searchVector),
}));
```

### Migration for Search Index

```sql
-- migrations/add_search_index.sql

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS products_search_idx
ON products USING GIN (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = to_tsvector('english',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS products_search_trigger ON products;
CREATE TRIGGER products_search_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_search_vector();
```

### Search Query Functions

```typescript
// lib/search/postgres.ts
import { db } from '@/db';
import { products } from '@/db/schema';
import { sql, and, eq, desc, asc, ilike } from 'drizzle-orm';

interface SearchOptions {
  query: string;
  category?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'newest' | 'name';
}

interface SearchResult<T> {
  items: T[];
  total: number;
  query: string;
  took: number;
}

export async function searchProducts({
  query,
  category,
  limit = 20,
  offset = 0,
  sortBy = 'relevance',
}: SearchOptions): Promise<SearchResult<typeof products.$inferSelect>> {
  const startTime = Date.now();

  // Build the search query with ranking
  const searchQuery = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(term => `${term}:*`)
    .join(' & ');

  const conditions = [];

  // Full-text search condition
  if (query) {
    conditions.push(
      sql`search_vector @@ to_tsquery('english', ${searchQuery})`
    );
  }

  // Category filter
  if (category) {
    conditions.push(eq(products.category, category));
  }

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  // Sort order
  let orderBy;
  switch (sortBy) {
    case 'relevance':
      orderBy = sql`ts_rank(search_vector, to_tsquery('english', ${searchQuery})) desc`;
      break;
    case 'newest':
      orderBy = desc(products.createdAt);
      break;
    case 'name':
      orderBy = asc(products.name);
      break;
    default:
      orderBy = desc(products.createdAt);
  }

  // Get results with ranking
  const results = await db
    .select({
      ...products,
      rank: sql<number>`ts_rank(search_vector, to_tsquery('english', ${searchQuery}))`,
      headline: sql<string>`ts_headline('english', ${products.description}, to_tsquery('english', ${searchQuery}), 'StartSel=<mark>, StopSel=</mark>')`,
    })
    .from(products)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    items: results,
    total: countResult[0]?.count ?? 0,
    query,
    took: Date.now() - startTime,
  };
}

// Autocomplete / suggestions
export async function getSearchSuggestions(
  query: string,
  limit = 5
): Promise<string[]> {
  if (!query || query.length < 2) return [];

  const results = await db
    .select({ name: products.name })
    .from(products)
    .where(ilike(products.name, `%${query}%`))
    .limit(limit);

  return results.map(r => r.name);
}
```

---

## Algolia Integration

### Setup

```typescript
// lib/search/algolia.ts
import algoliasearch from 'algoliasearch';

const client = algoliasearch(
  process.env.ALGOLIA_APP_ID!,
  process.env.ALGOLIA_ADMIN_KEY!
);

export const productsIndex = client.initIndex('products');

// Configure index settings
export async function configureAlgoliaIndex() {
  await productsIndex.setSettings({
    searchableAttributes: [
      'name',
      'description',
      'category',
      'tags',
    ],
    attributesForFaceting: [
      'filterOnly(tenantId)',
      'category',
      'tags',
      'price_range',
    ],
    customRanking: [
      'desc(popularity)',
      'desc(created_at)',
    ],
    highlightPreTag: '<mark>',
    highlightPostTag: '</mark>',
    hitsPerPage: 20,
    typoTolerance: true,
    minWordSizefor1Typo: 4,
    minWordSizefor2Typos: 8,
  });
}
```

### Indexing Data

```typescript
// lib/search/algolia-sync.ts
import { productsIndex } from './algolia';
import { db } from '@/db';
import { products } from '@/db/schema';

interface AlgoliaProduct {
  objectID: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  tenantId: string;
  price: number;
  price_range: string;
  created_at: number;
  popularity: number;
}

// Sync single record
export async function indexProduct(product: typeof products.$inferSelect) {
  const record: AlgoliaProduct = {
    objectID: product.id,
    name: product.name,
    description: product.description || '',
    category: product.category || '',
    tags: product.tags || [],
    tenantId: product.tenantId,
    price: product.price,
    price_range: getPriceRange(product.price),
    created_at: product.createdAt.getTime(),
    popularity: product.viewCount || 0,
  };

  await productsIndex.saveObject(record);
}

// Batch sync
export async function syncAllProducts(tenantId: string) {
  const allProducts = await db
    .select()
    .from(products)
    .where(eq(products.tenantId, tenantId));

  const records: AlgoliaProduct[] = allProducts.map(product => ({
    objectID: product.id,
    name: product.name,
    description: product.description || '',
    category: product.category || '',
    tags: product.tags || [],
    tenantId: product.tenantId,
    price: product.price,
    price_range: getPriceRange(product.price),
    created_at: product.createdAt.getTime(),
    popularity: product.viewCount || 0,
  }));

  await productsIndex.saveObjects(records);
}

// Delete from index
export async function removeFromIndex(productId: string) {
  await productsIndex.deleteObject(productId);
}

function getPriceRange(price: number): string {
  if (price < 25) return 'Under $25';
  if (price < 50) return '$25 - $50';
  if (price < 100) return '$50 - $100';
  if (price < 250) return '$100 - $250';
  return '$250+';
}
```

### Search with Algolia

```typescript
// lib/search/algolia-search.ts
import { productsIndex } from './algolia';

interface AlgoliaSearchOptions {
  query: string;
  tenantId: string;
  filters?: {
    category?: string;
    tags?: string[];
    priceRange?: string;
  };
  page?: number;
  hitsPerPage?: number;
}

export async function searchAlgolia({
  query,
  tenantId,
  filters = {},
  page = 0,
  hitsPerPage = 20,
}: AlgoliaSearchOptions) {
  // Build filter string
  const filterParts = [`tenantId:${tenantId}`];

  if (filters.category) {
    filterParts.push(`category:${filters.category}`);
  }

  if (filters.tags?.length) {
    const tagFilters = filters.tags.map(t => `tags:${t}`).join(' OR ');
    filterParts.push(`(${tagFilters})`);
  }

  if (filters.priceRange) {
    filterParts.push(`price_range:"${filters.priceRange}"`);
  }

  const results = await productsIndex.search(query, {
    filters: filterParts.join(' AND '),
    page,
    hitsPerPage,
    attributesToHighlight: ['name', 'description'],
    facets: ['category', 'tags', 'price_range'],
  });

  return {
    hits: results.hits,
    total: results.nbHits,
    page: results.page,
    totalPages: results.nbPages,
    facets: results.facets,
    took: results.processingTimeMS,
  };
}
```

---

## Typesense Integration

```typescript
// lib/search/typesense.ts
import Typesense from 'typesense';

export const typesenseClient = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST!,
    port: parseInt(process.env.TYPESENSE_PORT || '443'),
    protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_API_KEY!,
  connectionTimeoutSeconds: 2,
});

// Create collection schema
export async function createTypesenseCollection() {
  const schema = {
    name: 'products',
    fields: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'category', type: 'string', facet: true },
      { name: 'tags', type: 'string[]', facet: true },
      { name: 'price', type: 'float' },
      { name: 'tenant_id', type: 'string' },
      { name: 'created_at', type: 'int64' },
    ],
    default_sorting_field: 'created_at',
  };

  try {
    await typesenseClient.collections().create(schema);
  } catch (error: any) {
    if (!error.message.includes('already exists')) {
      throw error;
    }
  }
}

// Search
export async function searchTypesense(
  query: string,
  tenantId: string,
  options: { category?: string; page?: number; perPage?: number } = {}
) {
  const { category, page = 1, perPage = 20 } = options;

  let filterBy = `tenant_id:=${tenantId}`;
  if (category) {
    filterBy += ` && category:=${category}`;
  }

  const results = await typesenseClient
    .collections('products')
    .documents()
    .search({
      q: query,
      query_by: 'name,description,tags',
      filter_by: filterBy,
      sort_by: '_text_match:desc,created_at:desc',
      page,
      per_page: perPage,
      facet_by: 'category,tags',
      highlight_full_fields: 'name,description',
    });

  return results;
}
```

---

## Search API Endpoint

```typescript
// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { searchProducts, getSearchSuggestions } from '@/lib/search/postgres';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const searchSchema = z.object({
  q: z.string().min(1).max(200),
  category: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(['relevance', 'newest', 'name']).default('relevance'),
});

export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const rateLimitResult = await rateLimit(request, { limit: 100, window: 60 });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Auth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = searchSchema.parse(searchParams);

    // Search
    const results = await searchProducts({
      query: params.q,
      category: params.category,
      limit: params.limit,
      offset: (params.page - 1) * params.limit,
      sortBy: params.sort,
    });

    // Track search for analytics
    // analytics.track({ name: 'Search Performed', properties: { query: params.q, results: results.total } });

    return NextResponse.json({
      ...results,
      page: params.page,
      totalPages: Math.ceil(results.total / params.limit),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

// Suggestions endpoint
export async function POST(request: NextRequest) {
  const { query } = await request.json();

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await getSearchSuggestions(query);
  return NextResponse.json({ suggestions });
}
```

---

## React Search Components

### Search Input with Autocomplete

```tsx
// components/search/search-input.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

interface SearchInputProps {
  placeholder?: string;
  autoFocus?: boolean;
  onSearch?: (query: string) => void;
}

export function SearchInput({ placeholder = 'Search...', autoFocus, onSearch }: SearchInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const debouncedQuery = useDebounce(query, 300);

  // Fetch suggestions
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: debouncedQuery }),
        });
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery]);

  const handleSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setShowSuggestions(false);
    onSearch?.(searchQuery);

    const params = new URLSearchParams(searchParams);
    params.set('q', searchQuery);
    params.delete('page');
    router.push(`/search?${params.toString()}`);
  }, [router, searchParams, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          setQuery(suggestions[selectedIndex]);
          handleSearch(suggestions[selectedIndex]);
        } else {
          handleSearch(query);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!loading && query && (
          <button
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              onClick={() => {
                setQuery(suggestion);
                handleSearch(suggestion);
              }}
              className={cn(
                "px-4 py-2 cursor-pointer",
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted"
              )}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Search Results Component

```tsx
// components/search/search-results.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

interface SearchResult {
  id: string;
  name: string;
  description: string;
  headline?: string;
  rank?: number;
}

interface SearchResponse {
  items: SearchResult[];
  total: number;
  page: number;
  totalPages: number;
  took: number;
}

async function fetchSearchResults(params: URLSearchParams): Promise<SearchResponse> {
  const res = await fetch(`/api/search?${params.toString()}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', searchParams.toString()],
    queryFn: () => fetchSearchResults(searchParams),
    enabled: !!query,
    staleTime: 1000 * 60, // Cache for 1 minute
  });

  if (!query) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Enter a search term to find results
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        Search failed. Please try again.
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-medium">No results found</p>
        <p className="text-muted-foreground mt-1">
          Try different keywords or remove filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Results header */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {data.total.toLocaleString()} results for "{query}"
        </span>
        <span>
          {data.took}ms
        </span>
      </div>

      {/* Results list */}
      <ul className="space-y-4">
        {data.items.map((result) => (
          <li
            key={result.id}
            className="p-4 border rounded-lg hover:border-primary transition-colors"
          >
            <h3 className="font-medium">{result.name}</h3>
            {result.headline ? (
              <p
                className="text-sm text-muted-foreground mt-1"
                dangerouslySetInnerHTML={{ __html: result.headline }}
              />
            ) : (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {result.description}
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <SearchPagination
          currentPage={data.page}
          totalPages={data.totalPages}
        />
      )}
    </div>
  );
}
```

### Faceted Search

```tsx
// components/search/faceted-search.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';

interface Facet {
  name: string;
  values: { value: string; count: number }[];
}

interface FacetedSearchProps {
  facets: Facet[];
}

export function FacetedSearch({ facets }: FacetedSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggleFilter = (facetName: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    const currentValues = params.getAll(facetName);

    if (currentValues.includes(value)) {
      params.delete(facetName);
      currentValues.filter(v => v !== value).forEach(v => params.append(facetName, v));
    } else {
      params.append(facetName, value);
    }

    params.delete('page');
    router.push(`/search?${params.toString()}`);
  };

  const isSelected = (facetName: string, value: string) => {
    return searchParams.getAll(facetName).includes(value);
  };

  return (
    <div className="space-y-6">
      {facets.map((facet) => (
        <div key={facet.name}>
          <h3 className="font-medium mb-2 capitalize">{facet.name}</h3>
          <ul className="space-y-1">
            {facet.values.map(({ value, count }) => (
              <li key={value}>
                <button
                  onClick={() => toggleFilter(facet.name, value)}
                  className="flex items-center gap-2 w-full text-left py-1 px-2 rounded hover:bg-muted text-sm"
                >
                  <span className={cn(
                    "w-4 h-4 border rounded flex items-center justify-center",
                    isSelected(facet.name, value) && "bg-primary border-primary"
                  )}>
                    {isSelected(facet.name, value) && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </span>
                  <span className="flex-1">{value}</span>
                  <span className="text-muted-foreground">{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

---

## Command Palette (Cmd+K)

```tsx
// components/search/command-palette.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Command } from 'cmdk';
import { Search, File, Settings, User, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/use-debounce';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const debouncedQuery = useDebounce(query, 200);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search when query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`)
      .then(res => res.json())
      .then(data => setSearchResults(data.items || []))
      .catch(() => setSearchResults([]));
  }, [debouncedQuery]);

  const staticCommands: CommandItem[] = [
    {
      id: 'search',
      label: 'Search...',
      icon: <Search className="h-4 w-4" />,
      action: () => router.push('/search'),
      keywords: ['find', 'lookup'],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      action: () => router.push('/settings'),
      keywords: ['preferences', 'config'],
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="h-4 w-4" />,
      action: () => router.push('/profile'),
      keywords: ['account', 'user'],
    },
    {
      id: 'logout',
      label: 'Sign Out',
      icon: <LogOut className="h-4 w-4" />,
      action: () => router.push('/api/auth/signout'),
      keywords: ['logout', 'exit'],
    },
  ];

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
    >
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />

      <div className="relative w-full max-w-lg bg-background rounded-lg shadow-2xl border overflow-hidden">
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Type a command or search..."
          className="w-full px-4 py-3 border-b outline-none"
        />

        <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>

          {/* Search results */}
          {searchResults.length > 0 && (
            <Command.Group heading="Search Results">
              {searchResults.map(result => (
                <Command.Item
                  key={result.id}
                  onSelect={() => {
                    router.push(`/items/${result.id}`);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer aria-selected:bg-accent"
                >
                  <File className="h-4 w-4 text-muted-foreground" />
                  <span>{result.name}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Static commands */}
          <Command.Group heading="Commands">
            {staticCommands.map(cmd => (
              <Command.Item
                key={cmd.id}
                onSelect={() => {
                  cmd.action();
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer aria-selected:bg-accent"
              >
                {cmd.icon}
                <span>{cmd.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>

        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 bg-muted rounded">↑↓</kbd> navigate{' '}
          <kbd className="px-1.5 py-0.5 bg-muted rounded">↵</kbd> select{' '}
          <kbd className="px-1.5 py-0.5 bg-muted rounded">esc</kbd> close
        </div>
      </div>
    </Command.Dialog>
  );
}
```

---

## Search Analytics

```typescript
// lib/search/analytics.ts
import { db } from '@/db';

export const searchLogs = pgTable('search_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id'),
  query: text('query').notNull(),
  resultsCount: integer('results_count').notNull(),
  clickedResultId: uuid('clicked_result_id'),
  clickPosition: integer('click_position'),
  took: integer('took_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export async function logSearch(data: {
  tenantId: string;
  userId?: string;
  query: string;
  resultsCount: number;
  took: number;
}) {
  await db.insert(searchLogs).values(data);
}

export async function logSearchClick(data: {
  searchLogId: string;
  resultId: string;
  position: number;
}) {
  await db
    .update(searchLogs)
    .set({
      clickedResultId: data.resultId,
      clickPosition: data.position,
    })
    .where(eq(searchLogs.id, data.searchLogId));
}

// Get popular searches
export async function getPopularSearches(tenantId: string, limit = 10) {
  return db
    .select({
      query: searchLogs.query,
      count: sql<number>`count(*)`,
      avgResults: sql<number>`avg(${searchLogs.resultsCount})`,
    })
    .from(searchLogs)
    .where(eq(searchLogs.tenantId, tenantId))
    .groupBy(searchLogs.query)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
}

// Get zero-result searches (opportunities)
export async function getZeroResultSearches(tenantId: string, limit = 20) {
  return db
    .select({
      query: searchLogs.query,
      count: sql<number>`count(*)`,
    })
    .from(searchLogs)
    .where(
      and(
        eq(searchLogs.tenantId, tenantId),
        eq(searchLogs.resultsCount, 0)
      )
    )
    .groupBy(searchLogs.query)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
}
```

---

## Quality Checklist

Before shipping search:
- [ ] Search index is properly configured
- [ ] Queries are sanitized to prevent injection
- [ ] Results are scoped to tenant/user
- [ ] Autocomplete is debounced (300ms)
- [ ] Loading and empty states exist
- [ ] Keyboard navigation works
- [ ] Search is accessible (ARIA labels)
- [ ] Rate limiting is in place
- [ ] Search analytics are tracked
- [ ] Zero-result queries are monitored
- [ ] Highlighting shows matched terms
- [ ] Pagination works correctly
