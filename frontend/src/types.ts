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

// Colors per table: Postes fixes jour=Vert, Mobiles jour=Violet, Occasionnels jours=Bleu,
// Postes fixes soir=Jaune, Mobiles soir=Orange, Occasionnels soir=Marron, Absents=Rouge
export const WorkerTypeColors: Record<WorkerType, string> = {
  [WorkerType.PERMANENT_JOUR]: '#008000',   // Vert (Postes fixes de jour)
  [WorkerType.PERMANENT_SOIR]: '#FFFF00',    // Jaune (Postes fixes de soir)
  [WorkerType.OCCASIONEL_DU_JOUR]: '#0000FF',   // Bleu (Occasionnels jours)
  [WorkerType.OCCASIONEL_SOIR]: '#A52A2A',  // Marron (Occasionnels de soir)
  [WorkerType.MOBILITE_DU_JOUR]: '#EE82EE',     // Violet (Mobiles de jour)
  [WorkerType.MOBILITE_DU_SOIR]: '#FFA500',     // Orange (Mobiles de soir)
  [WorkerType.JOUR]: '#0000FF',
  [WorkerType.SOIR]: '#EE82EE',
  [WorkerType.ABSENT]: '#FF0000',            // Rouge (Absents)
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
