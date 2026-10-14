import { NextResponse } from 'next/server';
import { AIService, AiTaskSchema, AnthropicProvider, MockAIProvider, OpenAIProvider } from '@/services/ai/AIService';
import { serverConfig } from '@/lib/server-config';
import { clientKey, rateLimit } from '@/lib/rate-limit';

/** LingoAI endpoint. Strict schema, rate-limited; provider keys never leave the server. */
function provider() {
  if (serverConfig.aiProvider === 'anthropic' && serverConfig.anthropicApiKey) return new AnthropicProvider(serverConfig.anthropicApiKey, serverConfig.aiModel || undefined);
  if (serverConfig.aiProvider === 'openai' && serverConfig.openaiApiKey) return new OpenAIProvider(serverConfig.openaiApiKey, serverConfig.aiModel || undefined);
  return new MockAIProvider();
}

export async function POST(req: Request) {
  if (!rateLimit(`ai:${clientKey(req)}`, 30)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const parsed = AiTaskSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const result = await new AIService(provider()).run(parsed.data);
  return NextResponse.json(result);
}
