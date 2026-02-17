import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env file');
}

/**
 * Supabase client configured for HIPAA compliance and mobile deep linking
 * - Uses AsyncStorage for session persistence
 * - PKCE flow enabled for secure mobile auth
 * - Deep link detection enabled for invite handling
 * - Requires Business Associate Agreement (BAA) with Supabase
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // We handle this manually in DeepLinkHandler
    flowType: 'pkce', // Use PKCE flow for mobile (more secure)
  },
  global: {
    headers: {
      'X-Client-Info': 'log-peer-recovery-mobile',
    },
  },
});

/**
 * HIPAA Compliance Notes:
 * 1. Ensure Supabase project has BAA signed
 * 2. Enable Row Level Security (RLS) on all tables
 * 3. Use encrypted fields for PHI data
 * 4. Configure audit logging
 * 5. Set appropriate session timeout (15 minutes)
 */
