import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Plan, WorkerTypeColors } from '../types';
import apiClient from '../api/client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface PlanManagementModalProps {
  onClose: () => void;
  plans: Plan[];
  currentPlan: Plan | null;
  onPlanSelect: (planId: string) => Promise<void>;
  onPlanCreate: (plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'assignments' | 'workerPresences'>) => Promise<void>;
  onPlanCopy: (sourcePlanId: string, name: string, date?: string) => Promise<void>;
}

export default function PlanManagementModal({
  onClose,
  plans,
  currentPlan,
  onPlanSelect,
  onPlanCreate,
  onPlanCopy,
}: PlanManagementModalProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'copy'>('list');
  const [planName, setPlanName] = useState('');
  const [planDate, setPlanDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSourcePlan, setSelectedSourcePlan] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showExportRange, setShowExportRange] = useState(false);
  const [showDeleteRange, setShowDeleteRange] = useState(false);
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [deleteStart, setDeleteStart] = useState('');
  const [deleteEnd, setDeleteEnd] = useState('');
  const { deletePlansByRange, fetchPlans, deletePlan } = useStore();

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const autoName = `Plan du ${formatDate(planDate)}`;

  // Auto-fill name based on date if it's empty or matches a previous auto-fill
  useEffect(() => {
    if (activeTab === 'create' || activeTab === 'copy') {
      if (!planName || planName.startsWith('Plan du ')) {
        setPlanName(autoName);
      }
    }
  }, [planDate, activeTab]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!planName.trim()) {
      setError('Le nom du plan est requis');
      setLoading(false);
      return;
    }

    try {
      await onPlanCreate({
        name: planName,
        date: planDate || undefined,
      });
      setPlanName('');
      setPlanDate(new Date().toISOString().split('T')[0]);
      setActiveTab('list');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.details || 'Erreur lors de la création du plan';
      setError(errorMessage);
      console.error('Error creating plan:', err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportByRange = async () => {
    setError('');
    if (!exportStart || !exportEnd) {
      setError('Veuillez renseigner la date de début et la date de fin');
      return;
    }
    if (new Date(exportStart) > new Date(exportEnd)) {
      setError('La date de début doit être antérieure à la date de fin');
      return;
    }
    setLoading(true);
    try {
      const base = API_BASE.replace(/\/$/, '');
      const token = localStorage.getItem('token');

      // 1) Récupérer les plans dans la plage de dates (par createdAt)
      const rangeUrl = `${base}/plans/range?start=${encodeURIComponent(exportStart)}&end=${encodeURIComponent(exportEnd)}`;
      const rangeRes = await fetch(rangeUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!rangeRes.ok) throw new Error(await rangeRes.text());
      const rangePlans: { id: string; name: string }[] = await rangeRes.json();

      // 2) Pour chaque plan, télécharger un fichier Excel séparé
      for (const plan of rangePlans) {
        const exportUrl = `${base}/export/plan/${encodeURIComponent(plan.id)}`;
        const res = await fetch(exportUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) continue;
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const safeName = (plan.name || 'plan').replace(/[/\\?*[\]:]/g, '_');
        a.download = `${safeName}.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
      }

      setShowExportRange(false);
      setExportStart('');
      setExportEnd('');
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de l\'export');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteByRange = async () => {
    setError('');
    if (!deleteStart || !deleteEnd) {
      setError('Veuillez renseigner la date de début et la date de fin');
      return;
    }
    if (new Date(deleteStart) > new Date(deleteEnd)) {
      setError('La date de début doit être antérieure à la date de fin');
      return;
    }
    if (!confirm(`Supprimer tous les plans créés entre le ${deleteStart} et le ${deleteEnd} ? Cette action est irréversible.`)) return;
    setLoading(true);
    try {
      const data = await deletePlansByRange(deleteStart, deleteEnd);
      await fetchPlans();
      setShowDeleteRange(false);
      setDeleteStart('');
      setDeleteEnd('');
      setError('');
      if (data?.deleted !== undefined) {
        setError(`Suppression effectuée : ${data.deleted} plan(s) supprimé(s).`);
        setTimeout(() => setError(''), 3000);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPlan = async (plan: Plan, e: React.MouseEvent) => {
    e.stopPropagation();
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.get(`/export/plan/${encodeURIComponent(plan.id)}`, {
        responseType: 'blob',
      });
      const blob = res.data as Blob;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const safeName = (plan.name || 'plan').replace(/[/\\?*[\]:]/g, '_');
      a.download = `${safeName}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      let msg = "Erreur lors de l'export";
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = text.startsWith('{') ? JSON.parse(text) : null;
          if (parsed?.error) msg = parsed.error;
        } catch (_) { }
      } else if (err?.response?.data?.error) {
        msg = err.response.data.error;
      } else if (err?.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPlan = async (plan: Plan, e: React.MouseEvent) => {
    e.stopPropagation();
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.get(`/plans/${encodeURIComponent(plan.id)}`);
      const planData = res.data;
      const assignments = planData.assignments || [];
      const workerPresences = planData.workerPresences || [];
      const presenceByWorkerId = new Map<string, string>();
      for (const p of workerPresences) {
        if (p.workerId && p.type) presenceByWorkerId.set(p.workerId, p.type);
      }
      const byPost = new Map<string, { name: string; description?: string | null; workers: { name: string; anciennete: string; type: string; originalPostName: string; color: string }[] }>();
      for (const a of assignments) {
        const postName = a.post?.name || 'Poste';
        const postDesc = a.post?.description;
        const worker = a.worker;
        const type = presenceByWorkerId.get(a.workerId) || worker?.type || 'PERMANENT_JOUR';
        const color = (WorkerTypeColors as Record<string, string>)[type] || '#e5e7eb';
        const originalPostName = worker?.originalPost?.name ?? '-';
        const workerEntry = {
          name: worker?.name ?? '',
          anciennete: worker?.anciennete ?? '',
          type,
          originalPostName,
          color,
        };
        const existing = byPost.get(postName);
        if (!existing) {
          byPost.set(postName, {
            name: postName,
            description: postDesc,
            workers: [workerEntry],
          });
        } else {
          existing.workers.push(workerEntry);
        }
      }
      const zoneCards = Array.from(byPost.values())
        .map(
          (post) => `
        <div class="zone-card">
          <div class="zone-title">${post.name}</div>
          ${post.description ? `<div class="zone-desc">${post.description}</div>` : ''}
          <div class="zone-workers">
            ${post.workers
              .map(
                (w) => `
              <div class="worker-card" style="background-color:${w.color}20;border-left:3px solid ${w.color};">
                <div class="worker-name">(${w.anciennete}) ${w.name}</div>
                <div class="worker-meta">${w.originalPostName}</div>
              </div>`
              )
              .join('')}
          </div>
        </div>`
        )
        .join('');
      const html = `
        <!DOCTYPE html><html><head><meta charset="utf-8"><title>${plan.name}</title>
        <style>
          @page { size: landscape; }
          *{box-sizing:border-box;}
          body{font-family:sans-serif;padding:1rem;margin:0;background:#f3f4f6;}
          .print-header{font-size:1.25rem;font-weight:700;margin-bottom:0.5rem;}
          .print-date{color:#6b7280;font-size:0.875rem;margin-bottom:1rem;}
          .zones{display:flex;flex-wrap:wrap;gap:0.75rem;}
          .zone-card{background:#fff;border-radius:0.5rem;padding:0.75rem;min-width:180px;max-width:280px;box-shadow:0 1px 3px rgba(0,0,0,0.1);}
          .zone-title{font-weight:600;font-size:0.95rem;margin-bottom:0.25rem;}
          .zone-desc{font-size:0.75rem;color:#6b7280;margin-bottom:0.5rem;}
          .zone-workers{display:flex;flex-wrap:wrap;gap:0.35rem;}
          .worker-card{border-radius:0.25rem;padding:0.35rem 0.5rem;font-size:10px;line-height:1.2;min-width:90px;}
          .worker-name{font-weight:500;color:#111;}
          .worker-meta{color:#4b5563;font-size:9px;}
        </style>
        </head><body>
        <div class="print-header">${plan.name}</div>
        <div class="print-date">${plan.date ? new Date(plan.date).toLocaleDateString('fr-FR') : ''}</div>
        <div class="zones">${zoneCards}</div>
        </body></html>`;
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => {
          w.print();
          w.close();
        }, 400);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Erreur lors de l'impression");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (plan: Plan, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Supprimer le plan "${plan.name}" ? Cette action est irréversible.`)) return;
    setError('');
    setLoading(true);
    try {
      await deletePlan(plan.id);
      await fetchPlans();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!planName.trim()) {
      setError('Le nom du plan est requis');
      setLoading(false);
      return;
    }

    if (!selectedSourcePlan) {
      setError('Veuillez sélectionner un plan source');
      setLoading(false);
      return;
    }

    try {
      await onPlanCopy(selectedSourcePlan, planName, planDate || undefined);
      setPlanName('');
      setPlanDate(new Date().toISOString().split('T')[0]);
      setSelectedSourcePlan('');
      setActiveTab('list');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la copie du plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Gestion des Plans</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 font-medium ${activeTab === 'list'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Plans Existants
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 font-medium ${activeTab === 'create'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Nouveau Plan
          </button>
          <button
            onClick={() => setActiveTab('copy')}
            className={`px-4 py-2 font-medium ${activeTab === 'copy'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Copier un Plan
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-800 rounded">
            {error}
          </div>
        )}

        {/* List Tab */}
        {activeTab === 'list' && (
          <div>
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <h3 className="font-semibold text-lg">Sélectionner un Plan</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setShowExportRange((v) => !v); setShowDeleteRange(false); setError(''); }}
                  className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
                >
                  Exporter
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDeleteRange((v) => !v); setShowExportRange(false); setError(''); }}
                  className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100"
                >
                  Supprimer
                </button>
              </div>
            </div>
            {showExportRange && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700 mb-2">Exporter les plans créés entre deux dates</p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col text-sm">
                    <span className="text-gray-600">Date début</span>
                    <input
                      type="date"
                      value={exportStart}
                      onChange={(e) => setExportStart(e.target.value)}
                      className="mt-1 px-2 py-1.5 border border-gray-300 rounded"
                    />
                  </label>
                  <label className="flex flex-col text-sm">
                    <span className="text-gray-600">Date fin</span>
                    <input
                      type="date"
                      value={exportEnd}
                      onChange={(e) => setExportEnd(e.target.value)}
                      className="mt-1 px-2 py-1.5 border border-gray-300 rounded"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleExportByRange}
                    disabled={loading}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Exporter
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowExportRange(false); setExportStart(''); setExportEnd(''); }}
                    className="px-3 py-1.5 text-gray-700 text-sm rounded border border-gray-300 hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
            {showDeleteRange && (
              <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-gray-700 mb-2">Supprimer tous les plans créés entre deux dates</p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col text-sm">
                    <span className="text-gray-600">Date début</span>
                    <input
                      type="date"
                      value={deleteStart}
                      onChange={(e) => setDeleteStart(e.target.value)}
                      className="mt-1 px-2 py-1.5 border border-gray-300 rounded"
                    />
                  </label>
                  <label className="flex flex-col text-sm">
                    <span className="text-gray-600">Date fin</span>
                    <input
                      type="date"
                      value={deleteEnd}
                      onChange={(e) => setDeleteEnd(e.target.value)}
                      className="mt-1 px-2 py-1.5 border border-gray-300 rounded"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleDeleteByRange}
                    disabled={loading}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDeleteRange(false); setDeleteStart(''); setDeleteEnd(''); }}
                    className="px-3 py-1.5 text-gray-700 text-sm rounded border border-gray-300 hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
            {plans.length === 0 ? (
              <p className="text-gray-500">Aucun plan disponible</p>
            ) : (
              <div className="space-y-2">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 ${currentPlan?.id === plan.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                      }`}
                    onClick={async (e) => {
                      if ((e.target as HTMLElement).closest('[data-plan-actions]')) return;
                      await onPlanSelect(plan.id);
                      onClose();
                    }}
                  >
                    <div className="flex justify-between items-center gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold">{plan.name}</h4>
                        {plan.date && (
                          <p className="text-sm text-gray-500">
                            {new Date(plan.date).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          Créé le {new Date(plan.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1" data-plan-actions>
                        <button
                          type="button"
                          onClick={(e) => handlePrintPlan(plan, e)}
                          disabled={loading}
                          className="p-2 text-gray-600 hover:bg-gray-200 rounded-md disabled:opacity-50"
                          title="Imprimer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleExportPlan(plan, e)}
                          disabled={loading}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md disabled:opacity-50"
                          title="Exporter Excel"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeletePlan(plan, e)}
                          disabled={loading}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
                          title="Supprimer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      {currentPlan?.id === plan.id && (
                        <span className="px-3 py-1 bg-blue-600 text-white text-sm rounded-full">
                          Actif
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Tab */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreatePlan} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du Plan
              </label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Ex: Plan du 24 Janvier 2025"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date (optionnel)
              </label>
              <input
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Création...' : 'Créer'}
              </button>
            </div>
          </form>
        )}

        {/* Copy Tab */}
        {activeTab === 'copy' && (
          <form onSubmit={handleCopyPlan} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan Source
              </label>
              <select
                value={selectedSourcePlan}
                onChange={(e) => setSelectedSourcePlan(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Sélectionner un plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} {plan.date && `(${new Date(plan.date).toLocaleDateString('fr-FR')})`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du Nouveau Plan
              </label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Ex: Plan du 25 Janvier 2025"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date (optionnel)
              </label>
              <input
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Copie...' : 'Copier et Créer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
