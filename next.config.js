/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    DEPLOYED_URL: process.env.DEPLOYED_URL,
  },
};

module.exports = nextConfig;
