import type { AgeBand, InterfaceLocale, LearningLanguage } from '@/types/core';
import type { ContentBundle } from '@/types/content';
import type { ChildProfile, ChildState, ParentProfile, Subscription } from '@/types/learner';
import type { DailyJourney } from '@/types/engine';
import type { WeeklyReport } from '@/parent/insights';

export interface AuthUser {
  id: string;
  email: string;
}

export interface NewChildInput {
  nickname: string;
  age: number;
  nativeLanguage: string;
  interfaceLocale: InterfaceLocale;
  targetLanguage: LearningLanguage;
  estimatedLevel: ChildProfile['estimatedLevel'];
  learningGoal: ChildProfile['learningGoal'];
  dailyTargetMinutes: 10 | 15 | 20;
  interests: ChildProfile['interests'];
  accessibilityNeeds: string[];
  /** Optional learning track if the parent picks one other than the age default. */
  trackId?: AgeBand;
}

export interface AnalyticsEventInput {
  subjectId: string;
  subjectKind: 'child' | 'parent' | 'anonymous';
  name: string;
  props: Record<string, string | number | boolean | null>;
  at: string;
  platform: string;
}

export interface AppNotification {
  id: string;
  childId: string | null;
  kind: 'adventure-ready' | 'weekly-report' | 'milestone';
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export class RepositoryError extends Error {
  constructor(message: string, readonly code: 'auth' | 'not-found' | 'limit' | 'network' | 'conflict' | 'unsupported' | 'unknown' = 'unknown') {
    super(message);
  }
}

/**
 * Persistence boundary. The app talks only to this interface; implementations:
 *   LocalRepository    — device-only demo/offline mode (IndexedDB), no server required
 *   SupabaseRepository — production: Supabase Auth + Postgres with RLS
 */
export interface DataRepository {
  readonly mode: 'local' | 'supabase';

  // auth (parents only — children never have credentials)
  getCurrentUser(): Promise<AuthUser | null>;
  signUp(email: string, password: string, displayName: string, locale: InterfaceLocale): Promise<AuthUser>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signInWithOAuth(provider: 'google' | 'apple'): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;

  // family
  getParent(): Promise<ParentProfile | null>;
  updateParent(patch: Partial<Omit<ParentProfile, 'id' | 'email' | 'createdAt'>>): Promise<ParentProfile>;
  listChildren(): Promise<ChildProfile[]>;
  createChild(input: NewChildInput): Promise<ChildProfile>;
  updateChild(child: ChildProfile): Promise<ChildProfile>;
  deleteChild(childId: string): Promise<void>;

  // learner state
  loadChildState(child: ChildProfile): Promise<ChildState | null>;
  saveChildState(state: ChildState): Promise<void>;
  saveJourney(childId: string, journey: DailyJourney): Promise<void>;
  loadJourney(childId: string, language: LearningLanguage, date: string): Promise<DailyJourney | null>;

  // billing (read-only for clients in production)
  getSubscription(): Promise<Subscription>;

  // reports & notifications
  saveReport(report: WeeklyReport): Promise<void>;
  listReports(childId: string): Promise<WeeklyReport[]>;
  listNotifications(): Promise<AppNotification[]>;
  addNotification(n: Omit<AppNotification, 'id' | 'createdAt' | 'readAt'>): Promise<void>;
  markNotificationRead(id: string): Promise<void>;

  // analytics (pseudonymous)
  trackEvents(events: AnalyticsEventInput[]): Promise<void>;

  // data rights
  exportFamilyData(): Promise<unknown>;
  deleteAccount(): Promise<void>;

  // content
  loadPublishedContent(): Promise<ContentBundle | null>;
}
