import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Post, Worker } from '../types';
import WorkerCard, { POST_DRAG_PREFIX, POST_DRAG_SEP } from './WorkerCard';
import { useStore } from '../store/useStore';
import { useState } from 'react';
import UpdatePostModal from './UpdatePostModal';
import ReassignWorkersModal from './ReassignWorkersModal';

interface PostColumnProps {
  post: Post;
  workers: Worker[];
}

export default function PostColumn({ post, workers }: PostColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: post.id,
  });
  const { deletePost, workers: allWorkers, fetchWorkers } = useStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);

  // Get workers that have this post as their originalPost
  const workersWithThisAsOriginal = allWorkers.filter(
    (w) => w.originalPostId === post.id
  );

  const handleDelete = async () => {
    // Check if any workers have this post as originalPost
    if (workersWithThisAsOriginal.length > 0) {
      setShowReassignModal(true);
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer le poste "${post.name}" ? Tous les travailleurs assignés seront déplacés vers "Non Assignés".`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await deletePost(post.id);
    } catch (error: any) {
      console.error('Failed to delete post:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Erreur lors de la suppression du poste';
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReassigned = async () => {
    await fetchWorkers();
    setIsDeleting(true);
    try {
      await deletePost(post.id);
    } catch (error: any) {
      console.error('Failed to delete post:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Erreur lors de la suppression du poste';
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col h-full min-h-0 bg-white rounded-lg p-2 min-h-0 border-2 max-w-[130px] w-full ${
        isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      }`}
    >
      <div className="flex justify-between items-start mb-2 shrink-0">
        <div className="flex-1">
          <h2 className="font-semibold text-sm text-gray-700">{post.name}</h2>
          {post.description && (
            <p className="text-xs text-gray-500 mt-1">{post.description}</p>
          )}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowUpdateModal(true)}
            className="text-blue-600 hover:text-blue-800"
            title="Modifier le poste"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Supprimer le poste"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <SortableContext
          items={workers.map((w) => `${POST_DRAG_PREFIX}${post.id}${POST_DRAG_SEP}${w.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-1 min-h-0">
            {workers.length > 0 ? (
              workers.map((worker) => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                  dragId={`${POST_DRAG_PREFIX}${post.id}${POST_DRAG_SEP}${worker.id}`}
                />
              ))
            ) : (
            <p className="text-[10px] text-gray-400 italic text-center py-2">
              Aucun travailleur assigné
            </p>
            )}
          </div>
        </SortableContext>
      </div>

      {showUpdateModal && (
        <UpdatePostModal
          post={post}
          onClose={() => setShowUpdateModal(false)}
        />
      )}

      {showReassignModal && (
        <ReassignWorkersModal
          post={post}
          workers={workersWithThisAsOriginal}
          onClose={() => setShowReassignModal(false)}
          onReassigned={handleReassigned}
        />
      )}
    </div>
  );
}
