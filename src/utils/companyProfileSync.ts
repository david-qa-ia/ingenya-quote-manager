import { isAuthConfigured } from './authService';
import {
  loadCompanyProfileVersion,
  saveCompanyProfile,
  saveCompanyProfileVersion,
  type CompanyProfile,
} from './companyProfileStorage';
import { loadRemoteCompanyProfile, saveRemoteCompanyProfile } from './supabaseRepository';
import { isWorkspaceUuid } from './workspaceStorage';

const isRemote = (workspaceId?: string): workspaceId is string =>
  isAuthConfigured() && isWorkspaceUuid(workspaceId);

/** SCRUM-119: brings the workspace company data to this device (nothing to do in local mode). */
export async function syncCompanyProfile(workspaceId: string | undefined): Promise<void> {
  if (!isRemote(workspaceId)) return;
  const remote = await loadRemoteCompanyProfile(workspaceId);
  if (remote.profile) {
    saveCompanyProfile(remote.profile);
    saveCompanyProfileVersion(remote.version);
  }
}

export type PersistCompanyProfileResult = { ok: true } | { ok: false; message: string };

export async function persistCompanyProfile(
  workspaceId: string | undefined,
  profile: CompanyProfile,
): Promise<PersistCompanyProfileResult> {
  if (!isRemote(workspaceId))
    return saveCompanyProfile(profile)
      ? { ok: true }
      : { ok: false, message: 'No se pudieron guardar los datos en este navegador.' };
  try {
    const saved = await saveRemoteCompanyProfile(workspaceId, profile, loadCompanyProfileVersion());
    if (!saved.ok) {
      if (saved.reason === 'conflict') await syncCompanyProfile(workspaceId);
      return { ok: false, message: saved.message };
    }
    saveCompanyProfile(profile);
    saveCompanyProfileVersion(saved.version);
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'No se pudo conectar con Supabase. Los datos no se modificaron; intentá de nuevo.',
    };
  }
}
