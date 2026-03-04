import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';

interface StoredProfile {
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  region: string;
  profileImage: string;
}

const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  const savedProfile = useMemo(() => {
    const raw = localStorage.getItem('profileSettings');
    if (!raw) return null;

    try {
      return JSON.parse(raw) as StoredProfile;
    } catch {
      return null;
    }
  }, []);

  const [displayName, setDisplayName] = useState(
    savedProfile?.displayName || `${user?.firstName || 'Toplis'} ${user?.lastName || 'User'}`
  );
  const [firstName, setFirstName] = useState(savedProfile?.firstName || user?.firstName || '');
  const [lastName, setLastName] = useState(savedProfile?.lastName || user?.lastName || '');
  const [email, setEmail] = useState(savedProfile?.email || user?.email || '');
  const [phone, setPhone] = useState(savedProfile?.phone || user?.phone || '');
  const [region, setRegion] = useState(savedProfile?.region || user?.region || '');
  const [profileImage, setProfileImage] = useState(savedProfile?.profileImage || '');
  const [success, setSuccess] = useState<string | null>(null);

  const onUploadImage = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfileImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const onSave = (event: React.FormEvent): void => {
    event.preventDefault();

    const profileToSave: StoredProfile = {
      displayName,
      firstName,
      lastName,
      email,
      phone,
      region,
      profileImage,
    };

    localStorage.setItem('profileSettings', JSON.stringify(profileToSave));

    if (user) {
      setUser({
        ...user,
        firstName,
        lastName,
        email,
        phone,
        region,
      });
    }

    setSuccess('Profile updated successfully.');
  };

  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-brand-sand py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-red font-semibold mb-2">
              Account
            </p>
            <h1 className="text-4xl text-brand-ink">Profile</h1>
          </div>
          <div className="flex gap-2">
            <Link
              to="/dashboard"
              className="bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-4 py-2 rounded-lg"
            >
              Dashboard
            </Link>
            <Link
              to="/settings"
              className="bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-4 py-2 rounded-lg"
            >
              Settings
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
          onSubmit={onSave}
          className="bg-white rounded-xl shadow p-6 border border-brand-amber/20 space-y-6"
        >
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full overflow-hidden border border-brand-amber/30 bg-brand-sand flex items-center justify-center">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-brand-charcoal font-bold text-xl">
                  {displayName.trim().charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div>
              <p className="font-semibold text-brand-charcoal">Profile Picture</p>
              <input
                type="file"
                accept="image/*"
                onChange={onUploadImage}
                className="mt-2 text-sm text-brand-charcoal"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.currentTarget.value)}
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                required
              />
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                required
              />
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.currentTarget.value)}
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                required
              />
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.currentTarget.value)}
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                required
              />
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.currentTarget.value)}
                placeholder="Enter phone number"
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
              />
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Region</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.currentTarget.value)}
                placeholder="e.g. NCR"
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
              />
            </div>
          </div>

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
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccountPage;