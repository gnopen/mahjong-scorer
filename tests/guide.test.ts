/**
 * Conformance with A Guide to Mahjong (Chinese / Official International Rules).
 * Each test names the wording it is checking, so a future change to the rule
 * table has to argue with the guide rather than with the code.
 */

import { describe, expect, it } from 'vitest'
import type { GameContext, HandInput } from '../src/engine/hand'
import { NO_FLAGS } from '../src/engine/hand'
import { MCR_RULESET, ruleSetFor } from '../src/engine/ruleset'
import { score } from '../src/engine/scorer'
import { falseDeclarationPayment } from '../src/engine/payments'

function ids(s: string): string[] {
  return s.trim().split(/\s+/)
}

function hand(p: Partial<HandInput> & { concealed: string[]; winningTile: string }): HandInput {
  return { melds: [], selfDraw: false, bonusTiles: [], flags: { ...NO_FLAGS }, ...p }
}

const EAST: GameContext = {
  prevalentWind: 'east', seatWind: 'east', winnerIsDealer: true,
  discarderSeat: 1, winnerSeat: 0, playerCount: 4,
}

function run(h: HandInput, ctx: GameContext = EAST) {
  const out = score(h, ctx, MCR_RULESET)
  if (!out.valid) throw new Error(out.issues.map((i) => i.message).join(' | '))
  return out.score
}

function total(s: ReturnType<typeof run>, id: string): number {
  return s.rules.find((r) => r.ruleId === id)?.total ?? 0
}

describe('the rule table matches the guide', () => {
  it('carries all 81 hands with the guide numbering, 1 to 81', () => {
    const numbers = MCR_RULESET.rules.map((r) => r.guide).sort((a, b) => a - b)
    expect(numbers).toHaveLength(81)
    expect(numbers).toEqual(Array.from({ length: 81 }, (_, i) => i + 1))
  })

  it('uses the point distribution the guide prints', () => {
    const counts = new Map<number, number>()
    for (const r of MCR_RULESET.rules) {
      counts.set(r.points, (counts.get(r.points) ?? 0) + 1)
    }
    expect(Object.fromEntries([...counts].sort((a, b) => a[0] - b[0]))).toEqual({
      1: 13, 2: 10, 4: 4, 6: 7, 8: 9, 12: 5,
      16: 6, 24: 9, 32: 3, 48: 2, 64: 6, 88: 7,
    })
  })

  it('scores Two Concealed Kongs at 6, as the guide table does', () => {
    const rule = MCR_RULESET.rules.find((r) => r.id === 'two_concealed_kongs')
    expect(rule?.points).toBe(6)
    expect(rule?.guide).toBe(33)
  })

  it('lets Little Four Winds combine with Prevalent Wind and Seat Wind', () => {
    // "implies points for Big Three Winds and can be combined with Prevalent
    // Wind and Seat Wind"
    const s = run(hand({
      concealed: ids('we we we ws ws ws ww ww ww b2 b3 b4 wn wn'),
      winningTile: 'b4',
    }))
    expect(total(s, 'little_four_winds')).toBe(64)
    expect(total(s, 'big_three_winds')).toBe(0)
    expect(total(s, 'prevalent_wind')).toBe(2)
    expect(total(s, 'seat_wind')).toBe(2)
  })

  it('keeps Four Concealed Pungs apart from Fully Concealed Hand', () => {
    // "cannot be combined with Fully Concealed Hand or All Pungs"
    const s = run(hand({
      concealed: ids('b1 b1 b1 b5 b5 b5 b9 b9 b9 dr dr dr c4 c4'),
      winningTile: 'c4',
      selfDraw: true,
    }), { ...EAST, discarderSeat: null })
    expect(total(s, 'four_concealed_pungs')).toBe(64)
    expect(total(s, 'fully_concealed_hand')).toBe(0)
    expect(total(s, 'all_pungs')).toBe(0)
    expect(total(s, 'self_drawn')).toBe(1)
  })

  it('scores One Voided Suit alongside Reversible Tiles', () => {
    // "The hand thus has one voided suit and scores a point for that also."
    const s = run(hand({
      concealed: ids('d1 d2 d3 d3 d4 d5 b4 b5 b6 dw dw dw d8 d8'),
      winningTile: 'd5',
    }))
    expect(total(s, 'reversible_tiles')).toBe(8)
    expect(total(s, 'one_voided_suit')).toBe(1)
  })

  it('voids the wait patterns when more than one tile could finish the hand', () => {
    // "This scoring hand is invalid if there are any other waits."
    // Holding 3-3-4-5 in characters, both the 3 and the 6 finish the hand, so
    // going out on the 3 is not a Single Wait even though it pairs the head.
    const broad = run(hand({
      concealed: ids('b2 b3 b4 d5 d6 d7 we we we c3 c3 c3 c4 c5'),
      winningTile: 'c3',
    }))
    expect(total(broad, 'single_wait')).toBe(0)
    expect(total(broad, 'closed_wait')).toBe(0)
    expect(total(broad, 'edge_wait')).toBe(0)

    const narrow = run(hand({
      concealed: ids('b1 b2 b3 c4 c5 c6 d7 d8 d9 we we we c9 c9'),
      winningTile: 'b3',
    }))
    // 1-2 in bamboo could only ever be finished by the 3.
    expect(total(narrow, 'edge_wait')).toBe(1)
  })

  it('treats a self-drawn no-pattern hand as one point, not a chicken hand', () => {
    // Chicken Hand is "a hand that should earn zero points", and Self-Drawn is
    // itself a scoring hand, so the two cannot both apply.
    const s = run(hand({
      concealed: ids('b2 b3 b4 d6 d7 d8 c2 c2 c2 we we'),
      winningTile: 'b4',
      melds: [{ kind: 'chow', tiles: ids('c4 c5 c6'), concealed: false }],
      selfDraw: true,
    }), { ...EAST, discarderSeat: null })
    expect(total(s, 'chicken_hand')).toBe(0)
    expect(total(s, 'self_drawn')).toBe(1)
    expect(s.handPoints).toBe(1)
    expect(s.meetsMinimum).toBe(false)
  })
})

describe('payments match the guide worked examples', () => {
  const seats = [
    { seat: 0, playerId: 'a', name: 'A', isDealer: true },
    { seat: 1, playerId: 'b', name: 'B', isDealer: false },
    { seat: 2, playerId: 'c', name: 'C', isDealer: false },
    { seat: 3, playerId: 'd', name: 'D', isDealer: false },
  ]

  it('pays 36 for a 12 point hand won on a discard', () => {
    // "8 + 8 + 8 = 24 points + 12 points from the discarder for a grand total of 36"
    const p = MCR_RULESET.payment.compute({
      handPoints: 12, winnerSeat: 0, discarderSeat: 2, selfDraw: false, seats,
    })
    expect(p.winnerTotal).toBe(36)
    expect(p.lines.find((l) => l.playerId === 'c')!.amount).toBe(-20)
  })

  it('pays 60 for a 12 point hand won self-drawn', () => {
    // "add 8 points to the hand for a revised total of 20, and will receive 20 + 20 + 20 = 60"
    const p = MCR_RULESET.payment.compute({
      handPoints: 12, winnerSeat: 0, discarderSeat: null, selfDraw: true, seats,
    })
    expect(p.winnerTotal).toBe(60)
    expect(p.lines.filter((l) => l.amount === -20)).toHaveLength(3)
  })

  it('charges 30 points for declaring below the minimum', () => {
    // "a penalty of 30 points (10 points to each player)"
    expect(MCR_RULESET.falseDeclaration).toEqual({ enabled: true, perPlayer: 10 })
    const p = falseDeclarationPayment(10).compute({
      handPoints: 0, winnerSeat: 0, discarderSeat: null, selfDraw: false, seats,
    })
    expect(p.lines.find((l) => l.playerId === 'a')!.amount).toBe(-30)
    expect(p.lines.filter((l) => l.amount === 10)).toHaveLength(3)
    expect(p.lines.reduce((n, l) => n + l.amount, 0)).toBe(0)
  })
})

describe('the minimum is a house rule, not a fixture', () => {
  it('defaults the rule set to the guide figure of 8', () => {
    expect(MCR_RULESET.minimumPoints).toBe(8)
  })

  it('lets a game play with no minimum at all', () => {
    const house = ruleSetFor('mcr', 0)
    const s = score(hand({
      // A plain all-chows hand worth 5 points, short of the guide's 8.
      concealed: ids('b2 b3 b4 b6 b7 b8 c5 c6 c7 d3 d4 d5 c9 c9'),
      winningTile: 'b4',
    }), EAST, house)
    if (!s.valid) throw new Error('should be a legal hand')
    expect(s.score.handPoints).toBe(5)
    expect(s.score.minimumPoints).toBe(0)
    expect(s.score.meetsMinimum).toBe(true)
  })

  it('still marks the same hand short when the table plays the guide minimum', () => {
    const strict = ruleSetFor('mcr', 8)
    const s = score(hand({
      concealed: ids('b2 b3 b4 b6 b7 b8 c5 c6 c7 d3 d4 d5 c9 c9'),
      winningTile: 'b4',
    }), EAST, strict)
    if (!s.valid) throw new Error('should be a legal hand')
    expect(s.score.meetsMinimum).toBe(false)
  })

  it('reuses one rule-set object per minimum so the exclusion cache survives', () => {
    expect(ruleSetFor('mcr', 1)).toBe(ruleSetFor('mcr', 1))
    expect(ruleSetFor('mcr', 8)).toBe(MCR_RULESET)
  })
})
