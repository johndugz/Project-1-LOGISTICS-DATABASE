import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-4 bg-cover bg-center"
      style={{ backgroundImage: "url('/back1.webp')" }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 bg-brand-sand rounded-xl shadow-xl p-8 w-full max-w-md border border-brand-amber/30">
        <div className="text-center mb-6">
          <img
            src="/NAME lgo.png"
            alt="Toplis Logistics Inc."
            className="h-[12rem] mx-auto mb-10 object-contain"
          />
          <p className="text-xs uppercase tracking-[0.22em] text-brand-red font-semibold">
            Toplis Logistics Inc.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-brand-charcoal font-semibold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 border border-brand-amber/50 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-red/40"
              required
            />
          </div>

          <div>
            <label className="block text-brand-charcoal font-semibold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-brand-amber/50 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-red/40"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-red hover:bg-brand-redDark disabled:bg-brand-charcoal/50 text-white font-bold py-2 px-4 rounded-lg transition"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;
