import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'))
const { version } = require('pdfjs-dist/package.json')

// Serve the exact PDF.js version's fonts and CMaps from our own origin.
export function pdfAssetPlugin() {
  let command
  async function assets() {
    const result = new Map()
    for (const folder of ['cmaps', 'standard_fonts']) {
      const entries = await readdir(join(pdfjsRoot, folder), { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile()) {result.set(`${folder}/${entry.name}`, join(pdfjsRoot, folder, entry.name))}
      }
    }
    return result
  }
  return {
    name: 'pdfjs-font-assets',
    configResolved(config) { command = config.command },
    async buildStart() {
      if (command !== 'build') {return}
      for (const [name, path] of await assets()) {
        this.emitFile({ type: 'asset', fileName: `pdfjs/${version}/${name}`, source: await readFile(path) })
      }
    },
    async configureServer(server) {
      const files = await assets()
      server.middlewares.use(`/pdfjs/${version}/`, async (req, res, next) => {
        const path = files.get(req.url?.split('?')[0].replace(/^\//, ''))
        if (!path) {next(); return}
        try {
          res.setHeader('Content-Type', 'application/octet-stream')
          res.end(await readFile(path))
        } catch (error) {next(error)}
      })
    }
  }
}
