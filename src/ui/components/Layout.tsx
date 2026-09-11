import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export function Screen({
  title, subtitle, back, action, children, wide,
}: {
  title: string
  subtitle?: ReactNode
  back?: string | (() => void)
  action?: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  const navigate = useNavigate()
  const goBack = () => {
    if (typeof back === 'function') back()
    else if (typeof back === 'string') navigate(back)
    else navigate(-1)
  }

  return (
    <div className="min-h-full bg-ink">
      <header
        className="sticky top-0 z-30 border-b border-ink-line/60 bg-ink/90 backdrop-blur"
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <div
          className={
            'mx-auto flex items-center gap-3 px-4 py-3 ' +
            (wide ? 'max-w-4xl' : 'max-w-xl')
          }
        >
          {back !== undefined ? (
            <button
              onClick={goBack}
              aria-label="Go back"
              className="-ml-2 rounded-lg p-2 text-slate-400 transition hover:bg-ink-soft hover:text-slate-100"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">{title}</h1>
            {subtitle ? (
              <div className="truncate text-xs text-slate-400">{subtitle}</div>
            ) : null}
          </div>
          {action}
        </div>
      </header>
      <main
        className={'mx-auto px-4 py-4 ' + (wide ? 'max-w-4xl' : 'max-w-xl')}
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 2rem)' }}
      >
        {children}
      </main>
    </div>
  )
}

export function Section({
  title, hint, children, right,
}: {
  title?: string
  hint?: string
  children: ReactNode
  right?: ReactNode
}) {
  return (
    <section className="mb-5">
      {title ? (
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              {title}
            </h2>
            {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
          </div>
          {right}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card text-center">
      <p className="font-semibold text-slate-200">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-slate-400">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Banner({
  tone = 'info', title, children,
}: {
  tone?: 'info' | 'warn' | 'error' | 'good'
  title: string
  children?: ReactNode
}) {
  const tones = {
    info: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
    warn: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    error: 'border-loser/40 bg-loser/10 text-red-200',
    good: 'border-winner/40 bg-winner/10 text-emerald-200',
  }
  return (
    <div className={'rounded-xl border p-3.5 text-sm ' + tones[tone]}>
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-[13px] opacity-90">{children}</div> : null}
    </div>
  )
}

export function Money({ value, className = '' }: { value: number; className?: string }) {
  const tone = value > 0 ? 'text-winner' : value < 0 ? 'text-loser' : 'text-slate-400'
  return (
    <span className={'tabular-nums font-bold ' + tone + ' ' + className}>
      {value > 0 ? '+' : ''}
      {value.toLocaleString()}
    </span>
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-line border-t-gold" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
