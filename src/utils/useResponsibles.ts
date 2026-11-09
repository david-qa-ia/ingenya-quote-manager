import { useEffect, useState } from 'react';
import {
  hasSingleResponsible,
  loadResponsibles,
  RESPONSIBLES_UPDATED_EVENT,
  type Responsible,
} from './responsibleStorage';

/** Current list of responsibles, refreshed when Configuración or a remote sync changes it. */
export function useResponsibles(): Responsible[] {
  const [list, setList] = useState(loadResponsibles);
  useEffect(() => {
    const refresh = () => setList(loadResponsibles());
    window.addEventListener(RESPONSIBLES_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(RESPONSIBLES_UPDATED_EVENT, refresh);
  }, []);
  return list;
}

/** True while the team has one person: "Responsable" fields and labels are hidden. */
export function useSingleResponsible(): boolean {
  return hasSingleResponsible(useResponsibles());
}
