import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://43.203.165.97/api/:path*',
      },
    ];
  },
};

export default nextConfig;
