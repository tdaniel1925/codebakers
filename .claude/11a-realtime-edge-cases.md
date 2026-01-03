# REALTIME EDGE CASES
# Module: 11a-realtime-edge-cases.md
# Load with: 00-core.md, 11-realtime.md
# Covers: Connection drops, reconnection, message ordering, presence conflicts

---

## 🔌 CONNECTION MANAGEMENT

```typescript
// lib/realtime/connection-manager.ts
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  lastConnectedAt?: Date;
  reconnectAttempts: number;
  error?: string;
}

export const RECONNECT_CONFIG = {
  maxRetries: 10,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.3,
};

export class ConnectionManager {
  private state: ConnectionState = {
    status: 'disconnected',
    reconnectAttempts: 0,
  };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(state: ConnectionState) => void> = new Set();

  /**
   * Handle connection drop with exponential backoff
   */
  async handleDisconnect(error?: Error): Promise<void> {
    this.state = {
      ...this.state,
      status: 'disconnected',
      error: error?.message,
    };
    this.notifyListeners();

    if (this.state.reconnectAttempts < RECONNECT_CONFIG.maxRetries) {
      this.scheduleReconnect();
    } else {
      this.handleMaxRetriesExceeded();
    }
  }

  /**
   * Schedule reconnection with backoff
   */
  private scheduleReconnect(): void {
    const delay = this.calculateBackoff(this.state.reconnectAttempts);

    this.state = { ...this.state, status: 'reconnecting' };
    this.notifyListeners();

    this.reconnectTimer = setTimeout(async () => {
      this.state.reconnectAttempts++;

      try {
        await this.reconnect();
        this.state = {
          status: 'connected',
          lastConnectedAt: new Date(),
          reconnectAttempts: 0,
        };
        this.notifyListeners();

        // Sync any missed messages
        await this.syncMissedMessages();
      } catch (error) {
        this.handleDisconnect(error as Error);
      }
    }, delay);
  }

  /**
   * Calculate backoff with jitter
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = RECONNECT_CONFIG.baseDelayMs * Math.pow(2, attempt);
    const jitter = baseDelay * RECONNECT_CONFIG.jitterFactor * Math.random();
    return Math.min(baseDelay + jitter, RECONNECT_CONFIG.maxDelayMs);
  }

  /**
   * Handle when max retries exceeded
   */
  private handleMaxRetriesExceeded(): void {
    this.state = {
      ...this.state,
      status: 'disconnected',
      error: 'Max reconnection attempts exceeded',
    };
    this.notifyListeners();

    // Show user action required
    this.promptUserReconnect();
  }

  /**
   * Manual reconnect (user initiated)
   */
  async manualReconnect(): Promise<void> {
    this.state.reconnectAttempts = 0;
    await this.reconnect();
  }

  /**
   * Sync messages missed during disconnect
   */
  private async syncMissedMessages(): Promise<void> {
    if (!this.state.lastConnectedAt) return;

    // Fetch messages since last connected
    // Implementation depends on your message storage
  }

  private async reconnect(): Promise<void> {
    // Implementation - reconnect to realtime service
  }

  private promptUserReconnect(): void {
    // Show UI prompt
  }

  subscribe(listener: (state: ConnectionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }
}
```

---

## 📨 MESSAGE ORDERING & DEDUPLICATION

```typescript
// lib/realtime/message-handler.ts

export interface RealtimeMessage {
  id: string;
  sequence: number;
  timestamp: number;
  channelId: string;
  payload: unknown;
}

export class MessageHandler {
  private receivedMessages = new Map<string, Set<string>>();
  private expectedSequence = new Map<string, number>();
  private messageBuffer = new Map<string, RealtimeMessage[]>();

  /**
   * Process incoming message with ordering and deduplication
   */
  processMessage(message: RealtimeMessage): {
    action: 'process' | 'duplicate' | 'buffer' | 'gap_detected';
    missingSequences?: number[];
  } {
    const { channelId, id, sequence } = message;

    // Check for duplicate
    const channelMessages = this.receivedMessages.get(channelId) || new Set();
    if (channelMessages.has(id)) {
      return { action: 'duplicate' };
    }

    // Track message
    channelMessages.add(id);
    this.receivedMessages.set(channelId, channelMessages);

    // Check sequence
    const expected = this.expectedSequence.get(channelId) || 0;

    if (sequence === expected) {
      this.expectedSequence.set(channelId, expected + 1);

      // Process any buffered messages
      this.processBuffered(channelId);

      return { action: 'process' };
    }

    if (sequence > expected) {
      // Gap detected - buffer this message
      const buffer = this.messageBuffer.get(channelId) || [];
      buffer.push(message);
      buffer.sort((a, b) => a.sequence - b.sequence);
      this.messageBuffer.set(channelId, buffer);

      const missing = Array.from(
        { length: sequence - expected },
        (_, i) => expected + i
      );

      return { action: 'gap_detected', missingSequences: missing };
    }

    // sequence < expected - old message, likely duplicate
    return { action: 'duplicate' };
  }

  /**
   * Process buffered messages after gap is filled
   */
  private processBuffered(channelId: string): void {
    const buffer = this.messageBuffer.get(channelId) || [];
    const expected = this.expectedSequence.get(channelId) || 0;

    while (buffer.length > 0 && buffer[0].sequence === expected) {
      const message = buffer.shift()!;
      this.expectedSequence.set(channelId, expected + 1);
      // Emit message for processing
      this.emit(message);
    }

    this.messageBuffer.set(channelId, buffer);
  }

  /**
   * Request missing messages from server
   */
  async requestMissing(
    channelId: string,
    sequences: number[]
  ): Promise<RealtimeMessage[]> {
    // Request from server
    const response = await fetch('/api/realtime/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, sequences }),
    });

    return response.json();
  }

  /**
   * Clean up old message tracking
   */
  cleanup(maxAge: number = 5 * 60 * 1000): void {
    // Keep message tracking for 5 minutes by default
    const cutoff = Date.now() - maxAge;

    // Clean up based on timestamp
    // Implementation depends on tracking structure
  }

  private emit(message: RealtimeMessage): void {
    // Emit to subscribers
  }
}
```

---

## 👥 PRESENCE EDGE CASES

```typescript
// lib/realtime/presence-manager.ts

export interface PresenceState {
  odId: string
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  metadata?: Record<string, unknown>;
}

export class PresenceManager {
  private localState: PresenceState | null = null;
  private remoteStates = new Map<string, PresenceState>();
  private syncInProgress = false;

  /**
   * Handle presence sync conflicts
   */
  async handleSyncConflict(
    localState: PresenceState,
    serverState: PresenceState
  ): Promise<PresenceState> {
    // Server wins for status, merge metadata
    return {
      ...serverState,
      metadata: {
        ...localState.metadata,
        ...serverState.metadata,
        _conflictResolved: Date.now(),
      },
    };
  }

  /**
   * Handle stale presence (user appears online but is gone)
   */
  async handleStalePresence(userId: string, timeout: number = 30000): Promise<void> {
    const state = this.remoteStates.get(userId);
    if (!state) return;

    const timeSinceLastSeen = Date.now() - state.lastSeen.getTime();

    if (timeSinceLastSeen > timeout && state.status === 'online') {
      // Mark as away/offline
      this.remoteStates.set(userId, {
        ...state,
        status: 'away',
      });

      // Optionally ping user to confirm
      await this.pingUser(userId);
    }
  }

  /**
   * Handle race condition: user joins on multiple devices
   */
  async handleMultiDeviceJoin(
    userId: string,
    deviceId: string,
    existingDevices: string[]
  ): Promise<{
    action: 'allow' | 'deny' | 'merge';
    primaryDevice?: string;
  }> {
    // Option 1: Allow multiple devices, merge presence
    // Option 2: Deny new device, keep existing
    // Option 3: Make new device primary, update existing

    if (existingDevices.length >= 3) {
      // Limit devices
      return { action: 'deny' };
    }

    return {
      action: 'merge',
      primaryDevice: deviceId, // New device is primary
    };
  }

  /**
   * Handle presence state recovery after disconnect
   */
  async recoverPresenceState(): Promise<void> {
    if (!this.localState) return;

    // Rejoin with previous state
    await this.announce({
      ...this.localState,
      lastSeen: new Date(),
      metadata: {
        ...this.localState.metadata,
        _recovered: true,
      },
    });
  }

  /**
   * Graceful presence cleanup on page unload
   */
  setupUnloadHandler(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeunload', () => {
      // Send synchronous beacon to mark as offline
      navigator.sendBeacon('/api/presence/leave', JSON.stringify({
        userId: this.localState?.userId,
      }));
    });

    // Handle visibility change (tab becomes hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.updateStatus('away');
      } else {
        this.updateStatus('online');
      }
    });
  }

  private async pingUser(userId: string): Promise<boolean> {
    // Implementation
    return true;
  }

  private async announce(state: PresenceState): Promise<void> {
    // Implementation
  }

  private async updateStatus(status: PresenceState['status']): Promise<void> {
    // Implementation
  }
}
```

---

## 🔔 NOTIFICATION DELIVERY EDGE CASES

```typescript
// lib/realtime/notification-service.ts

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority: 'high' | 'normal' | 'low';
  expiresAt?: Date;
}

export class NotificationService {
  private pendingNotifications = new Map<string, Notification[]>();
  private deliveryAttempts = new Map<string, number>();

  /**
   * Deliver notification with fallback
   */
  async deliver(notification: Notification): Promise<{
    delivered: boolean;
    channel: 'realtime' | 'push' | 'email' | 'queued';
  }> {
    // Check if user is connected
    const isOnline = await this.isUserOnline(notification.userId);

    if (isOnline) {
      // Try realtime delivery
      const realtimeSuccess = await this.deliverRealtime(notification);
      if (realtimeSuccess) {
        return { delivered: true, channel: 'realtime' };
      }
    }

    // Fallback based on priority
    if (notification.priority === 'high') {
      // Try push notification
      const pushSuccess = await this.deliverPush(notification);
      if (pushSuccess) {
        return { delivered: true, channel: 'push' };
      }

      // Final fallback: email
      await this.deliverEmail(notification);
      return { delivered: true, channel: 'email' };
    }

    // Queue for later delivery
    await this.queueNotification(notification);
    return { delivered: false, channel: 'queued' };
  }

  /**
   * Handle delivery failure with retry
   */
  async handleDeliveryFailure(
    notification: Notification,
    error: Error
  ): Promise<void> {
    const attempts = this.deliveryAttempts.get(notification.id) || 0;

    if (attempts < 3) {
      this.deliveryAttempts.set(notification.id, attempts + 1);

      // Retry with backoff
      const delay = Math.pow(2, attempts) * 1000;
      setTimeout(() => this.deliver(notification), delay);
    } else {
      // Log failure and queue for manual review
      console.error(`Notification delivery failed after ${attempts} attempts:`, {
        notificationId: notification.id,
        error: error.message,
      });

      await this.queueForReview(notification);
    }
  }

  /**
   * Deliver queued notifications when user comes online
   */
  async deliverQueued(userId: string): Promise<number> {
    const pending = this.pendingNotifications.get(userId) || [];
    const now = new Date();

    // Filter out expired notifications
    const valid = pending.filter(
      (n) => !n.expiresAt || n.expiresAt > now
    );

    let delivered = 0;
    for (const notification of valid) {
      const result = await this.deliver(notification);
      if (result.delivered) {
        delivered++;
      }
    }

    // Clear delivered notifications
    this.pendingNotifications.set(userId, []);

    return delivered;
  }

  /**
   * Handle notification coalescence (combine similar notifications)
   */
  coalesce(notifications: Notification[]): Notification[] {
    const grouped = new Map<string, Notification[]>();

    // Group by type
    for (const notification of notifications) {
      const key = `${notification.type}:${notification.userId}`;
      const group = grouped.get(key) || [];
      group.push(notification);
      grouped.set(key, group);
    }

    // Combine groups
    const coalesced: Notification[] = [];
    for (const [key, group] of grouped) {
      if (group.length === 1) {
        coalesced.push(group[0]);
      } else {
        // Create combined notification
        coalesced.push({
          id: group[0].id,
          userId: group[0].userId,
          type: group[0].type,
          title: group[0].title,
          body: `${group.length} new ${group[0].type} notifications`,
          priority: 'normal',
          data: {
            combined: true,
            count: group.length,
            items: group.map((n) => n.data),
          },
        });
      }
    }

    return coalesced;
  }

  private async isUserOnline(userId: string): Promise<boolean> {
    // Check presence
    return true;
  }

  private async deliverRealtime(notification: Notification): Promise<boolean> {
    // Implementation
    return true;
  }

  private async deliverPush(notification: Notification): Promise<boolean> {
    // Implementation
    return true;
  }

  private async deliverEmail(notification: Notification): Promise<void> {
    // Implementation
  }

  private async queueNotification(notification: Notification): Promise<void> {
    const pending = this.pendingNotifications.get(notification.userId) || [];
    pending.push(notification);
    this.pendingNotifications.set(notification.userId, pending);
  }

  private async queueForReview(notification: Notification): Promise<void> {
    // Log for manual review
  }
}
```

---

## 📋 REALTIME EDGE CASES CHECKLIST

```markdown
## Edge Cases Covered

### Connection
- [ ] Reconnection with exponential backoff
- [ ] Max retry handling
- [ ] User-initiated reconnect
- [ ] Missed message sync

### Message Ordering
- [ ] Sequence tracking
- [ ] Gap detection
- [ ] Message buffering
- [ ] Deduplication

### Presence
- [ ] Sync conflict resolution
- [ ] Stale presence cleanup
- [ ] Multi-device handling
- [ ] State recovery
- [ ] Graceful disconnect

### Notifications
- [ ] Fallback delivery chain
- [ ] Retry with backoff
- [ ] Queued delivery
- [ ] Notification coalescence
```

---
