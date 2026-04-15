import { useEffect, useState, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useStore } from '../store/useStore';
import { Worker } from '../types';
import { WORKER_TYPES_JOUR, WORKER_TYPES_SOIR } from '../types';

export default function MachineryCheckup() {
  const {
    currentPlan,
    posts,
    workers,
    assignments,
    machineryChecks,
    fetchMachineryChecks,
    updateMachineryCheck,
  } = useStore();

  const [shiftFilter, setShiftFilter] = useState<'jour' | 'soir' | 'tous'>('tous');

  useEffect(() => {
    if (currentPlan) {
      fetchMachineryChecks(currentPlan.id);
    }
  }, [currentPlan, fetchMachineryChecks]);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    const socket = io(socketUrl);
    socket.on('connect', () => {
      socket.emit('join-room', 'main');
    });

    socket.on('machinery-check-updated', () => {
      if (currentPlan) {
        fetchMachineryChecks(currentPlan.id);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentPlan, fetchMachineryChecks]);

  const postsRequiringMachinery = useMemo(() => {
    return posts.filter((p) => p.needsMachinery);
  }, [posts]);

  const assignmentByPost = useMemo(() => {
    const map: Record<string, Worker[]> = {};
    assignments
      .filter((a) => a.planId === currentPlan?.id)
      .forEach((a) => {
        if (!map[a.postId]) map[a.postId] = [];
        const worker = workers.find((w) => w.id === a.workerId);
        if (worker) map[a.postId].push(worker);
      });
    return map;
  }, [assignments, currentPlan, workers]);

  const filteredPosts = useMemo(() => {
    return postsRequiringMachinery.filter((post) => {
      const assignedWorkers = assignmentByPost[post.id] || [];
      if (shiftFilter === 'tous') return true;
      
      return assignedWorkers.some((w) => {
        if (shiftFilter === 'jour') return WORKER_TYPES_JOUR.includes(w.type);
        if (shiftFilter === 'soir') return WORKER_TYPES_SOIR.includes(w.type);
        return false;
      });
    });
  }, [postsRequiringMachinery, assignmentByPost, shiftFilter]);

  const handleCheckChange = async (postId: string, workerId: string, status: 'GOOD' | 'FAULTY' | 'UNKNOWN') => {
    if (!currentPlan) return;
    await updateMachineryCheck({
      planId: currentPlan.id,
      postId,
      workerId,
      status,
    });
  };

  if (!currentPlan) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl shadow-sm border border-gray-100">
        <p className="text-gray-500 italic">Veuillez sélectionner un plan dans le Plan de travail pour voir l&apos;inspection des engins roulant.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 print:text-black">Inspection des engins roulant</h1>
          <p className="text-gray-600 mt-1 print:text-black">Plan : <span className="font-semibold">{currentPlan.name}</span></p>
        </div>

        <div className="flex items-center gap-4 print:hidden">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-sm flex items-center gap-2 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0v2.796c0 1.136.921 2.054 2.054 2.054h6.392c1.133 0 2.054-.918 2.054-2.054v-2.796z" />
            </svg>
            Imprimer
          </button>

          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setShiftFilter('jour')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${shiftFilter === 'jour' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Jour
            </button>
            <button
              onClick={() => setShiftFilter('soir')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${shiftFilter === 'soir' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Soir
            </button>
            <button
              onClick={() => setShiftFilter('tous')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${shiftFilter === 'tous' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Tous
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {filteredPosts.length > 0 ? (
          filteredPosts.map((post) => {
            const assignedWorkers = (assignmentByPost[post.id] || []).filter(w => {
                if (shiftFilter === 'jour') return WORKER_TYPES_JOUR.includes(w.type);
                if (shiftFilter === 'soir') return WORKER_TYPES_SOIR.includes(w.type);
                return true;
            });

            return (
              <div key={post.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{post.name}</h2>
                    <p className="text-sm text-gray-500 italic">{post.description || 'Sans description'}</p>
                  </div>
                </div>
                
                <div className="divide-y divide-gray-100">
                  {assignedWorkers.length > 0 ? (
                    assignedWorkers.map((worker) => {
                      const check = machineryChecks.find(
                        (c) => c.postId === post.id && c.planId === currentPlan.id && c.workerId === worker.id
                      );
                      const hasBeenChecked = !!check;
                      const currentStatus = check?.status || 'UNKNOWN';

                      return (
                        <div key={worker.id} className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${hasBeenChecked ? 'bg-gray-50' : 'bg-red-50/30'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 flex items-center justify-center rounded-full font-bold uppercase ${hasBeenChecked ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                              {worker.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{worker.name}</p>
                              <p className="text-xs text-gray-500">Matricule: {worker.anciennete}</p>
                            </div>
                          </div>

                          <div className="flex flex-col sm:items-end gap-2">
                             {!hasBeenChecked ? (
                               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                   <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                                 </svg>
                                 CHECKUP REQUIS
                               </span>
                             ) : (
                               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                   <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4.006-5.503Z" clipRule="evenodd" />
                                 </svg>
                                 CHECKUP EFFECTUÉ
                               </span>
                             )}
                             
                             <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200 print:hidden">
                                <button
                                    onClick={() => handleCheckChange(post.id, worker.id, 'GOOD')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${currentStatus === 'GOOD' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}
                                >
                                    {currentStatus === 'GOOD' && <span>✓</span>}
                                    BON
                                </button>
                                <button
                                    onClick={() => handleCheckChange(post.id, worker.id, 'FAULTY')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${currentStatus === 'FAULTY' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}
                                >
                                    {currentStatus === 'FAULTY' && <span>⚠</span>}
                                    DÉFECTUEUX
                                </button>
                             </div>
                             
                             {check && (
                                <span className="text-xs text-gray-500 italic mt-1 font-medium">
                                    Enregistré à {new Date(check.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                             )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-6 py-8 text-center text-gray-500 italic bg-gray-50/30">
                      Aucun travailleur assigné à ce poste pour ce quart de travail.
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-6 py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-300 mx-auto mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.423 20.25a2.25 2.25 0 0 0 4.5 0V17.25H11.423v3.00zm0-3.75h4.5m-4.5 0v-4.5h4.5v4.5m-4.5-4.5V9a2.25 2.25 0 0 1 4.5 0v3.00h-4.5zM3 17.25h3.00v3.00H3v-3.00zm0-3.75h3.00v3.00H3v-3.00zm0-3.75h3.00v3.00H3v-3.00zm0-3.75h3.00v3.00H3v-3.00z" />
            </svg>
            <p className="text-gray-500">Aucun poste ne requiert d&apos;inspection des engins roulant pour ce quart de travail.</p>
          </div>
        )}
      </div>
    </div>
  );
}
