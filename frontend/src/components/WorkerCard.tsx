import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Worker, WorkerType, WorkerTypeColors } from '../types';

/** Drag id prefixes: use unique ids so the same worker in presence vs post don't conflict. */
export const PRESENCE_DRAG_PREFIX = 'presence-worker-';
export const POST_DRAG_PREFIX = 'post-';
export const POST_DRAG_SEP = '-worker-';

export function getWorkerIdFromDragId(dragId: string): string | null {
  if (typeof dragId !== 'string') return null;
  if (dragId.startsWith(PRESENCE_DRAG_PREFIX)) return dragId.slice(PRESENCE_DRAG_PREFIX.length);
  const idx = dragId.indexOf(POST_DRAG_SEP);
  if (dragId.startsWith(POST_DRAG_PREFIX) && idx !== -1) return dragId.slice(idx + POST_DRAG_SEP.length);
  return dragId; // fallback: treat as raw worker id (e.g. other pages)
}

interface WorkerCardProps {
  worker: Worker;
  presenceType?: WorkerType;
  /** Unique drag id when the same worker appears in multiple places (e.g. presence + post). */
  dragId?: string;
  /** Currently assigned post id (to compare with originalPostId). */
  currentPostId?: string;
  /** Force disable any blinking even if moved. */
  disableBlinking?: boolean;
}

export default function WorkerCard({ 
  worker, 
  presenceType,
  dragId,
  currentPostId,
  disableBlinking
}: WorkerCardProps) {
  const sortableId = dragId ?? worker.id;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });

  const displayType = presenceType || worker.type;
  const typeColor = WorkerTypeColors[displayType];
  const isAbsent = [
    WorkerType.ABSENT,
    WorkerType.VACANCES,
    WorkerType.LIBERATION_EXTERNE,
    WorkerType.INVALIDITE,
    WorkerType.CONGE_PARENTAL,
    WorkerType.TRAVAIL_LEGER
  ].includes(displayType);

  const isMoved = 
    !disableBlinking &&
    currentPostId && 
    worker.originalPostId && 
    currentPostId !== worker.originalPostId && 
    // Don't blink if they are unassigned (in presence box) AND it's a normal absence group
    !(currentPostId === 'presence' && isAbsent);
  
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: hexToRgba(typeColor, 0.15),
    borderColor: typeColor,
    borderWidth: '1px',
  };

  const postName = worker.originalPost?.name ?? '-';
  const absenceEndDateStr = worker.absenceEndDate;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded px-1 py-0.5 shadow-sm hover:shadow cursor-move border text-[10px] leading-tight w-[110px] max-w-full min-w-0 overflow-hidden ${isMoved ? 'animate-worker-moved' : ''}`}
    >
      <div className="flex flex-col gap-px">
        <div className="font-medium text-gray-900 truncate">({worker.anciennete}) {worker.name}</div>
        <div className="flex justify-between items-center text-gray-500 text-[9px]">
          <span className="truncate" title={postName}>{postName}</span>
          {isAbsent && absenceEndDateStr && (
            <span className="text-red-600 font-bold ml-1 shrink-0">
              ➜ {new Date(absenceEndDateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
