import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Post, WorkerType, WorkerTypeLabels, ORIGIN_TYPES } from '../types';

interface CreateWorkerModalProps {
  onClose: () => void;
  posts: Post[];
}

export default function CreateWorkerModal({
  onClose,
  posts,
}: CreateWorkerModalProps) {
  const { createWorker } = useStore();
  const [anciennete, setAnciennete] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<WorkerType>(WorkerType.PERMANENT_JOUR);
  const [originalPostId, setOriginalPostId] = useState(posts[0]?.id || '');
  const [preRetraiteEnabled, setPreRetraiteEnabled] = useState(false);
  const [preRetraiteDay, setPreRetraiteDay] = useState<'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY'>('MONDAY');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!anciennete || !name || !originalPostId) {
      setError('Tous les champs sont requis');
      return;
    }

    try {
      // Pass only the fields expected by the store type:
      // Omit<Worker, 'id' | 'createdAt' | 'updatedAt' | 'originalPost'> & { originalPostId: string }
      await createWorker({
        anciennete,
        name,
        type,
        originalPostId,
        preRetraiteDay: preRetraiteEnabled ? preRetraiteDay : null,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la création');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Créer un Travailleur</h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-800 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ancienneté
            </label>
            <input
              type="text"
              value={anciennete}
              onChange={(e) => setAnciennete(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WorkerType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {ORIGIN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {WorkerTypeLabels[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Poste Original
            </label>
            <select
              value={originalPostId}
              onChange={(e) => setOriginalPostId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              {posts.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pré-retraite
            </label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={preRetraiteEnabled}
                onChange={(e) => setPreRetraiteEnabled(e.target.checked)}
              />
              <span className="text-sm text-gray-700">Activer la pré-retraite</span>
              {preRetraiteEnabled && (
                <select
                  className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm"
                  value={preRetraiteDay}
                  onChange={(e) =>
                    setPreRetraiteDay(e.target.value as 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY')
                  }
                >
                  <option value="MONDAY">Lundi</option>
                  <option value="TUESDAY">Mardi</option>
                  <option value="WEDNESDAY">Mercredi</option>
                  <option value="THURSDAY">Jeudi</option>
                  <option value="FRIDAY">Vendredi</option>
                </select>
              )}
            </div>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
