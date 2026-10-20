import type { DB, ProjectRequest, User } from './types';
import type { ToastType } from './ui';

export interface PrintPayload {
  foremanFio: string;
  crewName: string;
  simDate: string;
  items: ProjectRequest[];
}

export interface Ctx {
  db: DB;
  user: User;
  simDate: string;
  toast: (type: ToastType, title: string, msg?: string) => void;
  act: (title: string, fn: (db: DB) => DB, opts?: { extra?: string; stage?: 'upload' | 'approval' | 'lobe' }) => boolean;
  openCard: (id: string) => void;
  setPrint: (p: PrintPayload | null) => void;
}
