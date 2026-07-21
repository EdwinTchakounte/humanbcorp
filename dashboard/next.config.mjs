/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // image Docker légère (déploiement découplé)
};

export default nextConfig;
