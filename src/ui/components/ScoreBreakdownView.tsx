/**
 * "Why this score?" Every pattern shows its name, its value, why it applied and
 * the exact tiles that triggered it, and every pattern that was absorbed by a
 * bigger one is listed too so the arithmetic can be audited at the table.
 */

import { useState } from 'react'
import type { ScoreBreakdown } from '../../engine/scorer'
import type { PaymentBreakdown } from '../../engine/payments'
import type { ScoredRule } from '../../engine/rules/types'
import { MCR_EXAMPLES } from '../../engine/rules/mcr/examples'
import { Money } from './Layout'
import { ExampleHand } from './ExampleHand'
import { Tile } from './Tile'

const CATEGORY_LABEL: Record<string, string> = {
  structure: 'Hand shape',
  suit: 'Suits',
  honors: 'Winds and dragons',
  sets: 'Sets',
  tiles: 'Tile values',
  wait: 'The wait',
  timing: 'How it was won',
  bonus: 'Bonus tiles',
}

function RuleCard({ rule }: { rule: ScoredRule }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="border-b border-ink-line/50 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 py-3 text-left"
      >
        <span className="mt-0.5 text-winner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            {rule.guide ? (
              <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-600">
                #{rule.guide}
              </span>
            ) : null}
            <span className="font-semibold text-slate-100">{rule.name}</span>
            {rule.chinese ? (
              <span className="tile-face text-xs text-slate-500">{rule.chinese}</span>
            ) : null}
            {rule.times > 1 ? (
              <span className="chip">x{rule.times}</span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-slate-400">
            {rule.explanation}
          </span>
        </span>
        <span className="shrink-0 pl-1 text-right">
          <Money value={rule.total} />
          <span className="block text-[10px] uppercase tracking-wide text-slate-500">
            {CATEGORY_LABEL[rule.category] ?? rule.category}
          </span>
        </span>
      </button>
      {open ? (
        <div className="-mt-1 pb-3 pl-7">
          <p className="mb-2 text-xs text-slate-500">
            {rule.description}
            {rule.guide ? ' Hand ' + rule.guide + ' in the guide.' : ''}
          </p>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
            Your tiles
          </p>
          <div className="scroll-x">
            {rule.evidence.map((group, i) => (
              <div key={i} className="flex shrink-0 gap-0.5 rounded-lg bg-ink/60 p-1.5">
                {group.map((id, j) => (
                  <Tile key={id + j} id={id} size="xs" />
                ))}
              </div>
            ))}
          </div>
          {MCR_EXAMPLES[rule.ruleId] ? (
            <>
              <p className="mb-1 mt-2.5 text-[10px] uppercase tracking-wide text-slate-500">
                What the pattern looks like
              </p>
              <ExampleHand example={MCR_EXAMPLES[rule.ruleId]} />
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

export function ScoreBreakdownView({
  score, payment, winnerName, pointValue = 1,
}: {
  score: ScoreBreakdown
  payment?: PaymentBreakdown | null
  winnerName: string
  pointValue?: number
}) {
  return (
    <div className="space-y-4">
      <div className="card bg-gradient-to-b from-felt/40 to-ink-soft/80 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Winner</p>
        <p className="mt-1 text-2xl font-extrabold">{winnerName}</p>
        <p className="mt-3 text-5xl font-extrabold tabular-nums text-gold">
          {score.totalPoints.toLocaleString()}
        </p>
        <p className="text-xs uppercase tracking-widest text-slate-400">points</p>
        {pointValue !== 1 ? (
          <p className="mt-1 text-sm text-slate-400">
            Worth {(score.totalPoints * pointValue).toLocaleString()} at{' '}
            {pointValue} per point.
          </p>
        ) : null}
      </div>

      <div className="card">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-300">
          Hand breakdown
        </h3>
        <ul>
          {score.rules.map((r) => (
            <RuleCard key={r.ruleId} rule={r} />
          ))}
        </ul>

        <dl className="mt-3 space-y-1 border-t border-ink-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-400">Patterns</dt>
            <dd className="tabular-nums font-semibold">{score.handPoints}</dd>
          </div>
          {score.bonusPoints > 0 ? (
            <div className="flex justify-between">
              <dt className="text-slate-400">Flowers and seasons</dt>
              <dd className="tabular-nums font-semibold">+{score.bonusPoints}</dd>
            </div>
          ) : null}
          {score.uncappedPoints !== undefined ? (
            <div className="flex justify-between text-amber-300">
              <dt>Capped from {score.uncappedPoints}</dt>
              <dd className="tabular-nums font-semibold">{score.totalPoints}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-ink-line pt-2 text-base">
            <dt className="font-bold">Final score</dt>
            <dd className="tabular-nums font-extrabold text-gold">{score.totalPoints}</dd>
          </div>
        </dl>
      </div>

      {score.suppressed.length > 0 ? (
        <div className="card border-sky-500/30 bg-sky-500/5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-sky-200">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            Patterns that overlap
          </h3>
          <ul className="mt-2 space-y-2 text-[13px] text-sky-100/80">
            {score.suppressed.map((s) => (
              <li key={s.ruleId}>
                <span className="font-semibold text-sky-100">{s.name}</span>{' '}
                ({s.points} {s.points === 1 ? 'point' : 'points'}) was not counted. {s.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {payment ? (
        <div className="card">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
            Payments
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">{payment.formula}</p>
          <ul className="mt-3 divide-y divide-ink-line/50">
            {payment.lines.map((l) => (
              <li key={l.playerId} className="flex items-start gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-100">{l.name}</span>
                  <span className="block text-[12px] leading-snug text-slate-500">
                    {l.reason}
                  </span>
                </span>
                <Money value={l.amount} className="text-base" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="px-1 text-center text-[11px] text-slate-600">
        {score.readingsConsidered === 1
          ? 'These tiles have one legal reading.'
          : score.readingsConsidered +
            ' legal readings of these tiles were compared and the highest scoring one was used.'}
      </p>
    </div>
  )
}
