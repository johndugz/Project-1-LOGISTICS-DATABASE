import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please complete all password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    localStorage.setItem('mockPassword', newPassword);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSuccess('Password updated successfully.');
  };

  return (
    <div className="min-h-screen bg-brand-sand py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-red font-semibold mb-2">
              Settings
            </p>
            <h1 className="text-4xl text-brand-ink">Password & Security</h1>
          </div>
          <div className="flex gap-2">
            <Link
              to="/dashboard"
              className="bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-4 py-2 rounded-lg"
            >
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="bg-brand-red hover:bg-brand-redDark text-white font-semibold px-4 py-2 rounded-lg"
            >
              Logout
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow p-6 border border-brand-amber/20 space-y-4"
        >
          <div>
            <label className="block text-brand-charcoal font-semibold mb-2">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.currentTarget.value)}
              className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
              required
            />
          </div>

          <div>
            <label className="block text-brand-charcoal font-semibold mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.currentTarget.value)}
              className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
              required
            />
          </div>

          <div>
            <label className="block text-brand-charcoal font-semibold mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.currentTarget.value)}
              className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg">
              {success}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-brand-red hover:bg-brand-redDark text-white font-bold px-5 py-2 rounded-lg"
            >
              Update Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;