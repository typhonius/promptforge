const express = require('express');
const router = express.Router();
const db = require('../database/connection');

// Get time entries with filtering (simplified - no project references)
router.get('/', async (req, res) => {
  try {
    const { user_id, start_date, end_date, week_start } = req.query;

    let query = `
      SELECT
        te.*,
        u.first_name || ' ' || u.last_name as user_name
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (user_id) {
      query += ` AND te.user_id = $${params.length + 1}`;
      params.push(user_id);
    }

    if (start_date) {
      query += ` AND te.entry_date >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND te.entry_date <= $${params.length + 1}`;
      params.push(end_date);
    }

    // Week view: get entries for a specific week
    if (week_start) {
      const weekEnd = new Date(week_start);
      weekEnd.setDate(weekEnd.getDate() + 6);
      query += ` AND te.entry_date >= $${params.length + 1} AND te.entry_date <= $${params.length + 2}`;
      params.push(week_start);
      params.push(weekEnd.toISOString().split('T')[0]);
    }

    query += ` ORDER BY te.entry_date DESC, u.first_name, u.last_name`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching time entries:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

// Get simple week view for a specific user (just daily hours)
router.get('/week-view/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const { week_start } = req.query;

    if (!week_start) {
      return res.status(400).json({ error: 'week_start parameter is required (YYYY-MM-DD format)' });
    }

    const weekEnd = new Date(week_start);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Get all time entries for the week
    const result = await db.query(`
      SELECT
        te.entry_date,
        te.hours
      FROM time_entries te
      WHERE te.user_id = $1
        AND te.entry_date >= $2
        AND te.entry_date <= $3
      ORDER BY te.entry_date
    `, [user_id, week_start, weekEnd.toISOString().split('T')[0]]);

    // Create simple week structure
    const weekData = {};
    result.rows.forEach(entry => {
      weekData[entry.entry_date] = entry.hours;
    });

    const weekTotal = result.rows.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);

    res.json({
      user_id: parseInt(user_id),
      week_start,
      week_end: weekEnd.toISOString().split('T')[0],
      week_data: weekData,
      week_total: weekTotal
    });
  } catch (error) {
    console.error('Error fetching week view:', error);
    res.status(500).json({ error: 'Failed to fetch week view' });
  }
});

// Create or update time entry (simplified - no project)
router.post('/', async (req, res) => {
  try {
    const { user_id, entry_date, hours } = req.body;

    if (!user_id || !entry_date || hours === undefined) {
      return res.status(400).json({
        error: 'user_id, entry_date, and hours are required'
      });
    }

    // Use UPSERT (INSERT ... ON CONFLICT) to handle duplicate entries
    const result = await db.query(`
      INSERT INTO time_entries (user_id, entry_date, hours)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, entry_date)
      DO UPDATE SET
        hours = EXCLUDED.hours,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [user_id, entry_date, hours]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating/updating time entry:', error);
    res.status(500).json({ error: 'Failed to create/update time entry' });
  }
});

// Bulk update time entries for a week (simplified)
router.post('/bulk-update', async (req, res) => {
  try {
    const { entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries array is required' });
    }

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const results = [];

      for (const entry of entries) {
        const { user_id, entry_date, hours } = entry;

        if (!user_id || !entry_date || hours === undefined) {
          throw new Error('Each entry must have user_id, entry_date, and hours');
        }

        const result = await client.query(`
          INSERT INTO time_entries (user_id, entry_date, hours)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, entry_date)
          DO UPDATE SET
            hours = EXCLUDED.hours,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `, [user_id, entry_date, hours]);

        results.push(result.rows[0]);
      }

      await client.query('COMMIT');
      res.json({ message: 'Time entries updated successfully', entries: results });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error bulk updating time entries:', error);
    res.status(500).json({ error: 'Failed to bulk update time entries' });
  }
});

// Get time entry by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT
        te.*,
        u.first_name || ' ' || u.last_name as user_name
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE te.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching time entry:', error);
    res.status(500).json({ error: 'Failed to fetch time entry' });
  }
});

// Update time entry
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { hours, description } = req.body;

    const result = await db.query(`
      UPDATE time_entries
      SET
        hours = COALESCE($1, hours),
        description = COALESCE($2, description),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [hours, description, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating time entry:', error);
    res.status(500).json({ error: 'Failed to update time entry' });
  }
});

// Delete time entry
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM time_entries WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    res.json({ message: 'Time entry deleted successfully', entry: result.rows[0] });
  } catch (error) {
    console.error('Error deleting time entry:', error);
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
});

// Get team capacity summary
router.get('/reports/capacity', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    const result = await db.query(`
      SELECT
        u.id,
        u.first_name || ' ' || u.last_name as user_name,
        COALESCE(SUM(CASE WHEN te.hours > 0 THEN te.hours ELSE 0 END), 0) as total_hours,
        COALESCE(SUM(CASE WHEN te.hours < 0 THEN ABS(te.hours) ELSE 0 END), 0) as pto_hours,
        COUNT(DISTINCT CASE WHEN te.hours > 0 THEN te.entry_date END) as days_worked,
        0 as projects_worked
      FROM users u
      LEFT JOIN time_entries te ON u.id = te.user_id
        AND te.entry_date >= $1
        AND te.entry_date <= $2
      WHERE u.is_active = true
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY total_hours DESC NULLS LAST, u.first_name
    `, [start_date, end_date]);

    // Calculate team totals with PTO-adjusted utilization
    const totalWorkHours = result.rows.reduce((sum, user) => sum + (parseFloat(user.total_hours) || 0), 0);
    const totalPtoHours = result.rows.reduce((sum, user) => sum + (parseFloat(user.pto_hours) || 0), 0);
    const activeUsers = result.rows.filter(user => parseFloat(user.total_hours) > 0 || parseFloat(user.pto_hours) > 0).length;

    // Calculate utilization: work_hours / (expected_hours - pto_hours)
    const expectedHours = activeUsers * 40; // 40h/week per user
    const availableHours = expectedHours - totalPtoHours;
    const utilizationPercentage = availableHours > 0 ? (totalWorkHours / availableHours) * 100 : 0;
    const avgHours = activeUsers > 0 ? totalWorkHours / activeUsers : 0;

    res.json({
      period: { start_date, end_date },
      team_summary: {
        total_hours: Math.round(totalWorkHours * 10) / 10,
        pto_hours: Math.round(totalPtoHours * 10) / 10,
        active_users: activeUsers,
        avg_hours_per_user: Math.round(avgHours * 10) / 10,
        utilization_percentage: Math.round(utilizationPercentage * 10) / 10
      },
      user_details: result.rows
    });
  } catch (error) {
    console.error('Error fetching capacity report:', error);
    res.status(500).json({ error: 'Failed to fetch capacity report' });
  }
});

module.exports = router;