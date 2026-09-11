import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { photoUrl, store } from '../../db'
import { useGame } from '../../state/useGame'
import { Banner, Empty, Money, Screen, Section, Spinner } from '../components/Layout'
import { Tile } from '../components/Tile'
import { ScoreBreakdownView } from '../components/ScoreBreakdownView'

export function RoundHistory() {
  const { gameId } = useParams()
  const { game, rounds, loading } = useGame(gameId)

  if (loading || !game) {
    return <Screen title="Round history" back={'/game/' + gameId}><Spinner label="Loading rounds" /></Screen>
  }

  return (
    <Screen title="Round history" back={'/game/' + gameId} subtitle={game.name}>
      {rounds.length === 0 ? (
        <Empty title="No rounds yet" body="Every scored hand is kept here with its tiles, its reasoning and its payments." />
      ) : (
        <ul className="space-y-2">
          {rounds.map((r) => {
            const winner = game.players.find((p) => p.playerId === r.winnerPlayerId)
            return (
              <li key={r.id}>
                <Link
                  to={'/game/' + game.id + '/round/' + r.id}
                  className={'card block ' + (r.voidedAt ? 'opacity-50' : '')}
                >
                  <div className="flex items-center gap-3">
                    <span className="chip shrink-0">#{r.roundNumber}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {r.outcome === 'draw'
                          ? 'Drawn hand'
                          : r.outcome === 'penalty'
                            ? (winner?.name ?? 'Someone') + ' declared short'
                            : winner?.name ?? 'Unknown winner'}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {r.outcome === 'penalty'
                          ? 'Below the minimum, penalty paid'
                          : r.selfDraw ? 'Self-draw' : 'Won on a discard'} ·{' '}
                        {r.source === 'photo' ? 'From a photo' : 'Entered by hand'} ·{' '}
                        {new Date(r.createdAt).toLocaleTimeString([], {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-bold tabular-nums text-gold">{r.totalPoints}</span>
                      <span className="block text-[10px] uppercase text-slate-500">points</span>
                    </span>
                  </div>
                  {r.hand ? (
                    <div className="mt-2 flex flex-wrap gap-0.5">
                      {(() => {
                        const all = [...r.hand.concealed, ...r.hand.melds.flatMap((m) => m.tiles)]
                        const winAt = all.indexOf(r.hand.winningTile)
                        return all.map((id, i) => (
                          <Tile key={id + i} id={id} size="xs" winning={i === winAt} />
                        ))
                      })()}
                    </div>
                  ) : null}
                  {r.voidedAt ? (
                    <p className="mt-2 text-xs font-semibold text-loser">
                      Voided · {r.voidReason}
                    </p>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Screen>
  )
}

export function RoundDetail() {
  const { gameId, roundId } = useParams()
  const navigate = useNavigate()
  const { game, rounds, loading, refresh } = useGame(gameId)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  if (loading || !game) {
    return <Screen title="Round" back={'/game/' + gameId + '/rounds'}><Spinner label="Loading" /></Screen>
  }

  const round = rounds.find((r) => r.id === roundId)
  if (!round) {
    return (
      <Screen title="Round" back={'/game/' + gameId + '/rounds'}>
        <Banner tone="error" title="Round not found">It may have been removed on another device.</Banner>
      </Screen>
    )
  }

  const winner = game.players.find((p) => p.playerId === round.winnerPlayerId)

  const voidRound = async () => {
    setBusy(true)
    await store().voidRound(round.id, 'Corrected from round history')
    await refresh()
    setBusy(false)
    setConfirming(false)
    navigate('/game/' + game.id + '/rounds')
  }

  return (
    <Screen
      title={'Round ' + round.roundNumber}
      back={'/game/' + gameId + '/rounds'}
      subtitle={new Date(round.createdAt).toLocaleString()}
    >
      {round.outcome === 'penalty' ? (
        <div className="mb-4">
          <Banner tone="warn" title="Declared below the minimum">
            The hand was revealed without reaching the 8-point minimum, so the guide&rsquo;s
            penalty was charged: 30 points from the declarer, 10 to each of the others. The
            breakdown below is what the hand would have scored.
          </Banner>
        </div>
      ) : null}

      {round.voidedAt ? (
        <div className="mb-4">
          <Banner tone="warn" title="This round has been voided">
            <p>{round.voidReason}</p>
            <p className="mt-1">
              The original transactions are kept and matching reversals were written, so the
              ledger still adds up.
            </p>
          </Banner>
        </div>
      ) : null}

      {round.photoPath ? (
        <Section title="The photo">
          <img
            src={photoUrl(round.photoPath)}
            alt={'The winning hand in round ' + round.roundNumber}
            className="w-full rounded-xl border border-ink-line"
          />
        </Section>
      ) : null}

      {round.hand ? (
        <Section title="The hand">
          <div className="card space-y-3">
            <div>
              <p className="label">Concealed</p>
              <div className="flex flex-wrap gap-1">
                {round.hand.concealed.map((id, i) => (
                  <Tile
                    key={id + i}
                    id={id}
                    size="sm"
                    winning={i === round.hand!.concealed.indexOf(round.hand!.winningTile)}
                  />
                ))}
              </div>
            </div>
            {round.hand.melds.length > 0 ? (
              <div>
                <p className="label">Melds</p>
                <div className="flex flex-wrap gap-3">
                  {round.hand.melds.map((m, i) => (
                    <div key={i} className="flex gap-0.5">
                      {m.tiles.map((id, j) => <Tile key={id + j} id={id} size="sm" />)}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {round.hand.bonusTiles.length > 0 ? (
              <div>
                <p className="label">Flowers and seasons</p>
                <div className="flex gap-1">
                  {round.hand.bonusTiles.map((id) => <Tile key={id} id={id} size="sm" />)}
                </div>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {round.score ? (
        <ScoreBreakdownView
          score={round.score}
          payment={round.payment}
          winnerName={winner?.name ?? 'Unknown'}
          pointValue={game.pointValue}
        />
      ) : (
        <div className="card">
          <p className="text-sm text-slate-400">This round was recorded without a hand breakdown.</p>
          <ul className="mt-3 divide-y divide-ink-line/50">
            {(round.payment?.lines ?? []).map((l) => (
              <li key={l.playerId} className="flex justify-between py-2">
                <span>{l.name}</span>
                <Money value={l.amount} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {!round.voidedAt && game.status === 'active' ? (
        <div className="mt-5">
          {confirming ? (
            <Banner tone="warn" title="Void this round?">
              <p>
                Balances go back to what they were before it. The round stays in history,
                marked as voided.
              </p>
              <div className="mt-3 flex gap-2">
                <button className="btn-danger flex-1" disabled={busy} onClick={() => void voidRound()}>
                  Void round
                </button>
                <button className="btn-ghost flex-1" onClick={() => setConfirming(false)}>
                  Keep it
                </button>
              </div>
            </Banner>
          ) : (
            <button className="btn-danger w-full" onClick={() => setConfirming(true)}>
              Void this round
            </button>
          )}
        </div>
      ) : null}
    </Screen>
  )
}
