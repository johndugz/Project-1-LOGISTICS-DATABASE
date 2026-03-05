import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import apiService from '../services/api';

const Login = () => {
  const [mode, setMode] = useState<'login' | 'signup' | 'verify'>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const resetForm = (): void => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setVerificationCode('');
    setInfo(null);
    setError(null);
  };

  const toggleMode = (): void => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setIsLoading(true);

    try {
      if (mode === 'verify') {
        if (!verificationCode.trim()) {
          throw new Error('Verification code is required');
        }

        await apiService.verifyEmail(email, verificationCode.trim());
        setInfo('Email verified successfully. Wait for admin approval, then log in.');
        setMode('login');
        setVerificationCode('');
        setIsLoading(false);
        return;
      }

      if (mode === 'signup') {
        if (!firstName.trim() || !lastName.trim()) {
          throw new Error('First name and last name are required');
        }

        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }

        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }

        const signupResponse = await apiService.signup(email, password, firstName.trim(), lastName.trim());
        const baseMessage = signupResponse.emailSent
          ? 'Account created. Check your email for the verification code.'
          : 'Account created. Email service is not configured locally, use the dev verification code shown below.';
        const devCodeMessage = signupResponse.devVerificationCode
          ? ` Dev verification code: ${signupResponse.devVerificationCode}`
          : '';

        setInfo(`${baseMessage}${devCodeMessage}`);
        setMode('verify');
        setVerificationCode('');
        setIsLoading(false);
        return;
      }

      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const response = (err as { response?: { data?: { error?: string; message?: string } } }).response;
        const serverMessage = response?.data?.error || response?.data?.message;
        setError(
          serverMessage ||
            (mode === 'signup'
              ? 'Account creation failed'
              : mode === 'verify'
              ? 'Email verification failed'
              : 'Login failed')
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : mode === 'signup'
            ? 'Account creation failed'
            : mode === 'verify'
            ? 'Email verification failed'
            : 'Login failed'
        );
      }
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
          <p className="text-sm text-brand-charcoal/80 mt-2">
            {mode === 'login'
              ? 'Sign in to your account'
              : mode === 'signup'
              ? 'Create a new user account'
              : 'Verify your email'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {info && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg">
              {info}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {mode === 'signup' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-brand-charcoal font-semibold mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full px-4 py-2 border border-brand-amber/50 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                  required
                />
              </div>
              <div>
                <label className="block text-brand-charcoal font-semibold mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full px-4 py-2 border border-brand-amber/50 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                  required
                />
              </div>
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
              disabled={mode === 'verify'}
            />
          </div>

          {mode !== 'verify' && (
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
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2 border border-brand-amber/50 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                required
              />
            </div>
          )}

          {mode === 'verify' && (
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">
                Verification Code
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full px-4 py-2 border border-brand-amber/50 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-red hover:bg-brand-redDark disabled:bg-brand-charcoal/50 text-white font-bold py-2 px-4 rounded-lg transition"
          >
            {isLoading
              ? mode === 'signup'
                ? 'Creating account...'
                : mode === 'verify'
                ? 'Verifying email...'
                : 'Logging in...'
              : mode === 'signup'
              ? 'Create Account'
              : mode === 'verify'
              ? 'Verify Email'
              : 'Login'}
          </button>

          <button
            type="button"
            onClick={mode === 'verify' ? () => { setMode('login'); setError(null); } : toggleMode}
            className="w-full border border-brand-amber/50 text-brand-charcoal font-semibold py-2 px-4 rounded-lg hover:bg-brand-amber/10 transition"
          >
            {mode === 'login' ? 'Create new account' : 'Back to login'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;
