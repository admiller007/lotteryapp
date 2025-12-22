import type {NextConfig} from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  // Force fresh build - updated 2025-12-22 to fix env var caching issue
  // Read cache-busting file to ensure fresh builds
  generateBuildId: async () => {
    try {
      const cacheBuster = readFileSync(join(process.cwd(), '.vercel-force-rebuild'), 'utf-8');
      const timestamp = cacheBuster.match(/FORCE_REBUILD_TIMESTAMP=(.+)/)?.[1] || Date.now();
      return `build-${timestamp}-${Date.now()}`;
    } catch {
      return `build-${Date.now()}`;
    }
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.gstatic.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'accoladehc.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.media.amplience.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.jbl.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.homecontrols.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'homecontrols.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cloudfront.net',
        port: '',
        pathname: '/**',
      },
      // Allow images from any remote host (supports both HTTPS and HTTP)
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '**',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
