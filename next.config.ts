import type { NextConfig } from "next";

// When deploying to GitHub Pages as a project site, the app is served from
// https://<user>.github.io/<repo>/, so we need a basePath. Locally (dev) and
// for user/custom-domain deployments we keep it at the root.
const basePath = process.env.GITHUB_PAGES === "true" ? "/arc-conf" : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
