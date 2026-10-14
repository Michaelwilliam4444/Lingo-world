'use client';
import type { ContentIndex } from '@/content';
import { getContentIndex, setActiveContent } from '@/content';
import { validateBundle } from '@/content/schema';
import { publicConfig, isSupabaseConfigured } from '@/lib/config';
import { NeverSameJourneyEngine } from '@/journey-engine/NeverSameJourneyEngine';
import { LearningOrchestrator } from '@/learning-engine/LearningOrchestrator';
import { CurriculumEngine } from '@/learning-engine/CurriculumEngine';
import { StoryEngine } from '@/story-engine/StoryEngine';
import { GameEngine } from '@/game-engine/GameEngine';
import { ParentInsightsService } from '@/parent/insights';
import { BrowserTTS, SilentTTS, type TextToSpeechService } from '@/speech/tts';
import { BrowserSpeechRecognition, MockSpeechRecognition, type SpeechRecognitionService } from '@/speech/recognition';
import { LocalPronunciationScorer, type PronunciationScoringService } from '@/speech/pronunciation';
import { AudioService } from '@/speech/audio';
import { AnalyticsService } from '@/analytics/AnalyticsService';
import type { DataRepository } from './data/DataRepository';
import { LocalRepository } from './data/LocalRepository';
import { SupabaseRepository } from './data/SupabaseRepository';
import { OfflineSyncService } from './offline/OfflineSyncService';
import { MockBilling, PaymobBilling, RevenueCatBilling, StripeBilling, type BillingProvider } from '@/billing/BillingProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { PlanId } from '@/types/core';
import type { ContentBundle } from '@/types/content';

export interface Services {
  repo: DataRepository;
  sync: OfflineSyncService | null;
  content: ContentIndex;
  journeys: NeverSameJourneyEngine;
  orchestrator: LearningOrchestrator;
  curriculum: CurriculumEngine;
  story: StoryEngine;
  games: GameEngine;
  insights: ParentInsightsService;
  tts: TextToSpeechService;
  recognition: SpeechRecognitionService;
  scorer: PronunciationScoringService;
  audio: AudioService;
  analytics: AnalyticsService;
  billing: BillingProvider;
}

let services: Services | null = null;

function buildEngines(content: ContentIndex) {
  return {
    content,
    journeys: new NeverSameJourneyEngine(content),
    orchestrator: new LearningOrchestrator(content),
    curriculum: new CurriculumEngine(content),
    story: new StoryEngine(content),
    games: new GameEngine(content),
    insights: new ParentInsightsService(content),
  };
}

export function getServices(): Services {
  if (services) return services;
  const supabase = isSupabaseConfigured();
  const repo: DataRepository = supabase ? new SupabaseRepository(getSupabaseBrowserClient()) : new LocalRepository();
  const tts: TextToSpeechService = typeof window !== 'undefined' && new BrowserTTS().available() ? new BrowserTTS() : new SilentTTS();
  const browserRec = new BrowserSpeechRecognition();
  const recognition: SpeechRecognitionService = publicConfig.speechProvider === 'browser' && browserRec.available() ? browserRec : new MockSpeechRecognition();
  const isNative = typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform(): boolean } }).Capacitor?.isNativePlatform();
  let billing: BillingProvider;
  if (isNative) billing = new RevenueCatBilling();
  else if (supabase && publicConfig.webBillingProvider !== 'mock') {
    const token = async () => (await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token ?? null;
    billing = publicConfig.webBillingProvider === 'paymob' ? new PaymobBilling(token) : new StripeBilling(token);
  }
  else billing = new MockBilling(async (plan: PlanId) => {
    if (!(repo instanceof LocalRepository)) throw new Error('Demo billing only works in device mode. Set NEXT_PUBLIC_BILLING_PROVIDER=paymob (or stripe) for real payments.');
    const local = repo;
    await local.setMockSubscription({ parentId: '', plan, status: plan === 'free' ? 'none' : 'active', provider: 'mock', currentPeriodEnd: plan === 'free' ? null : new Date(Date.now() + 365 * 86_400_000).toISOString(), seats: plan === 'family' ? 6 : plan === 'free' ? 1 : 3 });
  });

  services = {
    repo,
    sync: supabase ? new OfflineSyncService(repo) : null,
    ...buildEngines(getContentIndex()),
    tts, recognition, scorer: new LocalPronunciationScorer(), audio: new AudioService(tts),
    analytics: new AnalyticsService(repo),
    billing,
  };
  return services;
}

/** Load the latest published content bundle (CMS) and rebuild engines if it validates. */
export async function refreshContent(): Promise<string> {
  const s = getServices();
  const bundle: ContentBundle | null = await s.repo.loadPublishedContent().catch(() => null);
  if (bundle && bundle.version !== s.content.bundle.version) {
    const errors = validateBundle(bundle).filter((i) => i.severity === 'error');
    if (!errors.length) Object.assign(s, buildEngines(setActiveContent(bundle)));
  }
  return s.content.bundle.version;
}

/** Test hook. */
export function resetServices() {
  services = null;
}
