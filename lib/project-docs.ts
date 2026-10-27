// Server-only: imports fs. Never import this from a 'use client' module.
//
// DocSidebar instead holds its OWN registry of the four navs (NAVS) and
// receives only `project`, `label` and `navId` from the layout — see the
// measurements in that file for why importing them beats passing them. The
// consequence: TWO places list every doc tree, and `NAVS[project] ?? []` means
// a tree added to DOC_PROJECTS but not to NAVS ships an empty sidebar with no
// build error. (This comment claimed the nav arrived as a prop until
// 2026-10-27. It never did.)
//
// One implementation for every project doc tree. This replaced four
// near-identical lib/*-docs.ts files that differed only in an import path and a
// content directory (2 of 70 lines) — and whose drift had already cost
// BasedAgents and FractalWebhook their canonical URL and BreadcrumbList.

import fs from 'fs'
import path from 'path'
import { cache } from 'react'
import { isSidebarGroup, type SidebarEntry, type SidebarLeaf } from '@lib/doc-sidebar-types'
import { sidebarNav as bankxNav } from '@lib/bankx-sidebar'
import { sidebarNav as basedAgentsNav } from '@lib/based-agents-sidebar'
import { sidebarNav as fractalWebhookNav } from '@lib/fractal-webhook-sidebar'
import { sidebarNav as rufloOrchestrationNav } from '@lib/ruflo-orchestration-sidebar'


export interface DocProject {
  /** Breadcrumb and sidebar display name. */
  label: string
  /** Prefix for the meta description: `${descriptionPrefix}: ${doc.title}`. */
  descriptionPrefix: string
  /** Prefix for the mobile-nav element id and its aria-controls. */
  navId: string
  nav: SidebarEntry[]
}

// Keys are the URL segment, so /projects/BankX/introduction keeps its exact
// existing URL. Adding a doc tree is one entry here plus its sidebar data file.
export const DOC_PROJECTS = {
  BankX: {
    label: 'BankX Protocol',
    descriptionPrefix: 'BankX Protocol documentation',
    navId: 'bankx',
    nav: bankxNav,
  },
  BasedAgents: {
    label: 'Based Agents',
    descriptionPrefix: 'Based Agents smart contract suite documentation',
    navId: 'based-agents',
    nav: basedAgentsNav,
  },
  FractalWebhook: {
    label: 'Fractal Webhook',
    descriptionPrefix: 'Fractal Webhook Server documentation',
    navId: 'fractal-webhook',
    nav: fractalWebhookNav,
  },
  RufloOrchestration: {
    label: 'AI Agent Orchestration',
    descriptionPrefix: 'AI Agent-Orchestration Infrastructure documentation',
    navId: 'ruflo-orchestration',
    nav: rufloOrchestrationNav,
  },
} satisfies Record<string, DocProject>

export type DocProjectSlug = keyof typeof DOC_PROJECTS

export function isDocProject(slug: string): slug is DocProjectSlug {
  return Object.prototype.hasOwnProperty.call(DOC_PROJECTS, slug)
}

/** Sidebar order, groups expanded in place — the order prev/next follows. */
function flatten(nav: SidebarEntry[]): SidebarLeaf[] {
  const flat: SidebarLeaf[] = []
  for (const entry of nav) {
    if (isSidebarGroup(entry)) {
      flat.push(...entry.items)
    } else {
      flat.push(entry)
    }
  }
  return flat
}

export function getAllDocSlugs(project: DocProjectSlug): string[][] {
  return flatten(DOC_PROJECTS[project].nav).map((leaf) => leaf.slug)
}

/** Every {slug, docSlug} pair across every doc tree, for the catch-all route. */
export function getAllDocParams(): { slug: DocProjectSlug; docSlug: string[] }[] {
  return (Object.keys(DOC_PROJECTS) as DocProjectSlug[]).flatMap((slug) =>
    getAllDocSlugs(slug).map((docSlug) => ({ slug, docSlug }))
  )
}

export interface DocPage {
  title: string
  content: string
}

// Memoised on primitives, not on the slug array: React's cache() keys by
// argument identity, and params.docSlug is a fresh array on every call, so
// caching the array-taking function would never hit. Each page is rendered
// twice per build (generateMetadata + the page body), so this halves the reads.
const readDoc = cache((project: DocProjectSlug, slugKey: string): DocPage | null => {
  const slugParts = slugKey.split('/')
  const docsDir = path.join(process.cwd(), 'content/projects', project)
  const filePath = path.join(docsDir, ...slugParts) + '.md'
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf8')

  // Extract title from first # heading
  const titleMatch = raw.match(/^#\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1].trim() : slugParts[slugParts.length - 1]

  // Strip the first # heading so we don't double-render it
  const content = raw.replace(/^#\s+.+\n?/, '').trimStart()

  return { title, content }
})

export function getDocBySlug(project: DocProjectSlug, slugParts: string[]): DocPage | null {
  return readDoc(project, slugParts.join('/'))
}

/** Find the prev/next page in sidebar order for navigation links */
export function getAdjacentPages(
  project: DocProjectSlug,
  currentSlug: string[]
): { prev: SidebarLeaf | null; next: SidebarLeaf | null } {
  const flat = flatten(DOC_PROJECTS[project].nav)

  const key = (s: string[]) => s.join('/')
  const current = key(currentSlug)
  const idx = flat.findIndex((p) => key(p.slug) === current)

  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
  }
}
