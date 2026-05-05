import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { WorkerType, WorkerTypeColors, WorkerTypeLabels } from '../types';
import { io } from 'socket.io-client';

export default function AbsenceConsultation() {
  const { workers, fetchWorkers, updateWorkerType } = useStore();
  const { user } = useAuthStore();
  const [pendingUpdate, setPendingUpdate] = useState<{ workerId: string; targetType: WorkerType } | null>(null);
  const [absenceEndDate, setAbsenceEndDate] = useState<string>('');
  const [absenceStartDate, setAbsenceStartDate] = useState<string>('');

  const ABSENCE_TYPES = [
    WorkerType.ABSENT,
    WorkerType.VACANCES,
    WorkerType.LIBERATION_EXTERNE,
    WorkerType.INVALIDITE,
    WorkerType.CONGE_PARENTAL,
    WorkerType.TRAVAIL_LEGER,
    WorkerType.FORMATION,
  ];

  useEffect(() => {
    fetchWorkers();
    
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

  const handleConfirmAbsence = async () => {
    if (pendingUpdate && absenceEndDate) {
      await updateWorkerType(pendingUpdate.workerId, pendingUpdate.targetType, absenceEndDate, absenceStartDate);
      setPendingUpdate(null);
      setAbsenceEndDate('');
      setAbsenceStartDate('');
      fetchWorkers();
    }
  };

  const absentWorkers = workers.filter(w => ABSENCE_TYPES.includes(w.type));

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link 
            to="/worker-types" 
            className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-indigo-600 transition-all shadow-sm group"
            title="Retour à la Gestion des Types"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            Consultation des Absences & Congés
          </h1>
        </div>
        <div className="bg-indigo-100 text-indigo-700 text-sm font-bold px-4 py-2 rounded-full uppercase">
          {absentWorkers.length} Travailleurs
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-slate-800">Détails des absences en cours</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b">Travailleur</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b">Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b">Parti le</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b">Retour prévu le</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {absentWorkers.map(worker => (
                <tr key={worker.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 border border-gray-200">
                        {worker.anciennete}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-gray-900">{worker.name}</div>
                        <div className="text-xs text-gray-500">{worker.originalPost?.name || 'Sans poste'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1.5 rounded-lg text-xs font-bold text-white uppercase shadow-sm" style={{ backgroundColor: WorkerTypeColors[worker.type] }}>
                      {WorkerTypeLabels[worker.type]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                    {worker.absenceStartDate ? new Date(worker.absenceStartDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                    {worker.absenceEndDate ? new Date(worker.absenceEndDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Non définie'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {user?.canEdit && (
                      <button 
                        onClick={() => {
                          setPendingUpdate({ workerId: worker.id, targetType: worker.type });
                          setAbsenceEndDate(worker.absenceEndDate ? new Date(worker.absenceEndDate).toISOString().split('T')[0] : '');
                          setAbsenceStartDate(worker.absenceStartDate ? new Date(worker.absenceStartDate).toISOString().split('T')[0] : '');
                        }}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-all font-semibold flex items-center gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Modifier dates
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {absentWorkers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-500 italic bg-gray-50">
                    Aucun travailleur en absence ou congé actuellement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pendingUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 border border-gray-100 scale-in-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Modifier la période</h3>
            <p className="text-sm text-gray-600 mb-6">
              Ajustez les dates pour <span className="font-bold text-gray-800">{workers.find(w => w.id === pendingUpdate.workerId)?.name}</span>.
            </p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date de départ (comprise)</label>
                <input
                  type="date"
                  value={absenceStartDate}
                  onChange={(e) => setAbsenceStartDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-gray-700 font-medium"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date de retour (comprise)</label>
                <input
                  type="date"
                  value={absenceEndDate}
                  onChange={(e) => setAbsenceEndDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-gray-700 font-medium"
                  min={absenceStartDate}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setPendingUpdate(null); setAbsenceEndDate(''); setAbsenceStartDate(''); }}
                className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmAbsence}
                disabled={!absenceEndDate || !absenceStartDate}
                className="flex-1 px-4 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0"
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
