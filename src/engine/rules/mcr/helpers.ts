/** Shared predicates for the Chinese Official rule set. */

import {
  type Suit, type TileId, isDragon, isHonor, isTerminal, isTerminalOrHonor,
  isWind, suitOf, tile,
} from '../../tiles'
import type { ChowInfo, HandView, PungInfo } from '../../view'
import type { RuleHit } from '../types'

export function hit(explanation: string, evidence: TileId[][], points?: number): RuleHit {
  return points === undefined ? { explanation, evidence } : { explanation, evidence, points }
}

export const none: RuleHit[] = []

/** A four-sets-plus-a-pair hand, the only shape most patterns can apply to. */
export function isStandard(v: HandView): boolean {
  return v.structure.type === 'standard'
}

export function setTiles(v: HandView): TileId[][] {
  const g = v.sets.map((s) => s.tiles)
  if (v.pair) g.push(v.pair)
  return g
}

export function wholeHand(v: HandView): TileId[][] {
  return [v.logicalTiles]
}

export function pungsOfSuit(v: HandView, suit: Suit): PungInfo[] {
  return v.pungs.filter((p) => p.suit === suit)
}

export function chowsOfSuit(v: HandView, suit: Suit): ChowInfo[] {
  return v.chows.filter((c) => c.suit === suit)
}

/** All k-sized combinations of an array, order preserved. */
export function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = []
  const walk = (start: number, acc: T[]) => {
    if (acc.length === k) { out.push([...acc]); return }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i])
      walk(i + 1, acc)
      acc.pop()
    }
  }
  walk(0, [])
  return out
}

/** True when the sorted numbers step by a constant `step`. */
export function isArithmetic(nums: number[], step: number): boolean {
  for (let i = 1; i < nums.length; i++) if (nums[i] - nums[i - 1] !== step) return false
  return true
}

export function ranksOf(ids: TileId[]): number[] {
  return ids.map((id) => tile(id).rank)
}

export function everyTileRankIn(v: HandView, allowed: number[]): boolean {
  return v.logicalTiles.every((id) => {
    const t = tile(id)
    return t.suited && allowed.includes(t.rank)
  })
}

/** Every set and the pair contains at least one tile matching the predicate. */
export function everyGroupHas(v: HandView, fn: (id: TileId) => boolean): boolean {
  const groups = setTiles(v)
  return groups.length === 5 && groups.every((g) => g.some(fn))
}

export function isDragonTile(id: TileId): boolean { return isDragon(id) }
export function isWindTile(id: TileId): boolean { return isWind(id) }
export { isHonor, isTerminal, isTerminalOrHonor, suitOf }

/**
 * Picks the best disjoint set of pattern occurrences. Chinese Official scoring
 * forbids reusing the same set in two occurrences of the same pattern, so a
 * pattern that can repeat must greedily claim non-overlapping groups.
 */
export function disjointHits<T>(
  candidates: T[],
  groupsOf: (c: T) => object[],
  toHit: (c: T) => RuleHit,
): RuleHit[] {
  const used = new Set<object>()
  const hits: RuleHit[] = []
  for (const c of candidates) {
    const groups = groupsOf(c)
    if (groups.some((g) => used.has(g))) continue
    groups.forEach((g) => used.add(g))
    hits.push(toHit(c))
  }
  return hits
}
