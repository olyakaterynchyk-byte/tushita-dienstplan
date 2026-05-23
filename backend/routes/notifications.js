const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');
const { adminOnly } = require('../middleware/auth');

// POST /api/notifications/publish — Send schedule notification to employees
router.post('/publish', adminOnly, async (req, res) => {
  try {
    const { shiftIds, periodLabel, area } = req.body;

    if (!shiftIds || shiftIds.length === 0) {
      return res.status(400).json({ error: 'Keine Schichten angegeben' });
    }

    // Fetch shifts with employee info
    const { data: shifts, error: shiftsError } = await supabaseAdmin
      .from('shifts')
      .select('*, employee:profiles!shifts_employee_id_fkey(*)')
      .in('id', shiftIds)
      .order('date')
      .order('start_time');

    if (shiftsError) throw shiftsError;

    // Get unique employees with email
    const employeeMap = new Map();
    shifts.forEach(s => {
      if (s.employee && s.employee.id) {
        employeeMap.set(s.employee.id, s.employee);
      }
    });

    // Get emails from auth
    const employees = Array.from(employeeMap.values());
    const emailRecipients = [];

    for (const emp of employees) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(emp.id);
      if (authUser?.user?.email) {
        emailRecipients.push({
          email: authUser.user.email,
          name: `${emp.firstname} ${emp.lastname}`.trim(),
          shifts: shifts.filter(s => s.employee_id === emp.id)
        });
      }
    }

    // If Resend is configured, send emails
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your-resend-api-key-here') {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      const areaLabel = area === 'kueche' ? 'Küche' : 'Service';
      const results = [];

      for (const recipient of emailRecipients) {
        const shiftLines = recipient.shifts.map(s => {
          const dateStr = new Date(s.date).toLocaleDateString('de-DE', {
            weekday: 'short', day: '2-digit', month: '2-digit'
          });
          return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${dateStr}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.label || 'Schicht'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.start_time?.slice(0,5)} – ${s.end_time?.slice(0,5)}</td>
          </tr>`;
        }).join('');

        const html = `
          <div style="font-family:'Nunito',sans-serif;max-width:600px;margin:0 auto;background:#FAF8F4;padding:24px;border-radius:16px;">
            <div style="text-align:center;margin-bottom:20px;">
              <div style="display:inline-block;width:28px;height:28px;background:#8FB8A9;border-radius:50% 50% 50% 0;transform:rotate(-45deg);margin-right:8px;vertical-align:middle;"></div>
              <span style="font-size:22px;font-weight:800;vertical-align:middle;">Tushita</span>
            </div>
            <div style="background:white;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
              <h2 style="margin:0 0 8px;font-size:18px;color:#2E2E2E;">Neuer Dienstplan veröffentlicht</h2>
              <p style="color:#6B6B66;margin:0 0 16px;">Hallo ${recipient.name},</p>
              <p style="color:#6B6B66;margin:0 0 16px;">
                Der Dienstplan für <strong>${periodLabel}</strong> (Bereich ${areaLabel}) wurde soeben veröffentlicht.
                Hier sind deine Schichten:
              </p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <thead>
                  <tr style="background:#F5F2EC;">
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B6B66;text-transform:uppercase;">Datum</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B6B66;text-transform:uppercase;">Schicht</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B6B66;text-transform:uppercase;">Uhrzeit</th>
                  </tr>
                </thead>
                <tbody>${shiftLines}</tbody>
              </table>
              <p style="color:#6B6B66;margin:16px 0 0;">
                Bitte melde dich bei Fragen oder wenn du tauschen möchtest.
              </p>
            </div>
            <p style="text-align:center;color:#9A9690;font-size:12px;margin-top:16px;">
              Tushita Teahouse · Dienstplan
            </p>
          </div>
        `;

        try {
          const result = await resend.emails.send({
            from: 'Tushita Dienstplan <office@tushita.eu>',
            to: recipient.email,
            subject: `Neuer Dienstplan – ${periodLabel} (${areaLabel})`,
            html
          });
          results.push({ email: recipient.email, success: true });
        } catch (emailErr) {
          console.error(`Email to ${recipient.email} failed:`, emailErr);
          results.push({ email: recipient.email, success: false, error: emailErr.message });
        }
      }

      res.json({
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      });
    } else {
      // No Resend configured — return recipients list for manual notification
      res.json({
        sent: 0,
        message: 'Resend nicht konfiguriert. E-Mails wurden nicht gesendet.',
        recipients: emailRecipients.map(r => ({ email: r.email, name: r.name }))
      });
    }
  } catch (err) {
    console.error('Notification error:', err);
    res.status(500).json({ error: 'Fehler beim Senden der Benachrichtigungen' });
  }
});

module.exports = router;
