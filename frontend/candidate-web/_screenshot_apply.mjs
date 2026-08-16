import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8111/api/v1';

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'candidate@demo.com', password: 'demo1234' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.access_token;

  const jobsRes = await fetch(`${API}/jobs`, { headers: { Authorization: `Bearer ${token}` } });
  const jobs = await jobsRes.json();
  const jobId = jobs[0].id;

  const profileDir = `D:/py_work/hr_system/tmp/pw_profile_${Date.now()}`;
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1440, height: 1200 },
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`);
  await page.evaluate((t) => localStorage.setItem('hr_token', t), token);
  await page.goto(`${BASE}/jobs/${jobId}/apply`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'D:/py_work/hr_system/tmp/apply_wizard_v2.png', fullPage: true });
  console.log('screenshot saved');

  await context.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
