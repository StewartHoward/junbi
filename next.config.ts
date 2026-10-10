import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Student import posts a whole spreadsheet to a server action.
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};

export default nextConfig;
