const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');
const { adminOnly } = require('../middleware/auth');

// POST /api/employees — Admin creates a new employee (sends invite)
router.post('/', adminOnly, async (req, res) => {
  try {
    const { firstname, lastname, email, area, hours, phone, note, password } = req.body;
    const userPassword = password || 'tushita123';

    if (!email) {
      return res.status(400).json({ error: 'E-Mail ist erforderlich' });
    }
    if (!firstname) {
      return res.status(400).json({ error: 'Vorname ist erforderlich' });
    }

    // Create user via Supabase Auth (invite by email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        firstname: firstname || '',
        lastname: lastname || '',
        role: 'employee',
        area: area || 'service'
      }
    });

    if (authError) {
      console.error('Auth error creating user:', authError);
      if (authError.message?.includes('already')) {
        return res.status(409).json({ error: 'Diese E-Mail wird bereits verwendet' });
      }
      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user.id;

    // Update profile with extra fields (trigger already created the row)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        hours: hours || 0,
        phone: phone || '',
        note: note || ''
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Profile update error:', profileError);
    }

    // Generate a password reset link so the employee can set their password
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/set-password`
      }
    });

    // Fetch the created profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    res.status(201).json({
      profile,
      inviteLink: linkData?.properties?.action_link || null,
      message: `Mitarbeiter ${firstname} ${lastname} angelegt. Einladungs-E-Mail wird gesendet.`
    });
  } catch (err) {
    console.error('Create employee error:', err);
    res.status(500).json({ error: 'Fehler beim Anlegen des Mitarbeiters' });
  }
});

// GET /api/employees — List all employees (profiles)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('List employees error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Mitarbeiter' });
  }
});

// PUT /api/employees/:id — Admin updates employee profile
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstname, lastname, area, hours, phone, note } = req.body;

    const updates = {};
    if (firstname !== undefined) updates.firstname = firstname;
    if (lastname !== undefined) updates.lastname = lastname;
    if (area !== undefined) updates.area = area;
    if (hours !== undefined) updates.hours = hours;
    if (phone !== undefined) updates.phone = phone;
    if (note !== undefined) updates.note = note;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Update employee error:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// DELETE /api/employees/:id — Admin deletes employee
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Remove from auth (cascade will delete profile)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) {
      console.error('Auth delete error:', authError);
      return res.status(400).json({ error: authError.message });
    }

    // Unassign shifts
    await supabaseAdmin
      .from('shifts')
      .update({ employee_id: null })
      .eq('employee_id', id);

    // Clean up swap requests
    await supabaseAdmin
      .from('swap_requests')
      .delete()
      .eq('from_employee_id', id);

    res.json({ message: 'Mitarbeiter gelöscht' });
  } catch (err) {
    console.error('Delete employee error:', err);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// POST /api/employees/:id/reset-password — Admin triggers password reset
router.post('/:id/reset-password', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
    }

    // Get user email from auth
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(id);
    if (!authUser?.user?.email) {
      return res.status(404).json({ error: 'Keine E-Mail hinterlegt' });
    }

    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: authUser.user.email,
      options: {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/set-password`
      }
    });

    if (error) throw error;
    res.json({ message: `Passwort-Reset-Link wurde an ${authUser.user.email} gesendet` });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Fehler beim Zurücksetzen des Passworts' });
  }
});

module.exports = router;
