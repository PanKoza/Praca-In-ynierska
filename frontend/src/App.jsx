import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import SmoothScroll from './components/SmoothScroll';
import { ConfirmProvider } from './components/Modal';
import { TourProvider } from './components/Tour';
import { prefersReducedMotion } from './lib/motion';
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

const THEME_KEY = 'tourniDesk.theme';
const THEME_COLOR = { light: '#f3f0e8', dark: '#0c0e0a' };

function initialTheme() {
  const preset = document.documentElement.dataset.theme;
  if (preset === 'dark' || preset === 'light') return preset;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

export default function App() {
  const [theme, setTheme] = useState(initialTheme);
  const viewRef = useRef(null);
  const location = useLocation();
  /* Tools used in the middle of a match keep the screen to themselves. */
  const focusedTool = location.pathname.startsWith('/referee/');

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback((event) => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable — the choice lasts for this visit only */
    }
    const commit = () => {
      flushSync(() => setTheme(next));
      applyTheme(next);
    };
    if (!document.startViewTransition || prefersReducedMotion()) {
      commit();
      return;
    }
    /* The new theme spreads out from the toggle button in a growing circle. */
    const x = event?.clientX ?? window.innerWidth - 40;
    const y = event?.clientY ?? 36;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    document.startViewTransition(commit).ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      })
      .catch(() => {});
  }, [theme]);

  return (
    <ConfirmProvider>
      <TourProvider>
        <SmoothScroll viewRef={viewRef} />
        <div className="flex min-h-screen flex-col bg-bg text-body">
          <a href="#main" className="btn btn-solid btn-sm fixed left-3 top-3 z-[120] -translate-y-20 focus:translate-y-0">Przejdź do treści</a>
          <Navbar theme={theme} onToggleTheme={toggleTheme} />
          <div ref={viewRef} id="main" className="flex-1">
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
          {!focusedTool && <Footer />}
        </div>
      </TourProvider>
    </ConfirmProvider>
  );
}
