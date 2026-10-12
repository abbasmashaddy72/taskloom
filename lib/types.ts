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
};
export type Subtask = {
  id: string;
  taskId: string;
  projectId: string;
  title: string;
  status: Status;
  dueDate: string | null;
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
export type Snapshot = {
  projects: Project[];
  lists: TaskList[];
  tasks: Task[];
  subtasks: Subtask[];
  attachments: Attachment[];
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
