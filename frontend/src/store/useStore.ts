import { create } from 'zustand';
import { Worker, Post, Assignment, WorkerType, Plan, WorkerPresence } from '../types';
import apiClient from '../api/client';

interface AppState {
  workers: Worker[];
  posts: Post[];
  plans: Plan[];
  currentPlan: Plan | null;
  assignments: Assignment[];
  workerPresences: WorkerPresence[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchWorkers: () => Promise<void>;
  fetchPosts: () => Promise<void>;
  fetchPlans: () => Promise<void>;
  fetchAssignments: (planId?: string) => Promise<void>;
  createPlan: (plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'assignments' | 'workerPresences'>) => Promise<void>;
  loadPlan: (planId: string) => Promise<void>;
  copyPlan: (sourcePlanId: string, name: string, date?: string) => Promise<void>;
  updatePlan: (planId: string, plan: Partial<Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deletePlan: (planId: string) => Promise<void>;
  deletePlansByRange: (start: string, end: string) => Promise<{ deleted: number }>;
  createWorker: (worker: Omit<Worker, 'id' | 'createdAt' | 'updatedAt' | 'originalPost'> & { originalPostId: string }) => Promise<void>;
  createPost: (post: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updatePost: (postId: string, post: Partial<Omit<Post, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  assignWorker: (planId: string, workerId: string, postId: string) => Promise<void>;
  updateWorkerPresence: (planId: string, workerId: string, type: WorkerType) => Promise<void>;
  updateWorkerType: (workerId: string, type: WorkerType) => Promise<void>;
  updateWorkerOriginalPost: (workerId: string, originalPostId: string) => Promise<void>;
  removeAssignment: (assignmentId: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  workers: [],
  posts: [],
  plans: [],
  currentPlan: null,
  assignments: [],
  workerPresences: [],
  loading: false,
  error: null,

  fetchWorkers: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.get('/workers');
      set({ workers: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchPosts: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.get('/posts');
      set({ posts: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchPlans: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.get('/plans');
      set({ plans: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchAssignments: async (planId?: string) => {
    set({ loading: true, error: null });
    try {
      const url = planId ? `/assignments?planId=${planId}` : '/assignments';
      const response = await apiClient.get(url);
      set({ assignments: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createPlan: async (planData) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.post('/plans', planData);
      const newPlan = response.data;
      set((state) => ({
        plans: [newPlan, ...state.plans],
        currentPlan: newPlan,
        assignments: newPlan.assignments || [],
        workerPresences: newPlan.workerPresences || [],
        loading: false,
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to create plan';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  loadPlan: async (planId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.get(`/plans/${planId}`);
      const plan = response.data;
      set({
        currentPlan: plan,
        assignments: plan.assignments || [],
        workerPresences: plan.workerPresences || [],
        loading: false,
      });
      // Also fetch assignments for this plan
      await get().fetchAssignments(planId);
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  copyPlan: async (sourcePlanId: string, name: string, date?: string) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.post(`/plans/${sourcePlanId}/copy`, {
        name,
        date,
      });
      const newPlan = response.data;
      set((state) => ({
        plans: [newPlan, ...state.plans],
        currentPlan: newPlan,
        assignments: newPlan.assignments || [],
        workerPresences: newPlan.workerPresences || [],
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updatePlan: async (planId, planData) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.put(`/plans/${planId}`, planData);
      set((state) => ({
        plans: state.plans.map((p) => (p.id === planId ? response.data : p)),
        currentPlan: state.currentPlan?.id === planId ? response.data : state.currentPlan,
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deletePlan: async (planId) => {
    set({ loading: true, error: null });
    try {
      await apiClient.delete(`/plans/${planId}`);
      set((state) => ({
        plans: state.plans.filter((p) => p.id !== planId),
        currentPlan: state.currentPlan?.id === planId ? null : state.currentPlan,
        assignments: state.currentPlan?.id === planId ? [] : state.assignments,
        workerPresences: state.currentPlan?.id === planId ? [] : state.workerPresences,
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deletePlansByRange: async (start, end) => {
    set({ loading: true, error: null });
    try {
      const { data } = await apiClient.post('/plans/bulk-delete', { start, end });
      await get().fetchPlans();
      const state = get();
      const stillHasCurrent = state.currentPlan && state.plans.some((p) => p.id === state.currentPlan!.id);
      set({
        loading: false,
        ...(!stillHasCurrent && state.currentPlan
          ? { currentPlan: null, assignments: [], workerPresences: [] }
          : {}),
      });
      return data;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  createWorker: async (workerData) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.post('/workers', workerData);
      set((state) => ({
        workers: [...state.workers, response.data],
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  createPost: async (postData) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.post('/posts', postData);
      set((state) => ({
        posts: [...state.posts, response.data],
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updatePost: async (postId, postData) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.put(`/posts/${postId}`, postData);
      set((state) => ({
        posts: state.posts.map((p) => (p.id === postId ? response.data : p)),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deletePost: async (postId) => {
    set({ loading: true, error: null });
    try {
      await apiClient.delete(`/posts/${postId}`);
      set((state) => ({
        posts: state.posts.filter((p) => p.id !== postId),
        assignments: state.assignments.filter((a) => a.postId !== postId),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  assignWorker: async (planId, workerId, postId) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.post('/assignments', {
        planId,
        workerId,
        postId,
      });
      set((state) => {
        // Remove existing assignment for this worker in this plan if exists
        const filtered = state.assignments.filter(
          (a) => !(a.planId === planId && a.workerId === workerId)
        );
        return {
          assignments: [...filtered, response.data],
          loading: false,
        };
      });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateWorkerPresence: async (planId, workerId, type) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.put(`/plans/${planId}/presence/${workerId}`, { type });
      set((state) => {
        const filtered = state.workerPresences.filter(
          (p) => !(p.planId === planId && p.workerId === workerId)
        );
        return {
          workerPresences: [...filtered, response.data],
          loading: false,
        };
      });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateWorkerType: async (workerId, type) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.patch(`/workers/${workerId}/type`, { type });
      set((state) => ({
        workers: state.workers.map((w) =>
          w.id === workerId ? response.data : w
        ),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateWorkerOriginalPost: async (workerId, originalPostId) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.put(`/workers/${workerId}`, {
        originalPostId,
      });
      set((state) => ({
        workers: state.workers.map((w) =>
          w.id === workerId ? response.data : w
        ),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  removeAssignment: async (assignmentId) => {
    set({ loading: true, error: null });
    try {
      await apiClient.delete(`/assignments/${assignmentId}`);
      set((state) => ({
        assignments: state.assignments.filter((a) => a.id !== assignmentId),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
}));
