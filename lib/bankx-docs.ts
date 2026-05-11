import fs from 'fs'
import path from 'path'
import {
  sidebarNav,
  isSidebarGroup,
  type SidebarLeaf,
  type SidebarGroup,
  type SidebarEntry,
} from '@lib/bankx-sidebar'

export type { SidebarLeaf, SidebarGroup, SidebarEntry }
export { sidebarNav, isSidebarGroup }

const docsDir = path.join(process.cwd(), 'content/projects/BankX')

export function getAllDocSlugs(): string[][] {
  const results: string[][] = []
  for (const entry of sidebarNav) {
    if (isSidebarGroup(entry)) {
      for (const item of entry.items) results.push(item.slug)
    } else {
      results.push(entry.slug)
    }
  }
  return results
}

export interface DocPage {
  title: string
  content: string
}

export function getDocBySlug(slugParts: string[]): DocPage | null {
  const filePath = path.join(docsDir, ...slugParts) + '.md'
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf8')

  // Extract title from first # heading
  const titleMatch = raw.match(/^#\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1].trim() : slugParts[slugParts.length - 1]

  // Strip the first # heading so we don't double-render it
  const content = raw.replace(/^#\s+.+\n?/, '').trimStart()

  return { title, content }
}

/** Find the prev/next page in sidebar order for navigation links */
export function getAdjacentPages(
  currentSlug: string[]
): { prev: SidebarLeaf | null; next: SidebarLeaf | null } {
  const flat: SidebarLeaf[] = []
  for (const entry of sidebarNav) {
    if (isSidebarGroup(entry)) {
      flat.push(...entry.items)
    } else {
      flat.push(entry)
    }
  }

  const key = (s: string[]) => s.join('/')
  const current = key(currentSlug)
  const idx = flat.findIndex((p) => key(p.slug) === current)

  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
  }
}
