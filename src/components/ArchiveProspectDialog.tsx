import { useEffect, useRef, useState, type FormEvent } from 'react';
import { prospectArchiveReasons } from '../utils/prospectWorkflow';
import { FieldError } from './FieldError';
import { useFieldValidation } from './useFieldValidation';

interface Props {
  prospectName: string;
  isSaving?: boolean;
  saveError?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

type ArchiveField = 'reason' | 'detail';
const archiveFieldOrder: readonly ArchiveField[] = ['reason', 'detail'];

/** Asks why a prospect is archived (SCRUM-111). "Otro" needs a short description. */
export function ArchiveProspectDialog({
  prospectName,
  isSaving = false,
  saveError,
  onConfirm,
  onCancel,
}: Props) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const firstFieldRef = useRef<HTMLSelectElement | null>(null);
  const validation = useFieldValidation<ArchiveField>(
    'archive-prospect',
    {
      ...(reason ? {} : { reason: 'Elegí el motivo del archivo.' }),
      ...(reason === 'Otro' && !detail.trim() ? { detail: 'Contá brevemente el motivo.' } : {}),
    },
    archiveFieldOrder,
  );
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (isSaving || !validation.validateForSubmit()) return;
    onConfirm(reason === 'Otro' ? detail.trim() : reason);
  }
  const reasonProps = validation.fieldProps('reason');
  return (
    <div className="modal-backdrop">
      <form
        className="confirmation-modal commercial-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-prospect-title"
        noValidate
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !isSaving) {
            event.preventDefault();
            onCancel();
          }
        }}
      >
        <h2 id="archive-prospect-title">Archivar a {prospectName}</h2>
        <p>
          Sale de Prospectos y de Seguimiento, pero conserva su historial. Lo podés restaurar desde
          Archivados.
        </p>
        <label className="field">
          <span>Motivo</span>
          <select
            value={reason}
            disabled={isSaving}
            onChange={(event) => setReason(event.target.value)}
            {...reasonProps}
            ref={(element) => {
              firstFieldRef.current = element;
              reasonProps.ref(element);
            }}
          >
            <option value="">Elegí un motivo</option>
            {prospectArchiveReasons.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <FieldError
            id={validation.errorId('reason')}
            message={validation.visibleError('reason')}
          />
        </label>
        {reason === 'Otro' && (
          <label className="field">
            <span>¿Cuál es el motivo?</span>
            <input
              value={detail}
              maxLength={300}
              disabled={isSaving}
              onChange={(event) => setDetail(event.target.value)}
              {...validation.fieldProps('detail')}
            />
            <FieldError
              id={validation.errorId('detail')}
              message={validation.visibleError('detail')}
            />
          </label>
        )}
        {saveError && (
          <p className="form-error" role="alert">
            {saveError}
          </p>
        )}
        <div className="confirmation-actions">
          <button
            className="button button-line"
            type="button"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button className="button button-primary" type="submit" disabled={isSaving}>
            {isSaving ? 'Archivando…' : 'Archivar prospecto'}
          </button>
        </div>
      </form>
    </div>
  );
}
