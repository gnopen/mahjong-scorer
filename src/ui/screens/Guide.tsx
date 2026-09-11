import { Link } from 'react-router-dom'
import { BONUS_TILE_IDS, DRAGONS, SUITS, WINDS, tileName } from '../../engine/tiles'
import { DEAD_WALL_TILES, WIND_LABEL } from '../../engine/setup'
import { Banner, Screen, Section } from '../components/Layout'
import { Tile } from '../components/Tile'
import { Compass } from '../components/Compass'
import { DealDiagram } from '../components/DealDiagram'

/**
 * The tile set and the table procedure, laid out the way A Guide to Mahjong
 * presents them, so a new player can be handed a phone instead of the PDF.
 */

function TileRow({ ids, labels }: { ids: string[]; labels?: boolean }) {
  return (
    <div className="scroll-x">
      {ids.map((id) => (
        <div key={id} className="flex shrink-0 flex-col items-center gap-1">
          <Tile id={id} size="md" />
          {labels ? (
            <span className="max-w-[3rem] text-center text-[9px] leading-tight text-slate-500">
              {tileName(id)}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

const SUIT_NOTES: Record<string, string> = {
  b: 'Bamboos show sticks. The 1 is drawn as a bird.',
  c: 'Characters carry a Chinese numeral above the character 萬.',
  d: 'Dots show rings.',
}

const SUIT_TITLE: Record<string, string> = {
  b: 'Bamboos', c: 'Characters', d: 'Dots',
}

export function Guide() {
  return (
    <Screen
      title="Guide"
      back="/"
      subtitle="The tile set and how a hand is set up"
    >
      <Section title="The set" hint="144 tiles: three suits, four winds, three dragons, eight flowers and seasons.">
        <div className="card space-y-4">
          {SUITS.map((s) => (
            <div key={s}>
              <p className="label">{SUIT_TITLE[s]}</p>
              <TileRow ids={[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => s + n)} />
              <p className="mt-1.5 text-[11px] text-slate-500">{SUIT_NOTES[s]}</p>
            </div>
          ))}
          <p className="text-xs text-slate-400">
            There are four of each of these tiles. The 1 and 9 of every suit are Terminals;
            2 to 8 are Simples.
          </p>
        </div>
      </Section>

      <Section title="The four winds">
        <div className="card">
          <TileRow ids={[...WINDS]} labels />
          <p className="mt-2 text-[11px] text-slate-500">
            Also called the directional tiles. They are counted counter-clockwise, East,
            South, West, North, which is how Chinese compass directions are traditionally
            listed. Four of each.
          </p>
        </div>
      </Section>

      <Section title="The three dragons">
        <div className="card">
          <TileRow ids={[...DRAGONS]} labels />
          <p className="mt-2 text-[11px] text-slate-500">
            The cardinal tiles: Red 中, Green 發, and White, which is a blank tile inside a
            frame. Four of each. Winds and dragons together are the Honor tiles.
          </p>
        </div>
      </Section>

      <Section title="Flowers and seasons">
        <div className="card">
          <TileRow ids={BONUS_TILE_IDS} labels />
          <p className="mt-2 text-[11px] text-slate-500">
            One of each, not four. They never form part of a set. Draw one, show it, and take
            a replacement from the dead wall. Each is worth 1 point, counted outside the
            8-point minimum.
          </p>
        </div>
      </Section>

      <Section title="Starting a hand">
        <ol className="card space-y-3 text-sm text-slate-300">
          <li>
            <span className="font-semibold text-slate-100">Draw for seats.</span> Each player
            draws one of the four winds. Whoever draws East takes the East side and deals.
          </li>
          <li>
            <span className="font-semibold text-slate-100">Build the wall.</span> Mix all 144
            tiles face down. Each player lines up 36 tiles, two high, and the four lines are
            pushed together into a square.
          </li>
          <li>
            <span className="font-semibold text-slate-100">Break the wall.</span> East throws
            two dice and counts that total counter-clockwise around the four sides, counting
            his own side as 1. That player throws in turn, counts the new total in from the
            right-hand end of his own side, and opens a gap there.
          </li>
          <li>
            <span className="font-semibold text-slate-100">Count the dead wall.</span> The{' '}
            {DEAD_WALL_TILES} tiles to the right of the gap are reserved for replacements
            after a flower or a kong. It stays {DEAD_WALL_TILES} tiles however many are taken.
          </li>
          <li>
            <span className="font-semibold text-slate-100">Deal.</span> Drawing to the left of
            the gap, in this order:
            <div className="mt-2 rounded-xl bg-ink/60 p-2">
              <DealDiagram />
            </div>
          </li>
        </ol>
      </Section>

      <Section title="Which way play goes" hint="Follow the arrows.">
        <div className="card">
          <Compass
            seats={[
              { seat: 0, name: 'Dealer', color: '#e9b949' },
              { seat: 1, name: '', color: '#38bdf8' },
              { seat: 2, name: '', color: '#f472b6' },
              { seat: 3, name: '', color: '#4ade80' },
            ]}
            handNumber={1}
            prevalentWind="east"
          />
        </div>
      </Section>

      <Section title="Claiming a discard">
        <div className="card space-y-2 text-sm text-slate-400">
          <p>
            <span className="font-semibold text-slate-200">Chow</span> is a run of three in one
            suit, and may only be claimed from the player on your left.
          </p>
          <p>
            <span className="font-semibold text-slate-200">Pung</span> is three identical
            tiles, claimable from anyone.
          </p>
          <p>
            <span className="font-semibold text-slate-200">Kong</span> is four identical
            tiles. Claimed from a discard it is exposed; drawn from the wall it stays
            concealed. Either way the player draws a replacement from the dead wall.
          </p>
          <p>
            <span className="font-semibold text-slate-200">Pair</span> may only be claimed to
            go out, and a hand holds exactly one.
          </p>
          <p>
            When two players claim the same discard the order is: going out, then kong or
            pung, then chow. If two players claim it to go out, the one closer to the right of
            the discarder wins.
          </p>
        </div>
      </Section>

      <Section title="Rounds">
        <div className="card space-y-2 text-sm text-slate-400">
          <p>
            After every hand, including a dead hand, the winds rotate counter-clockwise: East
            becomes South, South becomes West, West becomes North, and North becomes the new
            East.
          </p>
          <p>
            {(['east', 'south', 'west', 'north'] as const)
              .map((w) => WIND_LABEL[w])
              .join(', ')}{' '}
            are the four rounds, four hands each, so a full game is 16 hands and every player
            sits every seat in every round.
          </p>
        </div>
      </Section>

      <Banner tone="info" title="Scoring">
        <p>
          Only the player who declares Mahjong scores. A hand needs at least 8 points from
          scoring patterns, flowers excluded, or declaring it costs 30 points, 10 to each
          player.
        </p>
        <Link to="/rules" className="mt-2 inline-block font-semibold text-sky-200 underline">
          See all 81 scoring hands
        </Link>
      </Banner>
    </Screen>
  )
}
