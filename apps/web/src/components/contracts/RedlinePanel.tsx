/**
 * RedlinePanel — AI-powered redline analysis results.
 * Shows per-change recommendations, playbook alignment, and counter-proposals.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2, XCircle, RefreshCw, AlertTriangle, Loader2,
  ChevronDown, ChevronRight, Copy, Check, Sparkles, Shield,
} from 'lucide-react'

interface RedlineChange {
  changeId: string
  clauseType: string
  ourText: string
  theirText: string
  context?: string
  sectionRef?: string | null
  recommendation?: 'accept' | 'reject' | 'counter'
  playbookAlignment?: 'preferred' | 'acceptable' | 'fallback' | 'walkaway' | 'outside_playbook'
  severity?: 'low' | 'medium' | 'high' | 'critical'
  reasoning?: string
  requiresHumanReview?: boolean
  counterText?: string
  counterNote?: string
}

interface RedlineAnalysis {
  v1Id: string
  v2Id: string
  analyzedAt: string
  changes: RedlineChange[]
  summary: string
  recommendedAction: 'accept_all' | 'counter' | 'reject'
  requiresHumanGate: boolean
  confidence: number
}

interface Version {
  id: string
  versionNumber: number
  createdAt: string
}

interface RedlinePanelProps {
  analysis?: RedlineAnalysis | null
  isAnalyzing: boolean
  versions: Version[]
  onRequestAnalysis: (v1Id: string, v2Id: string) => void
}

const SEVERITY_COLORS: Record<string, string> = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-amber-50 text-amber-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const ALIGNMENT_COLORS: Record<string, string> = {
  preferred:       'bg-emerald-50 text-emerald-700',
  acceptable:      'bg-green-50 text-green-700',
  fallback:        'bg-amber-50 text-amber-700',
  walkaway:        'bg-red-100 text-red-700',
  outside_playbook: 'bg-purple-100 text-purple-700',
}

const RECOMMENDATION_CONFIG = {
  accept:  { icon: CheckCircle2, color: 'text-emerald-600',  label: 'Accept',  bg: 'bg-emerald-50' },
  reject:  { icon: XCircle,      color: 'text-red-600',      label: 'Reject',  bg: 'bg-red-50'     },
  counter: { icon: RefreshCw,    color: 'text-amber-600',    label: 'Counter', bg: 'bg-amber-50'   },
}

function ChangeCard({ change }: { change: RedlineChange }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const rec = change.recommendation ? RECOMMENDATION_CONFIG[change.recommendation] : null

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            {rec && (
              <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded-lg ${rec.bg}`}>
                <rec.icon className={`h-3.5 w-3.5 ${rec.color}`} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {rec && (
                  <span className={`text-xs font-semibold ${rec.color}`}>{rec.label}</span>
                )}
                <span className="text-xs text-gray-600 font-medium capitalize">
                  {change.clauseType.replace(/_/g, ' ')}
                </span>
                {change.sectionRef && (
                  <span className="text-xs text-gray-400 font-mono">{change.sectionRef}</span>
                )}
                {change.severity && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${SEVERITY_COLORS[change.severity] ?? ''}`}>
                    {change.severity}
                  </span>
                )}
                {change.playbookAlignment && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ALIGNMENT_COLORS[change.playbookAlignment] ?? ''}`}>
                    {change.playbookAlignment.replace(/_/g, ' ')}
                  </span>
                )}
                {change.requiresHumanReview && (
                  <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Human review
                  </span>
                )}
              </div>
              {change.reasoning && (
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{change.reasoning}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 space-y-3">
            {change.ourText && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Original</p>
                <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-900 leading-relaxed font-mono">{change.ourText}</p>
                </div>
              </div>
            )}
            {change.theirText && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Counterparty proposes</p>
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  <p className="text-xs text-emerald-900 leading-relaxed font-mono">{change.theirText}</p>
                </div>
              </div>
            )}
            {change.counterText && (
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Our counter-proposal</p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-amber-900 leading-relaxed font-mono">{change.counterText}</p>
                  {change.counterNote && (
                    <p className="text-xs text-amber-700 mt-1.5 italic">{change.counterNote}</p>
                  )}
                  <button
                    onClick={() => handleCopy(change.counterText!)}
                    className="mt-2 flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied!' : 'Copy counter text'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function RedlinePanel({
  analysis, isAnalyzing, versions, onRequestAnalysis,
}: RedlinePanelProps) {
  const [v1Id, setV1Id] = useState(versions[1]?.id ?? '')
  const [v2Id, setV2Id] = useState(versions[0]?.id ?? '')

  if (versions.length < 2) {
    return (
      <div className="text-center py-12 text-gray-400">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium text-gray-500">Upload a counterparty version to analyze redlines</p>
        <p className="text-xs mt-1">Upload a new version on the Versions tab, then come back here.</p>
      </div>
    )
  }

  const acceptN  = analysis?.changes.filter(c => c.recommendation === 'accept').length ?? 0
  const counterN = analysis?.changes.filter(c => c.recommendation === 'counter').length ?? 0
  const rejectN  = analysis?.changes.filter(c => c.recommendation === 'reject').length ?? 0

  return (
    <div className="space-y-4">
      {/* Version selectors + trigger */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Select versions to compare</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Baseline (our version)</label>
            <select
              value={v1Id}
              onChange={e => setV1Id(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {versions.map(v => (
                <option key={v.id} value={v.id}>v{v.versionNumber}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Counterparty redlines</label>
            <select
              value={v2Id}
              onChange={e => setV2Id(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {versions.map(v => (
                <option key={v.id} value={v.id}>v{v.versionNumber}</option>
              ))}
            </select>
          </div>
        </div>
        <Button
          className="w-full gap-2"
          disabled={!v1Id || !v2Id || v1Id === v2Id || isAnalyzing}
          onClick={() => onRequestAnalysis(v1Id, v2Id)}
        >
          {isAnalyzing
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing redlines…</>
            : <><Sparkles className="h-4 w-4" /> Analyze Redlines</>
          }
        </Button>
      </div>

      {/* Human gate banner */}
      {analysis?.requiresHumanGate && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Legal review required</p>
            <p className="text-xs text-amber-700 mt-0.5">
              One or more changes involve walkaway positions or terms outside the playbook. Please escalate to legal counsel before proceeding.
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      {analysis && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Analysis summary</p>
              <p className="text-xs text-gray-500 mt-0.5">{analysis.summary}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                analysis.recommendedAction === 'accept_all' ? 'bg-emerald-50 text-emerald-700' :
                analysis.recommendedAction === 'reject'    ? 'bg-red-50 text-red-700' :
                'bg-amber-50 text-amber-700'
              }`}>
                {analysis.recommendedAction === 'accept_all' ? 'Accept all'
                  : analysis.recommendedAction === 'reject'   ? 'Reject'
                  : 'Counter required'}
              </span>
              <p className="text-xs text-gray-400 mt-1">{Math.round(analysis.confidence * 100)}% confidence</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-emerald-700 font-medium">{acceptN} accept</span>
            <span className="text-amber-700 font-medium">{counterN} counter</span>
            <span className="text-red-700 font-medium">{rejectN} reject</span>
          </div>
        </div>
      )}

      {/* Change list */}
      {analysis && analysis.changes.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
            {analysis.changes.length} change{analysis.changes.length !== 1 ? 's' : ''} detected
          </p>
          {analysis.changes.map(change => (
            <ChangeCard key={change.changeId} change={change} />
          ))}
        </div>
      )}
    </div>
  )
}
