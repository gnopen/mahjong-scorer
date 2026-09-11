/**
 * Rule-set configuration. Nothing above this file knows which Mahjong variant
 * is in play: screens, the validator, the scorer and the payment engine all
 * read the active `RuleSet`. Adding Hong Kong Old Style or Riichi means adding
 * a new object here plus its rule modules, not editing the engine.
 */

import type { RuleRelationships, ScoringRule } from './rules/types'
import { CHICKEN_HAND, MCR_RELATIONSHIPS, MCR_RULES } from './rules/mcr'
import { mcrPayment, type PaymentRule } from './payments'

export interface TileSetConfig {
  flowers: boolean
  seasons: boolean
  /** Reserved for variants that add jokers; no shipped rule set uses them. */
  jokers: boolean
}

export interface RuleSet {
  id: string
  name: string
  variant: string
  description: string
  playerCount: number
  /** Tiles held between turns: 13 for most variants, 16 for Taiwanese. */
  handSize: 13 | 16
  tileSet: TileSetConfig
  rules: ScoringRule[]
  relationships: RuleRelationships
  /**
   * Points a hand must reach before it may be declared. This is the rule set's
   * own figure; a game may override it, and most home games set it to 0.
   */
  minimumPoints: number
  /** True when bonus tiles do not count toward the minimum. */
  minimumExcludesBonus: boolean
  chickenHand: {
    enabled: boolean
    rule: ScoringRule
    /**
     * True when a self-drawn hand can still be a chicken hand. The guide sets
     * aside flowers only, so a self-drawn hand scores its 1 point for
     * Self-Drawn and is therefore not a chicken hand. Tournaments differ, so
     * this stays configurable.
     */
    ignoresSelfDraw: boolean
  }
  /**
   * What declaring a win below the minimum costs. The guide: "a penalty of 30
   * points (10 points to each player)".
   */
  falseDeclaration: { enabled: boolean; perPlayer: number }
  payment: PaymentRule
  /** Hard ceiling on the hand score, or null for no cap. */
  cap: number | null
  /** Currency or chip value of one scoring point. */
  pointValue: number
}

export const MCR_RULESET: RuleSet = {
  id: 'mcr',
  name: 'Chinese Official',
  variant: 'Mahjong Competition Rules (1998)',
  description:
    'The international tournament standard. 81 scoring patterns, a minimum of 8 points ' +
    'before a hand may be declared, and a flat 8-point base added to every payment.',
  playerCount: 4,
  handSize: 13,
  tileSet: { flowers: true, seasons: true, jokers: false },
  rules: MCR_RULES,
  relationships: MCR_RELATIONSHIPS,
  minimumPoints: 8,
  minimumExcludesBonus: true,
  chickenHand: { enabled: true, rule: CHICKEN_HAND, ignoresSelfDraw: false },
  falseDeclaration: { enabled: true, perPlayer: 10 },
  payment: mcrPayment,
  cap: null,
  pointValue: 1,
}

export const RULE_SETS: RuleSet[] = [MCR_RULESET]

/**
 * The rule set as a particular game plays it. Only the minimum changes, so the
 * result is cached per (rule set, minimum) pair: the scorer keys its exclusion
 * closure off object identity, and a fresh object each render would throw that
 * cache away every time.
 */
const overrides = new Map<string, RuleSet>()

export function ruleSetFor(ruleSetId: string, minimumPoints: number): RuleSet {
  const base = ruleSetById(ruleSetId)
  if (minimumPoints === base.minimumPoints) return base
  const key = ruleSetId + ':' + minimumPoints
  const cached = overrides.get(key)
  if (cached) return cached
  const derived: RuleSet = { ...base, minimumPoints }
  overrides.set(key, derived)
  return derived
}

export function ruleSetById(id: string): RuleSet {
  const rs = RULE_SETS.find((r) => r.id === id)
  if (!rs) throw new Error('Unknown rule set: ' + id)
  return rs
}
