/**
 * Every scoring hand in the rule table ships a worked example. These tests
 * build each example as a real hand and check the pattern actually fires, so a
 * picture can never drift away from the rule it illustrates.
 */

import { describe, expect, it } from 'vitest'
import { MCR_RULESET } from '../src/engine/ruleset'
import { MCR_EXAMPLES } from '../src/engine/rules/mcr/examples'
import { buildExample } from '../src/engine/rules/mcr/exampleHand'
import { decompose } from '../src/engine/decompose'
import { validate } from '../src/engine/validator'
import { buildView } from '../src/engine/view'
import { score } from '../src/engine/scorer'

const rules = MCR_RULESET.rules

describe('worked examples', () => {
  it('covers all 81 scoring hands', () => {
    const missing = rules.filter((r) => !MCR_EXAMPLES[r.id]).map((r) => r.id)
    expect(missing).toEqual([])
    expect(Object.keys(MCR_EXAMPLES)).toHaveLength(81)
  })

  it('has no example for a rule that does not exist', () => {
    const ids = new Set(rules.map((r) => r.id))
    const orphans = Object.keys(MCR_EXAMPLES).filter((id) => !ids.has(id))
    expect(orphans).toEqual([])
  })

  for (const rule of rules) {
    const example = MCR_EXAMPLES[rule.id]
    if (!example) continue

    it('builds a legal winning hand for ' + rule.name, () => {
      const { hand } = buildExample(example)
      const check = validate(hand, MCR_RULESET)
      if (!check.valid) {
        throw new Error(
          rule.id + ': ' + check.issues.map((i) => i.message).join(' | '),
        )
      }
      expect(check.structures.length).toBeGreaterThan(0)
    })

    it('shows a hand that really scores ' + rule.name, () => {
      const { hand, ctx } = buildExample(example)

      // Chicken Hand is awarded by the scorer once nothing else matches, so it
      // is checked through the full score rather than by evaluating the rule.
      if (rule.id === 'chicken_hand') {
        const out = score(hand, ctx, MCR_RULESET)
        if (!out.valid) throw new Error('chicken hand example is not a legal win')
        expect(out.score.rules.map((r) => r.ruleId)).toContain('chicken_hand')
        return
      }

      // Evaluate the rule directly against every reading of the tiles. Going
      // through the scorer instead would hide patterns that a larger one
      // legitimately absorbs, which is not what this test is about.
      const hit = decompose(hand).some((structure) => {
        const view = buildView(hand, ctx, structure, 1)
        return rule.evaluate(view).length > 0
      })

      expect(hit, rule.id + ' does not fire on its own example').toBe(true)
    })
  }
})
