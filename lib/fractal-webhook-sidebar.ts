// Client-safe: no Node.js imports. Contains only the static sidebar structure.
// The shape and the group guard live in @lib/doc-sidebar-types, shared with the
// DocSidebar client component and lib/project-docs.ts.

import type { SidebarEntry } from '@lib/doc-sidebar-types'

export const sidebarNav: SidebarEntry[] = [
  { title: 'Introduction', slug: ['introduction'] },
  {
    title: 'Architecture',
    items: [
      { title: 'System Overview', slug: ['architecture', 'overview'] },
      { title: 'Data Flow', slug: ['architecture', 'data-flow'] },
    ],
  },
  {
    title: 'Webhook Server',
    items: [
      { title: 'Endpoints', slug: ['server', 'endpoints'] },
      { title: 'Signal Deduplication', slug: ['server', 'deduplication'] },
      { title: 'Audit Logging', slug: ['server', 'audit-logging'] },
    ],
  },
  {
    title: 'Polling Client',
    items: [
      { title: 'Polling Loop', slug: ['client', 'polling-loop'] },
      { title: 'Health Monitoring', slug: ['client', 'health-monitoring'] },
      { title: 'Failure Handling', slug: ['client', 'failure-handling'] },
    ],
  },
  {
    title: 'Telegram Notifier',
    items: [
      { title: 'Trade Notifications', slug: ['telegram', 'trade-events'] },
      { title: 'System Notifications', slug: ['telegram', 'system-events'] },
    ],
  },
  {
    title: 'Security',
    items: [
      { title: 'Security Model', slug: ['security', 'model'] },
    ],
  },
  {
    title: 'Deployment',
    items: [
      { title: 'Deployment Guide', slug: ['deployment', 'guide'] },
    ],
  },
]
