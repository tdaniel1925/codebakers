import Conf from 'conf';

interface ConfigSchema {
  apiKey: string | null;
  apiUrl: string;
}

const config = new Conf<ConfigSchema>({
  projectName: 'codebakers',
  defaults: {
    apiKey: null,
    apiUrl: 'https://codebakers.dev',
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
