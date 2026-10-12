export const STATUSES = ['pending', 'in_progress', 'blocked', 'completed', 'failed'] as const;
export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export type Project = {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  updatedAt: string;
};
export type TaskList = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  position: number;
  createdAt: string;
};
export type Task = {
  id: string;
  projectId: string;
  listId: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  checklistTitle?: string;
  checklistIntro?: string;
  checklistNotes?: string;
};
export type Subtask = {
  id: string;
  taskId: string;
  projectId: string;
  title: string;
  description?: string;
  sectionId?: string | null;
  status: Status;
  dueDate: string | null;
  position: number;
  createdAt: string;
};
export type SubtaskSection = {
  id: string;
  taskId: string;
  projectId: string;
  title: string;
  position: number;
  createdAt: string;
};
export type Attachment = {
  id: string;
  taskId: string;
  projectId: string;
  label: string;
  filename: string;
  size: number;
  createdAt: string;
};
export type ProjectTaskLink = {
  id: string;
  taskId: string;
  targetProjectId: string;
  createdAt: string;
};
export type TaskLink = {
  id: string;
  firstTaskId: string;
  secondTaskId: string;
  createdAt: string;
};
export type ImportBatch = {
  id: string;
  projectId: string;
  targetTaskId: string | null;
  source: string;
  mode: string;
  status: 'preparing' | 'applied' | 'undoing' | 'undone' | 'needs_recovery' | 'expired';
  createdAt: string;
  lists: number;
  tasks: number;
  subtasks: number;
};
export type Snapshot = {
  projects: Project[];
  lists: TaskList[];
  tasks: Task[];
  subtasks: Subtask[];
  subtaskSections: SubtaskSection[];
  attachments: Attachment[];
  links: TaskLink[];
  projectLinks: ProjectTaskLink[];
  imports: ImportBatch[];
  attachmentsEnabled: boolean;
  databaseOnline: boolean;
  error?: string;
};
export type ImportProject = {
  name: string;
  description: string;
  lists: { title: string; tasks: {
    title: string;
    status: Status;
    priority: Priority;
    dueDate: string | null;
    subtasks: { title: string; status: Status; dueDate: string | null }[];
  }[] }[];
};
