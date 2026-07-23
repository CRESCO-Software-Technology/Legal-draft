#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const routesModule = await import(resolve(root, 'src/lib/routes.ts')).catch(async () => {
  // Fallback: tsx not loaded — read TS via simple regex parse
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(resolve(root, 'src/lib/routes.ts'), 'utf8')
  // Only static path strings — skip template literals like `/compare/${slug}`.
  const paths = [...src.matchAll(/path:\s*['"`](\/[^'"`$]*)['"`]/g)].map((m) => m[1])
  // Synthesize learn/template/industry/compare paths
  const learnSlugs = ['contract-lifecycle-management','ai-contract-review','ai-contract-drafting','contract-redlining','clause-library','contract-repository','contract-approval-workflow','contract-renewal-tracking','obligation-management','electronic-signature','nda','msa','dpa','baa','sow']
  const templateSlugs = ['nda','msa','dpa','baa','sow','employment-agreement','mta']
  const industrySlugs = ['saas','healthcare','manufacturing','biotech','logistics']
  const compareSlugs = ['ironclad','harvey','spellbook','docusign-clm','icertis']
  const all = new Set(paths)
  learnSlugs.forEach((s) => all.add(`/learn/${s}`))
  templateSlugs.forEach((s) => all.add(`/templates/${s}`))
  industrySlugs.forEach((s) => all.add(`/industries/${s}`))
  compareSlugs.forEach((s) => all.add(`/compare/${s}`))
  return { allRoutes: [...all].map((path) => ({ path })) }
})

const SITE = process.env.SITE_URL ?? 'https://contracts.cresco.org'
const today = new Date().toISOString().slice(0, 10)

const urls = (routesModule.allRoutes ?? []).map((r) => {
  const path = typeof r === 'string' ? r : r.path
  const priority = (typeof r === 'object' && r.priority) || 0.6
  return `  <url>\n    <loc>${SITE}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`
})

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`

// Write to public/ (source) and dist/ when present — build runs this *after*
// `vite build`, so writing only to public/ left nginx serving a stale dist copy.
const targets = [resolve(root, 'public'), resolve(root, 'dist')]
for (const outDir of targets) {
  if (!existsSync(outDir)) {
    if (outDir.endsWith('public')) mkdirSync(outDir, { recursive: true })
    else continue
  }
  writeFileSync(resolve(outDir, 'sitemap.xml'), xml, 'utf8')
}
console.log(`✓ sitemap.xml written with ${urls.length} URLs (${SITE})`)
