// Copy this file to config.js (same folder) and fill in your actual Supabase
// project values. config.js is gitignored — it never gets committed, so your
// keys stay out of GitHub history.
//
// Where to find these: Supabase dashboard → your project → Project Settings
// → API. Use the "anon" "public" key — NOT the service_role key. The anon
// key is safe to ship in client-side code; Row Level Security (see
// supabase/schema.sql) is what actually controls what it's allowed to do.
window.SUPABASE_CONFIG = {
  url: 'https://YOUR-PROJECT.supabase.co',
  anonKey: 'YOUR-ANON-PUBLIC-KEY'
};
