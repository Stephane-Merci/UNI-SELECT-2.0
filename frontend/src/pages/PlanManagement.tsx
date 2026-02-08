import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { Worker, Post, WorkerType, WorkerTypeColors, ORIGIN_TYPES } from '../types';
import PostColumn from '../components/PostColumn';
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

// Posts Panel Component (Left Side) - Only posts, no unassigned.
// Workers in attendance/absence (Absent, Vacances, etc.) are not shown on posts.
function PostsPanel({ 
  posts, 
  workers,
  assignments, 
  presences,
  attendancePresenceTypes,
}: { 
  posts: Post[];
  workers: Worker[];
  assignments: Record<string, string>; // workerId -> postId
  presences: Record<string, WorkerType>;
  attendancePresenceTypes: Set<WorkerType>;
}) {
  const getWorkersForPost = (postId: string) => {
    return workers.filter((worker) => {
      if (assignments[worker.id] !== postId) return false;
      const pt = presences[worker.id] ?? worker.type;
      return !attendancePresenceTypes.has(pt);
    });
  };

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Postes</h2>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {/* Post Columns — fixed width so they pack first row, then wrap */}
          {posts.map((post) => (
            <div key={post.id} className="w-[130px] flex-shrink-0">
              <PostColumn
                post={post}
                workers={getWorkersForPost(post.id)}
              />
            </div>
          ))}
        </div>
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
  } = useStore();

  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage
  const [isResizing, setIsResizing] = useState(false);
  const [presenceSearchFilter, setPresenceSearchFilter] = useState('');
  const [lastPlanAction, setLastPlanAction] = useState<{
    workerId: string;
    previousPostId: string | null;
    previousPresenceType: WorkerType;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
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

    const workerId = getWorkerIdFromDragId(String(active.id));
    if (!workerId) return;
    const overId = String(over.id);

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
      return;
    }

    // Check if dropping on a post
    const post = posts.find((p) => p.id === overId);
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

    // Replacements: if a post has all its workers absent, assign replacement workers to that post instead of their own
    const replacementWorkerToPost: Record<string, string> = {};
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
            const ids = [r.replacement1WorkerId, r.replacement2WorkerId, r.replacement3WorkerId].filter(
              (id): id is string => !!id
            );
            ids.forEach((workerId) => {
              replacementWorkerToPost[workerId] = postId;
            });
          }
        }
      }
    } catch {
      // ignore: proceed with normal auto-assign without replacement overrides
    }

    for (const w of toAssign) {
      const targetPostId = replacementWorkerToPost[w.id] ?? w.originalPostId;
      await assignWorker(currentPlan.id, w.id, targetPostId);
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
          collisionDetection={closestCenter}
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
                posts={posts}
                workers={allWorkersForDisplay}
                assignments={assignmentMap}
                presences={presenceMap}
                attendancePresenceTypes={ATTENDANCE_PRESENCE_TYPES}
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
    </div>
  );
}
