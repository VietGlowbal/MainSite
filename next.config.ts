import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: __dirname,
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
      // Fallback Unsplash CDN (occasionally referenced)
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
