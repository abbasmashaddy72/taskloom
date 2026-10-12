'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export type SearchOption = { value: string; label: string; description?: string };

/** Keyboard-accessible, filterable single-selection control. */
export function SearchSelect({
  value,
  onChange,
  options,
  label,
  placeholder = 'Select an option',
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchOption[];
  label: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [upward, setUpward] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const choice = options.find((item) => item.value === value);
  const filtered = options
    .filter((item) =>
      `${item.label} ${item.description ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    )
    .slice(0, 100);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const choose = (chosen: string) => {
    onChange(chosen);
    setOpen(false);
    setQuery('');
    setActive(0);
  };
  const expand = () => {
    if (disabled) return;
    const bounds = container.current?.getBoundingClientRect();
    setUpward(Boolean(bounds && window.innerHeight - bounds.bottom < 260 && bounds.top > 260));
    setOpen(true);
    setQuery('');
    setActive(0);
    requestAnimationFrame(() => input.current?.focus());
  };
  return (
    <div className="relative min-w-0" ref={container}>
      <button
        type="button"
        className="field flex items-center justify-between gap-2 text-left"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : expand())}
      >
        <span className="min-w-0 flex-1 truncate">{choice?.label ?? placeholder}</span>
        <ChevronDown size={15} className="muted shrink-0" />
      </button>
      {open && (
        <div
          id={id}
          className={`hairline absolute right-0 left-0 z-[120] min-w-[180px] overflow-hidden rounded-xl border p-2 shadow-xl ${upward ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          style={{ background: 'var(--surface)' }}
        >
          <div className="hairline flex items-center gap-2 rounded-lg border px-2">
            <Search size={15} className="muted" />
            <input
              ref={input}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={`${id}-options`}
              className="min-w-0 flex-1 bg-transparent py-2 text-xs outline-none"
              placeholder={`Search ${label.toLowerCase()}…`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setOpen(false);
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((i) => Math.max(0, Math.min(i + 1, filtered.length - 1)));
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                }
                if (e.key === 'Enter' && filtered[active]) {
                  e.preventDefault();
                  choose(filtered[active].value);
                }
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  input.current?.focus();
                }}
                aria-label="Clear selector search"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div
            id={`${id}-options`}
            role="listbox"
            aria-label={label}
            className="mt-1 max-h-48 overflow-y-auto"
          >
            {filtered.map((option, index) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                key={option.value}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5 ${index === active ? 'bg-black/5 dark:bg-white/5' : ''}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option.value)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{option.label}</span>
                  {option.description && (
                    <span className="muted mt-0.5 block truncate">{option.description}</span>
                  )}
                </span>
                {option.value === value && <Check size={14} />}
              </button>
            ))}
            {filtered.length === 0 && <p className="muted px-3 py-3 text-xs">No matching options.</p>}
          </div>
          {options.length > 100 && (
            <p className="muted px-2 pt-1 text-[10px]">Showing first 100 matches; search to narrow.</p>
          )}
        </div>
      )}
    </div>
  );
}
