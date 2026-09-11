import { describe, expect, it } from 'vitest'
import type { GameContext, HandInput, Meld } from '../src/engine/hand'
import { NO_FLAGS } from '../src/engine/hand'
import { MCR_RULESET } from '../src/engine/ruleset'
import { score } from '../src/engine/scorer'
import { validate, waitingTiles } from '../src/engine/validator'

function ids(s: string): string[] {
  return s.trim().split(/\s+/)
}

function hand(partial: Partial<HandInput> & { concealed: string[]; winningTile: string }): HandInput {
  return {
    melds: [], selfDraw: false, bonusTiles: [], flags: { ...NO_FLAGS }, ...partial,
  }
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

describe('limit hands', () => {
  it('scores Nine Gates and absorbs the flush it contains', () => {
    const s = run(hand({
      concealed: ids('b1 b1 b1 b2 b3 b4 b5 b5 b6 b7 b8 b9 b9 b9'),
      winningTile: 'b5',
      selfDraw: true,
    }), { ...EAST, discarderSeat: null })
    expect(total(s, 'nine_gates')).toBe(88)
    expect(total(s, 'full_flush')).toBe(0)
    expect(total(s, 'no_honors')).toBe(0)
    expect(total(s, 'one_voided_suit')).toBe(0)
    expect(total(s, 'fully_concealed_hand')).toBe(4)
    expect(total(s, 'self_drawn')).toBe(0)
  })

  it('scores All Green', () => {
    const s = run(hand({
      concealed: ids('b2 b2 b2 b3 b3 b3 b4 b4 b4 b6 b6 b6 b8 b8'),
      winningTile: 'b8',
    }))
    expect(total(s, 'all_green')).toBe(88)
    expect(total(s, 'full_flush')).toBe(24)
    expect(total(s, 'four_concealed_pungs')).toBe(64)
    expect(total(s, 'pure_shifted_pungs')).toBe(24)
    expect(total(s, 'all_simples')).toBe(2)
    // 222 333 444 666 8 was also waiting on the 7, as 678 with a pair of 6s,
    // and the guide voids Single Wait when more than one tile completes.
    expect(total(s, 'single_wait')).toBe(0)
    expect(total(s, 'all_pungs')).toBe(0)
    expect(s.handPoints).toBe(202)
  })

  it('scores Seven Shifted Pairs and absorbs the flush transitively', () => {
    const s = run(hand({
      concealed: ids('b1 b1 b2 b2 b3 b3 b4 b4 b5 b5 b6 b6 b7 b7'),
      winningTile: 'b7',
    }))
    expect(total(s, 'seven_shifted_pairs')).toBe(88)
    expect(total(s, 'seven_pairs')).toBe(0)
    expect(total(s, 'full_flush')).toBe(0)
    expect(total(s, 'one_voided_suit')).toBe(0)
    expect(s.handPoints).toBe(88)
  })

  it('scores Big Four Winds alongside All Honors', () => {
    const s = run(hand({
      concealed: ids('we we we ws ws ws ww ww ww wn wn wn dr dr'),
      winningTile: 'dr',
    }))
    expect(total(s, 'big_four_winds')).toBe(88)
    expect(total(s, 'all_honors')).toBe(64)
    expect(total(s, 'four_concealed_pungs')).toBe(64)
    expect(total(s, 'prevalent_wind')).toBe(0)
    expect(total(s, 'seat_wind')).toBe(0)
    expect(total(s, 'pung_of_terminals_or_honors')).toBe(0)
    expect(s.handPoints).toBe(218)
  })
})

describe('kongs and melds', () => {
  const kong = (t: string, concealed: boolean): Meld =>
    ({ kind: 'kong', tiles: [t, t, t, t], concealed })

  it('scores two concealed kongs and does not double count the single kong rule', () => {
    const s = run(hand({
      concealed: ids('b2 b3 b4 c5 c6 c7 d9 d9'),
      melds: [kong('we', true), kong('ws', true)],
      winningTile: 'c7',
    }))
    expect(total(s, 'two_concealed_kongs')).toBe(6)
    expect(total(s, 'concealed_kong')).toBe(0)
    expect(total(s, 'two_concealed_pungs')).toBe(2)
    expect(total(s, 'prevalent_wind')).toBe(2)
    expect(total(s, 'seat_wind')).toBe(2)
    expect(total(s, 'pung_of_terminals_or_honors')).toBe(2)
  })

  it('treats a melded kong as an open set', () => {
    const s = run(hand({
      concealed: ids('b2 b3 b4 c5 c6 c7 d1 d2 d3 d9 d9'),
      melds: [kong('we', false)],
      winningTile: 'c7',
    }))
    expect(total(s, 'melded_kong')).toBe(1)
    expect(total(s, 'concealed_hand')).toBe(0)
    expect(total(s, 'prevalent_wind')).toBe(2)
  })
})

describe('waits and repeated patterns', () => {
  it('counts an edge wait', () => {
    const s = run(hand({
      concealed: ids('b1 b2 b3 c4 c5 c6 d7 d8 d9 we we we c9 c9'),
      winningTile: 'b3',
    }))
    expect(total(s, 'edge_wait')).toBe(1)
    expect(total(s, 'closed_wait')).toBe(0)
    expect(total(s, 'mixed_straight')).toBe(8)
  })

  it('counts Pure Double Chow for a repeated chow', () => {
    const s = run(hand({
      concealed: ids('b1 b2 b3 b1 b2 b3 c5 c5 c5 d7 d8 d9 ww ww'),
      winningTile: 'd9',
    }))
    expect(total(s, 'pure_double_chow')).toBe(1)
    expect(total(s, 'concealed_hand')).toBe(2)
    expect(s.handPoints).toBe(3)
  })

  it('prefers the seven pairs reading when it scores higher than the chow reading', () => {
    const s = run(hand({
      concealed: ids('b1 b2 b3 b1 b2 b3 b6 b7 b8 b6 b7 b8 c5 c5'),
      winningTile: 'c5',
    }))
    expect(s.readingsConsidered).toBeGreaterThan(1)
    expect(total(s, 'seven_pairs')).toBe(24)
    expect(total(s, 'pure_double_chow')).toBe(0)
  })

  it('counts Tile Hog when all four copies are used without a kong', () => {
    const s = run(hand({
      concealed: ids('b1 b2 b3 b3 b3 b3 b4 b5 c7 c8 c9 d2 d2 d2'),
      winningTile: 'd2',
    }))
    expect(total(s, 'tile_hog')).toBe(2)
  })

  it('lets Robbing the Kong absorb Last Tile', () => {
    const s = run(hand({
      concealed: ids('b1 b2 b3 c4 c5 c6 d7 d8 d9 we we we c9 c9'),
      winningTile: 'b3',
      flags: { ...NO_FLAGS, robbingKong: true, lastOfItsKind: true },
    }))
    expect(total(s, 'robbing_the_kong')).toBe(8)
    expect(total(s, 'last_tile')).toBe(0)
  })
})

describe('validation messages', () => {
  it('rejects a chow that is not three tiles in a row', () => {
    const result = validate(hand({
      concealed: ids('b2 b3 b4 c5 c6 c7 d9 d9'),
      melds: [
        { kind: 'chow', tiles: ids('b1 b3 b5'), concealed: false },
        { kind: 'pung', tiles: ids('we we we'), concealed: false },
      ],
      winningTile: 'c7',
    }), MCR_RULESET)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'chow_sequence')).toBe(true)
  })

  it('rejects a self-draw that also claims to have robbed a kong', () => {
    const result = validate(hand({
      concealed: ids('b1 b2 b3 c4 c5 c6 d7 d8 d9 we we we c9 c9'),
      winningTile: 'b3',
      selfDraw: true,
      flags: { ...NO_FLAGS, robbingKong: true },
    }), MCR_RULESET)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'flag_conflict')).toBe(true)
  })

  it('rejects a flower tile placed inside the hand', () => {
    const result = validate(hand({
      concealed: ids('f1 b2 b3 c4 c5 c6 d7 d8 d9 we we we c9 c9'),
      winningTile: 'c9',
    }), MCR_RULESET)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'bonus_in_hand')).toBe(true)
  })

  it('lists the tiles that would complete a 13 tile hand', () => {
    const waiting = waitingTiles(hand({
      concealed: ids('b1 b2 b3 c4 c5 c6 d7 d8 d9 we we we c9'),
      winningTile: '',
    }))
    expect(waiting).toEqual(['c9'])
  })
})
