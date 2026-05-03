/**
 * CommentsPanel — threaded comments on contracts.
 * Used internally (requireAuth) and in portal mode (token-gated, no auth).
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { MessageSquare, Check, Trash2, Reply, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

interface Comment {
  id: string
  authorId: string
  body: string
  clauseRef?: string | null
  resolved: boolean
  resolvedAt?: string | null
  createdAt: string
  replies: Comment[]
}

interface CommentsPanelProps {
  contractId: string
  versionId?: string
  clauseRef?: string
  portalMode?: boolean
  portalToken?: string
  permissions?: string[]
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function authorDisplay(authorId: string) {
  if (authorId.startsWith('portal:')) return 'External reviewer'
  return authorId.slice(0, 8)
}

function CommentThread({
  comment, contractId, portalMode, portalToken, canComment, onResolve, onDelete,
}: {
  comment: Comment
  contractId: string
  portalMode: boolean
  portalToken?: string
  canComment: boolean
  onResolve: (id: string) => void
  onDelete: (id: string) => void
}) {
  const qc = useQueryClient()
  const [showReply, setShowReply] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [replyName, setReplyName] = useState('')
  const [expanded, setExpanded] = useState(true)

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (portalMode && portalToken) {
        return api.post(`/portal/${portalToken}/comments`, {
          body: replyBody.trim(),
          clauseRef: comment.clauseRef,
          authorName: replyName || undefined,
        })
      }
      return api.post(`/contracts/${contractId}/comments`, {
        body: replyBody.trim(),
        parentId: comment.id,
        clauseRef: comment.clauseRef,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-comments', contractId] })
      setReplyBody('')
      setReplyName('')
      setShowReply(false)
    },
  })

  return (
    <div className={`border rounded-xl overflow-hidden ${comment.resolved ? 'opacity-60' : ''}`}>
      <div className="px-4 py-3 bg-white">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
              {authorDisplay(comment.authorId)[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-800">{authorDisplay(comment.authorId)}</span>
                {comment.clauseRef && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">
                    {comment.clauseRef}
                  </span>
                )}
                <span className="text-xs text-gray-400">{timeAgo(comment.createdAt)}</span>
                {comment.resolved && <span className="text-xs text-emerald-600 font-medium">Resolved</span>}
              </div>
              <p className="text-sm text-gray-700 mt-1 leading-relaxed">{comment.body}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {comment.replies.length > 0 && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            )}
            {!portalMode && !comment.resolved && (
              <button
                onClick={() => onResolve(comment.id)}
                title="Mark resolved"
                className="p-1 text-gray-400 hover:text-emerald-600 rounded transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            )}
            {!portalMode && (
              <button
                onClick={() => onDelete(comment.id)}
                title="Delete"
                className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {canComment && (
              <button
                onClick={() => setShowReply(r => !r)}
                className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors"
                title="Reply"
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Replies */}
        {expanded && comment.replies.length > 0 && (
          <div className="mt-3 pl-9 space-y-2.5 border-l-2 border-gray-100 ml-3.5">
            {comment.replies.map(reply => (
              <div key={reply.id} className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                  {authorDisplay(reply.authorId)[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">{authorDisplay(reply.authorId)}</span>
                    <span className="text-xs text-gray-400">{timeAgo(reply.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{reply.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reply input */}
        {showReply && (
          <div className="mt-3 pl-9 ml-1 space-y-2">
            {portalMode && (
              <input
                value={replyName}
                onChange={e => setReplyName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            <div className="flex gap-2">
              <textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder="Write a reply…"
                rows={2}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <Button
                size="sm"
                disabled={!replyBody.trim() || replyMutation.isPending}
                onClick={() => replyMutation.mutate()}
                className="self-end"
              >
                {replyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Post'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function CommentsPanel({
  contractId, versionId, clauseRef, portalMode = false, portalToken, permissions = [],
}: CommentsPanelProps) {
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [clauseRefInput, setClauseRefInput] = useState(clauseRef ?? '')
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved')

  const canComment = portalMode ? permissions.includes('comment') : true

  const commentsQuery = useQuery({
    queryKey: ['contract-comments', contractId, clauseRef],
    queryFn: () => {
      if (portalMode && portalToken) {
        // Portal mode: comments are loaded with the contract — we don't have a separate endpoint
        // Return empty for now; portal shows existing comments inline
        return { data: [] }
      }
      const params: Record<string, string> = {}
      if (clauseRef) params.clauseRef = clauseRef
      if (filter !== 'all') params.resolved = String(filter === 'resolved')
      return api.get(`/contracts/${contractId}/comments`, { params }).then(r => r.data)
    },
    enabled: !!contractId && !portalMode,
  })

  const addComment = useMutation({
    mutationFn: () => {
      if (portalMode && portalToken) {
        return api.post(`/portal/${portalToken}/comments`, {
          body: body.trim(),
          clauseRef: clauseRefInput || undefined,
          authorName: authorName || undefined,
        })
      }
      return api.post(`/contracts/${contractId}/comments`, {
        body: body.trim(),
        clauseRef: clauseRefInput || undefined,
        versionId,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-comments', contractId] })
      setBody('')
      setAuthorName('')
    },
  })

  const resolveComment = useMutation({
    mutationFn: (commentId: string) =>
      api.patch(`/contracts/${contractId}/comments/${commentId}`, { resolved: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contract-comments', contractId] }),
  })

  const deleteComment = useMutation({
    mutationFn: (commentId: string) =>
      api.delete(`/contracts/${contractId}/comments/${commentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contract-comments', contractId] }),
  })

  const comments: Comment[] = commentsQuery.data?.data ?? []
  const filtered = filter === 'all' ? comments
    : filter === 'resolved' ? comments.filter(c => c.resolved)
    : comments.filter(c => !c.resolved)

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs (internal mode only) */}
      {!portalMode && (
        <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg w-fit">
          {(['unresolved', 'all', 'resolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Add comment */}
      {canComment && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Add a comment</p>
          {portalMode && (
            <input
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          <input
            value={clauseRefInput}
            onChange={e => setClauseRefInput(e.target.value)}
            placeholder="Clause / Section (optional, e.g. Section 5.2)"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your comment…"
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!body.trim() || addComment.isPending}
              onClick={() => addComment.mutate()}
            >
              {addComment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Post comment
            </Button>
          </div>
        </div>
      )}

      {/* Comment threads */}
      {commentsQuery.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No comments yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(comment => (
            <CommentThread
              key={comment.id}
              comment={comment}
              contractId={contractId}
              portalMode={portalMode}
              portalToken={portalToken}
              canComment={canComment}
              onResolve={(id) => resolveComment.mutate(id)}
              onDelete={(id) => deleteComment.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
