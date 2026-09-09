import { execFileSync } from 'node:child_process'

async function drainStdin() {
  for await (const _chunk of process.stdin) {
    // Cursor sends hook JSON on stdin; we only need to consume it.
  }
}

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function hasChanges() {
  const status = git(['status', '--porcelain'])
  return status.trim().length > 0
}

function hasRemote() {
  try {
    const remotes = git(['remote'])
    return remotes.split(/\r?\n/).includes('origin')
  } catch {
    return false
  }
}

await drainStdin()

try {
  git(['rev-parse', '--is-inside-work-tree'])

  if (hasChanges()) {
    git(['add', '-A'])
    try {
      git(['commit', '-m', 'Auto-sync: save project changes'])
    } catch {
      // Nothing staged (ignored files only) or commit rejected.
    }
  }

  if (hasRemote()) {
    git(['push', '-u', 'origin', 'HEAD'])
  }
} catch {
  // Fail open so a git error never blocks the agent.
}

process.stdout.write('{}\n')
