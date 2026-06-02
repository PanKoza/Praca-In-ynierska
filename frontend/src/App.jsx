import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import CreateTournament from './pages/CreateTournament';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
        <Route
          path="/tournaments/create"
          element={
            <ProtectedRoute roles={['ORGANIZER', 'ADMIN']}>
              <CreateTournament />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}
