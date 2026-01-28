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
}

export default function WorkerCard({ 
  worker, 
  presenceType,
  dragId
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
    borderWidth: '2px',
  };

  const postName = worker.originalPost?.name ?? '-';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded px-1.5 py-0.5 shadow-sm hover:shadow cursor-move text-xs border"
    >
      <div className="flex flex-col gap-0.5 leading-tight">
        <div className="font-medium text-gray-900 truncate">{worker.name}</div>
        <div className="text-gray-600 text-[10px] truncate" title={`${postName} (${worker.anciennete})`}>
          {postName} ({worker.anciennete})
        </div>
      </div>
    </div>
  );
}
