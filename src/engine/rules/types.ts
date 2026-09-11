/**
 * The scoring-rule contract. Every pattern in every rule set is one of these,
 * so adding a rule set means adding rule objects, never editing the engine.
 */

import type { TileId } from '../tiles'
import type { HandView } from '../view'

export type RuleCategory =
  | 'structure'   // how the sets fit together
  | 'suit'        // flush and suit-mixing patterns
  | 'honors'      // winds and dragons
  | 'sets'        // pungs, kongs, chows
  | 'tiles'       // which ranks the hand uses
  | 'wait'        // the shape of the final wait
  | 'timing'      // circumstances of the winning tile
  | 'bonus'       // flowers and seasons

export interface RuleHit {
  /** Points awarded by this occurrence. Defaults to the rule's own value. */
  points?: number
  /** Sentence shown on the explanation screen. */
  explanation: string
  /** Tile groups that triggered the hit, used to highlight tiles in the UI. */
  evidence: TileId[][]
}

export interface ScoringRule {
  id: string
  name: string
  /** Original Chinese name, shown as a subtitle. */
  chinese?: string
  /**
   * Hand number in A Guide to Mahjong, 1 to 81. Shown next to the name so a
   * score can be checked against the printed guide at the table.
   */
  guide: number
  points: number
  category: RuleCategory
  /** One line describing the pattern in general, independent of this hand. */
  description: string
  /**
   * Returns one hit per occurrence. A pattern that can legitimately be scored
   * twice, such as two separate pairs of identical chows, returns two hits.
   */
  evaluate(view: HandView): RuleHit[]
}

/**
 * Rule relationships. `excludes` is the Chinese Official "does not count"
 * table: when the left rule scores, every rule it names is suppressed even if
 * that rule also matched. The suppressed rules are still reported to the user
 * so the arithmetic on the explanation screen is auditable.
 */
export interface RuleRelationships {
  /** Rule id -> ids it suppresses. */
  excludes: Record<string, string[]>
  /** Rule id -> ids it may never be combined with under any reading. */
  conflicts?: Record<string, string[]>
}

export interface ScoredRule {
  ruleId: string
  name: string
  chinese?: string
  guide?: number
  category: RuleCategory
  description: string
  points: number
  /** Number of times the pattern was scored. */
  times: number
  /** points * times. */
  total: number
  explanation: string
  evidence: TileId[][]
}

export interface SuppressedRule {
  ruleId: string
  name: string
  points: number
  /** Id of the rule that suppressed it. */
  suppressedBy: string
  suppressedByName: string
  reason: string
}
