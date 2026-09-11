/**
 * Supabase-backed store. Rounds and transactions are append-only; a correction
 * writes reversing transactions rather than editing or deleting the original,
 * which is what makes the round history an audit trail rather than a guess.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Game, GameDetail, GamePlayer, NewGameInput, Player, RecordRoundInput, Round,
  SeatDraft, Store, Transaction,
} from './types'
import type { WindPosition } from '../engine/hand'
import {
  GUIDE_WALL_RULES, dealerSeatForHand, prevalentWindForHand, seatWindForHand,
  type WallPlan, type WallRules,
} from '../engine/setup'

export function supabaseConfig(): { url: string; key: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key || url.includes('YOUR-PROJECT')) return null
  return { url, key }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

function toGame(r: Row): Game {
  return {
    id: r.id,
    name: r.name,
    ruleSetId: r.rule_set_id,
    startingBalance: r.starting_balance,
    pointValue: Number(r.point_value),
    status: r.status,
    prevalentWind: r.prevalent_wind,
    dealerSeat: r.dealer_seat,
    roundNumber: r.hand_number ?? r.round_number,
    handNumber: r.hand_number ?? r.round_number,
    minimumPoints: r.minimum_points ?? 0,
    wallRules: r.wall_rules ?? GUIDE_WALL_RULES,
    wall: r.wall ?? null,
    drafts: r.drafts ?? {},
    createdAt: r.created_at,
    endedAt: r.ended_at,
  }
}

function toRound(r: Row): Round {
  return {
    id: r.id,
    gameId: r.game_id,
    roundNumber: r.round_number,
    prevalentWind: r.prevalent_wind,
    dealerSeat: r.dealer_seat,
    outcome: r.outcome,
    winnerPlayerId: r.winner_player_id,
    discarderPlayerId: r.discarder_player_id,
    selfDraw: r.self_draw,
    handPoints: r.hand_points,
    bonusPoints: r.bonus_points,
    totalPoints: r.total_points,
    hand: r.hand,
    score: r.score,
    payment: r.payment,
    photoPath: r.photo_path,
    source: r.source,
    createdAt: r.created_at,
    voidedAt: r.voided_at,
    voidReason: r.void_reason,
  }
}

function toTransaction(r: Row): Transaction {
  return {
    id: r.id,
    gameId: r.game_id,
    roundId: r.round_id,
    playerId: r.player_id,
    amount: r.amount,
    type: r.transaction_type,
    createdAt: r.created_at,
    metadata: r.metadata ?? {},
  }
}

export class SupabaseStore implements Store {
  readonly kind = 'supabase' as const
  readonly ready = true
  private client: SupabaseClient

  constructor(url: string, key: string) {
    this.client = createClient(url, key, { realtime: { params: { eventsPerSecond: 5 } } })
  }

  private async run<T>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return data as T
  }

  async listPlayers(): Promise<Player[]> {
    const rows = await this.run(this.client.from('players').select('*').order('name'))
    return rows.map((r: Row) => ({
      id: r.id, name: r.name, color: r.color, createdAt: r.created_at,
    }))
  }

  async createPlayer(name: string, color: string): Promise<Player> {
    const rows = await this.run(
      this.client.from('players').insert({ name, color }).select().single(),
    )
    const r = rows as unknown as Row
    return { id: r.id, name: r.name, color: r.color, createdAt: r.created_at }
  }

  async renamePlayer(id: string, name: string): Promise<void> {
    await this.run(this.client.from('players').update({ name }).eq('id', id).select())
  }

  async listGames(): Promise<Game[]> {
    const rows = await this.run(
      this.client.from('games').select('*').order('created_at', { ascending: false }),
    )
    return rows.map(toGame)
  }

  async getGame(id: string): Promise<GameDetail | null> {
    const { data, error } = await this.client.from('games').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    const balances = await this.run(
      this.client.from('game_player_balances').select('*').eq('game_id', id).order('seat'),
    )
    const players: GamePlayer[] = balances.map((r: Row) => ({
      playerId: r.player_id,
      name: r.name,
      color: r.color,
      seat: r.seat,
      seatWind: r.seat_wind,
      balance: Number(r.balance),
    }))
    return { ...toGame(data), players }
  }

  async createGame(input: NewGameInput): Promise<GameDetail> {
    const game = await this.run(
      this.client.from('games').insert({
        name: input.name,
        rule_set_id: input.ruleSetId,
        starting_balance: input.startingBalance,
        point_value: input.pointValue,
        prevalent_wind: prevalentWindForHand(1),
        dealer_seat: dealerSeatForHand(1),
        hand_number: 1,
        minimum_points: input.minimumPoints,
        wall_rules: input.wallRules,
      }).select().single(),
    ) as unknown as Row

    await this.run(
      this.client.from('game_players').insert(
        input.players.map((p) => ({
          game_id: game.id,
          player_id: p.playerId,
          seat: p.seat,
          seat_wind: seatWindForHand(p.seat, 1),
        })),
      ).select(),
    )
    return (await this.getGame(game.id))!
  }

  async endGame(id: string): Promise<void> {
    await this.run(
      this.client.from('games')
        .update({ status: 'finished', ended_at: new Date().toISOString() })
        .eq('id', id).select(),
    )
  }

  async setDealer(gameId: string, dealerSeat: number, prevalentWind: WindPosition): Promise<void> {
    await this.run(
      this.client.from('games')
        .update({ dealer_seat: dealerSeat, prevalent_wind: prevalentWind })
        .eq('id', gameId).select(),
    )
    await this.applySeatWinds(gameId, 1)
  }

  /** Writes the wind each seat holds for a given hand number. */
  private async applySeatWinds(gameId: string, handNumber: number): Promise<void> {
    const seats = await this.run(
      this.client.from('game_players').select('player_id, seat').eq('game_id', gameId),
    )
    for (const s of seats as Row[]) {
      await this.run(
        this.client.from('game_players')
          .update({ seat_wind: seatWindForHand(s.seat, handNumber) })
          .eq('game_id', gameId).eq('player_id', s.player_id).select(),
      )
    }
  }

  async setWall(gameId: string, wall: WallPlan | null): Promise<void> {
    await this.run(
      this.client.from('games').update({ wall }).eq('id', gameId).select(),
    )
  }

  async setMinimumPoints(gameId: string, minimumPoints: number): Promise<void> {
    await this.run(
      this.client.from('games')
        .update({ minimum_points: minimumPoints })
        .eq('id', gameId).select(),
    )
  }

  async setWallRules(gameId: string, wallRules: WallRules): Promise<void> {
    await this.run(
      this.client.from('games')
        .update({ wall_rules: wallRules, wall: null })
        .eq('id', gameId).select(),
    )
  }

  async setSeatDraft(gameId: string, draft: SeatDraft): Promise<void> {
    // Read then write, because each phone only owns its own seat's entry.
    const game = await this.run(
      this.client.from('games').select('drafts').eq('id', gameId).single(),
    ) as unknown as Row
    const drafts = { ...(game.drafts ?? {}), [String(draft.seat)]: draft }
    await this.run(
      this.client.from('games').update({ drafts }).eq('id', gameId).select(),
    )
  }

  async listRounds(gameId: string): Promise<Round[]> {
    const rows = await this.run(
      this.client.from('rounds').select('*')
        .eq('game_id', gameId).order('round_number', { ascending: false }),
    )
    return rows.map(toRound)
  }

  async recordRound(input: RecordRoundInput): Promise<Round> {
    const game = await this.run(
      this.client.from('games').select('*').eq('id', input.gameId).single(),
    ) as unknown as Row

    const round = await this.run(
      this.client.from('rounds').insert({
        game_id: input.gameId,
        round_number: game.hand_number ?? game.round_number,
        prevalent_wind: game.prevalent_wind,
        dealer_seat: game.dealer_seat,
        outcome: input.outcome,
        winner_player_id: input.winnerPlayerId,
        discarder_player_id: input.discarderPlayerId,
        self_draw: input.selfDraw,
        hand_points: input.score?.handPoints ?? 0,
        bonus_points: input.score?.bonusPoints ?? 0,
        total_points: input.score?.totalPoints ?? 0,
        hand: input.hand,
        score: input.score,
        payment: input.payment,
        photo_path: input.photoPath,
        source: input.source,
      }).select().single(),
    ) as unknown as Row

    const lines = (input.payment?.lines ?? []).filter((l) => l.amount !== 0)
    if (lines.length > 0) {
      await this.run(
        this.client.from('transactions').insert(
          lines.map((l) => ({
            game_id: input.gameId,
            round_id: round.id,
            player_id: l.playerId,
            amount: l.amount,
            transaction_type: l.amount > 0 ? 'win' : 'payment',
            metadata: { reason: l.reason, roundNumber: round.round_number },
          })),
        ).select(),
      )
    }

    // Move the table on: every wind steps one place counter-clockwise, and the
    // round wind changes every fourth hand.
    const nextHand = (game.hand_number ?? game.round_number) + 1
    await this.run(
      this.client.from('games')
        .update({
          hand_number: nextHand,
          round_number: nextHand,
          dealer_seat: dealerSeatForHand(nextHand),
          prevalent_wind: prevalentWindForHand(nextHand),
          wall: null,
          drafts: {},
        })
        .eq('id', input.gameId).select(),
    )
    await this.applySeatWinds(input.gameId, nextHand)
    await this.client.rpc('reconcile_game', { p_game_id: input.gameId })
    return toRound(round)
  }

  async voidRound(roundId: string, reason: string): Promise<void> {
    const { error } = await this.client.rpc('void_round', {
      p_round_id: roundId, p_reason: reason,
    })
    if (error) throw new Error(error.message)
  }

  async listTransactions(gameId: string, playerId?: string): Promise<Transaction[]> {
    let q = this.client.from('transactions').select('*')
      .eq('game_id', gameId).order('created_at', { ascending: false })
    if (playerId) q = q.eq('player_id', playerId)
    const rows = await this.run(q)
    return rows.map(toTransaction)
  }

  async addAdjustment(
    gameId: string, playerId: string, amount: number, note: string,
  ): Promise<void> {
    await this.run(
      this.client.from('transactions').insert({
        game_id: gameId,
        player_id: playerId,
        amount,
        transaction_type: 'adjustment',
        metadata: { note },
      }).select(),
    )
    await this.client.rpc('reconcile_game', { p_game_id: gameId })
  }

  subscribe(gameId: string, onChange: () => void): () => void {
    const channel = this.client
      .channel('game:' + gameId)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rounds', filter: 'game_id=eq.' + gameId },
        onChange)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: 'game_id=eq.' + gameId },
        onChange)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: 'id=eq.' + gameId },
        onChange)
      .subscribe()
    return () => { void this.client.removeChannel(channel) }
  }

  /** Uploads a hand photo and returns its storage path. */
  async uploadPhoto(gameId: string, blob: Blob): Promise<string | null> {
    const path = gameId + '/' + crypto.randomUUID() + '.jpg'
    const { error } = await this.client.storage.from('hands').upload(path, blob, {
      contentType: 'image/jpeg', upsert: false,
    })
    if (error) return null
    return path
  }

  photoUrl(path: string): string {
    return this.client.storage.from('hands').getPublicUrl(path).data.publicUrl
  }
}
