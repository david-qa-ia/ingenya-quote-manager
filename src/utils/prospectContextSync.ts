import type { ClientInput } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import type { Prospect } from '../types/prospect';

export interface ProspectContextSync {
  prospect: Prospect;
  changes: string[];
}

function withHistory(
  prospect: Prospect,
  changes: readonly string[],
  author: string,
  now: string,
): ProspectContextSync {
  return {
    changes: [...changes],
    prospect: {
      ...prospect,
      updatedAt: now,
      activities: [
        ...prospect.activities,
        {
          id: crypto.randomUUID(),
          prospectId: prospect.id,
          occurredAt: now,
          createdAt: now,
          type: 'note',
          description: `Datos actualizados desde el contexto: ${changes.join(', ')}.`,
          author: author.trim() || 'Sistema local',
        },
      ],
    },
  };
}

/** Prospect-only data edited from the opportunity contact card (SCRUM-120). */
export interface ProspectContactExtras {
  instagram: string;
  address: string;
  source: string;
  potentialService: string;
  notes: string;
}

export function syncConvertedProspectContact(
  prospect: Prospect,
  input: ClientInput,
  author: string,
  now = new Date().toISOString(),
  extras?: ProspectContactExtras,
): ProspectContextSync | null {
  if (!prospect.conversion) return null;
  const next = {
    instagram: extras?.instagram ?? prospect.instagram ?? '',
    address: extras?.address ?? prospect.address ?? '',
    source: extras?.source ?? prospect.source,
    potentialService: extras?.potentialService ?? prospect.potentialService,
    notes: extras?.notes ?? prospect.notes,
  };
  const fields = [
    ['Nombre', prospect.name, input.name.trim()],
    ['Empresa', prospect.company, input.company?.trim() ?? ''],
    ['Teléfono', prospect.phone, input.phone.trim()],
    ['Email', prospect.email, input.email.trim()],
    ['Canal preferido', prospect.preferredChannel, input.preferredChannel],
    ['Instagram', prospect.instagram ?? '', next.instagram],
    ['Dirección', prospect.address ?? '', next.address],
    ['Origen', prospect.source, next.source],
    ['Servicio potencial', prospect.potentialService, next.potentialService],
    ['Observaciones', prospect.notes, next.notes],
  ] as const;
  const changes = fields.filter(([, previous, next]) => previous !== next).map(([label]) => label);
  if (!changes.length) return null;
  const draft = prospect.conversion.draft;
  return withHistory(
    {
      ...prospect,
      name: input.name.trim(),
      company: input.company?.trim() ?? '',
      phone: input.phone.trim(),
      email: input.email.trim(),
      preferredChannel: input.preferredChannel,
      ...next,
      conversion: {
        ...prospect.conversion,
        draft: {
          ...draft,
          address: next.address,
          serviceOfInterest: next.potentialService,
          clientName: input.name.trim(),
          clientCompany: input.company?.trim() ?? '',
          clientPhone: input.phone.trim(),
          clientEmail: input.email.trim(),
          clientPreferredChannel: input.preferredChannel,
        },
      },
    },
    changes,
    author,
    now,
  );
}

export function syncConvertedProspectOpportunity(
  prospect: Prospect,
  opportunity: Opportunity,
  author: string,
  now = new Date().toISOString(),
): ProspectContextSync | null {
  if (!prospect.conversion) return null;
  const serviceOfInterest =
    opportunity.qualification?.serviceOfInterest?.trim() ?? prospect.potentialService;
  const fields = [
    ['Dirección', prospect.address?.trim() ?? '', opportunity.address.trim()],
    ['Servicio potencial', prospect.potentialService, serviceOfInterest],
  ] as const;
  const changes = fields.filter(([, previous, next]) => previous !== next).map(([label]) => label);
  if (!changes.length) return null;
  return withHistory(
    {
      ...prospect,
      address: opportunity.address.trim(),
      potentialService: serviceOfInterest,
      conversion: {
        ...prospect.conversion,
        draft: {
          ...prospect.conversion.draft,
          address: opportunity.address.trim(),
          serviceOfInterest,
        },
      },
    },
    changes,
    author,
    now,
  );
}
