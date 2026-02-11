import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { useAutoScrollDuringDrag } from '../hooks/useAutoScrollDuringDrag';
import { Worker, Post, WorkerType, WorkerTypeColors, ORIGIN_TYPES, WORKER_TYPES_JOUR, WORKER_TYPES_SOIR } from '../types';
import PostColumn, { POST_COLUMN_DRAG_PREFIX } from '../components/PostColumn';
import WorkerCard, { getWorkerIdFromDragId, PRESENCE_DRAG_PREFIX } from '../components/WorkerCard';
import PlanManagementModal from '../components/PlanManagementModal';
import { io } from 'socket.io-client';
import apiClient from '../api/client';
import type { Booking, BookingReplacement } from '../types';

// 6 main availabilities — search filters only these.
const MAIN_PRESENCE_GROUPS: Record<string, WorkerType[]> = {
  'Permanent jour': [WorkerType.PERMANENT_JOUR, WorkerType.JOUR],
  'Permanent soir': [WorkerType.PERMANENT_SOIR, WorkerType.SOIR],
  'Occasionel du jour': [WorkerType.OCCASIONEL_DU_JOUR],
  'Occasionel du soir': [WorkerType.OCCASIONEL_SOIR],
  'Mobilité du jour': [WorkerType.MOBILITE_DU_JOUR],
  'Mobilité du soir': [WorkerType.MOBILITE_DU_SOIR],
};
// Attendance-based — always shown below, not filtered by search.
const ATTENDANCE_PRESENCE_GROUPS: Record<string, WorkerType[]> = {
  'Absent': [WorkerType.ABSENT],
  'Vacances': [WorkerType.VACANCES],
  'Libération externe': [WorkerType.LIBERATION_EXTERNE],
  'Invalidité': [WorkerType.INVALIDITE],
  'Préretraite': [WorkerType.PRERETRAITE],
  'Congé parental': [WorkerType.CONGE_PARENTAL],
};
const ATTENDANCE_PRESENCE_TYPES = new Set(Object.values(ATTENDANCE_PRESENCE_GROUPS).flat());

// Single presence box — useDroppable must be called at top level (not inside map).
function PresenceBox({
  groupName,
  groupTypes,
  workers,
  presences,
}: {
  groupName: string;
  groupTypes: WorkerType[];
  workers: Worker[];
  presences: Record<string, WorkerType>;
}) {
  const primaryType = groupTypes[0];
  const { setNodeRef, isOver } = useDroppable({
    id: `presence-${primaryType}`,
  });
  const groupWorkers = workers.filter((worker) => {
    const presenceType = presences[worker.id] || worker.type;
    return groupTypes.includes(presenceType);
  });

  return (
    <div
      ref={setNodeRef}
      className={`bg-white rounded-lg p-2 border-2 min-h-0 ${
        isOver ? 'bg-blue-50 border-blue-400' : ''
      }`}
      style={{
        borderLeftColor: WorkerTypeColors[primaryType],
        borderLeftWidth: '4px',
      }}
    >
      <h3
        className="font-bold text-xs mb-1.5"
        style={{ color: WorkerTypeColors[primaryType] }}
      >
        {groupName} ({groupWorkers.length})
      </h3>
      <SortableContext
        items={groupWorkers.map((w) => `${PRESENCE_DRAG_PREFIX}${w.id}`)}
        strategy={verticalListSortingStrategy}
      >
        {/* 
          Use a responsive grid that wraps workers instead of forcing the box
          to grow horizontally. When the fiche de présence panel is narrowed,
          cards will flow to the next row instead of stretching the section.
        */}
        <div className="grid gap-0.5 min-h-0 grid-cols-[repeat(auto-fill,minmax(110px,1fr))]">
          {groupWorkers.length > 0 ? (
            groupWorkers.map((worker) => {
              const workerPresenceType = presences[worker.id] || worker.type;
              return (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                  presenceType={workerPresenceType}
                  dragId={`${PRESENCE_DRAG_PREFIX}${worker.id}`}
                />
              );
            })
          ) : (
            <p className="text-[10px] text-gray-400 italic text-center py-1 col-span-4">
              Vide
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Presence Panel Component (Right Side) - Boxes for each availability type
function PresencePanel({ 
  workers, 
  presences,
  searchFilter,
  onSearchChange,
  onAutoClick,
}: { 
  workers: Worker[];
  presences: Record<string, WorkerType>;
  searchFilter: string;
  onSearchChange: (v: string) => void;
  onAutoClick?: () => void;
}) {
  const q = searchFilter.trim().toLowerCase();
  const filteredMainEntries = Object.entries(MAIN_PRESENCE_GROUPS).filter(
    ([groupName]) => !q || groupName.toLowerCase().includes(q)
  );
  const attendanceEntries = Object.entries(ATTENDANCE_PRESENCE_GROUPS);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h2 className="text-xl font-bold text-gray-800">Fiche de présence</h2>
        <input
          type="text"
          placeholder="Filtrer les 6 dispos. (ex: jour, soir…)"
          value={searchFilter}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 min-w-[120px] px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          aria-label="Filtrer les périodes"
        />
        {onAutoClick && (
          <button
            type="button"
            onClick={onAutoClick}
            className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700"
          >
            Assignement automatique
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {filteredMainEntries.map(([groupName, groupTypes]) => (
          <PresenceBox
            key={groupName}
            groupName={groupName}
            groupTypes={groupTypes}
            workers={workers}
            presences={presences}
          />
        ))}
        {attendanceEntries.length > 0 && (
          <>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2 border-t border-gray-200 mt-2">
              Présence / absence
            </div>
            {attendanceEntries.map(([groupName, groupTypes]) => (
              <PresenceBox
                key={groupName}
                groupName={groupName}
                groupTypes={groupTypes}
                workers={workers}
                presences={presences}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// Sortable wrapper for a post column. Locked posts are not draggable.
function SortablePostColumn({
  post,
  workers,
  isLocked,
  onLockToggle,
}: {
  post: Post;
  workers: Worker[];
  isLocked: boolean;
  onLockToggle: () => void;
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Locked: fixed width, only wraps when no space. Unlocked: can grow and unwrap when zone increases.
  const wrapperClass = isLocked
    ? 'w-[130px] flex-shrink-0'
    : 'min-w-[130px] flex-1 basis-[130px]';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${wrapperClass} ${isDragging ? 'opacity-50 z-10' : ''} ${
        isOver ? 'ring-2 ring-blue-500 ring-offset-2 rounded-lg bg-blue-50/80' : ''
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
        isLocked={isLocked}
        onLockToggle={onLockToggle}
        wrapperClassName={wrapperClass}
        dragHandleProps={isLocked ? undefined : { attributes: attributes as unknown as Record<string, unknown>, listeners: (listeners ?? {}) as unknown as Record<string, unknown> }}
      />
    </div>
  );
}

// Posts Panel Component (Left Side) - Only posts, no unassigned.
// Workers in attendance/absence (Absent, Vacances, etc.) are not shown on posts.
// Supports reordering (drag) and lock; locked posts have fixed width and only wrap when no space.
function PostsPanel({
  posts,
  workers,
  assignments,
  presences,
  attendancePresenceTypes,
  lockedPostIds,
  onPostLockToggle,
}: {
  posts: Post[];
  workers: Worker[];
  assignments: Record<string, string>;
  presences: Record<string, WorkerType>;
  attendancePresenceTypes: Set<WorkerType>;
  lockedPostIds: Set<string>;
  onPostLockToggle: (postId: string) => void;
}) {
  const getWorkersForPost = (postId: string) => {
    return workers
      .filter((worker) => {
        if (assignments[worker.id] !== postId) return false;
        const pt = presences[worker.id] ?? worker.type;
        return !attendancePresenceTypes.has(pt);
      })
      .sort((a, b) => a.anciennete.localeCompare(b.anciennete, 'fr', { numeric: true }));
  };

  const sortablePostIds = posts
    .filter((p) => !lockedPostIds.has(p.id))
    .map((p) => `${POST_COLUMN_DRAG_PREFIX}${p.id}`);

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Postes</h2>
      <div className="flex-1 overflow-y-auto">
        <SortableContext
          items={sortablePostIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-wrap gap-2">
            {posts.map((post) => (
              <SortablePostColumn
                key={post.id}
                post={post}
                workers={getWorkersForPost(post.id)}
                isLocked={lockedPostIds.has(post.id)}
                onLockToggle={() => onPostLockToggle(post.id)}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export default function PlanManagement() {
  const {
    workers,
    posts,
    plans,
    currentPlan,
    assignments,
    workerPresences,
    fetchWorkers,
    fetchPosts,
    fetchPlans,
    fetchAssignments,
    createPlan,
    loadPlan,
    copyPlan,
    assignWorker,
    removeAssignment,
    updateWorkerPresence,
    updateWorkerType,
    getPlanPostOrder,
    setPlanPostOrder,
    getPlanLockedPosts,
    togglePlanPostLock,
    planLayoutVersion,
  } = useStore();

  // Ordered posts for current plan (persisted in localStorage); re-render when layout changes
  const orderedPosts =
    currentPlan && posts.length > 0
      ? getPlanPostOrder(currentPlan.id, posts.map((p) => p.id))
          .map((id) => posts.find((p) => p.id === id))
          .filter((p): p is Post => !!p)
      : posts;
  const lockedPostIds = currentPlan ? getPlanLockedPosts(currentPlan.id) : new Set<string>();
  void planLayoutVersion[currentPlan ? 'global' : '']; // subscribe for re-renders (layout is shared across plans)

  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage
  const [isResizing, setIsResizing] = useState(false);
  const [presenceSearchFilter, setPresenceSearchFilter] = useState('');
  const [replacementPrompt, setReplacementPrompt] = useState<{
    postId: string;
    postName: string;
    workerName: string;
    workerAnciennete: string;
    shift: 'jour' | 'soir';
    options: { id: string; name: string; anciennete: string }[];
  } | null>(null);
  const [replacementPromptSelectedId, setReplacementPromptSelectedId] = useState<string | null>(null);
  const [autoAssignReplacementPrompt, setAutoAssignReplacementPrompt] = useState<{
    items: { postId: string; postName: string; workerIds: string[] }[];
  } | null>(null);
  const [lastPlanAction, setLastPlanAction] = useState<{
    workerId: string;
    previousPostId: string | null;
    previousPresenceType: WorkerType;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 2 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const { wrapDragStart, wrapDragEnd } = useAutoScrollDuringDrag();

  useEffect(() => {
    fetchWorkers();
    fetchPosts();
    fetchPlans();
  }, [fetchWorkers, fetchPosts, fetchPlans]);

  useEffect(() => {
    setLastPlanAction(null);
  }, [currentPlan?.id]);

  useEffect(() => {
    if (currentPlan) {
      fetchAssignments(currentPlan.id);
    }
  }, [currentPlan, fetchAssignments]);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    const socket = io(socketUrl);
    socket.on('connect', () => {
      socket.emit('join-room', 'main');
    });

    socket.on('worker-assigned', () => {
      if (currentPlan) {
        fetchAssignments(currentPlan.id);
      }
    });

    socket.on('worker-unassigned', () => {
      if (currentPlan) {
        fetchAssignments(currentPlan.id);
      }
    });

    socket.on('worker-presence-updated', () => {
      if (currentPlan) {
        loadPlan(currentPlan.id);
      }
    });

    socket.on('plan-created', () => {
      fetchPlans();
    });

    socket.on('plan-updated', () => {
      fetchPlans();
      if (currentPlan) {
        loadPlan(currentPlan.id);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentPlan, fetchAssignments, fetchPlans, loadPlan]);

  // Build presence map
  const presenceMap: Record<string, WorkerType> = {};
  workerPresences.forEach((presence) => {
    presenceMap[presence.workerId] = presence.type;
  });

  // Build assignment map
  const assignmentMap: Record<string, string> = {};
  assignments
    .filter((a) => a.planId === currentPlan?.id)
    .forEach((assignment) => {
      assignmentMap[assignment.workerId] = assignment.postId;
    });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const workerId = getWorkerIdFromDragId(String(active.id));
    const worker = workerId ? workers.find((w) => w.id === workerId) ?? null : null;
    setActiveWorker(worker);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveWorker(null);

    if (!over || !currentPlan) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Post column reorder (plan zone)
    if (activeId.startsWith(POST_COLUMN_DRAG_PREFIX)) {
      if (overId.startsWith(POST_COLUMN_DRAG_PREFIX)) {
        const fromPostId = activeId.slice(POST_COLUMN_DRAG_PREFIX.length);
        const toPostId = overId.slice(POST_COLUMN_DRAG_PREFIX.length);
        if (fromPostId !== toPostId) {
          const currentOrder = getPlanPostOrder(currentPlan.id, posts.map((p) => p.id));
          const fromIndex = currentOrder.indexOf(fromPostId);
          const toIndex = currentOrder.indexOf(toPostId);
          if (fromIndex !== -1 && toIndex !== -1) {
            const next = [...currentOrder];
            next.splice(fromIndex, 1);
            next.splice(toIndex, 0, fromPostId);
            setPlanPostOrder(currentPlan.id, next);
          }
        }
      }
      return;
    }

    const workerId = getWorkerIdFromDragId(activeId);
    if (!workerId) return;

    const worker = workers.find((w) => w.id === workerId);
    const previousPresenceType = presenceMap[workerId] ?? worker?.type ?? ('' as WorkerType);
    const previousPostId = assignmentMap[workerId] ?? null;

    // Check if dropping on a presence type box (fiche de présence): unassign from post and update presence
    if (overId.startsWith('presence-')) {
      setLastPlanAction({ workerId, previousPostId, previousPresenceType });
      // Remove assignment so worker disappears from posts section and appears in fiche de présence
      const existingAssignment = assignments.find(
        (a) => a.workerId === workerId && a.planId === currentPlan.id
      );
      if (existingAssignment) {
        await removeAssignment(existingAssignment.id);
      }

      const droppedType = overId.replace('presence-', '') as WorkerType;
      if (Object.values(WorkerType).includes(droppedType)) {
        const currentPresenceType = presenceMap[workerId] ?? worker?.type;
        if (currentPresenceType !== droppedType) {
          const isOriginType = ORIGIN_TYPES.includes(droppedType);
          if (isOriginType) {
            await updateWorkerType(workerId, droppedType);
            await updateWorkerPresence(currentPlan.id, workerId, droppedType);
          } else {
            await updateWorkerPresence(currentPlan.id, workerId, droppedType);
          }
        }
      }

      // Crucial check: if this worker was the only one from their shift on their post, and the post has replacements, prompt to choose a replacement
      if (previousPostId && worker) {
        const workerShift: 'jour' | 'soir' | null = WORKER_TYPES_JOUR.includes(worker.type)
          ? 'jour'
          : WORKER_TYPES_SOIR.includes(worker.type)
            ? 'soir'
            : null;
        if (workerShift) {
          const workersStillOnPost = workers.filter(
            (w) => w.id !== workerId && assignmentMap[w.id] === previousPostId
          );
          const sameShiftStillOnPost = workersStillOnPost.filter((w) =>
            workerShift === 'jour'
              ? WORKER_TYPES_JOUR.includes(w.type)
              : WORKER_TYPES_SOIR.includes(w.type)
          );
          if (sameShiftStillOnPost.length === 0) {
            try {
              const bookingsRes = await apiClient.get<Booking[]>('/bookings');
              const bookingsList = bookingsRes.data ?? [];
              const planDate = currentPlan.date ? new Date(currentPlan.date).getTime() : null;
              const chosenBooking =
                planDate != null
                  ? bookingsList.find((b) => new Date(b.effectiveDate).getTime() === planDate) ?? bookingsList[0]
                  : bookingsList[0];
              if (chosenBooking) {
                const replRes = await apiClient.get<BookingReplacement[]>(`/bookings/${chosenBooking.id}/replacements`);
                const replList = replRes.data ?? [];
                const row = replList.find((r) => r.postId === previousPostId);
                if (row) {
                  const ids =
                    workerShift === 'jour'
                      ? [row.replacement1WorkerId, row.replacement2WorkerId]
                      : [row.replacement3WorkerId, row.replacement4WorkerId];
                  const optionIds = (ids.filter((id): id is string => !!id) as string[]).filter(Boolean);
                  const options = optionIds
                    .map((id) => workers.find((w) => w.id === id))
                    .filter((w): w is Worker => !!w)
                    .map((w) => ({ id: w.id, name: w.name, anciennete: w.anciennete }));
                  if (options.length > 0) {
                    const post = posts.find((p) => p.id === previousPostId);
                    setReplacementPrompt({
                      postId: previousPostId,
                      postName: post?.name ?? previousPostId,
                      workerName: worker.name,
                      workerAnciennete: worker.anciennete,
                      shift: workerShift,
                      options,
                    });
                    setReplacementPromptSelectedId(options[0]?.id ?? null);
                    return;
                  }
                }
              }
            } catch (e) {
              console.error('Replacement check failed:', e);
            }
          }
        }
      }
      return;
    }

    // Check if dropping on a post (overId can be post.id or post-column-{post.id} with pointerWithin)
    const postIdForDrop = overId.startsWith(POST_COLUMN_DRAG_PREFIX) ? overId.slice(POST_COLUMN_DRAG_PREFIX.length) : overId;
    const post = posts.find((p) => p.id === postIdForDrop);
    if (post) {
      // Keep previousPostId so Undo can restore: if worker was on another post, put them back there; if from fiche de présence, previousPostId is null and Undo will remove assignment
      setLastPlanAction({ workerId, previousPostId, previousPresenceType });
      // When assigning from presence/absence (Absent, Vacances, etc.) to a post, set presence
      // back to the worker's origin type (e.g. PERMANENT_JOUR) so they're shown as "back to work"
      if (worker) {
        await updateWorkerPresence(currentPlan.id, workerId, worker.type);
      }
      await assignWorker(currentPlan.id, workerId, post.id);
      return;
    }
  };

  const handleUndoPlan = async () => {
    if (!currentPlan || !lastPlanAction) return;
    const { workerId, previousPostId, previousPresenceType } = lastPlanAction;
    try {
      if (previousPostId !== null) {
        await assignWorker(currentPlan.id, workerId, previousPostId);
        await updateWorkerPresence(currentPlan.id, workerId, previousPresenceType);
      } else {
        const a = assignments.find(
          (x) => x.planId === currentPlan.id && x.workerId === workerId
        );
        if (a) await removeAssignment(a.id);
        await updateWorkerPresence(currentPlan.id, workerId, previousPresenceType);
      }
      await fetchAssignments(currentPlan.id);
      await fetchWorkers();
      setLastPlanAction(null);
    } catch (e) {
      console.error('Undo failed:', e);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const container = document.querySelector('.resizable-container') as HTMLElement;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Limit between 20% and 80%
      const clampedWidth = Math.max(20, Math.min(80, newLeftWidth));
      setLeftPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Posts panel: all workers (assignments filter who appears on each post)
  const allWorkersForDisplay = workers;
  // Fiche de présence: only workers not assigned to any post; once dragged to a post they disappear from here
  const workersForPresencePanel = workers.filter((w) => !assignmentMap[w.id]);

  const handleAutoAssign = async () => {
    if (!currentPlan) return;
    const q = presenceSearchFilter.trim().toLowerCase();
    const visibleGroupTypes = Object.entries(MAIN_PRESENCE_GROUPS)
      .filter(([name]) => !q || name.toLowerCase().includes(q))
      .flatMap(([, types]) => types);
    const visibleWorkers = allWorkersForDisplay.filter((w) => {
      const pt = presenceMap[w.id] ?? w.type;
      return visibleGroupTypes.includes(pt);
    });
    // Only assign Permanent jour / Permanent soir (not mobile, not occasionel)
    const permanentOnly = [
      WorkerType.PERMANENT_JOUR,
      WorkerType.PERMANENT_SOIR,
      WorkerType.JOUR,
      WorkerType.SOIR,
    ];
    const toAssign = visibleWorkers.filter((w) => {
      const pt = presenceMap[w.id] ?? w.type;
      return permanentOnly.includes(pt);
    });

    // Assign every worker to their original post only — do NOT auto-assign replacements to replacement posts
    for (const w of toAssign) {
      await assignWorker(currentPlan.id, w.id, w.originalPostId);
    }

    // After auto-assign, detect posts that have all their workers absent but have replacements defined.
    // Show a popup so the manager can choose whether to assign those replacements.
    try {
      const bookingsRes = await apiClient.get<Booking[]>('/bookings');
      const bookingsList = bookingsRes.data ?? [];
      const planDate = currentPlan.date ? new Date(currentPlan.date).getTime() : null;
      const chosenBooking =
        planDate != null
          ? bookingsList.find((b) => new Date(b.effectiveDate).getTime() === planDate) ?? bookingsList[0]
          : bookingsList[0];
      if (chosenBooking) {
        const replRes = await apiClient.get<BookingReplacement[]>(`/bookings/${chosenBooking.id}/replacements`);
        const replList = replRes.data ?? [];
        const items: { postId: string; postName: string; workerIds: string[] }[] = [];
        for (const r of replList) {
          const postId = r.postId;
          const workersOnPost = workers.filter((w) => w.originalPostId === postId);
          const allAbsent =
            workersOnPost.length > 0 &&
            workersOnPost.every((w) => {
              const pt = presenceMap[w.id] ?? w.type;
              return ATTENDANCE_PRESENCE_TYPES.has(pt);
            });
          if (allAbsent && workersOnPost.length > 0) {
            const workerIds = [r.replacement1WorkerId, r.replacement2WorkerId, r.replacement3WorkerId, r.replacement4WorkerId].filter(
              (id): id is string => !!id
            );
            if (workerIds.length > 0) {
              const post = posts.find((p) => p.id === postId);
              items.push({ postId, postName: post?.name ?? postId, workerIds });
            }
          }
        }
        if (items.length > 0) {
          setAutoAssignReplacementPrompt({ items });
        }
      }
    } catch {
      // ignore: no popup if bookings/replacements fail
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {currentPlan ? currentPlan.name : 'Aucun plan sélectionné'}
            </h1>
            {currentPlan && (
              <span className="text-sm text-gray-500">
                {currentPlan.date
                  ? new Date(currentPlan.date).toLocaleDateString('fr-FR')
                  : ''}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {currentPlan && lastPlanAction && (
              <button
                type="button"
                onClick={handleUndoPlan}
                className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700"
                title="Annuler la dernière action"
              >
                Annuler l&apos;action
              </button>
            )}
            <Link
              to="/replacements"
              className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700"
            >
              Voir remplacements
            </Link>
            <button
              onClick={() => setShowPlanModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {currentPlan ? 'Gérer les Plans' : 'Créer un Plan'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Two Panels */}
      {currentPlan ? (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={wrapDragStart(handleDragStart)}
          onDragEnd={wrapDragEnd(handleDragEnd)}
        >
          <div className="flex-1 flex p-6 overflow-hidden gap-4 resizable-container">
            {/* Left Panel - Posts */}
            <div 
              className="bg-white rounded-lg shadow p-4 overflow-hidden"
              style={{ width: `${leftPanelWidth}%`, minWidth: '300px' }}
            >
              <PostsPanel
                posts={orderedPosts}
                workers={allWorkersForDisplay}
                assignments={assignmentMap}
                presences={presenceMap}
                attendancePresenceTypes={ATTENDANCE_PRESENCE_TYPES}
                lockedPostIds={lockedPostIds}
                onPostLockToggle={(postId) => currentPlan && togglePlanPostLock(currentPlan.id, postId)}
              />
            </div>

            {/* Resizer */}
            <div
              onMouseDown={handleMouseDown}
              className={`w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors ${
                isResizing ? 'bg-blue-500' : ''
              }`}
              style={{ minWidth: '4px' }}
            />

            {/* Right Panel - Presence */}
            <div 
              className="bg-white rounded-lg shadow p-4 overflow-hidden flex-1"
              style={{ minWidth: '300px' }}
            >
              <PresencePanel
                workers={workersForPresencePanel}
                presences={presenceMap}
                searchFilter={presenceSearchFilter}
                onSearchChange={setPresenceSearchFilter}
                onAutoClick={handleAutoAssign}
              />
            </div>
          </div>

          <DragOverlay>
            {activeWorker ? (
              <div className="bg-white p-2 rounded-lg shadow-lg border-2 border-blue-500 text-xs">
                <div className="font-semibold text-gray-900">({activeWorker.anciennete}) {activeWorker.name}</div>
                <div className="text-gray-600 text-[10px] mt-0.5">
                  {activeWorker.originalPost?.name ?? '-'}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-lg mb-4">
              Aucun plan n'est actuellement ouvert
            </p>
            <button
              onClick={() => setShowPlanModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-lg"
            >
              Créer ou Charger un Plan
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showPlanModal && (
        <PlanManagementModal
          onClose={() => setShowPlanModal(false)}
          plans={plans}
          currentPlan={currentPlan}
          onPlanSelect={loadPlan}
          onPlanCreate={createPlan}
          onPlanCopy={copyPlan}
        />
      )}

      {replacementPrompt && currentPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setReplacementPrompt(null)}>
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Remplaçant requis</h3>
            <p className="text-sm text-gray-700 mb-3">
              <span className="font-medium">({replacementPrompt.workerAnciennete}) {replacementPrompt.workerName}</span>
              {' '}étant absent, choisissez qui va le/la remplacer sur le poste{' '}
              <span className="font-medium">{replacementPrompt.postName}</span>.
              <br />
              Choisissez qui le remplace :
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remplaçant</label>
            <select
              value={replacementPromptSelectedId ?? ''}
              onChange={(e) => setReplacementPromptSelectedId(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-4"
            >
              {replacementPrompt.options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  ({opt.anciennete}) {opt.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setReplacementPrompt(null); setReplacementPromptSelectedId(null); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Ne pas affecter
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (replacementPromptSelectedId) {
                    await assignWorker(currentPlan.id, replacementPromptSelectedId, replacementPrompt.postId);
                    await fetchAssignments(currentPlan.id);
                  }
                  setReplacementPrompt(null);
                  setReplacementPromptSelectedId(null);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Affecter le remplaçant
              </button>
            </div>
          </div>
        </div>
      )}

      {autoAssignReplacementPrompt && currentPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAutoAssignReplacementPrompt(null)}>
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Remplaçants disponibles</h3>
            <p className="text-sm text-gray-700 mb-4">
              L&apos;assignement automatique a affecté chaque travailleur à son poste d&apos;origine. Certains postes
              n&apos;ont plus de travailleurs présents (tous absents) mais ont des remplaçants définis dans le booking.
              Souhaitez-vous assigner ces remplaçants aux postes concernés ?
            </p>
            <ul className="text-sm text-gray-600 mb-4 list-disc list-inside space-y-1">
              {autoAssignReplacementPrompt.items.map(({ postId, postName, workerIds }) => (
                <li key={postId}>
                  <span className="font-medium">{postName}</span>
                  {' '}({workerIds.length} remplaçant{workerIds.length > 1 ? 's' : ''})
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAutoAssignReplacementPrompt(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Ne pas assigner
              </button>
              <button
                type="button"
                onClick={async () => {
                  for (const { postId, workerIds } of autoAssignReplacementPrompt.items) {
                    for (const workerId of workerIds) {
                      await assignWorker(currentPlan.id, workerId, postId);
                    }
                  }
                  await fetchAssignments(currentPlan.id);
                  setAutoAssignReplacementPrompt(null);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Assigner les remplaçants
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
