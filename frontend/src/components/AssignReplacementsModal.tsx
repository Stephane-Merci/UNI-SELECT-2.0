import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { Booking, BookingReplacement, Worker, Post, WorkerType, WorkerTypeLabels, WORKER_TYPES_JOUR, WORKER_TYPES_SOIR, WorkerTypeColors } from '../types';
import { formatLocalDate } from '../utils/dateUtils';

interface AssignReplacementsModalProps {
  booking: Booking;
  workers: Worker[];
  posts: Post[];
  onClose: () => void;
  onSaved?: () => void;
}

interface ReplacementRow {
  postId: string;
  postName: string;
  replacement1WorkerId: string | null;
  replacement2WorkerId: string | null;
  replacement3WorkerId: string | null;
  replacement4WorkerId: string | null;
  replacement5WorkerId: string | null;
  replacement6WorkerId: string | null;
  replacement7WorkerId: string | null;
  replacement8WorkerId: string | null;
}

export default function AssignReplacementsModal({
  booking,
  workers,
  posts,
  onClose,
  onSaved,
}: AssignReplacementsModalProps) {
  const [rows, setRows] = useState<ReplacementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [addPostId, setAddPostId] = useState('');

  // Get weekday of booking to check pre-retraite
  const bookingDay = formatLocalDate(booking.effectiveDate, 'en-US', { weekday: 'long' }).toUpperCase();

  // Post IDs that have at least one assignment in this booking (posts "in" the booking)
  const postIdsInBooking = Array.from(
    new Set(booking.assignments?.map((a) => a.postId) ?? [])
  );
  const postIdToName = (postId: string) =>
    posts.find((p) => p.id === postId)?.name ?? booking.assignments?.find((a) => a.postId === postId)?.post?.name ?? postId;

  // For a given postId, worker IDs assigned to that post in the booking (these must be excluded from replacement dropdowns)
  const getAssignedWorkerIdsForPost = (postId: string) =>
    (booking.assignments ?? []).filter((a) => a.postId === postId).map((a) => a.workerId);

  // Workers already assigned as replacements in ANY other row or slot in this modal
  const getAllAssignedReplacementIds = () => {
    const ids: string[] = [];
    rows.forEach(r => {
      [1, 2, 3, 4, 5, 6, 7, 8].forEach(slot => {
        const id = r[`replacement${slot}WorkerId` as keyof ReplacementRow];
        if (id && typeof id === 'string') ids.push(id);
      });
    });
    return ids;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiClient.get<BookingReplacement[]>(`/bookings/${booking.id}/replacements`);
        const list = res.data ?? [];
        setRows(
          list.map((r) => ({
            postId: r.postId,
            postName: r.post?.name ?? postIdToName(r.postId),
            replacement1WorkerId: r.replacement1WorkerId ?? null,
            replacement2WorkerId: r.replacement2WorkerId ?? null,
            replacement3WorkerId: r.replacement3WorkerId ?? null,
            replacement4WorkerId: r.replacement4WorkerId ?? null,
            replacement5WorkerId: r.replacement5WorkerId ?? null,
            replacement6WorkerId: r.replacement6WorkerId ?? null,
            replacement7WorkerId: r.replacement7WorkerId ?? null,
            replacement8WorkerId: r.replacement8WorkerId ?? null,
          }))
        );
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || e?.message || 'Erreur chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [booking.id]);

  const addPost = () => {
    if (!addPostId) return;
    const name = postIdToName(addPostId);
    if (rows.some((r) => r.postId === addPostId)) return;
    setRows((prev) => [...prev, {
      postId: addPostId,
      postName: name,
      replacement1WorkerId: null,
      replacement2WorkerId: null,
      replacement3WorkerId: null,
      replacement4WorkerId: null,
      replacement5WorkerId: null,
      replacement6WorkerId: null,
      replacement7WorkerId: null,
      replacement8WorkerId: null
    }]);
    setAddPostId('');
  };

  const removeRow = (postId: string) => {
    setRows((prev) => prev.filter((r) => r.postId !== postId));
  };

  const setReplacement = (postId: string, slot: number, workerId: string | null) => {
    const key = `replacement${slot}WorkerId` as keyof ReplacementRow;
    setRows((prev) =>
      prev.map((r) => (r.postId === postId ? { ...r, [key]: workerId } : r))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await apiClient.put(`/bookings/${booking.id}/replacements`, {
        replacements: rows.map((r) => ({
          postId: r.postId,
          replacement1WorkerId: r.replacement1WorkerId,
          replacement2WorkerId: r.replacement2WorkerId,
          replacement3WorkerId: r.replacement3WorkerId,
          replacement4WorkerId: r.replacement4WorkerId,
          replacement5WorkerId: r.replacement5WorkerId,
          replacement6WorkerId: r.replacement6WorkerId,
          replacement7WorkerId: r.replacement7WorkerId,
          replacement8WorkerId: r.replacement8WorkerId,
        })),
      });
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const postIdsAlreadyAdded = new Set(rows.map((r) => r.postId));
  const postsAvailableToAdd = postIdsInBooking.filter((id) => !postIdsAlreadyAdded.has(id));
  const allReplacementIds = getAllAssignedReplacementIds();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Assigner des remplaçants</h3>
          <p className="text-sm text-gray-600 mt-1">
            Booking : {booking.name}. Choisissez jusqu&apos;à 4 remplaçants par quart (Jour : 1-4, Soir : 5-8).
            <br />
            <span className="text-xs font-medium text-amber-600">⚠️ Attention : Un travailleur déjà assigné ailleurs sera grisé. Les travailleurs en pré-retraite ce jour-là sont signalés.</span>
          </p>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-10">Chargement…</p>
          ) : (
            <>
              {error && (
                <div className="mb-3 p-2 rounded bg-red-50 text-red-800 text-sm border border-red-100">{error}</div>
              )}

              {rows.length > 0 && (
                <div className="space-y-4 mb-6">
                  {rows.map((row) => {
                    const excludedIds = getAssignedWorkerIdsForPost(row.postId);
                    const options = workers.filter((w) => !excludedIds.includes(w.id));
                    const jourOptions = options.filter(w => WORKER_TYPES_JOUR.includes(w.type));
                    const soirOptions = options.filter(w => WORKER_TYPES_SOIR.includes(w.type));
                    return (
                      <div
                        key={row.postId}
                        className="p-4 border border-gray-200 rounded-xl bg-gray-50/50 shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-bold text-gray-900 text-base">{row.postName}</span>
                          <button
                            type="button"
                            onClick={() => removeRow(row.postId)}
                            className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
                          >
                            Retirer ce poste
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Jour Section */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Quart de Jour</h4>
                            <div className="grid grid-cols-2 gap-3">
                              {[1, 2, 3, 4].map((slot) => {
                                const currentVal = row[`replacement${slot}WorkerId` as keyof ReplacementRow] ?? '';
                                return (
                                  <div key={slot} className="relative">
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">Remplaçant {slot}</label>
                                    <div className="relative">
                                      <select
                                        value={currentVal as string}
                                        onChange={(e) => setReplacement(row.postId, slot, e.target.value || null)}
                                        className={`w-full text-sm border rounded-lg px-2 py-2 appearance-none transition-all focus:ring-2 focus:ring-blue-500 outline-none ${currentVal ? 'border-blue-300 bg-blue-50/50' : 'border-gray-300 bg-white'
                                          }`}
                                      >
                                        <option value="">— Vide —</option>
                                        {jourOptions.map((w) => {
                                          const isAlreadyRemplacent = allReplacementIds.includes(w.id) && currentVal !== w.id;
                                          const isPreRetraite = w.preRetraiteDay === bookingDay;
                                          return (
                                            <option key={w.id} value={w.id} disabled={isAlreadyRemplacent} className={isAlreadyRemplacent ? 'text-gray-300' : ''}>
                                              {isAlreadyRemplacent ? '🚫 ' : ''}
                                              {isPreRetraite ? '⚠️ ' : ''}
                                              ({w.anciennete}) {w.name} {isAlreadyRemplacent ? '(Assigné ailleurs)' : isPreRetraite ? '(Pré-retraite)' : ''}
                                            </option>
                                          );
                                        })}
                                      </select>
                                      {currentVal && workers.find(w => w.id === currentVal)?.preRetraiteDay === bookingDay && (
                                        <div className="absolute right-8 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" title="Attention: Travailleur en pré-retraite ce jour-là">
                                          ⚠️
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Soir Section */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider">Quart de Soir</h4>
                            <div className="grid grid-cols-2 gap-3">
                              {[5, 6, 7, 8].map((slot) => {
                                const currentVal = row[`replacement${slot}WorkerId` as keyof ReplacementRow] ?? '';
                                return (
                                  <div key={slot} className="relative">
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">Remplaçant {slot - 4}</label>
                                    <div className="relative">
                                      <select
                                        value={currentVal as string}
                                        onChange={(e) => setReplacement(row.postId, slot, e.target.value || null)}
                                        className={`w-full text-sm border rounded-lg px-2 py-2 appearance-none transition-all focus:ring-2 focus:ring-amber-500 outline-none ${currentVal ? 'border-amber-300 bg-amber-50/50' : 'border-gray-300 bg-white'
                                          }`}
                                      >
                                        <option value="">— Vide —</option>
                                        {soirOptions.map((w) => {
                                          const isAlreadyRemplacent = allReplacementIds.includes(w.id) && currentVal !== w.id;
                                          const isPreRetraite = w.preRetraiteDay === bookingDay;
                                          return (
                                            <option key={w.id} value={w.id} disabled={isAlreadyRemplacent} className={isAlreadyRemplacent ? 'text-gray-300' : ''}>
                                              {isAlreadyRemplacent ? '🚫 ' : ''}
                                              {isPreRetraite ? '⚠️ ' : ''}
                                              ({w.anciennete}) {w.name} {isAlreadyRemplacent ? '(Assigné ailleurs)' : isPreRetraite ? '(Pré-retraite)' : ''}
                                            </option>
                                          );
                                        })}
                                      </select>
                                      {currentVal && workers.find(w => w.id === currentVal)?.preRetraiteDay === bookingDay && (
                                        <div className="absolute right-8 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" title="Attention: Travailleur en pré-retraite ce jour-là">
                                          ⚠️
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {postsAvailableToAdd.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <select
                    value={addPostId}
                    onChange={(e) => setAddPostId(e.target.value)}
                    className="flex-1 min-w-[200px] text-sm border border-indigo-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Ajouter un poste à remplacer…</option>
                    {postsAvailableToAdd.map((postId) => (
                      <option key={postId} value={postId}>
                        {postIdToName(postId)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addPost}
                    disabled={!addPostId}
                    className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none"
                  >
                    Ajouter le poste
                  </button>
                </div>
              )}
              {postIdsInBooking.length === 0 && (
                <div className="py-12 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
                  <p className="text-sm">Ce booking n&apos;a aucun poste assigné.</p>
                </div>
              )}
            </>
          )}
        </div>
        <div className="p-6 border-t bg-gray-50 rounded-b-lg flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition-all font-medium"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all font-bold shadow-xl shadow-indigo-100"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Enregistrement…
              </span>
            ) : 'Enregistrer les remplaçants'}
          </button>
        </div>
      </div>
    </div>
  );
}
