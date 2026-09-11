/**
 * Turns a `RuleExample` into a real `HandInput`, so the same description drives
 * both the picture in the rule table and the test that proves the picture is
 * right.
 */

import type { GameContext, HandInput, Meld, MeldKind } from '../../hand'
import { NO_FLAGS } from '../../hand'
import { sortTiles, type TileId } from '../../tiles'
import { MCR_EXAMPLES, parseExample, type RuleExample } from './examples'

function meldKind(tiles: TileId[]): MeldKind {
  if (tiles.length === 4) return 'kong'
  if (tiles.length === 2) return 'pair'
  return tiles[0] === tiles[2] ? 'pung' : 'chow'
}

export interface BuiltExample {
  hand: HandInput
  ctx: GameContext
  /** The groups as written, for drawing. */
  groups: TileId[][]
  /** Group indices the player never held concealed. */
  meldedGroups: Set<number>
  concealedKongGroups: Set<number>
}

export function buildExample(example: RuleExample): BuiltExample {
  const groups = parseExample(example)
  const melded = new Set(example.melded ?? [])
  const concealedKong = new Set(example.concealedKong ?? [])

  const melds: Meld[] = []
  const concealed: TileId[] = []

  groups.forEach((tiles, i) => {
    if (melded.has(i) || concealedKong.has(i)) {
      melds.push({
        kind: meldKind(tiles),
        tiles: sortTiles(tiles),
        concealed: concealedKong.has(i),
      })
    } else {
      concealed.push(...tiles)
    }
  })

  const winningTile = example.winningTile ?? concealed[concealed.length - 1]

  const hand: HandInput = {
    concealed: sortTiles(concealed),
    melds,
    winningTile,
    selfDraw: example.selfDraw ?? false,
    bonusTiles: example.bonusTiles ?? [],
    flags: { ...NO_FLAGS, ...example.flags },
  }

  const ctx: GameContext = {
    prevalentWind: example.prevalentWind ?? 'east',
    seatWind: example.seatWind ?? 'east',
    winnerIsDealer: (example.seatWind ?? 'east') === 'east',
    discarderSeat: hand.selfDraw ? null : 1,
    winnerSeat: 0,
    playerCount: 4,
  }

  return { hand, ctx, groups, meldedGroups: melded, concealedKongGroups: concealedKong }
}

export function exampleFor(ruleId: string): RuleExample | undefined {
  return MCR_EXAMPLES[ruleId]
}
