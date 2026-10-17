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
    ],
  },
  {
    title: 'Contracts',
    items: [
      { title: 'Protocol Rewards', slug: ['contracts', 'protocol-rewards'] },
      { title: 'Bonding Curve', slug: ['contracts', 'bonding-curve'] },
      { title: 'Bag Token', slug: ['contracts', 'bag-token'] },
      { title: 'Bag Factory', slug: ['contracts', 'bag-factory'] },
      { title: 'Bag Governance', slug: ['contracts', 'bag-governance'] },
    ],
  },
  {
    title: 'Testing',
    items: [
      { title: 'Mainnet Fork Tests', slug: ['testing', 'mainnet-fork'] },
    ],
  },
  {
    title: 'Security',
    items: [
      { title: 'Access Control', slug: ['security', 'access-control'] },
    ],
  },
]
