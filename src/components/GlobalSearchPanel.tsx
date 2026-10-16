import { useEffect, useRef } from 'react';
import type { GlobalSearchGroup, GlobalSearchResult } from '../types/globalSearch';
import { UiIcon } from './UiIcon';

interface Props {
  query: string;
  results: readonly GlobalSearchResult[];
  onQueryChange: (value: string) => void;
  onSelect: (result: GlobalSearchResult) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const groups: { key: GlobalSearchGroup; label: string }[] = [
  { key: 'contacts', label: 'Contactos' },
  { key: 'opportunities', label: 'Oportunidades' },
  { key: 'quotes', label: 'Presupuestos' },
];

export function GlobalSearchPanel({
  query,
  results,
  onQueryChange,
  onSelect,
  onClose,
  triggerRef,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndexRef = useRef(0);
  const flatResults = results;

  useEffect(() => {
    inputRef.current?.focus();
    function handlePanelKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
      triggerRef.current?.focus();
    }
    document.addEventListener('keydown', handlePanelKeyDown);
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handlePanelKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose, triggerRef]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      triggerRef.current?.focus();
      return;
    }
    if (!flatResults.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      activeIndexRef.current =
        (activeIndexRef.current + direction + flatResults.length) % flatResults.length;
      resultRefs.current[activeIndexRef.current]?.focus();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      onSelect(flatResults[activeIndexRef.current]);
    }
  }

  return (
    <section ref={panelRef} className="global-search-panel" role="dialog" aria-label="Buscar">
      <div className="global-search-input-wrap">
        <UiIcon name="search" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            activeIndexRef.current = 0;
            onQueryChange(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar contactos, oportunidades..."
          aria-label="Buscar en Ingenya"
        />
        {query && (
          <button
            type="button"
            className="global-search-clear"
            onClick={() => onQueryChange('')}
            aria-label="Limpiar búsqueda"
          >
            ×
          </button>
        )}
        <kbd>⌘ K</kbd>
      </div>
      {query.trim() ? (
        results.length ? (
          <div className="global-search-results">
            {groups.map((group) => {
              const grouped = results.filter((result) => result.group === group.key);
              if (!grouped.length) return null;
              return (
                <div key={group.key} className="global-search-group">
                  <h2>
                    {group.label} ({grouped.length})
                  </h2>
                  {grouped.map((result) => {
                    const index = flatResults.indexOf(result);
                    return (
                      <button
                        key={result.id}
                        ref={(element) => {
                          resultRefs.current[index] = element;
                        }}
                        type="button"
                        className="global-search-result"
                        onClick={() => onSelect(result)}
                      >
                        <span className="global-search-result-icon">
                          <UiIcon name={result.icon} />
                        </span>
                        <span>
                          <strong>{result.title}</strong>
                          <small>{result.context}</small>
                        </span>
                        <UiIcon name="chevron-right" />
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="global-search-empty">
            No encontramos resultados. Probá con otro nombre, teléfono, email u obra.
          </p>
        )
      ) : (
        <p className="global-search-empty">Buscá contactos, oportunidades y presupuestos.</p>
      )}
    </section>
  );
}
