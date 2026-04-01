import { useEffect, useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { useAutoScrollDuringDrag } from '../hooks/useAutoScrollDuringDrag';
import { Worker, Post, Booking, WorkerType, WorkerTypeColors, BookingReplacement, WORKER_TYPES_JOUR, WORKER_TYPES_SOIR } from '../types';
import { formatLocalDate } from '../utils/dateUtils';
import PostColumn, { POST_COLUMN_DRAG_PREFIX } from '../components/PostColumn';
import WorkerCard, { POST_DRAG_PREFIX, POST_DRAG_SEP } from '../components/WorkerCard';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import apiClient from '../api/client';

type ReplacementSlot = {
  r1: string | null; r2: string | null; r3: string | null; r4: string | null;
  r5: string | null; r6: string | null; r7: string | null; r8: string | null;
};
const REPLACEMENT_LABELS: [keyof ReplacementSlot, string][] = [
  ['r1', 'Remplaçant Jour 1'],
  ['r2', 'Remplaçant Jour 2'],
  ['r3', 'Remplaçant Jour 3'],
  ['r4', 'Remplaçant Jour 4'],
  ['r5', 'Remplaçant Soir 1'],
  ['r6', 'Remplaçant Soir 2'],
  ['r7', 'Remplaçant Soir 3'],
  ['r8', 'Remplaçant Soir 4'],
];

const UNASSIGNED_ZONE = 'unassigned';

// Booking: zones = posts (zone originel). Workers shown by current zone (originalPost or local meeting state).
function UnassignedColumn({ workers, postId }: { workers: Worker[]; postId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_ZONE });
  const workersJour = workers.filter((w) => WORKER_TYPES_JOUR.includes(w.type as WorkerType));
  const workersSoir = workers.filter((w) => WORKER_TYPES_SOIR.includes(w.type as WorkerType));
  const workersOther = workers.filter(
    (w) => !WORKER_TYPES_JOUR.includes(w.type as WorkerType) && !WORKER_TYPES_SOIR.includes(w.type as WorkerType)
  );
  const sortByName = (a: Worker, b: Worker) => a.name.localeCompare(b.name, 'fr');
  const renderBlock = (label: string, list: Worker[]) =>
    list.length === 0 ? null : (
      <div className="mb-2 last:mb-0">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</div>
        <div className="space-y-0.5">
          {list.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              dragId={postId ? `${POST_DRAG_PREFIX}${postId}${POST_DRAG_SEP}${worker.id}` : undefined}
            />
          ))}
        </div>
      </div>
    );

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-[140px] max-h-[250px] bg-gray-100 rounded-lg p-2 border-2 ${isOver ? 'border-blue-500 bg-blue-100' : 'border-gray-200'
        }`}
    >
      <h2 className="font-semibold text-sm mb-2 text-gray-700 shrink-0">Non assignés</h2>
      <SortableContext
        items={workers.map((w) => (postId ? `${POST_DRAG_PREFIX}${postId}${POST_DRAG_SEP}${w.id}` : w.id))}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {renderBlock('Jour', [...workersJour].sort(sortByName))}
          {workersJour.length > 0 && workersSoir.length > 0 && (
            <div className="border-t border-gray-300 my-1.5" aria-hidden />
          )}
          {renderBlock('Soir', [...workersSoir].sort(sortByName))}
          {workersOther.length > 0 && (
            <>
              {(workersJour.length > 0 || workersSoir.length > 0) && (
                <div className="border-t border-gray-300 my-1.5" aria-hidden />
              )}
              {renderBlock('Autres', [...workersOther].sort(sortByName))}
            </>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Sortable post column for Booking page: reorder posts, lock, drop indicator
function SortablePostColumnBooking({
  post,
  workers,
  isLocked,
  onLockToggle,
  onReplacementClick,
}: {
  post: Post;
  workers: Worker[];
  isLocked: boolean;
  onLockToggle: () => void;
  onReplacementClick?: () => void;
}) {
  const sortableId = `${POST_COLUMN_DRAG_PREFIX}${post.id}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: sortableId,
    disabled: isLocked,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const wrapperClass = isLocked ? 'w-[130px] flex-shrink-0' : 'min-w-[130px] flex-1 basis-[130px]';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${wrapperClass} ${isDragging ? 'opacity-50 z-10' : ''} ${isOver ? 'ring-2 ring-blue-500 ring-offset-2 rounded-lg bg-blue-50/80' : ''
        }`}
    >
      {isOver && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center rounded-lg border-2 border-dashed border-blue-500 bg-blue-100/50 z-[1]" aria-hidden>
          <span className="text-xs font-semibold text-blue-700 bg-white/90 px-2 py-1 rounded shadow-sm">Déposer ici</span>
        </div>
      )}
      <PostColumn
        post={post}
        workers={workers}
        onReplacementClick={onReplacementClick}
        isLocked={isLocked}
        onLockToggle={onLockToggle}
        wrapperClassName={wrapperClass}
        dragHandleProps={isLocked ? undefined : { attributes: attributes as unknown as Record<string, unknown>, listeners: listeners as unknown as Record<string, unknown> }}
      />
    </div>
  );
}

export default function WorkAllocation() {
  const {
    workers,
    posts,
    fetchWorkers,
    fetchPosts,
    updateWorkerOriginalPost,
    getPlanPostOrder,
    setPlanPostOrder,
    getPlanLockedPosts,
    togglePlanPostLock,
    planLayoutVersion,
    isFullScreen,
    setFullScreen,
  } = useStore();

  const { user } = useAuthStore();

  const BOOKING_LAYOUT_KEY = 'work-allocation';
  const orderedPosts =
    posts.length > 0
      ? getPlanPostOrder(BOOKING_LAYOUT_KEY, posts.map((p) => p.id))
        .map((id) => posts.find((p) => p.id === id))
        .filter((p): p is Post => !!p)
      : posts;
  const lockedPostIds = getPlanLockedPosts(BOOKING_LAYOUT_KEY);
  void planLayoutVersion[BOOKING_LAYOUT_KEY];
  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  // When non-null, we're in "booking meeting" mode: all changes are local until Save.
  const [localZoneMap, setLocalZoneMap] = useState<Record<string, string> | null>(null);
  // Undo: in meeting mode = stack of previous localZoneMap snapshots; outside = last move only.
  const [zoneMapHistory, setZoneMapHistory] = useState<Record<string, string>[]>([]);
  const [lastMove, setLastMove] = useState<{ workerId: string; previousPostId: string } | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showSaveBookingModal, setShowSaveBookingModal] = useState(false);
  const [saveBookingName, setSaveBookingName] = useState('');
  const [saveBookingEffectiveDate, setSaveBookingEffectiveDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [bookingError, setBookingError] = useState('');
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [replacementPostId, setReplacementPostId] = useState<string | null>(null);
  const [replacementByPostId, setReplacementByPostId] = useState<Record<string, ReplacementSlot>>({});
  const [replacementSaveError, setReplacementSaveError] = useState('');
  const [replacementSaving, setReplacementSaving] = useState(false);
  const [applyBookingConfirm, setApplyBookingConfirm] = useState<{
    bookingId: string;
    newName: string;
    currentActiveName: string | null;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const { wrapDragStart, wrapDragEnd } = useAutoScrollDuringDrag();

  useEffect(() => {
    fetchWorkers();
    fetchPosts();
  }, [fetchWorkers, fetchPosts]);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await apiClient.get<Booking[]>('/bookings');
      const data = res.data || [];
      setBookings(data);
      const active = data.find(b => b.isActive);
      if (active) setActiveBookingId(active.id);
    } catch {
      setBookings([]);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (!selectedBookingId) {
      setReplacementByPostId({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<BookingReplacement[]>(`/bookings/${selectedBookingId}/replacements`);
        const list = res.data ?? [];
        const byPost: Record<string, ReplacementSlot> = {};
        list.forEach((r) => {
          byPost[r.postId] = {
            r1: r.replacement1WorkerId ?? null,
            r2: r.replacement2WorkerId ?? null,
            r3: r.replacement3WorkerId ?? null,
            r4: r.replacement4WorkerId ?? null,
            r5: r.replacement5WorkerId ?? null,
            r6: r.replacement6WorkerId ?? null,
            r7: r.replacement7WorkerId ?? null,
            r8: r.replacement8WorkerId ?? null,
          };
        });
        if (!cancelled) setReplacementByPostId(byPost);
      } catch {
        if (!cancelled) setReplacementByPostId({});
      }
    })();
    return () => { cancelled = true; };
  }, [selectedBookingId]);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    const socket = io(socketUrl);
    socket.on('connect', () => socket.emit('join-room', 'main'));
    socket.on('worker-original-post-updated', () => fetchWorkers());
    socket.on('post-deleted', () => fetchPosts());
    socket.on('post-updated', () => fetchPosts());
    return () => { socket.disconnect(); };
  }, [fetchWorkers, fetchPosts]);

  const currentZone = useCallback(
    (w: Worker): string => {
      if (!localZoneMap) return w.originalPostId;
      return localZoneMap[w.id] ?? UNASSIGNED_ZONE;
    },
    [localZoneMap]
  );

  const getWorkersForPost = useCallback(
    (postId: string) =>
      workers
        .filter((w) => currentZone(w) === postId)
        .sort((a, b) => a.anciennete.localeCompare(b.anciennete, 'fr', { numeric: true })),
    [workers, currentZone]
  );

  const getUnassignedWorkers = useCallback(
    () => workers.filter((w) => currentZone(w) === UNASSIGNED_ZONE),
    [workers, currentZone]
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (!user?.canEdit) return;
    const activeId = String(event.active.id);
    let workerId = activeId;
    if (activeId.includes(POST_DRAG_SEP)) workerId = activeId.split(POST_DRAG_SEP)[1] ?? activeId;
    const worker = workers.find((w) => w.id === workerId) ?? null;
    setActiveWorker(worker);
  };

  const MAX_UNDO_HISTORY = 50;

  const pushZoneMapToHistory = useCallback(() => {
    if (!localZoneMap) return;
    setZoneMapHistory((prev) => {
      const next = [...prev, { ...localZoneMap }];
      return next.length > MAX_UNDO_HISTORY ? next.slice(-MAX_UNDO_HISTORY) : next;
    });
  }, [localZoneMap]);

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!user?.canEdit) return;
    const { active, over } = event;
    setActiveWorker(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Post column reorder (booking layout)
    if (activeId.startsWith(POST_COLUMN_DRAG_PREFIX)) {
      if (overId.startsWith(POST_COLUMN_DRAG_PREFIX)) {
        const fromPostId = activeId.slice(POST_COLUMN_DRAG_PREFIX.length);
        const toPostId = overId.slice(POST_COLUMN_DRAG_PREFIX.length);
        if (fromPostId !== toPostId) {
          const currentOrder = getPlanPostOrder(BOOKING_LAYOUT_KEY, posts.map((p) => p.id));
          const fromIndex = currentOrder.indexOf(fromPostId);
          const toIndex = currentOrder.indexOf(toPostId);
          if (fromIndex !== -1 && toIndex !== -1) {
            const next = [...currentOrder];
            next.splice(fromIndex, 1);
            next.splice(toIndex, 0, fromPostId);
            setPlanPostOrder(BOOKING_LAYOUT_KEY, next);
          }
        }
      }
      return;
    }

    let workerId = activeId;
    if (workerId.includes(POST_DRAG_SEP)) workerId = workerId.split(POST_DRAG_SEP)[1] ?? workerId;
    const worker = workers.find((x) => x.id === workerId);
    const previousPostId = worker?.originalPostId ?? UNASSIGNED_ZONE;

    if (overId === UNASSIGNED_ZONE) {
      if (localZoneMap) {
        pushZoneMapToHistory();
        setLocalZoneMap((m) => ({ ...m!, [workerId]: UNASSIGNED_ZONE }));
      }
      return;
    }

    // Resolve post (overId can be post.id or post-column-{post.id} with pointerWithin)
    const postIdForDrop = overId.startsWith(POST_COLUMN_DRAG_PREFIX) ? overId.slice(POST_COLUMN_DRAG_PREFIX.length) : overId;
    const post = posts.find((p) => p.id === postIdForDrop);
    if (post) {
      if (localZoneMap) {
        pushZoneMapToHistory();
        setLocalZoneMap((m) => ({ ...m!, [workerId]: post.id }));
      } else {
        if (worker && worker.originalPostId !== post.id) {
          void updateWorkerOriginalPost(workerId, post.id);
          setLastMove({ workerId, previousPostId });
        }
      }
      return;
    }

    let targetWorkerId = overId;
    if (overId.includes(POST_DRAG_SEP)) targetWorkerId = overId.split(POST_DRAG_SEP)[1] ?? overId;
    const targetWorker = workers.find((w) => w.id === targetWorkerId);
    if (targetWorker) {
      const targetZone = currentZone(targetWorker);
      if (targetZone === UNASSIGNED_ZONE) {
        if (localZoneMap) {
          pushZoneMapToHistory();
          setLocalZoneMap((m) => ({ ...m!, [workerId]: UNASSIGNED_ZONE }));
        }
      } else {
        if (localZoneMap) {
          pushZoneMapToHistory();
          setLocalZoneMap((m) => ({ ...m!, [workerId]: targetZone }));
        } else if (worker && worker.originalPostId !== targetZone) {
          await updateWorkerOriginalPost(workerId, targetZone);
          setLastMove({ workerId, previousPostId });
        }
      }
    }
  };

  const handleStart = () => {
    setZoneMapHistory([]);
    setLocalZoneMap(Object.fromEntries(workers.map((w) => [w.id, UNASSIGNED_ZONE])));
    setActiveBookingId(null);
    setEditingBookingId(null);
  };

  // Load a saved booking into the grid to continue editing (assignments → posts; everyone else → non assignés)
  const handleContinueBooking = async (booking: Booking) => {
    const assignmentMap: Record<string, string> = {};
    (booking.assignments ?? []).forEach((a) => {
      assignmentMap[a.workerId] = a.postId;
    });
    const zoneMap: Record<string, string> = {};
    workers.forEach((w) => {
      zoneMap[w.id] = assignmentMap[w.id] ?? UNASSIGNED_ZONE;
    });
    setSelectedBookingId(booking.id);
    setEditingBookingId(booking.id);
    setLocalZoneMap(zoneMap);
    setZoneMapHistory([]);
    setReplacementPostId(null);
  };

  // Save current arrangement as a new booking or update existing (does not change workers)
  const handleSaveAsBooking = async () => {
    if (!localZoneMap) return;
    const name = saveBookingName.trim();
    if (!name) {
      setBookingError('Veuillez saisir un nom pour le booking.');
      return;
    }
    setBookingError('');
    const assignments = workers
      .filter((w) => {
        const z = localZoneMap[w.id] ?? UNASSIGNED_ZONE;
        return z !== UNASSIGNED_ZONE;
      })
      .map((w) => ({ workerId: w.id, postId: localZoneMap![w.id]! }));
    try {
      if (editingBookingId) {
        await apiClient.put(`/bookings/${editingBookingId}`, {
          name,
          effectiveDate: saveBookingEffectiveDate,
          assignments,
        });
        const replacements = Object.entries(replacementByPostId).map(([postId, slot]) => ({
          postId,
          replacement1WorkerId: slot.r1 || null,
          replacement2WorkerId: slot.r2 || null,
          replacement3WorkerId: slot.r3 || null,
          replacement4WorkerId: slot.r4 || null,
          replacement5WorkerId: slot.r5 || null,
          replacement6WorkerId: slot.r6 || null,
          replacement7WorkerId: slot.r7 || null,
          replacement8WorkerId: slot.r8 || null,
        }));
        await apiClient.put(`/bookings/${editingBookingId}/replacements`, { replacements });
        setEditingBookingId(null);
      } else {
        const res = await apiClient.post<Booking>('/bookings', {
          name,
          effectiveDate: saveBookingEffectiveDate,
          assignments,
        });
        const newBookingId = res.data?.id;
        if (newBookingId && Object.keys(replacementByPostId).length > 0) {
          const replacements = Object.entries(replacementByPostId).map(([postId, slot]) => ({
            postId,
            replacement1WorkerId: slot.r1 || null,
            replacement2WorkerId: slot.r2 || null,
            replacement3WorkerId: slot.r3 || null,
            replacement4WorkerId: slot.r4 || null,
            replacement5WorkerId: slot.r5 || null,
            replacement6WorkerId: slot.r6 || null,
            replacement7WorkerId: slot.r7 || null,
            replacement8WorkerId: slot.r8 || null,
          }));
          await apiClient.put(`/bookings/${newBookingId}/replacements`, { replacements });
        }
      }
      await fetchBookings();
      setShowSaveBookingModal(false);
      setSaveBookingName('');
      setLocalZoneMap(null);
      setZoneMapHistory([]);
      setReplacementPostId(null);
    } catch (err: any) {
      setBookingError(err?.response?.data?.error || err?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const saveReplacementsForSelectedBooking = useCallback(async () => {
    if (!selectedBookingId) return;
    setReplacementSaveError('');
    setReplacementSaving(true);
    try {
      const replacements = Object.entries(replacementByPostId).map(([postId, slot]) => ({
        postId,
        replacement1WorkerId: slot.r1 || null,
        replacement2WorkerId: slot.r2 || null,
        replacement3WorkerId: slot.r3 || null,
        replacement4WorkerId: slot.r4 || null,
        replacement5WorkerId: slot.r5 || null,
        replacement6WorkerId: slot.r6 || null,
        replacement7WorkerId: slot.r7 || null,
        replacement8WorkerId: slot.r8 || null,
      }));
      await apiClient.put(`/bookings/${selectedBookingId}/replacements`, { replacements });
      await fetchBookings();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Erreur lors de l\'enregistrement des remplaçants';
      setReplacementSaveError(Array.isArray(msg) ? JSON.stringify(msg) : String(msg));
    } finally {
      setReplacementSaving(false);
    }
  }, [selectedBookingId, replacementByPostId]);

  const handleActivateBooking = async (bookingId: string) => {
    setApplyBookingConfirm(null);
    setActivatingId(bookingId);
    setSelectedBookingId(bookingId);
    try {
      await apiClient.post(`/bookings/${bookingId}/activate`);
      await fetchWorkers();
      await fetchBookings();
      setActiveBookingId(bookingId);
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Erreur lors de l\'activation');
    } finally {
      setActivatingId(null);
    }
  };

  const openApplyBookingConfirm = (b: Booking) => {
    const currentActive = activeBookingId ? bookings.find((x) => x.id === activeBookingId) : null;
    setApplyBookingConfirm({
      bookingId: b.id,
      newName: b.name,
      currentActiveName: currentActive?.name ?? null,
    });
  };

  const handleDeleteBooking = async (bookingId: string, bookingName: string) => {
    if (!confirm(`Supprimer le booking « ${bookingName} » ?`)) return;
    setDeletingId(bookingId);
    if (selectedBookingId === bookingId) setSelectedBookingId(null);
    if (activeBookingId === bookingId) setActiveBookingId(null);
    if (editingBookingId === bookingId) setEditingBookingId(null);
    try {
      await apiClient.delete(`/bookings/${bookingId}`);
      await fetchBookings();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancel = () => {
    setLocalZoneMap(null);
    setZoneMapHistory([]);
    setEditingBookingId(null);
  };

  const handleUndo = async () => {
    if (localZoneMap && zoneMapHistory.length > 0) {
      const previous = zoneMapHistory[zoneMapHistory.length - 1];
      setZoneMapHistory((prev) => prev.slice(0, -1));
      setLocalZoneMap(previous);
      return;
    }
    if (!localZoneMap && lastMove) {
      await updateWorkerOriginalPost(lastMove.workerId, lastMove.previousPostId);
      await fetchWorkers();
      setLastMove(null);
    }
  };

  const canUndo = (localZoneMap !== null && zoneMapHistory.length > 0) || (!localZoneMap && lastMove !== null);

  const inMeeting = localZoneMap !== null;

  const handlePrintBooking = () => {
    const zoneCards: string[] = [];

    // Only post zones (non-assignés excluded from print); use ordered posts to match UI
    const postsToPrint = orderedPosts.length > 0 ? orderedPosts : posts;
    for (const post of postsToPrint) {
      const postWorkers = getWorkersForPost(post.id);
      const card = `
      <div class="zone-card">
        <div class="zone-title">${post.name}</div>
        ${post.description ? `<div class="zone-desc">${post.description}</div>` : ''}
        <div class="zone-workers">
          ${postWorkers.length > 0
          ? postWorkers
            .map(
              (w) => {
                const color = (WorkerTypeColors as Record<string, string>)[w.type] || '#e5e7eb';
                const originalName = w.originalPost?.name ?? '-';
                return `<div class="worker-card" style="background-color:${color}20;border-left:3px solid ${color};">
                      <div class="worker-name">(${w.anciennete}) ${w.name}</div>
                      <div class="worker-meta">${originalName}</div>
                    </div>`;
              }
            )
            .join('')
          : '<span class="text-gray-400 italic">Vide</span>'}
        </div>
      </div>`;
      zoneCards.push(card);
    }

    const title = 'Booking – Répartition par zone';
    const selectedBooking = selectedBookingId ? bookings.find((x) => x.id === selectedBookingId) : null;
    const effectiveDateStr = selectedBooking
      ? formatLocalDate(selectedBooking.effectiveDate, 'fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : formatLocalDate(new Date(), 'fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const replacementEntries = Object.entries(replacementByPostId).filter(
      ([, slot]) => slot.r1 || slot.r2 || slot.r3 || slot.r4 || slot.r5 || slot.r6 || slot.r7 || slot.r8
    );
    const replacementRows = replacementEntries
      .map(([postId, slot]) => {
        const post = posts.find((p) => p.id === postId);
        const w1 = slot.r1 ? workers.find((w) => w.id === slot.r1) : null;
        const w2 = slot.r2 ? workers.find((w) => w.id === slot.r2) : null;
        const w3 = slot.r3 ? workers.find((w) => w.id === slot.r3) : null;
        const w4 = slot.r4 ? workers.find((w) => w.id === slot.r4) : null;
        const w5 = slot.r5 ? workers.find((w) => w.id === slot.r5) : null;
        const w6 = slot.r6 ? workers.find((w) => w.id === slot.r6) : null;
        const w7 = slot.r7 ? workers.find((w) => w.id === slot.r7) : null;
        const w8 = slot.r8 ? workers.find((w) => w.id === slot.r8) : null;

        const fmt = (w: { anciennete: string; name: string } | null | undefined) => (w ? `(${w.anciennete}) ${w.name}` : '—');
        return `<tr><td class="print-repl-post">${post?.name ?? postId}</td><td>${fmt(w1)}</td><td>${fmt(w2)}</td><td>${fmt(w3)}</td><td>${fmt(w4)}</td><td>${fmt(w5)}</td><td>${fmt(w6)}</td><td>${fmt(w7)}</td><td>${fmt(w8)}</td></tr>`;
      })
      .join('');

    const replacementsSection = `
    <div class="print-page-break"></div>
    <div class="print-header">Remplaçants</div>
    <div class="print-effective">Date de début d'exécution : ${effectiveDateStr}</div>
    <table class="print-repl-table">
      <thead><tr><th>Poste</th><th>J1</th><th>J2</th><th>J3</th><th>J4</th><th>S1</th><th>S2</th><th>S3</th><th>S4</th></tr></thead>
      <tbody>${replacementRows || '<tr><td colspan="9" class="text-center">Aucun remplaçant configuré</td></tr>'}</tbody>
    </table>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      @page { size: landscape; }
      *{box-sizing:border-box;}
      body{font-family:sans-serif;padding:1rem;margin:0;background:#f3f4f6;}
      .print-header{font-size:1.25rem;font-weight:700;margin-bottom:0.35rem;}
      .print-date{color:#6b7280;font-size:0.875rem;margin-bottom:0.25rem;}
      .print-effective{color:#111;font-size:0.9rem;font-weight:600;margin-bottom:1rem;}
      .zones{display:flex;flex-wrap:wrap;gap:0.75rem;}
      .zone-card{background:#fff;border-radius:0.5rem;padding:0.75rem;min-width:180px;max-width:280px;box-shadow:0 1px 3px rgba(0,0,0,0.1);}
      .zone-title{font-weight:600;font-size:0.95rem;margin-bottom:0.25rem;}
      .zone-desc{font-size:0.75rem;color:#6b7280;margin-bottom:0.5rem;}
      .zone-workers{display:flex;flex-wrap:wrap;gap:0.35rem;}
      .worker-card{border-radius:0.25rem;padding:0.35rem 0.5rem;font-size:10px;line-height:1.2;min-width:90px;}
      .worker-name{font-weight:500;color:#111;}
      .worker-meta{color:#4b5563;font-size:9px;}
      .print-page-break{page-break-before:always;}
      .print-repl-table{border-collapse:collapse;margin-top:0.5rem;width:100%;max-width:600px;}
      .print-repl-table th,.print-repl-table td{border:1px solid #d1d5db;padding:0.35rem 0.5rem;text-align:left;font-size:11px;}
      .print-repl-table th{background:#f3f4f6;font-weight:600;}
      .print-repl-post{font-weight:500;}
    </style>
    </head><body>
    <div class="print-header">${title}</div>
    <div class="print-effective">Date de début d'exécution : ${effectiveDateStr}</div>
    <div class="zones">${zoneCards.join('')}</div>
    ${replacementsSection}
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => {
        w.print();
        w.close();
      }, 400);
    }
  };

  return (
    <div className={isFullScreen ? 'p-2' : 'p-6'}>
      <div className={`flex justify-between items-center ${isFullScreen ? 'mb-2' : 'mb-6'} flex-wrap gap-4`}>
        <h1 className="text-3xl font-bold text-gray-900">Booking</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {user?.canEdit && canUndo && (
            <button
              type="button"
              onClick={handleUndo}
              className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700"
              title="Annuler la dernière action"
            >
              Annuler l&apos;action
            </button>
          )}
          {user?.canEdit && !inMeeting ? (
            <button
              type="button"
              onClick={handleStart}
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700"
            >
              Commencer le booking
            </button>
          ) : user?.canEdit && inMeeting ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setBookingError('');
                  if (editingBookingId) {
                    const b = bookings.find((x) => x.id === editingBookingId);
                    if (b) {
                      setSaveBookingName(b.name);
                      setSaveBookingEffectiveDate(new Date(b.effectiveDate).toISOString().slice(0, 10));
                    }
                  } else {
                    setSaveBookingName('');
                    setSaveBookingEffectiveDate(new Date().toISOString().slice(0, 10));
                  }
                  setShowSaveBookingModal(true);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                {editingBookingId ? 'Mettre à jour le booking' : 'Sauvegarder le booking'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Annuler
              </button>
            </>
          ) : null}
          {user?.canPrint && (
            <button
              type="button"
              onClick={handlePrintBooking}
              className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700"
              title="Imprimer la répartition actuelle"
            >
              Imprimer
            </button>
          )}
          {selectedBookingId && (
            <Link
              to={`/replacements?bookingId=${selectedBookingId}`}
              className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700"
            >
              Voir remplacements
            </Link>
          )}
          <button
            type="button"
            onClick={() => setFullScreen(!isFullScreen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-md transition-all ${isFullScreen 
              ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 shadow-sm' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            title={isFullScreen ? "Quitter le plein écran" : "Passer en plein écran"}
          >
            {isFullScreen ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Quitter
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Plein Écran
              </>
            )}
          </button>
        </div>
      </div>

      {!isFullScreen && (
        <p className="text-sm text-gray-600 mb-4">
          {inMeeting
            ? 'Réunion en cours : répartissez les travailleurs par zone, puis Sauvegarder le booking pour enregistrer. Vous pourrez sélectionner et appliquer un booking plus tard dans la liste.'
            : 'Répartition actuelle par zone originelle. Cliquez sur Commencer le booking pour lancer une réunion, puis Sauvegarder le booking. Sélectionnez un booking dans la liste et cliquez sur Appliquer pour l\'activer.'}
        </p>
      )}

      {bookings.length > 0 && !isFullScreen && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Bookings enregistrés</h2>
          <div className="flex flex-wrap gap-2">
            {bookings.map((b) => (
              <div
                key={b.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedBookingId(b.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBookingId(b.id); } }}
                className={`flex items-center gap-2 px-3 py-2 rounded-md border shadow-sm cursor-pointer ${activeBookingId === b.id
                  ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500'
                  : selectedBookingId === b.id
                    ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-400'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                title={activeBookingId === b.id ? 'Booking actif (répartition appliquée)' : "Sélectionner pour l'impression"}
              >
                {activeBookingId === b.id && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Actif</span>
                )}
                <span className="text-sm font-medium text-gray-800">{b.name}</span>
                <span className="text-xs text-gray-500">
                  Début : {formatLocalDate(b.effectiveDate, 'fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
                {user?.canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleContinueBooking(b); }}
                      className="px-2 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700"
                      title="Continuer / modifier ce booking"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openApplyBookingConfirm(b); }}
                      disabled={activatingId === b.id}
                      className="px-2 py-1 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {activatingId === b.id ? '…' : 'Appliquer'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteBooking(b.id, b.name); }}
                      disabled={deletingId === b.id}
                      className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                      title="Supprimer le booking"
                      aria-label="Supprimer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <DndContext
        sensors={user?.canEdit ? sensors : []}
        collisionDetection={pointerWithin}
        onDragStart={wrapDragStart(handleDragStart)}
        onDragEnd={wrapDragEnd(handleDragEnd)}
      >
        <div className={`flex gap-4 ${isFullScreen ? 'h-[calc(100vh-80px)]' : 'h-[calc(100vh-220px)]'} min-h-[400px] ${replacementPostId ? '' : ''}`}>
          <div className="flex-1 min-w-0 overflow-y-auto">
            <SortableContext
              items={orderedPosts.filter((p) => !lockedPostIds.has(p.id)).map((p) => `${POST_COLUMN_DRAG_PREFIX}${p.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className="grid gap-2 auto-rows-min p-1"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}
              >
                <UnassignedColumn workers={getUnassignedWorkers()} postId={UNASSIGNED_ZONE} />
                {orderedPosts.map((post) => (
                  <SortablePostColumnBooking
                    key={post.id}
                    post={post}
                    workers={getWorkersForPost(post.id)}
                    isLocked={lockedPostIds.has(post.id)}
                    onLockToggle={() => togglePlanPostLock(BOOKING_LAYOUT_KEY, post.id)}
                    onReplacementClick={localZoneMap != null || selectedBookingId != null ? () => setReplacementPostId(post.id) : undefined}
                  />
                ))}
              </div>
            </SortableContext>
          </div>

          {replacementPostId && (() => {
            const post = posts.find((p) => p.id === replacementPostId);
            const defaultSlot: ReplacementSlot = { r1: null, r2: null, r3: null, r4: null, r5: null, r6: null, r7: null, r8: null };
            const slot = replacementByPostId[replacementPostId] ?? defaultSlot;
            const workersSorted = [...workers].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
            const workersJour = workersSorted.filter((w) => WORKER_TYPES_JOUR.includes(w.type));
            const workersSoir = workersSorted.filter((w) => WORKER_TYPES_SOIR.includes(w.type));
            const canSaveToBooking = !!selectedBookingId;
            return (
              <div className="w-72 shrink-0 flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-3 py-2 bg-violet-50 border-b border-violet-100">
                  <h3 className="text-sm font-semibold text-gray-800">Remplaçants pour {post?.name ?? '…'}</h3>
                </div>
                <div className="p-3 flex-1 min-h-0 overflow-y-auto space-y-3">
                  {REPLACEMENT_LABELS.map(([key, label]) => {
                    const value = slot[key];
                    const otherIds = (REPLACEMENT_LABELS.map(([k]) => k) as (keyof ReplacementSlot)[]).filter((k) => k !== key).map((k) => slot[k]).filter(Boolean) as string[];
                    const pool = ['r1', 'r2', 'r3', 'r4'].includes(key) ? workersJour : workersSoir;
                    let options = pool.filter((w) => w.id === value || !otherIds.includes(w.id));
                    if (value && !options.some((w) => w.id === value)) {
                      const selected = workers.find((w) => w.id === value);
                      if (selected) options = [selected, ...options];
                    }
                    return (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                        <select
                          value={value ?? ''}
                          onChange={(e) => {
                            const v = e.target.value || null;
                            setReplacementByPostId((prev) => ({
                              ...prev,
                              [replacementPostId]: { ...(prev[replacementPostId] ?? defaultSlot), [key]: v },
                            }));
                          }}
                          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                        >
                          <option value="">— Aucun —</option>
                          {options.map((w) => (
                            <option key={w.id} value={w.id}>({w.anciennete}) {w.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                  {!canSaveToBooking && (
                    <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                      Sauvegardez le booking pour enregistrer les remplaçants.
                    </p>
                  )}
                  {replacementSaveError && (
                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{replacementSaveError}</p>
                  )}
                </div>
                <div className="p-3 border-t border-gray-100 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setReplacementPostId(null); setReplacementSaveError(''); }}
                    className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Fermer
                  </button>
                  {canSaveToBooking && (
                    <button
                      type="button"
                      onClick={saveReplacementsForSelectedBooking}
                      disabled={replacementSaving}
                      className="px-3 py-1.5 text-sm text-white bg-violet-600 rounded-md hover:bg-violet-700 disabled:opacity-50"
                    >
                      {replacementSaving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        <DragOverlay>
          {activeWorker ? (
            <div className="bg-white p-3 rounded-lg shadow-lg border-2 border-blue-500 text-xs">
              <div className="font-semibold text-gray-900">({activeWorker.anciennete}) {activeWorker.name}</div>
              <div className="text-gray-600 text-[10px] mt-0.5">
                {activeWorker.originalPost?.name ?? '-'}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {showSaveBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSaveBookingModal(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{editingBookingId ? 'Mettre à jour le booking' : 'Sauvegarder le booking'}</h3>
            <p className="text-sm text-gray-600 mb-3">
              La répartition actuelle sera enregistrée. Les postes des travailleurs ne seront pas modifiés tant que vous n&apos;aurez pas cliqué sur « Appliquer » pour ce booking.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du booking</label>
            <input
              type="text"
              value={saveBookingName}
              onChange={(e) => setSaveBookingName(e.target.value)}
              placeholder="ex. Semaine 12 mars"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
              autoFocus
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de début d&apos;exécution</label>
            <input
              type="date"
              value={saveBookingEffectiveDate}
              onChange={(e) => setSaveBookingEffectiveDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
            />
            {bookingError && <p className="text-sm text-red-600 mb-2">{bookingError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowSaveBookingModal(false); setBookingError(''); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveAsBooking}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                {editingBookingId ? 'Mettre à jour' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {applyBookingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setApplyBookingConfirm(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Appliquer le booking</h3>
            <p className="text-sm text-gray-700 mb-4 font-bold text-red-600">
              Attention : Vous êtes sur le point de changer de booking. Êtes-vous sûr ?
            </p>
            <p className="text-sm text-gray-700 mb-4">
              {applyBookingConfirm.currentActiveName ? (
                <>
                  Le booking <strong>« {applyBookingConfirm.newName} »</strong> va remplacer le booking actuellement actif <strong>« {applyBookingConfirm.currentActiveName} »</strong>.
                  Les postes d&apos;origine des travailleurs seront mis à jour selon le nouveau booking.
                </>
              ) : (
                <>
                  Appliquer le booking <strong>« {applyBookingConfirm.newName} »</strong> ? Les postes d&apos;origine des travailleurs seront mis à jour.
                </>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApplyBookingConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleActivateBooking(applyBookingConfirm.bookingId)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
