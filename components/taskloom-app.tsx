'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Check, CheckCheck, ChevronRight, CloudOff, Command, Download, FileCode2, FileDown, FileText, FolderKanban, FolderPlus, HardDrive, Inbox, LayoutDashboard, ListChecks, ListTodo, Menu, Moon, MoreHorizontal, Pencil, Plus, Search, Settings2, Sparkles, Sun, Target, Upload, X } from 'lucide-react';
import { importMarkdown } from '@/lib/actions';
import { parseMarkdown, toMarkdown } from '@/lib/markdown';
import type { ImportProject, Project, Snapshot, Status, Task, TaskList } from '@/lib/types';
import { STATUSES } from '@/lib/types';
import { Dialog, DueDate, EmptyMessage, IconTile, ProgressBar, StatusBadge, StatusIcon, statusInfo } from './shared';
import { EditorModal, type Editor, type Executor } from './editors';
import { StatusBoard } from './status-board';

type View = 'overview' | 'project' | 'all' | 'import';
type Filter = 'all' | Status;
const priorityColor: Record<string,string> = { high:'#e97a7e', medium:'#eead68', low:'#5aa98a' };
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);
const completed = (tasks: { status: Status }[]) => tasks.filter(t=>t.status==='completed').length;
const percent = (a:number,b:number) => b ? Math.round(a/b*100) : 0;

function projectMetric(p: Project, data: Snapshot) {
  const tasks = data.tasks.filter(t=>t.projectId===p.id);
  const subtasks = data.subtasks.filter(t=>t.projectId===p.id);
  const total=tasks.length+subtasks.length;
  const done=completed(tasks)+completed(subtasks);
  return {tasks, subtasks, done,total,percent:percent(done,total)};
}
const projectMark = (p: Project, size=38) => <span className="inline-flex shrink-0 items-center justify-center rounded-xl font-black" style={{width:size,height:size,background:`${p.color}1a`,color:p.color,fontSize:size*.39}}>{p.name.trim().slice(0,1).toUpperCase()}</span>;

export function TaskloomApp({data}: {data: Snapshot}) {
  const router=useRouter();
  const [view,setView]=useState<View>('overview');
  const [selectedId,setSelectedId]=useState<string>('');
  const [editor,setEditor]=useState<Editor|null>(null);
  const [busy,setBusy]=useState(false);
  const [toast,setToast]=useState<{text:string;error?:boolean}|null>(null);
  const [dark,setDark]=useState(false);
  const [mobileMenu,setMobileMenu]=useState(false);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState<Filter>('all');
  const [filterProject,setFilterProject]=useState('all');
  const [projectLayout,setProjectLayout]=useState<'status'|'list'>('status');
  const [visibleStatuses,setVisibleStatuses]=useState<Status[]>([...STATUSES]);
  const [projectListFilter,setProjectListFilter]=useState('all');
  const [importTarget,setImportTarget]=useState('new');
  const [md,setMd]=useState('');
  const [fileName,setFileName]=useState('');
  const [uploading,setUploading]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);
  const [refreshPending,startTransition]=useTransition();
  const project=data.projects.find(p=>p.id===selectedId) ?? data.projects[0];
  const lists=project?data.lists.filter(l=>l.projectId===project.id):[];
  const allWork=[...data.tasks,...data.subtasks];
  const done=completed(allWork);
  const overall=percent(done,allWork.length);
  const today=new Date(); today.setHours(0,0,0,0);
  const late=data.tasks.filter(t=>t.dueDate && new Date(t.dueDate+'T12:00:00')<today && t.status!=='completed');
  const upcoming=data.tasks.filter(t=>t.dueDate && t.status!=='completed').sort((a,b)=>a.dueDate!.localeCompare(b.dueDate!)).slice(0,4);
  const working=data.tasks.filter(t=>t.status==='in_progress').length;
  const pMetric=project?projectMetric(project,data):null;

  useEffect(()=>{
    const saved=localStorage.getItem('taskloom-theme');
    setDark(saved ? saved==='dark' : document.documentElement.classList.contains('dark'));
    const created=(e:Event)=>{const id=(e as CustomEvent<string>).detail;setSelectedId(id);setView('project');};
    window.addEventListener('taskloom:new-project',created);
    return ()=>window.removeEventListener('taskloom:new-project',created);
  },[]);
  useEffect(()=>{ if(!toast) return; const id=window.setTimeout(()=>setToast(null),4400); return ()=>window.clearTimeout(id);},[toast]);
  useEffect(()=>{ const onKey=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setView('all');requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('[aria-label=\"Search all tasks\"]')?.focus());}};window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey);},[]);
  const toggleTheme=()=>{const next=!dark;setDark(next);document.documentElement.classList.toggle('dark',next);localStorage.setItem('taskloom-theme',next?'dark':'light');};
  const navigate=(next:View,id?:string)=>{if(id){setSelectedId(id);setProjectListFilter('all');setVisibleStatuses([...STATUSES]);}setView(next);setMobileMenu(false);setSearch('');};
  const run:Executor=async(work,success,after,keepOpen=false)=>{
    setBusy(true);
    try {
      const result=await work();
      after?.(result);
      setToast({text:success});
      if (!keepOpen) setEditor(null);
      startTransition(()=>router.refresh());
    } catch(e) {setToast({text:e instanceof Error?e.message:'An unexpected error occurred.',error:true});startTransition(()=>router.refresh());}
    finally {setBusy(false);}
  };
  const saveMarkdown=(filename:string, content:string)=>{
    const blob=new Blob([content],{type:'text/markdown;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
  };
  const makeExport=(p:Project,onlyList?:TaskList)=>{
    const model:ImportProject={name:p.name,description:p.description,lists:(onlyList?[onlyList]:data.lists.filter(l=>l.projectId===p.id)).map(l=>({title:l.title,tasks:data.tasks.filter(t=>t.listId===l.id).map(t=>({title:t.title,status:t.status,priority:t.priority,dueDate:t.dueDate,subtasks:data.subtasks.filter(s=>s.taskId===t.id).map(s=>({title:s.title,status:s.status,dueDate:s.dueDate}))}))}))};
    saveMarkdown(`${p.name.toLowerCase().replace(/[^a-z0-9]+/gi,'-')}${onlyList?'-'+onlyList.title.toLowerCase().replace(/[^a-z0-9]+/gi,'-'):''}.md`,toMarkdown(model));
    setToast({text: 'Markdown exported'});
  };
  const handleFile=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return;
    if(file.size>1_000_000){setToast({text:'Files must be smaller than 1 MB',error:true});return;}
    try {setMd(await file.text());setFileName(file.name);navigate('import');}
    catch{setToast({text:'Could not read the Markdown file',error:true});}
    e.target.value='';
  };
  const parsePreview=useMemo(()=>{if(!md.trim())return null;try{return {parsed:parseMarkdown(md,fileName.replace(/\.md$/i,'')||'Imported project'),error:null};}catch(e){return{parsed:null,error:e instanceof Error?e.message:'Invalid Markdown'};}},[md,fileName]);
  const submitImport=async()=>{
    if(!md.trim())return;
    setUploading(true);
    await run(()=>importMarkdown({markdown:md,filename:fileName,projectId:importTarget==='new'?null:importTarget}),'Markdown imported successfully',result=>{if(result&&typeof result==='object'&&'projectId'in result){setSelectedId(String(result.projectId));setView('project');setMd('');setFileName('');}});
    setUploading(false);
  };
  const canEdit=data.databaseOnline;
  const openNewTask=()=>{if(!project){setEditor({type:'project'});return;}const first=data.lists.find(l=>l.projectId===project.id);if(!first){setEditor({type:'list',projectId:project.id});return;}setEditor({type:'task',projectId:project.id,listId:first.id});};
  const dashboardNav=[{id:'overview' as const,label:'Overview',icon:LayoutDashboard},{id:'all' as const,label:'Overall List',icon:ListChecks},{id:'import' as const,label:'Import Markdown',icon:FileDown}];

  return <div className="min-h-screen" style={{background:'var(--canvas)'}}>
    {/* Mobile nav backdrop */}
    {mobileMenu&&<button className="fixed inset-0 z-40 bg-black/50 lg:hidden" aria-label="Close menu" onClick={()=>setMobileMenu(false)}/>}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r transition-transform duration-200 lg:translate-x-0 ${mobileMenu?'translate-x-0':'-translate-x-full'}`} style={{background:'var(--sidebar)',borderColor:'var(--border)'}}>
      <div className="flex h-[88px] items-center gap-3 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{background:'linear-gradient(145deg,#a49bff,#6d5de0)',boxShadow:'0 7px 18px #6c61d647'}}><Command size={23} strokeWidth={2.5}/></div>
        <div className="flex-1"><div className="text-[20px] leading-tight font-extrabold tracking-[-.8px]">taskloom<span style={{color:'var(--accent)'}}>.</span></div><div className="muted mt-0.5 text-[10px] font-semibold tracking-[1.3px] uppercase">Your local workspace</div></div>
        <button className="icon-btn lg:hidden" aria-label="Close navigation" onClick={()=>setMobileMenu(false)}><X size={19}/></button>
      </div>
      <div className="px-4 pt-6">
        <div className="overline mb-3 px-3">Workspace</div>
        <nav className="space-y-1">{dashboardNav.map(n=><button key={n.id} className={`nav-item ${view===n.id?'active':''}`} onClick={()=>navigate(n.id)}><n.icon size={18}/><span className="flex-1">{n.label}</span>{n.id==='all'&&<span className="text-[11px] opacity-60">{data.tasks.length}</span>}</button>)}</nav>
      </div>
      <div className="mt-9 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="mb-3 flex items-center justify-between px-3"><span className="overline">Projects <span className="ml-1 opacity-60">{data.projects.length}</span></span><button className="icon-btn !h-7 !w-7" title="New project" aria-label="New project" disabled={!canEdit} onClick={()=>setEditor({type:'project'})}><Plus size={17}/></button></div>
        <div className="space-y-1">{data.projects.map(p=><button key={p.id} className={`nav-item ${view==='project'&&project?.id===p.id?'active':''}`} onClick={()=>navigate('project',p.id)}><span className="project-dot" style={{background:p.color}}/><span className="flex-1 truncate">{p.name}</span><ChevronRight size={14} className="opacity-50"/></button>)}
          {data.projects.length===0&&<p className="muted px-3 py-4 text-xs leading-relaxed">Your projects will appear here.</p>}
        </div>
        <button className="nav-item mt-2 !text-xs" disabled={!canEdit} onClick={()=>setEditor({type:'project'})}><Plus size={16}/>Create new project</button>
      </div>
      <div className="mx-4 mb-5 rounded-2xl p-4" style={{background:'var(--accent-wash)',border:'1px solid var(--accent-border)'}}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2 font-bold text-xs"><Sparkles size={15} style={{color:'var(--accent)'}}/>Workspace pulse</div><span className="text-xs font-bold" style={{color:'var(--accent)'}}>{overall}%</span></div>
        <p className="muted mt-2 mb-3 text-xs">{done} of {allWork.length} tasks & steps complete</p><ProgressBar value={overall} height={6}/>
      </div>
      <div className="flex items-center gap-3 border-t px-5 py-4 hairline"><span className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold" style={{background:'var(--accent-wash)',color:'var(--accent)'}}>L</span><div className="min-w-0 flex-1"><div className="text-xs font-bold">Local workspace</div><div className="muted text-[11px]">Tasks in MongoDB</div></div><HardDrive size={16} className="muted"/></div>
    </aside>

    <div className="min-h-screen lg:pl-[260px]">
      <header className="sticky top-0 z-30 flex h-[78px] items-center justify-between gap-4 border-b px-5 md:px-9" style={{background:'var(--surface)',borderColor:'var(--border)'}}>
        <div className="flex min-w-0 items-center gap-3"><button className="icon-btn lg:hidden" aria-label="Open navigation" onClick={()=>setMobileMenu(true)}><Menu size={20}/></button>
          <div className="hidden items-center gap-2 text-sm sm:flex"><span className="muted">Workspace</span><ChevronRight size={15} className="muted"/><span className="truncate font-bold">{view==='overview'?'Overview':view==='all'?'Overall List':view==='import'?'Markdown import':project?.name??'Projects'}</span></div>
          <div className="font-bold sm:hidden">{view==='project'?project?.name:view==='all'?'Overall List':view==='import'?'Import':'Overview'}</div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <label className="hidden w-[230px] items-center gap-2 rounded-xl border px-3 py-2.5 md:flex hairline" style={{background:'var(--surface-2)'}}><Search size={17} className="muted"/><input aria-label="Search tasks" className="min-w-0 flex-1 bg-transparent text-xs outline-none" placeholder="Search tasks..." value={search} onChange={e=>{setSearch(e.target.value);if(e.target.value)setView('all');}}/>{search?<button aria-label="Clear search" onClick={()=>setSearch('')}><X size={14} className="muted"/></button>:<span className="muted text-[10px]">⌘ K</span>}</label>
          <button className="icon-btn !h-10 !w-10" onClick={toggleTheme} title={dark?'Use light mode':'Use dark mode'} aria-label={dark?'Use light mode':'Use dark mode'}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button>
          <span className="mx-0.5 hidden h-7 w-px sm:block" style={{background:'var(--border)'}}/>
          <button disabled={!canEdit} className="btn btn-primary !px-3.5" onClick={openNewTask}><Plus size={17}/><span className="hidden sm:inline">New task</span></button>
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-[1510px] px-5 py-7 md:px-9 md:py-9">
        {!data.databaseOnline&&<div className="mb-7 flex items-start gap-3 rounded-xl border border-orange-300/40 bg-orange-500/10 p-4 text-orange-600 dark:text-orange-300"><CloudOff size={21} className="mt-0.5 shrink-0"/><div className="min-w-0 flex-1"><strong>Local database is offline</strong><p className="mt-1 text-sm">{data.error} Task data remains in MongoDB; configured attachments use S3.</p><code className="mt-2 inline-block rounded bg-black/6 px-2 py-1 text-xs dark:bg-white/10">docker compose up -d</code></div><button onClick={()=>startTransition(()=>router.refresh())} className="btn !text-xs">Retry</button></div>}
        {view==='overview'&&<>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="overline mb-2">Your command center</div><h1 className="text-3xl font-extrabold tracking-[-1.3px] md:text-[36px]">Welcome to your workspace <span className="align-top text-2xl">✳</span></h1><p className="muted mt-2">A clearer view of your projects, priorities, and progress.</p></div><button className="btn" disabled={!canEdit} onClick={()=>setEditor({type:'project'})}><FolderPlus size={17}/>New project</button></div>
          <div className="hero-gradient relative mb-7 overflow-hidden rounded-[22px] border px-7 py-7 md:px-9 md:py-8" style={{borderColor:'var(--accent-border)'}}><div className="relative z-10 max-w-[620px]"><div className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold" style={{color:'var(--accent)',background:'var(--surface)'}}><Sparkles size={14}/> A little progress adds up</div><h2 className="max-w-lg text-[25px] leading-[1.25] font-extrabold tracking-[-.9px] md:text-[30px]">Make space for your best work.</h2><p className="mt-3 max-w-md text-sm leading-relaxed opacity-75">Plan big ideas, break them into small steps, and watch everything move forward. One place for it all.</p><button className="btn btn-primary mt-5" onClick={()=>navigate(data.projects.length?'project':'import',data.projects[0]?.id)}>{data.projects.length?'Explore projects':'Import your first project'} <ArrowRight size={16}/></button></div><div aria-hidden="true" className="pointer-events-none absolute right-[-70px] bottom-[-85px] hidden h-[350px] w-[350px] rotate-[-18deg] rounded-[65px] border-[24px] opacity-30 lg:block" style={{borderColor:'var(--accent)'}}/><div aria-hidden="true" className="pointer-events-none absolute top-7 right-23 hidden h-[160px] w-[160px] rotate-[22deg] rounded-[40px] border-[22px] opacity-15 lg:block" style={{borderColor:'var(--accent)'}}/></div>
          <div className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-5">
            <StatCard label="Total projects" value={data.projects.length} icon={<FolderKanban size={20}/>} accent="#7d70e9" subtitle="Active workspaces"/>
            <StatCard label="Total tasks" value={data.tasks.length} icon={<ListChecks size={20}/>} accent="#619ae5" subtitle={`${data.subtasks.length} subtasks included`}/>
            <StatCard label="Completed" value={completed(data.tasks)} icon={<CheckCheck size={20}/>} accent="#45b68d" subtitle={`${overall}% of all work done`}/>
            <StatCard label="In progress" value={working} icon={<Activity size={20}/>} accent="#eca765" subtitle={late.length?`${late.length} overdue task${late.length!==1?'s':''}`:'Right on track'}/>
          </div>
          <div className="mb-7 grid grid-cols-1 gap-5 xl:grid-cols-[1.42fr_1fr]">
            <section className="panel p-5 md:p-6"><div className="mb-6 flex items-center justify-between"><div><h3 className="text-base font-bold">Project progress</h3><p className="muted mt-1 text-xs">Completion across your workspaces</p></div><IconTile size={36}><BarChart3 size={18}/></IconTile></div>
              {data.projects.length===0?<EmptyInline text="Create a project to see progress metrics."/>:<div className="space-y-5">{data.projects.slice(0,5).map(p=>{const m=projectMetric(p,data);return <button key={p.id} className="block w-full text-left" onClick={()=>navigate('project',p.id)}><div className="mb-2.5 flex items-center gap-3">{projectMark(p,30)}<span className="flex-1 truncate text-sm font-bold">{p.name}</span><span className="muted text-xs">{m.done}/{m.total}</span><span className="w-11 text-right text-xs font-extrabold">{m.percent}%</span></div><ProgressBar value={m.percent} color={p.color} height={7}/></button>;})}</div>}
            </section>
            <section className="panel p-5 md:p-6"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-base font-bold">Task breakdown</h3><p className="muted mt-1 text-xs">Where things stand today</p></div><IconTile size={36} color="#4cae98"><Target size={18}/></IconTile></div>
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around"><ProgressDonut value={overall}/><div className="grid w-full grid-cols-2 gap-x-5 gap-y-3 sm:w-auto sm:grid-cols-1">{STATUSES.map(s=>{const n=data.tasks.filter(t=>t.status===s).length;return <div key={s} className="flex items-center gap-2.5 text-xs"><span className="status-dot" style={{background:statusInfo[s].color}}/><span className="muted flex-1">{statusInfo[s].label}</span><b>{n}</b></div>})}</div></div>
            </section>
          </div>
          <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold tracking-tight">Your projects</h2><p className="muted mt-1 text-xs">Everything you&apos;re working on</p></div><button className="btn btn-quiet !text-xs" onClick={()=>setEditor({type:'project'})} disabled={!canEdit}><Plus size={15}/>Add project</button></div>
          {data.projects.length===0?<EmptyMessage icon={<FolderPlus size={24}/>} title="Bring your first project to life" description="Create a project or import an existing Markdown checklist to begin." action={<div className="flex gap-2"><button className="btn btn-primary" disabled={!canEdit} onClick={()=>setEditor({type:'project'})}><Plus size={16}/>Create project</button><button className="btn" onClick={()=>navigate('import')}><Upload size={16}/>Import MD</button></div>}/>:<div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">{data.projects.map(p=>{const m=projectMetric(p,data);return <button key={p.id} className="panel group p-5 text-left transition hover:-translate-y-0.5 hover:border-violet-400/50 hover:shadow-lg" onClick={()=>navigate('project',p.id)}><div className="mb-4 flex items-start justify-between">{projectMark(p,44)}<ArrowUpRight size={19} className="muted transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"/></div><h3 className="truncate text-base font-extrabold">{p.name}</h3><p className="muted mt-1 min-h-9 line-clamp-2 text-xs leading-relaxed">{p.description||'A focused space for your project tasks and milestones.'}</p><div className="mt-5 mb-2.5 flex justify-between text-xs"><span className="muted">{m.tasks.length} tasks · {m.subtasks.length} steps</span><b>{m.percent}%</b></div><ProgressBar value={m.percent} color={p.color} height={7}/></button>;})}</div>}
          {data.tasks.length>0&&<div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_1fr]"><section className="panel overflow-hidden"><div className="flex items-center justify-between border-b px-5 py-4 hairline"><div><h3 className="font-bold">Current priorities</h3><p className="muted mt-1 text-xs">Your active, highest-impact work</p></div><button className="btn btn-quiet !text-xs" onClick={()=>navigate('all')}>View all <ArrowRight size={15}/></button></div><div className="divide-y hairline">{data.tasks.filter(t=>t.status!=='completed').sort((a,b)=>Number(b.priority==='high')-Number(a.priority==='high')).slice(0,5).map(t=><CompactTask key={t.id} task={t} data={data} onClick={()=>setEditor({type:'task',projectId:t.projectId,listId:t.listId,task:t})}/>)}{data.tasks.every(t=>t.status==='completed')&&<div className="muted p-7 text-center text-sm">All tasks completed. Nicely done!</div>}</div></section><section className="panel p-5"><div className="mb-5 flex items-center justify-between"><h3 className="font-bold">Coming up</h3><CalendarDays size={18} className="muted"/></div>{upcoming.length?<div className="space-y-4">{upcoming.map(t=><button className="flex w-full items-center gap-3 text-left" key={t.id} onClick={()=>setEditor({type:'task',projectId:t.projectId,listId:t.listId,task:t})}><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{background:'var(--surface-2)'}}><CalendarDays size={18} className="muted"/></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{t.title}</div><div className="muted mt-1 text-[11px]">{data.projects.find(p=>p.id===t.projectId)?.name}</div></div><span className="text-xs"><DueDate value={t.dueDate} compact/></span></button>)}</div>:<EmptyInline text="No upcoming deadlines. Your calendar is clear."/>}</section></div>}
        </>}
        {view==='project'&&<>
          {!project?<EmptyMessage icon={<FolderKanban size={27}/>} title="No project selected" description="Create a project to get started." action={<button className="btn btn-primary" onClick={()=>setEditor({type:'project'})}><Plus size={16}/>Create project</button>}/>:<>
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-4">{projectMark(project,55)}<div className="min-w-0"><div className="overline mb-1">Project workspace</div><h1 className="truncate text-3xl font-extrabold tracking-[-1.2px]">{project.name}</h1><p className="muted mt-1 max-w-2xl text-sm">{project.description||'A focused space to get everything done.'}</p></div></div><div className="flex flex-wrap gap-2"><button className="btn" onClick={()=>makeExport(project)}><Download size={16}/>Export MD</button><button className="btn" onClick={()=>setEditor({type:'project',project})}><Settings2 size={16}/>Edit</button><button className="btn btn-primary" onClick={()=>setEditor({type:'list',projectId:project.id})}><Plus size={17}/>New list</button></div></div>
          <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"><MetricMini title="Completion" value={`${pMetric!.percent}%`} help={`${pMetric!.done} of ${pMetric!.total} items`} icon={<Target size={18}/>} color="#7769e8"/><MetricMini title="Total tasks" value={pMetric!.tasks.length.toString()} help={`${pMetric!.subtasks.length} subtasks`} icon={<ListTodo size={18}/>} color="#4f9cdc"/><MetricMini title="In progress" value={pMetric!.tasks.filter(t=>t.status==='in_progress').length.toString()} help="Currently being worked on" icon={<Activity size={18}/>} color="#dba35c"/><MetricMini title="Completed" value={completed(pMetric!.tasks).toString()} help="Finished tasks" icon={<CheckCheck size={18}/>} color="#42b28a"/></div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Project tasks <span className="muted text-sm font-semibold">({pMetric!.tasks.length})</span></h2><p className="muted mt-1 text-xs">Browse by status or your custom task lists.</p></div><div className="flex gap-2" role="group" aria-label="Project task layout"><button type="button" className={`btn !text-xs ${projectLayout==='status'?'btn-primary':''}`} aria-pressed={projectLayout==='status'} onClick={()=>setProjectLayout('status')}><Activity size={15}/>By status</button><button type="button" className={`btn !text-xs ${projectLayout==='list'?'btn-primary':''}`} aria-pressed={projectLayout==='list'} onClick={()=>setProjectLayout('list')}><ListChecks size={15}/>By list</button></div></div>
          <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Status filters"><span className="muted mr-1 text-xs font-semibold">Statuses:</span>{STATUSES.map(s=><button type="button" key={s} aria-pressed={visibleStatuses.includes(s)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${visibleStatuses.includes(s)?'':'opacity-45'}`} style={{borderColor:visibleStatuses.includes(s)?statusInfo[s].color:'var(--border)',background:visibleStatuses.includes(s)?statusInfo[s].bg:'var(--surface)'}} onClick={()=>setVisibleStatuses(current=>current.includes(s)?current.filter(x=>x!==s):[...current,s])}>{statusInfo[s].label} · {pMetric!.tasks.filter(t=>t.status===s).length}</button>)}<button type="button" className="btn btn-quiet !text-xs" onClick={()=>setVisibleStatuses([...STATUSES])}>Reset</button></div>
          <div className="mb-5 flex flex-wrap items-center gap-2"><label htmlFor="project-list-filter" className="muted text-xs font-semibold">Task list:</label><select id="project-list-filter" className="field !w-auto !min-w-[170px]" value={projectListFilter} onChange={e=>setProjectListFilter(e.target.value)}><option value="all">All lists</option>{lists.map(l=><option key={l.id} value={l.id}>{l.title}</option>)}</select>{projectLayout==='list'&&<button className="btn !text-xs" type="button" disabled={!canEdit} onClick={()=>setEditor({type:'list',projectId:project.id})}><Plus size={14}/>New list</button>}</div>
          {visibleStatuses.length===0&&<p className="muted mb-4 rounded-xl border border-dashed p-4 text-center text-xs hairline">No statuses selected. Click a status above or Reset to show tasks.</p>}
          {lists.length===0?<EmptyMessage icon={<ListChecks size={26}/>} title="Create your first task list" description="Task lists group work into areas such as Foundation, Quality, and Release." action={<button className="btn btn-primary" onClick={()=>setEditor({type:'list',projectId:project.id})}><Plus size={16}/>Create list</button>}/>:projectLayout==='status'?<StatusBoard data={data} tasks={pMetric!.tasks.filter(t=>visibleStatuses.includes(t.status)&&(projectListFilter==='all'||t.listId===projectListFilter))} statuses={visibleStatuses} open={setEditor} addTask={openNewTask}/>:<div className="flex items-start gap-4 overflow-x-auto pb-5"><div className="grid min-w-full auto-cols-[minmax(280px,1fr)] grid-flow-col gap-4 xl:auto-cols-[minmax(315px,1fr)]">{lists.filter(l=>projectListFilter==='all'||l.id===projectListFilter).map(l=><BoardList key={l.id} list={l} project={project} data={data} open={setEditor} exportList={()=>makeExport(project,l)} statusFilter={visibleStatuses} />)}<button className="flex min-h-30 min-w-[250px] items-center justify-center gap-2 rounded-2xl border border-dashed text-sm font-bold transition hover:border-violet-400 hover:bg-violet-400/5" style={{color:'var(--muted)',borderColor:'var(--border)'}} onClick={()=>setEditor({type:'list',projectId:project.id})}><Plus size={20}/>Add another list</button></div></div>}
        </>}
        </>}
        {view==='all'&&<>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><div className="overline mb-2">The full picture</div><h1 className="text-3xl font-extrabold tracking-[-1.2px]">Overall List</h1><p className="muted mt-2">Find what matters, track the details, keep moving.</p></div><button className="btn btn-primary" disabled={!canEdit} onClick={openNewTask}><Plus size={16}/>New task</button></div>
          <div className="panel mb-5 p-4"><div className="flex flex-wrap items-center gap-3"><label className="flex min-w-[230px] flex-1 items-center gap-2 rounded-xl border px-3 hairline" style={{background:'var(--surface-2)'}}><Search size={17} className="muted"/><input className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="Search titles and descriptions" aria-label="Search all tasks" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Filter by project" className="field !w-auto !min-w-[155px]" value={filterProject} onChange={e=>setFilterProject(e.target.value)}><option value="all">All projects</option>{data.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><select aria-label="Filter by status" className="field !w-auto !min-w-[155px]" value={filter} onChange={e=>setFilter(e.target.value as Filter)}><option value="all">All statuses</option>{STATUSES.map(s=><option key={s} value={s}>{statusInfo[s].label}</option>)}</select></div></div>
          <div className="panel overflow-hidden"><div className="flex items-center justify-between border-b px-5 py-4 hairline"><h2 className="font-bold">Task inventory</h2><span className="chip">{data.tasks.filter(t=>(filter==='all'||t.status===filter)&&(filterProject==='all'||t.projectId===filterProject)&&(!search||`${t.title} ${t.description}`.toLowerCase().includes(search.toLowerCase()))).length} tasks</span></div>
            {data.tasks.filter(t=>(filter==='all'||t.status===filter)&&(filterProject==='all'||t.projectId===filterProject)&&(!search||`${t.title} ${t.description}`.toLowerCase().includes(search.toLowerCase()))).length===0?<div className="p-6"><EmptyMessage icon={<Inbox size={22}/>} title="Nothing here yet" description="Try another filter or add a new task."/></div>:<div className="overflow-x-auto"><table className="w-full min-w-[670px] text-left text-sm"><thead style={{background:'var(--surface-2)',color:'var(--muted)'}}><tr className="text-[11px] uppercase tracking-wider"><th className="px-5 py-3 font-bold">Task</th><th className="px-4 py-3 font-bold">Project</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 font-bold">Priority</th><th className="px-4 py-3 font-bold">Due date</th><th className="px-4 py-3"/></tr></thead><tbody className="divide-y hairline">{data.tasks.filter(t=>(filter==='all'||t.status===filter)&&(filterProject==='all'||t.projectId===filterProject)&&(!search||`${t.title} ${t.description}`.toLowerCase().includes(search.toLowerCase()))).map(t=><tr key={t.id} className="transition hover:bg-black/2 dark:hover:bg-white/3"><td className="max-w-[360px] px-5 py-4"><button className="flex items-center gap-3 text-left" onClick={()=>setEditor({type:'task',projectId:t.projectId,listId:t.listId,task:t})}><StatusIcon status={t.status}/><span className={`font-semibold ${t.status==='completed'?'line-through muted':''}`}>{t.title}</span></button></td><td className="px-4 py-4"><span className="flex items-center gap-2 text-xs"><span className="project-dot" style={{background:data.projects.find(p=>p.id===t.projectId)?.color}}/>{data.projects.find(p=>p.id===t.projectId)?.name}</span></td><td className="px-4 py-4"><StatusBadge status={t.status} small/></td><td className="px-4 py-4"><PriorityLabel priority={t.priority}/></td><td className="px-4 py-4 text-xs"><DueDate value={t.dueDate}/></td><td className="px-4 py-4"><button className="icon-btn" aria-label={`Edit ${t.title}`} onClick={()=>setEditor({type:'task',projectId:t.projectId,listId:t.listId,task:t})}><Pencil size={16}/></button></td></tr>)}</tbody></table></div>}
          </div>
        </>}
        {view==='import'&&<>
          <div className="mb-7"><div className="overline mb-2">Portable by design</div><h1 className="text-3xl font-extrabold tracking-[-1.2px]">Import Markdown</h1><p className="muted mt-2">Bring your checklists in. Keep your data yours.</p></div>
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.32fr_1fr]"><section className="panel p-5 md:p-7"><div className="mb-5 flex items-center gap-3"><IconTile><FileText size={21}/></IconTile><div><h2 className="font-extrabold">Your Markdown, organized</h2><p className="muted mt-0.5 text-xs">Paste content or upload a .md file</p></div></div>
            <input ref={fileRef} type="file" accept=".md,.markdown,text/markdown,text/plain" className="hidden" onChange={handleFile}/>
            <button className="mb-5 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-8 transition hover:bg-violet-500/5" style={{borderColor:'var(--accent-border)',background:'var(--accent-wash)'}} onClick={()=>fileRef.current?.click()}><Upload size={27} style={{color:'var(--accent)'}}/><span className="mt-3 font-bold">Choose a Markdown file</span><span className="muted mt-1 text-xs">.md or .markdown · Max 1 MB</span>{fileName&&<span className="mt-3 rounded-lg bg-white/50 px-3 py-1.5 text-xs font-bold dark:bg-white/10">{fileName}</span>}</button>
            <div className="mb-3 flex items-center justify-between"><label htmlFor="md-content" className="field-label !mb-0">Markdown content</label><button className="btn btn-quiet !p-1 !text-xs" onClick={()=>{setMd(EXAMPLE_MD);setFileName('example.md');}}>Load example</button></div>
            <textarea id="md-content" spellCheck={false} className="field min-h-[315px] resize-y font-mono !text-xs leading-[1.8]" placeholder={'# Project: My workspace\n\n## List: Backlog\n- [ ] My first task | priority:high\n  - [ ] A smaller step\n- [x] Something completed'} value={md} onChange={e=>{setMd(e.target.value);setFileName('');}}/>
            <div className="mt-5"><label className="field-label" htmlFor="import-target">Import destination</label><select id="import-target" className="field" value={importTarget} onChange={e=>setImportTarget(e.target.value)}><option value="new">Create a new project from Markdown</option>{data.projects.map(p=><option key={p.id} value={p.id}>Add new lists to “{p.name}”</option>)}</select></div>
            <button disabled={!canEdit || uploading || !parsePreview?.parsed} className="btn btn-primary mt-5 w-full !py-3" onClick={()=>void submitImport()}><ArrowDownToLine size={17}/>{uploading?'Importing…':'Import Markdown'}</button>
          </section>
          <div className="space-y-5"><section className="panel p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="font-bold">Import preview</h2><span className="chip">Live preview</span></div>{!md.trim()?<EmptyInline text="Add Markdown on the left to preview the structure before importing."/>:parsePreview?.error?<p role="alert" className="rounded-lg bg-red-400/10 px-3 py-3 text-xs text-red-500">{parsePreview.error}</p>:parsePreview?.parsed&&<><div className="mb-4 flex items-center gap-3"><IconTile><FolderKanban size={19}/></IconTile><div><div className="text-sm font-bold">{parsePreview.parsed.name}</div><div className="muted text-xs">Project detected</div></div></div><div className="grid grid-cols-3 gap-3">{[{l:'Lists',v:parsePreview.parsed.lists.length},{l:'Tasks',v:parsePreview.parsed.lists.reduce((n,l)=>n+l.tasks.length,0)},{l:'Subtasks',v:parsePreview.parsed.lists.reduce((n,l)=>n+l.tasks.reduce((s,t)=>s+t.subtasks.length,0),0)}].map(x=><div key={x.l} className="soft-panel p-3 text-center"><div className="text-xl font-extrabold">{x.v}</div><div className="muted text-[11px]">{x.l}</div></div>)}</div><div className="mt-4 space-y-2">{parsePreview.parsed.lists.map((l,i)=><div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs" style={{background:'var(--surface-2)'}}><ListTodo size={15} className="muted"/><span className="min-w-0 flex-1 truncate font-semibold">{l.title}</span><span className="muted">{l.tasks.length} tasks</span></div>)}</div></>}</section>
            <section className="panel p-5 md:p-6"><div className="mb-4 flex items-center gap-2"><FileCode2 size={19} style={{color:'var(--accent)'}}/><h3 className="font-bold">Supported Markdown</h3></div><div className="space-y-3 text-xs leading-relaxed"><p className="muted">Use headings for projects and lists, checkboxes for tasks, and indented checkboxes for subtasks.</p><div className="space-y-2 rounded-xl p-4 font-mono text-[12px] leading-[1.9]" style={{background:'var(--surface-2)'}}><div><span style={{color:'var(--accent)'}}>#</span> Project: My project</div><div><span style={{color:'var(--accent)'}}>##</span> List: Development</div><div>- [ ] New task</div><div>&nbsp; - [x] Completed step</div><div>- [-] In progress</div><div>- [!] Blocked item</div><div>- [?] Failed item</div></div><p className="muted">Optional metadata: <code> | priority:high | due:2026-10-20</code></p><p className="muted">You can export any project or individual list back to Markdown from its project page.</p></div></section>
            <div className="flex items-center gap-3 rounded-xl border p-4 text-xs hairline"><HardDrive size={19} style={{color:'var(--accent)'}}/><p className="muted"><strong style={{color:'var(--text)'}}>Storage choices.</strong> Markdown and task records stay in local MongoDB. Optional task attachments use your configured S3 bucket.</p></div>
          </div></div>
        </>}
        <footer className="muted mt-11 flex flex-wrap items-center justify-between gap-2 border-t pt-5 text-[11px] hairline"><span>© Taskloom · A quieter way to get things done</span><span className="flex items-center gap-2"><span className="status-dot" style={{background:data.databaseOnline?'#4caf8c':'#df9c62'}}/>{data.databaseOnline?'Local database connected':'Database offline'} · MongoDB</span></footer>
      </main>
    </div>
    {editor&&<EditorModal key={editor.type+(editor.type==='project'?editor.project?.id??'new':editor.type==='list'?editor.list?.id??'new'+editor.projectId:editor.type==='task'?editor.task?.id??'new'+editor.listId:editor.subtask?.id??'new'+editor.taskId)} editor={editor} data={data} loading={busy||refreshPending} close={()=>setEditor(null)} run={run} open={setEditor}/>}
    {toast&&<div className="toast" role={toast.error ? "alert" : "status"}><span className={`flex h-6 w-6 items-center justify-center rounded-full ${toast.error?'bg-red-500':'bg-emerald-500'}`}>{toast.error?<X size={14}/>:<Check size={15}/>}</span><span className="min-w-0 flex-1 text-sm">{toast.text}</span><button onClick={()=>setToast(null)} aria-label="Dismiss notification" className="text-white/70"><X size={15}/></button></div>}
  </div>;
}

const EXAMPLE_MD=`# Project: Insure360
> Development, quality, and upgrade roadmap

## List: Foundation
- [ ] T1 Push current code to Git | priority:high | due:2026-10-15
  - [ ] Check branch and remote
  - [ ] Commit a verified baseline
- [-] T2 Audit code using multiple tools | priority:high
  - [x] Identify static analysis tools
  - [ ] Run all configured checks
- [ ] T3 Fix formatting issues | priority:medium

## List: Quality & Optimization
- [ ] T4 Check every page for errors | priority:high
  - [ ] Test admin pages
  - [ ] Test tenant pages
- [ ] T5 Optimize code where required
- [ ] T6 Improve local environment logging
- [ ] T7 Remove deprecated and unused code
- [ ] T8 Fix custom helper conflicts

## List: Framework Upgrades
- [ ] T9 Upgrade Filament 3 to 4 to 5 | priority:high
- [ ] T10 Upgrade Laravel to 13 | priority:high`;

function StatCard({label,value,icon,accent,subtitle}:{label:string;value:number;icon:ReactNode;accent:string;subtitle:string}) {
  return <div className="panel p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><span className="muted text-xs font-semibold">{label}</span><IconTile size={36} color={accent}>{icon}</IconTile></div><div className="mt-2 text-[30px] leading-tight font-extrabold tracking-tight md:text-[35px]">{fmt(value)}</div><div className="muted mt-2 truncate text-[11px]">{subtitle}</div></div>;
}
function MetricMini({title,value,help,icon,color}:{title:string;value:string;help:string;icon:ReactNode;color:string}) {
  return <div className="panel p-4"><div className="mb-2 flex items-center justify-between"><span className="muted text-xs">{title}</span><span style={{color}}>{icon}</span></div><div className="text-[25px] font-extrabold">{value}</div><p className="muted mt-1 truncate text-[11px]">{help}</p></div>;
}
function ProgressDonut({value}:{value:number}) {
  return <div className="relative flex h-[160px] w-[160px] shrink-0 items-center justify-center rounded-full" style={{background:`conic-gradient(#796de9 0% ${value}%,var(--surface-3) ${value}% 100%)`}}><div className="flex h-[128px] w-[128px] flex-col items-center justify-center rounded-full" style={{background:'var(--surface)'}}><div className="text-[32px] font-extrabold tracking-tight">{value}%</div><div className="muted text-[10px] font-semibold uppercase tracking-wider">Complete</div></div></div>;
}
function EmptyInline({text}:{text:string}) {return <p className="muted flex min-h-20 items-center justify-center text-center text-xs">{text}</p>}
function PriorityLabel({priority}:{priority:Task['priority']}) {return <span className="flex items-center gap-2 text-xs font-semibold capitalize"><span className="status-dot" style={{background:priorityColor[priority]}}/>{priority}</span>}
function CompactTask({task,data,onClick}:{task:Task;data:Snapshot;onClick:()=>void}) {return <button className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-black/2 dark:hover:bg-white/3" onClick={onClick}><StatusIcon status={task.status}/><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{task.title}</div><p className="muted mt-1 truncate text-[11px]">{data.projects.find(p=>p.id===task.projectId)?.name} · {data.lists.find(l=>l.id===task.listId)?.title}</p></div><StatusBadge status={task.status} small/><span className="hidden text-xs md:block"><DueDate value={task.dueDate} compact/></span><ChevronRight size={15} className="muted"/></button>}
function BoardList({list,project,data,open,exportList,statusFilter}:{list:TaskList;project:Project;data:Snapshot;open:(mode:Editor)=>void;exportList:()=>void;statusFilter:Status[]}) {
  const tasks=data.tasks.filter(t=>t.listId===list.id&&statusFilter.includes(t.status));
  const done=completed(tasks);
  const [menu,setMenu]=useState(false);
  return <section className="min-w-[285px] rounded-2xl border p-3.5" style={{background:'var(--surface-2)',borderColor:'var(--border)'}}>
    <div className="mb-4 flex items-center gap-2 px-1 pt-1"><span className="project-dot" style={{background:project.color}}/><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-extrabold">{list.title}</h3>{list.description&&<p className="muted mt-0.5 truncate text-[10px]">{list.description}</p>}</div><span className="chip">{done}/{tasks.length}</span><button type="button" className="icon-btn !h-7 !w-7" aria-label={`Options for ${list.title}`} aria-expanded={menu} onClick={()=>setMenu(current=>!current)}><MoreHorizontal size={17}/></button></div>
    {menu&&<div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border p-2 hairline" style={{background:'var(--surface)'}}><button type="button" className="btn !text-xs" onClick={()=>{open({type:'list',projectId:project.id,list});setMenu(false);}}><Pencil size={14}/>Edit list</button><button type="button" className="btn !text-xs" onClick={()=>{exportList();setMenu(false);}}><Download size={14}/>Export list</button></div>}
    <div className="space-y-3">{tasks.map(t=>{
      const subs=data.subtasks.filter(s=>s.taskId===t.id);
      const doneSub=completed(subs);
      return <button key={t.id} className="task-tile block w-full text-left" onClick={()=>open({type:'task',projectId:project.id,listId:list.id,task:t})}>
        <div className="mb-3 flex items-start justify-between gap-2"><span className="flex min-w-0 gap-2"><StatusIcon status={t.status} size={16}/><span className={`text-[13px] leading-relaxed font-bold ${t.status==='completed'?'line-through muted':''}`}>{t.title}</span></span><span className="mt-0.5 shrink-0 h-2 w-2 rounded-full" style={{background:priorityColor[t.priority]}} title={`${t.priority} priority`}/></div>
        {t.description&&<p className="muted mb-3 line-clamp-2 text-[11px] leading-relaxed">{t.description}</p>}
        {subs.length>0&&<div className="mb-3"><div className="muted mb-1.5 flex items-center justify-between text-[10px]"><span className="flex items-center gap-1"><ListChecks size={12}/> Subtasks</span><span>{doneSub}/{subs.length}</span></div><ProgressBar value={percent(doneSub,subs.length)} height={4}/></div>}
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={t.status} small/>{t.dueDate&&<span className="text-[11px]"><DueDate value={t.dueDate} compact/></span>}{data.attachments.some(a=>a.taskId===t.id)&&<span className="muted text-[11px]">{data.attachments.filter(a=>a.taskId===t.id).length} files</span>}</div>
      </button>;})}
      {!tasks.length&&<div className="muted rounded-xl border border-dashed px-3 py-8 text-center text-xs hairline">No tasks yet</div>}
      <button className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-bold transition hover:bg-black/4 dark:hover:bg-white/5" style={{color:'var(--muted)'}} onClick={()=>open({type:'task',projectId:project.id,listId:list.id})}><Plus size={16}/>Add task</button>
    </div>
  </section>;
}
