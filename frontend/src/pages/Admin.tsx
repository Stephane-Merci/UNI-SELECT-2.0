import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import apiClient from '../api/client';
import { Worker, Post } from '../types';

export default function Admin() {
  const {
    workers,
    posts,
    fetchWorkers,
    fetchPosts,
    updatePost,
    deletePost,
  } = useStore();

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postForm, setPostForm] = useState<{ name: string; description: string }>({
    name: '',
    description: '',
  });

  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [workerForm, setWorkerForm] = useState<{ name: string; anciennete: string; originalPostId: string }>({
    name: '',
    anciennete: '',
    originalPostId: '',
  });

  const [accountForm, setAccountForm] = useState<{ username: string; email: string; password: string }>({
    username: '',
    email: '',
    password: '',
  });
  const [accountMessage, setAccountMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchWorkers();
    fetchPosts();
  }, [fetchWorkers, fetchPosts]);

  const startEditPost = (post: Post) => {
    setEditingPostId(post.id);
    setPostForm({ name: post.name, description: post.description || '' });
  };

  const submitPostEdit = async () => {
    if (!editingPostId) return;
    setLoading(true);
    setError('');
    try {
      await updatePost(editingPostId, postForm);
      setEditingPostId(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Erreur lors de la mise à jour du poste');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Supprimer ce poste ?')) return;
    setLoading(true);
    setError('');
    try {
      await deletePost(postId);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Erreur lors de la suppression du poste');
    } finally {
      setLoading(false);
    }
  };

  const startEditWorker = (worker: Worker) => {
    setEditingWorkerId(worker.id);
    setWorkerForm({
      name: worker.name,
      anciennete: worker.anciennete,
      originalPostId: worker.originalPostId,
    });
  };

  const submitWorkerEdit = async () => {
    if (!editingWorkerId) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.put(`/workers/${editingWorkerId}`, {
        name: workerForm.name,
        anciennete: workerForm.anciennete,
        originalPostId: workerForm.originalPostId,
      });
      await fetchWorkers();
      setEditingWorkerId(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Erreur lors de la mise à jour du travailleur');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorker = async (workerId: string) => {
    if (!confirm('Supprimer ce travailleur ?')) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.delete(`/workers/${workerId}`);
      await fetchWorkers();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Erreur lors de la suppression du travailleur');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMessage('');
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/register', {
        username: accountForm.username,
        email: accountForm.email,
        password: accountForm.password,
      });
      setAccountMessage('Compte créé avec succès.');
      setAccountForm({ username: '', email: '', password: '' });
      setTimeout(() => setAccountMessage(''), 4000);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Administration</h1>
      {error && (
        <div className="p-3 rounded bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Workers management */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-3">Travailleurs</h2>
        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Nom</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Ancienneté</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Poste original</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    {editingWorkerId === w.id ? (
                      <input
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        value={workerForm.name}
                        onChange={(e) => setWorkerForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    ) : (
                      w.name
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingWorkerId === w.id ? (
                      <input
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        value={workerForm.anciennete}
                        onChange={(e) => setWorkerForm((f) => ({ ...f, anciennete: e.target.value }))}
                      />
                    ) : (
                      w.anciennete
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingWorkerId === w.id ? (
                      <select
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        value={workerForm.originalPostId}
                        onChange={(e) => setWorkerForm((f) => ({ ...f, originalPostId: e.target.value }))}
                      >
                        <option value="">Sélectionner un poste</option>
                        {posts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      w.originalPost?.name ?? '-'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    {editingWorkerId === w.id ? (
                      <>
                        <button
                          type="button"
                          onClick={submitWorkerEdit}
                          disabled={loading}
                          className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingWorkerId(null)}
                          className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditWorker(w)}
                          className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWorker(w.id)}
                          className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          Supprimer
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Posts management */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-3">Postes</h2>
        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Nom</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Description</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    {editingPostId === p.id ? (
                      <input
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        value={postForm.name}
                        onChange={(e) => setPostForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    ) : (
                      p.name
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingPostId === p.id ? (
                      <input
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        value={postForm.description}
                        onChange={(e) => setPostForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    ) : (
                      p.description || ''
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    {editingPostId === p.id ? (
                      <>
                        <button
                          type="button"
                          onClick={submitPostEdit}
                          disabled={loading}
                          className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPostId(null)}
                          className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditPost(p)}
                          className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePost(p.id)}
                          className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          Supprimer
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Accounts management */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-3">Comptes (Managers)</h2>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 max-w-md">
          {accountMessage && (
            <div className="mb-3 p-2 rounded bg-green-50 text-green-800 text-sm">
              {accountMessage}
            </div>
          )}
          <form onSubmit={handleCreateAccount} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom d'utilisateur
              </label>
              <input
                type="text"
                value={accountForm.username}
                onChange={(e) => setAccountForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={accountForm.email}
                onChange={(e) => setAccountForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                value={accountForm.password}
                onChange={(e) => setAccountForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Créer un compte
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

