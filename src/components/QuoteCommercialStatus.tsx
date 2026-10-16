import { useState } from 'react';
import type { CommercialStatus, CommercialStatusAudit, QuoteDocumentStatus } from '../types/quote';
import {
  commercialStatusLabels,
  getCommercialTransitionTargets,
} from '../utils/quoteCommercialStatus';

interface Props {
  documentStatus: QuoteDocumentStatus;
  commercialStatus: CommercialStatus;
  commercialStatusAudit: CommercialStatusAudit;
  sentAudit?: CommercialStatusAudit;
  hasOpportunity?: boolean;
  onChange: (status: CommercialStatus, audit: CommercialStatusAudit) => string | null;
}

export function QuoteCommercialStatus({
  documentStatus,
  commercialStatus,
  commercialStatusAudit,
  sentAudit,
  hasOpportunity = false,
  onChange,
}: Props) {
  const [target, setTarget] = useState<CommercialStatus | null>(null);
  const [changedBy, setChangedBy] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const targets = getCommercialTransitionTargets(commercialStatus, documentStatus).filter(
    (status) => !hasOpportunity || !['accepted', 'rejected'].includes(status),
  );

  function close() {
    setTarget(null);
    setChangedBy('');
    setReason('');
    setError('');
  }

  function confirm() {
    if (!target) return;
    const result = onChange(target, {
      changedAt: new Date().toISOString(),
      changedBy: changedBy.trim(),
      reason: reason.trim(),
    });
    if (result) {
      setError(result);
      return;
    }
    close();
  }

  return (
    <section className="commercial-follow-up-status" aria-labelledby="commercial-status-title">
      <div className="summary-panel-heading">
        <h3 id="commercial-status-title">Estado comercial</h3>
      </div>
      <p>
        <span className={`status-badge commercial-status-badge status-badge-${commercialStatus}`}>
          {commercialStatusLabels[commercialStatus]}
        </span>
      </p>
      <dl className="summary-read-only-data">
        <div>
          <dt>Último cambio</dt>
          <dd>{new Date(commercialStatusAudit.changedAt).toLocaleString('es-AR')}</dd>
        </div>
        <div>
          <dt>Registrado por</dt>
          <dd>{commercialStatusAudit.changedBy}</dd>
        </div>
        <div>
          <dt>Motivo</dt>
          <dd>{commercialStatusAudit.reason}</dd>
        </div>
        {sentAudit && (
          <div>
            <dt>Envío registrado</dt>
            <dd>
              {new Date(sentAudit.changedAt).toLocaleString('es-AR')}
              {sentAudit.channel && ` · ${sentAudit.channel === 'whatsapp' ? 'WhatsApp' : 'email'}`}
              {sentAudit.recipient && ` · ${sentAudit.recipient}`}
            </dd>
          </div>
        )}
      </dl>
      {documentStatus !== 'finalized' ? (
        <p className="commercial-note">
          Finalizá el documento antes de registrar cambios comerciales posteriores.
        </p>
      ) : targets.length > 0 ? (
        <div className="commercial-actions">
          {targets.map((status) => (
            <button
              key={status}
              className="button button-line"
              type="button"
              onClick={() => setTarget(status)}
            >
              Marcar como {commercialStatusLabels[status].toLowerCase()}
            </button>
          ))}
        </div>
      ) : (
        <p className="commercial-note">
          {hasOpportunity && ['sent', 'followingUp'].includes(commercialStatus)
            ? 'Registrá aceptación o rechazo desde Resultado comercial para conservar el historial de la obra o trabajo.'
            : 'Este estado está cerrado. La reapertura se resolverá en una operación posterior auditada.'}
        </p>
      )}
      {target && (
        <div className="modal-backdrop">
          <section className="confirmation-modal" role="dialog" aria-modal="true">
            <h2>¿Registrar estado {commercialStatusLabels[target].toLowerCase()}?</h2>
            <p>Este cambio no modifica el documento finalizado ni envía comunicaciones.</p>
            <label className="field">
              <span>Registrado por</span>
              <input value={changedBy} onChange={(event) => setChangedBy(event.target.value)} />
            </label>
            <label className="field">
              <span>Motivo</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            {error && (
              <p className="commercial-warning" role="alert">
                {error}
              </p>
            )}
            <div className="confirmation-actions">
              <button className="button button-line" type="button" onClick={close}>
                Cancelar
              </button>
              <button className="button button-primary" type="button" onClick={confirm}>
                Confirmar cambio
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
