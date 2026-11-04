'use client';
import { useId, useRef, useState } from 'react';
import { Check, ChevronDown, MapPin, Search, X } from 'lucide-react';
import { money } from '@/lib/commerce';
import type { DeliveryArea } from '@/lib/shipping';
export function DeliveryAreaSelect({
  areas,
  value,
  onChange,
  disabled = false,
  required = true,
  label = 'Delivery area',
  showHelp = true,
}: {
  areas: DeliveryArea[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  showHelp?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const selected = areas.find((area) => area.id === value);
  const options = areas.filter((area) =>
    area.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  function choose(area: DeliveryArea) {
    onChange(area.id);
    setOpen(false);
    setQuery('');
    setHighlight(0);
  }
  function move(index: number) {
    const next = Math.max(0, Math.min(options.length - 1, index));
    setHighlight(next);
    document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: 'nearest' });
  }
  return (
    <div
      className="delivery-area-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery('');
        }
      }}
    >
      <label htmlFor={id}>
        {label}{' '}
        <span className="delivery-required" aria-hidden="true">
          {required ? 'Required' : 'Optional'}
        </span>
      </label>
      <div className={`delivery-area-input ${open ? 'open' : ''}`}>
        <MapPin size={18} />
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-required={required}
          aria-expanded={open && !disabled}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          aria-activedescendant={
            open && options[highlight] ? `${id}-option-${highlight}` : undefined
          }
          aria-describedby={showHelp ? `${id}-help` : undefined}
          autoComplete="off"
          enterKeyHint="done"
          disabled={disabled}
          value={open ? query : (selected?.name ?? '')}
          placeholder={selected && open ? selected.name : 'Search and select your area'}
          onFocus={() => {
            setOpen(true);
            setQuery('');
            setHighlight(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange('');
            setHighlight(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (!open) {
                setOpen(true);
                setQuery('');
                setHighlight(0);
              } else move(highlight + 1);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              if (!open) {
                setOpen(true);
                setQuery('');
                setHighlight(0);
              } else move(highlight - 1);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              if (open && options[highlight]) choose(options[highlight]);
              else if (!open) {
                setOpen(true);
                setQuery('');
              }
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
              setQuery('');
            } else if (open && event.key === 'Home') {
              event.preventDefault();
              move(0);
            } else if (open && event.key === 'End') {
              event.preventDefault();
              move(options.length - 1);
            }
          }}
        />
        {selected ? (
          <button
            type="button"
            disabled={disabled}
            aria-label="Clear delivery area"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange('');
              setQuery('');
              setHighlight(0);
              setOpen(true);
              input.current?.focus();
            }}
          >
            <X size={17} />
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            aria-label="Show delivery areas"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              input.current?.focus();
              setOpen(!open);
              setQuery('');
              setHighlight(0);
            }}
          >
            <ChevronDown size={18} />
          </button>
        )}
      </div>
      {open && !disabled ? (
        <div className="delivery-area-menu">
          <div className="delivery-menu-label">
            <Search size={13} />
            Available delivery areas
          </div>
          <ul id={`${id}-listbox`} role="listbox" aria-label="Delivery areas">
            {options.map((area, index) => (
              <li key={area.id} role="presentation">
                <button
                  type="button"
                  disabled={disabled}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={selected?.id === area.id}
                  className={index === highlight ? 'highlighted' : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onPointerMove={() => setHighlight(index)}
                  onClick={() => choose(area)}
                >
                  <span>{area.name}</span>
                  <strong>{area.price === 0 ? 'Free' : money(area.price)}</strong>
                  {selected?.id === area.id ? <Check size={15} /> : null}
                </button>
              </li>
            ))}
          </ul>
          {!options.length ? (
            <p role="status" className="delivery-no-results">
              No matching area. Try a different area name.
            </p>
          ) : null}
        </div>
      ) : null}
      {showHelp ? (
        <p id={`${id}-help`} className="delivery-area-help">
          {selected
            ? `${selected.price === 0 ? 'Free delivery' : `${money(selected.price)} delivery`} to ${selected.name}.`
            : 'Choose an area from the list to see your delivery charge.'}
        </p>
      ) : null}
    </div>
  );
}
