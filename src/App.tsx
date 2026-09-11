import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Home } from './ui/screens/Home'
import { NewGame } from './ui/screens/NewGame'
import { GameTable } from './ui/screens/GameTable'
import { Capture } from './ui/screens/Capture'
import { TileEditor } from './ui/screens/TileEditor'
import { ScoreResult } from './ui/screens/ScoreResult'
import { RoundDetail, RoundHistory } from './ui/screens/Rounds'
import { PlayerLedger } from './ui/screens/PlayerLedger'
import { GameHistory, Players, RuleSets, Settings } from './ui/screens/Misc'
import { Guide } from './ui/screens/Guide'
import { Wall } from './ui/screens/Wall'
import { Rotation } from './ui/screens/Rotation'
import { MyHand } from './ui/screens/MyHand'

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<NewGame />} />
        <Route path="/history" element={<GameHistory />} />
        <Route path="/players" element={<Players />} />
        <Route path="/rules" element={<RuleSets />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/game/:gameId" element={<GameTable />} />
        <Route path="/game/:gameId/me" element={<MyHand />} />
        <Route path="/game/:gameId/wall" element={<Wall />} />
        <Route path="/game/:gameId/rotation" element={<Rotation />} />
        <Route path="/game/:gameId/capture" element={<Capture />} />
        <Route path="/game/:gameId/tiles" element={<TileEditor />} />
        <Route path="/game/:gameId/score" element={<ScoreResult />} />
        <Route path="/game/:gameId/rounds" element={<RoundHistory />} />
        <Route path="/game/:gameId/round/:roundId" element={<RoundDetail />} />
        <Route path="/game/:gameId/player/:playerId" element={<PlayerLedger />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
