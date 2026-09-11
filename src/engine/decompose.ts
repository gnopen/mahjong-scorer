/**
 * Hand decomposition. Turns a `HandInput` into every legal reading of the
 * tiles. Chinese Official scoring is parsing-dependent: the same 14 tiles can
 * often be read as chows or as pungs, and the two readings score differently,
 * so the scorer needs all of them and picks the best.
 */

import {
  type TileId, PLAYABLE_TILE_IDS, SUITS, countTiles, isHonor, isTerminalOrHonor,
  sortTiles, suitOf, tile,
} from './tiles'
import type { HandInput, Meld } from './hand'

export type SetKind = 'chow' | 'pung' | 'kong'

export interface ParsedSet {
  kind: SetKind
  tiles: TileId[]
  /** False when the set was completed by claiming another player's tile. */
  concealed: boolean
  /** True when the winning tile completed this set. */
  winning: boolean
  /** True when the set was already on the table before the win. */
  declared: boolean
}

export type WaitKind = 'edge' | 'closed' | 'single' | 'open' | 'none'

export interface StandardStructure {
  type: 'standard'
  sets: ParsedSet[]
  pair: TileId[]
  pairIsWinning: boolean
  wait: WaitKind
}

export interface KnittedStraightStructure {
  type: 'knitted-straight'
  knitted: TileId[]
  sets: ParsedSet[]
  pair: TileId[]
  pairIsWinning: boolean
  wait: WaitKind
}

export interface SevenPairsStructure {
  type: 'seven-pairs'
  pairs: TileId[][]
  wait: WaitKind
}

export interface ThirteenOrphansStructure {
  type: 'thirteen-orphans'
  tiles: TileId[]
  duplicated: TileId
  wait: WaitKind
}

export interface HonorsKnittedStructure {
  type: 'honors-knitted'
  honors: TileId[]
  knitted: TileId[]
  greater: boolean
  wait: WaitKind
}

export type Structure =
  | StandardStructure
  | KnittedStraightStructure
  | SevenPairsStructure
  | ThirteenOrphansStructure
  | HonorsKnittedStructure

const INDEX = new Map(PLAYABLE_TILE_IDS.map((id, i) => [id, i]))
const N = PLAYABLE_TILE_IDS.length

function toCounts(ids: TileId[]): number[] {
  const counts = new Array<number>(N).fill(0)
  for (const id of ids) {
    const i = INDEX.get(id)
    if (i === undefined) throw new Error('Tile ' + id + ' cannot be part of a hand')
    counts[i]++
  }
  return counts
}

function canChowAt(i: number): boolean {
  const t = tile(PLAYABLE_TILE_IDS[i])
  return t.suited && t.rank <= 7
}

/** All ways to split a tile multiset into exactly `need` chows and pungs. */
function splitIntoSets(counts: number[], need: number): TileId[][][] {
  if (need === 0) return counts.every((c) => c === 0) ? [[]] : []
  const i = counts.findIndex((c) => c > 0)
  if (i < 0) return []

  const out: TileId[][][] = []
  const id = PLAYABLE_TILE_IDS[i]

  if (counts[i] >= 3) {
    counts[i] -= 3
    for (const rest of splitIntoSets(counts, need - 1)) out.push([[id, id, id], ...rest])
    counts[i] += 3
  }

  if (canChowAt(i) && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i]--; counts[i + 1]--; counts[i + 2]--
    const chow = [id, PLAYABLE_TILE_IDS[i + 1], PLAYABLE_TILE_IDS[i + 2]]
    for (const rest of splitIntoSets(counts, need - 1)) out.push([chow, ...rest])
    counts[i]++; counts[i + 1]++; counts[i + 2]++
  }

  return out
}

interface Split {
  sets: TileId[][]
  pair: TileId[]
}

/** All (pair + n sets) splits of a concealed tile multiset. */
function splitWithPair(ids: TileId[], sets: number): Split[] {
  const counts = toCounts(ids)
  const out: Split[] = []
  const seen = new Set<string>()
  for (let i = 0; i < N; i++) {
    if (counts[i] < 2) continue
    counts[i] -= 2
    const pairTile = PLAYABLE_TILE_IDS[i]
    for (const combo of splitIntoSets(counts, sets)) {
      const key = pairTile + '|' + combo.map((s) => s.join('')).sort().join('/')
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ sets: combo, pair: [pairTile, pairTile] })
    }
    counts[i] += 2
  }
  return out
}

function declaredSets(melds: Meld[]): ParsedSet[] {
  return melds
    .filter((m) => m.kind !== 'pair')
    .map((m) => ({
      kind: m.kind as SetKind,
      tiles: sortTiles(m.tiles),
      concealed: m.concealed,
      winning: false,
      declared: true,
    }))
}

function waitFor(set: TileId[] | null, kind: SetKind | 'pair', winningTile: TileId): WaitKind {
  if (kind === 'pair') return 'single'
  if (!set || kind !== 'chow') return 'open'
  const ranks = set.map((t) => tile(t).rank)
  const w = tile(winningTile).rank
  if (w === ranks[1]) return 'closed'
  if (ranks[0] === 1 && ranks[2] === 3 && w === 3) return 'edge'
  if (ranks[0] === 7 && ranks[2] === 9 && w === 7) return 'edge'
  return 'open'
}

/**
 * Every standard four-sets-plus-pair reading, one variant per position the
 * winning tile could occupy, since the wait affects scoring.
 */
function standardStructures(hand: HandInput): StandardStructure[] {
  const fixed = declaredSets(hand.melds)
  const need = 4 - fixed.length
  if (need < 0) return []
  if (hand.concealed.length !== need * 3 + 2) return []

  const out: StandardStructure[] = []
  for (const split of splitWithPair(hand.concealed, need)) {
    const positions: Array<{ setIndex: number | null }> = []
    split.sets.forEach((s, idx) => {
      if (s.includes(hand.winningTile)) positions.push({ setIndex: idx })
    })
    if (split.pair[0] === hand.winningTile) positions.push({ setIndex: null })
    if (positions.length === 0) continue

    const seenVariant = new Set<string>()
    for (const pos of positions) {
      const sets: ParsedSet[] = split.sets.map((s, idx) => {
        const isWinning = pos.setIndex === idx
        const kind: SetKind = s[0] === s[1] ? 'pung' : 'chow'
        // A triplet completed by claiming the winning discard is not concealed.
        const concealed = !(isWinning && kind === 'pung' && !hand.selfDraw)
        return { kind, tiles: sortTiles(s), concealed, winning: isWinning, declared: false }
      })
      const winningSet = pos.setIndex === null ? null : split.sets[pos.setIndex]
      const winningKind: SetKind | 'pair' =
        pos.setIndex === null ? 'pair' : sets[pos.setIndex].kind
      const wait = waitFor(winningSet, winningKind, hand.winningTile)
      const key = sets.map((s) => s.tiles.join('') + s.winning).join('/') + '|' + wait
      if (seenVariant.has(key)) continue
      seenVariant.add(key)
      out.push({
        type: 'standard',
        sets: [...fixed, ...sets],
        pair: split.pair,
        pairIsWinning: pos.setIndex === null,
        wait,
      })
    }
  }
  return out
}

/** The three knitted runs, each of which must sit in a different suit. */
const KNITTED_RUNS = [
  [1, 4, 7],
  [2, 5, 8],
  [3, 6, 9],
]

const SUIT_PERMUTATIONS = [
  ['b', 'c', 'd'], ['b', 'd', 'c'], ['c', 'b', 'd'],
  ['c', 'd', 'b'], ['d', 'b', 'c'], ['d', 'c', 'b'],
] as const

/**
 * Suit assignments under which every suited tile fits the knitted pattern.
 * Returns the full allowed tile set for each workable assignment.
 */
function knittedAssignments(ids: TileId[]): TileId[][] {
  const suited = ids.filter((id) => tile(id).suited)
  const out: TileId[][] = []
  for (const perm of SUIT_PERMUTATIONS) {
    const allowed = new Set<TileId>()
    KNITTED_RUNS.forEach((run, i) => run.forEach((r) => allowed.add(perm[i] + String(r))))
    if (suited.every((id) => allowed.has(id))) out.push([...allowed])
  }
  return out
}

function fullKnittedSets(ids: TileId[]): TileId[][] {
  const present = new Set(ids)
  const out: TileId[][] = []
  for (const perm of SUIT_PERMUTATIONS) {
    const need: TileId[] = []
    KNITTED_RUNS.forEach((run, i) => run.forEach((r) => need.push(perm[i] + String(r))))
    if (need.every((id) => present.has(id))) out.push(need)
  }
  return out
}

function sevenPairsStructures(hand: HandInput): SevenPairsStructure[] {
  if (hand.melds.length > 0 || hand.concealed.length !== 14) return []
  const counts = countTiles(hand.concealed)
  const pairs: TileId[][] = []
  for (const [id, n] of counts) {
    if (n % 2 !== 0) return []
    for (let i = 0; i < n / 2; i++) pairs.push([id, id])
  }
  if (pairs.length !== 7) return []
  pairs.sort((a, b) => a[0].localeCompare(b[0]))
  return [{ type: 'seven-pairs', pairs, wait: 'single' }]
}

function thirteenOrphansStructures(hand: HandInput): ThirteenOrphansStructure[] {
  if (hand.melds.length > 0 || hand.concealed.length !== 14) return []
  if (!hand.concealed.every(isTerminalOrHonor)) return []
  const counts = countTiles(hand.concealed)
  if (counts.size !== 13) return []
  let dup: TileId | null = null
  for (const [id, n] of counts) {
    if (n === 2) dup = id
    else if (n !== 1) return []
  }
  if (!dup) return []
  return [{
    type: 'thirteen-orphans',
    tiles: sortTiles(hand.concealed),
    duplicated: dup,
    wait: 'single',
  }]
}

function honorsKnittedStructures(hand: HandInput): HonorsKnittedStructure[] {
  if (hand.melds.length > 0 || hand.concealed.length !== 14) return []
  const counts = countTiles(hand.concealed)
  if (counts.size !== 14) return []
  const honors = hand.concealed.filter(isHonor)
  const knitted = hand.concealed.filter((id) => tile(id).suited)
  if (knittedAssignments(hand.concealed).length === 0) return []
  return [{
    type: 'honors-knitted',
    honors: sortTiles(honors),
    knitted: sortTiles(knitted),
    greater: honors.length === 7,
    wait: 'single',
  }]
}

/** Knitted straight: the nine knitted tiles plus one ordinary set and a pair. */
function knittedStraightStructures(hand: HandInput): KnittedStraightStructure[] {
  const fixed = declaredSets(hand.melds)
  if (fixed.length > 1) return []
  const out: KnittedStraightStructure[] = []
  for (const knitted of fullKnittedSets(hand.concealed)) {
    const remaining = [...hand.concealed]
    let ok = true
    for (const id of knitted) {
      const i = remaining.indexOf(id)
      if (i < 0) { ok = false; break }
      remaining.splice(i, 1)
    }
    if (!ok) continue
    const need = 1 - fixed.length
    if (remaining.length !== need * 3 + 2) continue
    for (const split of splitWithPair(remaining, need)) {
      const sets: ParsedSet[] = split.sets.map((s) => ({
        kind: (s[0] === s[1] ? 'pung' : 'chow') as SetKind,
        tiles: sortTiles(s),
        concealed: true,
        winning: false,
        declared: false,
      }))
      const inKnitted = knitted.includes(hand.winningTile)
      const pairIsWinning = split.pair[0] === hand.winningTile
      const wait: WaitKind = inKnitted || pairIsWinning ? 'single' : 'open'
      out.push({
        type: 'knitted-straight',
        knitted: sortTiles(knitted),
        sets: [...fixed, ...sets],
        pair: split.pair,
        pairIsWinning,
        wait,
      })
    }
  }
  return out
}

/** Every legal reading of the hand. An empty result means the hand cannot win. */
export function decompose(hand: HandInput): Structure[] {
  if (!hand.winningTile) return []
  if (!hand.concealed.includes(hand.winningTile)) return []
  return [
    ...standardStructures(hand),
    ...knittedStraightStructures(hand),
    ...sevenPairsStructures(hand),
    ...thirteenOrphansStructures(hand),
    ...honorsKnittedStructures(hand),
  ]
}

/** Suits present among the suited tiles of a tile list. */
export function structureSuits(ids: TileId[]): string[] {
  return SUITS.filter((s) => ids.some((id) => suitOf(id) === s))
}
