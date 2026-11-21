import type { NextConfig } from "next";

// Static export to frontend/out, served by the FastAPI backend.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
