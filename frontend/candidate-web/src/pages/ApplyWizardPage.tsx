import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BasicInfoStep,
  EducationStep,
  ExperienceStep,
  ReviewStep,
  SupplementStep,
} from '../features/apply/ApplySteps';
import {
  APPLY_STEPS,
  blankProfile,
  validateApplyStep,
  type ProfileListKey,
} from '../features/apply/model';
import { useProfileAutosave } from '../features/apply/useProfileAutosave';
import { api } from '../lib/client';
import type { CandidateProfile, Job, Resume } from '../types';

export default function ApplyWizardPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [profile, setProfile] = useState<CandidateProfile>(blankProfile);
  const [resume, setResume] = useState<Resume | null>(null);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('加载中…');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const isEditMode = searchParams.get('mode') === 'edit' && !id;

  useEffect(() => {
    if (isEditMode) {
      /* 编辑模式：不加载岗位，只加载简历资料 */
      Promise.all([api.getProfile(), api.getResume()])
        .then(([profileResult, resumeResult]) => {
          setProfile({ ...blankProfile, ...profileResult, education: profileResult.education || [] });
          setResume(resumeResult);
          setProfileLoaded(true);
          setStatus('资料已加载');
        })
        .catch((error) => setMessage((error as Error).message));
    } else {
      Promise.all([api.getJob(id), api.getProfile(), api.getResume()])
        .then(([jobResult, profileResult, resumeResult]) => {
          setJob(jobResult);
          setProfile({ ...blankProfile, ...profileResult, education: profileResult.education || [] });
          setResume(resumeResult);
          setProfileLoaded(true);
          setStatus('资料已加载');
        })
        .catch((error) => setMessage((error as Error).message));
    }
  }, [id, isEditMode]);

  useProfileAutosave(profile, profileLoaded, setProfile, setStatus);

  function change<K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateList<K extends ProfileListKey>(
    key: K,
    index: number,
    value: CandidateProfile[K][number],
  ) {
    setProfile((current) => {
      const rows = [...current[key]] as CandidateProfile[K];
      rows[index] = value;
      return { ...current, [key]: rows };
    });
  }

  function remove(key: ProfileListKey, index: number) {
    setProfile((current) => ({
      ...current,
      [key]: current[key].filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function next() {
    const error = validateApplyStep(profile, resume, step);
    if (error) {
      setMessage(error);
      return;
    }
    setMessage('');
    setStep((current) => Math.min(4, current + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function upload(fileToUpload?: File) {
    const target = fileToUpload || file;
    if (!target) return;
    setUploading(true);
    setMessage('');
    try {
      const result = await api.uploadResume(target);
      setResume(result);
      setFile(null);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelect(selected: File | null) {
    setFile(selected);
    if (selected) upload(selected);
  }

  async function submit() {
    for (let currentStep = 0; currentStep < 4; currentStep += 1) {
      const error = validateApplyStep(profile, resume, currentStep);
      if (error) {
        setStep(currentStep);
        setMessage(error);
        return;
      }
    }
    if (!resume) return;
    setUploading(true);
    try {
      await api.updateProfile({
        ...profile,
        identity_number: profile.identity_number || undefined,
      });
      if (isEditMode) {
        /* 编辑模式：保存资料后返回简历页 */
        navigate('/resume');
      } else {
        await api.createApplication(id, resume.id);
        navigate('/applications');
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  /* 编辑模式不需要岗位即可渲染；投递模式必须等 job 加载 */
  if (!isEditMode && !job) return <div className="page-loading">{message || '加载中…'}</div>;
  if (isEditMode && !profileLoaded) return <div className="page-loading">{message || '加载中…'}</div>;

  const commonStepProps = { profile, change, updateList, remove };

  return (
    <div className="page apply-page">
      <button className="btn-link" onClick={() => navigate(isEditMode ? '/resume' : `/jobs/${id}`)}>
        &larr; {isEditMode ? '返回简历' : '返回岗位'}
      </button>
      <div className="apply-title">
        <div>
          <h1>{isEditMode ? '编辑简历' : `申请 ${job?.title || ''}`}</h1>
          <p>{isEditMode ? '完善个人资料' : job?.location || ''}</p>
        </div>
        <span className="save-state">{status}</span>
      </div>
      <ol className="stepper">
        {APPLY_STEPS.map(({ title }, index) => {
          const state = index === step ? 'active' : index < step ? 'done' : 'pending';
          return (
            <li className={state} key={title}>
              <span>{index < step ? '✓' : index + 1}</span>
              <div>
                <b>{title}</b>
              </div>
            </li>
          );
        })}
      </ol>

      {step === 0 && <BasicInfoStep profile={profile} change={change} />}
      {step === 1 && <EducationStep {...commonStepProps} />}
      {step === 2 && <ExperienceStep {...commonStepProps} />}
      {step === 3 && (
        <SupplementStep
          {...commonStepProps}
          resume={resume}
          file={file}
          uploading={uploading}
          onFileChange={(event) => handleFileSelect(event.target.files?.[0] || null)}
          onFile={handleFileSelect}
        />
      )}
      {step === 4 && <ReviewStep profile={profile} resume={resume} />}

      {message && <div className="alert">{message}</div>}
      <div className="wizard-actions">
        {step > 0 && (
          <button className="btn" onClick={() => setStep((current) => current - 1)}>
            上一步
          </button>
        )}
        {step < 4 ? (
          <button className="btn btn-primary" onClick={next}>
            保存并下一步
          </button>
        ) : (
          <button className="btn btn-primary" disabled={uploading} onClick={submit}>
            {uploading ? '保存中…' : (isEditMode ? '保存资料' : '确认投递')}
          </button>
        )}
      </div>
    </div>
  );
}
