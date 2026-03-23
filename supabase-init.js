// Supabase Client Initialization
const SUPABASE_URL = 'https://dtfbwqborzjjhqwtobhl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Dbvx3YEyG9LnrL2moVd0NQ_5VF48jos';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  }
});
