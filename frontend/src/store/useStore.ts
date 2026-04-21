import { create } from 'zustand';
import { Worker, Post, Assignment, WorkerType, Plan, WorkerPresence, MachineryCheck } from '../types';
import apiClient from '../api/client';

const PLAN_POST_ORDER_KEY = 'plan-post-order';
const PLAN_LOCKED_POSTS_KEY = 'plan-locked-posts';
// Single layout key for all plans so post order and lock state are consistent across plans
const PLAN_LAYOUT_GLOBAL_KEY = 'global';

function loadPlanPostOrder(planId: string): string[] | null {
  try {
    const key = planId === 'work-allocation' ? planId : PLAN_LAYOUT_GLOBAL_KEY;
    const raw = localStorage.getItem(`${PLAN_POST_ORDER_KEY}-${key}`);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

function savePlanPostOrder(planId: string, order: string[]) {
  try {
    const key = planId === 'work-allocation' ? planId : PLAN_LAYOUT_GLOBAL_KEY;
    localStorage.setItem(`${PLAN_POST_ORDER_KEY}-${key}`, JSON.stringify(order));
  } catch {
    // ignore
  }
}

function loadPlanLockedPosts(planId: string): Set<string> {
  try {
    const key = planId === 'work-allocation' ? planId : PLAN_LAYOUT_GLOBAL_KEY;
    const raw = localStorage.getItem(`${PLAN_LOCKED_POSTS_KEY}-${key}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function savePlanLockedPosts(planId: string, locked: Set<string>) {
  try {
    const key = planId === 'work-allocation' ? planId : PLAN_LAYOUT_GLOBAL_KEY;
    localStorage.setItem(`${PLAN_LOCKED_POSTS_KEY}-${key}`, JSON.stringify([...locked]));
  } catch {
    // ignore
  }
}

interface AppState {
  workers: Worker[];
  posts: Post[];
  plans: Plan[];
  currentPlan: Plan | null;
  assignments: Assignment[];
  workerPresences: WorkerPresence[];
  /** Bump to force re-render when plan layout (order/lock) changes. */
  planLayoutVersion: Record<string, number>;
  isFullScreen: boolean;
  setFullScreen: (isFullScreen: boolean) => void;
  loading: boolean;
  error: string | null;
  machineryChecks: MachineryCheck[];

  getPlanPostOrder: (planId: string, postIds: string[]) => string[];
  setPlanPostOrder: (planId: string, order: string[]) => void;
  getPlanLockedPosts: (planId: string) => Set<string>;
  togglePlanPostLock: (planId: string, postId: string) => void;

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
  updateWorkerType: (workerId: string, type: WorkerType, absenceEndDate?: string | null) => Promise<void>;
  updateWorkerOriginalPost: (workerId: string, originalPostId: string) => Promise<void>;
  removeAssignment: (assignmentId: string) => Promise<void>;
  addUnfilledPosition: (planId: string, postId: string) => Promise<void>;
  deleteUnfilledPosition: (unfilledPositionId: string) => Promise<void>;
  resetPlan: (planId: string) => Promise<void>;
  fetchMachineryChecks: (planId: string) => Promise<void>;
  updateMachineryCheck: (data: {
    planId: string;
    postId: string;
    workerId: string;
    checked: boolean;
  }) => Promise<void>;
  updatePostMachineryStatus: (postId: string, status: 'GOOD' | 'FAULTY' | 'UNKNOWN') => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  workers: [],
  posts: [],
  plans: [],
  currentPlan: null,
  assignments: [],
  workerPresences: [],
  machineryChecks: [],
  planLayoutVersion: {},
  isFullScreen: false,
  setFullScreen: (isFullScreen) => set({ isFullScreen }),
  loading: false,
  error: null,

  getPlanPostOrder: (planId, postIds) => {
    const saved = loadPlanPostOrder(planId);
    if (!saved?.length) return postIds;
    const order = saved.filter((id) => postIds.includes(id));
    const appended = postIds.filter((id) => !saved.includes(id));
    return [...order, ...appended];
  },

  setPlanPostOrder: (planId, order) => {
    savePlanPostOrder(planId, order);
    const versionKey = planId === 'work-allocation' ? planId : PLAN_LAYOUT_GLOBAL_KEY;
    set((state) => ({
      planLayoutVersion: { ...state.planLayoutVersion, [versionKey]: Date.now() },
    }));
  },

  getPlanLockedPosts: (planId) => loadPlanLockedPosts(planId),

  togglePlanPostLock: (planId, postId) => {
    const locked = loadPlanLockedPosts(planId);
    if (locked.has(postId)) locked.delete(postId);
    else locked.add(postId);
    savePlanLockedPosts(planId, locked);
    const versionKey = planId === 'work-allocation' ? planId : PLAN_LAYOUT_GLOBAL_KEY;
    set((state) => ({
      planLayoutVersion: { ...state.planLayoutVersion, [versionKey]: Date.now() },
    }));
  },

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
    // Optimistic update
    const previousAssignments = get().assignments;
    const optimisticAssignment: Assignment = {
      id: `temp-${Date.now()}`,
      planId,
      workerId,
      postId,
      assignedAt: new Date().toISOString(),
      worker: get().workers.find((w) => w.id === workerId)!,
      post: get().posts.find((p) => p.id === postId)!,
    };

    set((state) => {
      const filtered = state.assignments.filter(
        (a) => !(a.planId === planId && a.workerId === workerId)
      );
      return { assignments: [...filtered, optimisticAssignment] };
    });

    try {
      const response = await apiClient.post('/assignments', {
        planId,
        workerId,
        postId,
      });
      set((state) => {
        const filtered = state.assignments.filter(
          (a) => a.id !== optimisticAssignment.id && !(a.planId === planId && a.workerId === workerId)
        );
        return { assignments: [...filtered, response.data] };
      });
    } catch (error: any) {
      set({ assignments: previousAssignments, error: error.message });
      throw error;
    }
  },

  updateWorkerPresence: async (planId, workerId, type) => {
    // Optimistic update
    const previousPresences = get().workerPresences;
    const optimisticPresence: WorkerPresence = {
      id: `temp-pres-${Date.now()}`,
      planId,
      workerId,
      type,
      updatedAt: new Date().toISOString(),
      worker: get().workers.find((w) => w.id === workerId)!,
    };

    set((state) => {
      const filtered = state.workerPresences.filter(
        (p) => !(p.planId === planId && p.workerId === workerId)
      );
      return { workerPresences: [...filtered, optimisticPresence] };
    });

    try {
      const response = await apiClient.put(`/plans/${planId}/presence/${workerId}`, { type });
      set((state) => {
        const filtered = state.workerPresences.filter(
          (p) => p.id !== optimisticPresence.id && !(p.planId === planId && p.workerId === workerId)
        );
        return { workerPresences: [...filtered, response.data] };
      });
    } catch (error: any) {
      set({ workerPresences: previousPresences, error: error.message });
      throw error;
    }
  },

  updateWorkerType: async (workerId, type, absenceEndDate) => {
    // Optimistic update
    const previousWorkers = get().workers;
    set((state) => ({
      workers: state.workers.map((w) =>
        w.id === workerId ? { ...w, type, absenceEndDate: absenceEndDate ?? w.absenceEndDate } : w
      ),
    }));

    try {
      const response = await apiClient.patch(`/workers/${workerId}/type`, { type, absenceEndDate });
      set((state) => ({
        workers: state.workers.map((w) =>
          w.id === workerId ? response.data : w
        ),
      }));
    } catch (error: any) {
      set({ workers: previousWorkers, error: error.message });
      throw error;
    }
  },

  updateWorkerOriginalPost: async (workerId, originalPostId) => {
    // Optimistic update
    const previousWorkers = get().workers;
    set((state) => ({
      workers: state.workers.map((w) =>
        w.id === workerId ? { ...w, originalPostId } : w
      ),
    }));

    try {
      const response = await apiClient.put(`/workers/${workerId}`, {
        originalPostId,
      });
      set((state) => ({
        workers: state.workers.map((w) =>
          w.id === workerId ? response.data : w
        ),
      }));
    } catch (error: any) {
      set({ workers: previousWorkers, error: error.message });
      throw error;
    }
  },

  removeAssignment: async (assignmentId) => {
    // Optimistic update
    const previousAssignments = get().assignments;
    set((state) => ({
      assignments: state.assignments.filter((a) => a.id !== assignmentId),
    }));

    try {
      await apiClient.delete(`/assignments/${assignmentId}`);
    } catch (error: any) {
      set({ assignments: previousAssignments, error: error.message });
      throw error;
    }
  },

  addUnfilledPosition: async (planId, postId) => {
    try {
      const response = await apiClient.post(`/plans/${planId}/unfilled-positions`, { postId });
      set((state) => {
        if (state.currentPlan?.id === planId) {
          return {
            currentPlan: {
              ...state.currentPlan,
              unfilledPositions: [...(state.currentPlan.unfilledPositions || []), response.data],
            },
          };
        }
        return state;
      });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteUnfilledPosition: async (unfilledPositionId) => {
    try {
      await apiClient.delete(`/plans/unfilled-positions/${unfilledPositionId}`);
      set((state) => {
        if (state.currentPlan) {
          return {
            currentPlan: {
              ...state.currentPlan,
              unfilledPositions: state.currentPlan.unfilledPositions?.filter((up) => up.id !== unfilledPositionId),
            },
          };
        }
        return state;
      });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  resetPlan: async (planId) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.post(`/plans/${planId}/reset`);
      const resetPlan = response.data;
      set({
        currentPlan: resetPlan,
        assignments: resetPlan.assignments || [],
        workerPresences: resetPlan.workerPresences || [],
        loading: false,
      });
      // Real-time update will be handled by socket, but we return early
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  fetchMachineryChecks: async (planId) => {
    try {
      const response = await apiClient.get(`/machinery/plan/${planId}`);
      set({ machineryChecks: response.data });
    } catch (error: any) {
      console.error('Failed to fetch machinery checks:', error);
    }
  },
  updateMachineryCheck: async (data) => {
    try {
      const response = await apiClient.post('/machinery/check', data);
      set((state) => {
        const filtered = state.machineryChecks.filter(
          (c) => !(c.planId === data.planId && c.postId === data.postId && c.workerId === data.workerId)
        );
        return { machineryChecks: [...filtered, response.data] };
      });
    } catch (error: any) {
      console.error('Failed to update machinery check:', error);
    }
  },
  updatePostMachineryStatus: async (postId, status) => {
    try {
      const response = await apiClient.put(`/machinery/post/${postId}/status`, { status });
      set((state) => ({
        posts: state.posts.map((p) => (p.id === postId ? response.data : p)),
      }));
    } catch (error: any) {
      console.error('Failed to update post machinery status:', error);
    }
  },
}));
