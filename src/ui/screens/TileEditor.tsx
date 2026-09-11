import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGame } from '../../state/useGame'
import { draftToHand, useHandDraft } from '../../state/handDraft'
import { countTiles, tileName, type TileId } from '../../engine/tiles'
import type { Meld, WinFlags } from '../../engine/hand'
import { ruleSetFor } from '../../engine/ruleset'
import { validate } from '../../engine/validator'
import { Banner, Screen, Section, Spinner } from '../components/Layout'
import { Tile } from '../components/Tile'
import { TilePicker } from '../components/TilePicker'

const FLAG_LABELS: Array<{ key: keyof WinFlags; label: string; hint: string; needs: 'draw' | 'discard' | 'any' }> = [
  { key: 'lastTileDraw', label: 'Last tile of the wall', hint: 'Worth 8 points as Last Tile Draw.', needs: 'draw' },
  { key: 'kongReplacement', label: 'Replacement after a kong', hint: 'Worth 8 points as Out with Replacement Tile.', needs: 'draw' },
  { key: 'lastTileClaim', label: 'Final discard of the hand', hint: 'Worth 8 points as Last Tile Claim.', needs: 'discard' },
  { key: 'robbingKong', label: 'Robbed from a kong', hint: 'Worth 8 points as Robbing the Kong.', needs: 'discard' },
  { key: 'lastOfItsKind', label: 'Fourth and last copy in play', hint: 'Worth 4 points as Last Tile.', needs: 'any' },
]

function meldFromSelection(tiles: TileId[]): Meld | null {
  const sorted = [...tiles].sort()
  if (sorted.length === 4 && new Set(sorted).size === 1) {
    return { kind: 'kong', tiles: sorted, concealed: false }
  }
  if (sorted.length !== 3) return null
  if (new Set(sorted).size === 1) return { kind: 'pung', tiles: sorted, concealed: false }
  return { kind: 'chow', tiles: sorted, concealed: false }
}

export function TileEditor() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { game, loading } = useGame(gameId)
  const draft = useHandDraft()
  const [selected, setSelected] = useState<number[]>([])
  const [showPicker, setShowPicker] = useState(true)

  const hand = draftToHand(draft)
  const ruleSet = useMemo(
    () => ruleSetFor(game?.ruleSetId ?? 'mcr', game?.minimumPoints ?? 0),
    [game?.ruleSetId, game?.minimumPoints],
  )
  const check = useMemo(() => validate(hand, ruleSet), [hand, ruleSet])
  const counts = useMemo(
    () => countTiles([...draft.concealed, ...draft.melds.flatMap((m) => m.tiles)]),
    [draft.concealed, draft.melds],
  )

  if (loading || !game) {
    return <Screen title="Check your tiles" back={'/game/' + gameId}><Spinner label="Loading" /></Screen>
  }

  const lowConfidence = Object.entries(draft.confidence).filter(([, c]) => c < 0.7)
  const selectedTiles = selected.map((i) => draft.concealed[i]).filter(Boolean)
  const winningIndex = draft.winningTile ? draft.concealed.indexOf(draft.winningTile) : -1
  const meldCandidate = meldFromSelection(selectedTiles)

  const toggleSelect = (index: number) => {
    setSelected((s) => (s.includes(index) ? s.filter((i) => i !== index) : [...s, index]))
  }

  const removeSelected = () => {
    const sorted = [...selected].sort((a, b) => b - a)
    sorted.forEach((i) => draft.removeAt(i))
    setSelected([])
  }

  const makeMeld = () => {
    if (!meldCandidate) return
    draft.addMeld(meldCandidate)
    setSelected([])
  }

  const markWinning = () => {
    if (selectedTiles.length !== 1) return
    draft.setWinningTile(selectedTiles[0])
    setSelected([])
  }

  const winner = game.players.find((p) => p.playerId === draft.winnerPlayerId)
  const readyToScore =
    check.valid && Boolean(draft.winnerPlayerId) &&
    (draft.selfDraw || Boolean(draft.discarderPlayerId))

  return (
    <Screen
      title="Check your tiles"
      back={'/game/' + gameId}
      subtitle={
        draft.source === 'photo'
          ? 'Nothing is scored until you confirm this reading'
          : 'Build the winning hand'
      }
    >
      {draft.source === 'photo' && draft.detection ? (
        <div className="mb-4">
          <Banner
            tone={lowConfidence.length > 0 ? 'warn' : 'good'}
            title={
              'Read ' + draft.detection.tiles.length + ' tiles' +
              (lowConfidence.length > 0
                ? ', ' + lowConfidence.length + ' need a second look'
                : '')
            }
          >
            {draft.detection.notes ? <p>{draft.detection.notes}</p> : null}
            {draft.detection.unreadable.length > 0 ? (
              <p className="mt-1">
                Could not place: {draft.detection.unreadable.join(', ')}.
              </p>
            ) : null}
            <p className="mt-1">Tiles with an amber ring were read with low confidence.</p>
            <p className="mt-1 opacity-70">
              Read by {draft.detection.source} in{' '}
              {(draft.detection.elapsedMs / 1000).toFixed(1)} seconds.
            </p>
          </Banner>
        </div>
      ) : null}

      {draft.photoDataUrl ? (
        <details className="mb-4">
          <summary className="cursor-pointer text-xs font-semibold text-slate-400">
            Show the photo
          </summary>
          <img src={draft.photoDataUrl} alt="The hand" className="mt-2 w-full rounded-xl" />
        </details>
      ) : null}

      <Section
        title={'Concealed tiles (' + draft.concealed.length + ')'}
        hint="Tap to select. The winning tile always lives here, even when it completed a claimed set."
        right={
          <button className="text-xs font-semibold text-gold" onClick={draft.sort}>
            Sort
          </button>
        }
      >
        <div className="card">
          {draft.concealed.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No tiles yet. Add them from the picker below.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {draft.concealed.map((id, i) => (
                <Tile
                  key={id + '-' + i}
                  id={id}
                  size="md"
                  onClick={() => toggleSelect(i)}
                  selected={selected.includes(i)}
                  winning={i === winningIndex && !selected.includes(i)}
                  uncertain={(draft.confidence[i] ?? 1) < 0.7}
                />
              ))}
            </div>
          )}

          {selected.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-line pt-3">
              <span className="chip">{selected.length} selected</span>
              <button className="btn-ghost px-3 py-1.5 text-xs" disabled={selectedTiles.length !== 1}
                onClick={markWinning}>
                Mark winning tile
              </button>
              <button className="btn-ghost px-3 py-1.5 text-xs" disabled={!meldCandidate}
                onClick={makeMeld}>
                Make {meldCandidate?.kind ?? 'meld'}
              </button>
              <button className="btn-danger px-3 py-1.5 text-xs" onClick={removeSelected}>
                Remove
              </button>
              <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setSelected([])}>
                Clear
              </button>
            </div>
          ) : null}
        </div>
      </Section>

      {draft.melds.length > 0 ? (
        <Section title="Melds" hint="A concealed kong stays concealed even though it sits on the table.">
          <ul className="space-y-2">
            {draft.melds.map((m, i) => (
              <li key={i} className="card flex items-center gap-3">
                <div className="flex gap-0.5">
                  {m.tiles.map((id, j) => <Tile key={id + j} id={id} size="sm" />)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold capitalize">{m.kind}</p>
                  <button
                    className="text-xs text-gold"
                    onClick={() => draft.toggleMeldConcealed(i)}
                  >
                    {m.concealed ? 'Concealed' : 'Claimed from a discard'} · change
                  </button>
                </div>
                <button className="btn-danger px-3 py-1.5 text-xs" onClick={() => draft.removeMeld(i)}>
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {draft.bonusTiles.length > 0 ? (
        <Section title="Flowers and seasons" hint="One point each, outside the 8 point minimum.">
          <div className="card flex flex-wrap gap-1">
            {draft.bonusTiles.map((id) => (
              <Tile key={id} id={id} size="sm" onClick={() => draft.toggleBonus(id)} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="How the hand was won">
        <div className="card space-y-3">
          <div>
            <p className="label">Winner</p>
            <div className="grid grid-cols-2 gap-2">
              {game.players.map((p) => (
                <button
                  key={p.playerId}
                  onClick={() => draft.setWinner(p.playerId)}
                  className={
                    'rounded-xl border px-3 py-2.5 text-sm font-semibold transition ' +
                    (draft.winnerPlayerId === p.playerId
                      ? 'border-gold bg-gold/15 text-gold'
                      : 'border-ink-line bg-ink text-slate-300')
                  }
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label">Winning tile</p>
            <div className="flex items-center gap-2">
              {draft.winningTile ? (
                <>
                  <Tile id={draft.winningTile} size="sm" winning />
                  <span className="text-sm text-slate-300">{tileName(draft.winningTile)}</span>
                </>
              ) : (
                <span className="text-sm text-amber-300">
                  Select a concealed tile and tap Mark winning tile.
                </span>
              )}
            </div>
          </div>

          <div>
            <p className="label">Source of the winning tile</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => draft.setSelfDraw(true)}
                className={
                  'rounded-xl border px-3 py-2.5 text-sm font-semibold ' +
                  (draft.selfDraw
                    ? 'border-gold bg-gold/15 text-gold'
                    : 'border-ink-line bg-ink text-slate-300')
                }
              >
                Self-draw
              </button>
              <button
                onClick={() => draft.setSelfDraw(false)}
                className={
                  'rounded-xl border px-3 py-2.5 text-sm font-semibold ' +
                  (!draft.selfDraw
                    ? 'border-gold bg-gold/15 text-gold'
                    : 'border-ink-line bg-ink text-slate-300')
                }
              >
                Won on a discard
              </button>
            </div>
          </div>

          {!draft.selfDraw ? (
            <div>
              <p className="label">Who discarded it</p>
              <div className="grid grid-cols-2 gap-2">
                {game.players
                  .filter((p) => p.playerId !== draft.winnerPlayerId)
                  .map((p) => (
                    <button
                      key={p.playerId}
                      onClick={() => draft.setDiscarder(p.playerId)}
                      className={
                        'rounded-xl border px-3 py-2.5 text-sm font-semibold ' +
                        (draft.discarderPlayerId === p.playerId
                          ? 'border-loser bg-loser/15 text-loser'
                          : 'border-ink-line bg-ink text-slate-300')
                      }
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
            </div>
          ) : null}

          <div>
            <p className="label">Circumstances</p>
            <div className="space-y-1.5">
              {FLAG_LABELS.filter((f) =>
                f.needs === 'any' ||
                (f.needs === 'draw' ? draft.selfDraw : !draft.selfDraw),
              ).map((f) => (
                <label
                  key={f.key}
                  className="flex cursor-pointer items-start gap-3 rounded-xl bg-ink px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[#e9b949]"
                    checked={draft.flags[f.key]}
                    onChange={(e) => draft.setFlag(f.key, e.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-medium">{f.label}</span>
                    <span className="block text-xs text-slate-500">{f.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Add tiles"
        right={
          <button className="text-xs font-semibold text-gold" onClick={() => setShowPicker((v) => !v)}>
            {showPicker ? 'Hide' : 'Show'}
          </button>
        }
      >
        {showPicker ? <TilePicker onPick={draft.addTile} counts={counts} /> : null}
      </Section>

      <div className="sticky bottom-0 -mx-4 border-t border-ink-line/60 bg-ink/95 px-4 pt-3 backdrop-blur"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 0.75rem)' }}>
        {!check.valid ? (
          <div className="mb-3">
            <Banner tone="error" title="This hand cannot be scored yet">
              <ul className="list-disc space-y-1 pl-4">
                {check.issues.map((i, k) => (
                  <li key={k}>
                    {i.message}
                    {i.hint ? <span className="block text-[12px] opacity-75">{i.hint}</span> : null}
                  </li>
                ))}
              </ul>
            </Banner>
          </div>
        ) : !draft.winnerPlayerId ? (
          <div className="mb-3">
            <Banner tone="warn" title="Choose the winner">
              Payments cannot be worked out until the app knows who won.
            </Banner>
          </div>
        ) : !draft.selfDraw && !draft.discarderPlayerId ? (
          <div className="mb-3">
            <Banner tone="warn" title="Choose who discarded the winning tile">
              In Chinese Official the discarder pays the score plus the base, and the other
              two pay the base only.
            </Banner>
          </div>
        ) : (
          <div className="mb-3">
            <Banner tone="good" title="The hand is a legal win">
              Ready to score for {winner?.name}.
            </Banner>
          </div>
        )}

        <button
          className="btn-gold w-full py-4 text-base"
          disabled={!readyToScore}
          onClick={() => navigate('/game/' + gameId + '/score')}
        >
          Score this hand
        </button>
      </div>
    </Screen>
  )
}
