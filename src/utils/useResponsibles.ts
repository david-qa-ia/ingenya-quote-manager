import { useEffect, useState } from 'react';
import {
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
