import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfkit', 'sharp'],
  outputFileTracingIncludes: {
    '/api/files/[...path]': ['./uploads/**/*'],
    '/api/signatures': ['./uploads/**/*'],
    '/api/memos/[id]/attachments': ['./uploads/**/*'],
    '/api/memos/[id]/export': ['./node_modules/pdfkit/js/data/**/*', './public/rukapay-logo-white.png'],
  },
};

export default nextConfig;
