'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, ListTodo, Link2, Unlink, Upload, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Check, X } from 'lucide-react';
import { createList, createProject, createSubtask, createSubtaskSection, renameSubtaskSection, moveSubtaskSection, deleteSubtaskSection, createTask, deleteList, deleteProject, deleteSubtask, deleteTask, updateList, updateProject, updateSubtask, updateSubtaskStatus, updateTask, linkTasks, unlinkTasks, linkTaskToProject, unlinkTaskFromProject, importTaskChecklist } from '@/lib/actions';
import type { Project, Snapshot, Status, Subtask, SubtaskSection, Task, TaskList, Priority } from '@/lib/types';
import { PRIORITIES, STATUSES } from '@/lib/types';
import { Dialog, FormField, ModalFooter, ProgressBar, StatusIcon, statusInfo, type RequestConfirmation } from './shared';
import { subtaskDetails } from '@/lib/subtask-display';
import { AttachmentFields, uploadFiles, type FileRow } from './attachment-fields';
import { SearchSelect } from './search-select';
import { checklistToMarkdown, parseChecklistDocument, type ChecklistDocument } from '@/lib/markdown';

export type Editor =
  | { type: 'project'; project?: Project }
  | { type: 'list'; projectId: string; list?: TaskList }
  | { type: 'task'; projectId: string; listId: string; task?: Task }
  | { type: 'subtask'; taskId: string; sectionId?: string | null; subtask?: Subtask };

export type Executor = (work: () => Promise<unknown>, success: string, done?: (result: unknown) => void, keepOpen?: boolean) => Promise<void>;

type Props = { editor: Editor; data: Snapshot; loading: boolean; close: () => void; run: Executor; open: (editor: Editor) => void; confirm: RequestConfirmation; active?: boolean; layer?: number };

const COLORS = ['#7366e8', '#4f9cdc', '#48b59b', '#efad61', '#d67b9b', '#a387e6', '#e08469', '#5ca8b4'];

export function EditorModal(props: Props) {
  const {editor, close} = props;
  return <Dialog active={props.active} layer={props.layer} title={editor.type === 'project' ? editor.project ? 'Edit project' : 'Create a project' : editor.type === 'list' ? editor.list ? 'Edit task list' : 'New task list' : editor.type === 'task' ? editor.task ? 'Task details' : 'Create a task' : editor.subtask ? 'Edit subtask' : 'Add a subtask'} subtitle={editor.type === 'project' ? 'Keep everything organized in its own space.' : editor.type === 'task' ? 'Plan the work and keep progress visible.' : undefined} onClose={close} wide={editor.type === 'task'}>
    {editor.type === 'project' && <ProjectForm {...props} editor={editor} />}
    {editor.type === 'list' && <ListForm {...props} editor={editor} />}
    {editor.type === 'task' && <TaskForm {...props} editor={editor} />}
    {editor.type === 'subtask' && <SubtaskForm {...props} editor={editor} />}
  </Dialog>;
}

function ProjectForm({editor, loading, close, run, confirm}: Props & {editor: Extract<Editor,{type:'project'}>}) {
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
      {editor.project && <button type="button" className="btn btn-danger" disabled={loading} onClick={()=>confirm({title:'Delete project?',description:`Permanently delete “${editor.project!.name}” and all associated lists, tasks and subtasks? This action cannot be undone.`,confirmLabel:'Delete project',destructive:true,onConfirm:()=>void run(()=>deleteProject(editor.project!.id),'Project deleted')})}><Trash2 size={15}/> Delete project</button>}
    </div>
    <ModalFooter loading={loading} onClose={close} submitLabel={editor.project?'Save project':'Create project'}/>
  </form>;
}
function ListForm({editor, loading, close, run, confirm}: Props & {editor: Extract<Editor,{type:'list'}>}) {
  const [title, setTitle] = useState(editor.list?.title ?? '');
  const [desc, setDesc] = useState(editor.list?.description ?? '');
  return <form onSubmit={e=>{e.preventDefault(); void run(()=>editor.list?updateList(editor.list.id,{title,description:desc}):createList({projectId:editor.projectId,title,description:desc}),editor.list?'List updated':'List created');}}>
    <div className="space-y-4 px-6 pb-2">
      <FormField label="List name"><input autoFocus required className="field" placeholder="e.g. Backlog, In progress, Release" maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></FormField>
      <FormField label="Description (optional)"><textarea className="field min-h-20 resize-y" maxLength={5000} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What belongs in this list?"/></FormField>
      {editor.list&&<button type="button" className="btn btn-danger" disabled={loading} onClick={()=>confirm({title:'Delete task list?',description:`Delete “${editor.list!.title}” and every task and subtask inside it? This action cannot be undone.`,confirmLabel:'Delete list',destructive:true,onConfirm:()=>void run(()=>deleteList(editor.list!.id),'List deleted')})}><Trash2 size={15}/> Delete list</button>}
    </div><ModalFooter loading={loading} onClose={close} submitLabel={editor.list?'Save list':'Create list'}/>
  </form>;
}
function TaskForm({editor, data, loading, close, run, open, confirm}: Props & {editor: Extract<Editor,{type:'task'}>}) {
  const task = editor.task ? data.tasks.find(t=>t.id===editor.task?.id) ?? editor.task : undefined;
  const lists = data.lists.filter(l=>l.projectId===editor.projectId);
  const [title, setTitle] = useState(task?.title ?? '');
  const [desc, setDesc] = useState(task?.description ?? '');
  const [listId, setListId] = useState(task?.listId ?? editor.listId);
  const [state, setState] = useState<Status>(task?.status ?? 'pending');
  const [prio, setPrio] = useState<Priority>(task?.priority ?? 'medium');
  const [date, setDate] = useState(task?.dueDate ?? '');
  const [pending, setPending] = useState<FileRow[]>([]);
  const [linkedTarget, setLinkedTarget] = useState('');
  const [linkedProjectTarget, setLinkedProjectTarget] = useState('');
  const [subtaskMarkdown, setSubtaskMarkdown] = useState('');
  const [subtaskImportMode, setSubtaskImportMode] = useState<'append' | 'replace_all' | 'replace_matching'>('append');
  const [showSubtaskImport, setShowSubtaskImport] = useState(false);
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
  const sharedProjects = task ? data.projectLinks.filter(link => link.taskId === task.id).map(link => data.projects.find(project => project.id === link.targetProjectId)).filter((project): project is Project => Boolean(project)) : [];
  const shareTargets = data.projects.filter(p=>p.id!==editor.projectId&&!sharedProjects.some(link=>link.id===p.id));
  const connected = task ? data.links.filter(l => l.firstTaskId === task.id || l.secondTaskId === task.id).map(l => data.tasks.find(t => t.id === (l.firstTaskId === task.id ? l.secondTaskId : l.firstTaskId))).filter((t): t is Task => Boolean(t)) : [];
  const otherTasks = data.tasks.filter(t => t.projectId !== editor.projectId && !connected.some(c => c.id === t.id));
  let subtaskPreview: ReturnType<typeof parseChecklistDocument> | null = null; let subtaskError = '';
  if (subtaskMarkdown.trim()) {try { subtaskPreview = parseChecklistDocument(subtaskMarkdown); } catch(error) {subtaskError = error instanceof Error ? error.message : 'Invalid checklist';}}
  return <form onSubmit={e=>{e.preventDefault(); void run(save,task?'Task updated':'Task created');}}>
    <div className="space-y-4 px-6 pb-2">
      <FormField label="Task title"><input autoFocus required maxLength={160} className="field text-base font-semibold" value={title} placeholder="What needs to be done?" onChange={e=>setTitle(e.target.value)}/></FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Task list"><SearchSelect label="Task list" value={listId} onChange={setListId} options={lists.map(l=>({value:l.id,label:l.title}))}/></FormField>
        <FormField label="Status"><SearchSelect label="Status" value={state} onChange={v=>setState(v as Status)} options={STATUSES.map(s=>({value:s,label:statusInfo[s].label}))}/></FormField>
        <FormField label="Priority"><SearchSelect label="Priority" value={prio} onChange={v=>setPrio(v as Priority)} options={PRIORITIES.map(p=>({value:p,label:p[0].toUpperCase()+p.slice(1)}))}/></FormField>
        <FormField label="Due date"><input className="field" type="date" value={date} onChange={e=>setDate(e.target.value)}/></FormField>
      </div>
      <FormField label="Notes / Markdown description"><textarea className="field min-h-22 resize-y" maxLength={5000} placeholder="Add context, links, acceptance criteria..." value={desc} onChange={e=>setDesc(e.target.value)}/></FormField>
      <AttachmentFields confirm={confirm} taskId={persistedId??undefined} existing={existing} enabled={data.attachmentsEnabled} loading={loading} pending={pending} setPending={setPending} remove={removeAttachment}/>
      {task && <SubtaskSectionEditor task={task} data={data} loading={loading} run={run} open={open} confirm={confirm}/>}
      {task && <section className="space-y-3 rounded-xl border p-4 hairline" style={{background:'var(--surface-2)'}}>
        <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-bold"><Link2 size={16}/> Show this task in other projects</h3><span className="chip">{sharedProjects.length}</span></div>
        <p className="muted text-xs">Add a shortcut to another project. The task remains owned by {data.projects.find(p=>p.id===task.projectId)?.name}; its status and subtasks stay in sync.</p>
        {sharedProjects.map(other=><div key={other.id} className="flex items-center gap-2 rounded-lg border p-2 text-xs hairline"><span className="min-w-0 flex-1 font-semibold">{other.name}</span><button type="button" className="icon-btn" disabled={loading} aria-label={`Remove shortcut from ${other.name}`} onClick={()=>void run(()=>unlinkTaskFromProject(task.id,other.id),'Project shortcut removed',undefined,true)}><Unlink size={14}/></button></div>)}
        {shareTargets.length>0&&<div className="flex flex-wrap items-center gap-2"><div className="min-w-[160px] flex-1"><SearchSelect label="Link to project" value={linkedProjectTarget} onChange={setLinkedProjectTarget} placeholder="Search destination project" options={shareTargets.map(p=>({value:p.id,label:p.name}))}/></div><button type="button" className="btn" disabled={!linkedProjectTarget||loading} onClick={()=>void run(()=>linkTaskToProject(task.id,linkedProjectTarget),'Task linked to project',()=>setLinkedProjectTarget(''),true)}><Plus size={14}/>Add link</button></div>}
      </section>}
      {task && <section className="space-y-3 rounded-xl border p-4 hairline" style={{background:'var(--surface-2)'}}>
        <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-bold"><Link2 size={16}/> Linked tasks across projects</h3><span className="chip">{connected.length} links</span></div>
        {connected.length === 0 && <p className="muted text-xs">Link related work from another project without duplicating tasks or progress.</p>}
        {connected.map(linked => <div key={linked.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hairline"><span className="min-w-0 flex-1 truncate"><strong>{linked.title}</strong><span className="muted ml-2">{data.projects.find(p=>p.id===linked.projectId)?.name}</span></span><button type="button" className="icon-btn" disabled={loading} aria-label={`Unlink ${linked.title}`} onClick={() => void run(()=>unlinkTasks(task.id,linked.id),'Task link removed',undefined,true)}><Unlink size={14}/></button></div>)}
        {otherTasks.length > 0 && <div className="flex flex-wrap items-end gap-2"><div className="min-w-[190px] flex-1"><SearchSelect label="Related task" value={linkedTarget} onChange={setLinkedTarget} placeholder="Search other projects' tasks" options={otherTasks.map(t=>({value:t.id,label:t.title,description:data.projects.find(p=>p.id===t.projectId)?.name}))}/></div><button type="button" className="btn" disabled={!linkedTarget || loading} onClick={() => void run(()=>linkTasks(task.id,linkedTarget),'Tasks linked',()=>setLinkedTarget(''),true)}><Link2 size={14}/>Link</button></div>}
      </section>}
      {task && <section className="space-y-3 rounded-xl border p-4 hairline">
        <button type="button" className="flex w-full items-center justify-between gap-2 text-left text-sm font-bold" aria-expanded={showSubtaskImport} onClick={() => setShowSubtaskImport(v => !v)}><span className="flex items-center gap-2"><Upload size={16}/> Import Markdown into subtasks</span><span className="muted text-xs">{showSubtaskImport ? 'Hide' : 'Open'}</span></button>
        {showSubtaskImport && <div className="space-y-3">
          <p className="muted text-xs">Paste the original Insure360 Markdown unchanged. <code>## List: ...</code> creates headings; status checkboxes and verification notes are preserved.</p>
          <textarea className="field min-h-48 font-mono text-xs" aria-label="Markdown subtask checklist" placeholder={'# Development Tasklist\n\n## List: Central Administration\n- [ ] **T1** Improve tenant widgets\n\n## Verification Notes\nMark complete only after verification.'} value={subtaskMarkdown} onChange={e=>setSubtaskMarkdown(e.target.value)}/>
          {subtaskError && <p role="alert" className="text-xs text-red-500">{subtaskError}</p>}
          {subtaskPreview && <div className="rounded-lg border p-3 text-xs hairline space-y-2" aria-live="polite">
            <div className="font-bold">Preview: {subtaskPreview.items.length} subtasks · {subtaskPreview.sections.length} headings</div>
            {subtaskPreview.sections.map(title=><div className="flex justify-between gap-3" key={title}><span className="truncate">{title}</span><span className="muted">{subtaskPreview.items.filter(item=>item.section===title).length}</span></div>)}
            {subtaskPreview.items.some(item=>item.section===null) && <div className="muted">Uncategorised: {subtaskPreview.items.filter(item=>item.section===null).length}</div>}
            {subtaskPreview.notes && <p className="muted">Verification Notes: included separately</p>}
            {subtaskPreview.items.some(item=>item.description.length > 0) && <p className="muted">Markdown formatting and any long original task text are saved in subtask details.</p>}
          </div>}
          <FormField label="Import mode"><SearchSelect label="Subtask import mode" value={subtaskImportMode} onChange={value=>setSubtaskImportMode(value as typeof subtaskImportMode)} options={[{value:'append',label:'Append (keep existing)'},{value:'replace_matching',label:'Replace matching headings'},{value:'replace_all',label:'Replace all subtasks and headings'}]}/></FormField>
          <p className="muted text-xs">{subtaskImportMode==='append' ? 'Existing headings are reused, and new items are added.' : subtaskImportMode==='replace_matching' ? 'Only items under matching headings are replaced. Unmatched headings remain unchanged.' : 'All existing sections and subtasks are archived, then replaced. Undo is available from Import history.'}</p>
          <button type="button" className="btn btn-primary" disabled={loading || !subtaskPreview || Boolean(subtaskError)} onClick={() => {
            const apply = () => void run(()=>importTaskChecklist({taskId: task.id, markdown: subtaskMarkdown, mode: subtaskImportMode}),`${subtaskPreview?.items.length ?? 0} subtasks imported`,()=>{setSubtaskMarkdown('');setShowSubtaskImport(false);},true);
            if (subtaskImportMode === 'append') { apply(); return; }
            confirm({title:'Replace existing subtasks?',description:`This import will ${subtaskImportMode === 'replace_all' ? 'replace all existing headings and subtasks' : 'replace subtasks under matching headings'}. The previous records will be archived for rollback.`,confirmLabel:'Replace and import',destructive:true,onConfirm:apply});
          }}><Upload size={14}/>Import {subtaskPreview?.items.length ?? ''} subtasks</button>
        </div>}
      </section>}
      {task&&<button type="button" className="btn btn-danger" disabled={loading} onClick={()=>confirm({title:'Delete task?',description:`Delete “${task.title}” and all its subtasks and attachments? This action cannot be undone.`,confirmLabel:'Delete task',destructive:true,onConfirm:()=>void run(()=>deleteTask(task.id),'Task deleted')})}><Trash2 size={15}/> Delete task</button>}
    </div><ModalFooter loading={loading} onClose={close} submitLabel={task?'Save task':'Create task'}/>
  </form>;
}
function SubtaskSectionEditor({task, data, loading, run, open, confirm}: {task: Task; data: Snapshot; loading: boolean; run: Executor; open: (editor: Editor)=>void; confirm: RequestConfirmation}) {
  const children = data.subtasks.filter(s=>s.taskId===task.id).sort((a,b)=>a.position-b.position);
  const sections = data.subtaskSections.filter(s=>s.taskId===task.id).sort((a,b)=>a.position-b.position);
  const completed = children.filter(s=>s.status==='completed').length;
  const [expanded,setExpanded] = useState<Record<string,boolean>>({});
  const [newTitle,setNewTitle] = useState('');
  const [showNew,setShowNew] = useState(false);
  const [editing,setEditing] = useState<string | null>(null);
  const [editTitle,setEditTitle] = useState('');
  const [expandedDetails,setExpandedDetails] = useState<Record<string, boolean>>({});
  const exportChecklist = () => {
    const document: ChecklistDocument = {
      title: task.checklistTitle ?? task.title,
      intro: task.checklistIntro ?? '',
      notes: task.checklistNotes ?? '',
      sections: sections.map(s => s.title),
      items: children.map(s => ({title:s.title, description:s.description ?? '',status:s.status,dueDate:s.dueDate,section:sections.find(section=>section.id===s.sectionId)?.title ?? null})),
    };
    const blob = new Blob([checklistToMarkdown(document)], {type:'text/markdown;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${task.title.toLowerCase().replace(/[^a-z0-9]+/gi,'-') || 'subtasks'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const renderItems = (rows: Subtask[]) => rows.length === 0 ? <p className="muted py-2 text-xs">No subtasks in this heading.</p> : <div className="space-y-1">{rows.map(s=><div key={s.id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-black/3 dark:hover:bg-white/4">
    <button type="button" className="mt-0.5" disabled={loading} aria-label={`Toggle ${s.title}`} onClick={()=>void run(()=>updateSubtaskStatus(s.id,s.status==='completed'?'pending':'completed'),'Subtask updated',undefined,true)}><StatusIcon status={s.status} size={17}/></button>
    <div className="min-w-0 flex-1">
      <span className={`block text-sm break-words ${s.status==='completed'?'line-through muted':''}`}>{s.title}</span>
      {subtaskDetails(s.title, s.description) && <>
        <button type="button" className="mt-1 text-xs font-semibold underline-offset-2 hover:underline" style={{color:'var(--accent)'}} aria-expanded={Boolean(expandedDetails[s.id])} aria-controls={`subtask-details-${s.id}`} onClick={()=>setExpandedDetails(current=>({...current,[s.id]:!current[s.id]}))}>{expandedDetails[s.id]?'Hide details':'Show details'}</button>
        {expandedDetails[s.id] && <p id={`subtask-details-${s.id}`} className="muted mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed">{subtaskDetails(s.title, s.description)}</p>}
      </>}
    </div>
    <button type="button" className="icon-btn !h-7 !w-7" aria-label={`Edit ${s.title}`} onClick={()=>open({type:'subtask',taskId:task.id,subtask:s})}><Pencil size={13}/></button>
  </div>)}</div>;
  return <section className="space-y-3 rounded-xl border p-4 hairline" style={{background:'var(--surface-2)'}}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-bold"><ListTodo size={17}/>Subtasks <span className="muted text-xs font-normal">{completed}/{children.length}</span></h3><div className="flex gap-1"><button type="button" className="btn btn-quiet text-xs" onClick={()=>setShowNew(v=>!v)}><Plus size={14}/>Heading</button><button type="button" className="btn btn-quiet text-xs" onClick={exportChecklist}><Upload size={14}/>Export</button><button type="button" className="btn btn-quiet text-xs" onClick={()=>open({type:'subtask',taskId:task.id})}><Plus size={14}/>Subtask</button></div></div>
    {children.length>0&&<ProgressBar value={completed/children.length*100} height={5}/>}
    {task.checklistTitle && <p className="text-xs font-semibold">{task.checklistTitle}</p>}
    {task.checklistIntro && <p className="muted whitespace-pre-wrap break-words text-xs">{task.checklistIntro}</p>}
    {showNew&&<div className="flex flex-wrap gap-2"><input aria-label="New heading name" className="field min-w-40 flex-1" maxLength={160} placeholder="New section heading" value={newTitle} onChange={e=>setNewTitle(e.target.value)}/><button className="btn btn-primary" type="button" disabled={loading||!newTitle.trim()} onClick={()=>void run(()=>createSubtaskSection({taskId:task.id,title:newTitle}),'Heading added',()=>{setNewTitle('');setShowNew(false);},true)}>Add heading</button></div>}
    {sections.map((section,index)=>{
      const rows=children.filter(s=>s.sectionId===section.id);
      const done=rows.filter(s=>s.status==='completed').length;
      const openSection=expanded[section.id]!==false;
      return <div className="rounded-xl border p-3 hairline" key={section.id}>
        <div className="flex items-center gap-2">
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={openSection} aria-label={`${openSection?'Collapse':'Expand'} ${section.title}`} onClick={()=>setExpanded(v=>({...v,[section.id]:!openSection}))}>{openSection?<ChevronDown size={16}/>:<ChevronRight size={16}/>}<span className="min-w-0 flex-1 break-words text-sm font-bold">{section.title}</span><span className="muted shrink-0 text-xs">{done}/{rows.length}</span></button>
          <button type="button" className="icon-btn !h-7 !w-7" aria-label={`Add subtask to ${section.title}`} title="Add subtask" onClick={()=>open({type:'subtask',taskId:task.id,sectionId:section.id})}><Plus size={14}/></button>
          <button type="button" className="icon-btn !h-7 !w-7" disabled={index===0||loading} aria-label={`Move ${section.title} up`} onClick={()=>void run(()=>moveSubtaskSection(section.id,'up'),'Heading moved',undefined,true)}><ArrowUp size={13}/></button>
          <button type="button" className="icon-btn !h-7 !w-7" disabled={index===sections.length-1||loading} aria-label={`Move ${section.title} down`} onClick={()=>void run(()=>moveSubtaskSection(section.id,'down'),'Heading moved',undefined,true)}><ArrowDown size={13}/></button>
          <button type="button" className="icon-btn !h-7 !w-7" aria-label={`Rename ${section.title}`} onClick={()=>{setEditing(section.id);setEditTitle(section.title);}}><Pencil size={13}/></button>
          <button type="button" className="icon-btn !h-7 !w-7" disabled={loading} aria-label={`Remove heading ${section.title}`} title="Remove heading" onClick={()=>confirm({
            title:`Delete “${section.title}”?`,
            description:rows.length ? `This heading contains ${rows.length} subtask${rows.length===1?'':'s'}. Choose whether to keep them in Uncategorised or permanently delete them with the heading.` : 'This heading is empty. Remove it?',
            confirmLabel:rows.length ? `Delete heading and ${rows.length} subtask${rows.length===1?'':'s'}` : 'Delete heading',
            destructive:true,
            onConfirm:()=>void run(()=>deleteSubtaskSection(section.id,'delete'),'Heading and selected subtasks deleted',undefined,true),
            ...(rows.length ? {alternative:{label:'Keep subtasks',onConfirm:()=>void run(()=>deleteSubtaskSection(section.id,'keep'),'Heading removed; subtasks preserved',undefined,true)}} : {}),
          })}><Trash2 size={13}/></button>
        </div>
        {editing===section.id && <div className="mt-2 flex gap-2"><input aria-label="Rename heading" className="field min-w-0 flex-1" maxLength={160} value={editTitle} onChange={e=>setEditTitle(e.target.value)}/><button className="btn" type="button" disabled={loading||!editTitle.trim()} onClick={()=>void run(()=>renameSubtaskSection(section.id,editTitle),'Heading renamed',()=>setEditing(null),true)}><Check size={14}/>Save</button><button className="btn btn-quiet" type="button" onClick={()=>setEditing(null)}><X size={14}/></button></div>}
        {openSection && <div className="mt-2 border-t pt-2 hairline">{renderItems(rows)}</div>}
      </div>;
    })}
    {(()=>{const orphan=children.filter(s=>!s.sectionId||!sections.some(group=>group.id===s.sectionId));return (orphan.length>0||sections.length===0)&&<div className="rounded-xl border p-3 hairline"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold">Uncategorised</span><span className="muted text-xs">{orphan.filter(s=>s.status==='completed').length}/{orphan.length}</span></div>{renderItems(orphan)}</div>;})()}
    {task.checklistNotes && <div className="rounded-xl border p-3 hairline"><h4 className="mb-2 text-sm font-bold">Verification Notes</h4><p className="muted whitespace-pre-wrap break-words text-xs">{task.checklistNotes}</p></div>}
  </section>;
}

function SubtaskForm({editor, data, loading, close, run, confirm}: Props & {editor: Extract<Editor,{type:'subtask'}>}) {
  const [title,setTitle] = useState(editor.subtask?.title??'');
  const [state,setState] = useState<Status>(editor.subtask?.status??'pending');
  const [descriptionText,setDescriptionText] = useState(editor.subtask?.description??'');
  const [sectionId,setSectionId] = useState(editor.subtask?.sectionId??editor.sectionId??'');
  const availableSections = data.subtaskSections.filter(s=>s.taskId===editor.taskId);
  const [date,setDate] = useState(editor.subtask?.dueDate??'');
  return <form onSubmit={e=>{e.preventDefault(); void run(()=>editor.subtask?updateSubtask(editor.subtask.id,{taskId:editor.taskId,title,description:descriptionText,sectionId:sectionId||null,status:state,dueDate:date}):createSubtask({taskId:editor.taskId,title,description:descriptionText,sectionId:sectionId||null,status:state,dueDate:date}),editor.subtask?'Subtask updated':'Subtask created');}}>
    <div className="space-y-4 px-6 pb-2">
      <FormField label="Subtask title"><input className="field" autoFocus required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="A smaller step toward completion"/></FormField>
      <FormField label="Heading"><SearchSelect label="Subtask heading" value={sectionId} onChange={setSectionId} options={[{value:'',label:'Uncategorised'},...availableSections.map(section=>({value:section.id,label:section.title}))]}/></FormField>
      <FormField label="Details / full imported text"><textarea className="field min-h-20 resize-y" maxLength={5000} value={descriptionText} onChange={e=>setDescriptionText(e.target.value)} placeholder="Additional context for this subtask"/></FormField>
      <div className="grid grid-cols-2 gap-4"><FormField label="Status"><SearchSelect label="Status" value={state} onChange={v=>setState(v as Status)} options={STATUSES.map(s=>({value:s,label:statusInfo[s].label}))}/></FormField><FormField label="Due date"><input type="date" className="field" value={date} onChange={e=>setDate(e.target.value)}/></FormField></div>
      {editor.subtask&&<button type="button" className="btn btn-danger" disabled={loading} onClick={()=>confirm({title:'Delete subtask?',description:`Delete “${editor.subtask!.title}”? This cannot be undone.`,confirmLabel:'Delete subtask',destructive:true,onConfirm:()=>void run(()=>deleteSubtask(editor.subtask!.id),'Subtask deleted')})}><Trash2 size={15}/> Delete subtask</button>}
    </div><ModalFooter loading={loading} onClose={close} submitLabel={editor.subtask?'Save subtask':'Add subtask'}/>
  </form>;
}
