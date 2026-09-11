import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { savePhoto, store } from '../../db'
import { useGame } from '../../state/useGame'
import { draftToHand, useHandDraft } from '../../state/handDraft'
import { ruleSetFor } from '../../engine/ruleset'
import { score as runScore } from '../../engine/scorer'
import { falseDeclarationPayment } from '../../engine/payments'
import type { GameContext } from '../../engine/hand'
import { Banner, Screen, Spinner } from '../components/Layout'
import { ScoreBreakdownView } from '../components/ScoreBreakdownView'

export function ScoreResult() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { game, loading, refresh } = useGame(gameId)
  const draft = useHandDraft()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // The game carries its own minimum, so the rule set is derived per game.
  const ruleSet = useMemo(
    () => ruleSetFor(game?.ruleSetId ?? 'mcr', game?.minimumPoints ?? 0),
    [game?.ruleSetId, game?.minimumPoints],
  )

  const computed = useMemo(() => {
    if (!game || !draft.winnerPlayerId) return null
    const winner = game.players.find((p) => p.playerId === draft.winnerPlayerId)
    if (!winner) return null
    const discarder = game.players.find((p) => p.playerId === draft.discarderPlayerId)

    const ctx: GameContext = {
      prevalentWind: game.prevalentWind,
      seatWind: winner.seatWind,
      winnerIsDealer: winner.seat === game.dealerSeat,
      discarderSeat: draft.selfDraw ? null : discarder?.seat ?? null,
      winnerSeat: winner.seat,
      playerCount: game.players.length,
    }

    const outcome = runScore(draftToHand(draft), ctx, ruleSet)
    if (!outcome.valid) return { outcome, winner, payment: null }

    const payment = ruleSet.payment.compute({
      handPoints: outcome.score.totalPoints,
      winnerSeat: winner.seat,
      discarderSeat: ctx.discarderSeat,
      selfDraw: draft.selfDraw,
      seats: game.players.map((p) => ({
        seat: p.seat,
        playerId: p.playerId,
        name: p.name,
        isDealer: p.seat === game.dealerSeat,
      })),
    })
    return { outcome, winner, payment }
  }, [game, draft, ruleSet])

  if (loading || !game) {
    return <Screen title="Score" back={'/game/' + gameId}><Spinner label="Loading" /></Screen>
  }

  if (!computed) {
    return (
      <Screen title="Score" back={'/game/' + gameId + '/tiles'}>
        <Banner tone="error" title="Nothing to score">
          Go back and finish entering the hand.
        </Banner>
      </Screen>
    )
  }

  const { outcome, winner, payment } = computed

  if (!outcome.valid) {
    return (
      <Screen title="Hand cannot be scored" back={'/game/' + gameId + '/tiles'}>
        <Banner tone="error" title="These tiles do not form a scorable hand">
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {outcome.issues.map((i, k) => <li key={k}>{i.message}</li>)}
          </ul>
        </Banner>
        <button
          className="btn-gold mt-4 w-full"
          onClick={() => navigate('/game/' + gameId + '/tiles')}
        >
          Edit the tiles
        </button>
      </Screen>
    )
  }

  /**
   * The guide: "Be careful when announcing Mahjong and revealing your hand
   * without the minimum 8 points! This will cost you a penalty of 30 points
   * (10 points to each player)."
   */
  const penalise = async () => {
    const cfg = ruleSet.falseDeclaration
    if (!cfg.enabled) return
    setSaving(true)
    setSaveError(null)
    try {
      const penalty = falseDeclarationPayment(cfg.perPlayer).compute({
        handPoints: 0,
        winnerSeat: winner.seat,
        discarderSeat: null,
        selfDraw: draft.selfDraw,
        seats: game.players.map((p) => ({
          seat: p.seat,
          playerId: p.playerId,
          name: p.name,
          isDealer: p.seat === game.dealerSeat,
        })),
      })
      await store().recordRound({
        gameId: game.id,
        outcome: 'penalty',
        // The declarer is recorded so the history can name who was penalised.
        winnerPlayerId: winner.playerId,
        discarderPlayerId: null,
        selfDraw: false,
        hand: draftToHand(draft),
        score: outcome.score,
        payment: penalty,
        photoPath: null,
        source: draft.source,
      })
      await refresh()
      draft.reset()
      navigate('/game/' + game.id, { replace: true })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  const save = async () => {
    if (!payment) return
    setSaving(true)
    setSaveError(null)
    try {
      const photoPath = draft.photoDataUrl
        ? await savePhoto(game.id, draft.photoDataUrl)
        : null
      await store().recordRound({
        gameId: game.id,
        outcome: 'win',
        winnerPlayerId: winner.playerId,
        discarderPlayerId: draft.selfDraw ? null : draft.discarderPlayerId,
        selfDraw: draft.selfDraw,
        hand: draftToHand(draft),
        score: outcome.score,
        payment,
        photoPath,
        source: draft.source,
      })
      await refresh()
      draft.reset()
      navigate('/game/' + game.id, { replace: true })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  const belowMinimum = !outcome.score.meetsMinimum

  return (
    <Screen
      title="Why this score?"
      back={'/game/' + gameId + '/tiles'}
      subtitle={ruleSet.name + ' · round ' + game.roundNumber}
    >
      {belowMinimum ? (
        <div className="mb-4">
          <Banner tone="warn" title="Below the minimum to declare a win">
            <p>
              This game needs at least {outcome.score.minimumPoints} points from scoring
              patterns before a hand may be declared. This hand has {outcome.score.handPoints}
              {ruleSet.minimumExcludesBonus ? ', and flowers do not count toward the minimum' : ''}.
            </p>
            <p className="mt-1">
              Go back and check the tiles. If the hand really was declared, the guide sets a
              penalty of {ruleSet.falseDeclaration.perPlayer * 3} points,{' '}
              {ruleSet.falseDeclaration.perPlayer} to each of the other players.
            </p>
          </Banner>
        </div>
      ) : null}

      {saveError ? (
        <div className="mb-4">
          <Banner tone="error" title="The round was not saved">{saveError}</Banner>
        </div>
      ) : null}

      <ScoreBreakdownView
        score={outcome.score}
        payment={payment}
        winnerName={winner.name}
        pointValue={game.pointValue}
      />

      <div className="sticky bottom-0 -mx-4 mt-5 border-t border-ink-line/60 bg-ink/95 px-4 pt-3 backdrop-blur"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 0.75rem)' }}>
        {belowMinimum ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                className="btn-ghost"
                onClick={() => navigate('/game/' + gameId + '/tiles')}
              >
                Edit tiles
              </button>
              <button className="btn-danger" disabled={saving} onClick={() => void penalise()}>
                Charge the penalty
              </button>
            </div>
            <button
              className="btn-ghost w-full text-xs"
              disabled={saving}
              onClick={() => void save()}
            >
              Pay it out anyway, house rules
            </button>
          </div>
        ) : (
          <button className="btn-gold w-full py-4 text-base" disabled={saving}
            onClick={() => void save()}>
            {saving ? 'Saving' : 'Confirm and update balances'}
          </button>
        )}
      </div>
    </Screen>
  )
}
