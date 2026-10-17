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
      { title: 'Exposing the MCP Bridge', slug: ['architecture', 'mcp-bridge'] },
    ],
  },
  {
    title: 'Setup & Debugging',
    items: [
      { title: 'Getting Ruflo Running', slug: ['setup', 'getting-running'] },
      { title: 'Issues Encountered', slug: ['setup', 'debugging-issues'] },
    ],
  },
  {
    title: 'Client Workflow',
    items: [
      { title: 'Skills & Workflow Tooling', slug: ['workflow', 'skills-and-tooling'] },
      { title: 'The Run-Control Layer', slug: ['workflow', 'run-control'] },
    ],
  },
  {
    title: 'Security',
    items: [
      { title: 'Security Posture', slug: ['security', 'posture'] },
      { title: 'Hardening Checklist', slug: ['security', 'hardening-checklist'] },
    ],
  },
]
