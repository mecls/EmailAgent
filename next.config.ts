import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The agent + indexing routes do meaningful server work; keep server action
  // bodies generous (chat payloads, future attachments). Long-running work runs
  // in Inngest functions, not request handlers.
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
}

export default nextConfig
