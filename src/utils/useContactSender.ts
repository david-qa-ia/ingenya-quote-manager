import { useMemo } from 'react';
import type { ContactSender } from './contactAction';
import { loadCompanyProfile } from './companyProfileStorage';
import { primaryResponsibleName } from './responsibleStorage';
import { useResponsibles } from './useResponsibles';

/** Who signs the WhatsApp messages: the primary person on the team and the company name. */
export function useContactSender(): ContactSender {
  const responsibles = useResponsibles();
  return useMemo(
    () => ({
      senderName: primaryResponsibleName(responsibles),
      companyName: loadCompanyProfile().companyName,
    }),
    [responsibles],
  );
}
