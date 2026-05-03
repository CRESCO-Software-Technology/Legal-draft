/**
 * org-seed — public entry point.
 *
 * The implementation lives in the modular `org-seed/` directory:
 *   - categories.ts  — 18 clause categories
 *   - clauses.ts     — 106 clauses spanning the negotiation spectrum
 *   - playbook.ts    — 66 playbook positions (4-tier coverage on negotiable categories)
 *   - templates.ts   — 20 contract templates
 *   - industry-packs/ — 5 vertical add-on packs (saas, healthcare, manufacturing, biotech, logistics)
 *
 * This file is preserved as a thin re-export so existing call sites
 * (auth.ts, scripts/seed-personas.ts) continue to work without changes.
 *
 * To opt into an industry pack at signup or in a persona seed, pass:
 *   await seedOrgDefaults(orgId, slug, adminId, { industryPack: 'saas' })
 */
export {
  seedOrgDefaults,
  UNIVERSAL_COUNTS,
  type SeedOrgOptions,
} from './org-seed/index.js'
export type { IndustryPackId } from './org-seed/types.js'
export { INDUSTRY_PACK_INFO } from './org-seed/industry-packs/index.js'
