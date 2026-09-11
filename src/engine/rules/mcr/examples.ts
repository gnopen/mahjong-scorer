/**
 * A worked example hand for every one of the 81 scoring patterns, so the rule
 * table can show what each one actually looks like rather than describing it.
 *
 * Every example is checked by `tests/examples.test.ts`, which builds the hand,
 * decomposes it and asserts that the pattern really does fire. A picture that
 * does not match its rule fails the build.
 *
 * Notation: tiles separated by spaces, groups separated by `/`. Groups are the
 * sets and then the pair, which is also how they are drawn.
 */

import type { WindPosition, WinFlags } from '../../hand'
import type { TileId } from '../../tiles'

export interface RuleExample {
  /** Tile groups: the sets, then the pair. Special hands use their own shape. */
  hand: string
  /** Indices of groups that were claimed from another player. */
  melded?: number[]
  /** Indices of groups declared as a concealed kong. */
  concealedKong?: number[]
  /** The tile that completed the hand. Defaults to the last tile of the hand. */
  winningTile?: TileId
  selfDraw?: boolean
  flags?: Partial<WinFlags>
  prevalentWind?: WindPosition
  seatWind?: WindPosition
  bonusTiles?: TileId[]
  /** One line for anything the picture cannot show. */
  note?: string
}

export function parseExample(example: RuleExample): TileId[][] {
  return example.hand
    .split('/')
    .map((g) => g.trim().split(/\s+/).filter(Boolean))
}

/* ------------------------------------------------------------------ 1 point */

export const MCR_EXAMPLES: Record<string, RuleExample> = {
  pure_double_chow: {
    hand: 'b2 b3 b4 / b2 b3 b4 / c5 c6 c7 / d3 d4 d5 / we we',
  },
  mixed_double_chow: {
    hand: 'b2 b3 b4 / c2 c3 c4 / d5 d6 d7 / c7 c8 c9 / we we',
  },
  short_straight: {
    hand: 'b2 b3 b4 / b5 b6 b7 / c3 c4 c5 / d7 d8 d9 / we we',
  },
  two_terminal_chows: {
    hand: 'b1 b2 b3 / b7 b8 b9 / c3 c4 c5 / d5 d6 d7 / we we',
  },
  pung_of_terminals_or_honors: {
    hand: 'b1 b1 b1 / b5 b6 b7 / c3 c4 c5 / d5 d6 d7 / c9 c9',
  },
  melded_kong: {
    hand: 'c9 c9 c9 c9 / b2 b3 b4 / c3 c4 c5 / d5 d6 d7 / we we',
    melded: [0],
  },
  one_voided_suit: {
    hand: 'b2 b3 b4 / b6 b7 b8 / c3 c4 c5 / c6 c7 c8 / we we',
    note: 'No Dots anywhere in the hand.',
  },
  no_honors: {
    hand: 'b2 b3 b4 / b6 b7 b8 / c3 c4 c5 / d5 d6 d7 / c9 c9',
  },
  edge_wait: {
    hand: 'b1 b2 b3 / c4 c5 c6 / d7 d8 d9 / we we we / c9 c9',
    winningTile: 'b3',
    note: 'Held 1-2 and only the 3 could finish it.',
  },
  closed_wait: {
    hand: 'b3 b4 b5 / c4 c5 c6 / d7 d8 d9 / we we we / c9 c9',
    winningTile: 'b4',
    note: 'Held 3-5 and only the 4 could finish it.',
  },
  single_wait: {
    hand: 'b2 b3 b4 / c4 c5 c6 / d7 d8 d9 / we we we / c9 c9',
    winningTile: 'c9',
    note: 'Waiting to pair the last tile.',
  },
  self_drawn: {
    hand: 'c4 c5 c6 / b2 b3 b4 / d6 d7 d8 / c2 c2 c2 / we we',
    melded: [0],
    selfDraw: true,
    winningTile: 'b4',
  },
  flower_tiles: {
    hand: 'c4 c5 c6 / b2 b3 b4 / d6 d7 d8 / c2 c2 c2 / we we',
    melded: [0],
    winningTile: 'b4',
    bonusTiles: ['f1', 's1'],
    note: 'One point per flower or season, counted outside the minimum.',
  },

  /* --------------------------------------------------------------- 2 points */

  dragon_pung: {
    hand: 'dr dr dr / b2 b3 b4 / c4 c5 c6 / d6 d7 d8 / c9 c9',
  },
  prevalent_wind: {
    hand: 'we we we / b2 b3 b4 / c4 c5 c6 / d6 d7 d8 / c9 c9',
    prevalentWind: 'east',
    note: 'Scored because the round is the East round.',
  },
  seat_wind: {
    hand: 'ws ws ws / b2 b3 b4 / c4 c5 c6 / d6 d7 d8 / c9 c9',
    prevalentWind: 'east',
    seatWind: 'south',
    note: 'Scored because the winner is sitting South.',
  },
  concealed_hand: {
    hand: 'b2 b3 b4 / b6 b7 b8 / c4 c5 c6 / d6 d7 d8 / c9 c9',
    note: 'Nothing claimed, and the winning tile came from a discard.',
  },
  all_chows: {
    hand: 'b2 b3 b4 / b6 b7 b8 / c4 c5 c6 / d6 d7 d8 / c5 c5',
  },
  tile_hog: {
    hand: 'b1 b2 b3 / b3 b4 b5 / c7 c8 c9 / d2 d2 d2 / b3 b3',
    note: 'All four 3 Bamboo are used, and none of them in a kong.',
  },
  double_pung: {
    hand: 'b5 b5 b5 / c5 c5 c5 / d2 d3 d4 / b7 b8 b9 / we we',
  },
  two_concealed_pungs: {
    hand: 'b1 b1 b1 / c5 c5 c5 / d2 d3 d4 / b7 b8 b9 / we we',
    note: 'Neither triplet was claimed from a discard.',
  },
  concealed_kong: {
    hand: 'we we we we / b2 b3 b4 / c4 c5 c6 / d6 d7 d8 / c9 c9',
    concealedKong: [0],
  },
  all_simples: {
    hand: 'b2 b3 b4 / b5 b6 b7 / c4 c5 c6 / d6 d7 d8 / c5 c5',
    note: 'No terminals and no honors.',
  },

  /* --------------------------------------------------------------- 4 points */

  outside_hand: {
    hand: 'b1 b2 b3 / c7 c8 c9 / d1 d2 d3 / we we we / b9 b9',
    note: 'Every set and the pair holds a terminal or an honor.',
  },
  fully_concealed_hand: {
    hand: 'b2 b3 b4 / b6 b7 b8 / c4 c5 c6 / d6 d7 d8 / c9 c9',
    selfDraw: true,
  },
  two_melded_kongs: {
    hand: 'we we we we / ws ws ws ws / b2 b3 b4 / c4 c5 c6 / c9 c9',
    melded: [0, 1],
  },
  last_tile: {
    hand: 'b2 b3 b4 / b6 b7 b8 / c4 c5 c6 / d6 d7 d8 / c9 c9',
    winningTile: 'c9',
    flags: { lastOfItsKind: true },
    note: 'The other three 9 Characters were already on the table.',
  },

  /* --------------------------------------------------------------- 6 points */

  all_pungs: {
    hand: 'b2 b2 b2 / c5 c5 c5 / d7 d7 d7 / we we we / c9 c9',
  },
  half_flush: {
    hand: 'b2 b3 b4 / b6 b7 b8 / b4 b5 b6 / we we we / dr dr',
    note: 'One suit plus honors.',
  },
  mixed_shifted_chows: {
    hand: 'b2 b3 b4 / c3 c4 c5 / d4 d5 d6 / b7 b8 b9 / we we',
  },
  all_types: {
    hand: 'b2 b3 b4 / c4 c5 c6 / d6 d7 d8 / we we we / dr dr',
    note: 'Bamboo, Characters, Dots, a wind and a dragon.',
  },
  melded_hand: {
    hand: 'b2 b3 b4 / c4 c5 c6 / d6 d7 d8 / c2 c2 c2 / we we',
    melded: [0, 1, 2, 3],
    winningTile: 'we',
    note: 'Every set claimed, and the discard completed the pair.',
  },
  two_concealed_kongs: {
    hand: 'we we we we / ws ws ws ws / b2 b3 b4 / c4 c5 c6 / c9 c9',
    concealedKong: [0, 1],
  },
  two_dragon_pungs: {
    hand: 'dr dr dr / dg dg dg / b2 b3 b4 / c4 c5 c6 / we we',
  },

  /* --------------------------------------------------------------- 8 points */

  mixed_straight: {
    hand: 'b1 b2 b3 / c4 c5 c6 / d7 d8 d9 / we we we / c9 c9',
    note: 'A 1 to 9 run built across all three suits.',
  },
  reversible_tiles: {
    hand: 'd1 d2 d3 / d3 d4 d5 / b4 b5 b6 / dw dw dw / d8 d8',
    note: 'Every tile reads the same upside down.',
  },
  mixed_triple_chow: {
    hand: 'b3 b4 b5 / c3 c4 c5 / d3 d4 d5 / b7 b8 b9 / we we',
  },
  mixed_shifted_pungs: {
    hand: 'b2 b2 b2 / c3 c3 c3 / d4 d4 d4 / b7 b8 b9 / we we',
  },
  chicken_hand: {
    hand: 'c4 c5 c6 / b2 b3 b4 / d6 d7 d8 / c2 c2 c2 / we we',
    melded: [0],
    winningTile: 'b4',
    note: 'A legal win that matches no other pattern at all.',
  },
  last_tile_draw: {
    hand: 'b2 b3 b4 / b6 b7 b8 / c4 c5 c6 / d6 d7 d8 / c9 c9',
    selfDraw: true,
    flags: { lastTileDraw: true },
    note: 'Drawn on the very last tile of the wall.',
  },
  last_tile_claim: {
    hand: 'b2 b3 b4 / b6 b7 b8 / c4 c5 c6 / d6 d7 d8 / c9 c9',
    flags: { lastTileClaim: true },
    note: 'Won on the very last discard of the hand.',
  },
  out_with_replacement_tile: {
    hand: 'we we we we / b2 b3 b4 / c4 c5 c6 / d6 d7 d8 / c9 c9',
    concealedKong: [0],
    selfDraw: true,
    flags: { kongReplacement: true },
    note: 'Won on the tile drawn to replace the kong.',
  },
  robbing_the_kong: {
    hand: 'b2 b3 b4 / b6 b7 b8 / c4 c5 c6 / d6 d7 d8 / c9 c9',
    flags: { robbingKong: true },
    note: 'Took the tile another player was adding to a melded pung.',
  },

  /* -------------------------------------------------------------- 12 points */

  lesser_honors_and_knitted_tiles: {
    hand: 'we ws ww wn dr dg / b1 b4 b7 / c2 c5 c8 / d3 d6',
    note: 'Fourteen singles: honors plus one knitted run per suit.',
  },
  knitted_straight: {
    hand: 'b1 b4 b7 c2 c5 c8 d3 d6 d9 / we we we / dr dr',
    note: '1-4-7, 2-5-8 and 3-6-9, one run to each suit.',
  },
  upper_four: {
    hand: 'b6 b7 b8 / c7 c8 c9 / d6 d7 d8 / b7 b8 b9 / c6 c6',
    note: 'Nothing below a 6.',
  },
  lower_four: {
    hand: 'b1 b2 b3 / c2 c3 c4 / d1 d2 d3 / b2 b3 b4 / c4 c4',
    note: 'Nothing above a 4.',
  },
  big_three_winds: {
    hand: 'we we we / ws ws ws / ww ww ww / b2 b3 b4 / c5 c5',
  },

  /* -------------------------------------------------------------- 16 points */

  pure_straight: {
    hand: 'b1 b2 b3 / b4 b5 b6 / b7 b8 b9 / c3 c4 c5 / d7 d7',
  },
  three_suited_terminal_chows: {
    hand: 'b1 b2 b3 / b7 b8 b9 / c1 c2 c3 / c7 c8 c9 / d5 d5',
  },
  pure_shifted_chows: {
    hand: 'b1 b2 b3 / b2 b3 b4 / b3 b4 b5 / c5 c6 c7 / we we',
  },
  all_fives: {
    hand: 'b3 b4 b5 / c4 c5 c6 / d5 d6 d7 / b5 b5 b5 / c5 c5',
    note: 'Every set and the pair contains a 5.',
  },
  triple_pung: {
    hand: 'b5 b5 b5 / c5 c5 c5 / d5 d5 d5 / b2 b3 b4 / we we',
  },
  three_concealed_pungs: {
    hand: 'b1 b1 b1 / c5 c5 c5 / d9 d9 d9 / b2 b3 b4 / we we',
    note: 'None of the three triplets was claimed.',
  },

  /* -------------------------------------------------------------- 24 points */

  seven_pairs: {
    hand: 'b1 b1 / b3 b3 / b5 b5 / c2 c2 / c7 c7 / d4 d4 / dr dr',
  },
  greater_honors_and_knitted_tiles: {
    hand: 'we ws ww wn dr dg dw / b1 b4 b7 / c2 c5 c8 / d3',
    note: 'All seven honors as singles, plus knitted tiles.',
  },
  all_even_pungs: {
    hand: 'b2 b2 b2 / c4 c4 c4 / d6 d6 d6 / b8 b8 b8 / c2 c2',
  },
  full_flush: {
    hand: 'b1 b2 b3 / b4 b5 b6 / b7 b8 b9 / b2 b3 b4 / b5 b5',
  },
  pure_triple_chow: {
    hand: 'b2 b3 b4 / b2 b3 b4 / b2 b3 b4 / c5 c6 c7 / we we',
  },
  pure_shifted_pungs: {
    hand: 'b2 b2 b2 / b3 b3 b3 / b4 b4 b4 / c5 c6 c7 / we we',
  },
  upper_tiles: {
    hand: 'b7 b8 b9 / c7 c8 c9 / d7 d8 d9 / b7 b7 b7 / c8 c8',
    note: 'Only 7s, 8s and 9s.',
  },
  middle_tiles: {
    hand: 'b4 b5 b6 / c4 c5 c6 / d4 d5 d6 / b4 b4 b4 / c5 c5',
    note: 'Only 4s, 5s and 6s.',
  },
  lower_tiles: {
    hand: 'b1 b2 b3 / c1 c2 c3 / d1 d2 d3 / b1 b1 b1 / c2 c2',
    note: 'Only 1s, 2s and 3s.',
  },

  /* -------------------------------------------------------------- 32 points */

  four_pure_shifted_chows: {
    hand: 'b1 b2 b3 / b2 b3 b4 / b3 b4 b5 / b4 b5 b6 / c5 c5',
  },
  three_kongs: {
    hand: 'we we we we / ws ws ws ws / b1 b1 b1 b1 / c4 c5 c6 / d9 d9',
    melded: [0, 1],
    concealedKong: [2],
  },
  all_terminals_and_honors: {
    hand: 'b1 b1 b1 / c9 c9 c9 / we we we / dr dr dr / d1 d1',
  },

  /* -------------------------------------------------------------- 48 points */

  quadruple_chow: {
    hand: 'b2 b3 b4 / b2 b3 b4 / b2 b3 b4 / b2 b3 b4 / c5 c5',
  },
  four_pure_shifted_pungs: {
    hand: 'b2 b2 b2 / b3 b3 b3 / b4 b4 b4 / b5 b5 b5 / c7 c7',
  },

  /* -------------------------------------------------------------- 64 points */

  all_terminals: {
    hand: 'b1 b1 b1 / b9 b9 b9 / c1 c1 c1 / d9 d9 d9 / c9 c9',
  },
  little_four_winds: {
    hand: 'we we we / ws ws ws / ww ww ww / b2 b3 b4 / wn wn',
    note: 'Three wind triplets and a pair of the fourth.',
  },
  little_three_dragons: {
    hand: 'dr dr dr / dg dg dg / b2 b3 b4 / c5 c6 c7 / dw dw',
    note: 'Two dragon triplets and a pair of the third.',
  },
  all_honors: {
    hand: 'we we we / ws ws ws / dr dr dr / dg dg dg / ww ww',
  },
  four_concealed_pungs: {
    hand: 'b1 b1 b1 / b5 b5 b5 / b9 b9 b9 / dr dr dr / c4 c4',
    winningTile: 'c4',
    note: 'No triplet was claimed from a discard.',
  },
  pure_terminal_chows: {
    hand: 'b1 b2 b3 / b1 b2 b3 / b7 b8 b9 / b7 b8 b9 / b5 b5',
  },

  /* -------------------------------------------------------------- 88 points */

  big_four_winds: {
    hand: 'we we we / ws ws ws / ww ww ww / wn wn wn / b2 b2',
  },
  big_three_dragons: {
    hand: 'dr dr dr / dg dg dg / dw dw dw / b2 b3 b4 / c5 c5',
  },
  all_green: {
    hand: 'b2 b2 b2 / b3 b3 b3 / b4 b4 b4 / b6 b6 b6 / b8 b8',
    note: 'Only 2, 3, 4, 6 and 8 Bamboo and the Green Dragon.',
  },
  nine_gates: {
    hand: 'b1 b1 b1 / b2 b3 b4 / b5 b6 b7 / b8 b9 b9 / b9 b5',
    note: '1112345678999 of one suit, concealed, plus any ninth tile.',
  },
  four_kongs: {
    hand: 'we we we we / ws ws ws ws / b1 b1 b1 b1 / c9 c9 c9 c9 / d5 d5',
    melded: [0, 1],
    concealedKong: [2, 3],
  },
  seven_shifted_pairs: {
    hand: 'b1 b1 / b2 b2 / b3 b3 / b4 b4 / b5 b5 / b6 b6 / b7 b7',
  },
  thirteen_orphans: {
    hand: 'b1 b9 c1 c9 d1 d9 / we ws ww wn / dr dg dw / b1',
    note: 'One of each terminal and honor, paired on any one of them.',
  },
}
