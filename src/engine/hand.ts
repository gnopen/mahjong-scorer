/**
 * The hand model shared by both input paths. Photo recognition and the manual
 * tile picker both produce a `HandInput`; nothing downstream can tell which
 * one it came from.
 */

import {
  type TileId, countTiles, isBonus, sortTiles, suitOf, tile,
} from './tiles'

export type MeldKind = 'chow' | 'pung' | 'kong' | 'pair'

export interface Meld {
  kind: MeldKind
  /** Sorted tile ids. A kong carries four ids, a pung three, a pair two. */
  tiles: TileId[]
  /**
   * Concealed melds were completed without claiming a discard. A concealed
   * kong is still concealed even though it is displayed on the table.
   */
  concealed: boolean
  /** True when this meld is the one completed by the winning tile. */
  containsWinningTile?: boolean
}

export type WindPosition = 'east' | 'south' | 'west' | 'north'

export interface HandInput {
  /** Tiles still in hand, including the winning tile. Excludes declared melds. */
  concealed: TileId[]
  /** Melds already exposed or declared on the table. */
  melds: Meld[]
  /** The tile that completed the hand. Must appear in `concealed`. */
  winningTile: TileId
  /** True when the winner drew the winning tile rather than claiming a discard. */
  selfDraw: boolean
  /** Flower and season tiles held by the winner. */
  bonusTiles: TileId[]
  /** Circumstantial flags the photo cannot see. The user sets these. */
  flags: WinFlags
}

export interface WinFlags {
  /** Won on the very last tile drawn from the wall. */
  lastTileDraw: boolean
  /** Won on the very last discard of the hand. */
  lastTileClaim: boolean
  /** Won on the replacement tile drawn after declaring a kong. */
  kongReplacement: boolean
  /** Won by taking the tile a player was adding to a melded pung. */
  robbingKong: boolean
  /** The winning tile was the fourth and last copy visible in play. */
  lastOfItsKind: boolean
}

export const NO_FLAGS: WinFlags = {
  lastTileDraw: false,
  lastTileClaim: false,
  kongReplacement: false,
  robbingKong: false,
  lastOfItsKind: false,
}

export interface GameContext {
  /** Wind of the round. */
  prevalentWind: WindPosition
  /** The winner's seat wind. */
  seatWind: WindPosition
  /** True when the winner was the dealer for this round. */
  winnerIsDealer: boolean
  /** Seat index of the player who discarded the winning tile, or null on a self draw. */
  discarderSeat: number | null
  winnerSeat: number
  playerCount: number
}

export const WIND_TILE: Record<WindPosition, TileId> = {
  east: 'we', south: 'ws', west: 'ww', north: 'wn',
}

/** Every non-bonus tile in the hand, melds included. */
export function allTiles(hand: HandInput): TileId[] {
  return sortTiles([...hand.concealed, ...hand.melds.flatMap((m) => m.tiles)])
}

/** Tile count ignoring the extra tile each kong contributes. */
export function effectiveTileCount(hand: HandInput): number {
  const kongs = hand.melds.filter((m) => m.kind === 'kong').length
  return allTiles(hand).length - kongs
}

export function kongCount(hand: HandInput): number {
  return hand.melds.filter((m) => m.kind === 'kong').length
}

export function concealedKongCount(hand: HandInput): number {
  return hand.melds.filter((m) => m.kind === 'kong' && m.concealed).length
}

export function meldedKongCount(hand: HandInput): number {
  return hand.melds.filter((m) => m.kind === 'kong' && !m.concealed).length
}

/**
 * A hand is concealed when no meld was formed by claiming another player's
 * tile. Concealed kongs do not break concealment.
 */
export function isConcealedHand(hand: HandInput): boolean {
  return hand.melds.every((m) => m.concealed)
}

/** True when every set was claimed from other players and only the pair is own. */
export function isFullyMelded(hand: HandInput): boolean {
  const exposed = hand.melds.filter((m) => !m.concealed)
  return exposed.length === 4 && hand.concealed.length === 2
}

export function suitsUsed(ids: TileId[]): Set<string> {
  const s = new Set<string>()
  for (const id of ids) {
    const su = suitOf(id)
    if (su) s.add(su)
  }
  return s
}

export function hasHonors(ids: TileId[]): boolean {
  return ids.some((id) => tile(id).honor)
}

/** Structural problems that make a hand impossible regardless of rule set. */
export function tileSupplyErrors(hand: HandInput): string[] {
  const errors: string[] = []
  const counts = countTiles([...allTiles(hand), ...hand.bonusTiles])
  for (const [id, n] of counts) {
    const max = isBonus(id) ? 1 : 4
    if (n > max) {
      errors.push(
        isBonus(id)
          ? `There is only one ${id} in the set but the hand claims ${n}.`
          : `A Mahjong set has four copies of each tile but the hand uses ${n} copies of ${id}.`,
      )
    }
  }
  return errors
}

export function emptyHand(): HandInput {
  return {
    concealed: [],
    melds: [],
    winningTile: '',
    selfDraw: false,
    bonusTiles: [],
    flags: { ...NO_FLAGS },
  }
}
