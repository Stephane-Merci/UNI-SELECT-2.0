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
      className={`bg-gray-100 rounded-lg p-4 min-h-[200px] border-2 ${
        isOver ? 'border-blue-500 bg-blue-100' : 'border-gray-200'
      }`}
    >
      <h2 className="font-semibold text-lg mb-4 text-gray-700">Non assignés</h2>
      <SortableContext
        items={workers.map((w) => (postId ? `${POST_DRAG_PREFIX}${postId}${POST_DRAG_SEP}${w.id}` : w.id))}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveWorker(null);
    if (!over) return;

    let workerId = String(active.id);
    if (workerId.includes(POST_DRAG_SEP)) workerId = workerId.split(POST_DRAG_SEP)[1] ?? workerId;
    const overId = String(over.id);

    if (overId === UNASSIGNED_ZONE) {
      if (localZoneMap) {
        setLocalZoneMap((m) => ({ ...m!, [workerId]: UNASSIGNED_ZONE }));
      }
      return;
    }

    const post = posts.find((p) => p.id === overId);
    if (post) {
      if (localZoneMap) {
        setLocalZoneMap((m) => ({ ...m!, [workerId]: post.id }));
      } else {
        const w = workers.find((x) => x.id === workerId);
        if (w && w.originalPostId !== post.id) {
          await updateWorkerOriginalPost(workerId, post.id);
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
        if (localZoneMap) setLocalZoneMap((m) => ({ ...m!, [workerId]: UNASSIGNED_ZONE }));
      } else {
        if (localZoneMap) setLocalZoneMap((m) => ({ ...m!, [workerId]: targetZone }));
        else if (workers.find((x) => x.id === workerId)?.originalPostId !== targetZone) {
          await updateWorkerOriginalPost(workerId, targetZone);
        }
      }
    }
  };

  const handleStart = () => {
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
  };

  const handleCancel = () => {
    setLocalZoneMap(null);
  };

  const inMeeting = localZoneMap !== null;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Booking</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {!inMeeting ? (
            <button
              type="button"
              onClick={handleStart}
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700"
            >
              Start
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
          : 'Répartition actuelle par zone originelle. Cliquez sur Start pour lancer une réunion de booking (tous en non assignés), puis Enregistrer pour sauvegarder.'}
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={wrapDragStart(handleDragStart)}
        onDragEnd={wrapDragEnd(handleDragEnd)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <UnassignedColumn workers={getUnassignedWorkers()} postId={UNASSIGNED_ZONE} />
          {posts.map((post) => (
            <PostColumn
              key={post.id}
              post={post}
              workers={getWorkersForPost(post.id)}
            />
          ))}
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
