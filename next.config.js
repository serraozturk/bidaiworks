/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Allow Supabase Storage public-bucket URLs to be optimized by next/image.
    // Replace <your-project> after creating the Supabase project, or set
    // NEXT_PUBLIC_SUPABASE_URL and the host will resolve at build time.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
