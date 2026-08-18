/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Next.js 14.x key. Renamed to `serverExternalPackages` (root) in v15.
    // Keeps @react-pdf/renderer external on the server bundle so its
    // top-level await ESM entry is not parsed by webpack/Terser.
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
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
      // Storage de Supabase. Faltaba, y era el eslabón que impedía usar
      // next/image con las fotos del CMS (fallaba con "hostname not configured").
      // La web pública ya no lo necesita —sirve la escalera de variantes de
      // web-publica/v2 con <picture>, ver lib/web-publica/imagenes.ts— pero sin
      // esto cualquier next/image sobre una foto del bucket seguiría rompiendo.
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
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
