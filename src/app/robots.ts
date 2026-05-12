import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // All crawlers (including general web)
      { userAgent: '*', allow: '/' },
      // OpenAI / ChatGPT Search
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      // Anthropic / Claude
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'Claude-User', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
      // Google AI (Gemini / AI Overviews)
      { userAgent: 'Google-Extended', allow: '/' },
      // Perplexity
      { userAgent: 'PerplexityBot', allow: '/' },
      // Meta AI
      { userAgent: 'Meta-ExternalAgent', allow: '/' },
      { userAgent: 'Meta-ExternalFetcher', allow: '/' },
      // Apple
      { userAgent: 'Applebot', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      // Common Crawl (training data for many AI models)
      { userAgent: 'CCBot', allow: '/' },
      // Cohere
      { userAgent: 'cohere-ai', allow: '/' },
      // Diffbot
      { userAgent: 'Diffbot', allow: '/' },
      // Bytespider (ByteDance / TikTok)
      { userAgent: 'Bytespider', allow: '/' },
    ],
    sitemap: 'https://thinktanktom.com/sitemap.xml',
  }
}
