# MOBILE & PWA
# Module: 13-mobile.md
# Load with: 00-core.md, 04-frontend.md

---

## 📱 PROGRESSIVE WEB APP (PWA)

### Next.js PWA Configuration

```typescript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.yourdomain\.com\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60, // 1 hour
        },
        networkTimeoutSeconds: 10,
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
```

### Web App Manifest

```json
// public/manifest.json
{
  "name": "Your App Name",
  "short_name": "AppName",
  "description": "Your app description",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshots/mobile.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],
  "categories": ["productivity", "business"],
  "shortcuts": [
    {
      "name": "Dashboard",
      "short_name": "Dashboard",
      "description": "Go to dashboard",
      "url": "/dashboard",
      "icons": [{ "src": "/icons/dashboard.png", "sizes": "96x96" }]
    },
    {
      "name": "New Item",
      "short_name": "Create",
      "description": "Create new item",
      "url": "/new",
      "icons": [{ "src": "/icons/create.png", "sizes": "96x96" }]
    }
  ]
}
```

### PWA Meta Tags

```typescript
// app/layout.tsx
export const metadata: Metadata = {
  title: 'Your App',
  description: 'Your app description',
  manifest: '/manifest.json',
  themeColor: '#000000',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Your App',
  },
  formatDetection: {
    telephone: false,
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
  icons: {
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
};
```

---

## 📴 OFFLINE SUPPORT

### Service Worker Registration

```typescript
// lib/sw-registration.ts
export function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration.scope);
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content available, show update prompt
                  if (confirm('New version available! Reload to update?')) {
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('SW registration failed:', error);
        });
    });
  }
}
```

### Offline Detection Hook

```typescript
// hooks/use-online-status.ts
import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Offline indicator component
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-yellow-500 text-black px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 sm:left-auto sm:right-4 sm:w-auto">
      <WifiOff className="h-5 w-5" />
      <span>You're offline. Some features may be limited.</span>
    </div>
  );
}
```

### Offline Data Queue

```typescript
// lib/offline-queue.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineQueueSchema extends DBSchema {
  pending_actions: {
    key: string;
    value: {
      id: string;
      action: string;
      payload: unknown;
      timestamp: number;
      retries: number;
    };
    indexes: { 'by-timestamp': number };
  };
  cached_data: {
    key: string;
    value: {
      key: string;
      data: unknown;
      timestamp: number;
      expiresAt: number;
    };
  };
}

class OfflineQueue {
  private db: IDBPDatabase<OfflineQueueSchema> | null = null;
  private syncing = false;

  async init() {
    this.db = await openDB<OfflineQueueSchema>('offline-queue', 1, {
      upgrade(db) {
        const actionStore = db.createObjectStore('pending_actions', {
          keyPath: 'id',
        });
        actionStore.createIndex('by-timestamp', 'timestamp');

        db.createObjectStore('cached_data', { keyPath: 'key' });
      },
    });
  }

  async queueAction(action: string, payload: unknown): Promise<string> {
    if (!this.db) await this.init();

    const id = crypto.randomUUID();
    await this.db!.add('pending_actions', {
      id,
      action,
      payload,
      timestamp: Date.now(),
      retries: 0,
    });

    // Try to sync if online
    if (navigator.onLine) {
      this.sync();
    }

    return id;
  }

  async sync(): Promise<void> {
    if (this.syncing || !navigator.onLine) return;

    this.syncing = true;

    try {
      const actions = await this.db!.getAllFromIndex(
        'pending_actions',
        'by-timestamp'
      );

      for (const action of actions) {
        try {
          await this.executeAction(action);
          await this.db!.delete('pending_actions', action.id);
        } catch (error) {
          // Increment retry count
          if (action.retries < 3) {
            await this.db!.put('pending_actions', {
              ...action,
              retries: action.retries + 1,
            });
          } else {
            // Max retries reached, remove and notify
            await this.db!.delete('pending_actions', action.id);
            console.error('Action failed after max retries:', action);
          }
        }
      }
    } finally {
      this.syncing = false;
    }
  }

  private async executeAction(action: {
    action: string;
    payload: unknown;
  }): Promise<void> {
    // Map action types to API calls
    switch (action.action) {
      case 'create_item':
        await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload),
        });
        break;
      case 'update_item':
        const { id, ...data } = action.payload as { id: string };
        await fetch(`/api/items/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        break;
      default:
        throw new Error(`Unknown action: ${action.action}`);
    }
  }

  // Cache data for offline access
  async cacheData(key: string, data: unknown, ttlMs = 3600000): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.put('cached_data', {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
  }

  async getCachedData<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init();

    const cached = await this.db!.get('cached_data', key);
    if (!cached) return null;

    if (cached.expiresAt < Date.now()) {
      await this.db!.delete('cached_data', key);
      return null;
    }

    return cached.data as T;
  }

  getPendingCount(): Promise<number> {
    return this.db!.count('pending_actions');
  }
}

export const offlineQueue = new OfflineQueue();

// Auto-sync when coming online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    offlineQueue.sync();
  });
}
```

---

## 📲 PUSH NOTIFICATIONS

### Request Permission

```typescript
// lib/push-notifications.ts
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  
  // Get existing subscription
  let subscription = await registration.pushManager.getSubscription();
  
  if (subscription) {
    return subscription;
  }

  // Create new subscription
  subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
    ),
  });

  // Send to server
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });

  return subscription;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
```

### Server-Side Push

```typescript
// services/push-service.ts
import webpush from 'web-push';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';

webpush.setVapidDetails(
  'mailto:support@yourdomain.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  data?: Record<string, unknown>;
}

export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<void> {
  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/badge-72x72.png',
    data: {
      url: payload.url || '/',
      ...payload.data,
    },
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notification
        );
      } catch (error: any) {
        if (error.statusCode === 410) {
          // Subscription expired, remove it
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
        }
        throw error;
      }
    })
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error('Some push notifications failed:', failed);
  }
}
```

---

## 📱 REACT NATIVE (Expo)

### Project Setup

```bash
# Create new Expo project
npx create-expo-app@latest my-app --template blank-typescript

# Install common dependencies
npx expo install expo-router expo-status-bar expo-secure-store
npx expo install @react-navigation/native @react-navigation/stack
npx expo install react-native-safe-area-context react-native-screens
npx expo install expo-notifications expo-device
```

### App Configuration

```json
// app.json
{
  "expo": {
    "name": "My App",
    "slug": "my-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.myapp",
      "infoPlist": {
        "NSCameraUsageDescription": "Used for scanning documents",
        "NSPhotoLibraryUsageDescription": "Used for uploading images"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.yourcompany.myapp",
      "permissions": ["CAMERA", "READ_EXTERNAL_STORAGE"]
    },
    "plugins": [
      "expo-router",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff"
        }
      ]
    ],
    "scheme": "myapp"
  }
}
```

### Authentication with Secure Storage

```typescript
// lib/auth-storage.ts
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';

export const authStorage = {
  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },

  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },

  async getUser(): Promise<User | null> {
    const userData = await SecureStore.getItemAsync(USER_KEY);
    return userData ? JSON.parse(userData) : null;
  },

  async setUser(user: User): Promise<void> {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  },
};
```

### API Client with Token Refresh

```typescript
// lib/api-client.ts
import { authStorage } from './auth-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private refreshPromise: Promise<string | null> | null = null;

  async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (!skipAuth) {
      const token = await this.getValidToken();
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    if (response.status === 401 && !skipAuth) {
      // Token expired, try refresh
      const newToken = await this.refreshToken();
      if (newToken) {
        // Retry with new token
        return this.fetch<T>(endpoint, options);
      }
      // Refresh failed, redirect to login
      throw new AuthError('Session expired');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(error.message || 'Request failed', response.status);
    }

    return response.json();
  }

  private async getValidToken(): Promise<string | null> {
    return authStorage.getToken();
  }

  private async refreshToken(): Promise<string | null> {
    // Prevent multiple concurrent refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh();
    const result = await this.refreshPromise;
    this.refreshPromise = null;
    return result;
  }

  private async doRefresh(): Promise<string | null> {
    const refreshToken = await authStorage.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        await authStorage.clear();
        return null;
      }

      const { token, refreshToken: newRefreshToken } = await response.json();
      await authStorage.setToken(token);
      await authStorage.setRefreshToken(newRefreshToken);
      return token;
    } catch {
      await authStorage.clear();
      return null;
    }
  }

  // Convenience methods
  get<T>(endpoint: string, options?: FetchOptions) {
    return this.fetch<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body: unknown, options?: FetchOptions) {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put<T>(endpoint: string, body: unknown, options?: FetchOptions) {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete<T>(endpoint: string, options?: FetchOptions) {
    return this.fetch<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
```

### Push Notifications (Expo)

```typescript
// lib/push-notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api-client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  // Check/request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted');
    return null;
  }

  // Get push token
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  });

  // Configure Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // Send token to server
  await api.post('/push/register', {
    token: token.data,
    platform: Platform.OS,
  });

  return token.data;
}

export function useNotificationListeners(
  onNotification?: (notification: Notifications.Notification) => void,
  onResponse?: (response: Notifications.NotificationResponse) => void
) {
  useEffect(() => {
    // Notification received while app is foregrounded
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        onNotification?.(notification);
      }
    );

    // User tapped on notification
    const responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        onResponse?.(response);
        // Handle navigation based on notification data
        const data = response.notification.request.content.data;
        if (data?.url) {
          // Navigate to URL
        }
      }
    );

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, [onNotification, onResponse]);
}
```

---

## 📲 RESPONSIVE MOBILE UI

### Safe Area Handling

```typescript
// components/safe-view.tsx
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SafeViewProps {
  children: React.ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: ViewStyle;
}

export function SafeView({ children, edges = ['top', 'bottom'], style }: SafeViewProps) {
  const insets = useSafeAreaInsets();

  const padding = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  return (
    <View style={[styles.container, padding, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
```

### Touch-Optimized Components

```typescript
// components/pressable-scale.tsx
import { Pressable, PressableProps, Animated } from 'react-native';
import { useRef } from 'react';

interface PressableScaleProps extends PressableProps {
  scale?: number;
}

export function PressableScale({
  children,
  scale = 0.95,
  style,
  ...props
}: PressableScaleProps) {
  const animated = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(animated, {
      toValue: scale,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(animated, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...props}
    >
      <Animated.View style={[style, { transform: [{ scale: animated }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
```

---

## 🎯 MOBILE CHECKLIST

```markdown
## PWA Checklist
- [ ] manifest.json configured
- [ ] All icon sizes created
- [ ] Service worker registered
- [ ] Offline page works
- [ ] App installable
- [ ] Push notifications work

## React Native Checklist
- [ ] Secure storage for tokens
- [ ] API client with refresh
- [ ] Push notifications configured
- [ ] Deep linking works
- [ ] Safe areas handled
- [ ] App icons & splash screen
- [ ] App store assets ready

## Offline Support
- [ ] Offline detection works
- [ ] Data cached locally
- [ ] Actions queued when offline
- [ ] Sync works when back online
- [ ] User notified of status
```

---
