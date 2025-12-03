// Shared Supabase client (loaded via CDN in HTML). Replace placeholders with real project settings.
const SUPABASE_URL = 'https://dgdnmenvpkyzdvhtmhmz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnZG5tZW52cGt5emR2aHRtaG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2OTgwOTUsImV4cCI6MjA4MDI3NDA5NX0.QMjrfa88nV5MWZ01V8jkqASNnt-sWkapPMpQpgSyqDA';

if (!window.supabaseClient) {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.warn('Supabase JS SDK is not loaded. Make sure the CDN script is included before supabase-client.js');
    window.supabaseClient = null;
  }
}
