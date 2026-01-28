import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Post } from '../types';

interface UpdatePostModalProps {
  post: Post;
  onClose: () => void;
}

export default function UpdatePostModal({ post, onClose }: UpdatePostModalProps) {
  const { updatePost } = useStore();
  const [name, setName] = useState(post.name);
  const [description, setDescription] = useState(post.description || '');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(post.name);
    setDescription(post.description || '');
  }, [post]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name) {
      setError('Le nom est requis');
      return;
    }

    try {
      await updatePost(post.id, {
        name,
        description: description || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Modifier le Poste</h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-800 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
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
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Mettre à jour
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
