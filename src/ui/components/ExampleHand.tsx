/**
 * Draws the worked example for a scoring hand: the sets and the pair, with the
 * winning tile marked and any claimed or declared groups labelled.
 */

import { parseExample, type RuleExample } from '../../engine/rules/mcr/examples'
import { buildExample } from '../../engine/rules/mcr/exampleHand'
import { WIND_LABEL } from '../../engine/setup'
import type { TileId } from '../../engine/tiles'
import { Tile } from './Tile'

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-ink px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </span>
  )
}

export function ExampleHand({ example }: { example: RuleExample }) {
  const groups = parseExample(example)
  const { hand, meldedGroups, concealedKongGroups } = buildExample(example)
  const winning = hand.winningTile

  // Mark only the first copy of the winning tile, scanning the groups in order.
  let winningMarked = false

  const conditions: string[] = []
  if (example.selfDraw) conditions.push('self-drawn')
  if (example.flags?.lastTileDraw) conditions.push('last tile of the wall')
  if (example.flags?.lastTileClaim) conditions.push('last discard')
  if (example.flags?.kongReplacement) conditions.push('kong replacement')
  if (example.flags?.robbingKong) conditions.push('robbed from a kong')
  if (example.flags?.lastOfItsKind) conditions.push('last of its kind')
  if (example.prevalentWind) {
    conditions.push(WIND_LABEL[example.prevalentWind] + ' round')
  }
  if (example.seatWind && example.seatWind !== 'east') {
    conditions.push('sitting ' + WIND_LABEL[example.seatWind])
  }

  return (
    <div className="mt-2 rounded-xl bg-ink/60 p-2">
      {/* Wraps rather than scrolls: this is a reference table, so the whole
          hand should be visible at a glance on a phone. */}
      <div className="flex flex-wrap gap-x-2.5 gap-y-2">
        {groups.map((group: TileId[], gi: number) => (
          <div key={gi} className="flex shrink-0 flex-col items-center gap-1">
            <div className="flex gap-0.5">
              {group.map((id, ti) => {
                const isWin = !winningMarked && id === winning &&
                  !meldedGroups.has(gi) && !concealedKongGroups.has(gi)
                if (isWin) winningMarked = true
                return <Tile key={id + ti} id={id} size="xs" winning={isWin} />
              })}
            </div>
            {meldedGroups.has(gi) ? (
              <Badge>claimed</Badge>
            ) : concealedKongGroups.has(gi) ? (
              <Badge>concealed kong</Badge>
            ) : null}
          </div>
        ))}
      </div>

      {example.bonusTiles && example.bonusTiles.length > 0 ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-wide text-slate-500">bonus</span>
          <div className="flex gap-0.5">
            {example.bonusTiles.map((id) => <Tile key={id} id={id} size="xs" />)}
          </div>
        </div>
      ) : null}

      {conditions.length > 0 ? (
        <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-500">
          {conditions.join(' · ')}
        </p>
      ) : null}

      {example.note ? (
        <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{example.note}</p>
      ) : null}
    </div>
  )
}
