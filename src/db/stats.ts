/**
 * Player statistics derived from the ledger. Voided rounds are excluded from
 * counts and their reversals cancel out in the totals, so a corrected round
 * leaves no trace in the averages.
 */

import type { GamePlayer, PlayerStats, Round, Transaction } from './types'

export function stats(
  players: GamePlayer[],
  rounds: Round[],
  transactions: Transaction[],
): PlayerStats[] {
  const live = rounds.filter((r) => !r.voidedAt)

  return players.map((p) => {
    const wins = live.filter(
      (r) => r.outcome === 'win' && r.winnerPlayerId === p.playerId,
    )
    const played = live.filter((r) => r.outcome === 'win')
    const mine = transactions.filter(
      (t) => t.playerId === p.playerId && t.type !== 'reversal',
    )
    const reversed = new Set(
      transactions
        .filter((t) => t.type === 'reversal')
        .map((t) => String(t.metadata.reverses)),
    )
    const effective = mine.filter((t) => !reversed.has(t.id))

    const gains = effective.filter((t) => t.amount > 0)
    const losses = effective.filter((t) => t.amount < 0)

    return {
      playerId: p.playerId,
      name: p.name,
      balance: p.balance,
      roundsPlayed: played.length,
      wins: wins.length,
      losses: played.length - wins.length,
      winRate: played.length === 0 ? 0 : wins.length / played.length,
      averageWinningScore:
        wins.length === 0
          ? 0
          : Math.round(wins.reduce((n, r) => n + r.totalPoints, 0) / wins.length),
      biggestWin: gains.reduce((n, t) => Math.max(n, t.amount), 0),
      biggestLoss: losses.reduce((n, t) => Math.min(n, t.amount), 0),
      pointsWon: gains.reduce((n, t) => n + t.amount, 0),
      pointsLost: losses.reduce((n, t) => n + t.amount, 0),
      selfDraws: wins.filter((r) => r.selfDraw).length,
      discardsPaid: live.filter((r) => r.discarderPlayerId === p.playerId).length,
    }
  })
}
