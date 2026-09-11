/** Chinese Official patterns worth 88, 64, 48 and 32 points. */

import {
  isDragon, isGreen, isHonor, isTerminal, isTerminalOrHonor, isWind, suitOf, tile,
} from '../../tiles'
import { dragonPungs, windPungs } from '../../view'
import type { ScoringRule } from '../types'
import { hit, isArithmetic, isStandard, none, wholeHand } from './helpers'

const NINE_GATES_SHAPE = [3, 1, 1, 1, 1, 1, 1, 1, 3]

export const HIGH_RULES: ScoringRule[] = [
  {
    id: 'big_four_winds',
    guide: 75,
    name: 'Big Four Winds',
    chinese: '大四喜',
    points: 88,
    category: 'honors',
    description: 'Pungs or kongs of all four winds.',
    evaluate(v) {
      const w = windPungs(v)
      if (w.length !== 4) return none
      return [hit(
        'The hand holds a pung or kong of East, South, West and North.',
        w.map((p) => p.set.tiles),
      )]
    },
  },
  {
    id: 'big_three_dragons',
    guide: 76,
    name: 'Big Three Dragons',
    chinese: '大三元',
    points: 88,
    category: 'honors',
    description: 'Pungs or kongs of all three dragons.',
    evaluate(v) {
      const d = dragonPungs(v)
      if (d.length !== 3) return none
      return [hit(
        'The hand holds a pung or kong of the Red, Green and White Dragon.',
        d.map((p) => p.set.tiles),
      )]
    },
  },
  {
    id: 'all_green',
    guide: 77,
    name: 'All Green',
    chinese: '绿一色',
    points: 88,
    category: 'tiles',
    description: 'Every tile is 2, 3, 4, 6 or 8 Bamboo or the Green Dragon.',
    evaluate(v) {
      if (!v.logicalTiles.every(isGreen)) return none
      return [hit(
        'Every tile is one of the all-green tiles: 2, 3, 4, 6 and 8 Bamboo and the Green Dragon.',
        wholeHand(v),
      )]
    },
  },
  {
    id: 'nine_gates',
    guide: 78,
    name: 'Nine Gates',
    chinese: '九莲宝灯',
    points: 88,
    category: 'structure',
    description:
      'A fully concealed single-suit hand holding 1112345678999 plus one more tile of that suit.',
    evaluate(v) {
      if (v.hand.melds.length > 0) return none
      const ids = v.hand.concealed
      if (ids.length !== 14) return none
      const suit = suitOf(ids[0])
      if (!suit || !ids.every((id) => suitOf(id) === suit)) return none
      const counts = new Array(9).fill(0)
      for (const id of ids) counts[tile(id).rank - 1]++
      let extra = 0
      for (let i = 0; i < 9; i++) {
        const diff = counts[i] - NINE_GATES_SHAPE[i]
        if (diff < 0) return none
        extra += diff
      }
      if (extra !== 1) return none
      return [hit(
        'A concealed hand of one suit holding 1112345678999 and a ninth-gate tile.',
        wholeHand(v),
      )]
    },
  },
  {
    id: 'four_kongs',
    guide: 79,
    name: 'Four Kongs',
    chinese: '四杠',
    points: 88,
    category: 'sets',
    description: 'Four kongs.',
    evaluate(v) {
      if (v.kongs.length !== 4) return none
      return [hit('All four sets are kongs.', v.kongs.map((k) => k.set.tiles))]
    },
  },
  {
    id: 'seven_shifted_pairs',
    guide: 80,
    name: 'Seven Shifted Pairs',
    chinese: '连七对',
    points: 88,
    category: 'structure',
    description: 'Seven pairs of consecutive ranks in a single suit.',
    evaluate(v) {
      if (v.structure.type !== 'seven-pairs') return none
      const firsts = v.structure.pairs.map((p) => p[0])
      const suit = suitOf(firsts[0])
      if (!suit || !firsts.every((id) => suitOf(id) === suit)) return none
      const ranks = firsts.map((id) => tile(id).rank).sort((a, b) => a - b)
      if (!isArithmetic(ranks, 1)) return none
      return [hit(
        'Seven pairs running consecutively through one suit.',
        v.structure.pairs,
      )]
    },
  },
  {
    id: 'thirteen_orphans',
    guide: 81,
    name: 'Thirteen Orphans',
    chinese: '十三幺',
    points: 88,
    category: 'structure',
    description:
      'One of each terminal and honor, plus a second copy of any one of them.',
    evaluate(v) {
      if (v.structure.type !== 'thirteen-orphans') return none
      return [hit(
        'All thirteen terminals and honors, paired on one of them.',
        [v.structure.tiles],
      )]
    },
  },

  {
    id: 'all_terminals',
    guide: 69,
    name: 'All Terminals',
    chinese: '清幺九',
    points: 64,
    category: 'tiles',
    description: 'Every tile is a 1 or a 9. No honors.',
    evaluate(v) {
      if (!v.logicalTiles.every(isTerminal)) return none
      return [hit('Every tile in the hand is a terminal, a 1 or a 9.', wholeHand(v))]
    },
  },
  {
    id: 'little_four_winds',
    guide: 70,
    name: 'Little Four Winds',
    chinese: '小四喜',
    points: 64,
    category: 'honors',
    description: 'Pungs of three winds plus a pair of the fourth.',
    evaluate(v) {
      const w = windPungs(v)
      if (w.length !== 3 || !v.pair || !isWind(v.pair[0])) return none
      return [hit(
        'Three wind pungs and a pair of the remaining wind.',
        [...w.map((p) => p.set.tiles), v.pair],
      )]
    },
  },
  {
    id: 'little_three_dragons',
    guide: 71,
    name: 'Little Three Dragons',
    chinese: '小三元',
    points: 64,
    category: 'honors',
    description: 'Pungs of two dragons plus a pair of the third.',
    evaluate(v) {
      const d = dragonPungs(v)
      if (d.length !== 2 || !v.pair || !isDragon(v.pair[0])) return none
      return [hit(
        'Two dragon pungs and a pair of the third dragon.',
        [...d.map((p) => p.set.tiles), v.pair],
      )]
    },
  },
  {
    id: 'all_honors',
    guide: 72,
    name: 'All Honors',
    chinese: '字一色',
    points: 64,
    category: 'honors',
    description: 'Every tile is a wind or a dragon.',
    evaluate(v) {
      if (!v.logicalTiles.every(isHonor)) return none
      return [hit('The hand is built entirely from winds and dragons.', wholeHand(v))]
    },
  },
  {
    id: 'four_concealed_pungs',
    guide: 73,
    name: 'Four Concealed Pungs',
    chinese: '四暗刻',
    points: 64,
    category: 'sets',
    description: 'Four pungs or kongs, none of them claimed from a discard.',
    evaluate(v) {
      const c = v.pungs.filter((p) => p.concealed)
      if (v.pungs.length !== 4 || c.length !== 4) return none
      return [hit(
        'All four triplets were completed without claiming a discard.',
        c.map((p) => p.set.tiles),
      )]
    },
  },
  {
    id: 'pure_terminal_chows',
    guide: 74,
    name: 'Pure Terminal Chows',
    chinese: '一色双龙会',
    points: 64,
    category: 'structure',
    description: 'Two 123 chows and two 789 chows in one suit, paired on the 5.',
    evaluate(v) {
      if (!isStandard(v) || v.chows.length !== 4 || !v.pair) return none
      const suit = v.chows[0].suit
      if (!v.chows.every((c) => c.suit === suit)) return none
      if (suitOf(v.pair[0]) !== suit || tile(v.pair[0]).rank !== 5) return none
      const starts = v.chows.map((c) => c.start).sort((a, b) => a - b)
      if (starts.join(',') !== '1,1,7,7') return none
      return [hit(
        'Two 1-2-3 chows and two 7-8-9 chows of the same suit with a pair of 5s.',
        [...v.chows.map((c) => c.set.tiles), v.pair],
      )]
    },
  },

  {
    id: 'quadruple_chow',
    guide: 67,
    name: 'Quadruple Chow',
    chinese: '一色四同顺',
    points: 48,
    category: 'structure',
    description: 'Four identical chows.',
    evaluate(v) {
      if (v.chows.length !== 4) return none
      const { suit, start } = v.chows[0]
      if (!v.chows.every((c) => c.suit === suit && c.start === start)) return none
      return [hit('All four chows are the same three tiles.', v.chows.map((c) => c.set.tiles))]
    },
  },
  {
    id: 'four_pure_shifted_pungs',
    guide: 68,
    name: 'Four Pure Shifted Pungs',
    chinese: '一色四节高',
    points: 48,
    category: 'structure',
    description: 'Four pungs of consecutive ranks in one suit.',
    evaluate(v) {
      if (v.pungs.length !== 4) return none
      const suit = v.pungs[0].suit
      if (!suit || !v.pungs.every((p) => p.suit === suit)) return none
      const ranks = v.pungs.map((p) => p.rank).sort((a, b) => a - b)
      if (!isArithmetic(ranks, 1)) return none
      return [hit(
        'Four triplets of the same suit stepping up one rank at a time.',
        v.pungs.map((p) => p.set.tiles),
      )]
    },
  },

  {
    id: 'four_pure_shifted_chows',
    guide: 64,
    name: 'Four Shifted Chows',
    chinese: '一色四步高',
    points: 32,
    category: 'structure',
    description: 'Four chows in one suit shifted evenly by one or by two ranks.',
    evaluate(v) {
      if (v.chows.length !== 4) return none
      const suit = v.chows[0].suit
      if (!v.chows.every((c) => c.suit === suit)) return none
      const starts = v.chows.map((c) => c.start).sort((a, b) => a - b)
      const step = isArithmetic(starts, 1) ? 1 : isArithmetic(starts, 2) ? 2 : 0
      if (!step) return none
      return [hit(
        'Four chows of the same suit each starting ' + step +
          (step === 1 ? ' rank' : ' ranks') + ' above the last.',
        v.chows.map((c) => c.set.tiles),
      )]
    },
  },
  {
    id: 'three_kongs',
    guide: 65,
    name: 'Three Kongs',
    chinese: '三杠',
    points: 32,
    category: 'sets',
    description: 'Three kongs.',
    evaluate(v) {
      if (v.kongs.length !== 3) return none
      return [hit('Three of the four sets are kongs.', v.kongs.map((k) => k.set.tiles))]
    },
  },
  {
    id: 'all_terminals_and_honors',
    guide: 66,
    name: 'All Terminals and Honors',
    chinese: '混幺九',
    points: 32,
    category: 'tiles',
    description: 'Every tile is a terminal or an honor, with at least one honor.',
    evaluate(v) {
      if (!v.logicalTiles.every(isTerminalOrHonor)) return none
      if (!v.logicalTiles.some(isHonor)) return none
      return [hit(
        'Every set and the pair is made of terminals or honors.',
        wholeHand(v),
      )]
    },
  },
]
