/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Microphone is needed for speaking activities; camera and geolocation are never used.
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Static export for Capacitor builds: CAPACITOR_BUILD=1 next build
  ...(process.env.CAPACITOR_BUILD === '1' ? { output: 'export', images: { unoptimized: true } } : {}),
  // Headers are applied by the web server; a static export (Capacitor) has no server.
  ...(process.env.CAPACITOR_BUILD === '1' ? {} : { async headers() { return [{ source: '/(.*)', headers: securityHeaders }]; } }),
};

export default nextConfig;
