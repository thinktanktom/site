#!/usr/bin/env node
/*
 * Points git at the tracked .githooks/ directory.
 *
 *   npm run hooks:install     explicitly
 *   npm install               automatically, via the `prepare` script
 *
 * WHY core.hooksPath RATHER THAN COPYING INTO .git/hooks: a copy is untracked,
 * so it is invisible in review, silently absent after a fresh clone, and drifts
 * from whatever the repo thinks the hook is. Pointing at a tracked directory
 * makes the hook a normal reviewable file and makes installing it one setting.
 *
 * To undo: `git config --unset core.hooksPath`
 *
 * WHY IT IS ALSO A `prepare` SCRIPT: that is the hookless version of what husky
 * does, without adding a dependency to a repo that needs exactly one hook. The
 * two guards below are what keep that safe — `prepare` also runs on `npm ci` in
 * GitHub Actions, where setting a hooks path would be pointless at best.
 *
 * It never blocks: every failure path exits 0. A hook that cannot be installed
 * must not be able to fail `npm install`.
 */

import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const HOOKS_DIR = '.githooks'
const HOOK = join(REPO, HOOKS_DIR, 'pre-commit')

/* Guard 1: CI. The runner checks out a real git repo, so the repo test below
   would pass — but a hooks path there configures nothing useful and would be a
   surprising side effect of `npm ci`. */
if (process.env.CI) {
  process.exit(0)
}

const git = (...args) =>
  execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

/* Guard 2: not a git repo (a tarball install, a vendored copy). */
try {
  git('rev-parse', '--git-dir')
} catch {
  process.exit(0)
}

if (!existsSync(HOOK)) {
  console.warn(`[hooks] ${HOOKS_DIR}/pre-commit is missing — nothing installed.`)
  process.exit(0)
}

/*
 * The chmod gets its OWN try, deliberately separate from the git-config write
 * below. Sharing one meant an EPERM here — a mode-less mount, a root-owned
 * tree, a read-only filesystem — aborted the whole installer and left
 * core.hooksPath unset, so a checkout that merely could not change a file mode
 * got no hook at all, when setting the config would have worked perfectly.
 *
 * Git tracks the executable bit, so this is usually already correct. It is not
 * after a transfer that loses modes (a zip, some CI artifact paths), and a
 * non-executable hook is skipped by git SILENTLY — no warning, no error, it
 * simply never runs, which is the worst way for this to fail.
 */
try {
  chmodSync(HOOK, 0o755)
} catch (err) {
  console.warn(`[hooks] could not mark ${HOOKS_DIR}/pre-commit executable: ${err.message}`)
}

/*
 * Declares the no-op merge driver that .gitattributes points
 * content/timelog.json at. Without it git silently IGNORES `merge=ours` and
 * falls back to a text merge — which is exactly the rebase conflict on a
 * generated file that the attribute exists to prevent, and it fails quietly,
 * so it cannot be left to whoever reads .gitattributes.
 *
 * Set before the hooksPath block on purpose: that block returns early when the
 * path is already correct, and an already-installed repo still needs this.
 * Writing the same value twice is a no-op.
 */
try {
  git('config', 'merge.ours.driver', 'true')
} catch (err) {
  console.warn(`[hooks] could not declare the merge.ours driver: ${err.message}`)
}

try {
  const current = (() => {
    try {
      return git('config', '--get', 'core.hooksPath').trim()
    } catch {
      return ''
    }
  })()

  if (current === HOOKS_DIR) {
    process.exit(0)
  }

  if (current && current !== HOOKS_DIR) {
    /* Someone has already pointed this repo somewhere else. Overwriting that
       silently could disable hooks they rely on, so say so and change nothing. */
    console.warn(
      `[hooks] core.hooksPath is already "${current}" — leaving it alone.\n` +
        `        To use this repo's hooks: git config core.hooksPath ${HOOKS_DIR}`
    )
    process.exit(0)
  }

  /* core.hooksPath REPLACES .git/hooks wholesale rather than adding to it, so
     anything already living there stops running the moment this is set — with
     no warning from git. The directory is empty in this repo today (not even
     the samples), but a tool or a teammate could drop a pre-push gate in there
     later and spend a long time wondering why it never fires. */
  try {
    const shadowed = readdirSync(join(git('rev-parse', '--absolute-git-dir').trim(), 'hooks'))
      .filter((f) => !f.endsWith('.sample'))
    if (shadowed.length > 0) {
      console.warn(
        `[hooks] note: .git/hooks/ contains ${shadowed.join(', ')} — setting ` +
          `core.hooksPath makes git ignore that directory entirely.`
      )
    }
  } catch {
    /* no .git/hooks, or unreadable — nothing to warn about */
  }

  git('config', 'core.hooksPath', HOOKS_DIR)

  console.log(`[hooks] core.hooksPath → ${HOOKS_DIR} (pre-commit syncs content/timelog.json)`)
} catch (err) {
  console.warn(`[hooks] could not install: ${err.message}`)
}

process.exit(0)
