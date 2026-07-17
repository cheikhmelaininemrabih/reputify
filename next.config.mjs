/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @hashgraph/sdk (gRPC + native-ish deps) must run in Node, not be bundled.
  experimental: {
    serverComponentsExternalPackages: ["@hashgraph/sdk"],
  },
};
export default nextConfig;
