/**
 * The scoring engine.
 *
 *   validate -> decompose -> evaluate every rule against every reading
 *            -> suppress overlapping patterns -> keep the highest reading
 *
 * Both the photo path and the manual path arrive here with the same
 * `HandInput`, so there is exactly one implementation of scoring in the app.
 */

import type { TileId } from './tiles'
import type { GameContext, HandInput } from './hand'
import type { Structure } from './decompose'
import { buildView, type HandView } from './view'
import type { RuleHit, ScoredRule, ScoringRule, SuppressedRule } from './rules/types'
import type { RuleSet } from './ruleset'
import { validate, waitingTiles, type ValidationIssue } from './validator'

export interface ScoreBreakdown {
  /** Patterns that scored, highest value first. */
  rules: ScoredRule[]
  /** Patterns that matched but were absorbed by a bigger pattern. */
  suppressed: SuppressedRule[]
  /** Points from patterns, bonus tiles excluded. */
  handPoints: number
  /** Points from flowers and seasons. */
  bonusPoints: number
  /** handPoints + bonusPoints, after any cap. */
  totalPoints: number
  /** Total before the cap was applied, present only when a cap bit. */
  uncappedPoints?: number
  meetsMinimum: boolean
  minimumPoints: number
  structure: Structure
  /** How many readings of the tiles were considered. */
  readingsConsidered: number
}

export type ScoreOutcome =
  | { valid: true; score: ScoreBreakdown }
  | { valid: false; issues: ValidationIssue[] }

interface Candidate {
  structure: Structure
  rules: ScoredRule[]
  suppressed: SuppressedRule[]
  handPoints: number
  bonusPoints: number
}

function flatten(evidence: TileId[][]): TileId[] {
  return evidence.flat()
}

/** True when every tile of `inner` is available in `outer`, counting copies. */
function isSubMultiset(inner: TileId[], outer: TileId[]): boolean {
  const pool = new Map<TileId, number>()
  for (const t of outer) pool.set(t, (pool.get(t) ?? 0) + 1)
  for (const t of inner) {
    const n = pool.get(t) ?? 0
    if (n === 0) return false
    pool.set(t, n - 1)
  }
  return true
}

interface Occurrence {
  rule: ScoringRule
  hit: RuleHit
  dropped: boolean
  droppedBy?: ScoringRule
}

function evaluateAll(view: HandView, ruleSet: RuleSet): Occurrence[] {
  const out: Occurrence[] = []
  for (const rule of ruleSet.rules) {
    for (const hit of rule.evaluate(view)) out.push({ rule, hit, dropped: false })
  }
  return out
}

/**
 * The table records two different relationships and they behave differently.
 *
 * An evidence-scoped entry means containment: Seven Shifted Pairs contains Full
 * Flush, which contains One Voided Suit, so all three collapse into the first.
 * Containment is transitive, and the closure below follows those edges.
 *
 * A `*` entry means a flat conflict: the guide says Four Concealed Pungs
 * "cannot be combined with Fully Concealed Hand", which is not a claim that one
 * contains the other. Conflicts do not propagate, so Self-Drawn still scores on
 * its own even though Fully Concealed Hand would have absorbed it.
 *
 * Computed once per rule set and cached.
 */
const closureCache = new WeakMap<RuleSet, Record<string, string[]>>()

function transitiveExcludes(ruleSet: RuleSet): Record<string, string[]> {
  const cached = closureCache.get(ruleSet)
  if (cached) return cached

  const direct = ruleSet.relationships.excludes
  const out: Record<string, string[]> = {}

  for (const root of Object.keys(direct)) {
    const seen = new Map<string, boolean>()
    const walked = new Set<string>()

    const walk = (id: string) => {
      for (const raw of direct[id] ?? []) {
        const isStar = raw.startsWith('*')
        const target = isStar ? raw.slice(1) : raw
        const prev = seen.get(target)
        seen.set(target, prev === undefined ? isStar : prev || isStar)
        if (!isStar && !walked.has(target)) {
          walked.add(target)
          walk(target)
        }
      }
    }

    walked.add(root)
    walk(root)
    seen.delete(root)
    out[root] = [...seen].map(([id, star]) => (star ? '*' + id : id))
  }

  closureCache.set(ruleSet, out)
  return out
}

function applyExclusions(occurrences: Occurrence[], ruleSet: RuleSet): void {
  const byRule = new Map<string, Occurrence[]>()
  for (const o of occurrences) {
    const arr = byRule.get(o.rule.id) ?? []
    arr.push(o)
    byRule.set(o.rule.id, arr)
  }

  const table = transitiveExcludes(ruleSet)
  for (const [ruleId, entries] of byRule) {
    const excludes = table[ruleId]
    if (!excludes || entries.every((e) => e.dropped)) continue
    const cover = flatten(entries.filter((e) => !e.dropped).flatMap((e) => e.hit.evidence))

    for (const raw of excludes) {
      const unconditional = raw.startsWith('*')
      const targetId = unconditional ? raw.slice(1) : raw
      for (const target of byRule.get(targetId) ?? []) {
        if (target.dropped) continue
        if (unconditional || isSubMultiset(flatten(target.hit.evidence), cover)) {
          target.dropped = true
          target.droppedBy = entries[0].rule
        }
      }
    }
  }
}

function collect(occurrences: Occurrence[]): { rules: ScoredRule[]; suppressed: SuppressedRule[] } {
  const kept = new Map<string, ScoredRule>()
  const suppressed: SuppressedRule[] = []

  for (const o of occurrences) {
    if (o.dropped) {
      const by = o.droppedBy
      if (by && !suppressed.some((s) => s.ruleId === o.rule.id)) {
        suppressed.push({
          ruleId: o.rule.id,
          name: o.rule.name,
          points: o.rule.points,
          suppressedBy: by.id,
          suppressedByName: by.name,
          reason: by.name + ' already counts these tiles, so ' + o.rule.name +
            ' is not scored again.',
        })
      }
      continue
    }
    const points = o.hit.points ?? o.rule.points
    const existing = kept.get(o.rule.id)
    if (existing) {
      existing.times += 1
      existing.total += points
      existing.evidence.push(...o.hit.evidence)
      existing.explanation += ' ' + o.hit.explanation
    } else {
      kept.set(o.rule.id, {
        ruleId: o.rule.id,
        name: o.rule.name,
        chinese: o.rule.chinese,
        guide: o.rule.guide,
        category: o.rule.category,
        description: o.rule.description,
        points,
        times: 1,
        total: points,
        explanation: o.hit.explanation,
        evidence: [...o.hit.evidence],
      })
    }
  }

  const rules = [...kept.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  return { rules, suppressed }
}

function scoreStructure(
  hand: HandInput,
  ctx: GameContext,
  ruleSet: RuleSet,
  structure: Structure,
  waitBreadth: number,
): Candidate {
  const view = buildView(hand, ctx, structure, waitBreadth)
  const occurrences = evaluateAll(view, ruleSet)
  applyExclusions(occurrences, ruleSet)
  const { rules, suppressed } = collect(occurrences)

  const bonusPoints = rules
    .filter((r) => r.category === 'bonus')
    .reduce((n, r) => n + r.total, 0)
  let handPoints = rules
    .filter((r) => r.category !== 'bonus')
    .reduce((n, r) => n + r.total, 0)

  const cfg = ruleSet.chickenHand
  if (cfg.enabled) {
    const ignored = cfg.ignoresSelfDraw ? ['self_drawn'] : []
    const blocking = rules.filter(
      (r) => r.category !== 'bonus' && !ignored.includes(r.ruleId),
    )
    if (blocking.length === 0) {
      const rule = cfg.rule
      rules.unshift({
        ruleId: rule.id,
        name: rule.name,
        chinese: rule.chinese,
        guide: rule.guide,
        category: rule.category,
        description: rule.description,
        points: rule.points,
        times: 1,
        total: rule.points,
        explanation:
          'The hand is a legal win but matches none of the scoring patterns, which is ' +
          'itself worth ' + rule.points + ' points.',
        evidence: [view.logicalTiles],
      })
      handPoints += rule.points
    }
  }

  return { structure, rules, suppressed, handPoints, bonusPoints }
}

/**
 * How many different tiles the hand was waiting on. Take the winning tile back
 * out and ask which tiles would complete what is left: that is the wait the
 * player was actually sitting on, and the guide only awards Edge, Closed and
 * Single Wait when the answer is exactly one tile.
 */
function measureWait(hand: HandInput): number {
  const index = hand.concealed.indexOf(hand.winningTile)
  if (index < 0) return 1
  const before = {
    ...hand,
    concealed: hand.concealed.filter((_, i) => i !== index),
    winningTile: '',
  }
  return waitingTiles(before).length || 1
}

export function score(hand: HandInput, ctx: GameContext, ruleSet: RuleSet): ScoreOutcome {
  const check = validate(hand, ruleSet)
  if (!check.valid) return { valid: false, issues: check.issues }

  const waitBreadth = measureWait(hand)
  const candidates = check.structures.map(
    (s) => scoreStructure(hand, ctx, ruleSet, s, waitBreadth),
  )
  candidates.sort(
    (a, b) =>
      b.handPoints + b.bonusPoints - (a.handPoints + a.bonusPoints) ||
      a.rules.length - b.rules.length,
  )
  const best = candidates[0]

  const raw = best.handPoints + best.bonusPoints
  const capped = ruleSet.cap !== null ? Math.min(raw, ruleSet.cap) : raw

  const minimumBase = ruleSet.minimumExcludesBonus ? best.handPoints : raw

  return {
    valid: true,
    score: {
      rules: best.rules,
      suppressed: best.suppressed,
      handPoints: best.handPoints,
      bonusPoints: best.bonusPoints,
      totalPoints: capped,
      ...(capped !== raw ? { uncappedPoints: raw } : {}),
      meetsMinimum: minimumBase >= ruleSet.minimumPoints,
      minimumPoints: ruleSet.minimumPoints,
      structure: best.structure,
      readingsConsidered: candidates.length,
    },
  }
}
