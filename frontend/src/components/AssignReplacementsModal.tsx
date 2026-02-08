import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { Booking, Worker, BookingReplacement, Post } from '../types';

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

  // Post IDs that have at least one assignment in this booking (posts "in" the booking)
  const postIdsInBooking = Array.from(
    new Set(booking.assignments?.map((a) => a.postId) ?? [])
  );
  const postIdToName = (postId: string) =>
    posts.find((p) => p.id === postId)?.name ?? booking.assignments?.find((a) => a.postId === postId)?.post?.name ?? postId;

  // For a given postId, worker IDs assigned to that post in the booking (these must be excluded from replacement dropdowns)
  const getAssignedWorkerIdsForPost = (postId: string) =>
    (booking.assignments ?? []).filter((a) => a.postId === postId).map((a) => a.workerId);

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
    setRows((prev) => [...prev, { postId: addPostId, postName: name, replacement1WorkerId: null, replacement2WorkerId: null, replacement3WorkerId: null }]);
    setAddPostId('');
  };

  const removeRow = (postId: string) => {
    setRows((prev) => prev.filter((r) => r.postId !== postId));
  };

  const setReplacement = (postId: string, slot: 1 | 2 | 3, workerId: string | null) => {
    const key = slot === 1 ? 'replacement1WorkerId' : slot === 2 ? 'replacement2WorkerId' : 'replacement3WorkerId';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Assigner des remplaçants</h3>
          <p className="text-sm text-gray-600 mt-1">
            Booking : {booking.name}. Pour chaque poste dont les titulaires sont absents, choisissez jusqu&apos;à 3 remplaçants (les personnes assignées à ce poste dans le booking ne sont pas proposées).
          </p>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : (
            <>
              {error && (
                <div className="mb-3 p-2 rounded bg-red-50 text-red-800 text-sm">{error}</div>
              )}

              {rows.length > 0 && (
                <div className="space-y-3 mb-4">
                  {rows.map((row) => {
                    const excludedIds = getAssignedWorkerIdsForPost(row.postId);
                    const options = workers.filter((w) => !excludedIds.includes(w.id));
                    return (
                      <div
                        key={row.postId}
                        className="p-3 border border-gray-200 rounded-lg bg-gray-50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-800">{row.postName}</span>
                          <button
                            type="button"
                            onClick={() => removeRow(row.postId)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Retirer
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {([1, 2, 3] as const).map((slot) => (
                            <div key={slot}>
                              <label className="block text-xs text-gray-600 mb-0.5">Remplaçant {slot}</label>
                              <select
                                value={row[`replacement${slot}WorkerId` as keyof ReplacementRow] ?? ''}
                                onChange={(e) =>
                                  setReplacement(row.postId, slot, e.target.value || null)
                                }
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                              >
                                <option value="">—</option>
                                {options.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    ({w.anciennete}) {w.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {postsAvailableToAdd.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={addPostId}
                    onChange={(e) => setAddPostId(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1.5"
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
                    className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    Ajouter
                  </button>
                </div>
              )}
              {postIdsInBooking.length === 0 && (
                <p className="text-sm text-gray-500">Ce booking n&apos;a aucun poste assigné.</p>
              )}
            </>
          )}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
