import type { NextConfig } from "next";

const isGitHubActions = process.env.GITHUB_ACTIONS || false;
const repoName = process.env.GITHUB_REPOSITORY?.split("/")?.[1] || "LuckyDraw";
const basePath = (isGitHubActions || process.env.NODE_ENV === "production") ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
