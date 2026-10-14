import type { InterfaceLocale, LearningLanguage } from '@/types/core';
import type { ContentBundle } from '@/types/content';
import type { ChildProfile, ChildState, ParentProfile, Subscription } from '@/types/learner';
import type { DailyJourney } from '@/types/engine';
import type { WeeklyReport } from '@/parent/insights';
import { getKV, type KV } from '@/lib/kv';
import { newId } from '@/lib/id';
import {
  RepositoryError, type AnalyticsEventInput, type AppNotification, type AuthUser, type DataRepository, type NewChildInput,
} from './DataRepository';
import { buildChild, freeSubscription, maxChildren } from './family';

interface LocalAccount { id: string; email: string; salt: string; hash: string }

/**
 * LocalRepository — "device mode". Everything lives in this browser's IndexedDB:
 * no server, no network, ideal for demos, development and fully-offline households.
 * Passwords are PBKDF2-hashed with WebCrypto; nothing leaves the device.
 */
export class LocalRepository implements DataRepository {
  readonly mode = 'local' as const;
  constructor(private readonly kv: KV = getKV()) {}

  private async session(): Promise<string> {
    const id = await this.kv.get<string>('session');
    if (!id) throw new RepositoryError('Not signed in', 'auth');
    return id;
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const id = await this.kv.get<string>('session');
    if (!id) return null;
    const parent = await this.kv.get<ParentProfile>(`parent:${id}`);
    return parent ? { id, email: parent.email } : null;
  }

  async signUp(email: string, password: string, displayName: string, locale: InterfaceLocale): Promise<AuthUser> {
    const normalized = email.trim().toLowerCase();
    const accounts = (await this.kv.get<LocalAccount[]>('accounts')) ?? [];
    if (accounts.some((a) => a.email === normalized)) throw new RepositoryError('An account with this email already exists on this device', 'conflict');
    if (password.length < 8) throw new RepositoryError('Password must be at least 8 characters', 'auth');
    const id = newId();
    const salt = newId();
    accounts.push({ id, email: normalized, salt, hash: await hashPassword(password, salt) });
    await this.kv.set('accounts', accounts);
    const parent: ParentProfile = {
      id, email: normalized, displayName, interfaceLocale: locale, createdAt: new Date().toISOString(),
      consents: { voiceProcessing: false, analytics: true, weeklyEmail: false, notifications: false },
    };
    await this.kv.set(`parent:${id}`, parent);
    await this.kv.set(`sub:${id}`, freeSubscription(id));
    await this.kv.set('session', id);
    return { id, email: normalized };
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const normalized = email.trim().toLowerCase();
    const accounts = (await this.kv.get<LocalAccount[]>('accounts')) ?? [];
    const acc = accounts.find((a) => a.email === normalized);
    if (!acc || (await hashPassword(password, acc.salt)) !== acc.hash) throw new RepositoryError('Email or password is incorrect', 'auth');
    await this.kv.set('session', acc.id);
    return { id: acc.id, email: acc.email };
  }

  async signInWithOAuth(): Promise<void> {
    throw new RepositoryError('Google and Apple sign-in require cloud mode (Supabase). Use email in device mode.', 'unsupported');
  }

  async signOut() { await this.kv.del('session'); }

  async requestPasswordReset(): Promise<void> {
    throw new RepositoryError('Password reset is available in cloud mode. In device mode, create a new account.', 'unsupported');
  }

  async getParent(): Promise<ParentProfile | null> {
    const id = await this.kv.get<string>('session');
    return id ? ((await this.kv.get<ParentProfile>(`parent:${id}`)) ?? null) : null;
  }

  async updateParent(patch: Partial<ParentProfile>): Promise<ParentProfile> {
    const id = await this.session();
    const current = await this.kv.get<ParentProfile>(`parent:${id}`);
    if (!current) throw new RepositoryError('Parent not found', 'not-found');
    const next = { ...current, ...patch, id: current.id, email: current.email, createdAt: current.createdAt };
    await this.kv.set(`parent:${id}`, next);
    return next;
  }

  async listChildren(): Promise<ChildProfile[]> {
    const id = await this.session();
    return (await this.kv.get<ChildProfile[]>(`children:${id}`)) ?? [];
  }

  async createChild(input: NewChildInput): Promise<ChildProfile> {
    const parentId = await this.session();
    const children = await this.listChildren();
    const sub = await this.getSubscription();
    if (children.length >= maxChildren(sub)) throw new RepositoryError('child_limit_reached', 'limit');
    const child = buildChild(newId(), parentId, input, new Date());
    await this.kv.set(`children:${parentId}`, [...children, child]);
    return child;
  }

  async updateChild(child: ChildProfile): Promise<ChildProfile> {
    const parentId = await this.session();
    const children = await this.listChildren();
    if (!children.some((c) => c.id === child.id) || child.parentId !== parentId) throw new RepositoryError('Child not found', 'not-found');
    await this.kv.set(`children:${parentId}`, children.map((c) => (c.id === child.id ? child : c)));
    return child;
  }

  async deleteChild(childId: string): Promise<void> {
    const parentId = await this.session();
    const children = await this.listChildren();
    await this.kv.set(`children:${parentId}`, children.filter((c) => c.id !== childId));
    for (const key of await this.kv.keys(`state:${childId}`)) await this.kv.del(key);
    for (const key of await this.kv.keys(`journey:${childId}`)) await this.kv.del(key);
    await this.kv.del(`reports:${childId}`);
  }

  private async assertOwns(childId: string) {
    const children = await this.listChildren();
    if (!children.some((c) => c.id === childId)) throw new RepositoryError('Not your child profile', 'auth');
  }

  async loadChildState(child: ChildProfile): Promise<ChildState | null> {
    await this.assertOwns(child.id);
    const state = await this.kv.get<ChildState>(`state:${child.id}:${child.targetLanguage}`);
    return state ? { ...state, child } : null;
  }

  async saveChildState(state: ChildState): Promise<void> {
    await this.assertOwns(state.child.id);
    await this.kv.set(`state:${state.child.id}:${state.child.targetLanguage}`, state);
  }

  async saveJourney(childId: string, journey: DailyJourney): Promise<void> {
    await this.kv.set(`journey:${childId}:${journey.language}:${journey.date}`, journey);
    // keep only the last 14 journeys
    const keys = (await this.kv.keys(`journey:${childId}:`)).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 14))) await this.kv.del(k);
  }

  async loadJourney(childId: string, language: LearningLanguage, date: string): Promise<DailyJourney | null> {
    return (await this.kv.get<DailyJourney>(`journey:${childId}:${language}:${date}`)) ?? null;
  }

  async getSubscription(): Promise<Subscription> {
    const id = await this.session();
    return (await this.kv.get<Subscription>(`sub:${id}`)) ?? freeSubscription(id);
  }

  /** Mock billing only — production subscriptions are written by verified webhooks. */
  async setMockSubscription(sub: Subscription): Promise<void> {
    const id = await this.session();
    await this.kv.set(`sub:${id}`, { ...sub, parentId: id, provider: 'mock' });
  }

  async saveReport(report: WeeklyReport): Promise<void> {
    const list = (await this.kv.get<WeeklyReport[]>(`reports:${report.childId}`)) ?? [];
    await this.kv.set(`reports:${report.childId}`, [report, ...list.filter((r) => r.id !== report.id)].slice(0, 26));
  }

  async listReports(childId: string): Promise<WeeklyReport[]> {
    return (await this.kv.get<WeeklyReport[]>(`reports:${childId}`)) ?? [];
  }

  async listNotifications(): Promise<AppNotification[]> {
    const id = await this.session();
    return (await this.kv.get<AppNotification[]>(`notifications:${id}`)) ?? [];
  }

  async addNotification(n: Omit<AppNotification, 'id' | 'createdAt' | 'readAt'>): Promise<void> {
    const id = await this.session();
    const list = await this.listNotifications();
    await this.kv.set(`notifications:${id}`, [{ ...n, id: newId(), createdAt: new Date().toISOString(), readAt: null }, ...list].slice(0, 50));
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const id = await this.session();
    const list = await this.listNotifications();
    await this.kv.set(`notifications:${id}`, list.map((n) => (n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n)));
  }

  async trackEvents(events: AnalyticsEventInput[]): Promise<void> {
    const list = (await this.kv.get<AnalyticsEventInput[]>('analytics')) ?? [];
    await this.kv.set('analytics', [...list, ...events].slice(-5000));
  }

  /** Local analytics are readable by the local admin dashboard. */
  async readAnalytics(): Promise<AnalyticsEventInput[]> {
    return (await this.kv.get<AnalyticsEventInput[]>('analytics')) ?? [];
  }

  async exportFamilyData(): Promise<unknown> {
    const parent = await this.getParent();
    const children = await this.listChildren();
    const states = [];
    for (const c of children) for (const key of await this.kv.keys(`state:${c.id}`)) states.push(await this.kv.get(key));
    return { exportedAt: new Date().toISOString(), mode: 'device', parent, subscription: await this.getSubscription(), children, learnerStates: states,
      reports: await Promise.all(children.map((c) => this.listReports(c.id))) };
  }

  async deleteAccount(): Promise<void> {
    const id = await this.session();
    for (const c of await this.listChildren()) await this.deleteChild(c.id);
    await this.kv.del(`children:${id}`);
    await this.kv.del(`parent:${id}`);
    await this.kv.del(`sub:${id}`);
    await this.kv.del(`notifications:${id}`);
    const accounts = (await this.kv.get<LocalAccount[]>('accounts')) ?? [];
    await this.kv.set('accounts', accounts.filter((a) => a.id !== id));
    await this.kv.del('session');
  }

  async loadPublishedContent(): Promise<ContentBundle | null> {
    return (await this.kv.get<ContentBundle>('content:published')) ?? null;
  }

  async savePublishedContent(bundle: ContentBundle): Promise<void> {
    await this.kv.set('content:published', bundle);
  }
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 120_000, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
