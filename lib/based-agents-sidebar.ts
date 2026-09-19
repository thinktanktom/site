// Client-safe: no Node.js imports. Contains only the static sidebar structure.

export interface SidebarLeaf {
  title: string
  slug: string[]
}

export interface SidebarGroup {
  title: string
  items: SidebarLeaf[]
}

export type SidebarEntry = SidebarLeaf | SidebarGroup

export function isSidebarGroup(entry: SidebarEntry): entry is SidebarGroup {
  return 'items' in entry
}

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
