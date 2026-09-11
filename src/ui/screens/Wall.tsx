import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { store } from '../../db'
import { useGame } from '../../state/useGame'
import { ruleSetFor } from '../../engine/ruleset'
import type { WindPosition } from '../../engine/hand'
import {
  DEAD_WALL_TILES, WIND_LABEL, breakWall, chooseWall, stacksPerSide,
  type DiceRoll, type WallPlan,
} from '../../engine/setup'
import { Banner, Screen, Section, Spinner } from '../components/Layout'
import { DicePair } from '../components/Dice'
import { WallSquare, WallStrip } from '../components/WallDiagram'
import { DealDiagram } from '../components/DealDiagram'

/**
 * Building and breaking the wall, in the order the guide gives: East throws to
 * pick whose wall, that player throws to pick the stack, then the gap is opened
 * and the dead wall is counted off.
 */
export function Wall() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { game, loading, refresh } = useGame(gameId)
  const [first, setFirst] = useState<DiceRoll | null>(null)
  const [second, setSecond] = useState<DiceRoll | null>(null)
  const [saving, setSaving] = useState(false)

  if (loading || !game) {
    return <Screen title="The wall" back={'/game/' + gameId}><Spinner label="Loading the table" /></Screen>
  }

  const ruleSet = ruleSetFor(game.ruleSetId, game.minimumPoints)
  const withFlowers = ruleSet.tileSet.flowers
  const nameFor = (wind: WindPosition) =>
    game.players.find((p) => p.seatWind === wind)?.name ?? WIND_LABEL[wind]

  const seatNames: Partial<Record<WindPosition, string>> = {}
  for (const p of game.players) seatNames[p.seatWind] = p.name

  // An already-saved plan wins, so reopening the screen shows what was thrown.
  const saved = game.wall
  const rules = game.wallRules
  const plan: WallPlan | null = saved
    ? saved
    : first
      ? second
        ? breakWall(chooseWall(first, withFlowers, rules), second)
        : chooseWall(first, withFlowers, rules)
      : null

  const complete = plan !== null && plan.breakIndex !== null

  const save = async () => {
    if (!plan || !complete) return
    setSaving(true)
    await store().setWall(game.id, plan)
    await refresh()
    setSaving(false)
    navigate('/game/' + game.id)
  }

  const reset = async () => {
    setFirst(null)
    setSecond(null)
    if (saved) {
      setSaving(true)
      await store().setWall(game.id, null)
      await refresh()
      setSaving(false)
    }
  }

  return (
    <Screen
      title="The wall"
      back={'/game/' + gameId}
      subtitle={'Hand ' + game.handNumber + ' · ' + WIND_LABEL[game.prevalentWind] + ' round'}
    >
      <Section title="Build it">
        <div className="card text-sm text-slate-400">
          <p>
            Mix all {withFlowers ? 144 : 136} tiles face down. Each player takes{' '}
            {stacksPerSide(withFlowers) * 2} tiles and lines them up two high, then the four
            lines are pushed together into a square.
          </p>
        </div>
      </Section>

      <Section
        title={rules.throws === 1 ? 'Throw once' : 'Throw to pick the wall'}
        hint={
          rules.throws === 1
            ? 'One throw picks both the wall and the stack.'
            : 'East throws first.'
        }
      >
        <DicePair
          thrower={nameFor('east') + ' (East)'}
          value={saved ? saved.first : first}
          onChange={(r) => { setFirst(r); setSecond(null) }}
          disabled={Boolean(saved)}
        />
      </Section>

      {plan ? (
        <Section title="Whose wall">
          <div className="card">
            <WallSquare plan={plan} seatNames={seatNames} />
            <p className="mt-3 text-sm text-slate-300">{plan.instruction}</p>
          </div>
        </Section>
      ) : null}

      {plan && rules.throws === 2 ? (
        <Section
          title="Throw to pick the stack"
          hint={
            nameFor(plan.wallWind) + ' throws, then counts in from the ' +
            (rules.countFrom === 'right' ? 'right-hand' : 'left-hand') + ' end.'
          }
        >
          <DicePair
            thrower={nameFor(plan.wallWind) + ' (' + WIND_LABEL[plan.wallWind] + ')'}
            value={saved ? saved.second : second}
            onChange={setSecond}
            disabled={Boolean(saved)}
          />
        </Section>
      ) : null}

      {complete && plan ? (
        <>
          <Section title="Break here">
            <div className="card">
              <WallStrip plan={plan} />
              <p className="mt-3 text-sm text-slate-300">{plan.instruction}</p>
            </div>
          </Section>

          <Section title="Then deal">
            <div className="card space-y-3 text-sm text-slate-400">
              <DealDiagram names={seatNames} />
              <p>
                The {DEAD_WALL_TILES} tiles to the right of the gap are the dead wall. They
                are only for replacements, after a flower or a kong, and the dead wall stays
                counted at {DEAD_WALL_TILES} tiles however many are taken.
              </p>
              <p>East discards first.</p>
            </div>
          </Section>
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost" onClick={() => void reset()} disabled={saving}>
          Start over
        </button>
        <button
          className="btn-gold"
          disabled={!complete || saving || Boolean(saved)}
          onClick={() => void save()}
        >
          {saved ? 'Saved' : 'Save for this hand'}
        </button>
      </div>

      {saved ? (
        <div className="mt-4">
          <Banner tone="good" title="Recorded for this hand">
            The throws and the break point are saved with hand {game.handNumber}, and clear
            themselves when the next hand starts.
          </Banner>
        </div>
      ) : null}
    </Screen>
  )
}
