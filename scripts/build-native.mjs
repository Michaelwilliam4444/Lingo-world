/**
 * Static export for Capacitor (iOS/Android) → ./out
 * API routes are server-only (webhooks, AI, publish) and stay on the web deployment, so they are
 * moved aside during the export and always restored afterwards.
 */
import { renameSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const api = 'src/app/api';
const parked = 'src/.api-parked';
if (existsSync(parked)) renameSync(parked, api); // recover from an interrupted run
renameSync(api, parked);
try {
  execSync('npx next build', { stdio: 'inherit', env: { ...process.env, CAPACITOR_BUILD: '1', NEXT_TELEMETRY_DISABLED: '1' } });
} finally {
  renameSync(parked, api);
}
console.log('Static export ready in ./out — run `npx cap sync`.');
