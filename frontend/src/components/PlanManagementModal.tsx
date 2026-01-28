import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plan } from '../types';

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
  const { deletePlansByRange, fetchPlans } = useStore();

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
            className={`px-4 py-2 font-medium ${
              activeTab === 'list'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Plans Existants
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'create'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Nouveau Plan
          </button>
          <button
            onClick={() => setActiveTab('copy')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'copy'
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
                    className={`p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 ${
                      currentPlan?.id === plan.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200'
                    }`}
                    onClick={async () => {
                      await onPlanSelect(plan.id);
                      onClose();
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
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
