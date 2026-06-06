const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');
const { adminOnly } = require('../middleware/auth');

// POST /api/shifts/publish — Bulk publish shifts in a period
router.post('/publish', adminOnly, async (req, res) => {
  try {
    const { shiftIds } = req.body;

    if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length === 0) {
      return res.status(400).json({ error: 'Keine Schichten zum Veröffentlichen' });
    }

    const { data, error } = await supabaseAdmin
      .from('shifts')
      .update({
        status: 'published',
        published_at: new Date().toISOString()
      })
      .in('id', shiftIds)
      .select();

    if (error) throw error;

    res.json({
      count: data.length,
      message: `${data.length} Schichten veröffentlicht`
    });
  } catch (err) {
    console.error('Publish error:', err);
    res.status(500).json({ error: 'Fehler beim Veröffentlichen' });
  }
});

// POST /api/shifts/copy-period — Copy shifts from one period to another
router.post('/copy-period', adminOnly, async (req, res) => {
  try {
    const { sourceShiftIds, dateMapping, keepEmployees, area } = req.body;

    if (!sourceShiftIds || !dateMapping) {
      return res.status(400).json({ error: 'Fehlende Parameter' });
    }

    // Fetch source shifts
    const { data: sourceShifts, error: fetchError } = await supabaseAdmin
      .from('shifts')
      .select('*')
      .in('id', sourceShiftIds);

    if (fetchError) throw fetchError;

    // Create new shifts with mapped dates
    const newShifts = sourceShifts
      .map(s => {
        const newDate = dateMapping[s.date];
        if (!newDate) return null;
        return {
          area: s.area,
          date: newDate,
          start_time: s.start_time,
          end_time: s.end_time,
          employee_id: keepEmployees ? s.employee_id : null,
          template_id: s.template_id,
          label: s.label,
          custom_label: s.custom_label,
          note: s.note,
          status: 'draft',
          created_by: req.user.id
        };
      })
      .filter(Boolean);

    if (newShifts.length === 0) {
      return res.status(400).json({ error: 'Keine Schichten zum Kopieren' });
    }

    const { data, error } = await supabaseAdmin
      .from('shifts')
      .insert(newShifts)
      .select();

    if (error) throw error;

    res.json({
      count: data.length,
      message: `${data.length} Schichten kopiert`
    });
  } catch (err) {
    console.error('Copy period error:', err);
    res.status(500).json({ error: 'Fehler beim Kopieren' });
  }
});

// POST /api/shifts — Create a shift (admin)
router.post('/', adminOnly, async (req, res) => {
  try {
    const { area, date, start_time, end_time, employee_id, template_id, label, custom_label, note } = req.body;

    const { data, error } = await supabaseAdmin
      .from('shifts')
      .insert({
        area,
        date,
        start_time,
        end_time,
        employee_id: employee_id || null,
        template_id: template_id || null,
        label: label || '',
        custom_label: custom_label || '',
        note: note || '',
        status: 'draft',
        created_by: req.user.id
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Create shift error:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen der Schicht' });
  }
});

// PUT /api/shifts/:id — Update a shift (admin)
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // If shift was published and is being edited, mark as modified
    const { data: existing } = await supabaseAdmin
      .from('shifts')
      .select('status')
      .eq('id', id)
      .single();

    if (existing?.status === 'published') {
      updates.status = 'modified';
    }

    const { data, error } = await supabaseAdmin
      .from('shifts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Update shift error:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// DELETE /api/shifts/:id — Delete a shift (admin)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Also clean up swap requests
    await supabaseAdmin
      .from('swap_requests')
      .delete()
      .eq('shift_id', id);

    const { error } = await supabaseAdmin
      .from('shifts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Schicht gelöscht' });
  } catch (err) {
    console.error('Delete shift error:', err);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// POST /api/shifts/:id/take-swap — Regular employee takes an open swap
router.post('/:id/take-swap', async (req, res) => {
  try {
    const { id } = req.params;
    const { swapId } = req.body;
    const userId = req.user.id; // from authMiddleware

    if (!swapId) return res.status(400).json({ error: 'Missing swapId' });

    // Verify swap request exists and is open
    const { data: swap, error: swapFetchError } = await supabaseAdmin
      .from('swap_requests')
      .select('*')
      .eq('id', swapId)
      .single();

    if (swapFetchError || !swap) {
      return res.status(404).json({ error: 'Tauschanfrage nicht gefunden' });
    }
    if (swap.shift_id !== id) {
      return res.status(400).json({ error: 'Schicht stimmt nicht überein' });
    }
    if (swap.status !== 'open') {
      return res.status(400).json({ error: 'Schicht wurde bereits übernommen oder zurückgezogen' });
    }

    // 1. Update the shift employee to the new user
    const { error: shiftError } = await supabaseAdmin
      .from('shifts')
      .update({ employee_id: userId })
      .eq('id', id);

    if (shiftError) throw shiftError;

    // 2. Update the swap request status
    const { error: updateSwapError } = await supabaseAdmin
      .from('swap_requests')
      .update({
        status: 'taken',
        taken_by: userId,
        taken_at: new Date().toISOString()
      })
      .eq('id', swapId);

    if (updateSwapError) throw updateSwapError;

    res.json({ message: 'Schicht erfolgreich übernommen' });
  } catch (err) {
    console.error('Take swap error:', err);
    res.status(500).json({ error: 'Fehler bei der Übernahme' });
  }
});

module.exports = router;
