/**
 * Hand validation. Runs before scoring and is the only place that decides
 * whether a set of tiles can win at all. The messages are written to be shown
 * straight to a player standing at the table.
 */

import { type TileId, PLAYABLE_TILE_IDS, isBonus, suitOf, tile, tileName } from './tiles'
import { type HandInput, allTiles, tileSupplyErrors } from './hand'
import { decompose, type Structure } from './decompose'
import type { RuleSet } from './ruleset'

export interface ValidationIssue {
  code: string
  message: string
  hint?: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  structures: Structure[]
}

function meldIssues(hand: HandInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  hand.melds.forEach((m, i) => {
    const label = 'Meld ' + (i + 1) + ' (' + m.tiles.map(tileName).join(', ') + ')'
    if (m.kind === 'pair') {
      issues.push({
        code: 'meld_pair',
        message: label + ' is marked as a pair.',
        hint: 'A pair cannot be claimed from the table. Move those tiles back into the hand.',
      })
      return
    }
    const expected = m.kind === 'kong' ? 4 : 3
    if (m.tiles.length !== expected) {
      issues.push({
        code: 'meld_size',
        message: label + ' has ' + m.tiles.length + ' tiles but a ' + m.kind + ' needs ' + expected + '.',
      })
      return
    }
    if (m.kind === 'chow') {
      const suit = suitOf(m.tiles[0])
      if (!suit || m.tiles.some((t) => suitOf(t) !== suit)) {
        issues.push({
          code: 'chow_suit',
          message: label + ' mixes suits. A chow must be three tiles of one suit.',
        })
        return
      }
      const ranks = m.tiles.map((t) => tile(t).rank).sort((a, b) => a - b)
      if (ranks[1] !== ranks[0] + 1 || ranks[2] !== ranks[1] + 1) {
        issues.push({
          code: 'chow_sequence',
          message: label + ' is not three tiles in a row.',
        })
      }
    } else if (new Set(m.tiles).size !== 1) {
      issues.push({
        code: 'set_identity',
        message: label + ' must be ' + expected + ' copies of the same tile.',
      })
    }
  })
  return issues
}

export function validate(hand: HandInput, ruleSet: RuleSet): ValidationResult {
  const issues: ValidationIssue[] = []

  const bonusInHand = [...hand.concealed, ...hand.melds.flatMap((m) => m.tiles)].filter(isBonus)
  if (bonusInHand.length > 0) {
    issues.push({
      code: 'bonus_in_hand',
      message: 'Flower and season tiles cannot be part of a set.',
      hint: 'Move ' + bonusInHand.map(tileName).join(', ') + ' to the bonus tile row.',
    })
  }

  if (!ruleSet.tileSet.flowers && hand.bonusTiles.length > 0) {
    issues.push({
      code: 'bonus_not_allowed',
      message: ruleSet.name + ' is played without flower tiles.',
    })
  }

  for (const message of tileSupplyErrors(hand)) {
    issues.push({ code: 'tile_supply', message })
  }

  issues.push(...meldIssues(hand))

  if (!hand.winningTile) {
    issues.push({
      code: 'no_winning_tile',
      message: 'No winning tile is marked.',
      hint: 'Tap the tile that completed the hand.',
    })
  } else if (!hand.concealed.includes(hand.winningTile)) {
    issues.push({
      code: 'winning_tile_placement',
      message: 'The winning tile ' + tileName(hand.winningTile) + ' is not in the concealed tiles.',
      hint: 'The winning tile always joins the hand, even when it completes a claimed set.',
    })
  }

  const total = allTiles(hand).length
  const kongs = hand.melds.filter((m) => m.kind === 'kong').length
  const expected = (ruleSet.handSize + 1) + kongs
  if (total !== expected) {
    issues.push({
      code: 'tile_count',
      message: 'The hand has ' + total + ' tiles but a winning hand needs ' + expected +
        (kongs > 0 ? ' with ' + kongs + ' kong' + (kongs > 1 ? 's' : '') + '.' : '.'),
      hint: total < expected ? 'Add the missing tiles.' : 'Remove the extra tiles.',
    })
  }

  const flags = hand.flags
  if (flags.robbingKong && hand.selfDraw) {
    issues.push({
      code: 'flag_conflict',
      message: 'Robbing the Kong takes a tile from another player, so it cannot be a self-draw.',
    })
  }
  if (flags.kongReplacement && !hand.selfDraw) {
    issues.push({
      code: 'flag_conflict',
      message: 'A kong replacement tile is always drawn, so it cannot be a discard win.',
    })
  }
  if (flags.lastTileDraw && !hand.selfDraw) {
    issues.push({
      code: 'flag_conflict',
      message: 'Last Tile Draw means the winner drew the last tile of the wall.',
    })
  }
  if (flags.lastTileClaim && hand.selfDraw) {
    issues.push({
      code: 'flag_conflict',
      message: 'Last Tile Claim means the win came from the final discard.',
    })
  }

  if (issues.length > 0) return { valid: false, issues, structures: [] }

  const structures = decompose(hand)
  if (structures.length === 0) {
    issues.push({
      code: 'no_winning_structure',
      message: 'These tiles do not form a winning hand.',
      hint: 'A winning hand is four sets and a pair, seven pairs, thirteen orphans, ' +
        'or one of the knitted hands. Check for a misread tile.',
    })
    return { valid: false, issues, structures: [] }
  }

  return { valid: true, issues: [], structures }
}

/**
 * Tiles that would turn a 13-tile hand into a winning hand. The tile editor
 * uses this to tell a player which tile they are still missing.
 */
export function waitingTiles(hand: HandInput): TileId[] {
  const candidates: TileId[] = []
  for (const id of PLAYABLE_TILE_IDS) {
    const probe: HandInput = {
      ...hand,
      concealed: [...hand.concealed, id],
      winningTile: id,
    }
    if (decompose(probe).length > 0) candidates.push(id)
  }
  return candidates
}
