/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  // Vercel deployment optimizations
  trailingSlash: false,
  poweredByHeader: false,
  compress: true,
  // Enable static optimization where possible
  output: 'standalone',
}

export default nextConfig
