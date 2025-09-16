const express = require('express');
const router = express.Router();
const db = require('../database/connection');

// Get all users
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, first_name, last_name, email, tier, is_active, created_at, updated_at
      FROM users
      ORDER BY first_name, last_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT id, first_name, last_name, email, tier, is_active, created_at, updated_at
      FROM users
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user
router.post('/', async (req, res) => {
  try {
    const { first_name, last_name, email, tier } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'first_name and last_name are required' });
    }

    const result = await db.query(`
      INSERT INTO users (first_name, last_name, email, tier, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, first_name, last_name, email, tier, is_active, created_at, updated_at
    `, [first_name, last_name, email, tier || 2, true]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'User with this email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, is_active, tier } = req.body;

    const result = await db.query(`
      UPDATE users
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          email = COALESCE($3, email),
          is_active = COALESCE($4, is_active),
          tier = COALESCE($5, tier),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING id, first_name, last_name, email, tier, is_active, created_at, updated_at
    `, [first_name, last_name, email, is_active, tier, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (soft delete by setting is_active to false)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE users
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, first_name, last_name, email, is_active
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deactivated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// Get user's time summary
router.get('/:id/time-summary', async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    // For simplified tracking, we just return total hours per day
    let query = `
      SELECT
        te.entry_date,
        te.hours as total_hours,
        1 as days_worked
      FROM time_entries te
      WHERE te.user_id = $1
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
      ORDER BY te.entry_date DESC
    `;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user time summary:', error);
    res.status(500).json({ error: 'Failed to fetch time summary' });
  }
});

module.exports = router;