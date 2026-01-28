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
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useStore } from '../store/useStore';
import { Worker, WorkerType, WorkerTypeLabels, WorkerTypeColors } from '../types';
import WorkerTypeColumn from '../components/WorkerTypeColumn';
import { io } from 'socket.io-client';

export default function WorkerTypeManagement() {
  const { workers, updateWorkerType, fetchWorkers } = useStore();
  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    const socket = io(socketUrl);
    socket.on('connect', () => {
      socket.emit('join-room', 'main');
    });

    socket.on('worker-type-changed', () => {
      fetchWorkers();
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchWorkers]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const worker = workers.find((w) => w.id === active.id);
    setActiveWorker(worker || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveWorker(null);

    if (!over) return;

    const workerId = active.id as string;
    const overId = over.id as string;

    // Check if dropping on a worker type column
    const targetType = Object.values(WorkerType).find((type) => type === overId);
    if (targetType) {
      const worker = workers.find((w) => w.id === workerId);
      if (worker && worker.type !== targetType) {
        await updateWorkerType(workerId, targetType);
      }
      return;
    }

    // Check if dropping on another worker (change to that worker's type)
    const targetWorker = workers.find((w) => w.id === overId);
    if (targetWorker) {
      const worker = workers.find((w) => w.id === workerId);
      if (worker && worker.type !== targetWorker.type) {
        await updateWorkerType(workerId, targetWorker.type);
      }
    }
  };

  const getWorkersByType = (type: WorkerType) => {
    return workers.filter((w) => w.type === type);
  };

  // JOUR/SOIR are not shown as columns; their workers appear under Permanent jour / Permanent soir
  const getWorkersForColumn = (type: WorkerType) => {
    if (type === WorkerType.PERMANENT_JOUR) return workers.filter((w) => w.type === WorkerType.PERMANENT_JOUR || w.type === WorkerType.JOUR);
    if (type === WorkerType.PERMANENT_SOIR) return workers.filter((w) => w.type === WorkerType.PERMANENT_SOIR || w.type === WorkerType.SOIR);
    return getWorkersByType(type);
  };

  const visibleTypes = Object.values(WorkerType).filter((t) => t !== WorkerType.JOUR && t !== WorkerType.SOIR);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Gestion des Types de Travailleurs
      </h1>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {visibleTypes.map((type) => (
              <WorkerTypeColumn
                key={type}
                type={type}
                label={WorkerTypeLabels[type]}
                color={WorkerTypeColors[type]}
                workers={getWorkersForColumn(type)}
              />
            ))}
        </div>

        <DragOverlay>
          {activeWorker ? (
            <div
              className="bg-white p-3 rounded-lg shadow-lg border-2 border-blue-500"
              style={{
                borderLeftColor: WorkerTypeColors[activeWorker.type],
                borderLeftWidth: '4px',
              }}
            >
              <div className="font-semibold">{activeWorker.name}</div>
              <div className="text-sm text-gray-500">{activeWorker.anciennete}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
