import Conf from 'conf';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

interface ConfigSchema {
  apiKey: string | null;
  apiUrl: string;
  experienceLevel: ExperienceLevel;
}

const config = new Conf<ConfigSchema>({
  projectName: 'codebakers',
  defaults: {
    apiKey: null,
    apiUrl: 'https://codebakers.ai',
    experienceLevel: 'intermediate',
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
