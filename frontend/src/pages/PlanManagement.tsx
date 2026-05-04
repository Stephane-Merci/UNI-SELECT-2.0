import { useEffect, useState, useMemo } from 'react';
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
import { useAuthStore } from '../store/useAuthStore';
import { useAutoScrollDuringDrag } from '../hooks/useAutoScrollDuringDrag';
import { Worker, Post, WorkerType, WorkerTypeLabels, WorkerTypeColors, WORKER_TYPES_JOUR, WORKER_TYPES_SOIR, ORIGIN_TYPES } from '../types';
import PostColumn, { POST_COLUMN_DRAG_PREFIX } from '../components/PostColumn';
import WorkerCard, { getWorkerIdFromDragId, PRESENCE_DRAG_PREFIX } from '../components/WorkerCard';
import PlanManagementModal from '../components/PlanManagementModal';
import { io } from 'socket.io-client';
import apiClient from '../api/client';
import type { Booking, BookingReplacement } from '../types';
import { formatLocalDate, getUTCDayOfWeek, normalizeToUTC } from '../utils/dateUtils';

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
  'Congé parental': [WorkerType.CONGE_PARENTAL],
  'Préretraite': [WorkerType.PRERETRAITE],
  'Travail léger': [WorkerType.TRAVAIL_LEGER],
  Formation: [WorkerType.FORMATION],
};
const ATTENDANCE_PRESENCE_TYPES = new Set([
  WorkerType.ABSENT,
  WorkerType.VACANCES,
  WorkerType.LIBERATION_EXTERNE,
  WorkerType.INVALIDITE,
  WorkerType.CONGE_PARENTAL,
  // Travail léger and Formation are NOT in this set because they can be assigned to posts.
  // Pré-retraite is normally handled by date logic, but usually they are not assignable.
  WorkerType.PRERETRAITE
]);

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
      className={`rounded-lg p-2 min-h-0 ${isOver ? 'bg-blue-50 border-blue-400' : ''
        }`}
      style={{
        backgroundColor: '#f3f4f6', 
        borderColor: WorkerTypeColors[primaryType],
        borderWidth: '2px',
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
  unfilledPositions,
  onAddUnfilled,
  onDeleteUnfilled,
  isLocked,
  onLockToggle,
}: {
  post: Post;
  workers: Worker[];
  unfilledPositions: any[];
  onAddUnfilled: () => void;
  onDeleteUnfilled: (id: string) => void;
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

  const wrapperClass = isLocked
    ? 'w-[130px] flex-shrink-0'
    : 'min-w-[130px] flex-1 basis-[130px]';

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
        unfilledPositions={unfilledPositions}
        onAddUnfilled={onAddUnfilled}
        onDeleteUnfilled={onDeleteUnfilled}
        isLocked={isLocked}
        onLockToggle={onLockToggle}
        wrapperClassName={wrapperClass}
        dragHandleProps={isLocked ? undefined : { attributes: attributes as unknown as Record<string, unknown>, listeners: (listeners ?? {}) as unknown as Record<string, unknown> }}
      />
    </div>
  );
}

function PostsPanel({
  posts,
  workers,
  assignments,
  presences,
  attendancePresenceTypes,
  lockedPostIds,
  onPostLockToggle,
  unfilledPositions,
  onAddUnfilled,
  onDeleteUnfilled,
  shiftFilter,
  onShiftFilterChange,
  isFullScreen,
  onToggleFullScreen,
  stats,
}: {
  posts: Post[];
  workers: Worker[];
  assignments: Record<string, string>;
  presences: Record<string, WorkerType>;
  attendancePresenceTypes: Set<WorkerType>;
  lockedPostIds: Set<string>;
  onPostLockToggle: (postId: string) => void;
  unfilledPositions: any[];
  onAddUnfilled: (postId: string) => void;
  onDeleteUnfilled: (id: string) => void;
  shiftFilter: 'jour' | 'soir' | 'tous';
  onShiftFilterChange: (s: 'jour' | 'soir' | 'tous') => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  stats: { pic: number; met: number; others: number; total: number };
}) {
  const getWorkersForPost = (postId: string) => {
    return workers
      .filter((worker) => {
        if (assignments[worker.id] !== postId) return false;
        const pt = presences[worker.id] ?? worker.type;
        
        if (shiftFilter === 'jour' && !WORKER_TYPES_JOUR.includes(pt)) return false;
        if (shiftFilter === 'soir' && !WORKER_TYPES_SOIR.includes(pt)) return false;

        return !attendancePresenceTypes.has(pt);
      })
      .sort((a, b) => a.anciennete.localeCompare(b.anciennete, 'fr', { numeric: true }));
  };

  const getUnfilledForPost = (postId: string) => {
    return unfilledPositions.filter((up) => up.postId === postId);
  };

  const sortablePostIds = posts
    .filter((p) => !lockedPostIds.has(p.id))
    .map((p) => `${POST_COLUMN_DRAG_PREFIX}${p.id}`);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-gray-800">Postes</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => onShiftFilterChange('jour')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${shiftFilter === 'jour' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Jour
            </button>
            <button
              onClick={() => onShiftFilterChange('soir')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${shiftFilter === 'soir' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Soir
            </button>
            <button
              onClick={() => onShiftFilterChange('tous')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${shiftFilter === 'tous' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Tous
            </button>
          </div>
          {isFullScreen && (
            <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100 shadow-inner shrink-0">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PIC</span>
                <span className="text-sm font-black text-blue-600 leading-none">{stats.pic}</span>
              </div>
              <div className="h-4 w-px bg-gray-200"></div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">MET</span>
                <span className="text-sm font-black text-emerald-600 leading-none">{stats.met}</span>
              </div>
              <div className="h-4 w-px bg-gray-200"></div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Autres</span>
                <span className="text-sm font-black text-slate-600 leading-none">{stats.others}</span>
              </div>
              <div className="h-4 w-px bg-gray-300"></div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Total</span>
                <span className="text-base font-black text-indigo-700 leading-none">{stats.total}</span>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleFullScreen}
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
                unfilledPositions={getUnfilledForPost(post.id)}
                onAddUnfilled={() => onAddUnfilled(post.id)}
                onDeleteUnfilled={onDeleteUnfilled}
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
  const REPLACEMENT_DEBUG = true;
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
    getPlanPostOrder,
    setPlanPostOrder,
    getPlanLockedPosts,
    togglePlanPostLock,
    planLayoutVersion,
    addUnfilledPosition,
    deleteUnfilledPosition,
    updateWorkerType,
    isFullScreen,
    setFullScreen,
  } = useStore();

  const orderedPosts = useMemo(() => {
    let base = currentPlan && posts.length > 0
      ? getPlanPostOrder(currentPlan.id, posts.map((p) => p.id))
        .map((id) => posts.find((p) => p.id === id))
        .filter((p): p is Post => !!p)
      : posts;
    
    return [...base].sort((a, b) => {
      const isSpecialA = a.name.toLowerCase().includes('mobile') || a.name.toLowerCase().includes('occasionel');
      const isSpecialB = b.name.toLowerCase().includes('mobile') || b.name.toLowerCase().includes('occasionel');
      if (isSpecialA && !isSpecialB) return 1;
      if (!isSpecialA && isSpecialB) return -1;
      return 0;
    });
  }, [currentPlan, posts, getPlanPostOrder]);
  const lockedPostIds = currentPlan ? getPlanLockedPosts(currentPlan.id) : new Set<string>();
  void planLayoutVersion[currentPlan ? 'global' : ''];

  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizeLocked, setIsResizeLocked] = useState(false);
  const [presenceSearchFilter, setPresenceSearchFilter] = useState('');
  const [replacementPrompt, setReplacementPrompt] = useState<{
    postId: string;
    postName: string;
    workerName: string;
    workerAnciennete: string;
    shift: 'jour' | 'soir';
    options: {
      id: string;
      name: string;
      anciennete: string;
      currentPostId?: string;
      isAbsentZone?: boolean;
      isPreRetraiteToday?: boolean;
      assignedElsewhere?: boolean;
      leavesReplacementPost?: boolean;
      assignedPostName?: string | null;
    }[];
  } | null>(null);
  const [replacementPromptSelectedId, setReplacementPromptSelectedId] = useState<string | null>(null);
  const [autoAssignReplacementPrompt, setAutoAssignReplacementPrompt] = useState<{
    items: {
      postId: string;
      postName: string;
      shift: 'jour' | 'soir';
      options: {
        id: string;
        name: string;
        anciennete: string;
        isAbsentZone?: boolean;
        isPreRetraiteToday?: boolean;
        assignedElsewhere?: boolean;
        leavesReplacementPost?: boolean;
        assignedPostName?: string | null;
      }[];
      selectedId: string | null;
    }[];
  } | null>(null);
  const [lastPlanAction, setLastPlanAction] = useState<{
    workerId: string;
    previousPostId: string | null;
    previousPresenceType: WorkerType;
  } | null>(null);
  const [preRetraiteInfo, setPreRetraiteInfo] = useState<string[] | null>(null);
  const [preRetraiteAppliedPlanId, setPreRetraiteAppliedPlanId] = useState<string | null>(null);
  const [absencesAppliedPlanId, setAbsencesAppliedPlanId] = useState<string | null>(null);

  const [returningWorkerPrompt, setReturningWorkerPrompt] = useState<{
    worker: Worker;
    newType: WorkerType;
    newEndDate: string;
  } | null>(null);

  const [shiftFilter, setShiftFilter] = useState<'jour' | 'soir' | 'tous'>('tous');
  const [showMachineryPopup, setShowMachineryPopup] = useState(false);
  const { user } = useAuthStore();

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

      const planDate = normalizeToUTC(currentPlan.date) || normalizeToUTC(new Date());
      if (!planDate) return;

      const expWork = workers.find((w) => {
        if (!w.absenceEndDate) return false;
        const endDate = normalizeToUTC(w.absenceEndDate);
        return endDate && endDate <= planDate;
      });

      if (expWork && !returningWorkerPrompt) {
        setReturningWorkerPrompt({
          worker: expWork,
          newType: ORIGIN_TYPES.includes(expWork.type) ? expWork.type : WorkerType.PERMANENT_JOUR,
          newEndDate: '',
        });
      }
    }
  }, [currentPlan, fetchAssignments, workers, returningWorkerPrompt]);

  useEffect(() => {
    const applyPreRetraiteForPlan = async () => {
      if (!currentPlan?.id || !currentPlan.date) return;
      if (preRetraiteAppliedPlanId === currentPlan.id) return;

      setPreRetraiteAppliedPlanId(currentPlan.id);

      const weekday = getUTCDayOfWeek(currentPlan.date);
      const weekdayKey =
        weekday === 1
          ? 'MONDAY'
          : weekday === 2
            ? 'TUESDAY'
            : weekday === 3
              ? 'WEDNESDAY'
              : weekday === 4
                ? 'THURSDAY'
                : weekday === 5
                  ? 'FRIDAY'
                  : null;

      if (!weekdayKey) return;

      const affected = workers.filter((w) => w.preRetraiteDay === weekdayKey);
      if (affected.length === 0) return;

      for (const w of affected) {
        await updateWorkerPresence(currentPlan.id, w.id, WorkerType.PRERETRAITE);
        const existingAssignment = assignments.find(
          (a) => a.workerId === w.id && a.planId === currentPlan.id
        );
        if (existingAssignment) {
          await removeAssignment(existingAssignment.id);
        }
      }

      setPreRetraiteInfo(
        affected.map((w) => `(${w.anciennete}) ${w.name}`)
      );
    };

    void applyPreRetraiteForPlan();
  }, [currentPlan, workers, updateWorkerPresence, removeAssignment, assignments, preRetraiteAppliedPlanId]);

  useEffect(() => {
    const applyScheduledAbsencesForPlan = async () => {
      if (!currentPlan?.id || !currentPlan.date) return;
      if (absencesAppliedPlanId === currentPlan.id) return;

      setAbsencesAppliedPlanId(currentPlan.id);

      const planDate = normalizeToUTC(currentPlan.date);
      if (!planDate) return;

      const ABSENCE_TYPES = [
        WorkerType.ABSENT,
        WorkerType.VACANCES,
        WorkerType.LIBERATION_EXTERNE,
        WorkerType.INVALIDITE,
        WorkerType.CONGE_PARENTAL,
        WorkerType.TRAVAIL_LEGER,
        WorkerType.FORMATION,
      ];

      const affected = workers.filter((w) => {
        // Only consider workers who have an absence type as their current global type
        if (!ABSENCE_TYPES.includes(w.type)) return false;
        if (!w.absenceStartDate || !w.absenceEndDate) return false;
        
        const start = normalizeToUTC(w.absenceStartDate);
        const end = normalizeToUTC(w.absenceEndDate);
        
        // If the plan date is within the absence range
        return start && end && planDate >= start && planDate <= end;
      });

      if (affected.length === 0) return;

      for (const w of affected) {
        // If not already marked as this type in the plan, update it
        const currentPresence = currentPlan.workerPresences?.find(p => p.workerId === w.id);
        if (currentPresence?.type !== w.type) {
          await updateWorkerPresence(currentPlan.id, w.id, w.type);
          const existingAssignment = assignments.find(
            (a) => a.workerId === w.id && a.planId === currentPlan.id
          );
          if (existingAssignment) {
            await removeAssignment(existingAssignment.id);
          }
        }
      }
    };

    void applyScheduledAbsencesForPlan();
  }, [currentPlan, workers, updateWorkerPresence, removeAssignment, assignments, absencesAppliedPlanId]);

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

    socket.on('unfilled-position-added', () => {
      if (currentPlan) {
        loadPlan(currentPlan.id);
      }
    });

    socket.on('unfilled-position-deleted', () => {
      if (currentPlan) {
        loadPlan(currentPlan.id);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentPlan, fetchAssignments, fetchPlans, loadPlan]);

  const presenceMap: Record<string, WorkerType> = {};
  const planDate = currentPlan?.date ? normalizeToUTC(currentPlan.date) : null;
  const ABSENCE_TYPES = [
    WorkerType.ABSENT,
    WorkerType.VACANCES,
    WorkerType.LIBERATION_EXTERNE,
    WorkerType.INVALIDITE,
    WorkerType.CONGE_PARENTAL,
    WorkerType.TRAVAIL_LEGER,
    WorkerType.FORMATION,
  ];

  workers.forEach((worker) => {
    let type = worker.type;
    // If worker is globally marked as absent, check if it applies to the current plan date
    if (ABSENCE_TYPES.includes(worker.type) && planDate) {
      const start = worker.absenceStartDate ? normalizeToUTC(worker.absenceStartDate) : null;
      const end = worker.absenceEndDate ? normalizeToUTC(worker.absenceEndDate) : null;
      const inRange = start && end && planDate >= start && planDate <= end;
      
      // If NOT in range, use originType (if available) to show them as active
      if (!inRange && worker.originType) {
        type = worker.originType;
      }
    }
    presenceMap[worker.id] = type;
  });

  // Override with plan-specific presences (including those automatically applied)
  workerPresences.forEach((presence) => {
    presenceMap[presence.workerId] = presence.type;
  });

  const assignmentMap: Record<string, string> = {};
  assignments
    .filter((a) => a.planId === currentPlan?.id)
    .forEach((assignment) => {
      assignmentMap[assignment.workerId] = assignment.postId;
    });

  const stats = useMemo(() => {
    if (!currentPlan) return { pic: 0, met: 0, others: 0, total: 0 };
    
    let pic = 0;
    let met = 0;
    let others = 0;

    const activeAssignments = assignments.filter(a => a.planId === currentPlan.id);
    
    activeAssignments.forEach(a => {
      const worker = workers.find(w => w.id === a.workerId);
      if (!worker) return;

      const pt = presenceMap[worker.id] ?? worker.type;
      
      // Respect shift filter
      if (shiftFilter === 'jour' && !WORKER_TYPES_JOUR.includes(pt)) return;
      if (shiftFilter === 'soir' && !WORKER_TYPES_SOIR.includes(pt)) return;
      if (ATTENDANCE_PRESENCE_TYPES.has(pt)) return;

      const post = posts.find(p => p.id === a.postId);
      if (!post) return;

      const name = post.name.toUpperCase();
      if (name.includes('PIC')) pic++;
      else if (name.includes('MET')) met++;
      else others++;
    });

    return { pic, met, others, total: pic + met + others };
  }, [currentPlan, assignments, workers, presenceMap, shiftFilter, posts, ATTENDANCE_PRESENCE_TYPES]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const workerId = getWorkerIdFromDragId(String(active.id));
    const worker = workerId ? workers.find((w) => w.id === workerId) ?? null : null;
    setActiveWorker(worker);
  };

  const checkAndPromptReplacement = async (worker: Worker, previousPostId: string, movedWorkerId: string) => {
    if (REPLACEMENT_DEBUG) {
      console.groupCollapsed('[ReplacementDebug] checkAndPromptReplacement:start');
      console.log('worker', { id: worker.id, name: worker.name, type: worker.type, anciennete: worker.anciennete });
      console.log('previousPostId', previousPostId);
      console.log('movedWorkerId', movedWorkerId);
      console.log('currentPlan', currentPlan ? { id: currentPlan.id, date: currentPlan.date, name: currentPlan.name } : null);
      console.groupEnd();
    }
    const workerShift: 'jour' | 'soir' | null = WORKER_TYPES_JOUR.includes(worker.type)
      ? 'jour'
      : WORKER_TYPES_SOIR.includes(worker.type)
        ? 'soir'
        : null;
    if (!workerShift) {
      if (REPLACEMENT_DEBUG) console.log('[ReplacementDebug] stop: worker has no jour/soir shift', worker.id);
      return;
    }

    const currentAssignments = useStore.getState().assignments.filter(a => a.planId === currentPlan?.id);
    const currentAssignmentMap: Record<string, string> = {};
    currentAssignments.forEach(a => { currentAssignmentMap[a.workerId] = a.postId; });

    const workersStillOnPost = workers.filter(
      (w) => w.id !== movedWorkerId && currentAssignmentMap[w.id] === previousPostId
    );
    const activeSameShiftStillOnPost = workersStillOnPost.filter((w) => {
      const presence = presenceMap[w.id] || w.type;
      const isActive = !ATTENDANCE_PRESENCE_TYPES.has(presence);
      return isActive && (
        workerShift === 'jour'
          ? WORKER_TYPES_JOUR.includes(w.type)
          : WORKER_TYPES_SOIR.includes(w.type)
      );
    });

    if (REPLACEMENT_DEBUG) {
      console.groupCollapsed('[ReplacementDebug] checkAndPromptReplacement:post-state');
      console.log('workerShift', workerShift);
      console.log('workersStillOnPost', workersStillOnPost.map((w) => ({ id: w.id, name: w.name, type: w.type })));
      console.log('activeSameShiftStillOnPostCount', activeSameShiftStillOnPost.length);
      console.groupEnd();
    }

    if (activeSameShiftStillOnPost.length === 0) {
      try {
        const bookingsRes = await apiClient.get<Booking[]>('/bookings');
        const bookingsList = bookingsRes.data ?? [];
        const planDate = currentPlan?.date ? normalizeToUTC(currentPlan.date) : null;
        const isSameUtcDay = (a: Date | null, b: Date | null) =>
          !!a &&
          !!b &&
          a.getUTCFullYear() === b.getUTCFullYear() &&
          a.getUTCMonth() === b.getUTCMonth() &&
          a.getUTCDate() === b.getUTCDate();
        const activeBooking = bookingsList.find((b: any) => (b as any).isActive);
        const dateMatchedBooking = planDate
          ? bookingsList.find((b) => isSameUtcDay(normalizeToUTC(b.effectiveDate), planDate))
          : undefined;
        const chosenBooking = activeBooking ?? dateMatchedBooking ?? bookingsList[0];
        if (REPLACEMENT_DEBUG) {
          console.groupCollapsed('[ReplacementDebug] checkAndPromptReplacement:booking-selection');
          console.log('planDate(UTC)', planDate?.toISOString() ?? null);
          console.log('bookingsCount', bookingsList.length);
          console.log('bookingsSummary', bookingsList.map((b: any) => ({ id: b.id, effectiveDate: b.effectiveDate, isActive: (b as any).isActive ?? false, name: b.name })));
          console.log('activeBooking', activeBooking ? { id: activeBooking.id, effectiveDate: activeBooking.effectiveDate, name: activeBooking.name } : null);
          console.log('dateMatchedBooking', dateMatchedBooking ? { id: dateMatchedBooking.id, effectiveDate: dateMatchedBooking.effectiveDate, name: dateMatchedBooking.name } : null);
          console.log('chosenBooking', chosenBooking ? { id: chosenBooking.id, effectiveDate: chosenBooking.effectiveDate, name: chosenBooking.name } : null);
          console.groupEnd();
        }
        if (chosenBooking) {
          let replList: BookingReplacement[] = [];
          try {
            const replRes = await apiClient.get<BookingReplacement[]>(`/bookings/${chosenBooking.id}/replacements`);
            replList = replRes.data ?? [];
          } catch (primaryReplError) {
            // Fallback: in production, date-based booking matching can be stale; retry using active booking
            console.warn('Replacement fetch failed for matched booking, trying active booking fallback', primaryReplError);
            const activeBooking = bookingsList.find((b: any) => (b as any).isActive);
            if (activeBooking && activeBooking.id !== chosenBooking.id) {
              const fallbackRes = await apiClient.get<BookingReplacement[]>(`/bookings/${activeBooking.id}/replacements`);
              replList = fallbackRes.data ?? [];
            } else {
              throw primaryReplError;
            }
          }
          const row = replList.find((r) => r.postId === previousPostId);
          if (REPLACEMENT_DEBUG) {
            console.groupCollapsed('[ReplacementDebug] checkAndPromptReplacement:replacement-row');
            console.log('replListCount', replList.length);
            console.log('previousPostId', previousPostId);
            console.log('rowFound', !!row);
            if (row) {
              console.log('row', {
                postId: row.postId,
                jour: [row.replacement1WorkerId, row.replacement2WorkerId, row.replacement3WorkerId, row.replacement4WorkerId],
                soir: [row.replacement5WorkerId, row.replacement6WorkerId, row.replacement7WorkerId, row.replacement8WorkerId],
              });
            }
            console.groupEnd();
          }
          if (row) {
            const ids =
              workerShift === 'jour'
                ? [row.replacement1WorkerId, row.replacement2WorkerId, row.replacement3WorkerId, row.replacement4WorkerId]
                : [row.replacement5WorkerId, row.replacement6WorkerId, row.replacement7WorkerId, row.replacement8WorkerId];
            const optionIds = (ids.filter((id): id is string => !!id) as string[]).filter(Boolean);

            const planDateStr = currentPlan?.date ? formatLocalDate(currentPlan.date, 'en-US', { weekday: 'long' }).toUpperCase() : '';

            const options = optionIds
              .map((id) => {
                const w = workers.find((work) => work.id === id);
                if (!w) return null;

                const presence = presenceMap[w.id] || w.type;
                const isAbsentZone = [
                  WorkerType.ABSENT, WorkerType.VACANCES, WorkerType.INVALIDITE,
                  WorkerType.PRERETRAITE, WorkerType.CONGE_PARENTAL, WorkerType.LIBERATION_EXTERNE
                ].includes(presence);

                const isPreRetraiteToday = w.preRetraiteDay === planDateStr;
                const assignedPostId = currentAssignmentMap[w.id];

                let leavesReplacementPost = false;
                if (assignedPostId) {
                  const wShift: 'jour' | 'soir' | null = WORKER_TYPES_JOUR.includes(w.type) ? 'jour' : WORKER_TYPES_SOIR.includes(w.type) ? 'soir' : null;
                  if (wShift) {
                    const othersOnPost = workers.filter(other => other.id !== w.id && currentAssignmentMap[other.id] === assignedPostId);
                    const activeShiftOthers = othersOnPost.filter(o => {
                      const p = presenceMap[o.id] || o.type;
                      return !ATTENDANCE_PRESENCE_TYPES.has(p) && (wShift === 'jour' ? WORKER_TYPES_JOUR.includes(o.type) : WORKER_TYPES_SOIR.includes(o.type));
                    });
                    if (activeShiftOthers.length === 0) {
                      leavesReplacementPost = replList.some(r => r.postId === assignedPostId && (wShift === 'jour' ? !!(r.replacement1WorkerId || r.replacement2WorkerId || r.replacement3WorkerId || r.replacement4WorkerId) : !!(r.replacement5WorkerId || r.replacement6WorkerId || r.replacement7WorkerId || r.replacement8WorkerId)));
                    }
                  }
                }

                const assignedElsewhere = !!assignedPostId && assignedPostId !== previousPostId;

                return {
                  id: w.id,
                  name: w.name,
                  anciennete: w.anciennete,
                  isAbsentZone,
                  isPreRetraiteToday,
                  assignedElsewhere,
                  leavesReplacementPost,
                  assignedPostName: assignedElsewhere ? posts.find(p => p.id === assignedPostId)?.name : null
                };
              })
              .filter((opt): opt is NonNullable<typeof opt> => !!opt);

            if (REPLACEMENT_DEBUG) {
              console.groupCollapsed('[ReplacementDebug] checkAndPromptReplacement:options');
              console.log('optionIdsRaw', optionIds);
              console.log('optionsCount', options.length);
              console.log('options', options.map((o) => ({
                id: o.id,
                name: o.name,
                isAbsentZone: o.isAbsentZone,
                isPreRetraiteToday: o.isPreRetraiteToday,
                assignedElsewhere: o.assignedElsewhere,
                leavesReplacementPost: o.leavesReplacementPost,
                assignedPostName: o.assignedPostName ?? null,
              })));
              console.groupEnd();
            }

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
              setReplacementPromptSelectedId(options.find(o => !o.assignedElsewhere && !o.isAbsentZone && !o.isPreRetraiteToday && !o.leavesReplacementPost)?.id ?? options[0]?.id ?? null);
              if (REPLACEMENT_DEBUG) console.log('[ReplacementDebug] popup opened (checkAndPromptReplacement)', { postId: previousPostId, workerId: worker.id, optionsCount: options.length });
            } else if (REPLACEMENT_DEBUG) {
              console.log('[ReplacementDebug] no popup: options empty after filtering');
            }
          }
        }
      } catch (e) {
        console.error('Replacement check failed:', e);
      }
    } else if (REPLACEMENT_DEBUG) {
      console.log('[ReplacementDebug] no popup: post still has active same-shift worker(s)', { count: activeSameShiftStillOnPost.length });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!user?.canEdit) return;
    const { active, over } = event;
    setActiveWorker(null);

    if (!over || !currentPlan) return;

    const activeId = String(active.id);
    const overId = String(over.id);

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
    if (overId.startsWith('presence-')) {
      setLastPlanAction({ workerId, previousPostId, previousPresenceType });
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
          void updateWorkerPresence(currentPlan.id, workerId, droppedType);
        }
      }

      if (previousPostId && worker) {
        await checkAndPromptReplacement(worker, previousPostId, workerId);
      }
      return;
    }

    const postIdForDrop = overId.startsWith(POST_COLUMN_DRAG_PREFIX) ? overId.slice(POST_COLUMN_DRAG_PREFIX.length) : overId;
    const post = posts.find((p) => p.id === postIdForDrop);
    if (post) {
      setLastPlanAction({ workerId, previousPostId, previousPresenceType });
      if (worker) {
        void updateWorkerPresence(currentPlan.id, workerId, worker.type);
      }
      void assignWorker(currentPlan.id, workerId, post.id);

      if (previousPostId && worker) {
        await checkAndPromptReplacement(worker, previousPostId, workerId);
      }
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
    if (isResizeLocked) return;
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

  const allWorkersForDisplay = workers;
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
    // Auto-assign excludes occasionnels (jour/soir) by requirement.
    const toAssign = visibleWorkers.filter(
      (w) =>
        w.type !== WorkerType.OCCASIONEL_DU_JOUR &&
        w.type !== WorkerType.OCCASIONEL_SOIR
    );
    if (REPLACEMENT_DEBUG) {
      console.groupCollapsed('[ReplacementDebug] autoAssign:start');
      console.log('currentPlan', currentPlan ? { id: currentPlan.id, date: currentPlan.date, name: currentPlan.name } : null);
      console.log('visibleWorkersCount', visibleWorkers.length);
      console.log('toAssignCount', toAssign.length);
      console.groupEnd();
    }

    const freshAssignmentMap: Record<string, string> = { ...assignmentMap };
    for (const w of toAssign) {
      await assignWorker(currentPlan.id, w.id, w.originalPostId);
      freshAssignmentMap[w.id] = w.originalPostId;
    }

    try {
      const bookingsRes = await apiClient.get<Booking[]>('/bookings');
      const bookingsList = bookingsRes.data ?? [];
      const planDate = currentPlan.date ? normalizeToUTC(currentPlan.date) : null;
      const isSameUtcDay = (a: Date | null, b: Date | null) =>
        !!a &&
        !!b &&
        a.getUTCFullYear() === b.getUTCFullYear() &&
        a.getUTCMonth() === b.getUTCMonth() &&
        a.getUTCDate() === b.getUTCDate();
      const activeBooking = bookingsList.find((b: any) => (b as any).isActive);
      const dateMatchedBooking = planDate
        ? bookingsList.find((b) => isSameUtcDay(normalizeToUTC(b.effectiveDate), planDate))
        : undefined;
      const chosenBooking = activeBooking ?? dateMatchedBooking ?? bookingsList[0];
      if (REPLACEMENT_DEBUG) {
        console.groupCollapsed('[ReplacementDebug] autoAssign:booking-selection');
        console.log('planDate(UTC)', planDate?.toISOString() ?? null);
        console.log('bookingsCount', bookingsList.length);
        console.log('bookingsSummary', bookingsList.map((b: any) => ({ id: b.id, effectiveDate: b.effectiveDate, isActive: (b as any).isActive ?? false, name: b.name })));
        console.log('activeBooking', activeBooking ? { id: activeBooking.id, effectiveDate: activeBooking.effectiveDate, name: activeBooking.name } : null);
        console.log('dateMatchedBooking', dateMatchedBooking ? { id: dateMatchedBooking.id, effectiveDate: dateMatchedBooking.effectiveDate, name: dateMatchedBooking.name } : null);
        console.log('chosenBooking', chosenBooking ? { id: chosenBooking.id, effectiveDate: chosenBooking.effectiveDate, name: chosenBooking.name } : null);
        console.groupEnd();
      }
      if (chosenBooking) {
        let replList: BookingReplacement[] = [];
        try {
          const replRes = await apiClient.get<BookingReplacement[]>(`/bookings/${chosenBooking.id}/replacements`);
          replList = replRes.data ?? [];
        } catch (primaryReplError) {
          console.warn('Auto-assign replacement fetch failed for matched booking, trying active booking fallback', primaryReplError);
          const activeBooking = bookingsList.find((b: any) => (b as any).isActive);
          if (activeBooking && activeBooking.id !== chosenBooking.id) {
            const fallbackRes = await apiClient.get<BookingReplacement[]>(`/bookings/${activeBooking.id}/replacements`);
            replList = fallbackRes.data ?? [];
          } else {
            throw primaryReplError;
          }
        }
        const items: any[] = [];
        if (REPLACEMENT_DEBUG) {
          console.groupCollapsed('[ReplacementDebug] autoAssign:replacement-list');
          console.log('replListCount', replList.length);
          console.log('replPostIds', replList.map((r) => r.postId));
          console.groupEnd();
        }
        for (const r of replList) {
          const postId = r.postId;
          const workersOnPost = workers.filter((w) => w.originalPostId === postId);
          const postName = posts.find((p) => p.id === postId)?.name ?? postId;

          const planDateStr = currentPlan.date ? formatLocalDate(currentPlan.date, 'en-US', { weekday: 'long' }).toUpperCase() : '';

          const jourWorkers = workersOnPost.filter((w) => WORKER_TYPES_JOUR.includes(w.type));
          const activeJourWorkers = jourWorkers.filter((w) => {
            const pt = presenceMap[w.id] ?? w.type;
            return !ATTENDANCE_PRESENCE_TYPES.has(pt);
          });

          if (jourWorkers.length > 0 && activeJourWorkers.length === 0) {
            const workerIds = [r.replacement1WorkerId, r.replacement2WorkerId, r.replacement3WorkerId, r.replacement4WorkerId].filter((id): id is string => !!id);
            const options = workerIds
              .map((id) => {
                const w = workers.find((work) => work.id === id);
                if (!w) return null;
                const presence = presenceMap[w.id] ?? w.type;
                const isAbsentZone = [
                  WorkerType.ABSENT, WorkerType.VACANCES, WorkerType.INVALIDITE,
                  WorkerType.PRERETRAITE, WorkerType.CONGE_PARENTAL, WorkerType.LIBERATION_EXTERNE
                ].includes(presence);
                const isPreRetraiteToday = w.preRetraiteDay === planDateStr;
                const assignedPostId = freshAssignmentMap[w.id];
                const assignedElsewhere = !!assignedPostId && assignedPostId !== postId;

                let leavesReplacementPost = false;
                if (assignedPostId) {
                  const othersOnPost = workers.filter(other => other.id !== w.id && freshAssignmentMap[other.id] === assignedPostId);
                  const activeShiftOthers = othersOnPost.filter(o => {
                    const p = presenceMap[o.id] || o.type;
                    return !ATTENDANCE_PRESENCE_TYPES.has(p) && WORKER_TYPES_JOUR.includes(o.type);
                  });
                  if (activeShiftOthers.length === 0) {
                    leavesReplacementPost = replList.some(r => r.postId === assignedPostId && !!(r.replacement1WorkerId || r.replacement2WorkerId || r.replacement3WorkerId || r.replacement4WorkerId));
                  }
                }

                return {
                  id: w.id, name: w.name, anciennete: w.anciennete,
                  isAbsentZone, isPreRetraiteToday, assignedElsewhere, leavesReplacementPost,
                  assignedPostName: assignedElsewhere ? posts.find(p => p.id === assignedPostId)?.name : null
                };
              })
              .filter((opt): opt is NonNullable<typeof opt> => !!opt);

            if (options.length > 0) {
              items.push({
                postId,
                postName,
                shift: 'jour',
                options,
                selectedId: options.find(o => !o.assignedElsewhere && !o.isAbsentZone && !o.isPreRetraiteToday && !o.leavesReplacementPost)?.id ?? options[0].id
              });
            }
            if (REPLACEMENT_DEBUG) {
              console.log('[ReplacementDebug] autoAssign:jour-eval', {
                postId,
                postName,
                jourWorkers: jourWorkers.length,
                activeJourWorkers: activeJourWorkers.length,
                optionsCount: options.length,
              });
            }
          }

          const soirWorkers = workersOnPost.filter((w) => WORKER_TYPES_SOIR.includes(w.type));
          const activeSoirWorkers = soirWorkers.filter((w) => {
            const pt = presenceMap[w.id] ?? w.type;
            return !ATTENDANCE_PRESENCE_TYPES.has(pt);
          });

          if (soirWorkers.length > 0 && activeSoirWorkers.length === 0) {
            const workerIds = [r.replacement5WorkerId, r.replacement6WorkerId, r.replacement7WorkerId, r.replacement8WorkerId].filter((id): id is string => !!id);
            const options = workerIds
              .map((id) => {
                const w = workers.find((work) => work.id === id);
                if (!w) return null;
                const presence = presenceMap[w.id] ?? w.type;
                const isAbsentZone = [
                  WorkerType.ABSENT, WorkerType.VACANCES, WorkerType.INVALIDITE,
                  WorkerType.PRERETRAITE, WorkerType.CONGE_PARENTAL, WorkerType.LIBERATION_EXTERNE
                ].includes(presence);
                const isPreRetraiteToday = w.preRetraiteDay === planDateStr;
                const assignedPostId = freshAssignmentMap[w.id];
                const assignedElsewhere = !!assignedPostId && assignedPostId !== postId;

                let leavesReplacementPost = false;
                if (assignedPostId) {
                  const othersOnPost = workers.filter(other => other.id !== w.id && freshAssignmentMap[other.id] === assignedPostId);
                  const activeShiftOthers = othersOnPost.filter(o => {
                    const p = presenceMap[o.id] || o.type;
                    return !ATTENDANCE_PRESENCE_TYPES.has(p) && WORKER_TYPES_SOIR.includes(o.type);
                  });
                  if (activeShiftOthers.length === 0) {
                    leavesReplacementPost = replList.some(r => r.postId === assignedPostId && !!(r.replacement5WorkerId || r.replacement6WorkerId || r.replacement7WorkerId || r.replacement8WorkerId));
                  }
                }

                return {
                  id: w.id, name: w.name, anciennete: w.anciennete,
                  isAbsentZone, isPreRetraiteToday, assignedElsewhere, leavesReplacementPost,
                  assignedPostName: assignedElsewhere ? posts.find(p => p.id === assignedPostId)?.name : null
                };
              })
              .filter((opt): opt is NonNullable<typeof opt> => !!opt);

            if (options.length > 0) {
              items.push({
                postId,
                postName,
                shift: 'soir',
                options,
                selectedId: options.find(o => !o.assignedElsewhere && !o.isAbsentZone && !o.isPreRetraiteToday && !o.leavesReplacementPost)?.id ?? options[0].id
              });
            }
            if (REPLACEMENT_DEBUG) {
              console.log('[ReplacementDebug] autoAssign:soir-eval', {
                postId,
                postName,
                soirWorkers: soirWorkers.length,
                activeSoirWorkers: activeSoirWorkers.length,
                optionsCount: options.length,
              });
            }
          }
        }
        if (items.length > 0) {
          setAutoAssignReplacementPrompt({ items });
          if (REPLACEMENT_DEBUG) console.log('[ReplacementDebug] popup opened (autoAssign)', { itemsCount: items.length, items: items.map((i) => ({ postId: i.postId, shift: i.shift, optionsCount: i.options.length })) });
        } else {
          if (REPLACEMENT_DEBUG) console.log('[ReplacementDebug] no popup (autoAssign): no qualifying replacement items');
          setShowMachineryPopup(true);
        }
      }
    } catch (error) {
      console.error('Auto-assign replacement popup failed:', error);
      setShowMachineryPopup(true);
    }
  };

  const closeAutoAssignReplacementPrompt = (showMachinery = false) => {
    setAutoAssignReplacementPrompt(null);
    if (showMachinery) {
      setShowMachineryPopup(true);
    }
  };

  return (
    <div className={`w-full flex flex-col bg-gray-50 ${isFullScreen ? 'h-[calc(100vh-80px)]' : 'h-[calc(100vh-130px)]'}`}>
      {!isFullScreen && (
        <div className="bg-white shadow-sm border-b px-6 py-4 shrink-0">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {currentPlan ? currentPlan.name : 'Aucun plan sélectionné'}
              </h1>
              {currentPlan && (
                <span className="text-sm text-gray-500">
                  {formatLocalDate(currentPlan.date)}
                </span>
              )}
            </div>
            
            {/* Statistics Section */}
            {currentPlan && (
              <div className="flex items-center gap-6 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100 shadow-inner shrink-0">
                <div className="flex flex-col items-center w-10">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PIC</span>
                  <span className="text-lg font-black text-blue-600 leading-none">{stats.pic}</span>
                </div>
                <div className="h-8 w-px bg-gray-200"></div>
                <div className="flex flex-col items-center w-10">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">MET</span>
                  <span className="text-lg font-black text-emerald-600 leading-none">{stats.met}</span>
                </div>
                <div className="h-8 w-px bg-gray-200"></div>
                <div className="flex flex-col items-center w-12">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Autres</span>
                  <span className="text-lg font-black text-slate-600 leading-none">{stats.others}</span>
                </div>
                <div className="h-8 w-px bg-gray-300"></div>
                <div className="flex flex-col items-center px-2 w-14">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Total</span>
                  <span className="text-xl font-black text-indigo-700 leading-none">{stats.total}</span>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2 shrink-0">
              {user?.canEdit && currentPlan && lastPlanAction && (
                <button
                  type="button"
                  onClick={handleUndoPlan}
                  className="px-3 py-1.5 bg-slate-600 text-white rounded-md hover:bg-slate-700 text-sm whitespace-nowrap"
                  title="Annuler la dernière action"
                >
                  Annuler
                </button>
              )}
              {currentPlan && (
                <Link
                  to="/replacements"
                  className="px-3 py-1.5 bg-violet-600 text-white rounded-md hover:bg-violet-700 text-sm whitespace-nowrap"
                >
                  Remplacements
                </Link>
              )}
              {currentPlan && (
                <Link
                  to={`/premium-state?planId=${currentPlan.id}`}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-sm text-sm whitespace-nowrap"
                >
                  Prime
                </Link>
              )}
              <button
                onClick={() => setShowPlanModal(true)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm whitespace-nowrap"
              >
                {currentPlan ? 'Plans' : 'Créer'}
              </button>
              {user?.canEdit && currentPlan && (
                <button
                  onClick={async () => {
                    if (window.confirm(`Êtes-vous sûr de vouloir réinitialiser le plan « ${currentPlan.name} » ? Toutes les assignations et postes seront supprimés.`)) {
                      try {
                        const { resetPlan } = useStore.getState();
                        await resetPlan(currentPlan.id);
                      } catch (error: any) {
                        alert(error.message || 'Échec');
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-sm text-sm whitespace-nowrap"
                  title="Réinitialiser"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {currentPlan ? (
        <DndContext
          sensors={user?.canEdit ? sensors : []}
          collisionDetection={pointerWithin}
          onDragStart={wrapDragStart(handleDragStart)}
          onDragEnd={wrapDragEnd(handleDragEnd)}
        >
          <div className={`flex-1 flex overflow-hidden gap-4 resizable-container ${isFullScreen ? 'p-2' : 'p-6 pt-0'}`}>
            <div
              className="bg-white rounded-lg shadow p-4 overflow-hidden"
              style={{ width: isFullScreen ? '100%' : `${leftPanelWidth}%`, minWidth: isFullScreen ? '100%' : '300px' }}
            >
              <PostsPanel
                posts={orderedPosts}
                workers={allWorkersForDisplay}
                assignments={assignmentMap}
                presences={presenceMap}
                attendancePresenceTypes={ATTENDANCE_PRESENCE_TYPES}
                lockedPostIds={lockedPostIds}
                onPostLockToggle={(postId) => currentPlan && togglePlanPostLock(currentPlan.id, postId)}
                unfilledPositions={currentPlan?.unfilledPositions || []}
                onAddUnfilled={(postId) => currentPlan && addUnfilledPosition(currentPlan.id, postId)}
                onDeleteUnfilled={deleteUnfilledPosition}
                shiftFilter={shiftFilter}
                onShiftFilterChange={setShiftFilter}
                isFullScreen={isFullScreen}
                onToggleFullScreen={() => setFullScreen(!isFullScreen)}
                stats={stats}
              />
            </div>

            {!isFullScreen && (
              <>
                <div className="flex flex-col items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsResizeLocked(!isResizeLocked)}
                    className={`p-1.5 rounded-full shadow-sm border transition-all z-10 ${isResizeLocked
                      ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    title={isResizeLocked ? "Déverrouiller le redimensionnement" : "Verrouiller le redimensionnement"}
                  >
                    {isResizeLocked ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 016 0 3 3 0 013 3 1 1 0 002 0 5 5 0 00-5-5z" />
                      </svg>
                    )}
                  </button>
                  <div
                    onMouseDown={handleMouseDown}
                    className={`w-1 flex-1 bg-gray-300 transition-colors ${isResizeLocked
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:bg-blue-500 cursor-col-resize'
                      } ${isResizing ? 'bg-blue-500' : ''}`}
                    style={{ minWidth: '4px' }}
                  />
                </div>

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
              </>
            )}
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
              <option value="">-- Ne pas assigner --</option>
              {replacementPrompt.options.map((opt) => {
                const isWarning = opt.leavesReplacementPost || opt.isPreRetraiteToday;
                return (
                  <option
                    key={opt.id}
                    value={opt.id}
                    disabled={opt.isAbsentZone}
                    className={opt.isAbsentZone ? 'text-gray-400 italic' : isWarning ? 'text-amber-600' : ''}
                  >
                    {opt.isAbsentZone ? '🚫 ' : isWarning ? '⚠️ ' : ''}
                    ({opt.anciennete}) {opt.name}
                    {opt.isAbsentZone ? ' (Absent/Vacances)' : opt.leavesReplacementPost ? ` (Laissera ${opt.assignedPostName} vide)` : opt.isPreRetraiteToday ? ' (Pré-retraite)' : opt.assignedElsewhere ? ` (Sur ${opt.assignedPostName})` : ''}
                  </option>
                );
              })}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setReplacementPrompt(null); setReplacementPromptSelectedId(null); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Ignorer
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (replacementPromptSelectedId && currentPlan && replacementPrompt) {
                    const chosenId = replacementPromptSelectedId;
                    const targetPostId = replacementPrompt.postId;
                    const chosenWorker = workers.find(w => w.id === chosenId);
                    const currentAssignments = useStore.getState().assignments.filter(a => a.planId === currentPlan?.id);
                    const previousPostIdForChosen = currentAssignments.find(a => a.workerId === chosenId)?.postId;

                    // Clear BEFORE potentially setting a new one
                    setReplacementPrompt(null);
                    setReplacementPromptSelectedId(null);

                    await assignWorker(currentPlan.id, chosenId, targetPostId);
                    await fetchAssignments(currentPlan.id);

                    // If the chosen replacement was already on another post, trigger a replacement prompt for THAT post
                    if (chosenWorker && previousPostIdForChosen) {
                      await checkAndPromptReplacement(chosenWorker, previousPostIdForChosen, chosenId);
                    }
                  } else {
                    setReplacementPrompt(null);
                    setReplacementPromptSelectedId(null);
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                Affecter
              </button>
            </div>
          </div>
        </div>
      )}

      {autoAssignReplacementPrompt && currentPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => closeAutoAssignReplacementPrompt(true)}>
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sélection des remplaçants</h3>
            <p className="text-sm text-gray-700 mb-4">
              Certains postes n&apos;ont plus de travailleurs présents. Choisissez un remplaçant pour chaque poste/quart :
            </p>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto mb-6 pr-2">
              {autoAssignReplacementPrompt.items.map((item, idx) => (
                <div key={`${item.postId}-${item.shift}`} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {item.postName} <span className="text-gray-500 font-normal">({item.shift === 'jour' ? 'Jour' : 'Soir'})</span>
                    </span>
                  </div>
                  <select
                    value={item.selectedId || ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setAutoAssignReplacementPrompt(prev => {
                        if (!prev) return null;
                        const nextItems = [...prev.items];
                        nextItems[idx] = { ...nextItems[idx], selectedId: val };
                        return { items: nextItems };
                      });
                    }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm cursor-pointer hover:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Ne pas assigner --</option>
                    {item.options.map(opt => {
                      const isWarning = opt.leavesReplacementPost || opt.isPreRetraiteToday;
                      return (
                        <option
                          key={opt.id}
                          value={opt.id}
                          disabled={opt.isAbsentZone}
                          className={opt.isAbsentZone ? 'text-gray-400 italic' : isWarning ? 'text-amber-600' : ''}
                        >
                          {opt.isAbsentZone ? '🚫 ' : isWarning ? '⚠️ ' : ''}
                          ({opt.anciennete}) {opt.name}
                          {opt.isAbsentZone ? ' (Absent/Vacances)' : opt.leavesReplacementPost ? ` (Laissera ${opt.assignedPostName} vide)` : opt.isPreRetraiteToday ? ' (Pré-retraite)' : opt.assignedElsewhere ? ` (Sur ${opt.assignedPostName})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeAutoAssignReplacementPrompt(true)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  for (const item of autoAssignReplacementPrompt.items) {
                    if (item.selectedId) {
                      await assignWorker(currentPlan.id, item.selectedId, item.postId);
                    }
                  }
                  await fetchAssignments(currentPlan.id);
                  closeAutoAssignReplacementPrompt(true);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Appliquer les sélections
              </button>
            </div>
          </div>
        </div>
      )}

      {returningWorkerPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 border-t-4 border-indigo-600">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Retour d&apos;absence</h3>
            <p className="text-sm text-gray-600 mb-6">
              L&apos;absence de <strong>{returningWorkerPrompt.worker.name}</strong> ({returningWorkerPrompt.worker.anciennete}) se termine aujourd&apos;hui.
              Que souhaitez-vous faire ?
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Nouveau type ou Retour au poste
                </label>
                <select
                  value={returningWorkerPrompt.newType}
                  onChange={(e) => setReturningWorkerPrompt({ ...returningWorkerPrompt, newType: e.target.value as WorkerType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {ORIGIN_TYPES.map((t: WorkerType) => (
                    <option key={t} value={t}>{WorkerTypeLabels[t]}</option>
                  ))}
                  <option value={WorkerType.ABSENT}>Absent (Prolonger)</option>
                  <option value={WorkerType.VACANCES}>Vacances (Prolonger)</option>
                  <option value={WorkerType.INVALIDITE}>Invalidité (Prolonger)</option>
                  <option value={WorkerType.LIBERATION_EXTERNE}>Libération externe (Prolonger)</option>
                  <option value={WorkerType.CONGE_PARENTAL}>Congé parental (Prolonger)</option>
                  <option value={WorkerType.TRAVAIL_LEGER}>Travail léger (Fixer durée)</option>
                  <option value={WorkerType.FORMATION}>Formation (Fixer durée)</option>
                </select>
              </div>

              {[WorkerType.ABSENT, WorkerType.VACANCES, WorkerType.INVALIDITE, WorkerType.LIBERATION_EXTERNE, WorkerType.CONGE_PARENTAL, WorkerType.TRAVAIL_LEGER, WorkerType.FORMATION].includes(returningWorkerPrompt.newType) && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Nouvelle date de fin
                  </label>
                  <input
                    type="date"
                    value={returningWorkerPrompt.newEndDate}
                    onChange={(e) => setReturningWorkerPrompt({ ...returningWorkerPrompt, newEndDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    min={currentPlan?.date ? new Date(currentPlan.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={async () => {
                  const isAbsence = [WorkerType.ABSENT, WorkerType.VACANCES, WorkerType.INVALIDITE, WorkerType.LIBERATION_EXTERNE, WorkerType.CONGE_PARENTAL, WorkerType.TRAVAIL_LEGER, WorkerType.FORMATION].includes(returningWorkerPrompt.newType);
                  const endDate = isAbsence ? returningWorkerPrompt.newEndDate : null;

                  if (isAbsence && !endDate) return; // Require date for extension

                  await updateWorkerType(returningWorkerPrompt.worker.id, returningWorkerPrompt.newType, endDate);
                  if (currentPlan) {
                    await updateWorkerPresence(currentPlan.id, returningWorkerPrompt.worker.id, returningWorkerPrompt.newType);
                  }
                  setReturningWorkerPrompt(null);
                }}
                className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors shadow-md"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {preRetraiteInfo && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm w-full mx-4">
          <div className="bg-white border border-amber-200 shadow-lg rounded-lg p-3">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 h-6 w-6 flex items-center justify-center rounded-full bg-amber-100 text-amber-700 text-sm font-bold">
                !
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-800 mb-1">Pré-retraite aujourd&apos;hui</h3>
                <p className="text-xs text-gray-700 mb-1">
                  Les travailleurs suivants sont automatiquement placés en <span className="font-semibold">Pré-retraite</span> pour ce plan :
                </p>
                <ul className="text-xs text-gray-800 list-disc list-inside space-y-0.5">
                  {preRetraiteInfo.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setPreRetraiteInfo(null)}
                className="ml-2 text-gray-400 hover:text-gray-600"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {showMachineryPopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" onClick={() => setShowMachineryPopup(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Inspection des engins roulant</h3>
            <p className="text-sm text-gray-700 mb-4">
              L&apos;assignation automatique est terminée.
              <br />
              Veuillez maintenant effectuer l&apos;inspection des engins roulant.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowMachineryPopup(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Plus tard
              </button>
              <Link
                to="/machinery-checkup"
                onClick={() => setShowMachineryPopup(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Ouvrir l&apos;inspection
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
