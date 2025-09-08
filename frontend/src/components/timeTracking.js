// Time Tracking Component
import { api, getWeekStart, getWeekDates, showLoading, hideLoading, showModal } from '../utils/api.js';

class TimeTrackingComponent {
    constructor() {
        this.currentUser = null;
        this.currentWeek = getWeekStart();
        this.weekData = null;
        this.projects = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUsers();
        this.setCurrentWeek();
    }

    setupEventListeners() {
        const userSelect = document.getElementById('user-select');
        const weekPicker = document.getElementById('week-picker');

        if (userSelect) {
            userSelect.addEventListener('change', (e) => {
                this.currentUser = e.target.value;
                if (this.currentUser) {
                    this.loadWeekView();
                } else {
                    this.clearWeekView();
                }
            });
        }

        if (weekPicker) {
            weekPicker.addEventListener('change', (e) => {
                if (e.target.value) {
                    // Convert week input (YYYY-Www) to date
                    const [year, week] = e.target.value.split('-W');
                    const date = this.getDateFromWeek(parseInt(year), parseInt(week));
                    this.currentWeek = getWeekStart(date);
                    if (this.currentUser) {
                        this.loadWeekView();
                    }
                }
            });
        }
    }

    async loadUsers() {
        try {
            const users = await api.getUsers();
            this.populateUserSelect(users);
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    }

    populateUserSelect(users) {
        const userSelect = document.getElementById('user-select');
        if (!userSelect) return;

        userSelect.innerHTML = '<option value="">Select Team Member</option>';
        
        users.forEach(user => {
            if (user.is_active) {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.first_name} ${user.last_name}`;
                userSelect.appendChild(option);
            }
        });
    }

    setCurrentWeek() {
        const weekPicker = document.getElementById('week-picker');
        if (!weekPicker) return;

        // Convert current week to week input format (YYYY-Www)
        const date = new Date(this.currentWeek);
        const year = date.getFullYear();
        const week = this.getWeekNumber(date);
        weekPicker.value = `${year}-W${week.toString().padStart(2, '0')}`;
    }

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    getDateFromWeek(year, week) {
        const date = new Date(year, 0, 1 + (week - 1) * 7);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff));
    }

    async loadWeekView() {
        if (!this.currentUser || !this.currentWeek) return;

        showLoading();
        try {
            this.weekData = await api.getWeekView(this.currentUser, this.currentWeek);
            this.renderWeekView();
        } catch (error) {
            console.error('Failed to load week view:', error);
            this.showError('Failed to load time tracking data');
        } finally {
            hideLoading();
        }
    }

    renderWeekView() {
        const container = document.getElementById('time-tracking-content');
        if (!container || !this.weekData) return;

        const weekDates = getWeekDates(this.currentWeek);
        const projects = this.weekData.available_projects || [];

        container.innerHTML = `
            <div class="week-view">
                <div class="week-header">
                    <h3>Week of ${new Date(this.currentWeek).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                    })}</h3>
                    <div class="week-actions">
                        <span class="week-total">Total: ${this.weekData.week_total || 0}h</span>
                        <button class="btn btn-primary" onclick="timeTracking.saveWeek()">
                            <i class="fas fa-save"></i> Save Week
                        </button>
                    </div>
                </div>
                
                <div class="week-grid">
                    <!-- Header row -->
                    <div class="week-cell header">Project</div>
                    ${weekDates.map(day => `
                        <div class="week-cell header">
                            <div>${day.dayName}</div>
                            <div>${day.dayNumber}</div>
                        </div>
                    `).join('')}
                    
                    <!-- Project rows -->
                    ${projects.map(project => this.renderProjectRow(project, weekDates)).join('')}
                    
                    <!-- Add project row -->
                    <div class="week-cell project-name">
                        <select class="form-select" onchange="timeTracking.addProjectRow(this.value)">
                            <option value="">+ Add Project</option>
                            ${projects.filter(p => !this.isProjectInWeek(p.id)).map(project => `
                                <option value="${project.id}">${project.project_name}</option>
                            `).join('')}
                        </select>
                    </div>
                    ${weekDates.map(() => '<div class="week-cell"></div>').join('')}
                    
                    <!-- Total row -->
                    <div class="week-cell project-name" style="font-weight: bold; background: #e2e8f0;">
                        Daily Totals
                    </div>
                    ${weekDates.map(day => `
                        <div class="week-cell" style="font-weight: bold; background: #e2e8f0; text-align: center;">
                            ${this.getDayTotal(day.date)}h
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderProjectRow(project, weekDates) {
        return `
            <div class="week-cell project-name">
                <div style="font-weight: 600;">${project.project_name}</div>
                <button class="btn btn-sm btn-danger" onclick="timeTracking.removeProjectRow(${project.id})" 
                        style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            ${weekDates.map(day => {
                const entry = this.getEntryForDay(project.id, day.date);
                return `
                    <div class="week-cell">
                        <input type="number" 
                               class="hours-input" 
                               value="${entry ? entry.hours : ''}" 
                               step="0.5" 
                               min="0" 
                               max="24"
                               data-project-id="${project.id}"
                               data-date="${day.date}"
                               onchange="timeTracking.updateHours(this)"
                               placeholder="0">
                        ${entry && entry.description ? `
                            <div class="entry-description" title="${entry.description}">
                                ${entry.description.substring(0, 20)}${entry.description.length > 20 ? '...' : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        `;
    }

    isProjectInWeek(projectId) {
        if (!this.weekData || !this.weekData.week_data) return false;
        
        return this.weekData.week_data.some(day => 
            day.entries.some(entry => entry.project_id === projectId)
        );
    }

    getEntryForDay(projectId, date) {
        if (!this.weekData || !this.weekData.week_data) return null;
        
        const day = this.weekData.week_data.find(d => d.date === date);
        if (!day) return null;
        
        return day.entries.find(entry => entry.project_id === projectId);
    }

    getDayTotal(date) {
        if (!this.weekData || !this.weekData.week_data) return 0;
        
        const day = this.weekData.week_data.find(d => d.date === date);
        return day ? day.total_hours : 0;
    }

    updateHours(input) {
        const projectId = parseInt(input.dataset.projectId);
        const date = input.dataset.date;
        const hours = parseFloat(input.value) || 0;

        // Update local data
        if (!this.weekData.week_data) this.weekData.week_data = [];
        
        let day = this.weekData.week_data.find(d => d.date === date);
        if (!day) {
            day = { date, entries: [], total_hours: 0 };
            this.weekData.week_data.push(day);
        }

        let entry = day.entries.find(e => e.project_id === projectId);
        if (!entry) {
            entry = { project_id: projectId, hours: 0, description: '' };
            day.entries.push(entry);
        }

        entry.hours = hours;

        // Recalculate day total
        day.total_hours = day.entries.reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);

        // Recalculate week total
        this.weekData.week_total = this.weekData.week_data.reduce((sum, d) => sum + d.total_hours, 0);

        // Update display
        this.updateTotalsDisplay();
    }

    updateTotalsDisplay() {
        // Update week total
        const weekTotalElement = document.querySelector('.week-total');
        if (weekTotalElement) {
            weekTotalElement.textContent = `Total: ${this.weekData.week_total || 0}h`;
        }

        // Update daily totals
        const weekDates = getWeekDates(this.currentWeek);
        weekDates.forEach((day, index) => {
            const totalCell = document.querySelectorAll('.week-grid .week-cell')[
                (this.weekData.available_projects.length + 2) * 8 + index + 1
            ];
            if (totalCell) {
                totalCell.textContent = `${this.getDayTotal(day.date)}h`;
            }
        });
    }

    async addProjectRow(projectId) {
        if (!projectId) return;

        // Add project to available projects if not already there
        const project = this.weekData.available_projects.find(p => p.id === parseInt(projectId));
        if (!project) {
            try {
                const projectData = await api.getProject(projectId);
                this.weekData.available_projects.push(projectData);
            } catch (error) {
                console.error('Failed to load project:', error);
                return;
            }
        }

        // Re-render the week view
        this.renderWeekView();
    }

    removeProjectRow(projectId) {
        // Remove all entries for this project from the week
        if (this.weekData && this.weekData.week_data) {
            this.weekData.week_data.forEach(day => {
                day.entries = day.entries.filter(entry => entry.project_id !== projectId);
                day.total_hours = day.entries.reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);
            });
            
            // Recalculate week total
            this.weekData.week_total = this.weekData.week_data.reduce((sum, d) => sum + d.total_hours, 0);
        }

        // Re-render the week view
        this.renderWeekView();
    }

    async saveWeek() {
        if (!this.currentUser || !this.weekData) return;

        showLoading();
        try {
            // Prepare entries for bulk update
            const entries = [];
            
            if (this.weekData.week_data) {
                this.weekData.week_data.forEach(day => {
                    day.entries.forEach(entry => {
                        if (entry.hours > 0) {
                            entries.push({
                                user_id: parseInt(this.currentUser),
                                project_id: entry.project_id,
                                entry_date: day.date,
                                hours: entry.hours,
                                description: entry.description || ''
                            });
                        }
                    });
                });
            }

            if (entries.length > 0) {
                await api.bulkUpdateTimeEntries(entries);
                this.showSuccess('Time entries saved successfully!');
            } else {
                this.showSuccess('No time entries to save.');
            }

            // Reload the week view to get fresh data
            await this.loadWeekView();

        } catch (error) {
            console.error('Failed to save time entries:', error);
            this.showError('Failed to save time entries. Please try again.');
        } finally {
            hideLoading();
        }
    }

    clearWeekView() {
        const container = document.getElementById('time-tracking-content');
        if (container) {
            container.innerHTML = `
                <div class="text-center" style="padding: 3rem; color: #64748b;">
                    <i class="fas fa-clock" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>Select a team member to view time tracking</h3>
                    <p>Choose a team member from the dropdown above to see their weekly time entries.</p>
                </div>
            `;
        }
    }

    showSuccess(message) {
        // Simple success notification - you could enhance this with a proper notification system
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            ${message}
        `;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showError(message) {
        // Simple error notification
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            ${message}
        `;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Create and export instance
export const timeTracking = new TimeTrackingComponent();

// Make it globally available
window.timeTracking = timeTracking;