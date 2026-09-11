/** Chinese Official patterns worth 24, 16 and 12 points. */

import { isHonor, suitOf, tile } from '../../tiles'
import { identicalChowGroups, windPungs } from '../../view'
import type { ScoringRule } from '../types'
import {
  combinations, everyGroupHas, everyTileRankIn, hit, isArithmetic, isStandard,
  none, wholeHand,
} from './helpers'

const EVEN = [2, 4, 6, 8]

export const MID_RULES: ScoringRule[] = [
  {
    id: 'seven_pairs',
    guide: 55,
    name: 'Seven Pairs',
    chinese: '七对',
    points: 24,
    category: 'structure',
    description: 'Seven pairs, hand fully concealed.',
    evaluate(v) {
      if (v.structure.type !== 'seven-pairs') return none
      return [hit('The hand is seven concealed pairs.', v.structure.pairs)]
    },
  },
  {
    id: 'greater_honors_and_knitted_tiles',
    guide: 56,
    name: 'Greater Honors and Knitted Tiles',
    chinese: '七星不靠',
    points: 24,
    category: 'structure',
    description:
      'All seven honors plus seven single tiles drawn from the knitted 147/258/369 runs.',
    evaluate(v) {
      if (v.structure.type !== 'honors-knitted' || !v.structure.greater) return none
      return [hit(
        'All seven honors as singles plus seven knitted tiles.',
        [v.structure.honors, v.structure.knitted],
      )]
    },
  },
  {
    id: 'all_even_pungs',
    guide: 57,
    name: 'All Even',
    chinese: '全双刻',
    points: 24,
    category: 'tiles',
    description: 'Four pungs of even-numbered suit tiles and an even pair.',
    evaluate(v) {
      if (!isStandard(v) || v.pungs.length !== 4 || !v.pair) return none
      if (!v.pungs.every((p) => p.suit && EVEN.includes(p.rank))) return none
      const pairTile = tile(v.pair[0])
      if (!pairTile.suited || !EVEN.includes(pairTile.rank)) return none
      return [hit(
        'Every triplet and the pair is an even-numbered suit tile.',
        [...v.pungs.map((p) => p.set.tiles), v.pair],
      )]
    },
  },
  {
    id: 'full_flush',
    guide: 58,
    name: 'Full Flush',
    chinese: '清一色',
    points: 24,
    category: 'suit',
    description: 'Every tile belongs to a single suit, with no honors.',
    evaluate(v) {
      if (v.suits.length !== 1) return none
      if (v.logicalTiles.some(isHonor)) return none
      return [hit('Every tile in the hand is from one suit.', wholeHand(v))]
    },
  },
  {
    id: 'pure_triple_chow',
    guide: 59,
    name: 'Pure Triple Chow',
    chinese: '一色三同顺',
    points: 24,
    category: 'structure',
    description: 'Three identical chows.',
    evaluate(v) {
      for (const group of identicalChowGroups(v)) {
        if (group.length >= 3) {
          return [hit(
            'Three of the chows are the same three tiles.',
            group.slice(0, 3).map((c) => c.set.tiles),
          )]
        }
      }
      return none
    },
  },
  {
    id: 'pure_shifted_pungs',
    guide: 60,
    name: 'Pure Shifted Pungs',
    chinese: '一色三节高',
    points: 24,
    category: 'structure',
    description: 'Three pungs of consecutive ranks in one suit.',
    evaluate(v) {
      for (const combo of combinations(v.pungs, 3)) {
        const suit = combo[0].suit
        if (!suit || !combo.every((p) => p.suit === suit)) continue
        const ranks = combo.map((p) => p.rank).sort((a, b) => a - b)
        if (!isArithmetic(ranks, 1)) continue
        return [hit(
          'Three triplets of the same suit stepping up one rank at a time.',
          combo.map((p) => p.set.tiles),
        )]
      }
      return none
    },
  },
  {
    id: 'upper_tiles',
    guide: 61,
    name: 'Upper Tiles',
    chinese: '全大',
    points: 24,
    category: 'tiles',
    description: 'Every tile is a 7, 8 or 9.',
    evaluate(v) {
      if (!everyTileRankIn(v, [7, 8, 9])) return none
      return [hit('Every tile is a 7, 8 or 9.', wholeHand(v))]
    },
  },
  {
    id: 'middle_tiles',
    guide: 62,
    name: 'Middle Tiles',
    chinese: '全中',
    points: 24,
    category: 'tiles',
    description: 'Every tile is a 4, 5 or 6.',
    evaluate(v) {
      if (!everyTileRankIn(v, [4, 5, 6])) return none
      return [hit('Every tile is a 4, 5 or 6.', wholeHand(v))]
    },
  },
  {
    id: 'lower_tiles',
    guide: 63,
    name: 'Lower Tiles',
    chinese: '全小',
    points: 24,
    category: 'tiles',
    description: 'Every tile is a 1, 2 or 3.',
    evaluate(v) {
      if (!everyTileRankIn(v, [1, 2, 3])) return none
      return [hit('Every tile is a 1, 2 or 3.', wholeHand(v))]
    },
  },

  {
    id: 'pure_straight',
    guide: 49,
    name: 'Pure Straight',
    chinese: '清龙',
    points: 16,
    category: 'structure',
    description: 'Chows of 123, 456 and 789 in a single suit.',
    evaluate(v) {
      for (const combo of combinations(v.chows, 3)) {
        const suit = combo[0].suit
        if (!combo.every((c) => c.suit === suit)) continue
        const starts = combo.map((c) => c.start).sort((a, b) => a - b)
        if (starts.join(',') !== '1,4,7') continue
        return [hit(
          'The full 1 to 9 straight in one suit, as 123, 456 and 789.',
          combo.map((c) => c.set.tiles),
        )]
      }
      return none
    },
  },
  {
    id: 'three_suited_terminal_chows',
    guide: 50,
    name: 'Three-Suited Terminal Chows',
    chinese: '三色双龙会',
    points: 16,
    category: 'structure',
    description:
      '123 and 789 in one suit, 123 and 789 in a second, paired on the 5 of the third.',
    evaluate(v) {
      if (!isStandard(v) || v.chows.length !== 4 || !v.pair) return none
      const pairT = tile(v.pair[0])
      if (!pairT.suited || pairT.rank !== 5) return none
      const pairSuit = suitOf(v.pair[0])
      const bySuit = new Map<string, number[]>()
      for (const c of v.chows) {
        const arr = bySuit.get(c.suit) ?? []
        arr.push(c.start)
        bySuit.set(c.suit, arr)
      }
      if (bySuit.size !== 2 || bySuit.has(pairSuit as string)) return none
      for (const starts of bySuit.values()) {
        if (starts.sort((a, b) => a - b).join(',') !== '1,7') return none
      }
      return [hit(
        'A 123 and a 789 in each of two suits, with a pair of 5s in the third.',
        [...v.chows.map((c) => c.set.tiles), v.pair],
      )]
    },
  },
  {
    id: 'pure_shifted_chows',
    guide: 51,
    name: 'Pure Shifted Chows',
    chinese: '一色三步高',
    points: 16,
    category: 'structure',
    description: 'Three chows in one suit shifted evenly by one or by two ranks.',
    evaluate(v) {
      for (const combo of combinations(v.chows, 3)) {
        const suit = combo[0].suit
        if (!combo.every((c) => c.suit === suit)) continue
        const starts = combo.map((c) => c.start).sort((a, b) => a - b)
        const step = isArithmetic(starts, 1) ? 1 : isArithmetic(starts, 2) ? 2 : 0
        if (!step) continue
        return [hit(
          'Three chows of the same suit each starting ' + step +
            (step === 1 ? ' rank' : ' ranks') + ' above the last.',
          combo.map((c) => c.set.tiles),
        )]
      }
      return none
    },
  },
  {
    id: 'all_fives',
    guide: 52,
    name: 'All Fives',
    chinese: '全带五',
    points: 16,
    category: 'tiles',
    description: 'Every set and the pair contains a 5.',
    evaluate(v) {
      if (!isStandard(v)) return none
      if (!everyGroupHas(v, (id) => tile(id).suited && tile(id).rank === 5)) return none
      return [hit('Every triplet, chow and the pair includes a 5.', wholeHand(v))]
    },
  },
  {
    id: 'triple_pung',
    guide: 53,
    name: 'Triple Pung',
    chinese: '三同刻',
    points: 16,
    category: 'structure',
    description: 'Pungs of the same number in all three suits.',
    evaluate(v) {
      for (const combo of combinations(v.pungs, 3)) {
        if (!combo.every((p) => p.suit)) continue
        const ranks = new Set(combo.map((p) => p.rank))
        const suits = new Set(combo.map((p) => p.suit))
        if (ranks.size !== 1 || suits.size !== 3) continue
        return [hit(
          'The same number as a triplet in Bamboo, Characters and Dots.',
          combo.map((p) => p.set.tiles),
        )]
      }
      return none
    },
  },
  {
    id: 'three_concealed_pungs',
    guide: 54,
    name: 'Three Concealed Pungs',
    chinese: '三暗刻',
    points: 16,
    category: 'sets',
    description: 'Three pungs or kongs completed without claiming a discard.',
    evaluate(v) {
      const c = v.pungs.filter((p) => p.concealed)
      if (c.length < 3) return none
      return [hit(
        'Three triplets were completed without claiming a discard.',
        c.slice(0, 3).map((p) => p.set.tiles),
      )]
    },
  },

  {
    id: 'lesser_honors_and_knitted_tiles',
    guide: 44,
    name: 'Lesser Honors and Knitted Tiles',
    chinese: '全不靠',
    points: 12,
    category: 'structure',
    description:
      'Fourteen unpaired tiles: single honors plus tiles from the knitted 147/258/369 runs.',
    evaluate(v) {
      if (v.structure.type !== 'honors-knitted') return none
      return [hit(
        'Fourteen single tiles, all honors unpaired and all suit tiles from the knitted runs.',
        [v.structure.honors, v.structure.knitted],
      )]
    },
  },
  {
    id: 'knitted_straight',
    guide: 45,
    name: 'Knitted Straight',
    chinese: '组合龙',
    points: 12,
    category: 'structure',
    description: '147 of one suit, 258 of another and 369 of the third.',
    evaluate(v) {
      if (v.structure.type !== 'knitted-straight') return none
      return [hit(
        'The nine knitted tiles: 1-4-7, 2-5-8 and 3-6-9, one run per suit.',
        [v.structure.knitted],
      )]
    },
  },
  {
    id: 'upper_four',
    guide: 46,
    name: 'Upper Four',
    chinese: '大于五',
    points: 12,
    category: 'tiles',
    description: 'Every tile is a 6, 7, 8 or 9.',
    evaluate(v) {
      if (!everyTileRankIn(v, [6, 7, 8, 9])) return none
      return [hit('Every tile is greater than 5.', wholeHand(v))]
    },
  },
  {
    id: 'lower_four',
    guide: 47,
    name: 'Lower Four',
    chinese: '小于五',
    points: 12,
    category: 'tiles',
    description: 'Every tile is a 1, 2, 3 or 4.',
    evaluate(v) {
      if (!everyTileRankIn(v, [1, 2, 3, 4])) return none
      return [hit('Every tile is less than 5.', wholeHand(v))]
    },
  },
  {
    id: 'big_three_winds',
    guide: 48,
    name: 'Big Three Winds',
    chinese: '三风刻',
    points: 12,
    category: 'honors',
    description: 'Pungs or kongs of three different winds.',
    evaluate(v) {
      const w = windPungs(v)
      if (w.length < 3) return none
      return [hit(
        'Triplets of three different winds.',
        w.slice(0, 3).map((p) => p.set.tiles),
      )]
    },
  },
]
