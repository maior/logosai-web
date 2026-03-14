/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        // NextAuth 경로는 제외하고 나머지 API만 logos_api로 프록시
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090'}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
