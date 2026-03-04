import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import apiClient from '../api/client';
import { Worker, Post } from '../types';
import CreateWorkerModal from '../components/CreateWorkerModal';
import CreatePostModal from '../components/CreatePostModal';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  itemName: string;
}

function DeleteConfirmationModal({ isOpen, onClose, onConfirm, title, message, itemName }: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all">
        <div className="bg-red-50 p-6 flex items-center gap-4">
          <div className="bg-red-100 p-3 rounded-full text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.34c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-red-900">{title}</h3>
            <p className="text-red-700 text-sm mt-1">{message}</p>
          </div>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-6">
            Cette action est irréversible. Voulez-vous vraiment supprimer <strong>{itemName}</strong> ?
          </p>
          <div className="flex gap-4 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  const [accountForm, setAccountForm] = useState<{ username: string; password: string; confirmPassword: string }>({
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [accountMessage, setAccountMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'worker' | 'post';
    id: string;
    name: string;
  }>({
    isOpen: false,
    type: 'worker',
    id: '',
    name: '',
  });

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

  const confirmDeletePost = (post: Post) => {
    setDeleteModal({
      isOpen: true,
      type: 'post',
      id: post.id,
      name: post.name,
    });
  };

  const handleDeletePost = async (postId: string) => {
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

  const confirmDeleteWorker = (worker: Worker) => {
    setDeleteModal({
      isOpen: true,
      type: 'worker',
      id: worker.id,
      name: worker.name,
    });
  };

  const handleDeleteWorker = async (workerId: string) => {
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

    if (accountForm.password !== accountForm.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post('/auth/register', {
        username: accountForm.username,
        password: accountForm.password,
      });
      setAccountMessage(response.data.message || 'Compte créé avec succès.');
      setAccountForm({ username: '', password: '', confirmPassword: '' });
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
            className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowWorkerModal(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm"
          >
            Créer Travailleur
          </button>
        </div>
        <div className="overflow-x-auto bg-white rounded-xl shadow-md border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Nom</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Ancienneté</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Poste original</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Pré-retraite</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredWorkers.map((w) => (
                <tr key={w.id} className="hover:bg-blue-50 transition-colors even:bg-gray-100">
                  <td className="px-4 py-3">
                    {editingWorkerId === w.id ? (
                      <input
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                        value={workerForm.name}
                        onChange={(e) => setWorkerForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{w.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {editingWorkerId === w.id ? (
                      <input
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                        value={workerForm.anciennete}
                        onChange={(e) => setWorkerForm((f) => ({ ...f, anciennete: e.target.value }))}
                      />
                    ) : (
                      w.anciennete
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {editingWorkerId === w.id ? (
                      <select
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
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
                  <td className="px-4 py-3">
                    {editingWorkerId === w.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 rounded"
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
                            className="ml-2 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        {
                          {
                            MONDAY: 'Lundi',
                            TUESDAY: 'Mardi',
                            WEDNESDAY: 'Mercredi',
                            THURSDAY: 'Jeudi',
                            FRIDAY: 'Vendredi',
                          }[w.preRetraiteDay as 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY'] ?? 'Activé'
                        }
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Aucune</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {editingWorkerId === w.id ? (
                      <>
                        <button
                          type="button"
                          onClick={submitWorkerEdit}
                          disabled={loading}
                          className="px-3 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors"
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingWorkerId(null)}
                          className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditWorker(w)}
                          className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDeleteWorker(w)}
                          className="px-3 py-1 text-xs font-medium rounded-md bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all border border-red-100"
                        >
                          Supprimer
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filteredWorkers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500 italic">
                    Aucun travailleur trouvé
                  </td>
                </tr>
              )}
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
            className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
          />
          <button
            type="button"
            onClick={() => setShowPostModal(true)}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors shadow-sm"
          >
            Créer Poste
          </button>
        </div>
        <div className="overflow-x-auto bg-white rounded-xl shadow-md border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Nom</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPosts.map((p) => (
                <tr key={p.id} className="hover:bg-green-50 transition-colors even:bg-gray-100">
                  <td className="px-4 py-3">
                    {editingPostId === p.id ? (
                      <input
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500 outline-none"
                        value={postForm.name}
                        onChange={(e) => setPostForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{p.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {editingPostId === p.id ? (
                      <input
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500 outline-none"
                        value={postForm.description}
                        onChange={(e) => setPostForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    ) : (
                      p.description || <span className="text-gray-400 italic">Sans description</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {editingPostId === p.id ? (
                      <>
                        <button
                          type="button"
                          onClick={submitPostEdit}
                          disabled={loading}
                          className="px-3 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors"
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPostId(null)}
                          className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditPost(p)}
                          className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-green-600 hover:bg-green-50 transition-colors"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDeletePost(p)}
                          className="px-3 py-1 text-xs font-medium rounded-md bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all border border-red-100"
                        >
                          Supprimer
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filteredPosts.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-gray-500 italic">
                    Aucun poste trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Accounts management */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-3">Comptes (Managers)</h2>
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 max-w-lg">
          <p className="text-sm text-gray-600 mb-6">
            Créez un nouveau compte manager en définissant un identifiant et un mot de passe.
          </p>

          {accountMessage && (
            <div className="mb-4 p-4 rounded-lg bg-green-50 text-green-800 text-sm border border-green-100 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4.006-5.503Z" clipRule="evenodd" />
              </svg>
              {accountMessage}
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 text-red-800 text-sm border border-red-100 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-400">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nom d'utilisateur <span className="text-red-500 font-normal">*</span>
              </label>
              <input
                type="text"
                value={accountForm.username}
                onChange={(e) => setAccountForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                placeholder="Ex: jdoe"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Mot de passe <span className="text-red-500 font-normal">*</span>
                </label>
                <input
                  type="password"
                  value={accountForm.password}
                  onChange={(e) => setAccountForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Confirmer le mot de passe <span className="text-red-500 font-normal">*</span>
                </label>
                <input
                  type="password"
                  value={accountForm.confirmPassword}
                  onChange={(e) => setAccountForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Création en cours...
                  </span>
                ) : 'Créer le compte'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {showWorkerModal && (
        <CreateWorkerModal onClose={() => setShowWorkerModal(false)} posts={posts} />
      )}
      {showPostModal && <CreatePostModal onClose={() => setShowPostModal(false)} />}

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          if (deleteModal.type === 'worker') handleDeleteWorker(deleteModal.id);
          else handleDeletePost(deleteModal.id);
        }}
        title={`Supprimer le ${deleteModal.type === 'worker' ? 'travailleur' : 'poste'}`}
        message={`Vous êtes sur le point de supprimer définivement cet élément.`}
        itemName={deleteModal.name}
      />
    </div>
  );
}
