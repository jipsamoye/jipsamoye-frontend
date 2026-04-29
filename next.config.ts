import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || 'https://api.jipsamoye.com';

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 300,  // 5분 — router.back() 시 동적 페이지 캐시 유지
      static: 600,   // 10분 — 정적 페이지
    },
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jipsamoye-bucket.s3.ap-northeast-2.amazonaws.com',
      },
    ],
  },
};

export default nextConfig;
