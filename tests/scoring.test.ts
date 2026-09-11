import { describe, expect, it } from 'vitest'
import type { GameContext, HandInput } from '../src/engine/hand'
import { NO_FLAGS } from '../src/engine/hand'
import { MCR_RULESET } from '../src/engine/ruleset'
import { score } from '../src/engine/scorer'
import { mcrPayment } from '../src/engine/payments'
import { decompose } from '../src/engine/decompose'

function ids(s: string): string[] {
  return s.trim().split(/\s+/)
}

function hand(partial: Partial<HandInput> & { concealed: string[]; winningTile: string }): HandInput {
  return {
    melds: [],
    selfDraw: false,
    bonusTiles: [],
    flags: { ...NO_FLAGS },
    ...partial,
  }
}

const EAST_EAST: GameContext = {
  prevalentWind: 'east',
  seatWind: 'east',
  winnerIsDealer: true,
  discarderSeat: 1,
  winnerSeat: 0,
  playerCount: 4,
}

function run(h: HandInput, ctx: GameContext = EAST_EAST) {
  const out = score(h, ctx, MCR_RULESET)
  if (!out.valid) throw new Error(out.issues.map((i) => i.message).join(' | '))
  return out.score
}

function ruleTotal(s: ReturnType<typeof run>, id: string): number {
  return s.rules.find((r) => r.ruleId === id)?.total ?? 0
}

describe('tile supply and structure validation', () => {
  it('rejects a hand with five copies of a tile', () => {
    const h = hand({
      concealed: ids('b1 b1 b1 b1 b1 c2 c3 c4 d5 d6 d7 we we we'),
      winningTile: 'we',
    })
    const out = score(h, EAST_EAST, MCR_RULESET)
    expect(out.valid).toBe(false)
    if (!out.valid) expect(out.issues.some((i) => i.code === 'tile_supply')).toBe(true)
  })

  it('rejects tiles that form no winning shape', () => {
    const h = hand({
      concealed: ids('b1 b3 b5 c2 c4 c6 d1 d3 d5 we ws ww dr dg'),
      winningTile: 'dg',
    })
    const out = score(h, EAST_EAST, MCR_RULESET)
    expect(out.valid).toBe(false)
    if (!out.valid) expect(out.issues[0].code).toBe('no_winning_structure')
  })

  it('rejects a hand with the wrong tile count', () => {
    const h = hand({ concealed: ids('b1 b2 b3 c4 c5 c6'), winningTile: 'b3' })
    const out = score(h, EAST_EAST, MCR_RULESET)
    expect(out.valid).toBe(false)
    if (!out.valid) expect(out.issues.some((i) => i.code === 'tile_count')).toBe(true)
  })
})

describe('decomposition', () => {
  it('finds both the chow reading and the pung reading of ambiguous tiles', () => {
    const h = hand({
      concealed: ids('b2 b2 b2 b3 b3 b3 b4 b4 b4 c1 c2 c3 dr dr'),
      winningTile: 'c3',
    })
    const structures = decompose(h)
    const standard = structures.filter((s) => s.type === 'standard')
    expect(standard.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Chinese Official scoring', () => {
  it('scores a plain all-chows hand below the 8 point minimum', () => {
    const s = run(hand({
      concealed: ids('b2 b3 b4 b6 b7 b8 c5 c6 c7 d3 d4 d5 c9 c9'),
      winningTile: 'b4',
    }))
    expect(ruleTotal(s, 'all_chows')).toBe(2)
    expect(ruleTotal(s, 'concealed_hand')).toBe(2)
    expect(ruleTotal(s, 'no_honors')).toBe(1)
    expect(s.handPoints).toBe(5)
    expect(s.meetsMinimum).toBe(false)
  })

  it('scores Big Three Dragons and suppresses the individual dragon pungs', () => {
    const s = run(hand({
      concealed: ids('dr dr dr dg dg dg dw dw dw b2 b3 b4 c5 c5'),
      winningTile: 'b4',
    }))
    expect(ruleTotal(s, 'big_three_dragons')).toBe(88)
    expect(ruleTotal(s, 'dragon_pung')).toBe(0)
    expect(ruleTotal(s, 'two_dragon_pungs')).toBe(0)
    expect(s.suppressed.some((x) => x.ruleId === 'dragon_pung')).toBe(true)
    expect(ruleTotal(s, 'three_concealed_pungs')).toBe(16)
    expect(ruleTotal(s, 'one_voided_suit')).toBe(1)
    expect(s.handPoints).toBe(107)
  })

  it('scores Seven Pairs without also counting Concealed Hand', () => {
    const s = run(hand({
      concealed: ids('b1 b1 b3 b3 b5 b5 c2 c2 c7 c7 d4 d4 dr dr'),
      winningTile: 'dr',
    }))
    expect(ruleTotal(s, 'seven_pairs')).toBe(24)
    expect(ruleTotal(s, 'concealed_hand')).toBe(0)
    expect(ruleTotal(s, 'single_wait')).toBe(0)
    expect(s.handPoints).toBe(24)
  })

  it('scores Thirteen Orphans and absorbs the patterns it contains', () => {
    const s = run(hand({
      concealed: ids('b1 b1 b9 c1 c9 d1 d9 we ws ww wn dr dg dw'),
      winningTile: 'b1',
    }))
    expect(ruleTotal(s, 'thirteen_orphans')).toBe(88)
    expect(ruleTotal(s, 'all_terminals_and_honors')).toBe(0)
    expect(ruleTotal(s, 'all_types')).toBe(0)
    expect(s.handPoints).toBe(88)
  })

  it('scores Four Concealed Pungs over All Pungs', () => {
    const s = run(hand({
      concealed: ids('b1 b1 b1 b5 b5 b5 b9 b9 b9 dr dr dr b3 b3'),
      winningTile: 'b3',
    }))
    expect(ruleTotal(s, 'four_concealed_pungs')).toBe(64)
    expect(ruleTotal(s, 'all_pungs')).toBe(0)
    expect(ruleTotal(s, 'half_flush')).toBe(6)
    expect(ruleTotal(s, 'pung_of_terminals_or_honors')).toBe(2)
    expect(ruleTotal(s, 'dragon_pung')).toBe(2)
    // 111 555 999 red red red and a 3 was also waiting on the 2, as 123 with a
    // pair of 1s, so the wait patterns do not score.
    expect(ruleTotal(s, 'single_wait')).toBe(0)
    expect(s.handPoints).toBe(74)
  })

  it('scores a Full Flush straight and suppresses the contained short straights', () => {
    const s = run(hand({
      concealed: ids('b1 b2 b3 b2 b3 b4 b4 b5 b6 b7 b8 b9 b5 b5'),
      winningTile: 'b3',
    }))
    expect(ruleTotal(s, 'full_flush')).toBe(24)
    expect(ruleTotal(s, 'pure_straight')).toBe(16)
    expect(ruleTotal(s, 'short_straight')).toBe(0)
    expect(ruleTotal(s, 'two_terminal_chows')).toBe(0)
    expect(ruleTotal(s, 'one_voided_suit')).toBe(0)
    expect(ruleTotal(s, 'no_honors')).toBe(0)
  })

  it('scores a Knitted Straight together with All Types', () => {
    const s = run(hand({
      concealed: ids('b1 b4 b7 c2 c5 c8 d3 d6 d9 we we we dr dr'),
      winningTile: 'd9',
      selfDraw: true,
    }), { ...EAST_EAST, discarderSeat: null })
    expect(ruleTotal(s, 'knitted_straight')).toBe(12)
    expect(ruleTotal(s, 'all_types')).toBe(6)
    expect(ruleTotal(s, 'fully_concealed_hand')).toBe(4)
    expect(ruleTotal(s, 'self_drawn')).toBe(0)
    expect(ruleTotal(s, 'seat_wind')).toBe(2)
    expect(ruleTotal(s, 'prevalent_wind')).toBe(2)
  })

  it('scores Greater Honors and Knitted Tiles and absorbs All Types', () => {
    const s = run(hand({
      concealed: ids('we ws ww wn dr dg dw b1 b4 b7 c2 c5 c8 d3'),
      winningTile: 'd3',
    }))
    expect(ruleTotal(s, 'greater_honors_and_knitted_tiles')).toBe(24)
    expect(ruleTotal(s, 'lesser_honors_and_knitted_tiles')).toBe(0)
    expect(ruleTotal(s, 'all_types')).toBe(0)
    expect(s.handPoints).toBe(24)
  })

  it('counts flowers outside the 8 point minimum', () => {
    const s = run(hand({
      concealed: ids('b2 b3 b4 b6 b7 b8 c5 c6 c7 d3 d4 d5 c9 c9'),
      winningTile: 'b4',
      bonusTiles: ids('f1 f2 s1'),
    }))
    expect(s.bonusPoints).toBe(3)
    expect(s.handPoints).toBe(5)
    expect(s.totalPoints).toBe(8)
    expect(s.meetsMinimum).toBe(false)
  })

  it('awards a chicken hand when nothing else scores', () => {
    const s = run(hand({
      concealed: ids('b2 b3 b4 d6 d7 d8 c2 c2 c2 we we'),
      winningTile: 'b4',
      melds: [{ kind: 'chow', tiles: ids('c4 c5 c6'), concealed: false }],
    }))
    expect(s.rules.map((r) => r.ruleId)).toEqual(['chicken_hand'])
    expect(s.handPoints).toBe(8)
    expect(s.meetsMinimum).toBe(true)
  })
})

describe('payment engine', () => {
  const seats = [
    { seat: 0, playerId: 'a', name: 'Thomas', isDealer: true },
    { seat: 1, playerId: 'b', name: 'Andi', isDealer: false },
    { seat: 2, playerId: 'c', name: 'Budi', isDealer: false },
    { seat: 3, playerId: 'd', name: 'Kevin', isDealer: false },
  ]

  it('charges the discarder the score plus base and the others the base', () => {
    const p = mcrPayment.compute({
      handPoints: 24, winnerSeat: 0, discarderSeat: 2, selfDraw: false, seats,
    })
    expect(p.winnerTotal).toBe(48)
    expect(p.lines.find((l) => l.playerId === 'c')!.amount).toBe(-32)
    expect(p.lines.find((l) => l.playerId === 'b')!.amount).toBe(-8)
    expect(p.lines.find((l) => l.playerId === 'd')!.amount).toBe(-8)
    expect(p.lines.reduce((n, l) => n + l.amount, 0)).toBe(0)
  })

  it('charges every player the score plus base on a self draw', () => {
    const p = mcrPayment.compute({
      handPoints: 24, winnerSeat: 0, discarderSeat: null, selfDraw: true, seats,
    })
    expect(p.winnerTotal).toBe(96)
    expect(p.lines.filter((l) => l.amount === -32)).toHaveLength(3)
    expect(p.lines.reduce((n, l) => n + l.amount, 0)).toBe(0)
  })
})
