import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import apiClient from '../api/client';
import { Booking, BookingReplacement } from '../types';

export default function ViewReplacements() {
  const [searchParams] = useSearchParams();
  const bookingIdFromUrl = searchParams.get('bookingId');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [replacements, setReplacements] = useState<BookingReplacement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<Booking[]>('/bookings');
        if (!cancelled) {
          const list = res.data ?? [];
          setBookings(list);
          if (bookingIdFromUrl && list.some((b) => b.id === bookingIdFromUrl)) {
            setSelectedBookingId(bookingIdFromUrl);
          }
        }
      } catch {
        if (!cancelled) setBookings([]);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingIdFromUrl]);

  useEffect(() => {
    if (!selectedBookingId) {
      setReplacements([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await apiClient.get<BookingReplacement[]>(`/bookings/${selectedBookingId}/replacements`);
        if (!cancelled) setReplacements(res.data ?? []);
      } catch {
        if (!cancelled) setReplacements([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedBookingId]);

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId);

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/"
          className="text-gray-600 hover:text-gray-900 text-sm font-medium"
        >
          ← Retour au plan
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Voir remplacements</h1>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Booking</label>
        <select
          value={selectedBookingId ?? ''}
          onChange={(e) => setSelectedBookingId(e.target.value || null)}
          className="max-w-md px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">— Sélectionner un booking —</option>
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} — {new Date(b.effectiveDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-gray-500 text-sm">Chargement…</p>}

      {!loading && selectedBookingId && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">
              Remplaçants pour le booking « {selectedBooking?.name} » (début : {selectedBooking ? new Date(selectedBooking.effectiveDate).toLocaleDateString('fr-FR') : ''})
            </span>
          </div>
          {replacements.length === 0 ? (
            <p className="p-4 text-gray-500 text-sm italic">Aucun remplaçant configuré pour ce booking.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Poste</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Remplaçant 1</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Remplaçant 2</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Remplaçant 3</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {replacements.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{r.post?.name ?? r.postId}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {r.replacement1Worker ? `(${r.replacement1Worker.anciennete}) ${r.replacement1Worker.name}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {r.replacement2Worker ? `(${r.replacement2Worker.anciennete}) ${r.replacement2Worker.name}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {r.replacement3Worker ? `(${r.replacement3Worker.anciennete}) ${r.replacement3Worker.name}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
