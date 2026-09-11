/**
 * Payment engine. Deliberately separate from hand scoring: a rule set can
 * change how a score is shared out without touching a single scoring pattern,
 * and a house rule can change payments without touching the rule table.
 */

export interface PaymentSeat {
  seat: number
  playerId: string
  name: string
  isDealer: boolean
}

export interface PaymentInput {
  /** Hand score in points, bonus tiles included, cap already applied. */
  handPoints: number
  winnerSeat: number
  /** Null on a self-draw. */
  discarderSeat: number | null
  selfDraw: boolean
  seats: PaymentSeat[]
}

export interface PaymentLine {
  seat: number
  playerId: string
  name: string
  amount: number
  /** Plain-language reason shown next to the number. */
  reason: string
}

export interface PaymentBreakdown {
  lines: PaymentLine[]
  /** Total credited to the winner. */
  winnerTotal: number
  /** One-line summary of the formula used. */
  formula: string
}

export interface PaymentRule {
  id: string
  name: string
  description: string
  compute(input: PaymentInput): PaymentBreakdown
}

/** The flat 8-point base every Chinese Official payment carries. */
export const MCR_BASE = 8

/**
 * Chinese Official payments.
 *
 *   won on a discard  the discarder pays score + 8, the other two pay 8 each
 *   self-drawn        every other player pays score + 8
 *
 * The dealer has no special rate in this rule set.
 */
export const mcrPayment: PaymentRule = {
  id: 'mcr',
  name: 'Chinese Official payment',
  description:
    'Winning on a discard: the discarder pays the hand score plus the 8-point base and the ' +
    'other two players pay the base only. Self-draw: every player pays the hand score plus the base.',
  compute({ handPoints, winnerSeat, discarderSeat, selfDraw, seats }) {
    const lines: PaymentLine[] = []
    let winnerTotal = 0

    for (const s of seats) {
      if (s.seat === winnerSeat) continue
      let amount: number
      let reason: string
      if (selfDraw) {
        amount = handPoints + MCR_BASE
        reason = 'Self-draw, so every player pays the hand score plus the ' +
          MCR_BASE + '-point base.'
      } else if (s.seat === discarderSeat) {
        amount = handPoints + MCR_BASE
        reason = 'Discarded the winning tile, so pays the hand score plus the ' +
          MCR_BASE + '-point base.'
      } else {
        amount = MCR_BASE
        reason = 'Did not discard the winning tile, so pays the ' + MCR_BASE +
          '-point base only.'
      }
      winnerTotal += amount
      lines.push({ seat: s.seat, playerId: s.playerId, name: s.name, amount: -amount, reason })
    }

    const winner = seats.find((s) => s.seat === winnerSeat)
    if (winner) {
      lines.unshift({
        seat: winner.seat,
        playerId: winner.playerId,
        name: winner.name,
        amount: winnerTotal,
        reason: 'Winner, credited with the sum of the three payments.',
      })
    }

    const formula = selfDraw
      ? '3 x (' + handPoints + ' + ' + MCR_BASE + ') = ' + winnerTotal
      : '(' + handPoints + ' + ' + MCR_BASE + ') + ' + MCR_BASE + ' + ' + MCR_BASE +
        ' = ' + winnerTotal

    return { lines, winnerTotal, formula }
  },
}

/**
 * Declaring a win that does not reach the minimum. The guide: "Be careful when
 * announcing Mahjong and revealing your hand without the minimum 8 points! This
 * will cost you a penalty of 30 points (10 points to each player)."
 *
 * `handPoints` is ignored; the penalty is flat.
 */
export function falseDeclarationPayment(perPlayer: number): PaymentRule {
  return {
    id: 'false-declaration',
    name: 'False declaration penalty',
    description:
      'Declaring a win below the minimum costs the declarer ' + perPlayer +
      ' points to each of the other three players.',
    compute({ winnerSeat, seats }) {
      const lines: PaymentLine[] = []
      let paid = 0
      for (const s of seats) {
        if (s.seat === winnerSeat) continue
        paid += perPlayer
        lines.push({
          seat: s.seat,
          playerId: s.playerId,
          name: s.name,
          amount: perPlayer,
          reason: 'Receives ' + perPlayer + ' points from the false declaration.',
        })
      }
      const declarer = seats.find((s) => s.seat === winnerSeat)
      if (declarer) {
        lines.unshift({
          seat: declarer.seat,
          playerId: declarer.playerId,
          name: declarer.name,
          amount: -paid,
          reason: 'Declared a win below the minimum, so pays every other player.',
        })
      }
      return {
        lines,
        winnerTotal: -paid,
        formula: '3 x ' + perPlayer + ' = ' + paid + ' paid by the declarer',
      }
    },
  }
}

/**
 * A draw ends the hand with no transfer. Kept here so the ledger has a single
 * place to build round entries from.
 */
export const drawPayment: PaymentRule = {
  id: 'draw',
  name: 'Drawn hand',
  description: 'Nobody wins, so no points change hands.',
  compute({ seats }) {
    return {
      lines: seats.map((s) => ({
        seat: s.seat,
        playerId: s.playerId,
        name: s.name,
        amount: 0,
        reason: 'The hand was drawn.',
      })),
      winnerTotal: 0,
      formula: 'Drawn hand, no payment.',
    }
  },
}
