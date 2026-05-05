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

  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [selectedPostId, setSelectedPostId] = useState('');
  const [isAddingManual, setIsAddingManual] = useState(false);

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



  // All posts that either normally need machinery OR have an existing check in the current plan
  const relevantPosts = useMemo(() => {
    const postIdsWithChecks = new Set(machineryChecks.map(c => c.postId));
    return posts.filter(p => p.needsMachinery || postIdsWithChecks.has(p.id));
  }, [posts, machineryChecks]);

  const assignmentByPost = useMemo(() => {
    const map: Record<string, Worker[]> = {};
    
    // Start with workers actually assigned in the plan
    assignments
      .filter((a) => a.planId === currentPlan?.id)
      .forEach((a) => {
        if (!map[a.postId]) map[a.postId] = [];
        const worker = workers.find((w) => w.id === a.workerId);
        if (worker) map[a.postId].push(worker);
      });
      
    // Also add workers who have a machinery check even if not assigned to that post
    machineryChecks.forEach(check => {
      if (!map[check.postId]) map[check.postId] = [];
      const worker = workers.find(w => w.id === check.workerId);
      if (worker && !map[check.postId].some(w => w.id === worker.id)) {
        map[check.postId].push(worker);
      }
    });
    
    return map;
  }, [assignments, currentPlan, workers, machineryChecks]);

  const filteredPosts = useMemo(() => {
    return relevantPosts.filter((post) => {
      const assignedWorkers = assignmentByPost[post.id] || [];
      if (shiftFilter === 'tous') return true;
      
      return assignedWorkers.some((w) => {
        if (shiftFilter === 'jour') return WORKER_TYPES_JOUR.includes(w.type);
        if (shiftFilter === 'soir') return WORKER_TYPES_SOIR.includes(w.type);
        return false;
      });
    });
  }, [relevantPosts, assignmentByPost, shiftFilter]);

  const handleCheckChange = async (postId: string, workerId: string, checked: boolean) => {
    if (!currentPlan) return;
    await updateMachineryCheck({
      planId: currentPlan.id,
      postId,
      workerId,
      checked,
    });
  };

  const handleAddManualCheck = async () => {
    if (!currentPlan || !selectedPostId || !selectedWorkerId) return;
    
    setIsAddingManual(true);
    try {
      await updateMachineryCheck({
        planId: currentPlan.id,
        postId: selectedPostId,
        workerId: selectedWorkerId,
        checked: false,
      });
      setSelectedPostId('');
      setSelectedWorkerId('');
    } finally {
      setIsAddingManual(false);
    }
  };

  if (!currentPlan) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl shadow-sm border border-gray-100">
        <p className="text-gray-500 italic">Veuillez sélectionner un plan dans le Plan de travail pour voir l&apos;inspection des engins roulant.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-0">
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
          <>
            <div className="print:hidden grid gap-6">
              {filteredPosts.map((post) => {
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
                      {!post.needsMachinery && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded uppercase">Ajout Manuel</span>
                      )}
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                      {assignedWorkers.length > 0 ? (
                        assignedWorkers.map((worker, workerIdx) => {
                          const check = machineryChecks.find(
                            (c) => c.postId === post.id && c.planId === currentPlan.id && c.workerId === worker.id
                          );
                          const hasBeenChecked = !!check && check.checked;

                          // Zebra striping between workers (light grey).
                          const zebra = workerIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60';
                          const rowBg = hasBeenChecked ? zebra : workerIdx % 2 === 0 ? 'bg-red-50/25' : 'bg-red-50/12';

                          return (
                            <div key={worker.id} className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${rowBg}`}>
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
                                 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${hasBeenChecked ? 'bg-green-100 text-green-800 border-green-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                                   {hasBeenChecked ? 'CHECK EFFECTUÉ' : 'CHECK REQUIS'}
                                 </span>
                                 
                                 <button
                                   type="button"
                                   onClick={() => handleCheckChange(post.id, worker.id, !hasBeenChecked)}
                                   className={`print:hidden inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md border transition-all ${hasBeenChecked ? 'bg-green-600 text-white border-green-700 hover:bg-green-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                                 >
                                   <span className={`h-2.5 w-2.5 rounded-full ${hasBeenChecked ? 'bg-white' : 'bg-gray-300'}`}></span>
                                   Check fait: {hasBeenChecked ? 'Oui' : 'Non'}
                                 </button>
                                 
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
              })}
            </div>

            {/* Manual Addition Section */}
            <div className="print:hidden bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-xl p-6 mt-8">
              <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Ajouter une inspection manuelle
              </h3>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-indigo-700 uppercase mb-1">Poste</label>
                  <select 
                    value={selectedPostId} 
                    onChange={(e) => setSelectedPostId(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    <option value="">Sélectionner un poste...</option>
                    {posts.sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-indigo-700 uppercase mb-1">Travailleur</label>
                  <select 
                    value={selectedWorkerId} 
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    <option value="">Sélectionner un travailleur...</option>
                    {workers.sort((a, b) => a.name.localeCompare(b.name)).map(w => (
                      <option key={w.id} value={w.id}>({w.anciennete}) {w.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddManualCheck}
                  disabled={!selectedPostId || !selectedWorkerId || isAddingManual}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md shadow-indigo-100"
                >
                  {isAddingManual ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </div>

            {/* Print-only compact table */}
            <div className="hidden print:block w-full">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr>
                    <th className="text-left border border-gray-300 px-2 py-1 bg-gray-100">Poste</th>
                    <th className="text-left border border-gray-300 px-2 py-1 bg-gray-100">Travailleur</th>
                    <th className="text-left border border-gray-300 px-2 py-1 bg-gray-100">Check fait</th>
                    <th className="text-left border border-gray-300 px-2 py-1 bg-gray-100">Heure</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.flatMap((post) => {
                    const assignedWorkers = (assignmentByPost[post.id] || []).filter(w => {
                      if (shiftFilter === 'jour') return WORKER_TYPES_JOUR.includes(w.type);
                      if (shiftFilter === 'soir') return WORKER_TYPES_SOIR.includes(w.type);
                      return true;
                    });

                    return assignedWorkers.map((worker) => {
                      const check = machineryChecks.find(
                        (c) => c.postId === post.id && c.planId === currentPlan.id && c.workerId === worker.id
                      );
                      const hasBeenChecked = !!check && check.checked;
                      const checkText = hasBeenChecked ? 'Oui' : 'Non';
                      const timeText = check
                        ? new Date(check.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '';

                      return (
                        <tr key={`${post.id}-${worker.id}`} className="border border-gray-200">
                          <td className="border border-gray-200 px-2 py-1 align-top">{post.name}</td>
                          <td className="border border-gray-200 px-2 py-1 align-top">{worker.name}</td>
                          <td className="border border-gray-200 px-2 py-1 align-top">{checkText}</td>
                          <td className="border border-gray-200 px-2 py-1 align-top">{timeText}</td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="px-6 py-12 text-center bg-white rounded-xl border border-dashed border-gray-300 print:block">
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

