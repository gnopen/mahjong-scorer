/**
 * A precomputed view over one reading of a hand. Rules read this instead of
 * walking the raw structure, which keeps each rule short enough to check by
 * eye against the published rule text.
 */

import {
  type Suit, type TileId, countTiles, isDragon, isHonor, isWind, sortTiles,
  suitOf, tile,
} from './tiles'
import type { GameContext, HandInput } from './hand'
import { WIND_TILE } from './hand'
import type { ParsedSet, Structure, WaitKind } from './decompose'

export interface ChowInfo {
  set: ParsedSet
  suit: Suit
  /** Rank of the lowest tile. */
  start: number
}

export interface PungInfo {
  set: ParsedSet
  tileId: TileId
  suit: Suit | null
  rank: number
  isKong: boolean
  concealed: boolean
}

export interface HandView {
  hand: HandInput
  ctx: GameContext
  structure: Structure
  /** Every tile in the hand including all four tiles of each kong. */
  tiles: TileId[]
  /** Tiles with each kong reduced to three, so counts read like a 14-tile hand. */
  logicalTiles: TileId[]
  counts: Map<TileId, number>
  sets: ParsedSet[]
  chows: ChowInfo[]
  pungs: PungInfo[]
  kongs: PungInfo[]
  pair: TileId[] | null
  wait: WaitKind
  selfDraw: boolean
  concealedHand: boolean
  fullyMelded: boolean
  suits: Suit[]
  hasHonors: boolean
  seatWindTile: TileId
  prevalentWindTile: TileId
  bonusTiles: TileId[]
  /** Set once during scoring so timing rules can see the whole picture. */
  handTiles: TileId[]
  /**
   * How many different tiles could have completed the hand. The guide makes
   * Edge, Closed and Single Wait invalid "if there are any other waits", so a
   * hand waiting on more than one tile scores none of them.
   */
  waitBreadth: number
}

function chowStart(set: ParsedSet): number {
  return Math.min(...set.tiles.map((t) => tile(t).rank))
}

export function buildView(
  hand: HandInput,
  ctx: GameContext,
  structure: Structure,
  waitBreadth = 1,
): HandView {
  const sets: ParsedSet[] =
    structure.type === 'standard' || structure.type === 'knitted-straight'
      ? structure.sets
      : []

  const pair: TileId[] | null =
    structure.type === 'standard' || structure.type === 'knitted-straight'
      ? structure.pair
      : null

  const tiles = sortTiles([...hand.concealed, ...hand.melds.flatMap((m) => m.tiles)])

  const logical: TileId[] = []
  for (const set of sets) {
    if (set.kind === 'kong') logical.push(set.tiles[0], set.tiles[0], set.tiles[0])
    else logical.push(...set.tiles)
  }
  if (pair) logical.push(...pair)
  if (structure.type === 'knitted-straight') logical.push(...structure.knitted)
  if (structure.type === 'seven-pairs') logical.push(...structure.pairs.flat())
  if (structure.type === 'thirteen-orphans') logical.push(...structure.tiles)
  if (structure.type === 'honors-knitted') {
    logical.push(...structure.honors, ...structure.knitted)
  }

  const chows: ChowInfo[] = sets
    .filter((s) => s.kind === 'chow')
    .map((s) => ({ set: s, suit: suitOf(s.tiles[0]) as Suit, start: chowStart(s) }))

  const pungs: PungInfo[] = sets
    .filter((s) => s.kind === 'pung' || s.kind === 'kong')
    .map((s) => ({
      set: s,
      tileId: s.tiles[0],
      suit: suitOf(s.tiles[0]),
      rank: tile(s.tiles[0]).rank,
      isKong: s.kind === 'kong',
      concealed: s.concealed,
    }))

  const suits = (['b', 'c', 'd'] as Suit[]).filter((s) =>
    logical.some((id) => suitOf(id) === s),
  )

  return {
    hand,
    ctx,
    structure,
    tiles,
    logicalTiles: sortTiles(logical),
    counts: countTiles(logical),
    sets,
    chows,
    pungs,
    kongs: pungs.filter((p) => p.isKong),
    pair,
    wait: structure.wait,
    selfDraw: hand.selfDraw,
    concealedHand: hand.melds.every((m) => m.concealed),
    fullyMelded:
      hand.melds.filter((m) => !m.concealed).length === 4 && hand.concealed.length === 2,
    suits,
    hasHonors: logical.some(isHonor),
    seatWindTile: WIND_TILE[ctx.seatWind],
    prevalentWindTile: WIND_TILE[ctx.prevalentWind],
    bonusTiles: hand.bonusTiles,
    handTiles: tiles,
    waitBreadth,
  }
}

/** Every tile group the hand is built from, used for evidence highlighting. */
export function groupsOf(view: HandView): TileId[][] {
  const g: TileId[][] = view.sets.map((s) => s.tiles)
  if (view.pair) g.push(view.pair)
  if (view.structure.type === 'seven-pairs') return view.structure.pairs
  if (view.structure.type === 'knitted-straight') g.push(view.structure.knitted)
  if (view.structure.type === 'thirteen-orphans') return [view.structure.tiles]
  if (view.structure.type === 'honors-knitted') {
    return [view.structure.honors, view.structure.knitted]
  }
  return g
}

export function dragonPungs(view: HandView): PungInfo[] {
  return view.pungs.filter((p) => isDragon(p.tileId))
}

export function windPungs(view: HandView): PungInfo[] {
  return view.pungs.filter((p) => isWind(p.tileId))
}

/** Groups chows that are identical in suit and starting rank. */
export function identicalChowGroups(view: HandView): ChowInfo[][] {
  const byKey = new Map<string, ChowInfo[]>()
  for (const c of view.chows) {
    const key = c.suit + c.start
    const arr = byKey.get(key) ?? []
    arr.push(c)
    byKey.set(key, arr)
  }
  return [...byKey.values()].filter((a) => a.length >= 2)
}

/** True when every tile in the hand satisfies the predicate. */
export function everyTile(view: HandView, fn: (id: TileId) => boolean): boolean {
  return view.logicalTiles.every(fn)
}
