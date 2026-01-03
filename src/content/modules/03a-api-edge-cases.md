# API EDGE CASES
# Module: 03a-api-edge-cases.md
# Load with: 00-core.md, 03-api.md
# Covers: Rate limiting, timeouts, retries, large payloads, file uploads, idempotency

---

## 🚦 ADVANCED RATE LIMITING

```typescript
// lib/rate-limit/advanced.ts
import { db } from '@/db';
import { rateLimitBuckets } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (req: Request) => string;
  skipIf?: (req: Request) => boolean;
  costPerRequest?: number | ((req: Request) => number);
  penaltyMultiplier?: number; // For burst protection
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export class AdvancedRateLimiter {
  /**
   * Token bucket algorithm with sliding window
   */
  static async checkLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get current bucket
    const [bucket] = await db
      .select()
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.key, key))
      .limit(1);

    if (!bucket || bucket.windowStart.getTime() < windowStart) {
      // New window - reset bucket
      await db.insert(rateLimitBuckets).values({
        key,
        tokens: config.maxRequests - 1,
        windowStart: new Date(now),
      }).onConflictDoUpdate({
        target: rateLimitBuckets.key,
        set: {
          tokens: config.maxRequests - 1,
          windowStart: new Date(now),
        },
      });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(now + config.windowMs),
      };
    }

    if (bucket.tokens <= 0) {
      const resetAt = new Date(bucket.windowStart.getTime() + config.windowMs);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt.getTime() - now) / 1000),
      };
    }

    // Consume token
    await db.update(rateLimitBuckets).set({
      tokens: bucket.tokens - 1,
    }).where(eq(rateLimitBuckets.key, key));

    return {
      allowed: true,
      remaining: bucket.tokens - 1,
      resetAt: new Date(bucket.windowStart.getTime() + config.windowMs),
    };
  }

  /**
   * Tiered rate limits based on user plan
   */
  static getTierLimits(plan: 'free' | 'pro' | 'team' | 'agency'): RateLimitConfig {
    const tiers: Record<string, { rpm: number; rph: number }> = {
      free: { rpm: 20, rph: 100 },
      pro: { rpm: 60, rph: 500 },
      team: { rpm: 200, rph: 2000 },
      agency: { rpm: 1000, rph: 10000 },
    };

    const limits = tiers[plan] || tiers.free;

    return {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: limits.rpm,
      keyGenerator: (req) => {
        // Implementation
        return '';
      },
    };
  }

  /**
   * Cost-based rate limiting (different endpoints have different costs)
   */
  static async checkCostBasedLimit(
    key: string,
    cost: number,
    maxCostPerWindow: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();

    const [bucket] = await db
      .select()
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.key, key))
      .limit(1);

    if (!bucket || bucket.windowStart.getTime() < now - windowMs) {
      // New window
      await db.insert(rateLimitBuckets).values({
        key,
        tokens: maxCostPerWindow - cost,
        windowStart: new Date(now),
      }).onConflictDoUpdate({
        target: rateLimitBuckets.key,
        set: {
          tokens: maxCostPerWindow - cost,
          windowStart: new Date(now),
        },
      });

      return {
        allowed: true,
        remaining: maxCostPerWindow - cost,
        resetAt: new Date(now + windowMs),
      };
    }

    if (bucket.tokens < cost) {
      const resetAt = new Date(bucket.windowStart.getTime() + windowMs);
      return {
        allowed: false,
        remaining: bucket.tokens,
        resetAt,
        retryAfter: Math.ceil((resetAt.getTime() - now) / 1000),
      };
    }

    await db.update(rateLimitBuckets).set({
      tokens: bucket.tokens - cost,
    }).where(eq(rateLimitBuckets.key, key));

    return {
      allowed: true,
      remaining: bucket.tokens - cost,
      resetAt: new Date(bucket.windowStart.getTime() + windowMs),
    };
  }
}

// Endpoint cost configuration
export const ENDPOINT_COSTS: Record<string, number> = {
  '/api/search': 5,
  '/api/ai/generate': 10,
  '/api/export': 20,
  '/api/bulk-import': 50,
  default: 1,
};
```

---

## ⏱️ REQUEST TIMEOUT HANDLING

```typescript
// lib/api/timeout.ts
import { NextRequest, NextResponse } from 'next/server';

export interface TimeoutConfig {
  timeoutMs: number;
  onTimeout?: () => Promise<NextResponse>;
}

/**
 * Wrap handler with timeout protection
 */
export function withTimeout<T>(
  handler: () => Promise<T>,
  config: TimeoutConfig
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(async () => {
      if (config.onTimeout) {
        const response = await config.onTimeout();
        reject(new TimeoutError('Request timeout', response));
      } else {
        reject(new TimeoutError('Request timeout'));
      }
    }, config.timeoutMs);

    handler()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

class TimeoutError extends Error {
  constructor(message: string, public response?: NextResponse) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * API route with timeout handling
 */
export async function withTimeoutHandler(
  handler: (req: NextRequest) => Promise<NextResponse>,
  timeoutMs: number = 30000
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      return await withTimeout(() => handler(req), {
        timeoutMs,
        onTimeout: async () => {
          return NextResponse.json(
            {
              error: 'Request timeout',
              code: 'REQUEST_TIMEOUT',
              message: 'The request took too long to process',
            },
            { status: 504 }
          );
        },
      });
    } catch (error) {
      if (error instanceof TimeoutError && error.response) {
        return error.response;
      }
      throw error;
    }
  };
}

/**
 * Streaming response with heartbeat to prevent timeout
 */
export async function* streamWithHeartbeat<T>(
  generator: AsyncGenerator<T>,
  heartbeatIntervalMs: number = 15000
): AsyncGenerator<T | { type: 'heartbeat' }> {
  let lastYield = Date.now();

  const heartbeat = setInterval(() => {
    if (Date.now() - lastYield > heartbeatIntervalMs) {
      // Would need to yield heartbeat here
    }
  }, heartbeatIntervalMs);

  try {
    for await (const item of generator) {
      lastYield = Date.now();
      yield item;
    }
  } finally {
    clearInterval(heartbeat);
  }
}
```

---

## 📦 LARGE PAYLOAD HANDLING

```typescript
// lib/api/payload.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const PAYLOAD_LIMITS = {
  default: 1 * 1024 * 1024, // 1MB
  json: 1 * 1024 * 1024, // 1MB
  formData: 10 * 1024 * 1024, // 10MB
  fileUpload: 50 * 1024 * 1024, // 50MB
};

/**
 * Validate payload size before processing
 */
export function validatePayloadSize(
  req: NextRequest,
  maxSize: number = PAYLOAD_LIMITS.default
): { valid: boolean; error?: NextResponse } {
  const contentLength = req.headers.get('content-length');

  if (contentLength && parseInt(contentLength) > maxSize) {
    return {
      valid: false,
      error: NextResponse.json(
        {
          error: 'Payload too large',
          code: 'PAYLOAD_TOO_LARGE',
          maxSize,
          receivedSize: parseInt(contentLength),
        },
        { status: 413 }
      ),
    };
  }

  return { valid: true };
}

/**
 * Stream large JSON parsing
 */
export async function parseStreamingJson<T>(
  stream: ReadableStream<Uint8Array>,
  schema: z.ZodSchema<T>,
  maxSize: number = PAYLOAD_LIMITS.json
): Promise<T> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let data = '';
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    size += value.length;
    if (size > maxSize) {
      throw new PayloadTooLargeError(maxSize, size);
    }

    data += decoder.decode(value, { stream: true });
  }

  data += decoder.decode();

  try {
    const parsed = JSON.parse(data);
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid request body', error.errors);
    }
    throw new ParseError('Invalid JSON');
  }
}

class PayloadTooLargeError extends Error {
  constructor(public maxSize: number, public receivedSize: number) {
    super(`Payload too large: ${receivedSize} bytes exceeds ${maxSize} bytes`);
    this.name = 'PayloadTooLargeError';
  }
}

class ValidationError extends Error {
  constructor(message: string, public errors: z.ZodIssue[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Chunked response for large data
 */
export async function* chunkResponse<T>(
  data: T[],
  chunkSize: number = 100
): AsyncGenerator<{ items: T[]; offset: number; total: number }> {
  const total = data.length;

  for (let offset = 0; offset < total; offset += chunkSize) {
    const items = data.slice(offset, offset + chunkSize);
    yield { items, offset, total };
  }
}
```

---

## 📁 FILE UPLOAD EDGE CASES

```typescript
// lib/api/file-upload.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export interface FileUploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  scanForMalware?: boolean;
  generateUniqueFilename?: boolean;
  validateContent?: boolean;
}

const DEFAULT_CONFIG: FileUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
  generateUniqueFilename: true,
  validateContent: true,
};

export class FileUploadHandler {
  /**
   * Validate uploaded file
   */
  static async validateFile(
    file: File,
    config: Partial<FileUploadConfig> = {}
  ): Promise<{ valid: boolean; error?: string }> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    // Check file size
    if (file.size > mergedConfig.maxFileSize) {
      return {
        valid: false,
        error: `File too large. Maximum size is ${mergedConfig.maxFileSize / 1024 / 1024}MB`,
      };
    }

    // Check MIME type (from header - can be spoofed)
    if (!mergedConfig.allowedMimeTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type "${file.type}" not allowed`,
      };
    }

    // Check extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!mergedConfig.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `File extension "${ext}" not allowed`,
      };
    }

    // Validate actual content (magic bytes)
    if (mergedConfig.validateContent) {
      const contentValid = await this.validateFileContent(file);
      if (!contentValid.valid) {
        return contentValid;
      }
    }

    return { valid: true };
  }

  /**
   * Validate file content matches declared type (check magic bytes)
   */
  private static async validateFileContent(
    file: File
  ): Promise<{ valid: boolean; error?: string }> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 12));

    // Magic bytes for common file types
    const signatures: Record<string, number[][]> = {
      'image/jpeg': [[0xff, 0xd8, 0xff]],
      'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
      'image/gif': [
        [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
        [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
      ],
      'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
    };

    const expectedSignatures = signatures[file.type];
    if (!expectedSignatures) {
      // Unknown type - skip content validation
      return { valid: true };
    }

    const matches = expectedSignatures.some((sig) =>
      sig.every((byte, index) => bytes[index] === byte)
    );

    if (!matches) {
      return {
        valid: false,
        error: 'File content does not match declared type',
      };
    }

    return { valid: true };
  }

  /**
   * Generate safe unique filename
   */
  static generateSafeFilename(originalName: string): string {
    const ext = originalName.split('.').pop()?.toLowerCase() || '';
    const safeName = originalName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .slice(0, 50);
    const uniqueId = crypto.randomBytes(8).toString('hex');

    return `${safeName}_${uniqueId}.${ext}`;
  }

  /**
   * Handle chunked/resumable uploads
   */
  static async handleChunkedUpload(
    req: NextRequest,
    uploadId: string,
    chunkNumber: number,
    totalChunks: number
  ): Promise<{
    status: 'chunk_received' | 'upload_complete' | 'error';
    uploadId: string;
    error?: string;
  }> {
    // Store chunk
    const chunk = await req.blob();

    // Store chunk to temporary storage
    await this.storeChunk(uploadId, chunkNumber, chunk);

    // Check if all chunks received
    const receivedChunks = await this.getReceivedChunks(uploadId);

    if (receivedChunks.length === totalChunks) {
      // Assemble file
      await this.assembleChunks(uploadId, totalChunks);
      return { status: 'upload_complete', uploadId };
    }

    return { status: 'chunk_received', uploadId };
  }

  private static async storeChunk(
    uploadId: string,
    chunkNumber: number,
    chunk: Blob
  ): Promise<void> {
    // Implementation - store to temp storage
  }

  private static async getReceivedChunks(uploadId: string): Promise<number[]> {
    // Implementation - get list of received chunk numbers
    return [];
  }

  private static async assembleChunks(
    uploadId: string,
    totalChunks: number
  ): Promise<void> {
    // Implementation - combine chunks into final file
  }
}

/**
 * API route for file upload with validation
 */
export async function handleFileUpload(
  req: NextRequest,
  config?: Partial<FileUploadConfig>
): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const validation = await FileUploadHandler.validateFile(file, config);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const safeFilename = FileUploadHandler.generateSafeFilename(file.name);

    // Upload to storage (S3, etc.)
    // const url = await uploadToStorage(file, safeFilename);

    return NextResponse.json({
      success: true,
      filename: safeFilename,
      size: file.size,
      // url,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
```

---

## 🔑 IDEMPOTENCY FOR API REQUESTS

```typescript
// lib/api/idempotency.ts
import { db } from '@/db';
import { idempotencyKeys } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export interface IdempotencyConfig {
  keyHeader?: string;
  ttlSeconds?: number;
  requiredFor?: string[]; // HTTP methods that require idempotency
}

const DEFAULT_CONFIG: IdempotencyConfig = {
  keyHeader: 'Idempotency-Key',
  ttlSeconds: 24 * 60 * 60, // 24 hours
  requiredFor: ['POST', 'PUT', 'PATCH'],
};

export class IdempotencyHandler {
  /**
   * Check and handle idempotent request
   */
  static async handle(
    req: NextRequest,
    handler: () => Promise<NextResponse>,
    config: IdempotencyConfig = {}
  ): Promise<NextResponse> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const idempotencyKey = req.headers.get(mergedConfig.keyHeader!);

    // Check if idempotency is required
    const method = req.method.toUpperCase();
    if (!mergedConfig.requiredFor?.includes(method)) {
      return handler();
    }

    if (!idempotencyKey) {
      // Key not provided - execute without idempotency
      // Could also require it and return error
      return handler();
    }

    // Check for existing result
    const [existing] = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, idempotencyKey))
      .limit(1);

    if (existing) {
      // Return cached response
      if (existing.status === 'completed' && existing.response) {
        const cachedResponse = JSON.parse(existing.response);
        return new NextResponse(JSON.stringify(cachedResponse.body), {
          status: cachedResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Cached': 'true',
          },
        });
      }

      if (existing.status === 'processing') {
        return NextResponse.json(
          {
            error: 'Request is being processed',
            code: 'IDEMPOTENCY_CONFLICT',
          },
          { status: 409 }
        );
      }
    }

    // Mark as processing
    await db.insert(idempotencyKeys).values({
      key: idempotencyKey,
      status: 'processing',
      expiresAt: new Date(Date.now() + mergedConfig.ttlSeconds! * 1000),
    }).onConflictDoNothing();

    try {
      const response = await handler();

      // Cache the response
      const responseBody = await response.clone().json();
      await db.update(idempotencyKeys).set({
        status: 'completed',
        response: JSON.stringify({
          status: response.status,
          body: responseBody,
        }),
      }).where(eq(idempotencyKeys.key, idempotencyKey));

      return response;
    } catch (error) {
      // Mark as failed
      await db.update(idempotencyKeys).set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }).where(eq(idempotencyKeys.key, idempotencyKey));

      throw error;
    }
  }

  /**
   * Clean up expired idempotency keys
   */
  static async cleanup(): Promise<number> {
    const result = await db
      .delete(idempotencyKeys)
      .where(lt(idempotencyKeys.expiresAt, new Date()));

    return result.rowCount || 0;
  }
}
```

---

## 🔄 RETRY & CIRCUIT BREAKER

```typescript
// lib/api/resilience.ts

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'],
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Retry with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const mergedConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (!isRetryable(error, mergedConfig)) {
        throw error;
      }

      if (attempt < mergedConfig.maxRetries) {
        const delay = calculateBackoff(attempt, mergedConfig);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function isRetryable(error: unknown, config: RetryConfig): boolean {
  if (error instanceof Response) {
    return config.retryableStatuses.includes(error.status);
  }

  if (error instanceof Error) {
    return config.retryableErrors.some(
      (code) => error.message.includes(code) || (error as any).code === code
    );
  }

  return false;
}

function calculateBackoff(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * delay; // Add 0-30% jitter
  return Math.min(delay + jitter, config.maxDelayMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Circuit Breaker Pattern
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailure: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private config: {
      failureThreshold: number;
      resetTimeoutMs: number;
      halfOpenRequests: number;
    }
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.config.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new CircuitBreakerOpenError();
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }
}

class CircuitBreakerOpenError extends Error {
  constructor() {
    super('Circuit breaker is open');
    this.name = 'CircuitBreakerOpenError';
  }
}

// Usage example
const paymentCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenRequests: 3,
});
```

---

## 🔗 CONCURRENT REQUEST HANDLING

```typescript
// lib/api/concurrency.ts
import { db } from '@/db';
import { resourceLocks } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';

export class ConcurrencyControl {
  /**
   * Distributed lock for preventing concurrent modifications
   */
  static async withLock<T>(
    resourceId: string,
    operation: () => Promise<T>,
    options: {
      timeoutMs?: number;
      retryMs?: number;
      maxRetries?: number;
    } = {}
  ): Promise<T> {
    const {
      timeoutMs = 30000,
      retryMs = 100,
      maxRetries = 50,
    } = options;

    const lockId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + timeoutMs);

    // Try to acquire lock
    let acquired = false;
    let attempts = 0;

    while (!acquired && attempts < maxRetries) {
      try {
        // Clean up expired locks
        await db
          .delete(resourceLocks)
          .where(lt(resourceLocks.expiresAt, new Date()));

        // Try to insert lock
        await db.insert(resourceLocks).values({
          resourceId,
          lockId,
          expiresAt,
        });

        acquired = true;
      } catch (error) {
        // Lock exists, wait and retry
        attempts++;
        await new Promise((r) => setTimeout(r, retryMs));
      }
    }

    if (!acquired) {
      throw new LockAcquisitionError(resourceId);
    }

    try {
      return await operation();
    } finally {
      // Release lock
      await db
        .delete(resourceLocks)
        .where(
          and(
            eq(resourceLocks.resourceId, resourceId),
            eq(resourceLocks.lockId, lockId)
          )
        );
    }
  }

  /**
   * Optimistic concurrency with version checking
   */
  static async updateWithVersion<T extends { version: number }>(
    table: any,
    id: string,
    currentVersion: number,
    updates: Partial<T>
  ): Promise<{ success: boolean; error?: string }> {
    const result = await db
      .update(table)
      .set({
        ...updates,
        version: currentVersion + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(table.id, id),
          eq(table.version, currentVersion)
        )
      );

    if (result.rowCount === 0) {
      return {
        success: false,
        error: 'Resource was modified by another request. Please refresh and try again.',
      };
    }

    return { success: true };
  }

  /**
   * Request deduplication for identical concurrent requests
   */
  static async deduplicate<T>(
    requestHash: string,
    operation: () => Promise<T>,
    ttlMs: number = 5000
  ): Promise<T> {
    // Check if request is already in flight
    const inFlight = requestsInFlight.get(requestHash);
    if (inFlight) {
      return inFlight as Promise<T>;
    }

    // Execute and cache promise
    const promise = operation().finally(() => {
      // Clean up after TTL
      setTimeout(() => {
        requestsInFlight.delete(requestHash);
      }, ttlMs);
    });

    requestsInFlight.set(requestHash, promise);
    return promise;
  }
}

const requestsInFlight = new Map<string, Promise<unknown>>();

class LockAcquisitionError extends Error {
  constructor(resourceId: string) {
    super(`Failed to acquire lock for resource: ${resourceId}`);
    this.name = 'LockAcquisitionError';
  }
}
```

---

## 🧪 API EDGE CASE TESTS

```typescript
// __tests__/api/edge-cases.test.ts
import { describe, it, expect } from 'vitest';
import { AdvancedRateLimiter } from '@/lib/rate-limit/advanced';
import { FileUploadHandler } from '@/lib/api/file-upload';
import { withRetry } from '@/lib/api/resilience';

describe('API Edge Cases', () => {
  describe('Rate Limiting', () => {
    it('blocks requests after limit exceeded', async () => {
      const key = 'test-key';
      const config = { windowMs: 60000, maxRequests: 3 };

      for (let i = 0; i < 3; i++) {
        const result = await AdvancedRateLimiter.checkLimit(key, config);
        expect(result.allowed).toBe(true);
      }

      const blocked = await AdvancedRateLimiter.checkLimit(key, config);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('File Upload', () => {
    it('rejects files exceeding size limit', async () => {
      const largeFile = new File(['x'.repeat(20 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      });

      const result = await FileUploadHandler.validateFile(largeFile, {
        maxFileSize: 10 * 1024 * 1024,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('rejects files with mismatched content', async () => {
      // Create a file claiming to be JPEG but with PNG content
      const fakeJpeg = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'fake.jpg', {
        type: 'image/jpeg',
      });

      const result = await FileUploadHandler.validateFile(fakeJpeg);
      expect(result.valid).toBe(false);
    });
  });

  describe('Retry Logic', () => {
    it('retries on retryable errors', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('ECONNRESET');
        }
        return 'success';
      };

      const result = await withRetry(operation, { maxRetries: 3 });
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('does not retry non-retryable errors', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error('Invalid input');
      };

      await expect(withRetry(operation)).rejects.toThrow('Invalid input');
      expect(attempts).toBe(1);
    });
  });
});
```

---

## 📋 API EDGE CASES CHECKLIST

```markdown
## Edge Cases Covered

### Rate Limiting
- [ ] Tiered limits by user plan
- [ ] Cost-based limiting (expensive endpoints)
- [ ] Sliding window algorithm
- [ ] Rate limit headers in response

### Timeouts
- [ ] Request timeout handling
- [ ] Streaming heartbeats
- [ ] Graceful timeout responses

### Payloads
- [ ] Size validation
- [ ] Streaming large JSON
- [ ] Chunked responses

### File Uploads
- [ ] Size limits
- [ ] MIME type validation
- [ ] Magic byte verification
- [ ] Safe filename generation
- [ ] Chunked uploads

### Idempotency
- [ ] Idempotency key handling
- [ ] Response caching
- [ ] Concurrent request detection

### Resilience
- [ ] Retry with backoff
- [ ] Circuit breaker
- [ ] Jitter in retries

### Concurrency
- [ ] Distributed locking
- [ ] Optimistic concurrency
- [ ] Request deduplication
```

---
