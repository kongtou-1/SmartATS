import os
import tempfile
import unittest
from copy import deepcopy
from io import BytesIO

_TEMP=tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"]=f"sqlite:///{os.path.join(_TEMP.name,'profile.db').replace(os.sep,'/')}"
os.environ["STORAGE_BACKEND"]="local"
os.environ["UPLOAD_DIR"]=os.path.join(_TEMP.name,"uploads")

from fastapi.testclient import TestClient
from app import models
from app.services.database import Base,SessionLocal,engine
from app.main import app
from app.seed import seed_if_empty
from app.services.recruitment import applications
from app.services.talent import candidates


class ApplicationProfileTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  applications.send_email_task.delay=lambda *a,**k:None;applications.analyze_application_task.delay=lambda *a,**k:None;candidates.write_audit
  cls.ctx=TestClient(app);cls.client=cls.ctx.__enter__()
 @classmethod
 def tearDownClass(cls):cls.ctx.__exit__(None,None,None);engine.dispose();_TEMP.cleanup()
 def setUp(self):Base.metadata.drop_all(engine);Base.metadata.create_all(engine);seed_if_empty();candidates_path=candidates
 def auth(self,email):
  r=self.client.post('/api/v1/auth/login',json={'email':email,'password':'demo1234'});return {'Authorization':f"Bearer {r.json()['access_token']}"}
 def profile(self):
  return {'name':'王同学','phone':'13812345678','contact_email':'wang@example.com','identity_type':'CN_ID','identity_number':'310101199901011234','preferred_locations':['上海','杭州'],'education':[{'start':'2018-09','end':'2022-06','education_type':'FULL_TIME','school':'示例大学','degree':'BACHELOR','college':'计算机学院','major':'软件工程','laboratory':'','direction':'人工智能','advisor':''}], 'internships':[], 'work_experiences':[], 'projects':[], 'languages':[], 'certificates':[], 'self_evaluation':''}
 def test_job_types_filter_profile_encryption_pending_resume_and_snapshot(self):
  candidate=self.auth('candidate@demo.com');hr=self.auth('hr@demo.com')
  created=self.client.post('/api/v1/admin/jobs',headers=hr,json={'title':'算法实习生','location':'上海','description':'研发','requirements':'Python','category_code':'RND','job_type':'INTERN'});self.assertEqual(created.status_code,201,created.text);jid=created.json()['id'];self.client.post(f'/api/v1/admin/jobs/{jid}/publish',headers=hr)
  rows=self.client.get('/api/v1/jobs',params={'job_type':'INTERN'}).json();self.assertTrue(rows);self.assertTrue(all(x['job_type']=='INTERN' for x in rows))
  saved=self.client.put('/api/v1/candidate/profile',headers=candidate,json=self.profile());self.assertEqual(saved.status_code,200,saved.text);self.assertEqual(saved.json()['identity_number_masked'],'**************1234');self.assertNotIn('310101199901011234',saved.text)
  with SessionLocal() as db:
   user=db.query(models.CandidateAccount).filter_by(email='candidate@demo.com').one();person=db.query(models.Candidate).filter_by(user_id=user.id).one();self.assertNotIn('310101199901011234',person.identity_number_encrypted);rid=models.Resume(candidate_id=person.id,file_name='resume.pdf',storage_key='resumes/test.pdf',parse_status='PENDING');db.add(rid);db.commit();resume_id=str(rid.id)
  applied=self.client.post('/api/v1/applications',headers=candidate,json={'job_id':jid,'resume_id':resume_id});self.assertEqual(applied.status_code,201,applied.text);aid=applied.json()['id']
  changed=self.profile();changed['name']='修改后的姓名';changed['identity_number']=None;self.client.put('/api/v1/candidate/profile',headers=candidate,json=changed)
  detail=self.client.get(f'/api/v1/admin/applications/{aid}',headers=hr).json();self.assertEqual(detail['job_type_snapshot'],'INTERN');self.assertEqual(detail['candidate_profile_snapshot']['name'],'王同学');self.assertEqual(detail['candidate_profile_snapshot']['identity_number_masked'],'**************1234');self.assertNotIn('310101199901011234',str(detail))
 def test_validation_foreign_resume_and_upload_rules(self):
  candidate=self.auth('candidate@demo.com');profile=self.profile();profile['education']=[];self.client.put('/api/v1/candidate/profile',headers=candidate,json=profile)
  job=self.client.get('/api/v1/jobs').json()[0]
  with SessionLocal() as db:
   other=db.query(models.Candidate).filter(models.Candidate.user_id.is_(None)).first()
   if not other:other=models.Candidate(name='其他人');db.add(other);db.flush()
   resume=models.Resume(candidate_id=other.id,file_name='x.pdf',storage_key='x',parse_status='PENDING');db.add(resume);db.commit();rid=str(resume.id)
  rejected=self.client.post('/api/v1/applications',headers=candidate,json={'job_id':job['id'],'resume_id':rid});self.assertEqual(rejected.status_code,400)
  invalid=self.client.post('/api/v1/candidate/resume',headers=candidate,files={'file':('resume.exe',b'bad','application/octet-stream')});self.assertEqual(invalid.status_code,400)
  mismatch=self.client.post('/api/v1/candidate/resume',headers=candidate,files={'file':('resume.pdf',b'not pdf','application/pdf')});self.assertEqual(mismatch.status_code,400)
  large=self.client.post('/api/v1/candidate/resume',headers=candidate,files={'file':('resume.pdf',b'%PDF'+b'x'*(10*1024*1024),'application/pdf')});self.assertEqual(large.status_code,400)
 def test_invalid_education_date_rejected_only_at_final_application(self):
  candidate=self.auth('candidate@demo.com');profile=self.profile();profile['education'][0]['start']='2024-09';profile['education'][0]['end']='2022-06'
  self.assertEqual(self.client.put('/api/v1/candidate/profile',headers=candidate,json=profile).status_code,200)
  with SessionLocal() as db:
   user=db.query(models.CandidateAccount).filter_by(email='candidate@demo.com').one();person=db.query(models.Candidate).filter_by(user_id=user.id).one();resume=models.Resume(candidate_id=person.id,file_name='x.pdf',storage_key='x',parse_status='PENDING');db.add(resume);db.commit();rid=str(resume.id)
  job=self.client.get('/api/v1/jobs').json()[0];response=self.client.post('/api/v1/applications',headers=candidate,json={'job_id':job['id'],'resume_id':rid});self.assertEqual(response.status_code,400);self.assertIn('结束时间',response.text)
 def test_optional_sections_may_be_empty_but_added_rows_must_be_complete(self):
  candidate=self.auth('candidate@demo.com');profile=self.profile();profile['languages']=[{'language':'英语','proficiency':'','exam':'','score':''}]
  self.client.put('/api/v1/candidate/profile',headers=candidate,json=profile)
  with SessionLocal() as db:
   user=db.query(models.CandidateAccount).filter_by(email='candidate@demo.com').one();person=db.query(models.Candidate).filter_by(user_id=user.id).one();resume=models.Resume(candidate_id=person.id,file_name='x.pdf',storage_key='x',parse_status='PENDING');db.add(resume);db.commit();rid=str(resume.id)
  job=self.client.get('/api/v1/jobs').json()[0];response=self.client.post('/api/v1/applications',headers=candidate,json={'job_id':job['id'],'resume_id':rid});self.assertEqual(response.status_code,400);self.assertIn('熟练度',response.text)

if __name__=='__main__':unittest.main()
