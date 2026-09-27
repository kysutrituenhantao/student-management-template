/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";

const nextConfig = {
  // Production is a static export served by the Cloudflare Worker's static assets.
  ...(isDev ? {} : { output: "export" }),
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@lhhp/shared"],
  // `next dev` alone (outside docker compose) proxies the API to wrangler dev.
  ...(isDev
    ? {
        skipTrailingSlashRedirect: true,
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${process.env.API_ORIGIN ?? "http://localhost:8787"}/api/:path*` }];
        },
      }
    : {}),
};

export default nextConfig;
