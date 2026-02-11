import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Post, Worker } from '../types';
import WorkerCard, { POST_DRAG_PREFIX, POST_DRAG_SEP } from './WorkerCard';

export const POST_COLUMN_DRAG_PREFIX = 'post-column-';

interface PostColumnProps {
  post: Post;
  workers: Worker[];
  /** When set, show a "Remplaçants" button (Booking page only). Plan page does not pass this. */
  onReplacementClick?: () => void;
  /** Plan page: show lock icon; locked posts cannot be moved. */
  isLocked?: boolean;
  onLockToggle?: () => void;
  /** Plan page: wrapper class for locked (fixed width) vs unlocked (flex) layout. */
  wrapperClassName?: string;
  /** Plan page: when set, only the header is draggable for reordering the post (not the workers). */
  dragHandleProps?: { attributes: Record<string, unknown>; listeners: Record<string, unknown> };
}

export default function PostColumn({
  post,
  workers,
  onReplacementClick,
  isLocked,
  onLockToggle,
  wrapperClassName,
  dragHandleProps,
}: PostColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: post.id,
  });

  const headerContent = (
    <>
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-xs text-gray-700 truncate">{post.name}</h2>
        {post.description && (
          <p className="text-[10px] text-gray-500 mt-0.5 truncate">{post.description}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-0.5">
        {onLockToggle != null && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onLockToggle(); }}
            className={`p-0.5 rounded ${isLocked ? 'text-amber-600 hover:bg-amber-100' : 'text-gray-400 hover:bg-gray-200'}`}
            title={isLocked ? 'Poste verrouillé (cliquer pour déverrouiller)' : 'Poste déverrouillé (cliquer pour verrouiller)'}
            aria-label={isLocked ? 'Déverrouiller le poste' : 'Verrouiller le poste'}
          >
            {isLocked ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm2-2v2h6V7a3 3 0 00-6 0v2h2z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a5 5 0 00-5-5zM8 7a3 3 0 016 0v2H8V7z" />
              </svg>
            )}
          </button>
        )}
        {onReplacementClick && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onReplacementClick(); }}
            className="p-0.5 text-violet-600 hover:bg-violet-100 rounded"
            title="Remplaçants"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
          </button>
        )}
      </div>
    </>
  );

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col h-full min-h-0 bg-white rounded-lg border-2 max-w-[130px] w-full overflow-hidden ${wrapperClassName ?? ''} ${isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
        }`}
    >
      <div
        className={`flex justify-between items-start shrink-0 px-2 py-1.5 bg-gray-200 rounded-t-md ${dragHandleProps && !isLocked ? 'cursor-grab active:cursor-grabbing' : ''}`}
        {...(dragHandleProps && !isLocked ? dragHandleProps.attributes : {})}
        {...(dragHandleProps && !isLocked ? dragHandleProps.listeners : {})}
      >
        {headerContent}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <SortableContext
          items={workers.map((w) => `${POST_DRAG_PREFIX}${post.id}${POST_DRAG_SEP}${w.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-1 min-h-0">
            {workers.length > 0 ? (
              workers.map((worker) => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                  dragId={`${POST_DRAG_PREFIX}${post.id}${POST_DRAG_SEP}${worker.id}`}
                />
              ))
            ) : (
              <p className="text-[10px] text-gray-400 italic text-center py-2">
                Aucun travailleur assigné
              </p>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
