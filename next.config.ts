import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jipsamoye-bucket.s3.ap-northeast-2.amazonaws.com',
      },
    ],
  },
  async rewrites() {
    const apiUrl = process.env.API_URL || 'https://api.jipsamoye.com';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
