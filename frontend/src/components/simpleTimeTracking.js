// Simple Time Tracking Component - Just daily hours per user
import { api, getWeekStart, getWeekDates, showLoading, hideLoading } from '../utils/api.js';

class SimpleTimeTrackingComponent {
    constructor() {
        this.currentUser = null;
        this.currentWeek = getWeekStart();
        this.weekData = {};
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
        const prevWeekBtn = document.getElementById('prev-week-btn');
        const nextWeekBtn = document.getElementById('next-week-btn');

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
                    const [year, week] = e.target.value.split('-W');
                    const date = this.getDateFromWeek(parseInt(year), parseInt(week));
                    this.currentWeek = getWeekStart(date);
                    if (this.currentUser) {
                        this.loadWeekView();
                    }
                }
            });
        }

        if (prevWeekBtn) {
            prevWeekBtn.addEventListener('click', () => this.navigateWeek(-1));
        }

        if (nextWeekBtn) {
            nextWeekBtn.addEventListener('click', () => this.navigateWeek(1));
        }
    }

    navigateWeek(direction) {
        const currentDate = new Date(this.currentWeek);
        currentDate.setDate(currentDate.getDate() + (direction * 7));
        this.currentWeek = getWeekStart(currentDate);
        this.setCurrentWeek();
        if (this.currentUser) {
            this.loadWeekView();
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
            const weekEnd = new Date(this.currentWeek);
            weekEnd.setDate(weekEnd.getDate() + 6);

            // Get time entries for the week
            const timeEntries = await api.getTimeEntries({
                user_id: this.currentUser,
                start_date: this.currentWeek,
                end_date: weekEnd.toISOString().split('T')[0]
            });

            // Convert to simple format
            this.weekData = {};
            timeEntries.forEach(entry => {
                this.weekData[entry.entry_date] = entry.hours;
            });

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
        if (!container) return;

        const weekDates = getWeekDates(this.currentWeek);
        const weekTotal = weekDates.reduce((sum, day) => sum + (parseFloat(this.weekData[day.date]) || 0), 0);

        container.innerHTML = `
            <div class="simple-week-view">
                <div class="week-header">
                    <div class="week-navigation">
                        <button id="prev-week-btn" class="btn btn-secondary">
                            <i class="fas fa-chevron-left"></i> Previous Week
                        </button>
                        <h3>Week of ${new Date(this.currentWeek).toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric' 
                        })}</h3>
                        <button id="next-week-btn" class="btn btn-secondary">
                            Next Week <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                    <div class="week-total">
                        <strong>Total: ${weekTotal.toFixed(1)} hours</strong>
                    </div>
                </div>
                
                <div class="daily-hours-grid">
                    ${weekDates.map(day => `
                        <div class="day-entry">
                            <label class="day-label">
                                ${day.dayName}
                                <span class="day-date">${day.dayNumber}</span>
                            </label>
                            <input 
                                type="number" 
                                class="hours-input" 
                                value="${this.weekData[day.date] || ''}" 
                                step="0.5" 
                                min="0" 
                                max="24"
                                data-date="${day.date}"
                                placeholder="0"
                                onchange="simpleTimeTracking.updateHours(this)"
                            >
                            <span class="hours-label">hours</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="week-actions">
                    <button class="btn btn-primary" onclick="simpleTimeTracking.saveWeek()">
                        <i class="fas fa-save"></i> Save Week
                    </button>
                    <button class="btn btn-secondary" onclick="simpleTimeTracking.clearWeek()">
                        <i class="fas fa-eraser"></i> Clear Week
                    </button>
                </div>
            </div>
        `;

        // Re-attach event listeners for navigation
        this.setupEventListeners();
    }

    updateHours(input) {
        const date = input.dataset.date;
        const hours = parseFloat(input.value) || 0;
        
        this.weekData[date] = hours;
        
        // Update total display
        const weekDates = getWeekDates(this.currentWeek);
        const weekTotal = weekDates.reduce((sum, day) => sum + (parseFloat(this.weekData[day.date]) || 0), 0);
        
        const totalElement = document.querySelector('.week-total strong');
        if (totalElement) {
            totalElement.textContent = `Total: ${weekTotal.toFixed(1)} hours`;
        }
    }

    async saveWeek() {
        if (!this.currentUser) return;

        showLoading();
        try {
            const entries = [];
            
            Object.entries(this.weekData).forEach(([date, hours]) => {
                if (hours > 0) {
                    entries.push({
                        user_id: parseInt(this.currentUser),
                        entry_date: date,
                        hours: hours
                    });
                }
            });

            if (entries.length > 0) {
                await api.bulkUpdateTimeEntries(entries);
                this.showSuccess('Time entries saved successfully!');
            } else {
                this.showSuccess('No hours to save.');
            }

        } catch (error) {
            console.error('Failed to save time entries:', error);
            this.showError('Failed to save time entries. Please try again.');
        } finally {
            hideLoading();
        }
    }

    clearWeek() {
        if (!confirm('Are you sure you want to clear all hours for this week?')) {
            return;
        }

        const weekDates = getWeekDates(this.currentWeek);
        weekDates.forEach(day => {
            this.weekData[day.date] = 0;
        });

        this.renderWeekView();
    }

    clearWeekView() {
        const container = document.getElementById('time-tracking-content');
        if (container) {
            container.innerHTML = `
                <div class="text-center" style="padding: 3rem; color: #64748b;">
                    <i class="fas fa-clock" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>Select a team member to track time</h3>
                    <p>Choose a team member from the dropdown above to see their weekly time entries.</p>
                </div>
            `;
        }
    }

    showSuccess(message) {
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #10b981; color: white;
            padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000; display: flex; align-items: center; gap: 0.5rem;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #ef4444; color: white;
            padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000; display: flex; align-items: center; gap: 0.5rem;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }
}

// Create and export instance
export const simpleTimeTracking = new SimpleTimeTrackingComponent();

// Make it globally available
window.simpleTimeTracking = simpleTimeTracking;