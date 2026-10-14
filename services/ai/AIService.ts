import { z } from 'zod';
import { createRng } from '@/lib/random';
import { extractJson, sanitizeParentText, screenChildText, validateChoice } from './safety';

/**
 * LingoAI — constrained AI. It never talks freely with a child and never decides WHAT is learned.
 *
 * Every task is a *selection* among options that the curriculum/content team approved
 * (or prose for parents only). Outputs are validated; any failure falls back to a deterministic
 * choice, so the product works identically with AI disabled.
 */

export const AiTaskSchema = z.discriminatedUnion('task', [
  z.object({
    task: z.literal('roleplay-reply'),
    language: z.enum(['en', 'fr', 'de', 'it', 'es']),
    ageBand: z.enum(['little', 'adventurer', 'hero']),
    scenarioTitle: z.string().max(80),
    partnerLine: z.string().max(200),
    childUtterance: z.string().max(200),
    /** Approved reply options: id → target-language text */
    options: z.array(z.object({ id: z.string().max(80), text: z.string().max(200) })).min(1).max(8),
  }),
  z.object({
    task: z.literal('story-variation'),
    episodeTitle: z.string().max(120),
    interests: z.array(z.string().max(20)).max(15),
    options: z.array(z.object({ id: z.string().max(80), description: z.string().max(200) })).min(1).max(8),
  }),
  z.object({
    task: z.literal('parent-explanation'),
    locale: z.string().max(5),
    facts: z.array(z.string().max(240)).max(12),
  }),
]);
export type AiTask = z.infer<typeof AiTaskSchema>;

export interface AiResult {
  choiceId?: string;
  text?: string;
  provider: string;
  fallback: boolean;
}

export interface AIProvider {
  readonly id: string;
  complete(system: string, user: string, signal?: AbortSignal): Promise<string>;
}

const SYSTEM_BASE = `You are LingoAI inside a children's language-learning app (ages 4-11).
Strict rules:
- You only choose among the options you are given, or write short factual prose for PARENTS when asked.
- Never invent new target-language sentences, never ask for or repeat personal information, never mention links, brands or other apps.
- Never comment on appearance, never be negative, never create urgency or ask anyone to buy anything.
- Respond with a single JSON object exactly as requested and nothing else.`;

export class MockAIProvider implements AIProvider {
  readonly id = 'mock';
  async complete(): Promise<string> { return '{}'; } // forces deterministic fallback paths
}

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic';
  constructor(private readonly apiKey: string, private readonly model = 'claude-haiku-5-5') {}
  async complete(system: string, user: string, signal?: AbortSignal): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: this.model, max_tokens: 300, temperature: 0.4, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return data.content?.find((c) => c.type === 'text')?.text ?? '';
  }
}

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai';
  constructor(private readonly apiKey: string, private readonly model = 'gpt-4o-mini') {}
  async complete(system: string, user: string, signal?: AbortSignal): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, temperature: 0.4, max_tokens: 300, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? '';
  }
}

export class AIService {
  constructor(private readonly provider: AIProvider, private readonly timeoutMs = 6000) {}

  private async ask(user: string): Promise<Record<string, unknown> | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      return extractJson(await this.provider.complete(SYSTEM_BASE, user, ctrl.signal));
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async run(input: AiTask): Promise<AiResult> {
    const provider = this.provider.id;
    switch (input.task) {
      case 'roleplay-reply': {
        const ids = input.options.map((o) => o.id);
        const screened = screenChildText(input.childUtterance);
        // Deterministic fallback: the option most similar to what the child said, else the first.
        const fallbackId = bestOverlap(screened.redacted, input.options) ?? ids[0]!;
        if (!screened.safe) return { choiceId: fallbackId, provider, fallback: true };
        const json = await this.ask(`Role-play "${input.scenarioTitle}" in language "${input.language}" for an age band "${input.ageBand}" child.
The character said: "${input.partnerLine}". The child said (may be imperfect): "${screened.redacted}".
Which approved reply best matches what the child meant? Options: ${JSON.stringify(input.options)}.
Return {"choice":"<option id>"}.`);
        const choice = validateChoice(json?.choice, ids);
        return { choiceId: choice ?? fallbackId, provider, fallback: !choice };
      }
      case 'story-variation': {
        const ids = input.options.map((o) => o.id);
        const fallbackId = createRng(input.episodeTitle + input.interests.join()).pick(ids);
        const json = await this.ask(`Pick the story variation for the episode "${input.episodeTitle}" that best fits a child interested in ${input.interests.join(', ') || 'anything'}.
Options: ${JSON.stringify(input.options)}. Return {"choice":"<option id>"}.`);
        const choice = validateChoice(json?.choice, ids);
        return { choiceId: choice ?? fallbackId, provider, fallback: !choice };
      }
      case 'parent-explanation': {
        const fallback = input.facts.join(' ');
        const json = await this.ask(`Write a warm, factual 2-3 sentence summary for a PARENT in locale "${input.locale}" using ONLY these facts, without adding numbers or claims: ${JSON.stringify(input.facts)}.
Return {"text":"..."}.`);
        const text = typeof json?.text === 'string' ? sanitizeParentText(json.text) : '';
        return { text: text || fallback, provider, fallback: !text };
      }
    }
  }
}

function bestOverlap(said: string, options: { id: string; text: string }[]): string | null {
  const words = new Set(said.toLowerCase().split(/\W+/).filter((w) => w.length > 1));
  let best: string | null = null; let bestScore = 0;
  for (const o of options) {
    const score = o.text.toLowerCase().split(/\W+/).filter((w) => words.has(w)).length;
    if (score > bestScore) { bestScore = score; best = o.id; }
  }
  return best;
}
