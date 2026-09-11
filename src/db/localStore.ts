/**
 * On-device store. Used when Supabase is not configured, and it is what keeps
 * the app usable at a table with no signal. Same interface as the Supabase
 * store, so nothing above the data layer knows which one is active.
 *
 * Balances are derived from the transaction table, never incremented in place.
 */

import Dexie, { type Table } from 'dexie'
import type {
  Game, GameDetail, GamePlayer, NewGameInput, Player, RecordRoundInput, Round,
  SeatDraft, Store, Transaction,
} from './types'
import type { WindPosition } from '../engine/hand'
import {
  GUIDE_WALL_RULES, dealerSeatForHand, prevalentWindForHand, seatWindForHand,
  type WallPlan, type WallRules,
} from '../engine/setup'

interface GamePlayerRow {
  id: string
  gameId: string
  playerId: string
  seat: number
  seatWind: WindPosition
}

class MahjongDb extends Dexie {
  players!: Table<Player, string>
  games!: Table<Game, string>
  gamePlayers!: Table<GamePlayerRow, string>
  rounds!: Table<Round, string>
  transactions!: Table<Transaction, string>

  constructor() {
    super('mahjong-scorer')
    this.version(1).stores({
      players: 'id, name',
      games: 'id, status, createdAt',
      gamePlayers: 'id, gameId, playerId',
      rounds: 'id, gameId, roundNumber, createdAt',
      transactions: 'id, gameId, roundId, playerId, createdAt',
    })
  }
}

function uid(): string {
  return crypto.randomUUID()
}

export class LocalStore implements Store {
  readonly kind = 'local' as const
  readonly ready = true

  private db = new MahjongDb()
  private channel =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mahjong-scorer') : null

  private announce(gameId: string): void {
    this.channel?.postMessage({ gameId })
  }

  async listPlayers(): Promise<Player[]> {
    const all = await this.db.players.toArray()
    return all.sort((a, b) => a.name.localeCompare(b.name))
  }

  async createPlayer(name: string, color: string): Promise<Player> {
    const player: Player = { id: uid(), name, color, createdAt: new Date().toISOString() }
    await this.db.players.add(player)
    return player
  }

  async renamePlayer(id: string, name: string): Promise<void> {
    await this.db.players.update(id, { name })
  }

  async listGames(): Promise<Game[]> {
    const all = await this.db.games.toArray()
    return all
      .map((g) => this.normalise(g))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  private async balances(gameId: string): Promise<Map<string, number>> {
    const game = await this.db.games.get(gameId)
    const rows = await this.db.transactions.where('gameId').equals(gameId).toArray()
    const map = new Map<string, number>()
    const seats = await this.db.gamePlayers.where('gameId').equals(gameId).toArray()
    for (const s of seats) map.set(s.playerId, game?.startingBalance ?? 0)
    for (const t of rows) map.set(t.playerId, (map.get(t.playerId) ?? 0) + t.amount)
    return map
  }

  /**
   * Games saved before a field existed carry no value for it. Fill the newer
   * fields in on read so an old game still opens.
   */
  private normalise(game: Game): Game {
    const hadHandNumber = Boolean(game.handNumber)
    const handNumber = game.handNumber ?? Math.max(1, game.roundNumber ?? 1)
    return {
      ...game,
      handNumber,
      wall: game.wall ?? null,
      minimumPoints: game.minimumPoints ?? 0,
      wallRules: game.wallRules ?? GUIDE_WALL_RULES,
      drafts: game.drafts ?? {},
      dealerSeat: hadHandNumber ? game.dealerSeat : dealerSeatForHand(handNumber),
      prevalentWind: hadHandNumber ? game.prevalentWind : prevalentWindForHand(handNumber),
    }
  }

  async getGame(id: string): Promise<GameDetail | null> {
    const stored = await this.db.games.get(id)
    if (!stored) return null
    const game = this.normalise(stored)
    const seats = await this.db.gamePlayers.where('gameId').equals(id).toArray()
    const balances = await this.balances(id)
    const players: GamePlayer[] = []
    for (const s of seats.sort((a, b) => a.seat - b.seat)) {
      const p = await this.db.players.get(s.playerId)
      players.push({
        playerId: s.playerId,
        name: p?.name ?? 'Unknown',
        color: p?.color ?? '#e9b949',
        seat: s.seat,
        seatWind: s.seatWind,
        balance: balances.get(s.playerId) ?? game.startingBalance,
      })
    }
    return { ...game, players }
  }

  async createGame(input: NewGameInput): Promise<GameDetail> {
    const game: Game = {
      id: uid(),
      name: input.name,
      ruleSetId: input.ruleSetId,
      startingBalance: input.startingBalance,
      pointValue: input.pointValue,
      status: 'active',
      prevalentWind: prevalentWindForHand(1),
      dealerSeat: dealerSeatForHand(1),
      roundNumber: 1,
      handNumber: 1,
      minimumPoints: input.minimumPoints,
      wallRules: input.wallRules,
      wall: null,
      drafts: {},
      createdAt: new Date().toISOString(),
      endedAt: null,
    }
    await this.db.games.add(game)
    await this.db.gamePlayers.bulkAdd(
      input.players.map((p) => ({
        id: uid(),
        gameId: game.id,
        playerId: p.playerId,
        seat: p.seat,
        seatWind: seatWindForHand(p.seat, 1),
      })),
    )
    this.announce(game.id)
    return (await this.getGame(game.id))!
  }

  async endGame(id: string): Promise<void> {
    await this.db.games.update(id, { status: 'finished', endedAt: new Date().toISOString() })
    this.announce(id)
  }

  async setDealer(gameId: string, dealerSeat: number, prevalentWind: WindPosition): Promise<void> {
    await this.db.games.update(gameId, { dealerSeat, prevalentWind })
    const seats = await this.db.gamePlayers.where('gameId').equals(gameId).toArray()
    for (const s of seats) {
      await this.db.gamePlayers.update(s.id, {
        seatWind: seatWindForHand(s.seat, 1),
      })
    }
    this.announce(gameId)
  }

  async setWall(gameId: string, wall: WallPlan | null): Promise<void> {
    await this.db.games.update(gameId, { wall })
    this.announce(gameId)
  }

  async setMinimumPoints(gameId: string, minimumPoints: number): Promise<void> {
    await this.db.games.update(gameId, { minimumPoints })
    this.announce(gameId)
  }

  async setWallRules(gameId: string, wallRules: WallRules): Promise<void> {
    // Any half-thrown plan is cleared, since it was built under the old rules.
    await this.db.games.update(gameId, { wallRules, wall: null })
    this.announce(gameId)
  }

  async setSeatDraft(gameId: string, draft: SeatDraft): Promise<void> {
    const game = await this.db.games.get(gameId)
    if (!game) throw new Error('Game not found')
    const drafts = { ...(game.drafts ?? {}), [String(draft.seat)]: draft }
    await this.db.games.update(gameId, { drafts })
    this.announce(gameId)
  }

  /**
   * Moves the table on one hand. Every player's wind advances one step
   * counter-clockwise, and the round wind changes every fourth hand, which is
   * the rotation the guide sets out.
   */
  private async advanceHand(gameId: string, from: number): Promise<void> {
    const next = from + 1
    await this.db.games.update(gameId, {
      handNumber: next,
      roundNumber: next,
      dealerSeat: dealerSeatForHand(next),
      prevalentWind: prevalentWindForHand(next),
      wall: null,
      // Last hand's tiles are gone; everyone enters the new deal.
      drafts: {},
    })
    const seats = await this.db.gamePlayers.where('gameId').equals(gameId).toArray()
    for (const s of seats) {
      await this.db.gamePlayers.update(s.id, { seatWind: seatWindForHand(s.seat, next) })
    }
  }

  async listRounds(gameId: string): Promise<Round[]> {
    const rows = await this.db.rounds.where('gameId').equals(gameId).toArray()
    return rows.sort((a, b) => b.roundNumber - a.roundNumber)
  }

  async recordRound(input: RecordRoundInput): Promise<Round> {
    const stored = await this.db.games.get(input.gameId)
    if (!stored) throw new Error('Game not found')
    const game = this.normalise(stored)

    const round: Round = {
      id: uid(),
      gameId: input.gameId,
      roundNumber: game.handNumber,
      prevalentWind: game.prevalentWind,
      dealerSeat: game.dealerSeat,
      outcome: input.outcome,
      winnerPlayerId: input.winnerPlayerId,
      discarderPlayerId: input.discarderPlayerId,
      selfDraw: input.selfDraw,
      handPoints: input.score?.handPoints ?? 0,
      bonusPoints: input.score?.bonusPoints ?? 0,
      totalPoints: input.outcome === 'win' ? input.score?.totalPoints ?? 0 : 0,
      hand: input.hand,
      score: input.score,
      payment: input.payment,
      photoPath: input.photoPath,
      source: input.source,
      createdAt: new Date().toISOString(),
      voidedAt: null,
      voidReason: null,
    }
    await this.db.rounds.add(round)

    const now = new Date().toISOString()
    const lines = input.payment?.lines ?? []
    await this.db.transactions.bulkAdd(
      lines
        .filter((l) => l.amount !== 0)
        .map((l) => ({
          id: uid(),
          gameId: input.gameId,
          roundId: round.id,
          playerId: l.playerId,
          amount: l.amount,
          type: (l.amount > 0 ? 'win' : 'payment') as Transaction['type'],
          createdAt: now,
          metadata: { reason: l.reason, roundNumber: round.roundNumber },
        })),
    )

    await this.advanceHand(input.gameId, game.handNumber)
    this.announce(input.gameId)
    return round
  }

  async voidRound(roundId: string, reason: string): Promise<void> {
    const round = await this.db.rounds.get(roundId)
    if (!round) throw new Error('Round not found')
    const originals = (await this.db.transactions.where('roundId').equals(roundId).toArray())
      .filter((t) => t.type !== 'reversal')
    const now = new Date().toISOString()
    await this.db.transactions.bulkAdd(
      originals.map((t) => ({
        id: uid(),
        gameId: t.gameId,
        roundId: t.roundId,
        playerId: t.playerId,
        amount: -t.amount,
        type: 'reversal' as const,
        createdAt: now,
        metadata: { reverses: t.id, reason },
      })),
    )
    await this.db.rounds.update(roundId, { voidedAt: now, voidReason: reason })
    this.announce(round.gameId)
  }

  async listTransactions(gameId: string, playerId?: string): Promise<Transaction[]> {
    let rows = await this.db.transactions.where('gameId').equals(gameId).toArray()
    if (playerId) rows = rows.filter((t) => t.playerId === playerId)
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async addAdjustment(
    gameId: string, playerId: string, amount: number, note: string,
  ): Promise<void> {
    await this.db.transactions.add({
      id: uid(),
      gameId,
      roundId: null,
      playerId,
      amount,
      type: 'adjustment',
      createdAt: new Date().toISOString(),
      metadata: { note },
    })
    this.announce(gameId)
  }

  subscribe(gameId: string, onChange: () => void): () => void {
    if (!this.channel) return () => {}
    const handler = (e: MessageEvent) => {
      if (e.data?.gameId === gameId) onChange()
    }
    this.channel.addEventListener('message', handler)
    return () => this.channel?.removeEventListener('message', handler)
  }
}
