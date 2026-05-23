const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');
const { adminOnly } = require('../middleware/auth');

// GET /api/templates — List all templates
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('shift_templates')
      .select('*')
      .order('area')
      .order('sort_order');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('List templates error:', err);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// POST /api/templates — Create template (admin)
router.post('/', adminOnly, async (req, res) => {
  try {
    const { area, label, start_time, end_time, color, sort_order } = req.body;

    const { data, error } = await supabaseAdmin
      .from('shift_templates')
      .insert({
        area,
        label,
        start_time,
        end_time,
        color: color || '#E0DDD2',
        sort_order: sort_order || 0
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen' });
  }
});

// PUT /api/templates/:id — Update template (admin)
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    const allowed = ['label', 'start_time', 'end_time', 'color', 'sort_order'];
    allowed.forEach(key => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    const { data, error } = await supabaseAdmin
      .from('shift_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Update template error:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// DELETE /api/templates/:id — Delete template (admin)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('shift_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Schicht-Typ gelöscht' });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

module.exports = router;
