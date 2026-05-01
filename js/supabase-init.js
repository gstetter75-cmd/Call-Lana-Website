// Supabase Client Initialization
const SUPABASE_URL = 'https://dtfbwqborzjjhqwtobhl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZmJ3cWJvcnpqamhxd3RvYmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Njc3MjEsImV4cCI6MjA4OTM0MzcyMX0.BnQ2z_bG3gaCCSCAJR6jXjmJ9dmTGqws2FLU0H8QQsM';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});