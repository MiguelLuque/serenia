import { accessSync, constants, statSync } from 'node:fs'
import { delimiter, join } from 'node:path'

export function dockerCommand(path: string): string[] {
  for (const directory of path.split(delimiter)) {
    if (!directory) continue
    try {
      const candidate = join(directory, 'rtk')
      accessSync(candidate, constants.X_OK)
      if (statSync(candidate).isFile()) return ['rtk', 'proxy', 'docker']
    } catch { /* Keep searching PATH. */ }
  }
  return ['docker']
}
