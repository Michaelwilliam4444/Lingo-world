// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Executes the real migrations + seed in an embedded Postgres and verifies Row Level Security
 * from the perspective of two different parents, an anonymous visitor and an admin.
 */
const root = path.resolve(__dirname, '../..');
const db = new PGlite({ extensions: { pgcrypto } });
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const ADMIN = '33333333-3333-3333-3333-333333333333';

async function as<T>(user: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); set role ${user ? 'authenticated' : 'anon'};`);
  try { return await fn(); } finally { await db.exec('reset role;'); }
}

beforeAll(async () => {
  await db.exec(readFileSync(path.join(__dirname, 'supabase-shim.sql'), 'utf8'));
  for (const f of readdirSync(path.join(root, 'supabase/migrations')).sort()) {
    await db.exec(readFileSync(path.join(root, 'supabase/migrations', f), 'utf8'));
  }
  await db.exec(readFileSync(path.join(root, 'supabase/seed.sql'), 'utf8'));
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;
                 grant select on all tables in schema public to anon; grant insert on analytics_events to anon;
                 grant usage on all sequences in schema public to anon, authenticated;`);
  for (const [id, email] of [[A, 'a@example.com'], [B, 'b@example.com'], [ADMIN, 'admin@example.com']]) {
    await db.exec(`insert into auth.users (id, email) values ('${id}', '${email}')`);
  }
  await db.exec(`insert into admin_users (user_id, role) values ('${ADMIN}', 'editor')`);
}, 120_000);

const insertChild = (parent: string, nickname: string) =>
  db.query(`insert into children (parent_id, nickname, age, age_band, native_language, target_language) values ($1, $2, 7, 'adventurer', 'ar', 'en') returning id`, [parent, nickname]);

describe('migrations, seed and RLS', () => {
  it('auth signup trigger creates parent profile + free subscription', async () => {
    const r = await db.query<{ plan: string }>(`select plan from subscriptions where parent_id = $1`, [A]);
    expect(r.rows[0]?.plan).toBe('free');
  });

  it('seed loaded all content and a published bundle', async () => {
    const v = await db.query<{ n: number }>(`select count(*)::int as n from vocabulary`);
    const l = await db.query<{ n: number }>(`select count(*)::int as n from lexemes`);
    const b = await db.query<{ n: number }>(`select count(*)::int as n from content_bundles where published`);
    expect(v.rows[0]!.n).toBeGreaterThan(300);
    expect(l.rows[0]!.n).toBe(v.rows[0]!.n * 5);
    expect(b.rows[0]!.n).toBe(1);
  });

  it('parents only see their own children', async () => {
    const childA = await as(A, () => insertChild(A, 'Maria'));
    await as(B, () => insertChild(B, 'Omar'));
    const seenByB = await as(B, () => db.query(`select nickname from children`));
    expect(seenByB.rows).toEqual([{ nickname: 'Omar' }]);
    const childId = (childA.rows[0] as { id: string }).id;
    const peek = await as(B, () => db.query(`select * from learning_mastery where child_id = $1`, [childId]));
    expect(peek.rows).toHaveLength(0);
  });

  it('a parent cannot write into another family’s child records', async () => {
    const childA = (await db.query<{ id: string }>(`select id from children where parent_id = $1`, [A])).rows[0]!.id;
    await expect(as(B, () => db.query(`insert into learning_mastery (child_id, language, item_id, item_type, mastery) values ($1, 'en', 'food.apple', 'concept', '{}')`, [childA])))
      .rejects.toThrow(/row-level security/);
    await as(A, () => db.query(`insert into learning_mastery (child_id, language, item_id, item_type, mastery) values ($1, 'en', 'food.apple', 'concept', '{}')`, [childA]));
    const mine = await as(A, () => db.query(`select item_id from learning_mastery`));
    expect(mine.rows).toHaveLength(1);
  });

  it('parents cannot grant themselves premium', async () => {
    const r = await as(A, () => db.query(`update subscriptions set plan = 'family', status = 'active' where parent_id = $1`, [A]));
    expect(r.affectedRows ?? 0).toBe(0);
    const plan = (await db.query<{ plan: string }>(`select plan from subscriptions where parent_id = $1`, [A])).rows[0]!.plan;
    expect(plan).toBe('free');
  });

  it('enforces the free-plan child limit in the database', async () => {
    await as(A, () => insertChild(A, 'Second'));
    await expect(as(A, () => insertChild(A, 'Third'))).rejects.toThrow(/child_limit_reached/);
  });

  it('anyone reads published content; only admins write it', async () => {
    const anonRead = await as(null, () => db.query<{ n: number }>(`select count(*)::int as n from worlds`));
    expect(anonRead.rows[0]!.n).toBe(20);
    await expect(as(A, () => db.query(`insert into vocabulary (id, topic, word_class, image, difficulty, age_bands, cefr, stage) values ('food.kiwi','food','noun','🥝',1,'{little}','preA1',1)`)))
      .rejects.toThrow(/row-level security/);
    await as(ADMIN, () => db.query(`insert into vocabulary (id, topic, word_class, image, difficulty, age_bands, cefr, stage) values ('food.kiwi','food','noun','🥝',1,'{little}','preA1',1)`));
    const draftHidden = await as(A, () => db.query(`select id from vocabulary where id = 'food.kiwi'`));
    expect(draftHidden.rows).toHaveLength(0); // drafts are invisible to families
  });

  it('analytics: pseudonymous inserts allowed, reads restricted', async () => {
    const analyticsId = (await db.query<{ analytics_id: string }>(`select analytics_id from children where parent_id = $1 limit 1`, [A])).rows[0]!.analytics_id;
    await as(A, () => db.query(`insert into analytics_events (subject_id, subject_kind, name) values ($1, 'child', 'journey_start')`, [analyticsId]));
    await expect(as(B, () => db.query(`insert into analytics_events (subject_id, subject_kind, name) values ($1, 'child', 'journey_start')`, [analyticsId])))
      .rejects.toThrow(/row-level security/);
    const read = await as(A, () => db.query(`select * from analytics_events`));
    expect(read.rows).toHaveLength(0);
  });

  it('family data export returns only the caller’s family', async () => {
    const r = await as(B, () => db.query<{ export_family_data: { children: unknown[] } }>(`select export_family_data()`));
    expect(r.rows[0]!.export_family_data.children).toHaveLength(1);
  });

  it('tracks are public reference data; a parent can set their own child’s track only', async () => {
    const tracks = await as(null, () => db.query<{ id: string; arc_ids: string[] }>(`select id, arc_ids from tracks order by sort_order`));
    expect(tracks.rows.map((r) => r.id)).toEqual(['little', 'adventurer', 'hero']);
    await expect(as(A, () => db.query(`update tracks set emoji = 'x' where id = 'hero'`))).resolves.toMatchObject({ affectedRows: 0 });
    const childA = (await db.query<{ id: string }>(`select id from children where parent_id = $1 limit 1`, [A])).rows[0]!.id;
    await as(A, () => db.query(`update children set track_id = 'hero' where id = $1`, [childA]));
    expect((await db.query<{ track_id: string }>(`select track_id from children where id = $1`, [childA])).rows[0]!.track_id).toBe('hero');
    const r = await as(B, () => db.query(`update children set track_id = 'little' where id = $1`, [childA]));
    expect(r.affectedRows).toBe(0);
  });

  it('payments: parents read only their own; nobody but the service role writes', async () => {
    await db.query(`insert into payments (parent_id, provider, reference, kind, plan, method, amount_cents, currency, period_months) values ($1, 'paymob', 'lw_test_a', 'pass', 'premium_monthly', 'wallet', 24900, 'EGP', 1)`, [A]);
    expect((await as(A, () => db.query(`select reference from payments`))).rows).toHaveLength(1);
    expect((await as(B, () => db.query(`select reference from payments`))).rows).toHaveLength(0);
    await expect(as(A, () => db.query(`insert into payments (parent_id, provider, reference, kind, plan, method, amount_cents, currency, period_months) values ($1, 'paymob', 'lw_fake', 'pass', 'family', 'card', 1, 'EGP', 12)`, [A])))
      .rejects.toThrow(/row-level security/);
    const upd = await as(A, () => db.query(`update payments set status = 'paid' where reference = 'lw_test_a'`));
    expect(upd.affectedRows).toBe(0);
    await expect(db.query(`insert into payments (parent_id, provider, reference, kind, plan, method, amount_cents, currency, period_months) values ($1, 'paymob', 'lw_test_a', 'pass', 'premium_monthly', 'wallet', 24900, 'EGP', 1)`, [A]))
      .rejects.toThrow(/duplicate key/);
  });

  it('only the owner can see payments, and nobody can make themselves an admin', async () => {
    // The editor admin (content team) cannot read revenue.
    expect((await as(ADMIN, () => db.query(`select reference from payments`))).rows).toHaveLength(0);
    // A normal parent cannot promote themselves…
    await expect(as(A, () => db.query(`insert into admin_users (user_id, role) values ($1, 'owner')`, [A]))).rejects.toThrow(/row-level security/);
    // …and neither can the editor promote themselves to owner.
    const up = await as(ADMIN, () => db.query(`update admin_users set role = 'owner' where user_id = $1`, [ADMIN]));
    expect(up.affectedRows).toBe(0);
    await expect(as(ADMIN, () => db.query(`insert into admin_users (user_id, role) values ($1, 'owner')`, [B]))).rejects.toThrow(/row-level security/);
    // The owner sees every family's payments.
    const OWNER = '44444444-4444-4444-4444-444444444444';
    await db.exec(`insert into auth.users (id, email) values ('${OWNER}', 'owner@example.com'); insert into admin_users (user_id, role) values ('${OWNER}', 'owner');`);
    expect((await as(OWNER, () => db.query(`select reference from payments`))).rows.length).toBeGreaterThanOrEqual(1);
  });
});
