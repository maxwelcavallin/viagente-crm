import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /admin/* virou /configuracoes/* — mantém links/bookmarks antigos vivos.
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/configuracoes",
        permanent: false,
      },
      {
        source: "/admin/:path*",
        destination: "/configuracoes/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
