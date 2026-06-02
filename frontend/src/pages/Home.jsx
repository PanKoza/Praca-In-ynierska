import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-950 flex flex-col items-center justify-center px-4 text-center">
      <span className="text-7xl mb-6">🏆</span>
      <h1 className="text-5xl font-extrabold text-white mb-4">
        Organizuj turnieje sportowe
      </h1>
      <p className="text-slate-400 text-lg max-w-xl mb-8">
        Twórz i zarządzaj turniejami siatkówki plażowej, piłki nożnej i nie tylko.
        Śledź wyniki na żywo, zapisuj się i rywalizuj.
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        <Link
          to="/tournaments"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Przeglądaj turnieje
        </Link>
        {!user && (
          <Link
            to="/register"
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors border border-slate-700"
          >
            Dołącz za darmo
          </Link>
        )}
      </div>

      {/* Feature cards */}
      <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
        {[
          { icon: '📋', title: 'Twórz turnieje', desc: 'Ustaw limity, daty i sport. Otwórz zapisy w jednym kliknięciu.' },
          { icon: '⚡', title: 'Wyniki na żywo', desc: 'Organizator wprowadza wyniki, zawodnicy śledzą drabinkę w czasie rzeczywistym.' },
          { icon: '🥇', title: 'Rankingi', desc: 'Automatyczne generowanie drabinek i tabeli wyników po każdym meczu.' },
        ].map((f) => (
          <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="text-white font-semibold mb-1">{f.title}</h3>
            <p className="text-slate-400 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
