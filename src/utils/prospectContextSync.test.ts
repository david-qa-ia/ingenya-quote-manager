import { describe, expect, it } from 'vitest';
import type { Opportunity } from '../types/opportunity';
import type { Prospect } from '../types/prospect';
import {
  syncConvertedProspectContact,
  syncConvertedProspectOpportunity,
} from './prospectContextSync';

const prospect: Prospect = {
  id: 'prospect-1',
  name: 'Sofía',
  company: 'Estudio Martínez',
  phone: '3411111111',
  email: 'sofia@example.com',
  instagram: '',
  address: 'Calle anterior 10',
  source: 'Instagram',
  potentialService: 'Puertas',
  notes: '',
  status: 'converted',
  priority: 'medium',
  priorityReason: '',
  nextAction: '',
  nextActionAt: '',
  responsible: 'David',
  preferredChannel: 'whatsapp',
  activities: [],
  createdAt: '2026-10-27T00:00:00.000Z',
  updatedAt: '2026-10-27T00:00:00.000Z',
  conversion: {
    state: 'completed',
    startedAt: '2026-10-27T00:00:00.000Z',
    completedAt: '2026-10-27T00:00:00.000Z',
    draft: {
      clientId: 'client-1',
      clientName: 'Sofía',
      clientCompany: 'Estudio Martínez',
      clientPhone: '3411111111',
      clientEmail: 'sofia@example.com',
      clientPreferredChannel: 'whatsapp',
      address: 'Calle anterior 10',
      opportunityId: 'opportunity-1',
      opportunityName: 'Instalación de puertas',
      serviceOfInterest: 'Puertas',
      interestLevel: 'medium',
      detectedNeed: 'Puertas nuevas',
      nextStep: 'Llamar',
      nextStepAt: '2026-10-28T12:00:00.000Z',
      nextStepChannel: 'call',
      responsible: 'David',
    },
  },
};

const opportunity: Opportunity = {
  id: 'opportunity-1',
  clientId: 'client-1',
  name: 'Instalación de puertas',
  address: 'San Martín 123',
  estimatedStartDate: '',
  responsibleSeller: 'David',
  qualification: {
    serviceOfInterest: 'Instalación de puertas',
    interestLevel: 'medium',
    detectedNeed: 'Puertas nuevas',
  },
  createdAt: '2026-10-27T00:00:00.000Z',
  updatedAt: '2026-10-27T00:00:00.000Z',
};

describe('prospect context sync', () => {
  it('copies contact changes from context and records their history in the prospect', () => {
    const result = syncConvertedProspectContact(
      prospect,
      {
        name: 'Sofía Martínez',
        company: 'Estudio Martínez',
        phone: '3412222222',
        email: 'sofia@example.com',
        preferredChannel: 'whatsapp',
        contactConsent: false,
      },
      'David',
      '2026-10-27T12:00:00.000Z',
    );
    expect(result?.prospect).toMatchObject({ name: 'Sofía Martínez', phone: '3412222222' });
    expect(result?.prospect.activities.at(-1)?.description).toContain('Nombre, Teléfono');
  });

  it('copies address and service changes from context and records their history', () => {
    const result = syncConvertedProspectOpportunity(
      prospect,
      opportunity,
      'David',
      '2026-10-27T12:00:00.000Z',
    );
    expect(result?.prospect.address).toBe('San Martín 123');
    expect(result?.prospect.potentialService).toBe('Instalación de puertas');
    expect(result?.prospect.activities.at(-1)?.description).toContain(
      'Dirección, Servicio potencial',
    );
  });
});
