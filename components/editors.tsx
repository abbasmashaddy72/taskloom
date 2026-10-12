'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, ListTodo } from 'lucide-react';
import { createList, createProject, createSubtask, createTask, deleteList, deleteProject, deleteSubtask, deleteTask, updateList, updateProject, updateSubtask, updateSubtaskStatus, updateTask } from '@/lib/actions';
import type { Project, Snapshot, Status, Subtask, Task, TaskList, Priority } from '@/lib/types';
import { PRIORITIES, STATUSES } from '@/lib/types';
import { Dialog, FormField, ModalFooter, ProgressBar, StatusIcon, statusInfo } from './shared';
import { AttachmentFields, uploadFiles, type FileRow } from './attachment-fields';

export type Editor =
  | { type: 'project'; project?: Project }
  | { type: 'list'; projectId: string; list?: TaskList }
  | { type: 'task'; projectId: string; listId: string; task?: Task }
  | { type: 'subtask'; taskId: string; subtask?: Subtask };

export type Executor = (work: () => Promise<unknown>, success: string, done?: (result: unknown) => void, keepOpen?: boolean) => Promise<void>;

type Props = { editor: Editor; data: Snapshot; loading: boolean; close: () => void; run: Executor; open: (editor: Editor) => void };

const COLORS = ['#7366e8', '#4f9cdc', '#48b59b', '#efad61', '#d67b9b', '#a387e6', '#e08469', '#5ca8b4'];

export function EditorModal(props: Props) {
  const {editor, close} = props;
  return <Dialog title={editor.type === 'project' ? editor.project ? 'Edit project' : 'Create a project' : editor.type === 'list' ? editor.list ? 'Edit task list' : 'New task list' : editor.type === 'task' ? editor.task ? 'Task details' : 'Create a task' : editor.subtask ? 'Edit subtask' : 'Add a subtask'} subtitle={editor.type === 'project' ? 'Keep everything organized in its own space.' : editor.type === 'task' ? 'Plan the work and keep progress visible.' : undefined} onClose={close} wide={editor.type === 'task'}>
    {editor.type === 'project' && <ProjectForm {...props} editor={editor} />}
    {editor.type === 'list' && <ListForm {...props} editor={editor} />}
    {editor.type === 'task' && <TaskForm {...props} editor={editor} />}
    {editor.type === 'subtask' && <SubtaskForm {...props} editor={editor} />}
  </Dialog>;
}

function ProjectForm({editor, loading, close, run}: Props & {editor: Extract<Editor,{type:'project'}>}) {
  const [title, setTitle] = useState(editor.project?.name ?? '');
  const [desc, setDesc] = useState(editor.project?.description ?? '');
  const [color, setColor] = useState(editor.project?.color ?? '#7366e8');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await run(() => editor.project ? updateProject(editor.project.id,{name:title,description:desc,color}) : createProject({name:title,description:desc,color}), editor.project ? 'Project updated' : 'Project created', result => {
      if (!editor.project && result && typeof result === 'object' && 'id' in result) window.dispatchEvent(new CustomEvent('taskloom:new-project',{ detail: String(result.id) }));
    });
  };
  return <form onSubmit={submit}>
    <div className="space-y-4 px-6 pb-2">
      <FormField label="Project name"><input autoFocus required maxLength={160} className="field" placeholder="e.g. Insure360" value={title} onChange={e=>setTitle(e.target.value)}/></FormField>
      <FormField label="Description"><textarea className="field min-h-22 resize-y" maxLength={5000} placeholder="What is this project about?" value={desc} onChange={e=>setDesc(e.target.value)}/></FormField>
      <FormField label="Project color"><div className="flex flex-wrap gap-3 py-1">{COLORS.map(c=><button type="button" key={c} aria-label={`Set project color ${c}`} aria-pressed={color===c} onClick={()=>setColor(c)} className="flex h-9 w-9 items-center justify-center rounded-xl transition hover:scale-105" style={{background:c, boxShadow:color===c?`0 0 0 3px var(--surface), 0 0 0 5px ${c}`:undefined}}>{color===c&&<span className="text-lg font-bold text-white">✓</span>}</button>)}</div></FormField>
      {editor.project && <button type="button" className="btn btn-danger" disabled={loading} onClick={()=>{if(window.confirm(`Permanently delete “${editor.project!.name}” and all its lists, tasks and subtasks?`)) void run(()=>deleteProject(editor.project!.id),'Project deleted');}}><Trash2 size={15}/> Delete project</button>}
    </div>
    <ModalFooter loading={loading} onClose={close} submitLabel={editor.project?'Save project':'Create project'}/>
  </form>;
}
function ListForm({editor, loading, close, run}: Props & {editor: Extract<Editor,{type:'list'}>}) {
  const [title, setTitle] = useState(editor.list?.title ?? '');
  const [desc, setDesc] = useState(editor.list?.description ?? '');
  return <form onSubmit={e=>{e.preventDefault(); void run(()=>editor.list?updateList(editor.list.id,{title,description:desc}):createList({projectId:editor.projectId,title,description:desc}),editor.list?'List updated':'List created');}}>
    <div className="space-y-4 px-6 pb-2">
      <FormField label="List name"><input autoFocus required className="field" placeholder="e.g. Backlog, In progress, Release" maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></FormField>
      <FormField label="Description (optional)"><textarea className="field min-h-20 resize-y" maxLength={5000} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What belongs in this list?"/></FormField>
      {editor.list&&<button type="button" className="btn btn-danger" disabled={loading} onClick={()=>{if(window.confirm(`Delete “${editor.list!.title}” and all tasks inside it?`)) void run(()=>deleteList(editor.list!.id),'List deleted');}}><Trash2 size={15}/> Delete list</button>}
    </div><ModalFooter loading={loading} onClose={close} submitLabel={editor.list?'Save list':'Create list'}/>
  </form>;
}
function TaskForm({editor, data, loading, close, run, open}: Props & {editor: Extract<Editor,{type:'task'}>}) {
  const task = editor.task;
  const lists = data.lists.filter(l=>l.projectId===editor.projectId);
  const [title, setTitle] = useState(task?.title ?? '');
  const [desc, setDesc] = useState(task?.description ?? '');
  const [listId, setListId] = useState(task?.listId ?? editor.listId);
  const [state, setState] = useState<Status>(task?.status ?? 'pending');
  const [prio, setPrio] = useState<Priority>(task?.priority ?? 'medium');
  const [date, setDate] = useState(task?.dueDate ?? '');
  const [pending, setPending] = useState<FileRow[]>([]);
  const [persistedId,setPersistedId] = useState<string|null>(task?.id??null);
  const existing = data.attachments.filter(attachment => attachment.taskId === (persistedId??task?.id));
  const save = async () => {
    const input = {projectId:editor.projectId,listId,title,description:desc,status:state,priority:prio,dueDate:date};
    if (persistedId) await updateTask(persistedId,input);
    else {
      const created = await createTask(input);
      setPersistedId(created.id);
      if (!created.id) throw new Error('Task was saved, but the task identifier is missing.');
      // Keep the created task ID even if a subsequent S3 upload fails, avoiding duplicate tasks on retry.
      if (pending.length) {
        try { await uploadFiles(created.id,pending); }
        catch (error) { throw new Error(`Task created, but attachment upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Retry saving to upload files.`); }
      }
      return created;
    }
    if (pending.length) await uploadFiles(persistedId!,pending);
  };
  const removeAttachment = async (attachmentId: string) => {
    await run(async()=>{
      const response=await fetch(`/api/tasks/${encodeURIComponent(persistedId!)}/attachments/${encodeURIComponent(attachmentId)}`,{method:'DELETE'});
      if(!response.ok){const result=await response.json().catch(()=>({})) as {error?:string};throw new Error(result.error??'Could not remove attachment.');}
    },'Attachment removed',undefined,true);
  };
  const children = task ? data.subtasks.filter(s=>s.taskId===task.id) : [];
  const done = children.filter(s=>s.status==='completed').length;
  return <form onSubmit={e=>{e.preventDefault(); void run(save,task?'Task updated':'Task created');}}>
    <div className="space-y-4 px-6 pb-2">
      <FormField label="Task title"><input autoFocus required maxLength={160} className="field text-base font-semibold" value={title} placeholder="What needs to be done?" onChange={e=>setTitle(e.target.value)}/></FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Task list"><select className="field" value={listId} onChange={e=>setListId(e.target.value)}>{lists.map(l=><option key={l.id} value={l.id}>{l.title}</option>)}</select></FormField>
        <FormField label="Status"><select className="field" value={state} onChange={e=>setState(e.target.value as Status)}>{STATUSES.map(s=><option key={s} value={s}>{statusInfo[s].label}</option>)}</select></FormField>
        <FormField label="Priority"><select className="field" value={prio} onChange={e=>setPrio(e.target.value as Priority)}>{PRIORITIES.map(p=><option key={p} value={p}>{p[0].toUpperCase()+p.slice(1)}</option>)}</select></FormField>
        <FormField label="Due date"><input className="field" type="date" value={date} onChange={e=>setDate(e.target.value)}/></FormField>
      </div>
      <FormField label="Notes / Markdown description"><textarea className="field min-h-22 resize-y" maxLength={5000} placeholder="Add context, links, acceptance criteria..." value={desc} onChange={e=>setDesc(e.target.value)}/></FormField>
      <AttachmentFields taskId={persistedId??undefined} existing={existing} enabled={data.attachmentsEnabled} loading={loading} pending={pending} setPending={setPending} remove={removeAttachment}/>
      {task && <div className="space-y-3 rounded-xl border p-4 hairline" style={{background:'var(--surface-2)'}}>
        <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-bold"><ListTodo size={17}/>Subtasks <span className="muted text-xs font-normal">{done}/{children.length}</span></h3><button type="button" className="btn btn-quiet text-xs" onClick={()=>open({type:'subtask',taskId:task.id})}><Plus size={14}/> Add</button></div>
        {children.length>0&&<ProgressBar value={done/children.length*100} height={5}/>} 
        {children.length===0 ? <p className="muted text-xs">Break this task into smaller, trackable steps.</p> : <div className="space-y-1">{children.map(s=><div key={s.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-black/3 dark:hover:bg-white/4">
          <button type="button" aria-label={`Toggle ${s.title}`} onClick={()=>void run(()=>updateSubtaskStatus(s.id,s.status==='completed'?'pending':'completed'),'Subtask updated',undefined,true)}><StatusIcon status={s.status} size={17}/></button>
          <span className={`min-w-0 flex-1 truncate text-sm ${s.status==='completed'?'line-through muted':''}`}>{s.title}</span>
          <button type="button" className="icon-btn !h-7 !w-7" aria-label={`Edit ${s.title}`} onClick={()=>open({type:'subtask',taskId:task.id,subtask:s})}><Pencil size={13}/></button>
        </div>)}</div>}
      </div>}
      {task&&<button type="button" className="btn btn-danger" disabled={loading} onClick={()=>{if(window.confirm(`Delete “${task.title}” and all its subtasks?`)) void run(()=>deleteTask(task.id),'Task deleted');}}><Trash2 size={15}/> Delete task</button>}
    </div><ModalFooter loading={loading} onClose={close} submitLabel={task?'Save task':'Create task'}/>
  </form>;
}
function SubtaskForm({editor, loading, close, run}: Props & {editor: Extract<Editor,{type:'subtask'}>}) {
  const [title,setTitle] = useState(editor.subtask?.title??'');
  const [state,setState] = useState<Status>(editor.subtask?.status??'pending');
  const [date,setDate] = useState(editor.subtask?.dueDate??'');
  return <form onSubmit={e=>{e.preventDefault(); void run(()=>editor.subtask?updateSubtask(editor.subtask.id,{taskId:editor.taskId,title,status:state,dueDate:date}):createSubtask({taskId:editor.taskId,title,status:state,dueDate:date}),editor.subtask?'Subtask updated':'Subtask created');}}>
    <div className="space-y-4 px-6 pb-2">
      <FormField label="Subtask title"><input className="field" autoFocus required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="A smaller step toward completion"/></FormField>
      <div className="grid grid-cols-2 gap-4"><FormField label="Status"><select className="field" value={state} onChange={e=>setState(e.target.value as Status)}>{STATUSES.map(s=><option key={s} value={s}>{statusInfo[s].label}</option>)}</select></FormField><FormField label="Due date"><input type="date" className="field" value={date} onChange={e=>setDate(e.target.value)}/></FormField></div>
      {editor.subtask&&<button type="button" className="btn btn-danger" disabled={loading} onClick={()=>{if(window.confirm('Delete this subtask?')) void run(()=>deleteSubtask(editor.subtask!.id),'Subtask deleted');}}><Trash2 size={15}/> Delete subtask</button>}
    </div><ModalFooter loading={loading} onClose={close} submitLabel={editor.subtask?'Save subtask':'Add subtask'}/>
  </form>;
}
