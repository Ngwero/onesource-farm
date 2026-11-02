import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ['pdfkit', 'sharp'],
  outputFileTracingIncludes: {
    '/api/files/[...path]': ['./uploads/**/*'],
    '/api/signatures': ['./uploads/**/*'],
    '/api/memos/[id]/attachments': ['./uploads/**/*'],
    '/api/memos/[id]/export': ['./node_modules/pdfkit/js/data/**/*', './public/onesource-logo-white.png'],
  },
};

export default nextConfig;
