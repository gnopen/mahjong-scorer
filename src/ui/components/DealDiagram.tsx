/**
 * How the tiles get dealt, drawn as a sequence rather than described in a
 * paragraph. Follows the guide: three rounds of four tiles each starting with
 * East, then East takes two more and everyone else takes one.
 */

import type { WindPosition } from '../../engine/hand'
import { WIND_GLYPH, WIND_LABEL, WIND_ORDER } from '../../engine/setup'

const ORDER: WindPosition[] = WIND_ORDER

function Row({
  label, take, names, highlight,
}: {
  label: string
  take: number | Record<WindPosition, number>
  names: Partial<Record<WindPosition, string>>
  highlight?: boolean
}) {
  return (
    <div className={'flex items-center gap-2 rounded-lg px-2 py-1.5 ' + (highlight ? 'bg-gold/10' : '')}>
      <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div className="flex flex-1 gap-1.5">
        {ORDER.map((wind) => {
          const n = typeof take === 'number' ? take : take[wind]
          return (
            <div
              key={wind}
              className="flex flex-1 flex-col items-center rounded-md border border-ink-line bg-ink px-1 py-1"
            >
              <span className="tile-face text-xs leading-none text-slate-300">
                {WIND_GLYPH[wind]}
              </span>
              <span className="mt-0.5 text-sm font-bold tabular-nums text-gold">+{n}</span>
              {names[wind] ? (
                <span className="max-w-full truncate text-[9px] text-slate-500">
                  {names[wind]}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DealDiagram({
  names = {}, compact = false,
}: {
  names?: Partial<Record<WindPosition, string>>
  compact?: boolean
}) {
  return (
    <div>
      <div className="space-y-1">
        <Row label="Round 1" take={4} names={names} />
        <Row label="Round 2" take={4} names={names} />
        <Row label="Round 3" take={4} names={names} />
        <Row
          label="Last"
          take={{ east: 2, south: 1, west: 1, north: 1 }}
          names={names}
          highlight
        />
      </div>

      <div className="mt-2 flex items-center justify-between rounded-lg bg-ink px-2 py-1.5">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Ends with</span>
        <span className="text-xs text-slate-300">
          <span className="font-bold text-gold">East 14</span>
          {' · '}
          {ORDER.slice(1).map((w) => WIND_LABEL[w]).join(', ')} 13 each
        </span>
      </div>

      {compact ? null : (
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          Every take moves East, South, West, North, and every tile comes from the left of
          the gap. East holds one tile more than everyone else, which is why East discards
          first.
        </p>
      )}
    </div>
  )
}
