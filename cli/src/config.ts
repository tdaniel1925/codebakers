import Conf from 'conf';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

interface ServiceKeys {
  github: string | null;
  supabase: string | null;
  vercel: string | null;
}

interface ConfigSchema {
  apiKey: string | null;
  apiUrl: string;
  experienceLevel: ExperienceLevel;
  serviceKeys: ServiceKeys;
}

const config = new Conf<ConfigSchema>({
  projectName: 'codebakers',
  defaults: {
    apiKey: null,
    apiUrl: 'https://codebakers.ai',
    experienceLevel: 'intermediate',
    serviceKeys: {
      github: null,
      supabase: null,
      vercel: null,
    },
  },
});

export function getApiKey(): string | null {
  return config.get('apiKey');
}

export function setApiKey(key: string): void {
  config.set('apiKey', key);
}

export function clearApiKey(): void {
  config.delete('apiKey');
}

export function getApiUrl(): string {
  return config.get('apiUrl');
}

export function setApiUrl(url: string): void {
  config.set('apiUrl', url);
}

export function getExperienceLevel(): ExperienceLevel {
  return config.get('experienceLevel');
}

export function setExperienceLevel(level: ExperienceLevel): void {
  config.set('experienceLevel', level);
}

// Service API Keys
export type ServiceName = 'github' | 'supabase' | 'vercel';

export function getServiceKey(service: ServiceName): string | null {
  const keys = config.get('serviceKeys');
  return keys[service];
}

export function setServiceKey(service: ServiceName, key: string): void {
  const keys = config.get('serviceKeys');
  keys[service] = key;
  config.set('serviceKeys', keys);
}

export function clearServiceKey(service: ServiceName): void {
  const keys = config.get('serviceKeys');
  keys[service] = null;
  config.set('serviceKeys', keys);
}

export function getAllServiceKeys(): ServiceKeys {
  return config.get('serviceKeys');
}
