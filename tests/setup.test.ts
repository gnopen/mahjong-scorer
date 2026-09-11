import { describe, expect, it } from 'vitest'
import {
  HANDS_PER_GAME, breakWall, chooseWall, dealerSeatForHand, drawForSeats,
  fullSchedule, handWithinRound, makeRoll, prevalentWindForHand,
  seatWindForHand, stacksPerSide, wallDiagram,
} from '../src/engine/setup'

describe('drawing for seats', () => {
  it('gives each player a different wind', () => {
    const draw = drawForSeats(['a', 'b', 'c', 'd'])
    expect(draw).toHaveLength(4)
    expect(new Set(draw.map((d) => d.wind)).size).toBe(4)
    expect(new Set(draw.map((d) => d.playerId))).toEqual(new Set(['a', 'b', 'c', 'd']))
  })
})

describe('breaking the wall', () => {
  it('follows the worked example in the guide', () => {
    // "if he throws 4 and 3 he totals this to seven and counts seven counter
    // clockwise around the Wall sides... So 7 takes him to West's part of the Wall."
    const plan = chooseWall(makeRoll(4, 3))
    expect(plan.first.total).toBe(7)
    expect(plan.wallWind).toBe('west')
  })

  it('counts East as 1 and wraps every four sides', () => {
    expect(chooseWall(makeRoll(1, 1)).wallWind).toBe('south')   // total 2
    expect(chooseWall(makeRoll(1, 2)).wallWind).toBe('west')    // total 3
    expect(chooseWall(makeRoll(2, 2)).wallWind).toBe('north')   // total 4
    expect(chooseWall(makeRoll(2, 3)).wallWind).toBe('east')    // total 5, back round
    expect(chooseWall(makeRoll(6, 6)).wallWind).toBe('north')   // total 12
  })

  it('counts the second throw in from the right-hand end', () => {
    const plan = breakWall(chooseWall(makeRoll(4, 3)), makeRoll(5, 4))
    expect(plan.counted).toBe(9)
    expect(plan.breakIndex).toBe(9)
    expect(plan.instruction).toContain('9 stacks in from the right-hand end')
  })

  it('mirrors the break when the table counts from the left', () => {
    const rules = { countFrom: 'left' as const, throws: 2 as const }
    const plan = breakWall(chooseWall(makeRoll(4, 3), true, rules), makeRoll(5, 4))
    expect(plan.counted).toBe(9)
    // 18 stacks a side, so the 9th from the left is the 10th from the right.
    expect(plan.breakIndex).toBe(10)
    expect(plan.instruction).toContain('left-hand end')
    // The dead wall still sits to the right of the gap.
    const { stacks } = wallDiagram(plan)
    expect(stacks.filter((s) => s.role === 'dead').map((s) => s.index))
      .toEqual([4, 5, 6, 7, 8, 9, 10])
  })

  it('uses one throw for both the wall and the stack when asked', () => {
    const rules = { countFrom: 'right' as const, throws: 1 as const }
    const plan = chooseWall(makeRoll(4, 3), true, rules)
    // 4 and 3 picks West's wall, and the same 7 counts the stacks.
    expect(plan.wallWind).toBe('west')
    expect(plan.counted).toBe(7)
    expect(plan.breakIndex).toBe(7)
    expect(plan.second).toEqual(plan.first)
    expect(plan.instruction).toContain('picks both the wall and the stack')
  })

  it('reserves seven stacks to the right of the gap as the dead wall', () => {
    const plan = breakWall(chooseWall(makeRoll(4, 3)), makeRoll(5, 4))
    const { stacks } = wallDiagram(plan)
    expect(stacks).toHaveLength(stacksPerSide(true))
    expect(stacks.filter((s) => s.role === 'dead')).toHaveLength(7)
    expect(stacks.filter((s) => s.isBreak).map((s) => s.index)).toEqual([9])
    // The dead wall runs from the break back toward the right-hand end.
    expect(stacks.filter((s) => s.role === 'dead').map((s) => s.index))
      .toEqual([3, 4, 5, 6, 7, 8, 9])
  })

  it('builds eighteen stacks a side with flowers and seventeen without', () => {
    expect(stacksPerSide(true)).toBe(18)
    expect(stacksPerSide(false)).toBe(17)
  })
})

describe('rotation and rounds', () => {
  it('moves a player who starts East through East, South, West then North', () => {
    expect([1, 2, 3, 4].map((h) => seatWindForHand(0, h)))
      .toEqual(['east', 'south', 'west', 'north'])
  })

  it('passes the deal to the player who was North', () => {
    // Seat 3 holds North on hand 1 and East on hand 2.
    expect(seatWindForHand(3, 1)).toBe('north')
    expect(seatWindForHand(3, 2)).toBe('east')
    expect(dealerSeatForHand(1)).toBe(0)
    expect(dealerSeatForHand(2)).toBe(3)
  })

  it('gives every seat a different wind in every hand', () => {
    for (let hand = 1; hand <= HANDS_PER_GAME; hand++) {
      const winds = [0, 1, 2, 3].map((seat) => seatWindForHand(seat, hand))
      expect(new Set(winds).size).toBe(4)
    }
  })

  it('changes the round wind every four hands', () => {
    expect(prevalentWindForHand(1)).toBe('east')
    expect(prevalentWindForHand(4)).toBe('east')
    expect(prevalentWindForHand(5)).toBe('south')
    expect(prevalentWindForHand(9)).toBe('west')
    expect(prevalentWindForHand(13)).toBe('north')
    expect(handWithinRound(5)).toBe(1)
    expect(handWithinRound(8)).toBe(4)
  })

  it('runs sixteen hands and starts a round on each fourth one', () => {
    const schedule = fullSchedule()
    expect(schedule).toHaveLength(16)
    expect(schedule.filter((s) => s.startsRound).map((s) => s.handNumber))
      .toEqual([1, 5, 9, 13])
  })

  it('has every player sit every seat once per round', () => {
    for (let round = 0; round < 4; round++) {
      for (let seat = 0; seat < 4; seat++) {
        const winds = [1, 2, 3, 4].map((h) => seatWindForHand(seat, round * 4 + h))
        expect(new Set(winds).size).toBe(4)
      }
    }
  })
})
