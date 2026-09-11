import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { backendLabel, store } from '../../db'
import type { Game, Player } from '../../db/types'
import { usePlayers } from '../../state/useGame'
import { RULE_SETS } from '../../engine/ruleset'
import { MCR_RELATIONSHIPS } from '../../engine/rules/mcr'
import { MCR_EXAMPLES } from '../../engine/rules/mcr/examples'
import { ExampleHand } from '../components/ExampleHand'
import { useRecognizerStatus } from '../../state/useRecognizer'
import { Banner, Empty, Screen, Section, Spinner } from '../components/Layout'

const COLORS = ['#e9b949', '#38bdf8', '#f472b6', '#4ade80', '#fb923c', '#a78bfa']

export function GameHistory() {
  const [games, setGames] = useState<Game[] | null>(null)
  useEffect(() => { void store().listGames().then(setGames) }, [])

  if (!games) return <Screen title="Game history" back="/"><Spinner label="Loading games" /></Screen>

  return (
    <Screen title="Game history" back="/">
      {games.length === 0 ? (
        <Empty title="No games yet" body="Games appear here as soon as you start one." />
      ) : (
        <ul className="space-y-2">
          {games.map((g) => (
            <li key={g.id}>
              <Link to={'/game/' + g.id} className="card flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{g.name}</span>
                  <span className="block text-xs text-slate-500">
                    {new Date(g.createdAt).toLocaleDateString()} · {g.roundNumber - 1} rounds
                  </span>
                </span>
                <span className={'chip shrink-0 ' + (g.status === 'active' ? 'border-winner/50 text-winner' : '')}>
                  {g.status === 'active' ? 'In progress' : 'Finished'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}

export function Players() {
  const { players, loading, refresh } = usePlayers()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Player | null>(null)
  const [error, setError] = useState<string | null>(null)

  const add = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      await store().createPlayer(trimmed, COLORS[players.length % COLORS.length])
      setName('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const rename = async () => {
    if (!editing) return
    setBusy(true)
    await store().renamePlayer(editing.id, editing.name.trim())
    setEditing(null)
    await refresh()
    setBusy(false)
  }

  if (loading) return <Screen title="Players" back="/"><Spinner label="Loading players" /></Screen>

  return (
    <Screen title="Players" back="/">
      {error ? <div className="mb-4"><Banner tone="error" title="Could not save">{error}</Banner></div> : null}

      <Section title="Add a player">
        <div className="flex gap-2">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
            placeholder="Name"
          />
          <button className="btn-gold shrink-0" disabled={busy || !name.trim()} onClick={() => void add()}>
            Add
          </button>
        </div>
      </Section>

      <Section title="Everyone">
        {players.length === 0 ? (
          <Empty title="No players yet" body="Add the people you play with and they are reusable across games." />
        ) : (
          <ul className="card divide-y divide-ink-line/50 p-0">
            {players.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: p.color }} />
                {editing?.id === p.id ? (
                  <>
                    <input
                      className="input py-2"
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                    <button className="btn-gold shrink-0 px-3 py-2 text-xs" onClick={() => void rename()}>
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-semibold">{p.name}</span>
                    <button className="text-xs font-semibold text-gold" onClick={() => setEditing(p)}>
                      Rename
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Screen>
  )
}

export function RuleSets() {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <Screen title="Rule sets" back="/" subtitle="What the scoring engine is actually doing">
      {RULE_SETS.map((rs) => {
        const byValue = new Map<number, typeof rs.rules>()
        for (const r of rs.rules) {
          const arr = byValue.get(r.points) ?? []
          arr.push(r)
          byValue.set(r.points, arr)
        }
        const values = [...byValue.keys()].sort((a, b) => b - a)

        return (
          <div key={rs.id} className="mb-5">
            <div className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold">{rs.name}</h2>
                  <p className="text-xs text-slate-500">{rs.variant}</p>
                </div>
                <span className="chip shrink-0">{rs.rules.length} patterns</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{rs.description}</p>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-ink px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                    Guide minimum
                  </dt>
                  <dd className="font-bold">
                    {rs.minimumPoints} points
                    <span className="block text-[10px] font-normal text-slate-500">
                      set per game, 0 by default
                    </span>
                  </dd>
                </div>
                <div className="rounded-xl bg-ink px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-wider text-slate-500">Players</dt>
                  <dd className="font-bold">{rs.playerCount}</dd>
                </div>
                <div className="rounded-xl bg-ink px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-wider text-slate-500">Flowers</dt>
                  <dd className="font-bold">{rs.tileSet.flowers ? '1 point each' : 'Not used'}</dd>
                </div>
                <div className="rounded-xl bg-ink px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-wider text-slate-500">Score cap</dt>
                  <dd className="font-bold">{rs.cap === null ? 'None' : rs.cap}</dd>
                </div>
              </dl>

              <div className="mt-3 rounded-xl bg-ink px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Payments</p>
                <p className="mt-0.5 text-sm text-slate-300">{rs.payment.description}</p>
              </div>

              <button
                className="btn-ghost mt-3 w-full"
                onClick={() => setOpenId(openId === rs.id ? null : rs.id)}
              >
                {openId === rs.id
                  ? 'Hide the pattern table'
                  : 'Show all ' + rs.rules.length + ' patterns, with example hands'}
              </button>
            </div>

            {openId === rs.id ? (
              <div className="mt-3 space-y-3">
                {values.map((v) => (
                  <div key={v} className="card">
                    <h3 className="mb-2 text-sm font-bold text-gold">
                      {v} {v === 1 ? 'point' : 'points'}
                      <span className="ml-2 text-[11px] font-normal text-slate-500">
                        {(byValue.get(v) ?? []).length} hands
                      </span>
                    </h3>
                    <ul className="divide-y divide-ink-line/50">
                      {(byValue.get(v) ?? [])
                        .slice()
                        .sort((a, b) => a.guide - b.guide)
                        .map((r) => (
                        <li key={r.id} className="py-2">
                          <p className="flex items-baseline gap-2 text-sm font-semibold">
                            <span className="text-[10px] tabular-nums text-slate-600">
                              #{r.guide}
                            </span>
                            {r.name}
                            {r.chinese ? (
                              <span className="tile-face text-xs text-slate-500">{r.chinese}</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-slate-400">{r.description}</p>
                          {MCR_EXAMPLES[r.id] ? (
                            <ExampleHand example={MCR_EXAMPLES[r.id]} />
                          ) : null}
                          {MCR_RELATIONSHIPS.excludes[r.id] ? (
                            <p className="mt-1.5 text-[11px] text-sky-300/70">
                              Absorbs:{' '}
                              {MCR_RELATIONSHIPS.excludes[r.id]
                                .map((x) => x.replace(/^\*/, '').replace(/_/g, ' '))
                                .join(', ')}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}

      <Banner tone="info" title="Where these come from">
        <p>
          Hand numbers, point values and every &ldquo;cannot be combined with&rdquo; rule are
          taken from A Guide to Mahjong (Chinese / Official International Rules). Two
          Concealed Kongs scores 6 here, which is what the guide&rsquo;s own table says and
          what makes its section counts balance, though some other published tables put it
          at 8.
        </p>
      </Banner>

      <div className="h-3" />

      <Banner tone="info" title="Adding another rule set">
        A rule set is a list of pattern objects, an exclusion table and a payment function.
        Hong Kong Old Style or Riichi would each be a new file under the rules folder plus one
        entry in the rule-set list. Nothing in the screens or the ledger would change.
      </Banner>
    </Screen>
  )
}

export function Settings() {
  const [cleared, setCleared] = useState(false)
  const { status: recognizer, recheck } = useRecognizerStatus()

  return (
    <Screen title="Settings" back="/">
      <Section title="Storage">
        <div className="card">
          <p className="font-semibold">{backendLabel()}</p>
          <p className="mt-1 text-sm text-slate-400">
            {store().kind === 'supabase'
              ? 'Rounds and balances sync to every phone looking at the same game.'
              : 'No Supabase project is configured, so games live in this browser only. ' +
                'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then run supabase/schema.sql.'}
          </p>
        </div>
      </Section>

      <Section title="Tile recognition">
        <div className="card">
          {recognizer === null ? (
            <p className="text-sm text-slate-400">Checking the recognition endpoint.</p>
          ) : (
            <>
              <p className={'font-semibold ' + (recognizer.ready ? 'text-winner' : 'text-amber-300')}>
                {recognizer.ready ? 'Working' : 'Unavailable'}
              </p>
              <p className="mt-1 text-sm text-slate-400">{recognizer.detail}</p>
              <p className="mt-2 text-xs text-slate-500">
                Endpoint: {recognizer.endpoint.label}
                {recognizer.endpoint.url ? ' at ' + recognizer.endpoint.url : ''}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Every reading goes to the tile editor for confirmation before anything is
                scored, so a misread tile can never change a balance on its own.
              </p>
              <button className="btn-ghost mt-3 w-full" onClick={recheck}>
                Check again
              </button>
            </>
          )}
        </div>
      </Section>

      <Section title="How scoring works">
        <div className="card space-y-2 text-sm text-slate-400">
          <p>
            Photo input and manual input build the same hand model, which is validated,
            decomposed into every legal reading, scored against the rule table and then
            reduced by the exclusion table.
          </p>
          <p>
            The highest scoring reading wins, which is what the Chinese Official rules
            require when tiles can be read more than one way.
          </p>
          <p>
            Balances are never written directly. Each round appends one transaction per
            player, and a balance is the sum of those transactions.
          </p>
        </div>
      </Section>

      <Section title="Data">
        <div className="card">
          <p className="text-sm text-slate-400">
            Clearing removes on-device games. Anything already synced to Supabase is not
            touched.
          </p>
          <button
            className="btn-danger mt-3 w-full"
            onClick={() => {
              indexedDB.deleteDatabase('mahjong-scorer')
              setCleared(true)
            }}
          >
            Clear on-device data
          </button>
          {cleared ? (
            <p className="mt-2 text-xs text-amber-300">Cleared. Reload the app to start fresh.</p>
          ) : null}
        </div>
      </Section>
    </Screen>
  )
}
