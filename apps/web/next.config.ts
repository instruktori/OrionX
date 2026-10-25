import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // These local WebP assets are compressed at build-authoring time. Serve them
  // directly: the multi-service deployment does not expose /_next/image.
  images: { unoptimized: true },
  async rewrites() {
    const origin =
      process.env.ORIONX_API_ORIGIN ||
      (process.env.NODE_ENV === "development"
        ? "http://127.0.0.1:4000"
        : undefined);
    return origin
      ? [{ source: "/api/:path*", destination: origin + "/api/:path*" }]
      : [];
  },
};
export default config;
