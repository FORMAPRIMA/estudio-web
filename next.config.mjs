/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
    outputFileTracingIncludes: {
      '**': ['./public/FORMA_PRIMA_BLANCO.png'],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Only allow our own domain to iframe our pages (prevents clickjacking)
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Enable browser XSS filter (legacy but harmless)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Enforce HTTPS for 1 year (only active in production)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Don't send Referer header to external sites
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable browser features we don't use
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ]
  },
}

export default nextConfig
