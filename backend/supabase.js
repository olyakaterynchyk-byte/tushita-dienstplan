const { createClient } = require('@supabase/supabase-js');

// Service-role client — full access, bypasses RLS
// ONLY use on the server, never expose the key
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Create a per-request client using the user's JWT
// This respects RLS policies
function createUserClient(jwt) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      global: {
        headers: { Authorization: `Bearer ${jwt}` }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

module.exports = { supabaseAdmin, createUserClient };
