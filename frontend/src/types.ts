export enum WorkerType {
  // 6 origin types (Worker.type and create-worker dropdown only)
  PERMANENT_JOUR = 'PERMANENT_JOUR',
  PERMANENT_SOIR = 'PERMANENT_SOIR',
  OCCASIONEL_DU_JOUR = 'OCCASIONEL_DU_JOUR',
  OCCASIONEL_SOIR = 'OCCASIONEL_SOIR',
  MOBILITE_DU_JOUR = 'MOBILITE_DU_JOUR',
  MOBILITE_DU_SOIR = 'MOBILITE_DU_SOIR',
  // Presence-only (WorkerPresence; not in create-worker dropdown)
  JOUR = 'JOUR',
  SOIR = 'SOIR',
  ABSENT = 'ABSENT',
  VACANCES = 'VACANCES',
  LIBERATION_EXTERNE = 'LIBERATION_EXTERNE',
  INVALIDITE = 'INVALIDITE',
  PRERETRAITE = 'PRERETRAITE',
  CONGE_PARENTAL = 'CONGE_PARENTAL',
}

/** The 6 origin types: used for Worker.type and in create-worker dropdown. Drag within these updates Worker.type. */
export const ORIGIN_TYPES: WorkerType[] = [
  WorkerType.PERMANENT_JOUR,
  WorkerType.PERMANENT_SOIR,
  WorkerType.OCCASIONEL_DU_JOUR,
  WorkerType.OCCASIONEL_SOIR,
  WorkerType.MOBILITE_DU_JOUR,
  WorkerType.MOBILITE_DU_SOIR,
];

export const WorkerTypeLabels: Record<WorkerType, string> = {
  [WorkerType.PERMANENT_JOUR]: 'Permanent jour',
  [WorkerType.PERMANENT_SOIR]: 'Permanent soir',
  [WorkerType.OCCASIONEL_DU_JOUR]: 'Occasionel du jour',
  [WorkerType.OCCASIONEL_SOIR]: 'Occasionel du soir',
  [WorkerType.MOBILITE_DU_JOUR]: 'Mobilité du jour',
  [WorkerType.MOBILITE_DU_SOIR]: 'Mobilité du soir',
  [WorkerType.JOUR]: 'Jour',
  [WorkerType.SOIR]: 'Soir',
  [WorkerType.ABSENT]: 'Absent',
  [WorkerType.VACANCES]: 'Vacances',
  [WorkerType.LIBERATION_EXTERNE]: 'Libération externe',
  [WorkerType.INVALIDITE]: 'Invalidité',
  [WorkerType.PRERETRAITE]: 'Préretraite',
  [WorkerType.CONGE_PARENTAL]: 'Congé parental',
};

export const WorkerTypeColors: Record<WorkerType, string> = {
  [WorkerType.PERMANENT_JOUR]: '#2563EB',
  [WorkerType.PERMANENT_SOIR]: '#7C3AED',
  [WorkerType.OCCASIONEL_DU_JOUR]: '#3B82F6',
  [WorkerType.OCCASIONEL_SOIR]: '#8B5CF6',
  [WorkerType.MOBILITE_DU_JOUR]: '#0EA5E9',
  [WorkerType.MOBILITE_DU_SOIR]: '#A78BFA',
  [WorkerType.JOUR]: '#3B82F6',
  [WorkerType.SOIR]: '#8B5CF6',
  [WorkerType.ABSENT]: '#EF4444',
  [WorkerType.VACANCES]: '#10B981',
  [WorkerType.LIBERATION_EXTERNE]: '#F59E0B',
  [WorkerType.INVALIDITE]: '#6B7280',
  [WorkerType.PRERETRAITE]: '#EC4899',
  [WorkerType.CONGE_PARENTAL]: '#14B8A6',
};

export interface Worker {
  id: string;
  anciennete: string;
  name: string;
  type: WorkerType;
  originalPostId: string;
  originalPost: Post;
  assignments?: Assignment[];
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  name: string;
  description?: string;
  assignments?: Assignment[];
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: string;
  name: string;
  date?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  assignments?: Assignment[];
  workerPresences?: WorkerPresence[];
}

export interface Assignment {
  id: string;
  planId: string;
  plan?: Plan;
  workerId: string;
  worker: Worker;
  postId: string;
  post: Post;
  assignedAt: string;
  assignedBy?: string;
}

export interface WorkerPresence {
  id: string;
  planId: string;
  plan?: Plan;
  workerId: string;
  worker: Worker;
  type: WorkerType;
  updatedAt: string;
}
