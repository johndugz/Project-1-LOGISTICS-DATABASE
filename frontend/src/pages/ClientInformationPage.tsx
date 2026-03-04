import { Fragment, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import { UserRole } from '../types';

interface ClientInformation {
  id: string;
  createdAt: string;
  businessName: string;
  industry: string;
  contactPerson: string;
  contactNumber: string;
  email?: string;
  address?: string;
  website?: string;
  notes?: string;
}

const ClientInformationPage: React.FC = () => {
  const hasRole = useAuthStore((state) => state.hasRole);
  const canEdit = hasRole(UserRole.ADMIN);

  const initialClients = useMemo(() => {
    const listRaw = localStorage.getItem('clientInformationList');
    if (listRaw) {
      try {
        return JSON.parse(listRaw) as ClientInformation[];
      } catch {
        return [];
      }
    }

    const singleRaw = localStorage.getItem('clientInformation');
    if (!singleRaw) return [];

    try {
      const single = JSON.parse(singleRaw) as Omit<ClientInformation, 'id' | 'createdAt'>;
      return [
        {
          id: `client-${Date.now()}`,
          createdAt: new Date().toISOString(),
          ...single,
        },
      ];
    } catch {
      return [];
    }
  }, []);

  const [clients, setClients] = useState<ClientInformation[]>(initialClients);
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [pendingDeleteClientId, setPendingDeleteClientId] = useState<string | null>(null);
  const formSectionRef = useRef<HTMLFormElement | null>(null);

  const filteredClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return clients;

    return clients.filter((client) =>
      [
        client.businessName,
        client.industry,
        client.contactPerson,
        client.contactNumber,
        client.email || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [clients, searchQuery]);

  const handleSave = (event: React.FormEvent): void => {
    event.preventDefault();
    setSuccess(null);
    setError(null);

    if (!canEdit) {
      setError('Only admin users can input client information.');
      return;
    }

    if (!businessName || !industry || !contactPerson || !contactNumber) {
      setError('Please fill in all required fields.');
      return;
    }

    if (editingClientId) {
      const editedClientId = editingClientId;
      const updatedClients = clients.map((client) => {
        if (client.id !== editingClientId) return client;

        return {
          ...client,
          businessName,
          industry,
          contactPerson,
          contactNumber,
          email,
          address,
          website,
          notes,
        };
      });

      setClients(updatedClients);
      localStorage.setItem('clientInformationList', JSON.stringify(updatedClients));
      localStorage.setItem('clientInformation', JSON.stringify(updatedClients[0]));

      setBusinessName('');
      setIndustry('');
      setContactPerson('');
      setContactNumber('');
      setEmail('');
      setAddress('');
      setWebsite('');
      setNotes('');
      setEditingClientId(null);
      setExpandedClientId(editedClientId);

      requestAnimationFrame(() => {
        const rowElement = document.getElementById(`client-row-${editedClientId}`);
        rowElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      setSuccess('Client information updated successfully.');
      return;
    }

    const payload: ClientInformation = {
      id: `client-${Date.now()}`,
      createdAt: new Date().toISOString(),
      businessName,
      industry,
      contactPerson,
      contactNumber,
      email,
      address,
      website,
      notes,
    };

    const updatedClients = [payload, ...clients];
    setClients(updatedClients);
    localStorage.setItem('clientInformationList', JSON.stringify(updatedClients));
    localStorage.setItem('clientInformation', JSON.stringify(payload));

    setBusinessName('');
    setIndustry('');
    setContactPerson('');
    setContactNumber('');
    setEmail('');
    setAddress('');
    setWebsite('');
    setNotes('');

    setSuccess('Client information added to list successfully.');
  };

  const handleEdit = (client: ClientInformation): void => {
    if (!canEdit) return;

    setBusinessName(client.businessName);
    setIndustry(client.industry);
    setContactPerson(client.contactPerson);
    setContactNumber(client.contactNumber);
    setEmail(client.email || '');
    setAddress(client.address || '');
    setWebsite(client.website || '');
    setNotes(client.notes || '');
    setEditingClientId(client.id);
    setSuccess(null);
    setError(null);
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = (id: string): void => {
    if (!canEdit) return;

    setPendingDeleteClientId(id);
    setSuccess(null);
    setError(null);
  };

  const handleConfirmDelete = (): void => {
    if (!canEdit || !pendingDeleteClientId) return;

    const id = pendingDeleteClientId;
    const updatedClients = clients.filter((client) => client.id !== id);
    setClients(updatedClients);
    localStorage.setItem('clientInformationList', JSON.stringify(updatedClients));

    if (updatedClients.length > 0) {
      localStorage.setItem('clientInformation', JSON.stringify(updatedClients[0]));
    } else {
      localStorage.removeItem('clientInformation');
    }

    if (editingClientId === id) {
      setBusinessName('');
      setIndustry('');
      setContactPerson('');
      setContactNumber('');
      setEmail('');
      setAddress('');
      setWebsite('');
      setNotes('');
      setEditingClientId(null);
    }

    if (expandedClientId === id) {
      setExpandedClientId(null);
    }

    setPendingDeleteClientId(null);
    setSuccess('Client deletion confirmed. The record was deleted successfully.');
    setError(null);
  };

  const handleCancelDelete = (): void => {
    if (!pendingDeleteClientId) {
      return;
    }

    setPendingDeleteClientId(null);
    setError('Deletion cancelled. No client record was removed.');
    setSuccess(null);
  };

  const handleCancelEdit = (): void => {
    setBusinessName('');
    setIndustry('');
    setContactPerson('');
    setContactNumber('');
    setEmail('');
    setAddress('');
    setWebsite('');
    setNotes('');
    setEditingClientId(null);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="min-h-screen bg-brand-sand py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-red font-semibold mb-2">
              Client Management
            </p>
            <h1 className="text-4xl text-brand-ink">Client Information</h1>
          </div>
          <Link
            to="/dashboard"
            className="bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-4 py-2 rounded-lg"
          >
            Dashboard
          </Link>
        </div>

        {!canEdit && (
          <div className="mb-4 p-3 bg-amber-100 border border-amber-300 text-amber-800 rounded-lg">
            Only admin users can input client information.
          </div>
        )}

        <form
          ref={formSectionRef}
          onSubmit={handleSave}
          className="bg-white rounded-xl shadow p-6 border border-brand-amber/20 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Name of Business *</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.currentTarget.value)}
                disabled={!canEdit}
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Industry *</label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.currentTarget.value)}
                disabled={!canEdit}
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Contact Person *</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.currentTarget.value)}
                disabled={!canEdit}
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Contact Number *</label>
              <input
                type="text"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.currentTarget.value)}
                disabled={!canEdit}
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40 disabled:bg-gray-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Email (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                disabled={!canEdit}
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Website (Optional)</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.currentTarget.value)}
                disabled={!canEdit}
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40 disabled:bg-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-brand-charcoal font-semibold mb-2">Address (Optional)</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.currentTarget.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-brand-charcoal font-semibold mb-2">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              disabled={!canEdit}
              rows={4}
              className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40 disabled:bg-gray-100"
            />
          </div>

          {error && <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">{error}</div>}
          {success && <div className="p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg">{success}</div>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canEdit}
              className="bg-brand-red hover:bg-brand-redDark text-white font-bold px-5 py-2 rounded-lg disabled:bg-gray-400"
            >
              {editingClientId ? 'Update Client Information' : 'Save Client Information'}
            </button>
            {editingClientId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="bg-brand-charcoal hover:bg-brand-ink text-white font-bold px-5 py-2 rounded-lg ml-2"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        <div className="mt-6 bg-white rounded-xl shadow p-6 border border-brand-amber/20">
          <h2 className="text-2xl text-brand-ink mb-4">Client List</h2>

          {pendingDeleteClientId && (
            <div className="mb-4 p-4 rounded-lg border border-brand-red/40 bg-red-50 text-brand-charcoal">
              <p className="font-semibold mb-3">
                Are you sure you want to delete this client
                {(() => {
                  const pendingClient = clients.find((client) => client.id === pendingDeleteClientId);
                  return pendingClient?.businessName ? ` (${pendingClient.businessName})` : '';
                })()}
                ?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="bg-brand-red hover:bg-brand-redDark text-white font-semibold px-4 py-2 rounded-lg"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  className="bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-4 py-2 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-brand-charcoal font-semibold mb-2">Search Client</label>
            <div className="relative w-full md:w-1/2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                placeholder="Search by business, industry, contact person, phone, or email"
                className="w-full px-3 py-2 pr-10 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-charcoal/70 hover:text-brand-charcoal px-2 py-1"
                  aria-label="Clear client search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {clients.length === 0 ? (
            <p className="text-brand-charcoal/80">No client records yet.</p>
          ) : filteredClients.length === 0 ? (
            <p className="text-brand-charcoal/80">No matching clients found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-amber/30 text-left text-brand-charcoal">
                    <th className="py-2 pr-4">Name of Business</th>
                    <th className="py-2 pr-4">Industry</th>
                    <th className="py-2 pr-4">Contact Person</th>
                    <th className="py-2 pr-4">Contact Number</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Date Added</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <Fragment key={client.id}>
                      <tr id={`client-row-${client.id}`} className="border-b border-brand-amber/15 text-brand-charcoal">
                        <td className="py-2 pr-4 font-semibold">{client.businessName}</td>
                        <td className="py-2 pr-4">{client.industry}</td>
                        <td className="py-2 pr-4">{client.contactPerson}</td>
                        <td className="py-2 pr-4">{client.contactNumber}</td>
                        <td className="py-2 pr-4">{client.email || '-'}</td>
                        <td className="py-2 pr-4">{new Date(client.createdAt).toLocaleDateString()}</td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedClientId((prev) => (prev === client.id ? null : client.id))
                              }
                              className="bg-brand-charcoal hover:bg-brand-ink text-white px-3 py-1 rounded"
                            >
                              {expandedClientId === client.id ? 'Hide Details' : 'See Details'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(client)}
                              disabled={!canEdit}
                              className="bg-brand-charcoal hover:bg-brand-ink text-white px-3 py-1 rounded disabled:bg-gray-400"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(client.id)}
                              disabled={!canEdit}
                              className="bg-brand-red hover:bg-brand-redDark text-white px-3 py-1 rounded disabled:bg-gray-400"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedClientId === client.id && (
                        <tr className="border-b border-brand-amber/15 bg-brand-sand/60 text-brand-charcoal">
                          <td className="py-3 pr-4" colSpan={7}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <p>
                                <span className="font-semibold">Address:</span> {client.address || '-'}
                              </p>
                              <p>
                                <span className="font-semibold">Website:</span> {client.website || '-'}
                              </p>
                              <p className="md:col-span-2">
                                <span className="font-semibold">Notes:</span> {client.notes || '-'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientInformationPage;