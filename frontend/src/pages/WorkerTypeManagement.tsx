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
    WorkerType.CONGE_PARENTAL
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
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Gestion des Types de Travailleurs
      </h1>

      {/* Absences summary section */}
      <div className="mb-10 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Consultation des Absences & Congés
          </h2>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase">
            {workers.filter(w => ABSENCE_TYPES.includes(w.type)).length} Travailleurs
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Travailleur</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Parti le</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Retour prévu le</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {workers.filter(w => ABSENCE_TYPES.includes(w.type)).map(worker => (
                <tr key={worker.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                        {worker.anciennete}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-semibold text-gray-900">{worker.name}</div>
                        <div className="text-xs text-gray-500">{worker.originalPost?.name || 'Sans poste'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold text-white uppercase shadow-sm" style={{ backgroundColor: WorkerTypeColors[worker.type] }}>
                      {WorkerTypeLabels[worker.type]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {worker.absenceStartDate ? new Date(worker.absenceStartDate).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                    {worker.absenceEndDate ? new Date(worker.absenceEndDate).toLocaleDateString('fr-FR') : 'Non définie'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {user?.canEdit && (
                      <button 
                        onClick={() => {
                          setPendingUpdate({ workerId: worker.id, targetType: worker.type });
                          setAbsenceEndDate(worker.absenceEndDate ? new Date(worker.absenceEndDate).toISOString().split('T')[0] : '');
                        }}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                      >
                        Modifier le retour
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {workers.filter(w => ABSENCE_TYPES.includes(w.type)).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500 italic">
                    Aucun travailleur en absence ou congé actuellement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
