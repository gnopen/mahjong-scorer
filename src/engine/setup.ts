/**
 * Everything that happens before the first discard: drawing for seats, the two
 * dice throws, where the wall gets broken, and how the seats rotate between
 * hands.
 *
 * All of it follows A Guide to Mahjong (Chinese / Official International
 * Rules), pages 10 to 17. The guide's own wording is quoted where a step is
 * easy to get backwards.
 */

import type { WindPosition } from './hand'
import { WIND_TILE } from './hand'
import type { TileId } from './tiles'

/**
 * Winds in counting order. The guide: the winds "are counted counter-clockwise
 * (ESWN) as this is the way the Chinese traditionally list their compass
 * directions".
 */
export const WIND_ORDER: WindPosition[] = ['east', 'south', 'west', 'north']

export const WIND_LABEL: Record<WindPosition, string> = {
  east: 'East', south: 'South', west: 'West', north: 'North',
}

export const WIND_GLYPH: Record<WindPosition, string> = {
  east: '東', south: '南', west: '西', north: '北',
}

export function windTile(wind: WindPosition): TileId {
  return WIND_TILE[wind]
}

/* ------------------------------------------------------------ seat drawing */

export interface SeatDraw {
  playerId: string
  wind: WindPosition
}

/**
 * "the players each draw one of the 4 Winds. The player who draws the East
 * Wind will take the East side of the table."
 *
 * Returns one wind per player in the order they were passed, shuffled.
 */
export function drawForSeats(playerIds: string[]): SeatDraw[] {
  const winds = [...WIND_ORDER]
  for (let i = winds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[winds[i], winds[j]] = [winds[j], winds[i]]
  }
  return playerIds.map((playerId, i) => ({ playerId, wind: winds[i] }))
}

/**
 * Seat index for a wind, where seat 0 is the player who drew East and the
 * indices run counter-clockwise in the order East, South, West, North.
 */
export function seatOfWind(wind: WindPosition): number {
  return WIND_ORDER.indexOf(wind)
}

/* -------------------------------------------------------------------- dice */

export interface DiceRoll {
  a: number
  b: number
  total: number
}

export function roll(): DiceRoll {
  const a = 1 + Math.floor(Math.random() * 6)
  const b = 1 + Math.floor(Math.random() * 6)
  return { a, b, total: a + b }
}

export function makeRoll(a: number, b: number): DiceRoll {
  return { a, b, total: a + b }
}

export function isValidDie(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 6
}

/* --------------------------------------------------------------- the wall */

/** Stacks of two tiles each along one player's side of the wall. */
export function stacksPerSide(withFlowers: boolean): number {
  // 144 tiles with flowers, 136 without; each player builds a quarter, two high.
  return withFlowers ? 18 : 17
}

/**
 * Which end of the chosen side the stacks are counted from.
 *
 * The guide says the right-hand end, and that is the default. Counting from
 * the left is a common house variation, so it is an option rather than a
 * silent assumption. Either way the dead wall sits to the right of the gap,
 * because that is decided by the direction tiles are drawn, not by which end
 * you counted from.
 */
export type WallCountFrom = 'right' | 'left'

/**
 * How many times the dice are thrown. The guide throws twice: once to pick
 * whose wall, once to pick the stack. Many tables throw once and use the same
 * total for both.
 */
export type WallThrows = 1 | 2

export interface WallRules {
  countFrom: WallCountFrom
  throws: WallThrows
}

export const GUIDE_WALL_RULES: WallRules = { countFrom: 'right', throws: 2 }

const END_LABEL: Record<WallCountFrom, string> = {
  right: 'right-hand end',
  left: 'left-hand end',
}

export interface WallPlan {
  /** East's throw, which chooses whose wall gets broken. */
  first: DiceRoll
  /** Wind of the player whose wall was chosen. */
  wallWind: WindPosition
  /** How far counter-clockwise the first throw counted, 1 being East's own side. */
  countedSides: number
  /** The throw that picks the stack. Equal to `first` when the table throws once. */
  second: DiceRoll | null
  /** The number the player counts along, from whichever end the table uses. */
  counted: number | null
  /** Which end that count started from. */
  countFrom: WallCountFrom
  /** How many throws this plan used. */
  throws: WallThrows
  /**
   * The gap, as a stack index counted from the right-hand end. Always measured
   * this way so the diagram and the dead wall have one frame of reference.
   */
  breakIndex: number | null
  /** Total stacks on one side, for drawing the diagram. */
  sideStacks: number
  /** Plain-language instruction for the table. */
  instruction: string
}

/**
 * First throw. "the player who is in the East Wind position throws two dice and
 * adds the total together... counts seven counter clockwise around the Wall
 * sides, counting his own part of the wall as 1, South's as 2, West's as 3
 * etc. So 7 takes him to West's part of the Wall."
 */
export function chooseWall(
  first: DiceRoll,
  withFlowers = true,
  rules: WallRules = GUIDE_WALL_RULES,
): WallPlan {
  const steps = (first.total - 1) % 4
  const wallWind = WIND_ORDER[steps]
  const plan: WallPlan = {
    first,
    wallWind,
    countedSides: first.total,
    second: null,
    counted: null,
    countFrom: rules.countFrom,
    throws: rules.throws,
    breakIndex: null,
    sideStacks: stacksPerSide(withFlowers),
    instruction:
      'East threw ' + first.a + ' and ' + first.b + ' for ' + first.total +
      '. Counting counter-clockwise from East as 1, that lands on ' +
      WIND_LABEL[wallWind] + '. ' + WIND_LABEL[wallWind] + ' throws next.',
  }
  // One throw: the same total also picks the stack, so finish it here.
  return rules.throws === 1 ? breakWall(plan, first) : plan
}

/**
 * The throw that picks the stack. "Starting at the right hand end of his part
 * of the Wall, he counts the thrown total along, and when he comes to the last
 * 2 tiles, he breaks the wall with a gap at this point."
 */
export function breakWall(plan: WallPlan, second: DiceRoll): WallPlan {
  const counted = Math.min(second.total, plan.sideStacks)
  // Stack indices run from the right, so counting from the left is a mirror.
  const breakIndex = plan.countFrom === 'right'
    ? counted
    : plan.sideStacks - counted + 1

  const throwLine = plan.throws === 1
    ? 'East threw ' + second.a + ' and ' + second.b + ' for ' + second.total +
      ', which picks both the wall and the stack.'
    : WIND_LABEL[plan.wallWind] + ' threw ' + second.a + ' and ' + second.b +
      ' for ' + second.total + '.'

  return {
    ...plan,
    second,
    counted,
    breakIndex,
    instruction:
      throwLine + ' Count ' + counted + ' stacks in from the ' +
      END_LABEL[plan.countFrom] + ' of ' + WIND_LABEL[plan.wallWind] +
      "'s wall and open the gap there. Everything to the right of the gap is the " +
      'dead wall, 14 tiles; drawing starts to the left of the gap.',
  }
}

/** Tiles in the dead wall, which the guide fixes at 14 however many are used. */
export const DEAD_WALL_TILES = 14

export interface WallDiagram {
  /** One entry per stack, indexed from the right-hand end of the side. */
  stacks: Array<{
    index: number
    /** What the player counts out loud, from whichever end they count. */
    label: number
    role: 'dead' | 'live'
    isBreak: boolean
  }>
}

/**
 * The chosen side laid out for drawing. The dead wall is the seven stacks
 * sitting to the right of the gap; if the gap falls too close to the
 * right-hand end the dead wall continues onto the previous side, which the
 * diagram marks by simply running out of stacks.
 */
export function wallDiagram(plan: WallPlan): WallDiagram {
  const deadStacks = DEAD_WALL_TILES / 2
  const breakAt = plan.breakIndex ?? 0
  const stacks = []
  for (let i = 1; i <= plan.sideStacks; i++) {
    stacks.push({
      index: i,
      label: plan.countFrom === 'right' ? i : plan.sideStacks - i + 1,
      role: (i <= breakAt && i > breakAt - deadStacks ? 'dead' : 'live') as 'dead' | 'live',
      isBreak: i === breakAt,
    })
  }
  return { stacks }
}

/* -------------------------------------------------------- rounds and seats */

export const HANDS_PER_ROUND = 4
export const ROUNDS_PER_GAME = 4
export const HANDS_PER_GAME = HANDS_PER_ROUND * ROUNDS_PER_GAME

/**
 * The wind a seat holds on a given hand. Seat 0 is whoever drew East at the
 * start, and each hand every player's wind advances one step counter-clockwise,
 * so a player who starts East plays East, South, West then North.
 */
export function seatWindForHand(seat: number, handNumber: number): WindPosition {
  return WIND_ORDER[(seat + handNumber - 1) % 4]
}

/** Which seat is dealing, that is, which seat currently holds East. */
export function dealerSeatForHand(handNumber: number): number {
  return (4 - (handNumber - 1) % 4) % 4
}

/** The wind of the round. Four hands to a round, four rounds to a game. */
export function prevalentWindForHand(handNumber: number): WindPosition {
  return WIND_ORDER[Math.floor((handNumber - 1) / HANDS_PER_ROUND) % 4]
}

export function roundNumberForHand(handNumber: number): number {
  return Math.floor((handNumber - 1) / HANDS_PER_ROUND) + 1
}

/** Hand within the current round, 1 to 4. */
export function handWithinRound(handNumber: number): number {
  return ((handNumber - 1) % HANDS_PER_ROUND) + 1
}

export interface RotationStep {
  handNumber: number
  roundNumber: number
  prevalentWind: WindPosition
  dealerSeat: number
  /** Wind per seat index. */
  seatWinds: WindPosition[]
  /** True when this hand starts a new round. */
  startsRound: boolean
}

export function rotationFor(handNumber: number): RotationStep {
  return {
    handNumber,
    roundNumber: roundNumberForHand(handNumber),
    prevalentWind: prevalentWindForHand(handNumber),
    dealerSeat: dealerSeatForHand(handNumber),
    seatWinds: [0, 1, 2, 3].map((seat) => seatWindForHand(seat, handNumber)),
    startsRound: handWithinRound(handNumber) === 1,
  }
}

/** The whole 16-hand schedule, used by the rotation screen. */
export function fullSchedule(): RotationStep[] {
  return Array.from({ length: HANDS_PER_GAME }, (_, i) => rotationFor(i + 1))
}
