/**
 * The table seen from above. East sits on the right and the winds run
 * counter-clockwise East, South, West, North, which is the order the guide
 * uses: "they are counted counter-clockwise (ESWN)".
 *
 * The arrows show which way play moves, because that is the thing people get
 * backwards. Used to show who is sitting where now, and where everyone moves
 * next hand.
 */

import type { WindPosition } from '../../engine/hand'
import { WIND_GLYPH, WIND_LABEL, seatWindForHand } from '../../engine/setup'

export interface CompassSeat {
  seat: number
  name: string
  color: string
}

/** Screen position for each wind, so East is on the right. */
const PLACE: Record<WindPosition, string> = {
  north: 'col-start-2 row-start-1',
  west: 'col-start-1 row-start-2',
  east: 'col-start-3 row-start-2',
  south: 'col-start-2 row-start-3',
}

/**
 * Arrows drawn behind the seats. East is right, South is bottom, West is left
 * and North is top, so play runs right, bottom, left, top and the ring turns
 * clockwise on screen even though the winds are counted counter-clockwise.
 */
function PlayArrows() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        {/* userSpaceOnUse keeps the head a fixed size instead of scaling it
            by the stroke width, which makes it far too big. */}
        <marker
          id="compass-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="4.5"
          markerHeight="4.5"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#e9b949" fillOpacity="0.75" />
        </marker>
      </defs>
      {/* east -> south -> west -> north -> east, as four quarter arcs */}
      {[
        'M 78 62 A 30 30 0 0 1 62 78',
        'M 38 78 A 30 30 0 0 1 22 62',
        'M 22 38 A 30 30 0 0 1 38 22',
        'M 62 22 A 30 30 0 0 1 78 38',
      ].map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke="#e9b949"
          strokeOpacity="0.45"
          strokeWidth="1.6"
          strokeLinecap="round"
          markerEnd="url(#compass-arrow)"
        />
      ))}
    </svg>
  )
}

function Seat({
  wind, player, isDealer, moving, prevalent,
}: {
  wind: WindPosition
  player: CompassSeat | undefined
  isDealer: boolean
  moving?: string
  prevalent: boolean
}) {
  return (
    <div className={'relative z-10 flex flex-col items-center gap-1 ' + PLACE[wind]}>
      <div
        className={
          'flex h-14 w-14 flex-col items-center justify-center rounded-xl border text-center transition ' +
          (isDealer
            ? 'border-gold bg-gold/15'
            : prevalent
              ? 'border-sky-400/60 bg-sky-400/10'
              : 'border-ink-line bg-ink')
        }
      >
        <span
          className={
            'tile-face text-xl leading-none ' + (isDealer ? 'text-gold' : 'text-slate-200')
          }
        >
          {WIND_GLYPH[wind]}
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-wide text-slate-500">
          {WIND_LABEL[wind]}
        </span>
      </div>
      {player ? (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-200">
          <span className="h-2 w-2 rounded-full" style={{ background: player.color }} />
          {player.name}
        </span>
      ) : (
        <span className="text-[11px] text-slate-600">empty</span>
      )}
      {isDealer ? (
        <span className="rounded-full bg-gold px-1.5 py-px text-[8px] font-bold uppercase text-ink">
          deals
        </span>
      ) : null}
      {moving ? (
        <span className="text-[10px] text-sky-300">next: {moving}</span>
      ) : null}
    </div>
  )
}

export function Compass({
  seats, handNumber, prevalentWind, showNext = false,
}: {
  seats: CompassSeat[]
  handNumber: number
  prevalentWind: WindPosition
  /** Also label each seat with who will sit there next hand. */
  showNext?: boolean
}) {
  const byWind = (wind: WindPosition, hand: number) =>
    seats.find((s) => seatWindForHand(s.seat, hand) === wind)

  return (
    <div>
      <div className="relative">
        <PlayArrows />
        <div className="relative grid grid-cols-3 grid-rows-3 place-items-center gap-2">
          {/* the table itself */}
          <div className="col-start-2 row-start-2 z-10 flex h-24 w-24 flex-col items-center justify-center rounded-2xl border border-felt/60 bg-felt/25 text-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Hand</span>
            <span className="text-2xl font-extrabold leading-none text-slate-100">
              {handNumber}
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-wider text-sky-300">
              {WIND_LABEL[prevalentWind]} round
            </span>
          </div>

          {(['north', 'west', 'east', 'south'] as WindPosition[]).map((wind) => (
            <Seat
              key={wind}
              wind={wind}
              player={byWind(wind, handNumber)}
              isDealer={wind === 'east'}
              prevalent={wind === prevalentWind}
              moving={showNext ? byWind(wind, handNumber + 1)?.name : undefined}
            />
          ))}
        </div>
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <span className="inline-block h-2 w-4 rounded-full bg-gold/60" />
        Play follows the arrows: East, South, West, North
      </p>
      <p className="mt-1 text-center text-[11px] leading-snug text-slate-500">
        After every hand each wind advances one step the same way: East becomes South,
        South becomes West, West becomes North, and North takes over as the new East
        and deals.
      </p>
    </div>
  )
}
