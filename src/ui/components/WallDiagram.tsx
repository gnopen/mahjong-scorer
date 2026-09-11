/**
 * Where the wall gets broken, drawn two ways: the four sides of the square so
 * the table can see whose wall it is, and that side laid out flat so they can
 * count the stacks.
 *
 * Follows the guide: count counter-clockwise from East to pick the side, then
 * count in from the right-hand end of that side to pick the stack. Everything
 * to the right of the gap is the dead wall.
 */

import type { WindPosition } from '../../engine/hand'
import {
  DEAD_WALL_TILES, WIND_GLYPH, WIND_LABEL, wallDiagram, type WallPlan,
} from '../../engine/setup'

const PLACE: Record<WindPosition, string> = {
  north: 'col-start-2 row-start-1',
  west: 'col-start-1 row-start-2',
  east: 'col-start-3 row-start-2',
  south: 'col-start-2 row-start-3',
}

/** The square of four walls, with the chosen side lit up. */
export function WallSquare({
  plan, seatNames,
}: {
  plan: WallPlan
  seatNames: Partial<Record<WindPosition, string>>
}) {
  const order: WindPosition[] = ['east', 'south', 'west', 'north']
  return (
    <div className="grid grid-cols-3 grid-rows-3 place-items-center gap-2">
      <div className="col-start-2 row-start-2 text-center">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">Counted</p>
        <p className="text-2xl font-extrabold tabular-nums text-gold">{plan.countedSides}</p>
        <p className="text-[10px] text-slate-500">sides from East</p>
      </div>
      {order.map((wind) => {
        const chosen = wind === plan.wallWind
        const step = (order.indexOf(wind) + 1)
        return (
          <div key={wind} className={'w-full ' + PLACE[wind]}>
            <div
              className={
                'rounded-xl border px-2 py-2 text-center transition ' +
                (chosen ? 'border-gold bg-gold/15' : 'border-ink-line bg-ink')
              }
            >
              <p className={'tile-face text-lg leading-none ' + (chosen ? 'text-gold' : 'text-slate-300')}>
                {WIND_GLYPH[wind]}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                {WIND_LABEL[wind]}
              </p>
              {seatNames[wind] ? (
                <p className="truncate text-[11px] font-semibold text-slate-200">
                  {seatNames[wind]}
                </p>
              ) : null}
              <p className="mt-0.5 text-[10px] text-slate-600">counts {step}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The chosen side laid flat, always drawn with the physical right-hand end on
 * the right. The numbers under the stacks are what the player counts out loud,
 * which runs the other way when the table counts from the left.
 */
export function WallStrip({ plan }: { plan: WallPlan }) {
  if (plan.breakIndex === null) return null
  const { stacks } = wallDiagram(plan)
  // Drawn right to left so the right-hand end sits on the right of the screen.
  const ordered = [...stacks].reverse()

  return (
    <div>
      <div className="scroll-x items-end gap-[3px]">
        {ordered.map((s) => (
          <div key={s.index} className="flex shrink-0 flex-col items-center gap-1">
            <div
              className={
                'h-12 w-4 rounded-sm border ' +
                (s.role === 'dead'
                  ? 'border-amber-500/70 bg-amber-500/25'
                  : 'border-emerald-600/60 bg-emerald-700/30') +
                (s.isBreak ? ' ring-2 ring-gold' : '')
              }
              title={'Stack ' + s.label + ' counting from the ' + plan.countFrom}
            />
            <span
              className={
                'text-[9px] tabular-nums ' +
                (s.isBreak ? 'font-bold text-gold' : 'text-slate-600')
              }
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-gold bg-gold/30" />
          break here
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-amber-500/70 bg-amber-500/25" />
          dead wall, {DEAD_WALL_TILES} tiles
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-emerald-600/60 bg-emerald-700/30" />
          live wall
        </span>
        <span className="ml-auto">
          {plan.countFrom === 'right'
            ? 'counting from the right \u2192'
            : '\u2190 counting from the left'}
        </span>
      </div>
    </div>
  )
}
