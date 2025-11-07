const isDev = process.env.NODE_ENV !== "production";

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: "/offline.html",
  },
  disable: isDev,
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = withPWA(nextConfig);
