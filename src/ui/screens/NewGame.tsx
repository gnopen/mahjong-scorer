import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store } from '../../db'
import { usePlayers } from '../../state/useGame'
import { RULE_SETS } from '../../engine/ruleset'
import type { WindPosition } from '../../engine/hand'
import {
  GUIDE_WALL_RULES, WIND_GLYPH, WIND_LABEL, WIND_ORDER, drawForSeats,
  type WallCountFrom, type WallThrows,
} from '../../engine/setup'
import { Banner, Screen, Section, Spinner } from '../components/Layout'
import { Tile } from '../components/Tile'

const COLORS = ['#e9b949', '#38bdf8', '#f472b6', '#4ade80', '#fb923c', '#a78bfa']
const WIND_TILE_ID: Record<WindPosition, string> = {
  east: 'we', south: 'ws', west: 'ww', north: 'wn',
}

function todayName(): string {
  const day = new Date().toLocaleDateString(undefined, { weekday: 'long' })
  return day + ' Mahjong'
}

export function NewGame() {
  const navigate = useNavigate()
  const { players, loading, refresh } = usePlayers()

  const [ruleSetId, setRuleSetId] = useState(RULE_SETS[0].id)
  const [name, setName] = useState(todayName())
  const [startingBalance, setStartingBalance] = useState(0)
  const [pointValue, setPointValue] = useState(1)
  // Home games usually let anything win, so the default is 0. The guide's
  // tournament figure of 8 is one tap away.
  const [minimumPoints, setMinimumPoints] = useState(0)
  const [wallThrows, setWallThrows] = useState<WallThrows>(GUIDE_WALL_RULES.throws)
  const [wallCountFrom, setWallCountFrom] =
    useState<WallCountFrom>(GUIDE_WALL_RULES.countFrom)
  // Index in this array is the seat: 0 is East, then South, West, North, the
  // order the guide counts winds in.
  const [seats, setSeats] = useState<Array<string | null>>([null, null, null, null])
  const [drawn, setDrawn] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ruleSet = RULE_SETS.find((r) => r.id === ruleSetId)!
  const filled = seats.filter(Boolean).length
  const ready = filled === ruleSet.playerCount && name.trim().length > 0

  const assign = (seat: number, playerId: string) => {
    setSeats((s) =>
      s.map((v, i) => (i === seat ? (v === playerId ? null : playerId) : v === playerId ? null : v)))
    setDrawn(false)
  }

  /**
   * "the players each draw one of the 4 Winds. The player who draws the East
   * Wind will take the East side of the table."
   */
  const drawSeats = () => {
    const seated = seats.filter(Boolean) as string[]
    const pool = seated.length === 4
      ? seated
      : [...seated, ...players.filter((p) => !seats.includes(p.id)).map((p) => p.id)]
    const four = pool.slice(0, 4)
    if (four.length < 4) return
    const next: Array<string | null> = [null, null, null, null]
    for (const { playerId, wind } of drawForSeats(four)) {
      next[WIND_ORDER.indexOf(wind)] = playerId
    }
    setSeats(next)
    setDrawn(true)
  }

  const addPlayer = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      const color = COLORS[players.length % COLORS.length]
      const p = await store().createPlayer(trimmed, color)
      setNewName('')
      await refresh()
      const empty = seats.findIndex((s) => s === null)
      if (empty >= 0) assign(empty, p.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const startGame = async () => {
    setBusy(true)
    setError(null)
    try {
      const game = await store().createGame({
        name: name.trim(),
        ruleSetId,
        startingBalance,
        pointValue,
        minimumPoints,
        wallRules: { throws: wallThrows, countFrom: wallCountFrom },
        prevalentWind: 'east',
        dealerSeat: 0,
        players: seats
          .map((playerId, seat) => ({ playerId: playerId as string, seat }))
          .filter((p) => p.playerId),
      })
      navigate('/game/' + game.id, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  if (loading) return <Screen title="New game" back="/"><Spinner label="Loading players" /></Screen>

  return (
    <Screen title="New game" back="/">
      {error ? (
        <div className="mb-4"><Banner tone="error" title="Could not start the game">{error}</Banner></div>
      ) : null}

      <Section title="Rule set">
        <div className="space-y-2">
          {RULE_SETS.map((rs) => (
            <button
              key={rs.id}
              onClick={() => setRuleSetId(rs.id)}
              className={
                'card w-full text-left transition ' +
                (rs.id === ruleSetId ? 'border-gold/70 bg-felt/20' : '')
              }
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold">{rs.name}</span>
                <span className="chip">{rs.playerCount} players</span>
              </span>
              <span className="mt-1 block text-xs text-slate-400">{rs.description}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Game name">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Friday Mahjong"
        />
      </Section>

      <Section
        title="Draw for seats"
        hint="Each player draws a wind. Whoever draws East takes the East side and deals the first hand."
        right={
          <button className="text-xs font-semibold text-gold" onClick={drawSeats}>
            Draw winds
          </button>
        }
      >
        {drawn ? (
          <div className="mb-2">
            <Banner tone="good" title="Winds drawn">
              {seats
                .map((id, i) =>
                  (players.find((p) => p.id === id)?.name ?? '?') + ' drew ' +
                  WIND_LABEL[WIND_ORDER[i]])
                .join(', ')}
              .
            </Banner>
          </div>
        ) : null}

        <div className="space-y-2">
          {seats.map((playerId, seat) => {
            const player = players.find((p) => p.id === playerId)
            const wind = WIND_ORDER[seat]
            return (
              <div key={seat} className="card">
                <div className="mb-2 flex items-center gap-2">
                  <Tile id={WIND_TILE_ID[wind]} size="xs" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {WIND_LABEL[wind]} {WIND_GLYPH[wind]}
                  </span>
                  {seat === 0 ? (
                    <span className="chip border-gold/50 text-gold">Deals first</span>
                  ) : null}
                </div>
                {player ? (
                  <button
                    onClick={() => assign(seat, player.id)}
                    className="flex w-full items-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-left"
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: player.color }} />
                    <span className="flex-1 font-semibold">{player.name}</span>
                    <span className="text-xs text-slate-500">Tap to clear</span>
                  </button>
                ) : (
                  <div className="scroll-x">
                    {players
                      .filter((p) => !seats.includes(p.id))
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => assign(seat, p.id)}
                          className="shrink-0 rounded-xl border border-ink-line bg-ink px-3 py-2 text-sm font-medium"
                        >
                          {p.name}
                        </button>
                      ))}
                    {players.filter((p) => !seats.includes(p.id)).length === 0 ? (
                      <span className="py-2 text-xs text-slate-500">
                        Add a player below.
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="mt-2 px-1 text-[11px] text-slate-500">
          Seats rotate every hand, so this only fixes who starts where. Tap a name to clear
          it, or draw again.
        </p>

        <div className="mt-3 flex gap-2">
          <input
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addPlayer() }}
            placeholder="Add a new player"
          />
          <button className="btn-ghost shrink-0" disabled={busy || !newName.trim()}
            onClick={() => void addPlayer()}>
            Add
          </button>
        </div>
      </Section>

      <Section title="Stakes">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="start">Starting balance</label>
            <input
              id="start"
              className="input"
              type="number"
              inputMode="numeric"
              value={startingBalance}
              onChange={(e) => setStartingBalance(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="label" htmlFor="value">Value per point</label>
            <input
              id="value"
              className="input"
              type="number"
              inputMode="decimal"
              value={pointValue}
              onChange={(e) => setPointValue(Number(e.target.value) || 1)}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Scores are always kept in Chinese Official points. The value per point only
          changes what the scoreboard shows alongside them.
        </p>
      </Section>

      <Section
        title="Minimum to declare"
        hint="How many points a hand needs before it can be called."
      >
        <div className="card">
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 4, 8].map((n) => (
              <button
                key={n}
                onClick={() => setMinimumPoints(n)}
                className={
                  'rounded-xl border py-2.5 text-sm font-bold transition ' +
                  (minimumPoints === n
                    ? 'border-gold bg-gold/15 text-gold'
                    : 'border-ink-line bg-ink text-slate-300')
                }
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <label className="label" htmlFor="minimum">Or set your own</label>
            <input
              id="minimum"
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              value={minimumPoints}
              onChange={(e) => setMinimumPoints(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {minimumPoints === 0
              ? 'Any legal hand can be declared. Nothing is ever scored as short.'
              : 'A hand under ' + minimumPoints + ' points counts as declaring short, ' +
                'which costs ' + ruleSet.falseDeclaration.perPlayer * 3 + ' points.'}
            {' '}The guide plays 8 for tournaments; most home games play 0 or 1.
          </p>
        </div>
      </Section>

      <Section
        title="Breaking the wall"
        hint="How your table throws for the break. The guide throws twice and counts from the right."
      >
        <div className="card space-y-3">
          <div>
            <p className="label">Dice throws</p>
            <div className="grid grid-cols-2 gap-2">
              {([2, 1] as WallThrows[]).map((n) => (
                <button
                  key={n}
                  onClick={() => setWallThrows(n)}
                  className={
                    'rounded-xl border px-2 py-2.5 text-xs font-semibold transition ' +
                    (wallThrows === n
                      ? 'border-gold bg-gold/15 text-gold'
                      : 'border-ink-line bg-ink text-slate-300')
                  }
                >
                  {n === 2 ? 'Two throws (guide)' : 'One throw'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {wallThrows === 2
                ? 'East throws to pick whose wall, then that player throws to pick the stack.'
                : 'East throws once and the same total picks both the wall and the stack.'}
            </p>
          </div>

          <div>
            <p className="label">Count stacks from</p>
            <div className="grid grid-cols-2 gap-2">
              {(['right', 'left'] as WallCountFrom[]).map((side) => (
                <button
                  key={side}
                  onClick={() => setWallCountFrom(side)}
                  className={
                    'rounded-xl border px-2 py-2.5 text-xs font-semibold transition ' +
                    (wallCountFrom === side
                      ? 'border-gold bg-gold/15 text-gold'
                      : 'border-ink-line bg-ink text-slate-300')
                  }
                >
                  {side === 'right' ? 'Right end (guide)' : 'Left end'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              The dead wall always sits to the right of the gap, whichever end you count
              from, because that is set by the direction tiles are drawn.
            </p>
          </div>
        </div>
      </Section>

      <button
        className="btn-gold w-full text-base"
        disabled={!ready || busy}
        onClick={() => void startGame()}
      >
        {busy ? 'Starting' : 'Start game'}
      </button>
      {!ready ? (
        <p className="mt-2 text-center text-xs text-slate-500">
          Seat {ruleSet.playerCount} players and name the game to start.
        </p>
      ) : null}
    </Screen>
  )
}
