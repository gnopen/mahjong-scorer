/** Chinese Official patterns worth 8, 6, 4, 2 and 1 point. */

import {
  isDragon, isHonor, isReversible, isSimple, isTerminal, isTerminalOrHonor,
  isWind, tileName,
} from '../../tiles'
import { dragonPungs, type ChowInfo, type PungInfo } from '../../view'
import type { ScoringRule } from '../types'
import {
  combinations, disjointHits, everyGroupHas, hit, isArithmetic, isStandard,
  none, wholeHand,
} from './helpers'

function chowPairs(chows: ChowInfo[]): Array<[ChowInfo, ChowInfo]> {
  return combinations(chows, 2) as Array<[ChowInfo, ChowInfo]>
}

export const LOW_RULES: ScoringRule[] = [
  {
    id: 'mixed_straight',
    guide: 35,
    name: 'Mixed Straight',
    chinese: '花龙',
    points: 8,
    category: 'structure',
    description: '123, 456 and 789 spread one to each suit.',
    evaluate(v) {
      for (const combo of combinations(v.chows, 3)) {
        const starts = combo.map((c) => c.start).sort((a, b) => a - b)
        if (starts.join(',') !== '1,4,7') continue
        if (new Set(combo.map((c) => c.suit)).size !== 3) continue
        return [hit(
          'A 1 to 9 straight assembled across all three suits.',
          combo.map((c) => c.set.tiles),
        )]
      }
      return none
    },
  },
  {
    id: 'reversible_tiles',
    guide: 36,
    name: 'Reversible Tiles',
    chinese: '推不倒',
    points: 8,
    category: 'tiles',
    description:
      'Every tile looks the same upside down: 1234589 Dots, 245689 Bamboo and White Dragon.',
    evaluate(v) {
      if (!v.logicalTiles.every(isReversible)) return none
      return [hit('Every tile in the hand is symmetrical when turned around.', wholeHand(v))]
    },
  },
  {
    id: 'mixed_triple_chow',
    guide: 37,
    name: 'Mixed Triple Chow',
    chinese: '三色三同顺',
    points: 8,
    category: 'structure',
    description: 'The same chow in all three suits.',
    evaluate(v) {
      for (const combo of combinations(v.chows, 3)) {
        if (new Set(combo.map((c) => c.start)).size !== 1) continue
        if (new Set(combo.map((c) => c.suit)).size !== 3) continue
        return [hit(
          'The same three numbers as a chow in Bamboo, Characters and Dots.',
          combo.map((c) => c.set.tiles),
        )]
      }
      return none
    },
  },
  {
    id: 'mixed_shifted_pungs',
    guide: 38,
    name: 'Mixed Shifted Pungs',
    chinese: '三色三节高',
    points: 8,
    category: 'structure',
    description: 'Three pungs of consecutive ranks, one in each suit.',
    evaluate(v) {
      for (const combo of combinations(v.pungs, 3)) {
        if (!combo.every((p) => p.suit)) continue
        if (new Set(combo.map((p) => p.suit)).size !== 3) continue
        const ranks = combo.map((p) => p.rank).sort((a, b) => a - b)
        if (!isArithmetic(ranks, 1)) continue
        return [hit(
          'Three triplets, one per suit, stepping up one rank at a time.',
          combo.map((p) => p.set.tiles),
        )]
      }
      return none
    },
  },
  {
    id: 'last_tile_draw',
    guide: 40,
    name: 'Last Tile Draw',
    chinese: '妙手回春',
    points: 8,
    category: 'timing',
    description: 'Self-drawn on the very last tile of the wall.',
    evaluate(v) {
      if (!v.selfDraw || !v.hand.flags.lastTileDraw) return none
      return [hit('The winning tile was the last tile drawn from the wall.', [[v.hand.winningTile]])]
    },
  },
  {
    id: 'last_tile_claim',
    guide: 41,
    name: 'Tile Claim',
    chinese: '海底捞月',
    points: 8,
    category: 'timing',
    description: 'Won on the final discard of the hand.',
    evaluate(v) {
      if (v.selfDraw || !v.hand.flags.lastTileClaim) return none
      return [hit('The winning tile was the last discard of the hand.', [[v.hand.winningTile]])]
    },
  },
  {
    id: 'out_with_replacement_tile',
    guide: 42,
    name: 'Out with Replacement Tile',
    chinese: '杠上开花',
    points: 8,
    category: 'timing',
    description: 'Won on the replacement tile drawn after declaring a kong.',
    evaluate(v) {
      if (!v.selfDraw || !v.hand.flags.kongReplacement) return none
      return [hit('The winning tile was the replacement drawn after a kong.', [[v.hand.winningTile]])]
    },
  },
  {
    id: 'robbing_the_kong',
    guide: 43,
    name: 'Robbing the Kong',
    chinese: '抢杠和',
    points: 8,
    category: 'timing',
    description: 'Won by taking the tile another player was adding to a melded pung.',
    evaluate(v) {
      if (v.selfDraw || !v.hand.flags.robbingKong) return none
      return [hit(
        'The winning tile was taken from a kong another player was completing.',
        [[v.hand.winningTile]],
      )]
    },
  },
  {
    id: 'two_concealed_kongs',
    guide: 33,
    name: 'Two Concealed Kongs',
    chinese: '双暗杠',
    // The guide scores this at 6, not the 8 used by some published MCR tables.
    // Its own section counts (7 hands at 6 points, 9 at 8) only balance at 6.
    points: 6,
    category: 'sets',
    description: 'Two kongs declared from the hand rather than from a discard.',
    evaluate(v) {
      const k = v.kongs.filter((x) => x.concealed)
      if (k.length < 2) return none
      return [hit('Two kongs were declared from concealed tiles.', k.slice(0, 2).map((x) => x.set.tiles))]
    },
  },

  {
    id: 'all_pungs',
    guide: 28,
    name: 'All Pungs',
    chinese: '碰碰和',
    points: 6,
    category: 'structure',
    description: 'Four pungs or kongs and a pair.',
    evaluate(v) {
      if (!isStandard(v) || v.pungs.length !== 4) return none
      return [hit(
        'The hand is four triplets and a pair, with no chows.',
        v.pungs.map((p) => p.set.tiles),
      )]
    },
  },
  {
    id: 'half_flush',
    guide: 29,
    name: 'Half Flush',
    chinese: '混一色',
    points: 6,
    category: 'suit',
    description: 'One suit plus honors.',
    evaluate(v) {
      if (v.suits.length !== 1 || !v.logicalTiles.some(isHonor)) return none
      return [hit('The hand uses one suit together with winds or dragons.', wholeHand(v))]
    },
  },
  {
    id: 'mixed_shifted_chows',
    guide: 30,
    name: 'Mixed Shifted Chows',
    chinese: '三色三步高',
    points: 6,
    category: 'structure',
    description: 'Three chows, one per suit, each starting one rank above the last.',
    evaluate(v) {
      for (const combo of combinations(v.chows, 3)) {
        if (new Set(combo.map((c) => c.suit)).size !== 3) continue
        const starts = combo.map((c) => c.start).sort((a, b) => a - b)
        if (!isArithmetic(starts, 1)) continue
        return [hit(
          'Three chows, one in each suit, stepping up one rank at a time.',
          combo.map((c) => c.set.tiles),
        )]
      }
      return none
    },
  },
  {
    id: 'all_types',
    guide: 31,
    name: 'All Types',
    chinese: '五门齐',
    points: 6,
    category: 'tiles',
    description: 'All three suits plus a wind and a dragon.',
    evaluate(v) {
      if (v.suits.length !== 3) return none
      if (!v.logicalTiles.some(isWind) || !v.logicalTiles.some(isDragon)) return none
      return [hit(
        'The hand contains Bamboo, Characters, Dots, a wind and a dragon.',
        wholeHand(v),
      )]
    },
  },
  {
    id: 'melded_hand',
    guide: 32,
    name: 'Melded Hand',
    chinese: '全求人',
    points: 6,
    category: 'structure',
    description:
      'All four sets claimed from other players and the pair completed by the winning discard.',
    evaluate(v) {
      if (!v.fullyMelded || v.selfDraw) return none
      if (v.structure.type !== 'standard' || !v.structure.pairIsWinning) return none
      return [hit(
        'Every set was claimed from another player and the pair was completed by the winning discard.',
        v.sets.map((s) => s.tiles),
      )]
    },
  },
  {
    id: 'two_dragon_pungs',
    guide: 34,
    name: 'Two Dragons',
    chinese: '双箭刻',
    points: 6,
    category: 'honors',
    description: 'Pungs or kongs of two different dragons.',
    evaluate(v) {
      const d = dragonPungs(v)
      if (d.length < 2) return none
      return [hit('Triplets of two different dragons.', d.slice(0, 2).map((p) => p.set.tiles))]
    },
  },

  {
    id: 'outside_hand',
    guide: 24,
    name: 'Outside Hand',
    chinese: '全带幺',
    points: 4,
    category: 'tiles',
    description: 'Every set and the pair contains a terminal or an honor.',
    evaluate(v) {
      if (!isStandard(v)) return none
      if (!everyGroupHas(v, isTerminalOrHonor)) return none
      return [hit('Every triplet, chow and the pair includes a terminal or an honor.', wholeHand(v))]
    },
  },
  {
    id: 'fully_concealed_hand',
    guide: 25,
    name: 'Fully Concealed Hand',
    chinese: '不求人',
    points: 4,
    category: 'structure',
    description: 'A concealed hand completed by self-draw.',
    evaluate(v) {
      if (!v.concealedHand || !v.selfDraw) return none
      return [hit('Nothing was claimed from another player and the winning tile was drawn.', wholeHand(v))]
    },
  },
  {
    id: 'two_melded_kongs',
    guide: 26,
    name: 'Two Melded Kongs',
    chinese: '双明杠',
    points: 4,
    category: 'sets',
    description: 'Two kongs formed from claimed tiles.',
    evaluate(v) {
      const k = v.kongs.filter((x) => !x.concealed)
      if (k.length < 2) return none
      return [hit('Two kongs were formed from claimed tiles.', k.slice(0, 2).map((x) => x.set.tiles))]
    },
  },
  {
    id: 'last_tile',
    guide: 27,
    name: 'Last Tile',
    chinese: '和绝张',
    points: 4,
    category: 'timing',
    description: 'The winning tile was the fourth and final copy in play.',
    evaluate(v) {
      if (!v.hand.flags.lastOfItsKind) return none
      return [hit(
        'The other three copies of ' + tileName(v.hand.winningTile) + ' were already visible.',
        [[v.hand.winningTile]],
      )]
    },
  },

  {
    id: 'dragon_pung',
    guide: 14,
    name: 'Dragon Pung',
    chinese: '箭刻',
    points: 2,
    category: 'honors',
    description: 'A pung or kong of dragons.',
    evaluate(v) {
      return dragonPungs(v).map((p) =>
        hit('A triplet of ' + tileName(p.tileId) + '.', [p.set.tiles]),
      )
    },
  },
  {
    id: 'prevalent_wind',
    guide: 15,
    name: 'Pung of Prevalent Wind',
    chinese: '圈风刻',
    points: 2,
    category: 'honors',
    description: 'A pung or kong of the wind of the round.',
    evaluate(v) {
      const p = v.pungs.find((x) => x.tileId === v.prevalentWindTile)
      if (!p) return none
      return [hit(
        'A triplet of ' + tileName(p.tileId) + ', the wind of the round.',
        [p.set.tiles],
      )]
    },
  },
  {
    id: 'seat_wind',
    guide: 16,
    name: 'Pung of Seat Wind',
    chinese: '门风刻',
    points: 2,
    category: 'honors',
    description: 'A pung or kong of the winner’s own seat wind.',
    evaluate(v) {
      const p = v.pungs.find((x) => x.tileId === v.seatWindTile)
      if (!p) return none
      return [hit(
        'A triplet of ' + tileName(p.tileId) + ', the winner’s seat wind.',
        [p.set.tiles],
      )]
    },
  },
  {
    id: 'concealed_hand',
    guide: 17,
    name: 'Concealed Hand',
    chinese: '门前清',
    points: 2,
    category: 'structure',
    description: 'A concealed hand completed on a discard.',
    evaluate(v) {
      if (!v.concealedHand || v.selfDraw) return none
      return [hit('Nothing was claimed before the winning discard.', wholeHand(v))]
    },
  },
  {
    id: 'all_chows',
    guide: 18,
    name: 'All Chows',
    chinese: '平和',
    points: 2,
    category: 'structure',
    description: 'Four chows and a suit-tile pair.',
    evaluate(v) {
      if (!isStandard(v) || v.chows.length !== 4 || !v.pair) return none
      if (isHonor(v.pair[0])) return none
      return [hit(
        'Four chows and a numbered pair, with no triplets and no honors in the pair.',
        [...v.chows.map((c) => c.set.tiles), v.pair],
      )]
    },
  },
  {
    id: 'tile_hog',
    guide: 19,
    name: 'Tile Hog',
    chinese: '四归一',
    points: 2,
    category: 'sets',
    description: 'All four copies of a tile used without declaring a kong.',
    evaluate(v) {
      const kongTiles = new Set(v.kongs.map((k) => k.tileId))
      const hits = []
      for (const [id, n] of v.counts) {
        if (n === 4 && !kongTiles.has(id)) {
          hits.push(hit(
            'All four ' + tileName(id) + ' tiles are used without a kong.',
            [[id, id, id, id]],
          ))
        }
      }
      return hits
    },
  },
  {
    id: 'double_pung',
    guide: 20,
    name: 'Double Pung',
    chinese: '双同刻',
    points: 2,
    category: 'structure',
    description: 'Two pungs of the same number in different suits.',
    evaluate(v) {
      const pairs = (combinations(v.pungs, 2) as Array<[PungInfo, PungInfo]>).filter(
        ([a, b]) => a.suit && b.suit && a.suit !== b.suit && a.rank === b.rank,
      )
      return disjointHits(
        pairs,
        ([a, b]) => [a.set, b.set],
        ([a, b]) => hit(
          'Triplets of ' + a.rank + ' in two different suits.',
          [a.set.tiles, b.set.tiles],
        ),
      )
    },
  },
  {
    id: 'two_concealed_pungs',
    guide: 21,
    name: 'Two Concealed Pungs',
    chinese: '双暗刻',
    points: 2,
    category: 'sets',
    description: 'Two pungs or kongs completed without claiming a discard.',
    evaluate(v) {
      const c = v.pungs.filter((p) => p.concealed)
      if (c.length < 2) return none
      return [hit(
        'Two triplets were completed without claiming a discard.',
        c.slice(0, 2).map((p) => p.set.tiles),
      )]
    },
  },
  {
    id: 'concealed_kong',
    guide: 22,
    name: 'Concealed Kong',
    chinese: '暗杠',
    points: 2,
    category: 'sets',
    description: 'A kong declared from four tiles already in hand.',
    evaluate(v) {
      return v.kongs.filter((k) => k.concealed).map((k) =>
        hit('A concealed kong of ' + tileName(k.tileId) + '.', [k.set.tiles]),
      )
    },
  },
  {
    id: 'all_simples',
    guide: 23,
    name: 'All Simples',
    chinese: '断幺',
    points: 2,
    category: 'tiles',
    description: 'No terminals and no honors.',
    evaluate(v) {
      if (!v.logicalTiles.every(isSimple)) return none
      return [hit('Every tile is a 2 through 8, with no terminals or honors.', wholeHand(v))]
    },
  },

  {
    id: 'pure_double_chow',
    guide: 1,
    name: 'Pure Double Chow',
    chinese: '一般高',
    points: 1,
    category: 'structure',
    description: 'Two identical chows.',
    evaluate(v) {
      const pairs = chowPairs(v.chows).filter(
        ([a, b]) => a.suit === b.suit && a.start === b.start,
      )
      return disjointHits(
        pairs,
        ([a, b]) => [a.set, b.set],
        ([a, b]) => hit('Two identical chows.', [a.set.tiles, b.set.tiles]),
      )
    },
  },
  {
    id: 'mixed_double_chow',
    guide: 2,
    name: 'Mixed Double Chow',
    chinese: '喜相逢',
    points: 1,
    category: 'structure',
    description: 'The same chow in two different suits.',
    evaluate(v) {
      const pairs = chowPairs(v.chows).filter(
        ([a, b]) => a.suit !== b.suit && a.start === b.start,
      )
      return disjointHits(
        pairs,
        ([a, b]) => [a.set, b.set],
        ([a, b]) => hit('The same three numbers as a chow in two suits.', [a.set.tiles, b.set.tiles]),
      )
    },
  },
  {
    id: 'short_straight',
    guide: 3,
    name: 'Short Straight',
    chinese: '连六',
    points: 1,
    category: 'structure',
    description: 'Two chows of the same suit forming six consecutive tiles.',
    evaluate(v) {
      const pairs = chowPairs(v.chows).filter(
        ([a, b]) => a.suit === b.suit && Math.abs(a.start - b.start) === 3,
      )
      return disjointHits(
        pairs,
        ([a, b]) => [a.set, b.set],
        ([a, b]) => hit('Six running tiles of one suit as two chows.', [a.set.tiles, b.set.tiles]),
      )
    },
  },
  {
    id: 'two_terminal_chows',
    guide: 4,
    name: 'Two Terminal Chows',
    chinese: '老少副',
    points: 1,
    category: 'structure',
    description: 'A 123 and a 789 of the same suit.',
    evaluate(v) {
      const pairs = chowPairs(v.chows).filter(
        ([a, b]) => a.suit === b.suit &&
          ((a.start === 1 && b.start === 7) || (a.start === 7 && b.start === 1)),
      )
      return disjointHits(
        pairs,
        ([a, b]) => [a.set, b.set],
        ([a, b]) => hit('A 123 and a 789 in the same suit.', [a.set.tiles, b.set.tiles]),
      )
    },
  },
  {
    id: 'pung_of_terminals_or_honors',
    guide: 5,
    name: 'Pung of Terminals or Honors',
    chinese: '幺九刻',
    points: 1,
    category: 'sets',
    description: 'A pung or kong of 1s, 9s or winds.',
    evaluate(v) {
      return v.pungs
        .filter((p) => isTerminal(p.tileId) || isWind(p.tileId))
        .map((p) => hit('A triplet of ' + tileName(p.tileId) + '.', [p.set.tiles]))
    },
  },
  {
    id: 'melded_kong',
    guide: 6,
    name: 'Melded Kong',
    chinese: '明杠',
    points: 1,
    category: 'sets',
    description: 'A kong formed by claiming a tile.',
    evaluate(v) {
      return v.kongs.filter((k) => !k.concealed).map((k) =>
        hit('A melded kong of ' + tileName(k.tileId) + '.', [k.set.tiles]),
      )
    },
  },
  {
    id: 'one_voided_suit',
    guide: 7,
    name: 'One Voided Suit',
    chinese: '缺一门',
    points: 1,
    category: 'suit',
    description: 'One of the three suits is missing entirely.',
    evaluate(v) {
      if (v.suits.length > 2) return none
      return [hit('The hand uses at most two of the three suits.', wholeHand(v))]
    },
  },
  {
    id: 'no_honors',
    guide: 8,
    name: 'No Honors',
    chinese: '无字',
    points: 1,
    category: 'tiles',
    description: 'The hand contains no winds and no dragons.',
    evaluate(v) {
      if (v.logicalTiles.some(isHonor)) return none
      return [hit('The hand contains no winds and no dragons.', wholeHand(v))]
    },
  },
  {
    id: 'edge_wait',
    guide: 9,
    name: 'Edge Wait',
    chinese: '边张',
    points: 1,
    category: 'wait',
    description:
      'Waiting on the 3 of a 123 or the 7 of a 789, with no other tile able to ' +
      'complete the hand.',
    evaluate(v) {
      if (v.wait !== 'edge' || v.waitBreadth !== 1) return none
      return [hit(
        'The hand was waiting on the closed end of a terminal chow.',
        [[v.hand.winningTile]],
      )]
    },
  },
  {
    id: 'closed_wait',
    guide: 10,
    name: 'Closed Wait',
    chinese: '坎张',
    points: 1,
    category: 'wait',
    description:
      'Waiting on the middle tile of a chow, with no other tile able to complete ' +
      'the hand.',
    evaluate(v) {
      if (v.wait !== 'closed' || v.waitBreadth !== 1) return none
      return [hit('The hand was waiting on the middle tile of a chow.', [[v.hand.winningTile]])]
    },
  },
  {
    id: 'single_wait',
    guide: 11,
    name: 'Single Wait',
    chinese: '单钓将',
    points: 1,
    category: 'wait',
    description:
      'Waiting to pair the last tile, with no other tile able to complete the hand.',
    evaluate(v) {
      if (v.wait !== 'single' || v.waitBreadth !== 1) return none
      return [hit('The hand was waiting to complete the pair.', [[v.hand.winningTile]])]
    },
  },
  {
    id: 'self_drawn',
    guide: 12,
    name: 'Self-Drawn',
    chinese: '自摸',
    points: 1,
    category: 'timing',
    description: 'The winning tile was drawn, not claimed.',
    evaluate(v) {
      if (!v.selfDraw) return none
      return [hit('The winner drew the winning tile.', [[v.hand.winningTile]])]
    },
  },
  {
    id: 'flower_tiles',
    guide: 13,
    name: 'Flower Tiles',
    chinese: '花牌',
    points: 1,
    category: 'bonus',
    description: 'One point per flower or season held.',
    evaluate(v) {
      return v.bonusTiles.map((id) => hit(tileName(id) + ' is a bonus tile.', [[id]]))
    },
  },
]

/**
 * Scored only when nothing else scores, so the scorer applies it after the
 * rest of the table rather than through the normal evaluate path.
 */
export const CHICKEN_HAND: ScoringRule = {
  id: 'chicken_hand',
  guide: 39,
  name: 'Chicken Hand',
  chinese: '无番和',
  points: 8,
  category: 'structure',
  description: 'A legal winning hand that matches no other pattern.',
  evaluate: () => none,
}
