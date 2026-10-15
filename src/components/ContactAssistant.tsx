import { useEffect, useRef, useState } from 'react';
import type { Activity, ActivitySubject, CallResult } from '../types/activity';
import type {
  ContactChannel,
  ContactCommunicationSnapshot,
  ContactScriptTemplate,
  WhatsAppResult,
} from '../types/contactScript';
import type { ContactContext } from '../utils/contactAssistant';
import { getContactEligibility, renderContactScript } from '../utils/contactAssistant';
import { loadActivityAuthor, saveActivityAuthor } from '../utils/activityStorage';
import { loadContactScripts } from '../utils/contactScriptStorage';
import { confirmContactResult } from '../utils/confirmContactResult';

const callLabels: Record<CallResult, string> = {
  effectiveContact: 'Contacto efectivo',
  noAnswer: 'No contesta',
  callBack: 'Volver a llamar',
  notInterested: 'No interesado',
  invalidNumber: 'Número inválido',
};
const whatsappLabels: Record<WhatsAppResult, string> = {
  messagePrepared: 'Mensaje preparado',
  messageCopied: 'Mensaje copiado',
  responseReceived: 'Respuesta recibida',
  noResponse: 'Sin respuesta',
  invalidNumber: 'Número inválido',
  notInterested: 'No interesado',
};

export interface ContactAssistantProps {
  context: ContactContext;
  subject: ActivitySubject;
  initialChannel?: ContactChannel;
  restrictedChannel?: ContactChannel;
  origin?: ContactCommunicationSnapshot['origin'];
  onClose: () => void;
  onRecorded?: (activity: Activity, nextDueAt: string) => void;
}

export function ContactAssistant({
  context,
  subject,
  initialChannel = 'call',
  restrictedChannel,
  origin = { kind: 'manual' },
  onClose,
  onRecorded,
}: ContactAssistantProps) {
  const [channel, setChannel] = useState<ContactChannel>(restrictedChannel ?? initialChannel);
  const [templates] = useState(() => loadContactScripts().items);
  const [template, setTemplate] = useState<ContactScriptTemplate | undefined>();
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState(loadActivityAuthor);
  const [result, setResult] = useState('');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [nextDueAt, setNextDueAt] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const recordingRef = useRef(false);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  const eligibility = getContactEligibility(context, channel);
  const preview = renderContactScript(content, context);
  const invalid = preview.tokenErrors.length > 0 || preview.missing.length > 0;
  const activeTemplates = templates.filter(
    (item) => item.channel === channel && item.status === 'active',
  );
  function selectTemplate(id: string) {
    const next = activeTemplates.find((item) => item.id === id);
    setTemplate(next);
    setContent(next?.content ?? '');
    setCopied(false);
    setFeedback('');
  }
  async function copy() {
    if (eligibility || invalid || !content.trim()) return;
    try {
      await navigator.clipboard.writeText(preview.rendered);
      setCopied(true);
      setFeedback('Contenido copiado. Copiar no registra un envío ni una actividad.');
    } catch {
      setFeedback('No se pudo copiar el contenido. Podés seleccionarlo manualmente.');
    }
  }
  function record() {
    if (recordingRef.current) return;
    const currentEligibility = getContactEligibility(context, channel);
    if (currentEligibility) return setFeedback(currentEligibility);
    if (
      invalid ||
      !content.trim() ||
      !author.trim() ||
      !result ||
      (channel === 'call' && result === 'callBack' && !nextDueAt)
    )
      return setFeedback(
        'Completá autor, resultado y corregí los datos pendientes antes de registrar.',
      );
    const communication: ContactCommunicationSnapshot = {
      channel,
      templateId: template?.id,
      templateVersion: template?.version,
      templateName: template?.name,
      preparedContent: template ? renderContactScript(template.content, context).rendered : content,
      finalContent: preview.rendered,
      copyState: copied ? 'copied' : 'notCopied',
      origin,
    };
    const activity: Activity = {
      id:
        origin.kind === 'cadence'
          ? `contact:${origin.cadenceExecutionId}:${origin.stepExecutionId}:${result}`
          : crypto.randomUUID(),
      type: channel,
      occurredAt: new Date().toISOString(),
      author: author.trim(),
      result,
      note: note.trim(),
      subject,
      source: 'manual',
      noteRevisions: [],
      communication,
    };
    recordingRef.current = true;
    const confirmation = confirmContactResult({
      context,
      activity,
      rescheduleAt: nextDueAt ? new Date(`${nextDueAt}:00-03:00`).toISOString() : '',
    });
    recordingRef.current = false;
    if (!confirmation.activitySaved)
      return setFeedback('No se pudo guardar la actividad. Intentá nuevamente.');
    saveActivityAuthor(author);
    setFeedback(
      confirmation.transitionApplied
        ? 'Actividad y seguimiento registrados.'
        : `Actividad registrada, pero no se pudo actualizar el seguimiento: ${confirmation.error ?? 'intentá nuevamente.'}`,
    );
    onRecorded?.(activity, nextDueAt ? new Date(`${nextDueAt}:00-03:00`).toISOString() : '');
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <section
        className="confirmation-modal contact-assistant"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-assistant-title"
        aria-describedby="contact-assistant-description"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <h2 id="contact-assistant-title">Asistente de contacto</h2>
        <p id="contact-assistant-description">
          Revisá y confirmá el contenido. Esta aplicación no envía llamadas ni mensajes.
        </p>
        <div className="contact-tabs" role="tablist" aria-label="Canal de contacto">
          {(['call', 'whatsapp'] as ContactChannel[]).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={channel === item}
              disabled={!!restrictedChannel && restrictedChannel !== item}
              className={`button button-line ${channel === item ? 'saved-quote-filter-active' : ''}`}
              onClick={() => {
                setChannel(item);
                setTemplate(undefined);
                setContent('');
                setCopied(false);
              }}
            >
              {item === 'call' ? 'Llamada' : 'WhatsApp'}
            </button>
          ))}
        </div>
        <div className="contact-context">
          <strong>
            {context.client?.name ?? context.quote?.clientName ?? 'Cliente pendiente'}
          </strong>
          <span>
            {context.opportunity?.name ?? context.quote?.projectName ?? 'Sin obra o trabajo'}
          </span>
          {preview.services.length > 1 && <small>Servicios: {preview.services.join(', ')}</small>}
        </div>
        {eligibility && (
          <p className="commercial-warning" role="alert">
            {eligibility}
          </p>
        )}
        <label className="field">
          <span>Plantilla</span>
          <select
            value={template?.id ?? ''}
            onChange={(event) => selectTemplate(event.target.value)}
            disabled={!!eligibility}
          >
            <option value="">Escribir contenido manualmente</option>
            {activeTemplates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · v{item.version}
              </option>
            ))}
          </select>
        </label>
        {channel === 'call' && result === 'callBack' && (
          <label className="field">
            <span>Nueva fecha y hora</span>
            <input
              type="datetime-local"
              value={nextDueAt}
              onChange={(event) => setNextDueAt(event.target.value)}
            />
          </label>
        )}
        <label className="field">
          <span>{channel === 'call' ? 'Guion editable' : 'Mensaje editable'}</span>
          <textarea
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setCopied(false);
            }}
            rows={7}
          />
        </label>
        {(preview.tokenErrors.length > 0 || preview.missing.length > 0) && (
          <p className="commercial-warning" role="alert">
            {[
              ...preview.tokenErrors,
              ...preview.missing.map((item) => `Falta el dato para {{${item}}}.`),
            ].join(' ')}
          </p>
        )}
        <label className="field">
          <span>Vista previa</span>
          <textarea
            value={preview.rendered}
            readOnly
            rows={5}
            aria-label="Vista previa del contenido"
          />
        </label>
        <label className="field">
          <span>Autor</span>
          <input value={author} onChange={(event) => setAuthor(event.target.value)} />
        </label>
        <label className="field">
          <span>Resultado</span>
          <select value={result} onChange={(event) => setResult(event.target.value)}>
            <option value="">Seleccionar resultado</option>
            {Object.entries(channel === 'call' ? callLabels : whatsappLabels).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="field">
          <span>Nota adicional</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        {feedback && (
          <p className="commercial-note" role="status">
            {feedback}
          </p>
        )}
        <div className="confirmation-actions">
          <button ref={cancelRef} className="button button-line" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button button-line"
            type="button"
            disabled={!!eligibility || invalid || !content.trim()}
            onClick={copy}
          >
            {channel === 'call' ? 'Copiar guion' : 'Copiar mensaje'}
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={!!eligibility || invalid || !content.trim()}
            onClick={record}
          >
            Registrar resultado
          </button>
        </div>
      </section>
    </div>
  );
}
