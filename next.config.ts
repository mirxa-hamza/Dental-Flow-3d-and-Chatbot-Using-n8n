import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // "/" opens the English page; /ur and /ar are the Urdu and Arabic pages.
  async redirects() {
    return [{ source: '/', destination: '/en', permanent: false }];
  },
  // The 3D libraries ship modern ESM; let Next compile them with the app.
  transpilePackages: ['three'],
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      ],
    }];
  },
};

export default nextConfig;
