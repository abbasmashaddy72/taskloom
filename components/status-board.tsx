'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Plus } from 'lucide-react';
import { DueDate, ProgressBar, StatusBadge, StatusIcon, statusInfo } from './shared';
import type { Snapshot, Status, Task } from '@/lib/types';
import type { Editor } from './editors';

const priorityColor = { high: '#e97a7e', medium: '#eead68', low: '#5aa98a' };

export function StatusBoard({
  data,
  tasks,
  statuses,
  open,
  addTask,
}: {
  data: Snapshot;
  tasks: Task[];
  statuses: readonly Status[];
  open: (editor: Editor) => void;
  addTask: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const syncScroll = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    setCanScrollLeft(node.scrollLeft > 2);
    setCanScrollRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    syncScroll();
    const observer = new ResizeObserver(syncScroll);
    observer.observe(node);
    // Status filtering changes the content width without resizing the container.
    const content = node.firstElementChild;
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [statuses, syncScroll]);

  const scroll = (direction: -1 | 1) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.min(node.clientWidth * 0.85, 720), behavior: 'smooth' });
  };

  return (
    <section aria-label="Project tasks grouped by status" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="muted text-xs">
          Scroll horizontally to browse status columns. Select a task to edit it.
        </p>
        <div className="flex items-center gap-2" role="group" aria-label="Scroll status columns">
          <button
            type="button"
            className="icon-btn hairline border"
            aria-label="Scroll status columns left"
            title="Previous columns"
            disabled={!canScrollLeft}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            className="icon-btn hairline border"
            aria-label="Scroll status columns right"
            title="Next columns"
            disabled={!canScrollRight}
            onClick={() => scroll(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        tabIndex={0}
        aria-label="Scrollable status board"
        onScroll={syncScroll}
        className="status-board-scroll focus-outline min-w-0 overflow-x-auto overscroll-x-contain pb-4"
      >
        <div className="flex w-max min-w-full items-start gap-4">
          {statuses.map((status) => {
            const scoped = tasks.filter((task) => task.status === status);
            const info = statusInfo[status];
            return (
              <section
                key={status}
                className="w-[min(82vw,320px)] shrink-0 snap-start rounded-2xl border p-4 sm:w-[320px] xl:w-[335px]"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold">
                    <span className="status-dot !h-2.5 !w-2.5" style={{ background: info.color }} />
                    {info.label}
                  </h3>
                  <span className="chip">{scoped.length}</span>
                </div>
                <div className="space-y-3">
                  {scoped.map((task) => {
                    const children = data.subtasks.filter((subtask) => subtask.taskId === task.id);
                    const completed = children.filter((subtask) => subtask.status === 'completed').length;
                    const attachmentCount = data.attachments.filter(
                      (attachment) => attachment.taskId === task.id,
                    ).length;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        className="task-tile block w-full text-left"
                        onClick={() =>
                          open({ type: 'task', projectId: task.projectId, listId: task.listId, task })
                        }
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="flex min-w-0 gap-2">
                            <StatusIcon status={task.status} size={16} />
                            <strong className="min-w-0 text-[13px] leading-relaxed break-words">
                              {task.title}
                            </strong>
                          </span>
                          <span
                            className="mt-1 h-2 w-2 shrink-0 rounded-full"
                            title={`${task.priority} priority`}
                            style={{ background: priorityColor[task.priority] }}
                          />
                        </span>
                        <span className="muted mt-2 block text-[11px]">
                          {data.lists.find((list) => list.id === task.listId)?.title ?? 'Unassigned list'}
                        </span>
                        {task.description && (
                          <span className="muted mt-2 line-clamp-2 text-xs">{task.description}</span>
                        )}
                        {children.length > 0 && (
                          <span className="mt-3 block">
                            <span className="muted mb-1 block text-[11px]">
                              {completed}/{children.length} subtasks
                            </span>
                            <ProgressBar value={(100 * completed) / children.length} height={4} />
                          </span>
                        )}
                        <span className="mt-3 flex flex-wrap items-center gap-2">
                          <StatusBadge status={task.status} small />
                          {task.dueDate && <DueDate value={task.dueDate} compact />}
                          {attachmentCount > 0 && (
                            <span className="muted flex items-center gap-1 text-[11px]">
                              <FileText size={12} />
                              {attachmentCount}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                  {!scoped.length && (
                    <p className="muted hairline rounded-lg border border-dashed px-3 py-8 text-center text-xs">
                      No {info.label.toLowerCase()} tasks
                    </p>
                  )}
                  {status === 'pending' && (
                    <button type="button" className="btn btn-quiet w-full !text-xs" onClick={addTask}>
                      <Plus size={14} /> Add task
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
