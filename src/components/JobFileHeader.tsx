import type { ReactNode } from 'react';
import type { JobFileHeading } from '../utils/jobFile';
import { jobStageLabels } from '../utils/jobList';

interface Props {
  heading: JobFileHeading;
  backLabel: string;
  onBack: () => void;
  /** A short line under the detail, such as where the first contact stands. */
  note?: ReactNode;
  /** The main actions of the file, on the right on desktop. */
  actions?: ReactNode;
}

/**
 * Header shared by every job file. A prospect and the opportunity it becomes show the same
 * header, so converting it only moves the stage forward.
 */
export function JobFileHeader({ heading, backLabel, onBack, note, actions }: Props) {
  return (
    <>
      <button
        className="button button-link opportunity-back back-link"
        type="button"
        onClick={onBack}
      >
        ← {backLabel}
      </button>
      <header className="opportunity-detail-header">
        <div>
          <p className="eyebrow">Trabajo</p>
          <div className="opportunity-title-row">
            <h1>{heading.name}</h1>
            <span className={`jobs-stage jobs-stage-${heading.stage}`}>
              {jobStageLabels[heading.stage]}
            </span>
          </div>
          {heading.detail && <p className="page-description">{heading.detail}</p>}
          {note && <p className="page-description job-file-note">{note}</p>}
        </div>
        {actions && <div className="opportunity-header-actions">{actions}</div>}
      </header>
    </>
  );
}
