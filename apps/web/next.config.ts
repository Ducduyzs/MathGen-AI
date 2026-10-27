import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev với backend thật: chuyển /api/* sang FastAPI (cùng domain nên cookie refresh vẫn hoạt động).
  // Production không cần: Caddy định tuyến /api trực tiếp tới container api.
  async rewrites() {
    const target = process.env.API_PROXY_URL;
    return target ? { beforeFiles: [{ source: "/api/:path*", destination: `${target}/api/:path*` }], afterFiles: [], fallback: [] } : [];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
