import type { ReactNode } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'

export function SurfaceState({
  status,
  loading,
  empty,
  error,
  retry,
  onRetry,
  children,
}: {
  status: 'loading' | 'ready' | 'empty' | 'error'
  loading: string
  empty: string
  error: string
  retry: string
  onRetry: () => void
  children: ReactNode
}) {
  if (status === 'loading') {
    return (
      <div className="recording-state" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <p>{loading}</p>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="recording-state" role="alert">
        <p>{error}</p>
        <button type="button" onClick={onRetry}>
          {retry} <ArrowRight size={16} />
        </button>
      </div>
    )
  }
  if (status === 'empty') {
    return (
      <div className="recording-state">
        <p>{empty}</p>
      </div>
    )
  }
  return <>{children}</>
}
