import { useEffect, useState } from 'react';
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
import CreateWorkerModal from '../components/CreateWorkerModal';
import CreatePostModal from '../components/CreatePostModal';
import PlanManagementModal from '../components/PlanManagementModal';
import { io } from 'socket.io-client';

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
      className={`bg-white rounded-lg p-3 border-2 min-h-[120px] ${
        isOver ? 'bg-blue-50 border-blue-400' : ''
      }`}
      style={{
        borderLeftColor: WorkerTypeColors[primaryType],
        borderLeftWidth: '5px',
      }}
    >
      <h3
        className="font-bold text-sm mb-2"
        style={{ color: WorkerTypeColors[primaryType] }}
      >
        {groupName} ({groupWorkers.length})
      </h3>
      <SortableContext
        items={groupWorkers.map((w) => `${PRESENCE_DRAG_PREFIX}${w.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid grid-cols-4 gap-1.5 min-h-[60px]">
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
            <p className="text-xs text-gray-400 italic text-center py-2 col-span-3">
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
            Auto
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Post Columns */}
          {posts.map((post) => (
            <PostColumn
              key={post.id}
              post={post}
              workers={getWorkersForPost(post.id)}
            />
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
    updateWorkerPresence,
    updateWorkerType,
  } = useStore();

  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage
  const [isResizing, setIsResizing] = useState(false);
  const [presenceSearchFilter, setPresenceSearchFilter] = useState('');

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

    // Check if dropping on a presence type box (change worker type or presence)
    if (overId.startsWith('presence-')) {
      const droppedType = overId.replace('presence-', '') as WorkerType;
      if (Object.values(WorkerType).includes(droppedType)) {
        const currentPresenceType = presenceMap[workerId] ?? workers.find((w) => w.id === workerId)?.type;
        if (currentPresenceType === droppedType) return;

        const isOriginType = ORIGIN_TYPES.includes(droppedType);
        if (isOriginType) {
          // Within the 6 origin types: update Worker.type (origin) permanently and presence for this plan
          await updateWorkerType(workerId, droppedType);
          await updateWorkerPresence(currentPlan.id, workerId, droppedType);
        } else {
          // Outside the 6: update presence for this plan only (new plan will show worker as original type)
          await updateWorkerPresence(currentPlan.id, workerId, droppedType);
        }
      }
      return;
    }

    // Check if dropping on a post
    const post = posts.find((p) => p.id === overId);
    if (post) {
      // Assign worker to post (worker stays in their presence box)
      await assignWorker(currentPlan.id, workerId, post.id);
      return;
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

  // All workers are shown, using their presence type or default type
  const allWorkersForDisplay = workers;

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
    for (const w of visibleWorkers) {
      await assignWorker(currentPlan.id, w.id, w.originalPostId);
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
            <button
              onClick={() => setShowPlanModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {currentPlan ? 'Gérer les Plans' : 'Créer un Plan'}
            </button>
            <button
              onClick={() => setShowWorkerModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Créer Travailleur
            </button>
            <button
              onClick={() => setShowPostModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Créer Poste
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
                workers={allWorkersForDisplay}
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
                <div className="font-semibold text-gray-900">{activeWorker.name}</div>
                <div className="text-gray-600 text-[10px] mt-0.5">
                  {activeWorker.originalPost?.name ?? '-'} ({activeWorker.anciennete})
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
      {showWorkerModal && (
        <CreateWorkerModal
          onClose={() => setShowWorkerModal(false)}
          posts={posts}
        />
      )}

      {showPostModal && (
        <CreatePostModal onClose={() => setShowPostModal(false)} />
      )}

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
