// Client-safe: no Node.js imports. Shared by the four per-project sidebar data
// modules and by the DocSidebar client component, which both need the shape and
// the group guard but must not pull in anything that touches fs.
//
// This header used to be copy-pasted, byte-identical, into all four
// lib/*-sidebar.ts files. Those files now hold only their own `sidebarNav` data.

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
