import { useEffect, useRef } from 'react';

interface Props {
  isSaving?: boolean;
  saveError?: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

/** Asks what to do with an unsaved draft before another quote replaces it (SCRUM-97). */
export function UnsavedQuoteDialog({
  isSaving = false,
  saveError,
  onSave,
  onDiscard,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        className="confirmation-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-quote-title"
        aria-describedby="unsaved-quote-description"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !isSaving) {
            event.preventDefault();
            onCancel();
          }
        }}
      >
        <h2 id="unsaved-quote-title">Tenés un presupuesto sin guardar</h2>
        <p id="unsaved-quote-description">
          Si continuás sin guardarlo, se pierden los servicios y datos que cargaste. Podés guardarlo
          como borrador y retomarlo desde Mis presupuestos.
        </p>
        {saveError && (
          <p className="form-error" role="alert">
            {saveError}
          </p>
        )}
        <div className="confirmation-actions">
          <button
            ref={cancelRef}
            className="button button-line"
            type="button"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            className="button button-line"
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
          >
            Descartar cambios
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={onSave}
            disabled={isSaving}
          >
            Guardar borrador y continuar
          </button>
        </div>
      </section>
    </div>
  );
}
