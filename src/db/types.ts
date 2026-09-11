import type { HandInput, Meld, WindPosition } from '../engine/hand'
import type { WallPlan, WallRules } from '../engine/setup'
import type { ScoreBreakdown } from '../engine/scorer'
import type { PaymentBreakdown } from '../engine/payments'

export interface Player {
  id: string
  name: string
  color: string
  createdAt: string
}

export interface GamePlayer {
  playerId: string
  name: string
  color: string
  seat: number
  seatWind: WindPosition
  balance: number
}

export interface Game {
  id: string
  name: string
  ruleSetId: string
  startingBalance: number
  pointValue: number
  status: 'active' | 'finished'
  prevalentWind: WindPosition
  dealerSeat: number
  /** Hands played plus one, so the first hand is 1. Also the round counter. */
  roundNumber: number
  /** Hand within the 16-hand game, 1 to 16. */
  handNumber: number
  /**
   * Points a hand must reach before it may be declared. The guide sets 8 for
   * tournament play; home games usually play 0 or 1, so this is per game and
   * defaults to 0.
   */
  minimumPoints: number
  /** How this table throws for and counts the wall break. */
  wallRules: WallRules
  /** Dice throws and break point for the hand about to be played. */
  wall: WallPlan | null
  /** Tiles each seat has entered for this hand, keyed by seat number. */
  drafts: Record<string, SeatDraft>
  createdAt: string
  endedAt: string | null
}

/**
 * One player's tiles for the hand in progress, kept on their own phone and
 * shared with the table. Everyone can enter their own hand while play is going
 * on, so a win does not start with three people waiting for one to type.
 */
export interface SeatDraft {
  seat: number
  concealed: string[]
  melds: Meld[]
  bonusTiles: string[]
  updatedAt: string
}

export interface GameDetail extends Game {
  players: GamePlayer[]
}

/** `penalty` is a hand declared below the minimum, which costs the declarer. */
export type RoundOutcome = 'win' | 'draw' | 'penalty'

export interface Round {
  id: string
  gameId: string
  roundNumber: number
  prevalentWind: WindPosition
  dealerSeat: number
  outcome: RoundOutcome
  winnerPlayerId: string | null
  discarderPlayerId: string | null
  selfDraw: boolean
  handPoints: number
  bonusPoints: number
  totalPoints: number
  hand: HandInput | null
  score: ScoreBreakdown | null
  payment: PaymentBreakdown | null
  photoPath: string | null
  source: 'manual' | 'photo'
  createdAt: string
  voidedAt: string | null
  voidReason: string | null
}

export type TransactionType =
  | 'win' | 'payment' | 'adjustment' | 'reversal' | 'opening'

export interface Transaction {
  id: string
  gameId: string
  roundId: string | null
  playerId: string
  amount: number
  type: TransactionType
  createdAt: string
  metadata: Record<string, unknown>
}

export interface NewGameInput {
  name: string
  ruleSetId: string
  startingBalance: number
  pointValue: number
  minimumPoints: number
  wallRules: WallRules
  prevalentWind: WindPosition
  dealerSeat: number
  /** Seat 0 is the player who drew East; the rest run counter-clockwise. */
  players: Array<{ playerId: string; seat: number }>
}

export interface RecordRoundInput {
  gameId: string
  outcome: RoundOutcome
  winnerPlayerId: string | null
  discarderPlayerId: string | null
  selfDraw: boolean
  hand: HandInput | null
  score: ScoreBreakdown | null
  payment: PaymentBreakdown | null
  photoPath: string | null
  source: 'manual' | 'photo'
}

export interface PlayerStats {
  playerId: string
  name: string
  balance: number
  roundsPlayed: number
  wins: number
  losses: number
  winRate: number
  averageWinningScore: number
  biggestWin: number
  biggestLoss: number
  pointsWon: number
  pointsLost: number
  selfDraws: number
  discardsPaid: number
}

/** Everything the app needs from persistence, in one interface. */
export interface Store {
  readonly kind: 'supabase' | 'local'
  readonly ready: boolean

  listPlayers(): Promise<Player[]>
  createPlayer(name: string, color: string): Promise<Player>
  renamePlayer(id: string, name: string): Promise<void>

  listGames(): Promise<Game[]>
  getGame(id: string): Promise<GameDetail | null>
  createGame(input: NewGameInput): Promise<GameDetail>
  endGame(id: string): Promise<void>
  setDealer(gameId: string, dealerSeat: number, prevalentWind: WindPosition): Promise<void>

  /** Records the dice and break point for the hand about to be played. */
  setWall(gameId: string, wall: WallPlan | null): Promise<void>

  /** Changes the minimum a hand must reach to be declared. */
  setMinimumPoints(gameId: string, minimumPoints: number): Promise<void>

  /** Changes how the table throws for and counts the wall break. */
  setWallRules(gameId: string, wallRules: WallRules): Promise<void>

  /** Saves one seat's tiles for the hand in progress. */
  setSeatDraft(gameId: string, draft: SeatDraft): Promise<void>

  listRounds(gameId: string): Promise<Round[]>
  recordRound(input: RecordRoundInput): Promise<Round>
  voidRound(roundId: string, reason: string): Promise<void>

  listTransactions(gameId: string, playerId?: string): Promise<Transaction[]>
  addAdjustment(gameId: string, playerId: string, amount: number, note: string): Promise<void>

  /** Fires whenever anything in the game changes. Returns an unsubscribe. */
  subscribe(gameId: string, onChange: () => void): () => void
}
