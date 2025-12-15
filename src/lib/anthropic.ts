// Lazy Anthropic client that only initializes at runtime
// This prevents build-time errors when ANTHROPIC_API_KEY is not available

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let anthropicClient: any = null;

export async function getAnthropicClient() {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    // Only import and initialize at runtime when actually needed
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

export async function createMessage(params: {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  const client = await getAnthropicClient();
  return client.messages.create(params);
}
