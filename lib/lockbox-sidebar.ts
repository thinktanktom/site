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
    title: 'Concepts',
    items: [
      { title: 'Asset Locking', slug: ['concepts', 'asset-locking'] },
      { title: 'Shard Indistinguishability', slug: ['concepts', 'shard-indistinguishability'] },
      { title: 'Tier System', slug: ['concepts', 'tier-system'] },
      { title: 'LockScript Language', slug: ['concepts', 'lockscript-language'] },
    ],
  },
  {
    title: 'Core Service',
    items: [
      { title: 'Service API', slug: ['core', 'service'] },
    ],
  },
  {
    title: 'Cryptography',
    items: [
      { title: 'HKDF Key Derivation', slug: ['crypto', 'hkdf'] },
      { title: 'Shard Encryption', slug: ['crypto', 'encryption'] },
      { title: 'Zero-Knowledge Proofs', slug: ['crypto', 'zkp'] },
      { title: 'Decoy System', slug: ['crypto', 'decoys'] },
    ],
  },
  {
    title: 'LockScript',
    items: [
      { title: 'Engine & VM', slug: ['lockscript', 'overview'] },
      { title: 'Built-in Functions', slug: ['lockscript', 'builtins'] },
    ],
  },
  {
    title: 'B2B API',
    items: [
      { title: 'Overview', slug: ['b2b', 'overview'] },
    ],
  },
  {
    title: 'Security',
    items: [
      { title: 'Security Model', slug: ['security', 'model'] },
    ],
  },
  {
    title: 'Node',
    items: [
      { title: 'Setup & Configuration', slug: ['node', 'setup'] },
    ],
  },
]
