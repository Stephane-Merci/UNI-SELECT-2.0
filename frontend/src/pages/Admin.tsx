import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import apiClient from '../api/client';
import { Worker, Post } from '../types';
import CreateWorkerModal from '../components/CreateWorkerModal';
import CreatePostModal from '../components/CreatePostModal';

export default function Admin() {
  const {
    workers,
    posts,
    fetchWorkers,
    fetchPosts,
    updatePost,
    deletePost,
  } = useStore();

  const [workerSearch, setWorkerSearch] = useState('');
  const [postSearch, setPostSearch] = useState('');
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postForm, setPostForm] = useState<{ name: string; description: string }>({
    name: '',
    description: '',
  });

  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [workerForm, setWorkerForm] = useState<{ name: string; anciennete: string; originalPostId: string; preRetraiteDay: string }>({
    name: '',
    anciennete: '',
    originalPostId: '',
    preRetraiteDay: '',
  });

  const [accountForm, setAccountForm] = useState<{ username: string; email: string }>({
    username: '',
    email: '',
  });
  const [accountMessage, setAccountMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchWorkers();
    fetchPosts();
  }, [fetchWorkers, fetchPosts]);

  const filteredWorkers = useMemo(() => {
    const q = workerSearch.trim().toLowerCase();
    const result = q
      ? workers.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.anciennete.toLowerCase().includes(q) ||
          (w.originalPost?.name ?? '').toLowerCase().includes(q)
      )
      : workers;

    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [workers, workerSearch]);

  const filteredPosts = useMemo(() => {
    const q = postSearch.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
    );
  }, [posts, postSearch]);

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
      preRetraiteDay: worker.preRetraiteDay ?? '',
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
        preRetraiteDay: workerForm.preRetraiteDay || null,
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
      const response = await apiClient.post('/auth/register', {
        username: accountForm.username,
        email: accountForm.email,
      });
      setAccountMessage(response.data.message || 'Invitation envoyée avec succès (valide 1 semaine).');
      setAccountForm({ username: '', email: '' });
      setTimeout(() => setAccountMessage(''), 8000);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Erreur lors de la création du compte';
      setError(msg);
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
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="text-xl font-semibold text-gray-800">Travailleurs</h2>
          <input
            type="text"
            placeholder="Rechercher (nom, ancienneté, poste…)"
            value={workerSearch}
            onChange={(e) => setWorkerSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-gray-300 rounded-md"
          />
          <button
            type="button"
            onClick={() => setShowWorkerModal(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            Créer Travailleur
          </button>
        </div>
        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Nom</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Ancienneté</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Poste original</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Pré-retraite</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.map((w) => (
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
                  <td className="px-3 py-2">
                    {editingWorkerId === w.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!!workerForm.preRetraiteDay}
                          onChange={(e) =>
                            setWorkerForm((f) => ({
                              ...f,
                              preRetraiteDay: e.target.checked ? (f.preRetraiteDay || 'MONDAY') : '',
                            }))
                          }
                        />
                        <span className="text-xs text-gray-700">Pré-retraite</span>
                        {workerForm.preRetraiteDay && (
                          <select
                            className="ml-2 px-2 py-1 border border-gray-300 rounded text-xs"
                            value={workerForm.preRetraiteDay}
                            onChange={(e) =>
                              setWorkerForm((f) => ({
                                ...f,
                                preRetraiteDay: e.target.value,
                              }))
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
                    ) : w.preRetraiteDay ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800">
                        Pré-retraite&nbsp;
                        {{
                          MONDAY: 'Lundi',
                          TUESDAY: 'Mardi',
                          WEDNESDAY: 'Mercredi',
                          THURSDAY: 'Jeudi',
                          FRIDAY: 'Vendredi',
                        }[w.preRetraiteDay as 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY'] ?? ''}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Aucune</span>
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
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="text-xl font-semibold text-gray-800">Postes</h2>
          <input
            type="text"
            placeholder="Rechercher (nom, description…)"
            value={postSearch}
            onChange={(e) => setPostSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-gray-300 rounded-md"
          />
          <button
            type="button"
            onClick={() => setShowPostModal(true)}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
          >
            Créer Poste
          </button>
        </div>
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
              {filteredPosts.map((p) => (
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
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 max-w-lg">
          <p className="text-sm text-gray-600 mb-4">
            Créez un nouveau compte pour un manager. Un email sera envoyé pour définir le mot de passe.
          </p>

          {accountMessage && (
            <div className="mb-4 p-3 rounded bg-green-50 text-green-800 text-sm border border-green-200">
              {accountMessage}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded bg-red-50 text-red-800 text-sm border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom d'utilisateur <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={accountForm.username}
                onChange={(e) => setAccountForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: jdoe"
                required
              />
              <p className="mt-1 text-xs text-gray-500">Utilisé pour la connexion. Format libre, min 3 caractères.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={accountForm.email}
                onChange={(e) => setAccountForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: john.doe@example.com"
                required
              />
              <p className="mt-1 text-xs text-gray-500">L'utilisateur recevra un lien pour définir son mot de passe.</p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
              >
                {loading ? 'Création en cours...' : 'Envoyer l\'invitation'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {showWorkerModal && (
        <CreateWorkerModal onClose={() => setShowWorkerModal(false)} posts={posts} />
      )}
      {showPostModal && <CreatePostModal onClose={() => setShowPostModal(false)} />}
    </div>
  );
}
