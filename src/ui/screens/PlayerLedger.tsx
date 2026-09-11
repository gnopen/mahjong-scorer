import { Link, useParams } from 'react-router-dom'
import { stats } from '../../db'
import { useGame } from '../../state/useGame'
import { Banner, Money, Screen, Section, Spinner } from '../components/Layout'

const WIND_LABEL = { east: 'East', south: 'South', west: 'West', north: 'North' } as const

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-base font-bold tabular-nums">{value}</p>
    </div>
  )
}

export function PlayerLedger() {
  const { gameId, playerId } = useParams()
  const { game, rounds, transactions, loading } = useGame(gameId)

  if (loading || !game) {
    return <Screen title="Player" back={'/game/' + gameId}><Spinner label="Loading" /></Screen>
  }

  const player = game.players.find((p) => p.playerId === playerId)
  if (!player) {
    return (
      <Screen title="Player" back={'/game/' + gameId}>
        <Banner tone="error" title="Player not found">This player is not in this game.</Banner>
      </Screen>
    )
  }

  const s = stats(game.players, rounds, transactions).find((x) => x.playerId === playerId)!
  const mine = transactions.filter((t) => t.playerId === playerId)
  const roundOf = (roundId: string | null) =>
    rounds.find((r) => r.id === roundId)

  return (
    <Screen title={player.name} back={'/game/' + gameId} subtitle={WIND_LABEL[player.seatWind] + ' seat · ' + game.name}>
      <div className="card mb-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Current balance
        </p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums">
          <Money value={player.balance} />
        </p>
        {game.pointValue !== 1 ? (
          <p className="mt-1 text-sm text-slate-400">
            {(player.balance * game.pointValue).toLocaleString()} at {game.pointValue} per point
          </p>
        ) : null}
      </div>

      <Section title="Record">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Rounds played" value={String(s.roundsPlayed)} />
          <Stat label="Wins" value={String(s.wins)} />
          <Stat label="Win rate" value={Math.round(s.winRate * 100) + '%'} />
          <Stat label="Self-draws" value={String(s.selfDraws)} />
          <Stat label="Average winning score" value={String(s.averageWinningScore)} />
          <Stat label="Deal-ins" value={String(s.discardsPaid)} />
          <Stat label="Biggest win" value={'+' + s.biggestWin.toLocaleString()} />
          <Stat label="Biggest loss" value={s.biggestLoss.toLocaleString()} />
          <Stat label="Points won" value={'+' + s.pointsWon.toLocaleString()} />
          <Stat label="Points lost" value={s.pointsLost.toLocaleString()} />
        </div>
      </Section>

      <Section title="Ledger" hint="Every entry, including reversals from voided rounds.">
        {mine.length === 0 ? (
          <div className="card text-center text-sm text-slate-400">Nothing recorded yet.</div>
        ) : (
          <ul className="card divide-y divide-ink-line/50 p-0">
            {mine.map((t) => {
              const round = roundOf(t.roundId)
              const body = (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold capitalize">
                      {t.type === 'win' ? 'Win' :
                        t.type === 'payment' ? 'Payment' :
                          t.type === 'reversal' ? 'Reversal' : t.type}
                      {round ? ' · round ' + round.roundNumber : ''}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {String(t.metadata.reason ?? t.metadata.note ?? '')}
                    </span>
                  </span>
                  <Money value={t.amount} />
                </div>
              )
              return (
                <li key={t.id}>
                  {t.roundId ? (
                    <Link to={'/game/' + game.id + '/round/' + t.roundId}>{body}</Link>
                  ) : body}
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </Screen>
  )
}
