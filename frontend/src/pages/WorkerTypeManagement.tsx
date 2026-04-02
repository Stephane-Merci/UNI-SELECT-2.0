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
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useStore } from '../store/useStore';
import { useAutoScrollDuringDrag } from '../hooks/useAutoScrollDuringDrag';
import { Worker, WorkerType, WorkerTypeLabels, WorkerTypeColors } from '../types';
import WorkerTypeColumn from '../components/WorkerTypeColumn';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';

export default function WorkerTypeManagement() {
  const { workers, updateWorkerType, fetchWorkers } = useStore();
  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{ workerId: string; targetType: WorkerType } | null>(null);
  const [absenceEndDate, setAbsenceEndDate] = useState<string>('');

  const { user } = useAuthStore();

  const ABSENCE_TYPES = [
    WorkerType.ABSENT,
    WorkerType.VACANCES,
    WorkerType.LIBERATION_EXTERNE,
    WorkerType.INVALIDITE,
    WorkerType.CONGE_PARENTAL,
    WorkerType.TRAVAIL_LEGER
  ];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const { wrapDragStart, wrapDragEnd } = useAutoScrollDuringDrag();

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
    if (!user?.canEdit) return;
    const { active, over } = event;
    setActiveWorker(null);

    if (!over) return;

    const workerId = active.id as string;
    const overId = over.id as string;
    const worker = workers.find((w) => w.id === workerId);
    if (!worker) return;

    // Check if dropping on a worker type column
    const targetType = Object.values(WorkerType).find((type) => type === overId);
    if (targetType) {
      if (worker.type !== targetType) {
        if (ABSENCE_TYPES.includes(targetType as WorkerType)) {
          setPendingUpdate({ workerId, targetType: targetType as WorkerType });
        } else {
          await updateWorkerType(workerId, targetType as WorkerType, null);
        }
      }
      return;
    }

    // Check if dropping on another worker (change to that worker's type)
    const targetWorker = workers.find((w) => w.id === overId);
    if (targetWorker) {
      if (worker.type !== targetWorker.type) {
        if (ABSENCE_TYPES.includes(targetWorker.type)) {
          setPendingUpdate({ workerId, targetType: targetWorker.type });
        } else {
          await updateWorkerType(workerId, targetWorker.type, null);
        }
      }
    }
  };

  const handleConfirmAbsence = async () => {
    if (pendingUpdate && absenceEndDate) {
      await updateWorkerType(pendingUpdate.workerId, pendingUpdate.targetType, absenceEndDate);
      setPendingUpdate(null);
      setAbsenceEndDate('');
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

  const visibleTypes = Object.values(WorkerType).filter((t) => t !== WorkerType.JOUR && t !== WorkerType.SOIR && t !== WorkerType.PRERETRAITE);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Gestion des Types de Travailleurs
        </h1>
        <Link 
          to="/absence-consultation"
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Consultation des Absences
        </Link>
      </div>

      <DndContext
        sensors={user?.canEdit ? sensors : []}
        collisionDetection={closestCenter}
        onDragStart={wrapDragStart(handleDragStart)}
        onDragEnd={wrapDragEnd(handleDragEnd)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
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

      {pendingUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Choisir une date de fin</h3>
            <p className="text-sm text-gray-600 mb-4">
              Indiquez quand l&apos;absence de <strong>{workers.find(w => w.id === pendingUpdate.workerId)?.name}</strong> se termine.
            </p>
            <input
              type="date"
              value={absenceEndDate}
              onChange={(e) => setAbsenceEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              min={new Date().toISOString().split('T')[0]}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setPendingUpdate(null); setAbsenceEndDate(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmAbsence}
                disabled={!absenceEndDate}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
