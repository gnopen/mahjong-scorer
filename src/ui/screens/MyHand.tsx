import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { store } from '../../db'
import type { SeatDraft } from '../../db/types'
import { useGame } from '../../state/useGame'
import { useSeatClaim } from '../../state/useSeat'
import { useHandDraft } from '../../state/handDraft'
import { countTiles, sortTiles, type TileId } from '../../engine/tiles'
import type { Meld } from '../../engine/hand'
import { WIND_GLYPH, WIND_LABEL } from '../../engine/setup'
import { ruleSetFor } from '../../engine/ruleset'
import { Banner, Screen, Section, Spinner } from '../components/Layout'
import { Tile } from '../components/Tile'
import { TilePicker } from '../components/TilePicker'

function meldFrom(tiles: TileId[]): Meld | null {
  const sorted = sortTiles(tiles)
  if (sorted.length === 4 && new Set(sorted).size === 1) {
    return { kind: 'kong', tiles: sorted, concealed: false }
  }
  if (sorted.length !== 3) return null
  if (new Set(sorted).size === 1) return { kind: 'pung', tiles: sorted, concealed: false }
  return { kind: 'chow', tiles: sorted, concealed: false }
}

/**
 * One player's own tiles for the hand in progress, on their own phone.
 *
 * Entering happens during play, in the gaps between turns, so declaring a win
 * is one tap plus the winning tile rather than a full hand typed out while
 * everybody waits.
 */
export function MyHand() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { game, loading, refresh } = useGame(gameId)
  const { seat, claim, release } = useSeatClaim(gameId)
  const draftStore = useHandDraft()

  const [concealed, setConcealed] = useState<TileId[]>([])
  const [melds, setMelds] = useState<Meld[]>([])
  const [bonusTiles, setBonusTiles] = useState<TileId[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stored = seat === null ? undefined : game?.drafts?.[String(seat)]
  const stamp = game ? game.id + ':' + game.handNumber + ':' + seat : null

  // Load the stored tiles once per hand, then leave local state alone so
  // typing is never interrupted by a sync coming back.
  useEffect(() => {
    if (!stamp || stamp === loadedFor) return
    setConcealed(stored?.concealed ?? [])
    setMelds(stored?.melds ?? [])
    setBonusTiles(stored?.bonusTiles ?? [])
    setSelected([])
    setLoadedFor(stamp)
  }, [stamp, loadedFor, stored])

  const save = (next: Partial<SeatDraft>) => {
    if (!game || seat === null) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(() => {
      void store().setSeatDraft(game.id, {
        seat,
        concealed,
        melds,
        bonusTiles,
        updatedAt: new Date().toISOString(),
        ...next,
      }).then(() => setSaving(false))
    }, 400)
  }

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  const counts = useMemo(
    () => countTiles([...concealed, ...melds.flatMap((m) => m.tiles)]),
    [concealed, melds],
  )

  if (loading || !game) {
    return <Screen title="My hand" back={'/game/' + gameId}><Spinner label="Loading" /></Screen>
  }

  const ruleSet = ruleSetFor(game.ruleSetId, game.minimumPoints)

  if (seat === null) {
    return (
      <Screen title="My hand" back={'/game/' + gameId} subtitle="Which seat is this phone?">
        <Section title="Pick your seat" hint="Remembered on this device for this game.">
          <div className="space-y-2">
            {[...game.players].sort((a, b) => a.seat - b.seat).map((p) => (
              <button
                key={p.playerId}
                onClick={() => claim(p.seat)}
                className="card flex w-full items-center gap-3 text-left"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-ink"
                  style={{ background: p.color }}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.name}</span>
                  <span className="block text-xs text-slate-500">
                    {WIND_LABEL[p.seatWind]} this hand
                  </span>
                </span>
                <span className="tile-face text-lg text-slate-400">
                  {WIND_GLYPH[p.seatWind]}
                </span>
              </button>
            ))}
          </div>
        </Section>
        <Banner tone="info" title="Everyone can do this at once">
          Open the same game on each phone and claim a seat. Then each player keeps their
          own tiles up to date while the hand is played, and whoever wins declares it
          straight away.
        </Banner>
      </Screen>
    )
  }

  const me = game.players.find((p) => p.seat === seat)
  const kongs = melds.filter((m) => m.kind === 'kong').length
  const held = concealed.length + melds.reduce((n, m) => n + m.tiles.length, 0)
  const expected = ruleSet.handSize + kongs
  const ready = held === expected
  const selectedTiles = selected.map((i) => concealed[i]).filter(Boolean)
  const meldCandidate = meldFrom(selectedTiles)

  const addTile = (id: TileId) => {
    if (id.startsWith('f') || id.startsWith('s')) {
      const next = bonusTiles.includes(id)
        ? bonusTiles.filter((b) => b !== id)
        : [...bonusTiles, id]
      setBonusTiles(next)
      save({ bonusTiles: next })
      return
    }
    const next = [...concealed, id]
    setConcealed(next)
    save({ concealed: next })
  }

  const removeSelected = () => {
    const next = concealed.filter((_, i) => !selected.includes(i))
    setConcealed(next)
    setSelected([])
    save({ concealed: next })
  }

  const makeMeld = () => {
    if (!meldCandidate) return
    const remaining = [...concealed]
    for (const t of meldCandidate.tiles) {
      const i = remaining.indexOf(t)
      if (i >= 0) remaining.splice(i, 1)
    }
    const nextMelds = [...melds, meldCandidate]
    setConcealed(remaining)
    setMelds(nextMelds)
    setSelected([])
    save({ concealed: remaining, melds: nextMelds })
  }

  const undoMeld = (index: number) => {
    const back = sortTiles([...concealed, ...melds[index].tiles])
    const nextMelds = melds.filter((_, i) => i !== index)
    setConcealed(back)
    setMelds(nextMelds)
    save({ concealed: back, melds: nextMelds })
  }

  const toggleMeldConcealed = (index: number) => {
    const nextMelds = melds.map(
      (m, i) => (i === index ? { ...m, concealed: !m.concealed } : m),
    )
    setMelds(nextMelds)
    save({ melds: nextMelds })
  }

  const sortHand = () => {
    const next = sortTiles(concealed)
    setConcealed(next)
    save({ concealed: next })
  }

  /**
   * Hands the tiles to the shared scoring flow with the winner already set, so
   * the only thing left is the winning tile and how it arrived.
   */
  const declareWin = () => {
    draftStore.start(game.id, 'manual')
    draftStore.loadSeatDraft({
      concealed,
      melds,
      bonusTiles,
      winnerPlayerId: me?.playerId ?? null,
    })
    navigate('/game/' + game.id + '/tiles')
  }

  return (
    <Screen
      title={me ? me.name + "'s hand" : 'My hand'}
      back={'/game/' + gameId}
      subtitle={
        (me ? WIND_LABEL[me.seatWind] + ' · ' : '') + 'hand ' + game.handNumber +
        ' of 16'
      }
      action={
        <button className="text-xs font-semibold text-slate-500" onClick={release}>
          Not me
        </button>
      }
    >
      <div className="mb-4">
        <Banner
          tone={ready ? 'good' : 'info'}
          title={held + ' of ' + expected + ' tiles entered'}
        >
          {ready
            ? 'Your hand is complete. Keep it up to date as you draw and discard, then tap the button below the moment you win.'
            : 'Enter the tiles you were dealt. You can fix them any time during the hand; nothing is scored until you declare a win.'}
        </Banner>
      </div>

      <Section
        title="In my hand"
        hint="Tap to select, then remove or turn into a meld."
        right={
          <button className="text-xs font-semibold text-gold" onClick={sortHand}>
            Sort
          </button>
        }
      >
        <div className="card">
          {concealed.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              Nothing entered yet. Use the picker below.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {concealed.map((id, i) => (
                <Tile
                  key={id + '-' + i}
                  id={id}
                  size="md"
                  selected={selected.includes(i)}
                  onClick={() =>
                    setSelected((s) =>
                      s.includes(i) ? s.filter((x) => x !== i) : [...s, i])}
                />
              ))}
            </div>
          )}

          {selected.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-line pt-3">
              <span className="chip">{selected.length} selected</span>
              <button
                className="btn-ghost px-3 py-1.5 text-xs"
                disabled={!meldCandidate}
                onClick={makeMeld}
              >
                Make {meldCandidate?.kind ?? 'meld'}
              </button>
              <button className="btn-danger px-3 py-1.5 text-xs" onClick={removeSelected}>
                Remove
              </button>
              <button
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => setSelected([])}
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>
      </Section>

      {melds.length > 0 ? (
        <Section title="Melds on the table">
          <ul className="space-y-2">
            {melds.map((m, i) => (
              <li key={i} className="card flex items-center gap-3">
                <div className="flex gap-0.5">
                  {m.tiles.map((id, j) => <Tile key={id + j} id={id} size="sm" />)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold capitalize">{m.kind}</p>
                  <button
                    className="text-xs text-gold"
                    onClick={() => toggleMeldConcealed(i)}
                  >
                    {m.concealed ? 'Concealed' : 'Claimed from a discard'} · change
                  </button>
                </div>
                <button
                  className="btn-danger px-3 py-1.5 text-xs"
                  onClick={() => undoMeld(i)}
                >
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {bonusTiles.length > 0 ? (
        <Section title="My flowers and seasons">
          <div className="card flex flex-wrap gap-1">
            {bonusTiles.map((id) => (
              <Tile key={id} id={id} size="sm" onClick={() => addTile(id)} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Add tiles">
        <TilePicker onPick={addTile} counts={counts} />
      </Section>

      <div
        className="sticky bottom-0 -mx-4 border-t border-ink-line/60 bg-ink/95 px-4 pt-3 backdrop-blur"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 0.75rem)' }}
      >
        <button
          className="btn-gold w-full py-4 text-base"
          disabled={concealed.length === 0}
          onClick={declareWin}
        >
          I won this hand
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-500">
          {saving
            ? 'Saving to the table'
            : 'Next you add the winning tile and say how it arrived.'}
        </p>
      </div>

      <div className="mt-4">
        <button
          className="btn-ghost w-full"
          onClick={() => void refresh()}
        >
          Refresh from the table
        </button>
      </div>
    </Screen>
  )
}
