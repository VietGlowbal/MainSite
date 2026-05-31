import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  // Tree-shake large UI libraries so routes only bundle the bits they use
  // instead of importing the whole package barrel.
  experimental: {
    optimizePackageImports: ['framer-motion', 'gsap', '@gsap/react'],
  },
  // Force the canonical custom domain. Anyone landing on the raw
  // *.vercel.app hostname gets a permanent redirect to glowbal-education.com,
  // so the URL bar always reads the brand domain.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'main-site-seven-opal.vercel.app' }],
        destination: 'https://glowbal-education.com/:path*',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      // Wikipedia / Wikimedia thumbnails — used for university card cover images
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'commons.wikimedia.org' },
      { protocol: 'https', hostname: 'en.wikipedia.org' },
      // Supabase Storage — uploaded avatars and student documents
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      // OAuth provider avatars (Google profile pictures)
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // Unsplash CDNs — used as a fallback when two universities resolve
      // to the same Wikipedia city image (see seed-university-images.mjs).
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'source.unsplash.com' },
      // Google favicons — used as a no-key logo fallback for universities
      // whose Wikidata logo claims are missing.
      { protocol: 'https', hostname: 'www.google.com' },
    ],
  },
};

export default nextConfig;
