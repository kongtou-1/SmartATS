import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { api } from '../../lib/client';
import type { CandidateProfile } from '../../types';

function editableProfileSignature(profile: CandidateProfile): string {
  return JSON.stringify({
    name: profile.name,
    phone: profile.phone,
    contact_email: profile.contact_email,
    identity_type: profile.identity_type,
    identity_number: profile.identity_number,
    preferred_locations: profile.preferred_locations,
    education: profile.education,
    internships: profile.internships,
    work_experiences: profile.work_experiences,
    projects: profile.projects,
    languages: profile.languages,
    certificates: profile.certificates,
    self_evaluation: profile.self_evaluation,
  });
}

export function useProfileAutosave(
  profile: CandidateProfile,
  enabled: boolean,
  setProfile: Dispatch<SetStateAction<CandidateProfile>>,
  setStatus: Dispatch<SetStateAction<string>>,
): void {
  const latestProfile = useRef(profile);
  latestProfile.current = profile;
  const signature = editableProfileSignature(profile);

  useEffect(() => {
    if (!enabled) return;
    setStatus('等待保存…');
    const timer = window.setTimeout(async () => {
      try {
        const current = latestProfile.current;
        const saved = await api.updateProfile({
          ...current,
          identity_number: current.identity_number || undefined,
        });
        setProfile((value) => ({
          ...value,
          profile_version: saved.profile_version,
          profile_saved_at: saved.profile_saved_at,
          identity_number_set: saved.identity_number_set,
          identity_number_masked: saved.identity_number_masked,
          identity_number: '',
        }));
        setStatus('已自动保存');
      } catch (error) {
        setStatus(`保存失败：${(error as Error).message}`);
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [enabled, setProfile, setStatus, signature]);
}
