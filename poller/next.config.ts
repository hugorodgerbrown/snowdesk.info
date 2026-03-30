import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required: tells Next.js it is mounted at /poller in the Vercel Services routing table
  basePath: "/poller",
};

export default nextConfig;
