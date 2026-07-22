import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Pancake product thumbnails shown in the admin SKU picker.
    remotePatterns: [{ protocol: "https", hostname: "content.pancake.vn" }],
  },
};

export default nextConfig;
