// Supabase Client Initialization
const SUPABASE_URL = 'https://odcyprmamhlsadsaoqfq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kY3lwcm1hbWhsc2Fkc2FvcWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDg1NjAsImV4cCI6MjA4Njk4NDU2MH0.UgoqTRBn_tqq-avoX2NYy6PVW0xwCyUD0TI_Hr2ccqU';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
