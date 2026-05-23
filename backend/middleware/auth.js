const { supabaseAdmin } = require('../supabase');

/**
 * Middleware: verify Supabase JWT and attach user info to req
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht angemeldet' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Ungültiges Token' });
    }

    // Get profile with role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ error: 'Profil nicht gefunden' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      profile
    };
    req.token = token;

    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ error: 'Authentifizierung fehlgeschlagen' });
  }
}

/**
 * Middleware: require admin role
 */
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Nur für Admins' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly };
