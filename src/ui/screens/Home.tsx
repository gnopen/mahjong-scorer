import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { backendLabel, store } from '../../db'
import type { Game } from '../../db/types'
import { Empty, Screen, Section, Spinner } from '../components/Layout'
import { useRecognizerStatus } from '../../state/useRecognizer'

function Icon({ path }: { path: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

const ICONS = {
  camera: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z',
  play: 'M5 3l14 9-14 9V3z',
  history: 'M3 3v5h5M3.05 13A9 9 0 106 5.3L3 8M12 7v5l4 2',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  book: 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 003.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 008 3.6 1.65 1.65 0 009 2.09V2a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0020.4 8V9a1.65 1.65 0 001.51 1H22a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
}

function Tile({ to, icon, title, sub }: { to: string; icon: string; title: string; sub: string }) {
  return (
    <Link
      to={to}
      className="card flex items-center gap-3 transition active:scale-[.99] hover:border-gold/40"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-felt/30 text-gold">
        <Icon path={icon} />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-slate-400">{sub}</span>
      </span>
    </Link>
  )
}

export function Home() {
  const navigate = useNavigate()
  const [games, setGames] = useState<Game[] | null>(null)
  const { status: recognizer } = useRecognizerStatus()

  useEffect(() => {
    void store().listGames().then(setGames)
  }, [])

  const active = games?.filter((g) => g.status === 'active') ?? []

  return (
    <Screen
      title="Mahjong Scorer"
      subtitle={backendLabel()}
    >
      <div className="mb-5 overflow-hidden rounded-2xl border border-ink-line/70 bg-gradient-to-br from-felt/50 via-ink-soft to-ink p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Chinese Official
        </p>
        <h2 className="mt-1 text-xl font-extrabold leading-tight">
          Photograph the hand.<br />Get the score and who pays.
        </h2>
        <button
          onClick={() => navigate('/new')}
          className="btn-gold mt-4 w-full text-base"
        >
          <Icon path={ICONS.play} />
          New game
        </button>
        {recognizer && !recognizer.ready ? (
          <p className="mt-3 text-[11px] leading-snug text-amber-300/80">
            {recognizer.detail}
          </p>
        ) : null}
      </div>

      {games === null ? (
        <Spinner label="Loading games" />
      ) : active.length > 0 ? (
        <Section title="Continue" hint="Games still in progress">
          <div className="space-y-2">
            {active.map((g) => (
              <Link
                key={g.id}
                to={'/game/' + g.id}
                className="card flex items-center justify-between gap-3 transition active:scale-[.99]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{g.name}</span>
                  <span className="block text-xs text-slate-400">
                    Round {g.roundNumber} · {new Date(g.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <span className="chip shrink-0">Open</span>
              </Link>
            ))}
          </div>
        </Section>
      ) : (
        <Section title="Continue">
          <Empty
            title="No game in progress"
            body="Start a new game to set up players, seats and the dealer."
          />
        </Section>
      )}

      <Section title="Everything else">
        <div className="grid gap-2">
          <Tile to="/history" icon={ICONS.history} title="Game history"
            sub="Finished games, rounds and every transaction" />
          <Tile to="/players" icon={ICONS.users} title="Players"
            sub="Add people and see their record" />
          <Tile to="/guide" icon={ICONS.book} title="Guide"
            sub="The tile set, the wall, dealing and rounds" />
          <Tile to="/rules" icon={ICONS.list} title="Scoring hands"
            sub="All 81 patterns, with the guide's hand numbers" />
          <Tile to="/settings" icon={ICONS.gear} title="Settings"
            sub="Backend, recognition and data" />
        </div>
      </Section>

      {games && games.some((g) => g.status === 'finished') ? (
        <Section title="Recently finished">
          <div className="space-y-2">
            {games.filter((g) => g.status === 'finished').slice(0, 3).map((g) => (
              <Link key={g.id} to={'/game/' + g.id}
                className="card flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-300">{g.name}</span>
                  <span className="block text-xs text-slate-500">
                    Ended {g.endedAt ? new Date(g.endedAt).toLocaleDateString() : ''}
                  </span>
                </span>
                <span className="chip shrink-0">{g.roundNumber - 1} rounds</span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
    </Screen>
  )
}
