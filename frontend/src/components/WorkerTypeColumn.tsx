import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Worker, WorkerType } from '../types';
import WorkerCard from './WorkerCard';

interface WorkerTypeColumnProps {
  type: WorkerType;
  label: string;
  color: string;
  workers: Worker[];
}

export default function WorkerTypeColumn({
  type,
  label,
  color,
  workers,
}: WorkerTypeColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: type,
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg p-2 min-h-0 border-2 ${
        isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      }`}
      style={{
        backgroundColor: isOver ? `${color}20` : 'white',
        borderLeftColor: color,
        borderLeftWidth: '4px',
      }}
    >
      <h2
        className="font-semibold text-sm mb-1.5"
        style={{ color }}
      >
        {label} ({workers.length})
      </h2>
      <SortableContext
        items={workers.map((w) => w.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {workers.map((worker) => (
            <WorkerCard key={worker.id} worker={worker} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
