// QAcademy MyNMC Licensure — Configuration
// Auto-detects dev vs prod by hostname.
// ────────────────────────────────────────────────────────────────
const IS_PROD = window.location.hostname === 'qacademynurseshub.pages.dev';

const SUPABASE_URL = IS_PROD
  ? 'https://qizhyhjeqhaybyddsuni.supabase.co'
  : 'https://zrakjibtxyzoqcdtvpmq.supabase.co';

const SUPABASE_ANON_KEY = IS_PROD
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpemh5aGplcWhheWJ5ZGRzdW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzIyNDIsImV4cCI6MjA5MTE0ODI0Mn0.LT9m3GoBgJ8eas2jFJzrhAjDJ2gsrlDSkYthLAffv_U'
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYWtqaWJ0eHl6b3FjZHR2cG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDcyODAsImV4cCI6MjA4ODk4MzI4MH0.saSEaK1IkbP03rfVvuwFpXQlLtAdKLIg9V7UwO7a2po';

const PAYMENTS_API_BASE = IS_PROD
  ? 'https://qacademy-licensure-payment-worker.mybackpacc.workers.dev'
  : 'https://qacademy-dev-licensure-payment-worker.mybackpacc.workers.dev';

const EMAIL_WORKER_URL = IS_PROD
  ? 'https://qacademy-licensure-email-worker.mybackpacc.workers.dev'
  : 'https://qacademy-dev-licensure-email-worker.mybackpacc.workers.dev';

const EMAIL_SECRET = IS_PROD
  ? '4b6a430591e24e96a571553a0a17ab2cbea84ac50d804cfaa85ef193734258a3'
  : 'bea84ac50d804cfaa85ef193734258a34b6a430591e24e96a571553a0a17ab2c';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
