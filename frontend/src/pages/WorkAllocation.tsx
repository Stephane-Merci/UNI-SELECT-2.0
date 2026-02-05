import { useEffect, useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
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
} from '@dnd-kit/sortable';
import { useStore } from '../store/useStore';
import { useAutoScrollDuringDrag } from '../hooks/useAutoScrollDuringDrag';
import { Worker } from '../types';
import PostColumn from '../components/PostColumn';
import WorkerCard, { POST_DRAG_PREFIX, POST_DRAG_SEP } from '../components/WorkerCard';
import CreateWorkerModal from '../components/CreateWorkerModal';
import CreatePostModal from '../components/CreatePostModal';
import { io } from 'socket.io-client';

const UNASSIGNED_ZONE = 'unassigned';

// Booking: zones = posts (zone originel). Workers shown by current zone (originalPost or local meeting state).
function UnassignedColumn({ workers, postId }: { workers: Worker[]; postId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_ZONE });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-[140px] max-h-[250px] bg-gray-100 rounded-lg p-2 border-2 ${
        isOver ? 'border-blue-500 bg-blue-100' : 'border-gray-200'
      }`}
    >
      <h2 className="font-semibold text-sm mb-2 text-gray-700 shrink-0">Non assignés</h2>
      <SortableContext
        items={workers.map((w) => (postId ? `${POST_DRAG_PREFIX}${postId}${POST_DRAG_SEP}${w.id}` : w.id))}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-1">
          {workers.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              dragId={postId ? `${POST_DRAG_PREFIX}${postId}${POST_DRAG_SEP}${worker.id}` : undefined}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default function WorkAllocation() {
  const { workers, posts, fetchWorkers, fetchPosts, updateWorkerOriginalPost } = useStore();
  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  // When non-null, we're in "booking meeting" mode: all changes are local until Save.
  const [localZoneMap, setLocalZoneMap] = useState<Record<string, string> | null>(null);
  // Undo: in meeting mode = stack of previous localZoneMap snapshots; outside = last move only.
  const [zoneMapHistory, setZoneMapHistory] = useState<Record<string, string>[]>([]);
  const [lastMove, setLastMove] = useState<{ workerId: string; previousPostId: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const { wrapDragStart, wrapDragEnd } = useAutoScrollDuringDrag();

  useEffect(() => {
    fetchWorkers();
    fetchPosts();
  }, [fetchWorkers, fetchPosts]);

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
    (postId: string) => workers.filter((w) => currentZone(w) === postId),
    [workers, currentZone]
  );

  const getUnassignedWorkers = useCallback(
    () => workers.filter((w) => currentZone(w) === UNASSIGNED_ZONE),
    [workers, currentZone]
  );

  const handleDragStart = (event: DragStartEvent) => {
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
    const { active, over } = event;
    setActiveWorker(null);
    if (!over) return;

    let workerId = String(active.id);
    if (workerId.includes(POST_DRAG_SEP)) workerId = workerId.split(POST_DRAG_SEP)[1] ?? workerId;
    const overId = String(over.id);
    const worker = workers.find((x) => x.id === workerId);
    const previousPostId = worker?.originalPostId ?? UNASSIGNED_ZONE;

    if (overId === UNASSIGNED_ZONE) {
      if (localZoneMap) {
        pushZoneMapToHistory();
        setLocalZoneMap((m) => ({ ...m!, [workerId]: UNASSIGNED_ZONE }));
      }
      return;
    }

    const post = posts.find((p) => p.id === overId);
    if (post) {
      if (localZoneMap) {
        pushZoneMapToHistory();
        setLocalZoneMap((m) => ({ ...m!, [workerId]: post.id }));
      } else {
        if (worker && worker.originalPostId !== post.id) {
          await updateWorkerOriginalPost(workerId, post.id);
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
  };

  const handleSave = async () => {
    if (!localZoneMap) return;
    for (const w of workers) {
      const z = localZoneMap[w.id] ?? UNASSIGNED_ZONE;
      if (z !== UNASSIGNED_ZONE && z !== w.originalPostId) {
        await updateWorkerOriginalPost(w.id, z);
      }
    }
    await fetchWorkers();
    setLocalZoneMap(null);
    setZoneMapHistory([]);
  };

  const handleCancel = () => {
    setLocalZoneMap(null);
    setZoneMapHistory([]);
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Booking</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {canUndo && (
            <button
              type="button"
              onClick={handleUndo}
              className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700"
              title="Annuler la dernière action"
            >
              Annuler l&apos;action
            </button>
          )}
          {!inMeeting ? (
            <button
              type="button"
              onClick={handleStart}
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700"
            >
              Commencer le booking
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Annuler
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowWorkerModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Créer Travailleur
          </button>
          <button
            type="button"
            onClick={() => setShowPostModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Créer Poste
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        {inMeeting
          ? 'Réunion en cours : répartissez les travailleurs par zone, puis cliquez sur Enregistrer.'
          : 'Répartition actuelle par zone originelle. Cliquez sur Commencer le booking pour lancer une réunion (tous en non assignés), puis Enregistrer pour sauvegarder.'}
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={wrapDragStart(handleDragStart)}
        onDragEnd={wrapDragEnd(handleDragEnd)}
      >
        <div className="h-[calc(100vh-220px)] min-h-[400px] overflow-y-auto">
          <div
            className="grid gap-2 auto-rows-min p-1"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}
          >
            <UnassignedColumn workers={getUnassignedWorkers()} postId={UNASSIGNED_ZONE} />
            {posts.map((post) => (
              <PostColumn
                key={post.id}
                post={post}
                workers={getWorkersForPost(post.id)}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeWorker ? (
            <div className="bg-white p-3 rounded-lg shadow-lg border-2 border-blue-500 text-xs">
              <div className="font-semibold text-gray-900">{activeWorker.name}</div>
              <div className="text-gray-600 text-[10px] mt-0.5">
                {activeWorker.originalPost?.name ?? '-'} ({activeWorker.anciennete})
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {showWorkerModal && (
        <CreateWorkerModal onClose={() => setShowWorkerModal(false)} posts={posts} />
      )}
      {showPostModal && <CreatePostModal onClose={() => setShowPostModal(false)} />}
    </div>
  );
}
