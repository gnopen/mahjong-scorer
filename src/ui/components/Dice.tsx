/**
 * Two dice. They can be rolled in the app or, when the table rolls real dice,
 * typed in. Both produce the same `DiceRoll`.
 */

import { useState } from 'react'
import { isValidDie, makeRoll, roll as rollDice, type DiceRoll } from '../../engine/setup'

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
  6: [
    [0.28, 0.22], [0.72, 0.22], [0.28, 0.5],
    [0.72, 0.5], [0.28, 0.78], [0.72, 0.78],
  ],
}

export function Die({ value, size = 52 }: { value: number; size?: number }) {
  const pips = PIPS[value] ?? []
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={'Die showing ' + value}
      className="shrink-0 drop-shadow"
    >
      <rect x="4" y="4" width="92" height="92" rx="18" fill="#fbf8ef" stroke="#cdc6b4" strokeWidth="3" />
      {pips.map(([x, y], i) => (
        <circle
          key={i}
          cx={x * 100}
          cy={y * 100}
          r="9"
          fill={value === 1 || value === 4 ? '#b3312c' : '#22242c'}
        />
      ))}
    </svg>
  )
}

export function DicePair({
  value, onChange, thrower, disabled,
}: {
  value: DiceRoll | null
  onChange: (roll: DiceRoll) => void
  /** Who the guide says throws, shown above the dice. */
  thrower: string
  disabled?: boolean
}) {
  const [manual, setManual] = useState(false)
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [rolling, setRolling] = useState(false)

  const doRoll = () => {
    setRolling(true)
    // A short shuffle so the number does not simply appear.
    let ticks = 0
    const timer = setInterval(() => {
      ticks += 1
      onChange(rollDice())
      if (ticks >= 8) {
        clearInterval(timer)
        setRolling(false)
      }
    }, 70)
  }

  const submitManual = () => {
    const na = Number(a)
    const nb = Number(b)
    if (!isValidDie(na) || !isValidDie(nb)) return
    onChange(makeRoll(na, nb))
    setManual(false)
    setA('')
    setB('')
  }

  return (
    <div className="card">
      <p className="label">{thrower} throws</p>

      <div className="flex items-center gap-3">
        <Die value={value?.a ?? 1} />
        <Die value={value?.b ?? 1} />
        <div className="min-w-0 flex-1 text-right">
          <p className="text-3xl font-extrabold tabular-nums text-gold">
            {value ? value.total : '—'}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">total</p>
        </div>
      </div>

      {manual ? (
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <label className="label" htmlFor="die-a">First die</label>
            <input
              id="die-a"
              className="input py-2 text-center"
              inputMode="numeric"
              maxLength={1}
              value={a}
              onChange={(e) => setA(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="flex-1">
            <label className="label" htmlFor="die-b">Second die</label>
            <input
              id="die-b"
              className="input py-2 text-center"
              inputMode="numeric"
              maxLength={1}
              value={b}
              onChange={(e) => setB(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <button
            className="btn-gold shrink-0 px-3 py-2.5 text-xs"
            disabled={!isValidDie(Number(a)) || !isValidDie(Number(b))}
            onClick={submitManual}
          >
            Use
          </button>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="btn-gold" disabled={disabled || rolling} onClick={doRoll}>
          {rolling ? 'Rolling' : value ? 'Roll again' : 'Roll'}
        </button>
        <button className="btn-ghost" disabled={disabled} onClick={() => setManual((m) => !m)}>
          {manual ? 'Cancel' : 'Type real dice'}
        </button>
      </div>
    </div>
  )
}
