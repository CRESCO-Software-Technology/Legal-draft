/**
 * DiffViewer — renders HTML tracked-changes diff from node-htmldiff.
 * Supports unified and side-by-side modes.
 */
import { useState } from 'react'
import { ArrowLeftRight, AlignLeft } from 'lucide-react'

interface DiffStats {
  insertions: number
  deletions: number
}

interface DiffViewerProps {
  diffHtml: string
  stats: DiffStats
  v1Label?: string
  v2Label?: string
}

export function DiffViewer({ diffHtml, stats, v1Label = 'Original', v2Label = 'Counterparty' }: DiffViewerProps) {
  const [mode, setMode] = useState<'unified' | 'side-by-side'>('unified')

  return (
    <div className="flex flex-col gap-3">
      {/* Stats bar + mode toggle */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <span className="w-3 h-3 rounded-sm bg-emerald-200 border border-emerald-400 inline-block" />
            {stats.insertions} insertion{stats.insertions !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5 text-red-700 font-medium">
            <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block" />
            {stats.deletions} deletion{stats.deletions !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
          <button
            onClick={() => setMode('unified')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === 'unified' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlignLeft className="h-3.5 w-3.5" /> Unified
          </button>
          <button
            onClick={() => setMode('side-by-side')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === 'side-by-side' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" /> Side by side
          </button>
        </div>
      </div>

      {mode === 'unified' ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div
            className="diff-unified prose prose-sm max-w-none p-6 overflow-auto max-h-[70vh]"
            dangerouslySetInnerHTML={{ __html: diffHtml }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {v1Label}
            </div>
            <div
              className="diff-left prose prose-sm max-w-none p-4 overflow-auto max-h-[65vh]"
              dangerouslySetInnerHTML={{ __html: diffHtml }}
            />
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {v2Label}
            </div>
            <div
              className="diff-right prose prose-sm max-w-none p-4 overflow-auto max-h-[65vh]"
              dangerouslySetInnerHTML={{ __html: diffHtml }}
            />
          </div>
        </div>
      )}

      <style>{`
        /* Unified: show both ins and del */
        .diff-unified ins {
          background: #dcfce7;
          color: #166534;
          text-decoration: none;
          border-radius: 2px;
          padding: 0 1px;
        }
        .diff-unified del {
          background: #fee2e2;
          color: #991b1b;
          text-decoration: line-through;
          border-radius: 2px;
          padding: 0 1px;
        }
        /* Side-by-side left: hide ins (counterparty additions not in original) */
        .diff-left ins { display: none; }
        .diff-left del {
          background: #fee2e2;
          color: #991b1b;
          text-decoration: none;
          border-radius: 2px;
          padding: 0 1px;
        }
        /* Side-by-side right: hide del (original text removed by counterparty) */
        .diff-right del { display: none; }
        .diff-right ins {
          background: #dcfce7;
          color: #166534;
          text-decoration: none;
          border-radius: 2px;
          padding: 0 1px;
        }
      `}</style>
    </div>
  )
}
