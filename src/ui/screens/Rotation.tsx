import { useParams } from 'react-router-dom'
import { useGame } from '../../state/useGame'
import {
  HANDS_PER_GAME, WIND_GLYPH, WIND_LABEL, fullSchedule, handWithinRound,
  seatWindForHand,
} from '../../engine/setup'
import { Banner, Screen, Section, Spinner } from '../components/Layout'
import { Compass } from '../components/Compass'

/**
 * Where everyone sits now and where they move next. The guide: "After each hand
 * the Wind or seating position rotates counter clockwise. This also happens in
 * the event of a dead hand."
 */
export function Rotation() {
  const { gameId } = useParams()
  const { game, loading } = useGame(gameId)

  if (loading || !game) {
    return <Screen title="Seats and rounds" back={'/game/' + gameId}><Spinner label="Loading" /></Screen>
  }

  const seats = [...game.players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({ seat: p.seat, name: p.name, color: p.color }))
  const schedule = fullSchedule()

  return (
    <Screen
      title="Seats and rounds"
      back={'/game/' + gameId}
      subtitle={game.name}
    >
      <Section title="Right now">
        <div className="card">
          <Compass
            seats={seats}
            handNumber={game.handNumber}
            prevalentWind={game.prevalentWind}
          />
        </div>
      </Section>

      {game.handNumber < HANDS_PER_GAME ? (
        <Section title="Next hand" hint="Where everyone moves once this hand is scored.">
          <div className="card">
            <Compass
              seats={seats}
              handNumber={game.handNumber + 1}
              prevalentWind={schedule[game.handNumber].prevalentWind}
            />
            {schedule[game.handNumber].startsRound ? (
              <div className="mt-3">
                <Banner tone="info" title="A new round starts">
                  The round wind changes to{' '}
                  {WIND_LABEL[schedule[game.handNumber].prevalentWind]}, so a pung of{' '}
                  {WIND_LABEL[schedule[game.handNumber].prevalentWind]} will start scoring
                  Pung of Prevalent Wind.
                </Banner>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section
        title="The full game"
        hint="Four hands to a round, four rounds, so every player sits every seat in every round."
      >
        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-line/60 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 text-left font-semibold">Hand</th>
                  <th className="px-2 py-2 text-left font-semibold">Round</th>
                  {seats.map((s) => (
                    <th key={s.seat} className="px-2 py-2 text-left font-semibold">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((step) => {
                  const current = step.handNumber === game.handNumber
                  const played = step.handNumber < game.handNumber
                  return (
                    <tr
                      key={step.handNumber}
                      className={
                        'border-b border-ink-line/40 last:border-0 ' +
                        (current ? 'bg-gold/10' : played ? 'opacity-45' : '')
                      }
                    >
                      <td className="px-3 py-2 tabular-nums font-semibold">
                        {step.handNumber}
                        {step.startsRound ? (
                          <span className="ml-1 text-[9px] uppercase text-sky-300">new</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-400">
                        {WIND_LABEL[step.prevalentWind]} {handWithinRound(step.handNumber)}/4
                      </td>
                      {seats.map((s) => {
                        const wind = seatWindForHand(s.seat, step.handNumber)
                        return (
                          <td key={s.seat} className="px-2 py-2">
                            <span
                              className={
                                'tile-face ' +
                                (wind === 'east' ? 'font-bold text-gold' : 'text-slate-300')
                              }
                            >
                              {WIND_GLYPH[wind]}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-2 px-1 text-[11px] text-slate-500">
          A gold {WIND_GLYPH.east} marks the dealer for that hand.
        </p>
      </Section>
    </Screen>
  )
}
