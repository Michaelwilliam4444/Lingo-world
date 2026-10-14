/**
 * Grant an admin role (cloud mode).
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run admin:grant -- person@example.com editor
 */
import { createClient } from '@supabase/supabase-js';

const [email, role = 'editor'] = process.argv.slice(2);
const ROLES = ['owner', 'editor', 'reviewer', 'translator', 'support', 'analyst'];
if (!email || !ROLES.includes(role)) {
  console.error(`Usage: npm run admin:grant -- <email> <${ROLES.join('|')}>`);
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const admin = createClient(url, key, { auth: { persistSession: false } });
let page = 1;
for (;;) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (user) {
    const { error: e } = await admin.from('admin_users').upsert({ user_id: user.id, role });
    if (e) throw e;
    await admin.from('audit_logs').insert({ actor: null, action: 'grant-admin', entity_type: 'admin_users', entity_id: user.id, diff: { role } });
    console.log(`Granted ${role} to ${email}`);
    process.exit(0);
  }
  if (data.users.length < 1000) break;
  page++;
}
console.error(`No user with email ${email}. Ask them to sign up first.`);
process.exit(1);
