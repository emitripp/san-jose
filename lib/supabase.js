// Supabase Client Configuration
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('⚠️  Missing Supabase environment variables!');
    console.error('Required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
    console.error('Please check your .env file');
    // Create dummy clients to prevent crash - API will return errors
    module.exports = {
        supabase: null,
        supabaseAdmin: null,
        isConfigured: false
    };
} else {
    // Client for public operations (respects RLS)
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Admin client for backend operations (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    module.exports = { supabase, supabaseAdmin, isConfigured: true };
}
