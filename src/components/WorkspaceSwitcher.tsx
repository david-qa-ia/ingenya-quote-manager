import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../context/useWorkspace';
import type { WorkspaceMembership } from '../types/workspace';
import { UiIcon } from './UiIcon';

interface Props {
  hasUnsavedChanges: boolean;
  onResetWorkspaceContext: () => void;
}

const roleLabels = {
  owner: 'Propietario',
  admin: 'Administrador',
  collaborator: 'Colaborador',
} as const;

export function WorkspaceSwitcher({ hasUnsavedChanges, onResetWorkspaceContext }: Props) {
  const { session, activeMembership, isSwitching, accessError, changeWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingMembership, setPendingMembership] = useState<WorkspaceMembership | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  function keepCurrentFocus() {
    setPendingMembership(null);
    window.requestAnimationFrame(() => {
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
      else triggerRef.current?.focus();
    });
  }

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (panelRef.current?.contains(event.target) || triggerRef.current?.contains(event.target))
        return;
      setIsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (pendingMembership) cancelRef.current?.focus();
  }, [pendingMembership]);

  if (!session || !activeMembership) return null;

  async function selectMembership(membership: WorkspaceMembership) {
    if (!session || membership.workspace.id === session.activeWorkspaceId || isSwitching) return;
    if (hasUnsavedChanges) {
      setPendingMembership(membership);
      setIsOpen(false);
      return;
    }
    await applyMembership(membership);
  }

  async function applyMembership(membership: WorkspaceMembership) {
    if (!session) return;
    try {
      await changeWorkspace(membership.workspace.id);
      onResetWorkspaceContext();
      setPendingMembership(null);
      setIsOpen(false);
    } catch {
      // The provider exposes the recoverable error; keep the active workspace intact.
    }
  }

  return (
    <div className="workspace-switcher">
      <button
        ref={triggerRef}
        className="workspace-switcher-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onPointerDown={() => {
          const active = document.activeElement;
          if (active instanceof HTMLElement && active !== document.body) {
            returnFocusRef.current = active;
          }
        }}
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="workspace-switcher-icon">
          <UiIcon name="building" />
        </span>
        <span className="workspace-switcher-copy">
          <strong>{activeMembership.workspace.name}</strong>
          <small>{roleLabels[activeMembership.role]}</small>
        </span>
        <UiIcon name="chevron-down" />
      </button>
      {isOpen && (
        <div
          ref={panelRef}
          className="workspace-switcher-popover"
          role="listbox"
          aria-label="Espacio de trabajo"
        >
          <p className="workspace-switcher-heading">Espacios de trabajo</p>
          {session.memberships.map((membership) => {
            const isActive = membership.workspace.id === session.activeWorkspaceId;
            return (
              <button
                className={`workspace-option ${isActive ? 'workspace-option-active' : ''}`}
                key={membership.workspace.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => void selectMembership(membership)}
              >
                <span className="workspace-switcher-icon">
                  <UiIcon name="building" />
                </span>
                <span className="workspace-switcher-copy">
                  <strong>{membership.workspace.name}</strong>
                  <small>{roleLabels[membership.role]}</small>
                </span>
                {isActive && <UiIcon name="check" aria-label="Espacio activo" />}
              </button>
            );
          })}
          {accessError && (
            <p className="workspace-switcher-error">
              No se pudo actualizar el espacio. Intentá nuevamente.
            </p>
          )}
        </div>
      )}
      {pendingMembership && (
        <div className="workspace-modal-backdrop" role="presentation">
          <section
            className="workspace-confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-confirmation-title"
          >
            <button
              className="workspace-modal-close"
              type="button"
              aria-label="Seguir en este espacio"
              onClick={keepCurrentFocus}
            >
              ×
            </button>
            <h2 id="workspace-confirmation-title">Tenés cambios sin guardar</h2>
            <p>Si cambiás de espacio, se perderán los cambios de este formulario.</p>
            <div className="workspace-confirmation-actions">
              <button ref={cancelRef} className="button" type="button" onClick={keepCurrentFocus}>
                Seguir en este espacio
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => void applyMembership(pendingMembership)}
              >
                Cambiar de espacio
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
