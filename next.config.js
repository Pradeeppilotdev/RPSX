/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@rps/shared"],
  webpack: (config, { isServer }) => {
    // Suppress MetaMask SDK React Native dependency warning
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
      };
    }
    return config;
  },
  // Suppress console warnings in production
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
}

module.exports = nextConfig

