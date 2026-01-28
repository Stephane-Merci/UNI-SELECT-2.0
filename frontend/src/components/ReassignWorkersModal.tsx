import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Post, Worker } from '../types';

interface ReassignWorkersModalProps {
  post: Post;
  workers: Worker[];
  onClose: () => void;
  onReassigned: () => void;
}

export default function ReassignWorkersModal({
  post,
  workers,
  onClose,
  onReassigned,
}: ReassignWorkersModalProps) {
  const { posts, updateWorkerOriginalPost } = useStore();
  const [selectedPostId, setSelectedPostId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Filter out the current post from available posts
  const availablePosts = posts.filter((p) => p.id !== post.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedPostId) {
      setError('Veuillez sélectionner un nouveau poste');
      return;
    }

    if (availablePosts.length === 0) {
      setError('Aucun autre poste disponible. Veuillez créer un autre poste d\'abord.');
      return;
    }

    setLoading(true);
    try {
      // Reassign all workers to the new original post
      await Promise.all(
        workers.map((worker) =>
          updateWorkerOriginalPost(worker.id, selectedPostId)
        )
      );
      onReassigned();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la réassignation');
    } finally {
      setLoading(false);
    }
  };

  if (availablePosts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4">Impossible de supprimer</h2>
          <p className="mb-4 text-gray-700">
            Ce poste est utilisé comme poste original par {workers.length} travailleur(s),
            mais il n'y a pas d'autre poste disponible pour les réassigner.
          </p>
          <p className="mb-4 text-gray-700">
            Veuillez créer un autre poste avant de supprimer celui-ci.
          </p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          Réassigner les travailleurs
        </h2>
        <p className="mb-4 text-gray-700">
          Le poste "{post.name}" est utilisé comme poste original par{' '}
          <strong>{workers.length}</strong> travailleur(s). Veuillez sélectionner
          un nouveau poste original pour ces travailleurs :
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-800 rounded">
            {error}
          </div>
        )}

        <div className="mb-4">
          <h3 className="font-semibold mb-2">Travailleurs concernés :</h3>
          <ul className="list-disc list-inside space-y-1 mb-4">
            {workers.map((worker) => (
              <li key={worker.id} className="text-sm text-gray-600">
                {worker.name} ({worker.anciennete})
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nouveau poste original
            </label>
            <select
              value={selectedPostId}
              onChange={(e) => setSelectedPostId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="">Sélectionner un poste</option>
              {availablePosts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Réassignation...' : 'Réassigner et supprimer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
