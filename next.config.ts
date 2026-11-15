import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  // Users JSON seed is read at runtime from /data when running on a writable filesystem
  outputFileTracingIncludes: { "/api/**": ["./data/users.seed.json"] },
};

export default nextConfig;
