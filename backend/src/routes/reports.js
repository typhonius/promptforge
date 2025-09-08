const express = require('express');
const router = express.Router();
const db = require('../database/connection');

// Get executive report data (similar to your current Python script)
router.get('/executive', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Default to last week if no dates provided
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 7);
    
    const reportStartDate = start_date || defaultStartDate.toISOString().split('T')[0];
    const reportEndDate = end_date || defaultEndDate.toISOString().split('T')[0];
    
    // Get project health summary (simplified - no project-specific hours)
    const projectsResult = await db.query(`
      SELECT
        p.*,
        u1.first_name || ' ' || u1.last_name as tier_1_name,
        u2.first_name || ' ' || u2.last_name as tier_2_name,
        COALESCE(
          (SELECT note_text FROM project_notes pn
           WHERE pn.project_id = p.id
           ORDER BY pn.created_at DESC LIMIT 1),
          ''
        ) as latest_note,
        0 as period_hours
      FROM projects p
      LEFT JOIN users u1 ON p.tier1_owner_id = u1.id
      LEFT JOIN users u2 ON p.tier2_owner_id = u2.id
      WHERE p.status IN ('in_progress', 'active', 'ongoing', 'delivering')
      ORDER BY
        CASE p.health
          WHEN 'red' THEN 1
          WHEN 'yellow' THEN 2
          WHEN 'green' THEN 3
          ELSE 4
        END,
        p.arr_value DESC NULLS LAST
    `);
    
    // Get capacity analysis
    const capacityResult = await db.query(`
      SELECT 
        u.id,
        u.first_name || ' ' || u.last_name as user_name,
        COALESCE(SUM(te.hours), 0) as total_hours
      FROM users u
      LEFT JOIN time_entries te ON u.id = te.user_id 
        AND te.entry_date >= $1 
        AND te.entry_date <= $2
      WHERE u.is_active = true
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY total_hours DESC
    `, [reportStartDate, reportEndDate]);
    
    // Calculate team metrics
    const totalHours = capacityResult.rows.reduce((sum, user) => sum + parseFloat(user.total_hours), 0);
    const activeUsers = capacityResult.rows.filter(user => parseFloat(user.total_hours) > 0).length;
    const avgHours = activeUsers > 0 ? totalHours / activeUsers : 0;
    const utilizationPct = avgHours > 0 ? (avgHours / 40) * 100 : 0; // Assuming 40h/week target
    
    // Group projects by health
    const healthGroups = {
      red: projectsResult.rows.filter(p => p.health === 'red'),
      yellow: projectsResult.rows.filter(p => p.health === 'yellow'),
      green: projectsResult.rows.filter(p => p.health === 'green')
    };
    
    // Calculate ARR at risk
    const arrAtRisk = healthGroups.red.reduce((sum, p) => sum + (parseFloat(p.arr_value) || 0), 0);
    const totalArr = projectsResult.rows.reduce((sum, p) => sum + (parseFloat(p.arr_value) || 0), 0);
    
    res.json({
      report_period: {
        start_date: reportStartDate,
        end_date: reportEndDate
      },
      project_health: {
        total_projects: projectsResult.rows.length,
        red_projects: healthGroups.red.length,
        yellow_projects: healthGroups.yellow.length,
        green_projects: healthGroups.green.length,
        projects_by_health: healthGroups,
        arr_at_risk: Math.round(arrAtRisk),
        total_arr: Math.round(totalArr)
      },
      capacity_analysis: {
        total_hours: Math.round(totalHours * 10) / 10,
        avg_hours_per_person: Math.round(avgHours * 10) / 10,
        utilization_percentage: Math.round(utilizationPct * 10) / 10,
        team_size: capacityResult.rows.length,
        active_team_size: activeUsers,
        per_person_hours: capacityResult.rows
      },
      generated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error generating executive report:', error);
    res.status(500).json({ error: 'Failed to generate executive report' });
  }
});

// Get project health trends
router.get('/project-health-trends', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await db.query(`
      SELECT 
        DATE(phh.created_at) as date,
        phh.health,
        COUNT(*) as count
      FROM project_health_history phh
      WHERE phh.created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(phh.created_at), phh.health
      ORDER BY date DESC, phh.health
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching health trends:', error);
    res.status(500).json({ error: 'Failed to fetch health trends' });
  }
});

// Get time tracking summary
router.get('/time-summary', async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'user' } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }
    
    let query;
    if (group_by === 'project') {
      // For simplified tracking, we can't break down hours by project
      query = `
        SELECT
          p.project_name as name,
          p.health,
          p.arr_value,
          0 as total_hours,
          0 as team_members,
          0 as days_worked
        FROM projects p
        WHERE p.status IN ('in_progress', 'active', 'ongoing')
        ORDER BY p.arr_value DESC NULLS LAST
      `;
      const result = await db.query(query);
      return res.json({
        period: { start_date, end_date },
        group_by,
        data: result.rows
      });
    } else {
      query = `
        SELECT
          u.first_name || ' ' || u.last_name as name,
          COALESCE(SUM(te.hours), 0) as total_hours,
          0 as projects_worked,
          COUNT(DISTINCT te.entry_date) as days_worked
        FROM users u
        LEFT JOIN time_entries te ON te.user_id = u.id
          AND te.entry_date >= $1 AND te.entry_date <= $2
        WHERE u.is_active = true
        GROUP BY u.id, u.first_name, u.last_name
        ORDER BY total_hours DESC
      `;
      const result = await db.query(query, [start_date, end_date]);
      return res.json({
        period: { start_date, end_date },
        group_by,
        data: result.rows
      });
    }
    
    res.json({
      period: { start_date, end_date },
      group_by,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching time summary:', error);
    res.status(500).json({ error: 'Failed to fetch time summary' });
  }
});

// Get project risk analysis
router.get('/project-risks', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        p.id,
        p.project_name,
        p.health,
        p.arr_value,
        p.close_date,
        u1.first_name || ' ' || u1.last_name as tier_1_name,
        u2.first_name || ' ' || u2.last_name as tier_2_name,
        COALESCE(
          (SELECT note_text FROM project_notes pn 
           WHERE pn.project_id = p.id 
           ORDER BY pn.created_at DESC LIMIT 1), 
          ''
        ) as latest_note,
        CASE 
          WHEN p.health = 'red' THEN 'High Risk'
          WHEN p.health = 'yellow' THEN 'Medium Risk'
          WHEN p.close_date < CURRENT_DATE AND NOT p.is_closed THEN 'Overdue'
          WHEN p.due_date < CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
          ELSE 'Low Risk'
        END as risk_category,
        CASE 
          WHEN p.health = 'red' THEN p.arr_value
          WHEN p.health = 'yellow' THEN p.arr_value * 0.5
          ELSE 0
        END as arr_at_risk
      FROM projects p
      LEFT JOIN users u1 ON p.tier1_owner_id = u1.id
      LEFT JOIN users u2 ON p.tier2_owner_id = u2.id
      WHERE p.status IN ('in_progress', 'active', 'ongoing', 'delivering')
      ORDER BY arr_at_risk DESC, p.health, p.close_date
    `);
    
    // Group by risk category
    const riskGroups = result.rows.reduce((groups, project) => {
      const category = project.risk_category;
      if (!groups[category]) groups[category] = [];
      groups[category].push(project);
      return groups;
    }, {});
    
    // Calculate total ARR at risk
    const totalArrAtRisk = result.rows.reduce((sum, p) => sum + (parseFloat(p.arr_at_risk) || 0), 0);
    
    res.json({
      total_arr_at_risk: Math.round(totalArrAtRisk),
      risk_groups: riskGroups,
      projects: result.rows
    });
  } catch (error) {
    console.error('Error fetching project risks:', error);
    res.status(500).json({ error: 'Failed to fetch project risks' });
  }
});

// Export data for external reporting tools
router.get('/export/projects', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        p.id,
        p.project_name,
        p.status,
        p.health,
        p.arr_value,
        p.close_date,
        p.start_date,
        
        p.is_closed,
        p.created_at,
        p.updated_at,
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
      ORDER BY p.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error exporting projects:', error);
    res.status(500).json({ error: 'Failed to export projects' });
  }
});

// Export time entries for external reporting
router.get('/export/time-entries', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        te.id,
        te.user_id,
        u.first_name || ' ' || u.last_name as user_name,
        te.project_id,
        p.project_name,
        te.entry_date,
        te.hours,
        te.description,
        te.created_at,
        te.updated_at
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      JOIN projects p ON te.project_id = p.id
    `;
    
    const params = [];
    
    if (start_date || end_date) {
      query += ' WHERE ';
      const conditions = [];
      
      if (start_date) {
        conditions.push(`te.entry_date >= $${params.length + 1}`);
        params.push(start_date);
      }
      
      if (end_date) {
        conditions.push(`te.entry_date <= $${params.length + 1}`);
        params.push(end_date);
      }
      
      query += conditions.join(' AND ');
    }
    
    query += ' ORDER BY te.entry_date DESC, u.first_name, p.project_name';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error exporting time entries:', error);
    res.status(500).json({ error: 'Failed to export time entries' });
  }
});

module.exports = router;