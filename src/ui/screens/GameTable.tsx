import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { store } from '../../db'
import { useGame } from '../../state/useGame'
import { useHandDraft } from '../../state/handDraft'
import { Banner, Money, Screen, Section, Spinner } from '../components/Layout'
import { useRecognizerStatus } from '../../state/useRecognizer'
import { ruleSetFor } from '../../engine/ruleset'
import { Compass } from '../components/Compass'
import { useSeatClaim } from '../../state/useSeat'
import {
  HANDS_PER_GAME, WIND_LABEL, handWithinRound, type WallCountFrom, type WallThrows,
} from '../../engine/setup'

export function GameTable() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { game, rounds, loading, error, refresh } = useGame(gameId)
  const start = useHandDraft((s) => s.start)
  const { status: recognizer } = useRecognizerStatus()
  const { seat: mySeat } = useSeatClaim(gameId)
  const [busy, setBusy] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [editingMinimum, setEditingMinimum] = useState(false)

  if (loading) return <Screen title="Game" back="/"><Spinner label="Loading the table" /></Screen>
  if (error || !game) {
    return (
      <Screen title="Game" back="/">
        <Banner tone="error" title="This game could not be loaded">
          {error ?? 'It may have been deleted on another device.'}
        </Banner>
      </Screen>
    )
  }

  const live = rounds.filter((r) => !r.voidedAt)
  const lastRound = live[0]
  const leader = [...game.players].sort((a, b) => b.balance - a.balance)[0]

  const beginScoring = (source: 'manual' | 'photo') => {
    start(game.id, source)
    navigate(source === 'photo' ? '/game/' + game.id + '/capture' : '/game/' + game.id + '/tiles')
  }

  const undoLast = async () => {
    if (!lastRound) return
    setBusy(true)
    await store().voidRound(lastRound.id, 'Undone from the table')
    await refresh()
    setBusy(false)
  }

  const changeMinimum = async (n: number) => {
    setBusy(true)
    await store().setMinimumPoints(game.id, n)
    await refresh()
    setBusy(false)
  }

  const changeWallRules = async (
    change: { throws?: WallThrows; countFrom?: WallCountFrom },
  ) => {
    setBusy(true)
    await store().setWallRules(game.id, { ...game.wallRules, ...change })
    await refresh()
    setBusy(false)
  }

  const endGame = async () => {
    setBusy(true)
    await store().endGame(game.id)
    await refresh()
    setBusy(false)
    setConfirmEnd(false)
  }

  return (
    <Screen
      title={game.name}
      back="/"
      subtitle={
        <>
          Hand {game.handNumber} of {HANDS_PER_GAME} ·{' '}
          {WIND_LABEL[game.prevalentWind]} round {handWithinRound(game.handNumber)}/4 ·{' '}
          {game.status === 'finished' ? 'finished' : 'in progress'}
        </>
      }
    >
      <Section>
        <div className="card p-0">
          <ul className="divide-y divide-ink-line/60">
            {[...game.players].sort((a, b) => b.balance - a.balance).map((p) => (
              <li key={p.playerId}>
                <Link
                  to={'/game/' + game.id + '/player/' + p.playerId}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-ink"
                    style={{ background: p.color }}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{p.name}</span>
                      {p.seat === game.dealerSeat ? (
                        <span className="chip border-gold/50 text-gold">Dealer</span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {WIND_LABEL[p.seatWind]} seat
                      {game.pointValue !== 1
                        ? ' · ' + (p.balance * game.pointValue).toLocaleString()
                        : ''}
                    </span>
                  </span>
                  <Money value={p.balance} className="text-lg" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {live.length > 0 ? (
          <p className="mt-2 px-1 text-center text-xs text-slate-500">
            {leader.name} leads after {live.length} hand{live.length === 1 ? '' : 's'}.
          </p>
        ) : null}
      </Section>

      {game.status === 'active' ? (
        <>
          <Section
            title="Everyone's tiles"
            hint="Each player enters their own hand on their own phone while the hand is played."
            right={
              <Link
                to={'/game/' + game.id + '/me'}
                className="text-xs font-semibold text-gold"
              >
                {mySeat === null ? 'Claim a seat' : 'My hand'}
              </Link>
            }
          >
            <ul className="card divide-y divide-ink-line/50 p-0">
              {[...game.players].sort((a, b) => a.seat - b.seat).map((p) => {
                const draft = game.drafts?.[String(p.seat)]
                const kongs = (draft?.melds ?? []).filter((m) => m.kind === 'kong').length
                const held = draft
                  ? draft.concealed.length +
                    draft.melds.reduce((n, m) => n + m.tiles.length, 0)
                  : 0
                const expected = 13 + kongs
                const ready = held === expected
                return (
                  <li key={p.playerId} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: p.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {p.name}
                      {p.seat === mySeat ? (
                        <span className="ml-1.5 text-[10px] uppercase text-gold">you</span>
                      ) : null}
                    </span>
                    <span
                      className={
                        'shrink-0 text-xs tabular-nums ' +
                        (ready ? 'text-winner' : held > 0 ? 'text-amber-300' : 'text-slate-600')
                      }
                    >
                      {held} / {expected}
                      {ready ? ' ready' : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
            <Link
              to={'/game/' + game.id + '/me'}
              className="btn-ghost mt-2 w-full"
            >
              {mySeat === null
                ? 'This is my phone, claim a seat'
                : 'Open my hand'}
            </Link>
          </Section>

          <Section
            title="Seats this hand"
            right={
              <Link
                to={'/game/' + game.id + '/rotation'}
                className="text-xs font-semibold text-gold"
              >
                Rotation
              </Link>
            }
          >
            <div className="card">
              <Compass
                seats={[...game.players]
                  .sort((a, b) => a.seat - b.seat)
                  .map((p) => ({ seat: p.seat, name: p.name, color: p.color }))}
                handNumber={game.handNumber}
                prevalentWind={game.prevalentWind}
              />
            </div>
          </Section>

          <Section
            title="House rules"
            right={
              <button
                className="text-xs font-semibold text-gold"
                onClick={() => setEditingMinimum((v) => !v)}
              >
                {editingMinimum ? 'Done' : 'Change'}
              </button>
            }
          >
            <div className="card">
              <p className="text-sm">
                <span className="font-semibold text-slate-100">
                  {game.minimumPoints === 0
                    ? 'No minimum'
                    : 'Minimum ' + game.minimumPoints + ' points'}
                </span>
                {' · '}
                <span className="text-slate-400">
                  {game.minimumPoints === 0
                    ? 'any legal hand can be declared'
                    : 'a shorter hand costs a ' +
                      ruleSetFor(game.ruleSetId, game.minimumPoints)
                        .falseDeclaration.perPlayer * 3 + ' point penalty'}
                </span>
              </p>
              <p className="mt-1.5 text-sm">
                <span className="font-semibold text-slate-100">
                  {game.wallRules.throws === 1 ? 'One dice throw' : 'Two dice throws'}
                </span>
                {' · '}
                <span className="text-slate-400">
                  count from the {game.wallRules.countFrom}
                </span>
              </p>

              {editingMinimum ? (
                <div className="mt-3 space-y-3 border-t border-ink-line pt-3">
                  <div>
                    <p className="label">Minimum points to declare</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 4, 8].map((n) => (
                        <button
                          key={n}
                          disabled={busy}
                          onClick={() => void changeMinimum(n)}
                          className={
                            'rounded-xl border py-2 text-sm font-bold transition ' +
                            (game.minimumPoints === n
                              ? 'border-gold bg-gold/15 text-gold'
                              : 'border-ink-line bg-ink text-slate-300')
                          }
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="label">Dice throws for the wall</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([2, 1] as WallThrows[]).map((n) => (
                        <button
                          key={n}
                          disabled={busy}
                          onClick={() => void changeWallRules({ throws: n })}
                          className={
                            'rounded-xl border px-2 py-2 text-xs font-semibold transition ' +
                            (game.wallRules.throws === n
                              ? 'border-gold bg-gold/15 text-gold'
                              : 'border-ink-line bg-ink text-slate-300')
                          }
                        >
                          {n === 2 ? 'Two throws (guide)' : 'One throw'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="label">Count stacks from</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['right', 'left'] as WallCountFrom[]).map((side) => (
                        <button
                          key={side}
                          disabled={busy}
                          onClick={() => void changeWallRules({ countFrom: side })}
                          className={
                            'rounded-xl border px-2 py-2 text-xs font-semibold capitalize transition ' +
                            (game.wallRules.countFrom === side
                              ? 'border-gold bg-gold/15 text-gold'
                              : 'border-ink-line bg-ink text-slate-300')
                          }
                        >
                          {side === 'right' ? 'Right (guide)' : 'Left'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Changing either of these clears the throws already recorded for this
                    hand, so the wall is rebuilt under the new rule.
                  </p>
                </div>
              ) : null}
            </div>
          </Section>

          <Section title="The wall">
            {game.wall && game.wall.breakIndex !== null ? (
              <Link to={'/game/' + game.id + '/wall'} className="card block">
                <p className="text-sm text-slate-300">{game.wall.instruction}</p>
                <p className="mt-2 text-xs font-semibold text-gold">
                  Broken in {WIND_LABEL[game.wall.wallWind]}&rsquo;s wall,{' '}
                  {game.wall.counted} stacks from the {game.wall.countFrom}
                </p>
              </Link>
            ) : (
              <Link to={'/game/' + game.id + '/wall'} className="btn-ghost w-full">
                Throw the dice and break the wall
              </Link>
            )}
          </Section>

          <button
            onClick={() => beginScoring('photo')}
            className="btn-gold mb-2 w-full py-5 text-base"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Score winning hand
          </button>
          {recognizer ? (
            <p className={
              'mb-2 text-center text-[11px] ' +
              (recognizer.ready ? 'text-slate-500' : 'text-amber-300/80')
            }>
              {recognizer.ready
                ? recognizer.detail
                : 'Recognition is unavailable, so this opens the tile picker.'}
            </p>
          ) : null}

          <div className="mb-5 grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => beginScoring('manual')}>
              Manual entry
            </button>
            <button
              className="btn-ghost"
              disabled={!lastRound || busy}
              onClick={() => void undoLast()}
            >
              Undo last round
            </button>
            <Link className="btn-ghost" to={'/game/' + game.id + '/rounds'}>
              Round history
            </Link>
            <button className="btn-danger" onClick={() => setConfirmEnd(true)}>
              End game
            </button>
          </div>
        </>
      ) : (
        <div className="mb-5">
          <Banner tone="info" title="This game has finished">
            The scoreboard and every round are kept. Start a new game from the home screen.
          </Banner>
        </div>
      )}

      {confirmEnd ? (
        <div className="mb-5">
          <Banner tone="warn" title="End this game?">
            <p>Balances stay exactly as they are and the game moves to history.</p>
            <div className="mt-3 flex gap-2">
              <button className="btn-danger flex-1" disabled={busy} onClick={() => void endGame()}>
                End game
              </button>
              <button className="btn-ghost flex-1" onClick={() => setConfirmEnd(false)}>
                Keep playing
              </button>
            </div>
          </Banner>
        </div>
      ) : null}

      <Section
        title="Recent rounds"
        right={
          <Link to={'/game/' + game.id + '/rounds'} className="text-xs font-semibold text-gold">
            See all
          </Link>
        }
      >
        {live.length === 0 ? (
          <div className="card text-center text-sm text-slate-400">
            No rounds yet. Photograph the first winning hand to get started.
          </div>
        ) : (
          <ul className="space-y-2">
            {live.slice(0, 4).map((r) => {
              const winner = game.players.find((p) => p.playerId === r.winnerPlayerId)
              return (
                <li key={r.id}>
                  <Link
                    to={'/game/' + game.id + '/round/' + r.id}
                    className="card flex items-center gap-3"
                  >
                    <span className="chip shrink-0">#{r.roundNumber}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {r.outcome === 'draw'
                          ? 'Drawn hand'
                          : r.outcome === 'penalty'
                            ? (winner?.name ?? 'Someone') + ' declared short'
                            : winner?.name ?? 'Unknown'}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {r.outcome === 'penalty'
                          ? 'Penalty paid'
                          : r.selfDraw ? 'Self-draw' : 'Won on a discard'} ·{' '}
                        {new Date(r.createdAt).toLocaleTimeString([], {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-bold tabular-nums text-gold">
                        {r.totalPoints}
                      </span>
                      <span className="block text-[10px] uppercase text-slate-500">points</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </Screen>
  )
}
