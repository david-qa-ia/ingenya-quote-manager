import { useEffect, useState, type FormEvent } from 'react';
import {
  COMPANY_PROFILE_UPDATED_EVENT,
  getCompanyProfileFieldErrors,
  hasStoredCompanyProfile,
  loadCompanyProfile,
  normalizeCompanyProfile,
  type CompanyProfile,
  type CompanyProfileField,
} from '../utils/companyProfileStorage';
import { persistCompanyProfile } from '../utils/companyProfileSync';
import { FieldError } from './FieldError';
import { UiIcon } from './UiIcon';

interface Props {
  workspaceId?: string;
}

type Draft = Omit<CompanyProfile, 'quoteValidityDays'> & { quoteValidityDays: string };

const toDraft = (profile: CompanyProfile): Draft => ({
  ...profile,
  quoteValidityDays: String(profile.quoteValidityDays),
});

const fields: {
  key: keyof Draft;
  label: string;
  placeholder?: string;
  hint?: string;
  inputMode?: 'email' | 'tel' | 'url' | 'numeric';
}[] = [
  { key: 'companyName', label: 'Nombre de la empresa', placeholder: 'Ventro' },
  { key: 'tagline', label: 'Subtítulo (opcional)', placeholder: 'Automatización comercial' },
  { key: 'email', label: 'Email', placeholder: 'nombre@empresa.com', inputMode: 'email' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '341 779-3657', inputMode: 'tel' },
  { key: 'website', label: 'Sitio web', placeholder: 'www.empresa.com', inputMode: 'url' },
  { key: 'instagram', label: 'Instagram (opcional)', placeholder: '@empresa' },
  {
    key: 'footerText',
    label: 'Texto del pie del PDF',
    placeholder: 'Empresa · Servicios',
    hint: 'Si lo dejás vacío se usa el nombre de la empresa.',
  },
  {
    key: 'quoteValidityDays',
    label: 'Validez del presupuesto (días)',
    inputMode: 'numeric',
    hint: 'El PDF muestra "Válido hasta" con esta cantidad de días desde la emisión.',
  },
];

/**
 * SCRUM-119: the data that appears on this workspace's quotes. Each company that uses the app
 * fills in its own; empty contact fields are left out of the PDF.
 */
export function CompanyProfileSettings({ workspaceId }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(loadCompanyProfile()));
  const [isCustom, setIsCustom] = useState(hasStoredCompanyProfile);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const errors = getCompanyProfileFieldErrors(draft);
  const visibleErrors: Partial<Record<CompanyProfileField, string>> = showErrors ? errors : {};

  useEffect(() => {
    const refresh = () => {
      setDraft(toDraft(loadCompanyProfile()));
      setIsCustom(hasStoredCompanyProfile());
    };
    window.addEventListener(COMPANY_PROFILE_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(COMPANY_PROFILE_UPDATED_EVENT, refresh);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstInvalid = (Object.keys(errors) as CompanyProfileField[])[0];
    if (firstInvalid) {
      setShowErrors(true);
      document.getElementById(`company-${firstInvalid}`)?.focus();
      return;
    }
    const profile = normalizeCompanyProfile({
      ...draft,
      quoteValidityDays: Number(draft.quoteValidityDays),
    });
    if (!profile) return;
    setSaving(true);
    try {
      const saved = await persistCompanyProfile(workspaceId, profile);
      setFeedback(
        saved.ok
          ? { type: 'success', text: 'Datos guardados. Los próximos PDF ya los usan.' }
          : { type: 'error', text: saved.message },
      );
      if (saved.ok) {
        setShowErrors(false);
        setIsCustom(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-card company-profile-settings" aria-labelledby="company-title">
      <div className="responsibles-heading">
        <span className="responsibles-heading-icon" aria-hidden="true">
          <UiIcon name="building" />
        </span>
        <div>
          <h2 id="company-title">Datos de la empresa</h2>
          <p>
            Aparecen en los presupuestos en PDF de este espacio de trabajo.
            {!isCustom && ' Todavía se usan los datos de Ventro; guardalos para usar los tuyos.'}
          </p>
        </div>
      </div>
      <form
        className="company-profile-form"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        {fields.map(({ key, label, placeholder, hint, inputMode }) => {
          const error = visibleErrors[key as CompanyProfileField];
          return (
            <label className="field" key={key} htmlFor={`company-${key}`}>
              <span>{label}</span>
              <input
                id={`company-${key}`}
                value={draft[key]}
                placeholder={placeholder}
                inputMode={inputMode}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, [key]: event.target.value }));
                  setFeedback(null);
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `company-${key}-error` : undefined}
              />
              {hint && !error && <small>{hint}</small>}
              <FieldError id={`company-${key}-error`} message={error} />
            </label>
          );
        })}
        <div className="company-profile-actions">
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar datos'}
          </button>
          {feedback && (
            <p
              className={feedback.type === 'error' ? 'form-error' : 'settings-feedback'}
              role={feedback.type === 'error' ? 'alert' : 'status'}
            >
              {feedback.text}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
