import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import apiClient from '../api/client';
import { Booking, BookingReplacement } from '../types';
import { formatLocalDate } from '../utils/dateUtils';

export default function ViewReplacements() {
  const [searchParams] = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string>(searchParams.get('bookingId') || '');
  const [replacements, setReplacements] = useState<BookingReplacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<Booking[]>('/bookings');
        setBookings(res.data);
      } catch (err: any) {
        setError('Erreur lors du chargement des bookings');
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedBookingId) {
      setReplacements([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiClient.get<BookingReplacement[]>(`/bookings/${selectedBookingId}/replacements`);
        if (!cancelled) {
          setReplacements(res.data);
        }
      } catch (err: any) {
        if (!cancelled) setError('Erreur lors du chargement des remplaçants');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedBookingId]);

  const selectedBooking = selectedBookingId ? bookings.find(b => b.id === selectedBookingId) : null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Visualisation des Remplaçants</h1>
          <Link
            to="/"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Retour au Plan
          </Link>
        </div>

        <div className="mb-6 max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filtrer par Booking
          </label>
          <select
            value={selectedBookingId}
            onChange={(e) => setSelectedBookingId(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="">— Sélectionner un booking —</option>
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} — {formatLocalDate(b.effectiveDate, 'fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-md border border-red-100">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">
              Remplaçants pour le booking « {selectedBooking?.name} » (début : {formatLocalDate(selectedBooking?.effectiveDate)})
            </span>
          </div>
          {replacements.length === 0 ? (
            <div className="p-8 text-center text-gray-500 italic">
              {loading ? 'Chargement…' : 'Aucun remplaçant défini pour ce booking.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left">Poste</th>
                    <th className="px-4 py-2 text-center bg-blue-50/50">R1 (Jour)</th>
                    <th className="px-4 py-2 text-center bg-blue-50/50">R2 (Jour)</th>
                    <th className="px-4 py-2 text-center bg-blue-50/50">R3 (Jour)</th>
                    <th className="px-4 py-2 text-center bg-blue-50/50">R4 (Jour)</th>
                    <th className="px-4 py-2 text-center bg-amber-50/50">R5 (Soir)</th>
                    <th className="px-4 py-2 text-center bg-amber-50/50">R6 (Soir)</th>
                    <th className="px-4 py-2 text-center bg-amber-50/50">R7 (Soir)</th>
                    <th className="px-4 py-2 text-center bg-amber-50/50">R8 (Soir)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {replacements.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 border-r">{r.post?.name ?? r.postId}</td>
                      <ReplacementCell worker={r.replacement1Worker} className="bg-blue-50/10" />
                      <ReplacementCell worker={r.replacement2Worker} className="bg-blue-50/10" />
                      <ReplacementCell worker={r.replacement3Worker} className="bg-blue-50/10" />
                      <ReplacementCell worker={r.replacement4Worker} className="bg-blue-50/10" />
                      <ReplacementCell worker={r.replacement5Worker} className="bg-amber-50/10" />
                      <ReplacementCell worker={r.replacement6Worker} className="bg-amber-50/10" />
                      <ReplacementCell worker={r.replacement7Worker} className="bg-amber-50/10" />
                      <ReplacementCell worker={r.replacement8Worker} className="bg-amber-50/10" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReplacementCell({ worker, className = '' }: { worker: any; className?: string }) {
  if (!worker) return <td className={`px-2 py-3 text-[10px] text-gray-300 text-center italic ${className}`}>— Vide —</td>;
  return (
    <td className={`px-2 py-3 border-r last:border-0 ${className}`}>
      <div className="text-[11px] font-bold text-gray-900 text-center">({worker.anciennete})</div>
      <div className="text-[10px] text-gray-600 text-center truncate" title={worker.name}>{worker.name}</div>
    </td>
  );
}
