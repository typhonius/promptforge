-- PromptForge Database Schema
-- PostgreSQL Database Schema

-- Users table (team members)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    tier INTEGER DEFAULT 2, -- 1=T1 (Adam), 2=T2 (most people), 3=T3 (junior/support)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    tier1_owner_id INTEGER REFERENCES users(id), -- Always Adam (T1)
    tier2_owner_id INTEGER REFERENCES users(id), -- Main project owner (T2)
    tier3_owners TEXT, -- JSON array of user_ids for T3 support
    status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, completed, on_hold, cancelled, delivering
    health VARCHAR(20) DEFAULT 'green', -- green, yellow, red
    arr_value DECIMAL(12,2), -- Annual Recurring Revenue in dollars
    close_date DATE,
    start_date DATE,
    due_date DATE,
    is_closed BOOLEAN DEFAULT false,
    template_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project notes table
CREATE TABLE project_notes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    note_text TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Time entries table (simple daily hours tracking)
CREATE TABLE time_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    entry_date DATE NOT NULL,
    hours DECIMAL(4,2) NOT NULL DEFAULT 0.00, -- Hours worked that day (e.g., 8.50 for 8.5 hours)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, entry_date) -- One entry per user per day
);

-- Project health history (track changes over time)
CREATE TABLE project_health_history (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    health VARCHAR(20) NOT NULL,
    changed_by INTEGER REFERENCES users(id),
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom fields table (for extensibility)
CREATE TABLE project_custom_fields (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_value TEXT,
    field_type VARCHAR(50) DEFAULT 'text', -- text, number, date, boolean
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_time_entries_user_date ON time_entries(user_id, entry_date);
CREATE INDEX idx_projects_tier1_owner ON projects(tier1_owner_id);
CREATE INDEX idx_projects_tier2_owner ON projects(tier2_owner_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_health ON projects(health);
CREATE INDEX idx_project_notes_project ON project_notes(project_id);

-- Triggers to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_notes_updated_at BEFORE UPDATE ON project_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_custom_fields_updated_at BEFORE UPDATE ON project_custom_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();