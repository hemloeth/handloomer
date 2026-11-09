/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 828, 1080],
    imageSizes: [16, 32, 360, 640],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-f54fad280ec34c659747cdd738e55b2d.r2.dev',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig