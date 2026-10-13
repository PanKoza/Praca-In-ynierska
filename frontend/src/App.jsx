import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import CreateTournament from './pages/CreateTournament';
import OrganizerDashboard from './pages/OrganizerDashboard';
import OrganizerEventManagement from './pages/OrganizerEventManagement';
import RefereePanel from './pages/RefereePanel';
import RefereeDashboard from './pages/RefereeDashboard';
import LiveMatchView from './pages/LiveMatchView';
import PlayerDashboard from './pages/PlayerDashboard';

export default function App() {
  const [theme, setTheme] = useState('dark');

  return (
    <div className={theme === 'dark' ? 'theme-dark' : 'theme-light'}>
      <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
        <Navbar theme={theme} setTheme={setTheme} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/tournaments/:id" element={<TournamentDetail />} />
          <Route path="/tournaments/:tournamentId/matches/:matchId/live" element={<LiveMatchView />} />
          <Route
            path="/player"
            element={
              <ProtectedRoute roles={['PLAYER']}>
                <PlayerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizer/events/:id"
            element={
              <ProtectedRoute roles={['ORGANIZER', 'ADMIN']}>
                <OrganizerEventManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/referee"
            element={
              <ProtectedRoute roles={['REFEREE']}>
                <RefereeDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/referee/:id" element={<RefereePanel />} />
          <Route
            path="/tournaments/create"
            element={
              <ProtectedRoute roles={['ORGANIZER', 'ADMIN']}>
                <CreateTournament />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizer"
            element={
              <ProtectedRoute roles={['ORGANIZER', 'ADMIN']}>
                <OrganizerDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </div>
  );
}
