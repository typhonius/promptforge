const express = require('express');
const router = express.Router();
const db = require('../database/connection');

// Get all projects
router.get('/', async (req, res) => {
  try {
    const { status, health, owner_id } = req.query;

    let query = `
      SELECT
        p.*,
        u1.first_name || ' ' || u1.last_name as tier_1_name,
        u2.first_name || ' ' || u2.last_name as tier_2_name,
        COALESCE(
          (SELECT note_text FROM project_notes pn
           WHERE pn.project_id = p.id
           ORDER BY pn.created_at DESC LIMIT 1),
          ''
        ) as latest_note
      FROM projects p
      LEFT JOIN users u1 ON p.tier1_owner_id = u1.id
      LEFT JOIN users u2 ON p.tier2_owner_id = u2.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      query += ` AND p.status = $${params.length + 1}`;
      params.push(status);
    }

    if (health) {
      query += ` AND p.health = $${params.length + 1}`;
      params.push(health);
    }

    if (owner_id) {
      query += ` AND (p.tier1_owner_id = $${params.length + 1} OR p.tier2_owner_id = $${params.length + 1})`;
      params.push(owner_id);
      params.push(owner_id);
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get project by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT
        p.*,
        u1.first_name || ' ' || u1.last_name as tier_1_name,
        u2.first_name || ' ' || u2.last_name as tier_2_name
      FROM projects p
      LEFT JOIN users u1 ON p.tier1_owner_id = u1.id
      LEFT JOIN users u2 ON p.tier2_owner_id = u2.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get project notes
    const notesResult = await db.query(`
      SELECT
        pn.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM project_notes pn
      LEFT JOIN users u ON pn.created_by = u.id
      WHERE pn.project_id = $1
      ORDER BY pn.created_at DESC
    `, [id]);

    // Get custom fields
    const fieldsResult = await db.query(`
      SELECT field_name, field_value, field_type
      FROM project_custom_fields
      WHERE project_id = $1
    `, [id]);

    const project = result.rows[0];
    project.notes = notesResult.rows;
    project.custom_fields = fieldsResult.rows;

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create new project
router.post('/', async (req, res) => {
  try {
    const {
      project_name,
      tier1_owner_id,
      tier2_owner_id,
      tier3_owner_id,
      tier3_owner_ids,
      status = 'in_progress',
      health = 'green',
      arr_value,
      close_date,
      start_date,
      template_id
    } = req.body;

    // Handle both single tier3_owner_id (legacy) and tier3_owner_ids (new multiselect)
    let tier3_owners = null;
    if (tier3_owner_ids && Array.isArray(tier3_owner_ids)) {
      tier3_owners = JSON.stringify(tier3_owner_ids);
    } else if (tier3_owner_id) {
      tier3_owners = JSON.stringify([tier3_owner_id]);
    }

    if (!project_name) {
      return res.status(400).json({ error: 'project_name is required' });
    }

    const result = await db.query(`
      INSERT INTO projects (
        project_name, tier1_owner_id, tier2_owner_id, tier3_owners, status, health, arr_value,
        close_date, start_date, template_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [project_name, tier1_owner_id, tier2_owner_id, tier3_owners, status, health, arr_value, close_date, start_date, template_id]);

    // Add initial health history entry
    if (result.rows[0]) {
      await db.query(`
        INSERT INTO project_health_history (project_id, health, changed_by, change_reason)
        VALUES ($1, $2, $3, $4)
      `, [result.rows[0].id, health, tier2_owner_id || tier1_owner_id, 'Project created']);
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      project_name,
      tier1_owner_id,
      tier2_owner_id,
      tier3_owner_id,
      tier3_owner_ids,
      status,
      health,
      arr_value,
      close_date,
      start_date,
      risk_description,
      ask_description,
      impact_description,
      is_closed,
      changed_by,
      health_change_reason
    } = req.body;

    // Handle both single tier3_owner_id (legacy) and tier3_owner_ids (new multiselect)
    let tier3_owners = null;
    if (tier3_owner_ids && Array.isArray(tier3_owner_ids)) {
      tier3_owners = JSON.stringify(tier3_owner_ids);
    } else if (tier3_owner_id) {
      tier3_owners = JSON.stringify([tier3_owner_id]);
    }

    // Get current project to check for health changes
    const currentProject = await db.query('SELECT health FROM projects WHERE id = $1', [id]);
    if (currentProject.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await db.query(`
      UPDATE projects
      SET
        project_name = COALESCE($1, project_name),
        tier1_owner_id = COALESCE($2, tier1_owner_id),
        tier2_owner_id = COALESCE($3, tier2_owner_id),
        tier3_owners = COALESCE($4, tier3_owners),
        status = COALESCE($5, status),
        health = COALESCE($6, health),
        arr_value = COALESCE($7, arr_value),
        close_date = COALESCE($8, close_date),
        start_date = COALESCE($9, start_date),
        risk_description = COALESCE($10, risk_description),
        ask_description = COALESCE($11, ask_description),
        impact_description = COALESCE($12, impact_description),
        is_closed = COALESCE($13, is_closed),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
      RETURNING *
    `, [project_name, tier1_owner_id, tier2_owner_id, tier3_owners, status, health, arr_value, close_date, start_date, risk_description, ask_description, impact_description, is_closed, id]);

    // Add health history entry if health changed
    if (health && health !== currentProject.rows[0].health) {
      await db.query(`
        INSERT INTO project_health_history (project_id, health, changed_by, change_reason)
        VALUES ($1, $2, $3, $4)
      `, [id, health, changed_by, health_change_reason || 'Health status updated']);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ message: 'Project deleted successfully', project: result.rows[0] });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Add note to project
router.post('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { note_text, created_by } = req.body;

    if (!note_text) {
      return res.status(400).json({ error: 'note_text is required' });
    }

    const result = await db.query(`
      INSERT INTO project_notes (project_id, note_text, created_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [id, note_text, created_by]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding project note:', error);
    res.status(500).json({ error: 'Failed to add project note' });
  }
});

// Get project health history
router.get('/:id/health-history', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        phh.*,
        u.first_name || ' ' || u.last_name as changed_by_name
      FROM project_health_history phh
      LEFT JOIN users u ON phh.changed_by = u.id
      WHERE phh.project_id = $1
      ORDER BY phh.created_at DESC
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching project health history:', error);
    res.status(500).json({ error: 'Failed to fetch health history' });
  }
});

// Get project time summary
router.get('/:id/time-summary', async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    let query = `
      SELECT
        u.first_name || ' ' || u.last_name as user_name,
        0 as total_hours,
        0 as days_worked
      FROM users u
      WHERE u.is_active = true
      LIMIT 0
    `;

    const params = [id];

    if (start_date) {
      query += ` AND te.entry_date >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND te.entry_date <= $${params.length + 1}`;
      params.push(end_date);
    }

    query += `
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY total_hours DESC
    `;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching project time summary:', error);
    res.status(500).json({ error: 'Failed to fetch time summary' });
  }
});

module.exports = router;