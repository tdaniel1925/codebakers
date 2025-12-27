# AUTHENTICATION EDGE CASES
# Module: 02a-auth-edge-cases.md
# Load with: 00-core.md, 02-auth.md
# Covers: Session management, account lockout, password reset, OAuth failures, security

---

## 🔒 ACCOUNT LOCKOUT & BRUTE FORCE PROTECTION

```typescript
// services/auth/lockout-service.ts
import { db } from '@/db';
import { loginAttempts, accountLockouts } from '@/db/schema';
import { eq, and, gt, count } from 'drizzle-orm';

export const LOCKOUT_CONFIG = {
  maxAttempts: 5,
  lockoutDurationMinutes: 15,
  attemptWindowMinutes: 15,
  progressiveLockout: true, // Each lockout doubles duration
  maxLockoutDurationMinutes: 1440, // 24 hours max
};

export class LockoutService {
  /**
   * Record a login attempt
   */
  static async recordAttempt(
    identifier: string, // email or IP
    type: 'email' | 'ip',
    success: boolean,
    metadata?: { userAgent?: string; ip?: string }
  ): Promise<void> {
    await db.insert(loginAttempts).values({
      identifier,
      identifierType: type,
      success,
      ipAddress: metadata?.ip,
      userAgent: metadata?.userAgent,
      attemptedAt: new Date(),
    });

    if (!success) {
      await this.checkAndApplyLockout(identifier, type);
    } else {
      // Clear failed attempts on successful login
      await this.clearAttempts(identifier, type);
    }
  }

  /**
   * Check if account/IP is locked
   */
  static async isLocked(
    identifier: string,
    type: 'email' | 'ip'
  ): Promise<{ locked: boolean; unlockAt?: Date; reason?: string }> {
    const [lockout] = await db
      .select()
      .from(accountLockouts)
      .where(
        and(
          eq(accountLockouts.identifier, identifier),
          eq(accountLockouts.identifierType, type),
          gt(accountLockouts.lockedUntil, new Date())
        )
      )
      .limit(1);

    if (lockout) {
      return {
        locked: true,
        unlockAt: lockout.lockedUntil,
        reason: lockout.reason,
      };
    }

    return { locked: false };
  }

  /**
   * Check failed attempts and apply lockout if needed
   */
  private static async checkAndApplyLockout(
    identifier: string,
    type: 'email' | 'ip'
  ): Promise<void> {
    const windowStart = new Date(
      Date.now() - LOCKOUT_CONFIG.attemptWindowMinutes * 60 * 1000
    );

    // Count recent failed attempts
    const [result] = await db
      .select({ count: count() })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.identifier, identifier),
          eq(loginAttempts.identifierType, type),
          eq(loginAttempts.success, false),
          gt(loginAttempts.attemptedAt, windowStart)
        )
      );

    const failedAttempts = result?.count || 0;

    if (failedAttempts >= LOCKOUT_CONFIG.maxAttempts) {
      await this.applyLockout(identifier, type, failedAttempts);
    }
  }

  /**
   * Apply lockout with progressive duration
   */
  private static async applyLockout(
    identifier: string,
    type: 'email' | 'ip',
    failedAttempts: number
  ): Promise<void> {
    // Get previous lockout count for progressive lockout
    const previousLockouts = await db
      .select({ count: count() })
      .from(accountLockouts)
      .where(
        and(
          eq(accountLockouts.identifier, identifier),
          eq(accountLockouts.identifierType, type)
        )
      );

    const lockoutCount = previousLockouts[0]?.count || 0;

    // Calculate duration (doubles each time)
    let durationMinutes = LOCKOUT_CONFIG.lockoutDurationMinutes;
    if (LOCKOUT_CONFIG.progressiveLockout) {
      durationMinutes = Math.min(
        durationMinutes * Math.pow(2, lockoutCount),
        LOCKOUT_CONFIG.maxLockoutDurationMinutes
      );
    }

    const lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

    await db.insert(accountLockouts).values({
      identifier,
      identifierType: type,
      lockedUntil,
      reason: `Too many failed attempts (${failedAttempts})`,
      lockoutNumber: lockoutCount + 1,
    });

    console.warn(`Account locked: ${type}=${identifier} until ${lockedUntil}`);
  }

  /**
   * Clear failed attempts (called on successful login)
   */
  private static async clearAttempts(
    identifier: string,
    type: 'email' | 'ip'
  ): Promise<void> {
    await db
      .delete(loginAttempts)
      .where(
        and(
          eq(loginAttempts.identifier, identifier),
          eq(loginAttempts.identifierType, type)
        )
      );
  }

  /**
   * Manually unlock an account (admin action)
   */
  static async unlock(
    identifier: string,
    type: 'email' | 'ip',
    adminId: string
  ): Promise<void> {
    await db
      .update(accountLockouts)
      .set({
        lockedUntil: new Date(), // Expire immediately
        unlockedBy: adminId,
        unlockedAt: new Date(),
      })
      .where(
        and(
          eq(accountLockouts.identifier, identifier),
          eq(accountLockouts.identifierType, type)
        )
      );

    await this.clearAttempts(identifier, type);
  }
}

// Middleware for login endpoint
export async function checkLockout(
  email: string,
  ip: string
): Promise<{ allowed: boolean; error?: string; retryAfter?: number }> {
  // Check both email and IP lockouts
  const [emailLock, ipLock] = await Promise.all([
    LockoutService.isLocked(email, 'email'),
    LockoutService.isLocked(ip, 'ip'),
  ]);

  if (emailLock.locked) {
    const retryAfter = Math.ceil(
      (emailLock.unlockAt!.getTime() - Date.now()) / 1000
    );
    return {
      allowed: false,
      error: 'Account temporarily locked. Please try again later.',
      retryAfter,
    };
  }

  if (ipLock.locked) {
    const retryAfter = Math.ceil(
      (ipLock.unlockAt!.getTime() - Date.now()) / 1000
    );
    return {
      allowed: false,
      error: 'Too many requests from this IP. Please try again later.',
      retryAfter,
    };
  }

  return { allowed: true };
}
```

---

## 🔄 SESSION MANAGEMENT EDGE CASES

```typescript
// services/auth/session-service.ts
import { db } from '@/db';
import { sessions, sessionEvents } from '@/db/schema';
import { eq, and, lt, not, desc } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';

export const SESSION_CONFIG = {
  maxConcurrentSessions: 5,
  sessionTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days
  inactivityTimeout: 30 * 60 * 1000, // 30 minutes for sensitive actions
  requireReauthForSensitive: true,
};

export class SessionService {
  /**
   * Track active session (call on each request)
   */
  static async touchSession(
    sessionId: string,
    metadata: { ip: string; userAgent: string }
  ): Promise<void> {
    await db
      .update(sessions)
      .set({
        lastActiveAt: new Date(),
        lastIpAddress: metadata.ip,
        lastUserAgent: metadata.userAgent,
      })
      .where(eq(sessions.id, sessionId));
  }

  /**
   * Check if session is valid and not expired
   */
  static async validateSession(sessionId: string): Promise<{
    valid: boolean;
    reason?: string;
    session?: typeof sessions.$inferSelect;
  }> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    if (session.revokedAt) {
      return { valid: false, reason: 'Session revoked' };
    }

    if (session.expiresAt < new Date()) {
      return { valid: false, reason: 'Session expired' };
    }

    return { valid: true, session };
  }

  /**
   * Enforce max concurrent sessions
   */
  static async enforceSessionLimit(userId: string): Promise<void> {
    const activeSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          gt(sessions.expiresAt, new Date()),
          eq(sessions.revokedAt, null)
        )
      )
      .orderBy(desc(sessions.lastActiveAt));

    // If over limit, revoke oldest sessions
    if (activeSessions.length >= SESSION_CONFIG.maxConcurrentSessions) {
      const sessionsToRevoke = activeSessions.slice(
        SESSION_CONFIG.maxConcurrentSessions - 1
      );

      for (const session of sessionsToRevoke) {
        await this.revokeSession(session.id, 'session_limit_exceeded');
      }
    }
  }

  /**
   * Revoke a specific session
   */
  static async revokeSession(
    sessionId: string,
    reason: string
  ): Promise<void> {
    await db
      .update(sessions)
      .set({
        revokedAt: new Date(),
        revokeReason: reason,
      })
      .where(eq(sessions.id, sessionId));

    await db.insert(sessionEvents).values({
      sessionId,
      eventType: 'revoked',
      reason,
    });
  }

  /**
   * Revoke all sessions for a user (password change, security event)
   */
  static async revokeAllSessions(
    userId: string,
    reason: string,
    exceptSessionId?: string
  ): Promise<number> {
    const query = db
      .update(sessions)
      .set({
        revokedAt: new Date(),
        revokeReason: reason,
      })
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.revokedAt, null),
          exceptSessionId ? not(eq(sessions.id, exceptSessionId)) : undefined
        )
      );

    const result = await query;
    return result.rowCount || 0;
  }

  /**
   * Check if re-authentication is required for sensitive action
   */
  static async requiresReauth(sessionId: string): Promise<boolean> {
    if (!SESSION_CONFIG.requireReauthForSensitive) return false;

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session?.lastAuthenticatedAt) return true;

    const timeSinceAuth = Date.now() - session.lastAuthenticatedAt.getTime();
    return timeSinceAuth > SESSION_CONFIG.inactivityTimeout;
  }

  /**
   * Get all active sessions for user (for "manage sessions" UI)
   */
  static async getUserSessions(userId: string): Promise<Array<{
    id: string;
    device: string;
    location: string;
    lastActive: Date;
    isCurrent: boolean;
  }>> {
    const activeSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          gt(sessions.expiresAt, new Date()),
          eq(sessions.revokedAt, null)
        )
      )
      .orderBy(desc(sessions.lastActiveAt));

    return activeSessions.map((session) => ({
      id: session.id,
      device: this.parseUserAgent(session.lastUserAgent),
      location: session.lastIpAddress || 'Unknown',
      lastActive: session.lastActiveAt,
      isCurrent: false, // Caller should set this
    }));
  }

  private static parseUserAgent(userAgent: string | null): string {
    if (!userAgent) return 'Unknown device';
    // Simplified - use a proper UA parser library
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Windows')) return 'Windows';
    return 'Unknown device';
  }
}

// Component for session management UI
// components/settings/active-sessions.tsx
```

---

## 🔑 PASSWORD RESET EDGE CASES

```typescript
// services/auth/password-reset-service.ts
import { db } from '@/db';
import { passwordResetTokens, users, passwordHistory } from '@/db/schema';
import { eq, and, gt, lt } from 'drizzle-orm';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import crypto from 'crypto';

export const PASSWORD_RESET_CONFIG = {
  tokenExpiryMinutes: 60,
  maxRequestsPerHour: 3,
  minPasswordLength: 12,
  requireDifferentFromPrevious: 5, // Can't reuse last 5 passwords
  cooldownAfterReset: 24 * 60 * 60 * 1000, // 24h before another reset
};

export class PasswordResetService {
  /**
   * Request password reset (rate limited)
   */
  static async requestReset(email: string): Promise<{
    success: boolean;
    error?: string;
    retryAfter?: number;
  }> {
    // Check rate limit
    const recentRequests = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.email, email),
          gt(passwordResetTokens.createdAt, new Date(Date.now() - 60 * 60 * 1000))
        )
      );

    if (recentRequests.length >= PASSWORD_RESET_CONFIG.maxRequestsPerHour) {
      return {
        success: false,
        error: 'Too many reset requests. Please try again later.',
        retryAfter: 3600,
      };
    }

    // Check cooldown after recent reset
    const [recentReset] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.email, email),
          eq(passwordResetTokens.usedAt, not(null)),
          gt(
            passwordResetTokens.usedAt,
            new Date(Date.now() - PASSWORD_RESET_CONFIG.cooldownAfterReset)
          )
        )
      )
      .limit(1);

    if (recentReset) {
      return {
        success: false,
        error: 'Password was recently changed. Please wait before requesting another reset.',
      };
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_CONFIG.tokenExpiryMinutes * 60 * 1000
    );

    // Invalidate any existing tokens
    await db
      .update(passwordResetTokens)
      .set({ invalidatedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.email, email),
          eq(passwordResetTokens.invalidatedAt, null),
          eq(passwordResetTokens.usedAt, null)
        )
      );

    // Create new token
    await db.insert(passwordResetTokens).values({
      email,
      tokenHash: await hashPassword(token), // Store hashed
      expiresAt,
    });

    // Send email (don't reveal if email exists)
    // Always return success to prevent email enumeration
    return { success: true };
  }

  /**
   * Validate reset token
   */
  static async validateToken(
    email: string,
    token: string
  ): Promise<{ valid: boolean; error?: string; tokenId?: string }> {
    const tokens = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.email, email),
          gt(passwordResetTokens.expiresAt, new Date()),
          eq(passwordResetTokens.usedAt, null),
          eq(passwordResetTokens.invalidatedAt, null)
        )
      );

    for (const t of tokens) {
      const valid = await verifyPassword(token, t.tokenHash);
      if (valid) {
        return { valid: true, tokenId: t.id };
      }
    }

    return { valid: false, error: 'Invalid or expired reset link' };
  }

  /**
   * Reset password with token
   */
  static async resetPassword(
    email: string,
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    // Validate token
    const validation = await this.validateToken(email, token);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Validate password strength
    const strengthCheck = this.validatePasswordStrength(newPassword);
    if (!strengthCheck.valid) {
      return { success: false, error: strengthCheck.error };
    }

    // Check password history
    const historyCheck = await this.checkPasswordHistory(email, newPassword);
    if (!historyCheck.valid) {
      return { success: false, error: historyCheck.error };
    }

    // Update password via Supabase Admin
    const supabase = createAdminClient();
    const { data: user } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (error) {
      return { success: false, error: 'Failed to update password' };
    }

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, validation.tokenId!));

    // Add to password history
    const passwordHash = await hashPassword(newPassword);
    await db.insert(passwordHistory).values({
      userId: user.id,
      passwordHash,
    });

    // Revoke all sessions except current
    await SessionService.revokeAllSessions(user.id, 'password_reset');

    return { success: true };
  }

  /**
   * Validate password strength
   */
  private static validatePasswordStrength(password: string): {
    valid: boolean;
    error?: string;
  } {
    if (password.length < PASSWORD_RESET_CONFIG.minPasswordLength) {
      return {
        valid: false,
        error: `Password must be at least ${PASSWORD_RESET_CONFIG.minPasswordLength} characters`,
      };
    }

    // Check for common patterns
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const complexity = [hasLowercase, hasUppercase, hasNumber, hasSpecial].filter(
      Boolean
    ).length;

    if (complexity < 3) {
      return {
        valid: false,
        error:
          'Password must contain at least 3 of: lowercase, uppercase, number, special character',
      };
    }

    // Check for common passwords (abbreviated list)
    const commonPasswords = ['password123', 'qwerty123', '123456789'];
    if (commonPasswords.includes(password.toLowerCase())) {
      return { valid: false, error: 'This password is too common' };
    }

    return { valid: true };
  }

  /**
   * Check if password was used recently
   */
  private static async checkPasswordHistory(
    email: string,
    newPassword: string
  ): Promise<{ valid: boolean; error?: string }> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) return { valid: true };

    const history = await db
      .select()
      .from(passwordHistory)
      .where(eq(passwordHistory.userId, user.id))
      .orderBy(desc(passwordHistory.createdAt))
      .limit(PASSWORD_RESET_CONFIG.requireDifferentFromPrevious);

    for (const entry of history) {
      const matches = await verifyPassword(newPassword, entry.passwordHash);
      if (matches) {
        return {
          valid: false,
          error: `Cannot reuse one of your last ${PASSWORD_RESET_CONFIG.requireDifferentFromPrevious} passwords`,
        };
      }
    }

    return { valid: true };
  }
}
```

---

## 🌐 OAUTH EDGE CASES

```typescript
// services/auth/oauth-service.ts
import { db } from '@/db';
import { oauthConnections, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';

export class OAuthService {
  /**
   * Handle OAuth token refresh failure
   */
  static async handleTokenRefreshFailure(
    userId: string,
    provider: string,
    error: string
  ): Promise<void> {
    // Mark connection as needing re-authorization
    await db
      .update(oauthConnections)
      .set({
        status: 'needs_reauth',
        lastError: error,
        lastErrorAt: new Date(),
      })
      .where(
        and(
          eq(oauthConnections.userId, userId),
          eq(oauthConnections.provider, provider)
        )
      );

    // Notify user
    await this.notifyReauthRequired(userId, provider);
  }

  /**
   * Handle account linking conflicts
   */
  static async handleAccountLinkingConflict(
    existingUserId: string,
    newProviderUserId: string,
    provider: string
  ): Promise<{
    action: 'merge' | 'link' | 'reject';
    error?: string;
  }> {
    // Check if the OAuth account is already linked to another user
    const [existingConnection] = await db
      .select()
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.providerUserId, newProviderUserId),
          eq(oauthConnections.provider, provider)
        )
      )
      .limit(1);

    if (existingConnection) {
      if (existingConnection.userId === existingUserId) {
        return { action: 'link' }; // Already linked to this user
      }
      return {
        action: 'reject',
        error: 'This account is already linked to another user',
      };
    }

    return { action: 'link' };
  }

  /**
   * Handle OAuth email mismatch
   */
  static async handleEmailMismatch(
    userId: string,
    oauthEmail: string,
    accountEmail: string
  ): Promise<{ proceed: boolean; warning?: string }> {
    // Log the mismatch for security audit
    console.warn(
      `OAuth email mismatch: user=${userId}, oauth=${oauthEmail}, account=${accountEmail}`
    );

    // Option 1: Strict - reject if emails don't match
    // return { proceed: false, warning: 'Email mismatch' };

    // Option 2: Lenient - allow but warn
    return {
      proceed: true,
      warning:
        'The email from the OAuth provider differs from your account email',
    };
  }

  /**
   * Safely unlink OAuth provider
   */
  static async unlinkProvider(
    userId: string,
    provider: string
  ): Promise<{ success: boolean; error?: string }> {
    // Check if user has password or other OAuth methods
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const connections = await db
      .select()
      .from(oauthConnections)
      .where(eq(oauthConnections.userId, userId));

    const hasPassword = !!user?.passwordHash;
    const hasOtherOAuth = connections.some((c) => c.provider !== provider);

    if (!hasPassword && !hasOtherOAuth) {
      return {
        success: false,
        error: 'Cannot unlink - no other login method available',
      };
    }

    await db
      .delete(oauthConnections)
      .where(
        and(
          eq(oauthConnections.userId, userId),
          eq(oauthConnections.provider, provider)
        )
      );

    return { success: true };
  }

  private static async notifyReauthRequired(
    userId: string,
    provider: string
  ): Promise<void> {
    // Send email or in-app notification
  }
}
```

---

## 📧 EMAIL VERIFICATION EDGE CASES

```typescript
// services/auth/email-verification-service.ts
import { db } from '@/db';
import { emailVerificationTokens, users } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';

export const EMAIL_VERIFICATION_CONFIG = {
  tokenExpiryHours: 24,
  maxResendPerHour: 3,
  cooldownAfterVerification: 60 * 60 * 1000, // 1 hour
};

export class EmailVerificationService {
  /**
   * Handle verification of changed email
   */
  static async handleEmailChange(
    userId: string,
    newEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    // Check if new email is already in use
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, newEmail))
      .limit(1);

    if (existingUser && existingUser.id !== userId) {
      return { success: false, error: 'Email already in use' };
    }

    // Store pending email change (don't apply until verified)
    await db.update(users).set({
      pendingEmail: newEmail,
      pendingEmailVerifiedAt: null,
    }).where(eq(users.id, userId));

    // Send verification to NEW email
    await this.sendVerificationEmail(userId, newEmail, 'email_change');

    return { success: true };
  }

  /**
   * Verify email change token
   */
  static async verifyEmailChange(
    token: string
  ): Promise<{ success: boolean; error?: string }> {
    const [tokenRecord] = await db
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.token, token),
          gt(emailVerificationTokens.expiresAt, new Date()),
          eq(emailVerificationTokens.usedAt, null)
        )
      )
      .limit(1);

    if (!tokenRecord) {
      return { success: false, error: 'Invalid or expired token' };
    }

    // Apply the email change
    await db.update(users).set({
      email: tokenRecord.email,
      emailVerifiedAt: new Date(),
      pendingEmail: null,
    }).where(eq(users.id, tokenRecord.userId));

    // Mark token as used
    await db.update(emailVerificationTokens).set({
      usedAt: new Date(),
    }).where(eq(emailVerificationTokens.id, tokenRecord.id));

    // Revoke sessions (security measure for email change)
    await SessionService.revokeAllSessions(
      tokenRecord.userId,
      'email_changed'
    );

    return { success: true };
  }

  /**
   * Handle expired verification (user signs up but never verifies)
   */
  static async handleExpiredVerification(userId: string): Promise<void> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || user.emailVerifiedAt) return;

    // Check if account is old and unverified
    const accountAge = Date.now() - user.createdAt.getTime();
    const daysOld = accountAge / (24 * 60 * 60 * 1000);

    if (daysOld > 7 && !user.emailVerifiedAt) {
      // Option 1: Delete unverified account
      // await this.deleteUnverifiedAccount(userId);

      // Option 2: Mark as inactive
      await db.update(users).set({
        status: 'inactive_unverified',
      }).where(eq(users.id, userId));
    }
  }

  private static async sendVerificationEmail(
    userId: string,
    email: string,
    type: 'signup' | 'email_change'
  ): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + EMAIL_VERIFICATION_CONFIG.tokenExpiryHours * 60 * 60 * 1000
    );

    await db.insert(emailVerificationTokens).values({
      userId,
      email,
      token,
      type,
      expiresAt,
    });

    // Send email
  }
}
```

---

## 🗑️ ACCOUNT DELETION & DATA RETENTION

```typescript
// services/auth/account-deletion-service.ts
import { db } from '@/db';
import { users, deletionRequests, dataExports } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SessionService } from './session-service';

export const DELETION_CONFIG = {
  gracePeriodDays: 30, // Time before permanent deletion
  requirePasswordConfirmation: true,
  exportDataBeforeDeletion: true,
};

export class AccountDeletionService {
  /**
   * Request account deletion (starts grace period)
   */
  static async requestDeletion(
    userId: string,
    password: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string; deletionDate?: Date }> {
    // Verify password
    if (DELETION_CONFIG.requirePasswordConfirmation) {
      const verified = await this.verifyPassword(userId, password);
      if (!verified) {
        return { success: false, error: 'Invalid password' };
      }
    }

    const deletionDate = new Date(
      Date.now() + DELETION_CONFIG.gracePeriodDays * 24 * 60 * 60 * 1000
    );

    // Create deletion request
    await db.insert(deletionRequests).values({
      userId,
      reason,
      requestedAt: new Date(),
      scheduledDeletionAt: deletionDate,
      status: 'pending',
    });

    // Mark account for deletion
    await db.update(users).set({
      status: 'pending_deletion',
      scheduledDeletionAt: deletionDate,
    }).where(eq(users.id, userId));

    // Export user data if configured
    if (DELETION_CONFIG.exportDataBeforeDeletion) {
      await this.scheduleDataExport(userId);
    }

    // Revoke all sessions
    await SessionService.revokeAllSessions(userId, 'account_deletion_requested');

    // Send confirmation email with cancellation link

    return { success: true, deletionDate };
  }

  /**
   * Cancel pending deletion (during grace period)
   */
  static async cancelDeletion(
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const [request] = await db
      .select()
      .from(deletionRequests)
      .where(
        and(
          eq(deletionRequests.userId, userId),
          eq(deletionRequests.status, 'pending')
        )
      )
      .limit(1);

    if (!request) {
      return { success: false, error: 'No pending deletion request' };
    }

    // Cancel the request
    await db.update(deletionRequests).set({
      status: 'cancelled',
      cancelledAt: new Date(),
    }).where(eq(deletionRequests.id, request.id));

    // Restore account
    await db.update(users).set({
      status: 'active',
      scheduledDeletionAt: null,
    }).where(eq(users.id, userId));

    return { success: true };
  }

  /**
   * Execute permanent deletion (called by scheduled job)
   */
  static async executeDeletion(userId: string): Promise<void> {
    // Verify grace period has passed
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || user.status !== 'pending_deletion') {
      console.log(`Skipping deletion for ${userId} - not pending`);
      return;
    }

    if (user.scheduledDeletionAt && user.scheduledDeletionAt > new Date()) {
      console.log(`Skipping deletion for ${userId} - grace period not over`);
      return;
    }

    // Delete in order (respect foreign keys)
    await this.deleteUserData(userId);

    // Update deletion request
    await db.update(deletionRequests).set({
      status: 'completed',
      completedAt: new Date(),
    }).where(eq(deletionRequests.userId, userId));

    console.log(`Account ${userId} permanently deleted`);
  }

  /**
   * Delete all user data (in correct order for foreign keys)
   */
  private static async deleteUserData(userId: string): Promise<void> {
    // Delete in reverse dependency order
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.delete(oauthConnections).where(eq(oauthConnections.userId, userId));
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
    await db.delete(loginAttempts).where(eq(loginAttempts.userId, userId));

    // Team memberships (but not owned teams if data should be preserved)
    await db.delete(teamMembers).where(eq(teamMembers.userId, userId));

    // Finally, delete the user
    await db.delete(users).where(eq(users.id, userId));
  }

  /**
   * Export user data (GDPR compliance)
   */
  static async exportUserData(userId: string): Promise<string> {
    // Collect all user data
    const userData = {
      profile: await this.getProfileData(userId),
      sessions: await this.getSessionHistory(userId),
      loginHistory: await this.getLoginHistory(userId),
      // Add more data types
    };

    // Create export record
    const [exportRecord] = await db.insert(dataExports).values({
      userId,
      status: 'completed',
      data: JSON.stringify(userData),
    }).returning();

    return exportRecord.id;
  }

  private static async scheduleDataExport(userId: string): Promise<void> {
    // Queue data export job
  }

  private static async verifyPassword(userId: string, password: string): Promise<boolean> {
    // Implementation
    return true;
  }

  private static async getProfileData(userId: string): Promise<unknown> {
    // Implementation
  }

  private static async getSessionHistory(userId: string): Promise<unknown> {
    // Implementation
  }

  private static async getLoginHistory(userId: string): Promise<unknown> {
    // Implementation
  }
}
```

---

## 🧪 AUTH EDGE CASE TESTS

```typescript
// __tests__/auth/edge-cases.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LockoutService, LOCKOUT_CONFIG } from '@/services/auth/lockout-service';
import { PasswordResetService } from '@/services/auth/password-reset-service';
import { SessionService, SESSION_CONFIG } from '@/services/auth/session-service';

describe('Auth Edge Cases', () => {
  describe('Account Lockout', () => {
    it('locks after max failed attempts', async () => {
      const email = 'test@example.com';

      for (let i = 0; i < LOCKOUT_CONFIG.maxAttempts; i++) {
        await LockoutService.recordAttempt(email, 'email', false);
      }

      const status = await LockoutService.isLocked(email, 'email');
      expect(status.locked).toBe(true);
      expect(status.unlockAt).toBeDefined();
    });

    it('clears attempts on successful login', async () => {
      const email = 'test@example.com';
      await LockoutService.recordAttempt(email, 'email', false);
      await LockoutService.recordAttempt(email, 'email', true);

      const status = await LockoutService.isLocked(email, 'email');
      expect(status.locked).toBe(false);
    });
  });

  describe('Password Reset', () => {
    it('rate limits reset requests', async () => {
      const email = 'test@example.com';

      for (let i = 0; i < 3; i++) {
        await PasswordResetService.requestReset(email);
      }

      const result = await PasswordResetService.requestReset(email);
      expect(result.success).toBe(false);
      expect(result.retryAfter).toBe(3600);
    });

    it('prevents password reuse', async () => {
      const result = await PasswordResetService.resetPassword(
        'test@example.com',
        'valid-token',
        'previously-used-password'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot reuse');
    });
  });

  describe('Session Management', () => {
    it('enforces max concurrent sessions', async () => {
      const userId = 'user-123';

      // Create max sessions
      for (let i = 0; i < SESSION_CONFIG.maxConcurrentSessions + 2; i++) {
        await createTestSession(userId);
      }

      const sessions = await SessionService.getUserSessions(userId);
      expect(sessions.length).toBeLessThanOrEqual(SESSION_CONFIG.maxConcurrentSessions);
    });

    it('requires reauth for sensitive actions', async () => {
      const sessionId = 'session-123';
      // Set last auth to 31 minutes ago
      await setLastAuth(sessionId, Date.now() - 31 * 60 * 1000);

      const needsReauth = await SessionService.requiresReauth(sessionId);
      expect(needsReauth).toBe(true);
    });
  });
});
```

---

## 📋 AUTH EDGE CASES CHECKLIST

```markdown
## Edge Cases Covered

### Account Security
- [ ] Brute force protection (lockout after N attempts)
- [ ] Progressive lockout (doubles each time)
- [ ] IP-based rate limiting
- [ ] Account unlock by admin

### Session Management
- [ ] Max concurrent sessions enforced
- [ ] Session timeout handling
- [ ] Inactivity timeout for sensitive actions
- [ ] "Logout all devices" functionality
- [ ] Session revocation on password change

### Password Reset
- [ ] Rate limiting on reset requests
- [ ] Token expiration
- [ ] Password history (no reuse)
- [ ] Password strength validation
- [ ] Sessions revoked after reset

### OAuth
- [ ] Token refresh failure handling
- [ ] Account linking conflicts
- [ ] Email mismatch handling
- [ ] Unlink safety check

### Email Verification
- [ ] Email change verification
- [ ] Expired verification handling
- [ ] Rate limited resend

### Account Deletion
- [ ] Grace period before deletion
- [ ] Cancellation option
- [ ] Data export (GDPR)
- [ ] Complete data removal
```

---
