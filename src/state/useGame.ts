import { useCallback, useEffect, useState } from 'react'
import { store } from '../db'
import type { GameDetail, Player, Round, Transaction } from '../db/types'

export interface GameData {
  game: GameDetail | null
  rounds: Round[]
  transactions: Transaction[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Loads a game and keeps it live. The Supabase store pushes Postgres changes
 * and the local store broadcasts between tabs, so both backends refresh the
 * scoreboard on every phone the moment a round is saved.
 */
export function useGame(gameId: string | undefined): GameData {
  const [game, setGame] = useState<GameDetail | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!gameId) return
    try {
      const s = store()
      const [g, r, t] = await Promise.all([
        s.getGame(gameId),
        s.listRounds(gameId),
        s.listTransactions(gameId),
      ])
      setGame(g)
      setRounds(r)
      setTransactions(t)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [gameId])

  useEffect(() => {
    setLoading(true)
    void refresh()
    if (!gameId) return
    return store().subscribe(gameId, () => void refresh())
  }, [gameId, refresh])

  return { game, rounds, transactions, loading, error, refresh }
}

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setPlayers(await store().listPlayers())
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  return { players, loading, refresh }
}
