/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @hashgraph/sdk (gRPC + native-ish deps) must run in Node, not be bundled.
  experimental: {
    serverComponentsExternalPackages: ["@hashgraph/sdk"],
  },
  webpack: (config) => {
    // face-api.js has an optional Node (node-canvas) code path guarded behind an
    // environment check; we only ever use its browser path, but webpack still
    // tries to resolve `fs` for the unused branch. Standard fix: stub it out.
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};
export default nextConfig;
