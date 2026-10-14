import { NextResponse } from 'next/server';
import { serverConfig } from '@/lib/server-config';
import { userFromRequest } from '@/lib/supabase/admin';
import type { WeeklyReport } from '@/parent/insights';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Emails a weekly report to the signed-in parent (Resend). */
export async function POST(req: Request) {
  if (serverConfig.emailProvider !== 'resend' || !serverConfig.resendApiKey || !serverConfig.reportFromEmail) return NextResponse.json({ error: 'Email not configured' }, { status: 501 });
  const user = await userFromRequest(req);
  if (!user?.email) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const { report } = (await req.json()) as { report: WeeklyReport };
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;color:#241c4f">
    <h1 style="font-size:22px">${esc(report.headline)}</h1>
    ${report.summary.map((l) => `<p style="font-size:16px;line-height:1.5">${esc(l)}</p>`).join('')}
    <p><b>${report.progress.minutes}</b> minutes · <b>${report.progress.journeys}</b> adventures · <b>${report.progress.wordsPracticed}</b> words practised</p>
    <h2 style="font-size:16px">Recommended</h2><ul>${report.recommendedActions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
    <p style="color:#8d87ad;font-size:12px">You receive this because weekly emails are on in the LingoWorld Parent Zone.</p></div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${serverConfig.resendApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: serverConfig.reportFromEmail, to: user.email, subject: report.headline, html }),
  });
  return res.ok ? NextResponse.json({ sent: true }) : NextResponse.json({ error: 'send failed' }, { status: 502 });
}
