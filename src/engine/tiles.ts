/**
 * Tile model. Pure data, no dependency on any rule set.
 *
 * A tile is identified by a short stable string id so that hands can be
 * serialised into the database, sent to the recognition API and diffed in the
 * UI without any object identity games.
 *
 *   suited   b1..b9  bamboo      c1..c9  characters    d1..d9  dots
 *   winds    we ws ww wn
 *   dragons  dr (red) dg (green) dw (white)
 *   bonus    f1..f4  flowers     s1..s4  seasons
 */

export type Suit = 'b' | 'c' | 'd'
export type HonorGroup = 'w' | 'g'
export type BonusGroup = 'f' | 's'
export type TileGroup = Suit | HonorGroup | BonusGroup

export const SUITS: Suit[] = ['b', 'c', 'd']
export const WINDS = ['we', 'ws', 'ww', 'wn'] as const
export const DRAGONS = ['dr', 'dg', 'dw'] as const

export type Wind = (typeof WINDS)[number]
export type Dragon = (typeof DRAGONS)[number]
export type TileId = string

export interface Tile {
  id: TileId
  group: TileGroup
  /** 1..9 for suited tiles, 1..4 for bonus tiles, 0 for honors. */
  rank: number
  bonus: boolean
  honor: boolean
  suited: boolean
}

const cache = new Map<TileId, Tile>()

const WIND_IDS = new Set<string>(['we', 'ws', 'ww', 'wn'])
const DRAGON_IDS = new Set<string>(['dr', 'dg', 'dw'])

function make(id: TileId): Tile {
  // Dragons are spelled with a leading `d` like the Dots suit, so honors are
  // resolved by exact id before the first character is treated as a suit.
  if (WIND_IDS.has(id)) {
    return { id, group: 'w', rank: 0, bonus: false, honor: true, suited: false }
  }
  if (DRAGON_IDS.has(id)) {
    return { id, group: 'g', rank: 0, bonus: false, honor: true, suited: false }
  }
  const group = id[0] as TileGroup
  const rest = id.slice(1)
  const suited = group === 'b' || group === 'c' || group === 'd'
  const bonus = group === 'f' || group === 's'
  const honor = !suited && !bonus
  const rank = suited || bonus ? Number(rest) : 0
  return { id, group, rank, bonus, honor, suited }
}

/** Every tile id the engine understands, in canonical display order. */
export const ALL_TILE_IDS: TileId[] = [
  ...SUITS.flatMap((s) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${s}${n}`)),
  ...WINDS,
  ...DRAGONS,
  ...[1, 2, 3, 4].map((n) => `f${n}`),
  ...[1, 2, 3, 4].map((n) => `s${n}`),
]

for (const id of ALL_TILE_IDS) cache.set(id, make(id))

export function isTileId(id: string): boolean {
  return cache.has(id)
}

export function tile(id: TileId): Tile {
  const t = cache.get(id)
  if (!t) throw new Error(`Unknown tile id: ${id}`)
  return t
}

/** Tile ids that can appear inside a hand (bonus tiles are tracked separately). */
export const PLAYABLE_TILE_IDS = ALL_TILE_IDS.filter((id) => !tile(id).bonus)

export const BONUS_TILE_IDS = ALL_TILE_IDS.filter((id) => tile(id).bonus)

export function isBonus(id: TileId): boolean {
  return tile(id).bonus
}

export function isHonor(id: TileId): boolean {
  return tile(id).honor
}

export function isWind(id: TileId): boolean {
  return tile(id).group === 'w'
}

export function isDragon(id: TileId): boolean {
  return tile(id).group === 'g'
}

export function isSuited(id: TileId): boolean {
  return tile(id).suited
}

export function isTerminal(id: TileId): boolean {
  const t = tile(id)
  return t.suited && (t.rank === 1 || t.rank === 9)
}

/** Terminal or honor. Called "yaojiu" in the Chinese rules. */
export function isTerminalOrHonor(id: TileId): boolean {
  return isTerminal(id) || isHonor(id)
}

/** A suited tile from 2 to 8. */
export function isSimple(id: TileId): boolean {
  const t = tile(id)
  return t.suited && t.rank >= 2 && t.rank <= 8
}

export function suitOf(id: TileId): Suit | null {
  const t = tile(id)
  return t.suited ? (t.group as Suit) : null
}

/** Tiles used by All Green: 2,3,4,6,8 bamboo and the green dragon. */
const GREEN = new Set(['b2', 'b3', 'b4', 'b6', 'b8', 'dg'])
export function isGreen(id: TileId): boolean {
  return GREEN.has(id)
}

/**
 * Tiles that look the same after a 180 degree rotation, used by Reversible
 * Tiles: 1,2,3,4,5,8,9 dots, 2,4,5,6,8,9 bamboo and the white dragon.
 */
const REVERSIBLE = new Set([
  'd1', 'd2', 'd3', 'd4', 'd5', 'd8', 'd9',
  'b2', 'b4', 'b5', 'b6', 'b8', 'b9',
  'dw',
])
export function isReversible(id: TileId): boolean {
  return REVERSIBLE.has(id)
}

const UNICODE: Record<string, string> = {
  c1: '\u{1F007}', c2: '\u{1F008}', c3: '\u{1F009}', c4: '\u{1F00A}', c5: '\u{1F00B}',
  c6: '\u{1F00C}', c7: '\u{1F00D}', c8: '\u{1F00E}', c9: '\u{1F00F}',
  b1: '\u{1F010}', b2: '\u{1F011}', b3: '\u{1F012}', b4: '\u{1F013}', b5: '\u{1F014}',
  b6: '\u{1F015}', b7: '\u{1F016}', b8: '\u{1F017}', b9: '\u{1F018}',
  d1: '\u{1F019}', d2: '\u{1F01A}', d3: '\u{1F01B}', d4: '\u{1F01C}', d5: '\u{1F01D}',
  d6: '\u{1F01E}', d7: '\u{1F01F}', d8: '\u{1F020}', d9: '\u{1F021}',
  we: '\u{1F000}', ws: '\u{1F001}', ww: '\u{1F002}', wn: '\u{1F003}',
  dr: '\u{1F004}', dg: '\u{1F005}', dw: '\u{1F006}',
  f1: '\u{1F022}', f2: '\u{1F023}', f3: '\u{1F024}', f4: '\u{1F025}',
  s1: '\u{1F026}', s2: '\u{1F027}', s3: '\u{1F028}', s4: '\u{1F029}',
}

export function glyph(id: TileId): string {
  return UNICODE[id] ?? '?'
}

const SUIT_NAME: Record<Suit, string> = { b: 'Bamboo', c: 'Characters', d: 'Dots' }
const HONOR_NAME: Record<string, string> = {
  we: 'East Wind', ws: 'South Wind', ww: 'West Wind', wn: 'North Wind',
  dr: 'Red Dragon', dg: 'Green Dragon', dw: 'White Dragon',
  f1: 'Plum', f2: 'Orchid', f3: 'Chrysanthemum', f4: 'Bamboo Flower',
  s1: 'Spring', s2: 'Summer', s3: 'Autumn', s4: 'Winter',
}

export function tileName(id: TileId): string {
  const t = tile(id)
  if (t.suited) return `${t.rank} ${SUIT_NAME[t.group as Suit]}`
  return HONOR_NAME[id] ?? id
}

export function tileNames(ids: TileId[]): string {
  return ids.map(tileName).join(', ')
}

const ORDER = new Map(ALL_TILE_IDS.map((id, i) => [id, i]))

export function compareTiles(a: TileId, b: TileId): number {
  return (ORDER.get(a) ?? 999) - (ORDER.get(b) ?? 999)
}

export function sortTiles(ids: TileId[]): TileId[] {
  return [...ids].sort(compareTiles)
}

/** Count of each tile id. */
export function countTiles(ids: TileId[]): Map<TileId, number> {
  const m = new Map<TileId, number>()
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1)
  return m
}

/** The tile one rank higher in the same suit, or null. */
export function next(id: TileId): TileId | null {
  const t = tile(id)
  if (!t.suited || t.rank === 9) return null
  return `${t.group}${t.rank + 1}`
}
