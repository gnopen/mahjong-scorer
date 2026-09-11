/**
 * Chinese Official (Mahjong Competition Rules, 1998) — all 81 patterns plus
 * the "does not count" table.
 *
 * Values and combinations follow A Guide to Mahjong (Chinese / Official
 * International Rules), the reference this app is checked against. Where the
 * guide states a combination rule in words, its wording is quoted beside the
 * entry so any disagreement can be traced back to a page.
 *
 * Suppression is evidence-scoped. When rule A excludes rule B, only those
 * occurrences of B whose tiles are already covered by A's tiles are dropped.
 * That is what makes Big Three Winds suppress the three wind triplets under
 * Pung of Terminals or Honors while leaving an unrelated triplet of 1 Bamboo
 * scoring on its own.
 */

import type { RuleRelationships, ScoringRule } from '../types'
import { HIGH_RULES } from './high'
import { MID_RULES } from './mid'
import { CHICKEN_HAND, LOW_RULES } from './low'

/**
 * All 81 patterns. Chicken Hand sits in the list so the rule table is complete
 * for the UI, but it can only be awarded by the scorer, which checks it after
 * everything else has been counted.
 */
export const MCR_RULES: ScoringRule[] = [
  ...HIGH_RULES, ...MID_RULES, ...LOW_RULES, CHICKEN_HAND,
]

export { CHICKEN_HAND }

/**
 * Rule id -> ids it suppresses. Entries marked with a leading `*` suppress the
 * target regardless of tile overlap; everything else uses the evidence-subset
 * test described above.
 */
export const MCR_RELATIONSHIPS: RuleRelationships = {
  excludes: {
    // "cannot be combined with All Pungs"
    big_four_winds: [
      'big_three_winds', 'all_pungs', 'prevalent_wind', 'seat_wind',
      'pung_of_terminals_or_honors',
    ],
    // "cannot be combined with Dragon Pung"
    big_three_dragons: ['dragon_pung', 'two_dragon_pungs'],
    // "cannot be combined with Half Flush"
    all_green: ['half_flush'],
    // "cannot be combined with Full Flush or Pung of Terminals or Honors"
    nine_gates: [
      'full_flush', 'concealed_hand', 'no_honors', 'pung_of_terminals_or_honors',
    ],
    four_kongs: [
      'three_kongs', 'two_melded_kongs', 'two_concealed_kongs', 'melded_kong',
      'concealed_kong', 'all_pungs', '*single_wait',
    ],
    // "cannot be combined with Full Flush, Fully Concealed Hand or Single Wait"
    seven_shifted_pairs: [
      'seven_pairs', 'full_flush', 'no_honors', 'concealed_hand',
      '*fully_concealed_hand', '*single_wait',
    ],
    // "cannot be combined with All Types, Concealed Hand or Single Wait"
    thirteen_orphans: [
      'all_terminals_and_honors', 'all_types', 'concealed_hand', '*single_wait',
    ],

    // "cannot be combined with Double Pung or No Honors", plus the patterns
    // the shape structurally contains.
    all_terminals: [
      'all_pungs', 'outside_hand', 'pung_of_terminals_or_honors', 'no_honors',
      'double_pung', 'all_terminals_and_honors',
    ],
    // "implies points for Big Three Winds and can be combined with Prevalent
    // Wind and Seat Wind", so those two keep scoring.
    little_four_winds: ['big_three_winds'],
    // "Points for individual Dragon Pungs may not be added."
    little_three_dragons: ['two_dragon_pungs', 'dragon_pung'],
    all_honors: [
      'all_pungs', 'outside_hand', 'pung_of_terminals_or_honors',
      'all_terminals_and_honors',
    ],
    // "cannot be combined with Fully Concealed Hand or All Pungs"
    four_concealed_pungs: [
      'all_pungs', 'three_concealed_pungs', 'two_concealed_pungs',
      '*concealed_hand', '*fully_concealed_hand',
    ],
    pure_terminal_chows: [
      'full_flush', 'all_chows', 'pure_double_chow', 'two_terminal_chows', 'no_honors',
    ],

    // "implies points for Pure Triple Chow, Tile Hog and Pure Double Chow"
    quadruple_chow: ['pure_triple_chow', 'pure_double_chow', 'tile_hog'],
    four_pure_shifted_pungs: ['all_pungs', 'pure_shifted_pungs'],

    four_pure_shifted_chows: ['pure_shifted_chows', 'short_straight'],
    three_kongs: ['two_melded_kongs', 'two_concealed_kongs'],
    // "implies points for All Pungs and Pung of Terminals or Honors"
    all_terminals_and_honors: [
      'all_pungs', 'outside_hand', 'pung_of_terminals_or_honors',
    ],

    // "cannot be combined with a Concealed Hand or Single Wait"
    seven_pairs: ['concealed_hand', '*single_wait'],
    // "cannot combine this hand with All Types, Concealed Hand or Single Wait"
    greater_honors_and_knitted_tiles: [
      'lesser_honors_and_knitted_tiles', 'all_types', 'concealed_hand', '*single_wait',
    ],
    // "implies points scored for All Pungs and All Simples"
    all_even_pungs: ['all_pungs', 'all_simples'],
    full_flush: ['no_honors', 'one_voided_suit'],
    pure_triple_chow: ['pure_double_chow'],
    upper_tiles: ['no_honors', 'upper_four'],
    middle_tiles: ['no_honors', 'all_simples'],
    lower_tiles: ['no_honors', 'lower_four'],

    pure_straight: ['short_straight', 'two_terminal_chows'],
    three_suited_terminal_chows: [
      'mixed_double_chow', 'two_terminal_chows', 'mixed_straight', 'no_honors',
      'all_chows',
    ],
    all_fives: ['all_simples'],
    triple_pung: ['double_pung'],
    three_concealed_pungs: ['two_concealed_pungs'],

    // "Points for All Types are not added." Fully Concealed Hand may be
    // combined, so it is deliberately absent here.
    lesser_honors_and_knitted_tiles: ['all_types', 'concealed_hand', '*single_wait'],
    upper_four: ['no_honors'],
    lower_four: ['no_honors'],
    big_three_winds: ['pung_of_terminals_or_honors'],

    // Reversible Tiles deliberately has no entry: the guide notes the hand
    // "has one voided suit and scores a point for that also".
    // "This scoring hand is not added to Self-Drawn."
    last_tile_draw: ['*self_drawn'],
    out_with_replacement_tile: ['*self_drawn'],
    // "You cannot add points for Robbing the Kong" on Last Tile, and the guide
    // keeps it apart from Fully Concealed Hand.
    robbing_the_kong: ['*last_tile', '*fully_concealed_hand'],
    two_concealed_kongs: ['concealed_kong'],

    half_flush: ['one_voided_suit'],
    // "all 4 sets are claimed, and the player goes out off another player on a
    // single wait"
    melded_hand: ['*single_wait'],
    two_dragon_pungs: ['dragon_pung'],

    fully_concealed_hand: ['*self_drawn'],
    two_melded_kongs: ['melded_kong'],
  },
}

/** Human-readable reason shown when a pattern is suppressed. */
export function suppressionReason(winnerName: string, loserName: string): string {
  return 'Counted inside ' + winnerName + ', so ' + loserName +
    ' is not scored again. The Chinese Official rules count each pattern once.'
}
