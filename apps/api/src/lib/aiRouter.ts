/**
 * AI Provider Router (D.0.3)
 *
 * Resolves "which model + key should I use for this org's tier-X call?"
 *
 * Resolution order:
 *   1. Look up OrgAiSettings.<tier>Model (admin override). If unset, use
 *      the platform default for that tier.
 *   2. For the chosen provider:
 *        a. Look up OrgAiKey for (org, provider). If present + active,
 *           decrypt it and return the key with source='byok'.
 *        b. Else fall back to the platform env key for that provider.
 *           Return source='platform'.
 *   3. If the chosen provider has neither BYOK nor platform key, try the
 *      next tier candidate. Repeat.
 *   4. If all tier candidates exhaust, throw NoProviderAvailable.
 *
 * Used by:
 *   - The Python agents service via POST /api/internal/ai/resolve
 *     (D.0.4 will register this route)
 *   - Any future Node-side AI call (e.g., LLM-as-reranker workaround)
 *
 * Decryption is lazy + per-call — we never cache plaintext keys.
 */
import { prisma } from './prisma.js'
import { decrypt } from './encryption.js'
import { assertCostCapNotExceeded } from './costCap.js'

// ─── Tier definitions ────────────────────────────────────────────────────────
// Each tier is an ordered list of (provider, model) candidates. The router
// walks the list and uses the first one that has a key available.
//
// Today (OpenAI-only platform keys), every tier resolves to its OpenAI
// candidate. When the platform adds an Anthropic key (or an org adds BYOK),
// the corresponding higher-priority candidates become eligible.

export type Tier = 'reasoning' | 'default' | 'fast' | 'embed' | 'rerank' | 'vision_ocr'
export type Source = 'platform' | 'byok'

interface Candidate {
  provider: string
  model: string
}

const PLATFORM_TIER_DEFAULTS: Record<Tier, Candidate[]> = {
  reasoning: [
    { provider: 'anthropic', model: 'claude-opus-4-7' },
    { provider: 'openai',    model: 'gpt-5' },
    { provider: 'openai',    model: 'gpt-4.1' }, // reliable fallback if gpt-5 unavailable on the account
    { provider: 'google',    model: 'gemini-2.5-pro' },
  ],
  default: [
    { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    { provider: 'openai',    model: 'gpt-4.1' },
    { provider: 'google',    model: 'gemini-2.5-pro' },
  ],
  fast: [
    { provider: 'anthropic', model: 'claude-haiku-4-5' },
    { provider: 'openai',    model: 'gpt-4.1-mini' },
    { provider: 'google',    model: 'gemini-2.5-flash' },
  ],
  embed: [
    { provider: 'voyage', model: 'voyage-law-2' },
    { provider: 'openai', model: 'text-embedding-3-large' },
    { provider: 'google', model: 'gemini-embedding-001' },
  ],
  rerank: [
    { provider: 'voyage', model: 'voyage-rerank-2.5' },
    { provider: 'cohere', model: 'rerank-english-v3.0' },
    // LLM-as-reranker workaround until a dedicated reranker key arrives:
    { provider: 'openai', model: 'gpt-4.1-mini' },
  ],
  vision_ocr: [
    { provider: 'mistral', model: 'mistral-ocr-3' },
    { provider: 'openai',  model: 'gpt-4.1' }, // GPT-4.1 has vision
  ],
}

// ─── Platform env keys (read once on import, refreshed on demand) ────────────

function platformKey(provider: string): string | undefined {
  switch (provider) {
    case 'openai':    return process.env.OPENAI_API_KEY
    case 'anthropic': return process.env.ANTHROPIC_API_KEY
    case 'google':    return process.env.GOOGLE_API_KEY
    case 'voyage':    return process.env.VOYAGE_API_KEY
    case 'cohere':    return process.env.COHERE_API_KEY
    case 'mistral':   return process.env.MISTRAL_API_KEY
    default:          return undefined
  }
}

// ─── Per-org override + BYOK lookups ─────────────────────────────────────────

const TIER_FIELD: Record<Tier, keyof OrgAiSettingsShape> = {
  reasoning:  'reasoningModel',
  default:    'defaultModel',
  fast:       'fastModel',
  embed:      'embedModel',
  rerank:     'rerankModel',
  vision_ocr: 'visionOcrModel',
}

interface OrgAiSettingsShape {
  reasoningModel: string | null
  defaultModel: string | null
  fastModel: string | null
  embedModel: string | null
  rerankModel: string | null
  visionOcrModel: string | null
}

async function getOrgOverride(orgId: string, tier: Tier): Promise<Candidate | null> {
  const settings = await prisma.orgAiSettings.findUnique({
    where: { orgId },
    select: {
      reasoningModel: true, defaultModel: true, fastModel: true,
      embedModel: true, rerankModel: true, visionOcrModel: true,
    },
  })
  if (!settings) return null
  const raw = settings[TIER_FIELD[tier]]
  if (!raw) return null
  // Format: "provider/model"
  const [provider, model] = raw.split('/', 2)
  if (!provider || !model) return null
  return { provider, model }
}

async function getByokKey(orgId: string, provider: string): Promise<string | null> {
  const row = await prisma.orgAiKey.findUnique({
    where: { orgId_provider: { orgId, provider } },
  })
  if (!row || !row.isActive) return null
  try {
    return decrypt(row.encryptedKey)
  } catch (err) {
    // Bad ciphertext (e.g., master key rotated without re-encrypt) — treat as missing.
    // Logged so an admin can investigate; we don't block on it.
    console.error(`[aiRouter] BYOK decrypt failed for org=${orgId} provider=${provider}: ${(err as Error).message}`)
    return null
  }
}

// ─── Public resolver ─────────────────────────────────────────────────────────

export interface ResolvedLlm {
  provider: string
  model: string
  apiKey: string
  /** Whether the key came from the org's BYOK or the platform env */
  source: Source
  tier: Tier
}

export class NoProviderAvailable extends Error {
  constructor(public tier: Tier, public attempted: Candidate[]) {
    super(`No provider available for tier="${tier}". Tried: ${attempted.map(c => `${c.provider}/${c.model}`).join(', ')}`)
    this.name = 'NoProviderAvailable'
  }
}

/**
 * Resolve the best-available (provider, model, apiKey) for the given org + tier.
 *
 * Pure function modulo DB reads — does not mutate any state. Plaintext key is
 * returned ONLY in the response object; never logged, never cached.
 */
export async function resolveLlm(orgId: string, tier: Tier): Promise<ResolvedLlm> {
  const override = await getOrgOverride(orgId, tier)
  const candidates = override ? [override] : PLATFORM_TIER_DEFAULTS[tier]

  for (const cand of candidates) {
    // BYOK first (org owns the cost / rate limit — cost cap doesn't apply)
    const byokKey = await getByokKey(orgId, cand.provider)
    if (byokKey) {
      return { ...cand, apiKey: byokKey, source: 'byok', tier }
    }
    // Else platform key — guarded by daily cost cap (D.0.5)
    const platKey = platformKey(cand.provider)
    if (platKey) {
      // Throws CostCapExceededError under 'block' policy; logs under 'warn'
      await assertCostCapNotExceeded(orgId)
      return { ...cand, apiKey: platKey, source: 'platform', tier }
    }
    // No key for this provider — try the next candidate
  }
  throw new NoProviderAvailable(tier, candidates)
}

// ─── Startup configuration check ─────────────────────────────────────────────

/**
 * At server boot, log the resolved routing for each tier (using the platform
 * defaults — no org context). Refuses to boot if a critical tier (default,
 * fast) has no provider with a platform key.
 *
 * Non-critical tiers (rerank, vision_ocr) are allowed to be unconfigured —
 * features that need them will degrade gracefully or 503 on use.
 */
export function assertRouterConfigured(): void {
  const critical: Tier[] = ['default', 'fast']
  const lines: string[] = []
  for (const tier of Object.keys(PLATFORM_TIER_DEFAULTS) as Tier[]) {
    const candidates = PLATFORM_TIER_DEFAULTS[tier]
    const winner = candidates.find(c => platformKey(c.provider))
    if (winner) {
      lines.push(`  ${tier.padEnd(11)} → ${winner.provider}/${winner.model}`)
    } else if (critical.includes(tier)) {
      throw new Error(
        `[aiRouter] Critical tier "${tier}" has no platform key. ` +
        `Tried: ${candidates.map(c => c.provider).join(', ')}. ` +
        `Set at least one of OPENAI_API_KEY / ANTHROPIC_API_KEY in apps/api/.env.`
      )
    } else {
      lines.push(`  ${tier.padEnd(11)} → (no platform key — orgs must BYOK)`)
    }
  }
  console.info('[aiRouter] platform routing table:\n' + lines.join('\n'))
}

// ─── Internal helpers exposed for the REST endpoint (D.0.4) + tests ─────────

export const __internal = {
  PLATFORM_TIER_DEFAULTS,
  platformKey,
  getOrgOverride,
  getByokKey,
}
