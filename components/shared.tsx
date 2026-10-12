'use client';

import { useEffect, type ReactNode } from 'react';
import { AlertCircle, CalendarDays, Check, Circle, CircleAlert, Clock3, LoaderCircle, ShieldAlert, X } from 'lucide-react';
import type { Status } from '@/lib/types';

export const statusInfo: Record<Status, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#85899b', bg: '#8d91ad17' },
  in_progress: { label: 'In progress', color: '#6395e8', bg: '#6395e817' },
  blocked: { label: 'Blocked', color: '#e7a65b', bg: '#e7a65b1b' },
  completed: { label: 'Completed', color: '#49ae89', bg: '#49ae891b' },
  failed: { label: 'Failed', color: '#e27182', bg: '#e271821b' },
};
export const statusIcons = {
  pending: Circle, in_progress: LoaderCircle, blocked: ShieldAlert, completed: Check, failed: CircleAlert,
};
export function StatusIcon({ status, size = 17 }: { status: Status; size?: number }) {
  const Icon = statusIcons[status];
  return <Icon size={size} style={{ color: statusInfo[status].color }} strokeWidth={status === 'completed' ? 2.6 : 2} />;
}
export function StatusBadge({ status, small = false }: { status: Status; small?: boolean }) {
  const info = statusInfo[status];
  return <span className="inline-flex items-center gap-1.5 rounded-lg font-semibold" style={{ color: info.color, background: info.bg, padding: small ? '3px 7px' : '5px 9px', fontSize: small ? 10 : 11 }}><span className="status-dot" style={{ background: info.color }} />{info.label}</span>;
}
export function DueDate({ value, compact = false }: { value: string | null; compact?: boolean }) {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  const today = new Date(); today.setHours(0,0,0,0);
  const overdue = d.getTime() < today.getTime();
  return <span className={`inline-flex items-center gap-1 ${overdue ? 'date-overdue' : 'muted'}`} title={overdue ? 'Overdue' : 'Due date'}><CalendarDays size={compact ? 12 : 14}/>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })}</span>;
}
export function ProgressBar({ value, color, height = 7 }: { value: number; color?: string; height?: number }) {
  return <div className="progress-track" style={{ height }}><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, ...(color ? { background: color } : {}) }} /></div>;
}
export function IconTile({ children, color = '#7769e8', size = 42 }: { children: ReactNode; color?: string; size?: number }) {
  return <span className="inline-flex shrink-0 items-center justify-center rounded-xl" style={{ color, background: `${color}17`, height:size, width:size }}>{children}</span>;
}
export function Dialog({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} role="presentation">
    <section className="modal" style={{ maxWidth: wide ? 640 : 520 }} role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
        <div><h2 className="text-xl font-bold tracking-tight">{title}</h2>{subtitle && <p className="muted mt-1 text-sm">{subtitle}</p>}</div>
        <button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={18}/></button>
      </div>
      {children}
    </section>
  </div>;
}
export function FormField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block"><span className="field-label">{label}</span>{children}{hint && <span className="muted mt-1 block text-xs">{hint}</span>}</label>;
}
export function ModalFooter({ loading, onClose, submitLabel = 'Save changes' }: { loading: boolean; onClose: () => void; submitLabel?: string }) {
  return <div className="mt-6 flex items-center justify-end gap-2 border-t px-6 py-4 hairline" style={{ background: 'var(--surface-2)', borderRadius: '0 0 20px 20px' }}>
    <button type="button" className="btn" onClick={onClose}>Cancel</button>
    <button type="submit" disabled={loading} className="btn btn-primary">{loading ? <LoaderCircle size={16} className="animate-spin"/> : <Check size={16}/>} {submitLabel}</button>
  </div>;
}
export function ErrorHint({ message }: { message?: string }) { return message ? <p role="alert" className="mt-3 flex gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-500"><AlertCircle size={17} className="shrink-0"/>{message}</p> : null; }
export function EmptyMessage({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-14 text-center hairline" style={{background:'var(--surface)'}}>
    <div className="mb-4 rounded-2xl p-4" style={{background:'var(--accent-wash)', color:'var(--accent)'}}>{icon}</div>
    <h3 className="font-bold">{title}</h3><p className="muted mt-1 max-w-xs text-sm leading-relaxed">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>;
}
export function OverdueCount({ count }: {count:number}) { return count > 0 ? <span className="flex items-center gap-1 text-xs font-semibold text-red-400"><Clock3 size={13}/>{count} overdue</span> : null; }
