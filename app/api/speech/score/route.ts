import { NextResponse } from 'next/server';
import { serverConfig } from '@/lib/server-config';
import { clientKey, rateLimit } from '@/lib/rate-limit';

/**
 * Optional server pronunciation scoring (PRONUNCIATION_PROVIDER=azure).
 * Accepts a short WAV/OGG clip, forwards it to the provider for phoneme-level assessment, returns the score,
 * and keeps NOTHING: the audio buffer is discarded when the request ends.
 */
export async function POST(req: Request) {
  if (serverConfig.pronunciationProvider !== 'azure' || !serverConfig.azureSpeechKey) return NextResponse.json({ error: 'not configured' }, { status: 501 });
  if (!rateLimit(`speech:${clientKey(req)}`, 60)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const form = await req.formData();
  const audio = form.get('audio');
  const expected = String(form.get('expected') ?? '').slice(0, 200);
  const locale = String(form.get('locale') ?? 'en-GB');
  if (!(audio instanceof Blob) || audio.size > 600_000 || !expected) return NextResponse.json({ error: 'bad input' }, { status: 400 });
  const assessment = Buffer.from(JSON.stringify({ ReferenceText: expected, GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive' })).toString('base64');
  const res = await fetch(`https://${serverConfig.azureSpeechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(locale)}&format=detailed`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': serverConfig.azureSpeechKey, 'Content-Type': audio.type || 'audio/wav', 'Pronunciation-Assessment': assessment },
    body: audio,
  });
  if (!res.ok) return NextResponse.json({ error: 'provider error' }, { status: 502 });
  const data = (await res.json()) as { NBest?: { PronScore?: number; Display?: string; Words?: { Word: string; AccuracyScore: number }[] }[] };
  const best = data.NBest?.[0];
  return NextResponse.json({ score: Math.round(best?.PronScore ?? 0), heard: best?.Display ?? '', weakWords: (best?.Words ?? []).filter((w) => w.AccuracyScore < 60).map((w) => w.Word) });
}
