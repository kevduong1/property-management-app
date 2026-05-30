/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PGlite ships a wasm file that must be treated as an external on the server.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  eslint: {
    // MVP: don't block production builds on lint. Run `npm run lint` separately.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
