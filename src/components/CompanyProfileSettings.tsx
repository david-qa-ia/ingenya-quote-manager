import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
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
import { companyProfileToBrand } from '../utils/companyProfileStorage';
import { readLogoFile } from '../utils/logoUpload';
import { downloadSampleQuotePdf } from '../utils/quotePdfSample';
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

const VENTRO_BLUE = '#2F6BFF';

const fields: {
  key: Exclude<keyof Draft, 'logoDataUrl' | 'brandColor'>;
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
  const [logoMessage, setLogoMessage] = useState<{ type: 'info' | 'error'; text: string } | null>(
    null,
  );
  const [previewing, setPreviewing] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
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

  function update(changes: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...changes }));
    setFeedback(null);
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const result = await readLogoFile(file);
    if (!result.ok) {
      setLogoMessage({ type: 'error', text: result.message });
      return;
    }
    const takeColor = !draft.brandColor.trim() && result.suggestedColor;
    update({
      logoDataUrl: result.dataUrl,
      ...(takeColor ? { brandColor: result.suggestedColor! } : {}),
    });
    setLogoMessage(
      takeColor
        ? {
            type: 'info',
            text: `Tomamos el color ${result.suggestedColor} del logo. Podés cambiarlo en "Color de la marca".`,
          }
        : null,
    );
  }

  function firstInvalidField(): CompanyProfileField | undefined {
    const first = (Object.keys(errors) as CompanyProfileField[])[0];
    if (first) {
      setShowErrors(true);
      document.getElementById(`company-${first}`)?.focus();
    }
    return first;
  }

  async function handlePreview() {
    if (firstInvalidField()) return;
    const profile = normalizeCompanyProfile({
      ...draft,
      quoteValidityDays: Number(draft.quoteValidityDays),
    });
    if (!profile) return;
    setPreviewing(true);
    try {
      await downloadSampleQuotePdf(companyProfileToBrand(profile));
    } catch {
      setFeedback({
        type: 'error',
        text: 'No se pudo generar el PDF de ejemplo. Intentá de nuevo.',
      });
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (firstInvalidField()) return;
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
        <fieldset className="company-branding">
          <legend>Marca en el PDF</legend>
          <div className="company-logo-field">
            <span className="company-logo-preview" aria-hidden={!draft.logoDataUrl}>
              {draft.logoDataUrl ? (
                <img src={draft.logoDataUrl} alt="Logo actual" />
              ) : (
                <small>Sin logo</small>
              )}
            </span>
            <div className="company-logo-actions">
              <input
                ref={logoInputRef}
                id="company-logo"
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) => void handleLogoChange(event)}
              />
              <button
                className="button button-line"
                type="button"
                onClick={() => logoInputRef.current?.click()}
              >
                {draft.logoDataUrl ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {draft.logoDataUrl && (
                <button
                  className="button button-link"
                  type="button"
                  onClick={() => {
                    update({ logoDataUrl: '' });
                    setLogoMessage(null);
                  }}
                >
                  Quitar logo
                </button>
              )}
              <small>
                PNG, JPG, WEBP o SVG. Mejor horizontal y con fondo transparente; se achica solo. Sin
                logo, el PDF muestra el nombre de la empresa.
              </small>
              {logoMessage && (
                <p
                  className={logoMessage.type === 'error' ? 'form-error' : 'settings-feedback'}
                  role={logoMessage.type === 'error' ? 'alert' : 'status'}
                >
                  {logoMessage.text}
                </p>
              )}
            </div>
          </div>
          <label className="field" htmlFor="company-brandColor">
            <span>Color de la marca</span>
            <span className="company-color-input">
              <input
                type="color"
                aria-label="Elegir color de la marca"
                value={/^#[0-9a-f]{6}$/i.test(draft.brandColor) ? draft.brandColor : VENTRO_BLUE}
                onChange={(event) => update({ brandColor: event.target.value.toUpperCase() })}
              />
              <input
                id="company-brandColor"
                value={draft.brandColor}
                placeholder={VENTRO_BLUE}
                maxLength={7}
                onChange={(event) => update({ brandColor: event.target.value.trim() })}
                aria-invalid={visibleErrors.brandColor ? true : undefined}
                aria-describedby={visibleErrors.brandColor ? 'company-brandColor-error' : undefined}
              />
            </span>
            {!visibleErrors.brandColor && (
              <small>
                Se usa en la línea del encabezado, la tabla y el total. Vacío usa el azul de Ventro.
              </small>
            )}
            <FieldError id="company-brandColor-error" message={visibleErrors.brandColor} />
          </label>
        </fieldset>
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
                onChange={(event) => update({ [key]: event.target.value })}
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
          <button
            className="button button-line"
            type="button"
            onClick={() => void handlePreview()}
            disabled={previewing}
          >
            <UiIcon name="document" />
            {previewing ? 'Generando…' : 'Ver PDF de ejemplo'}
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
