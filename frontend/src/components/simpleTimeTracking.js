// Simple Time Tracking Component - Just daily hours per user
import { api, getWeekStart, getWeekDates, showLoading, hideLoading } from '../utils/api.js';

class SimpleTimeTrackingComponent {
    constructor() {
        this.currentUser = null;
        this.currentWeek = getWeekStart(new Date());
        this.weekData = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setCurrentWeek();
    }

    // Method called when the page is initialized (user is authenticated)
    async initializePage() {
        await this.loadUsers();
        if (this.currentUser) {
            this.loadWeekView();
        }
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

    setupNavigationListeners() {
        const prevWeekBtn = document.getElementById('prev-week-btn');
        const nextWeekBtn = document.getElementById('next-week-btn');

        if (prevWeekBtn) {
            prevWeekBtn.addEventListener('click', () => this.navigateWeek(-1));
        }

        if (nextWeekBtn) {
            nextWeekBtn.addEventListener('click', () => this.navigateWeek(1));
        }
    }

    navigateWeek(direction) {
        // Use timezone-safe date arithmetic
        const currentDate = new Date(this.currentWeek + 'T00:00:00');
        const newDate = new Date(currentDate.getTime() + (direction * 7 * 24 * 60 * 60 * 1000));
        this.currentWeek = getWeekStart(newDate);
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

        // Use the current date for week number calculation, not the week start date
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const week = this.getWeekNumber(currentDate);
        weekPicker.value = `${year}-W${week.toString().padStart(2, '0')}`;
    }

    getWeekNumber(date) {
        // ISO week numbering (Monday = start of week)
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7; // Sunday = 7, Monday = 1
        d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Move to Thursday of the same week
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    getDateFromWeek(year, week) {
        // Create a date for January 4th of the given year (always in week 1)
        const jan4 = new Date(year, 0, 4);
        // Find the Monday of week 1
        const jan4Day = jan4.getDay();
        const daysToMonday = jan4Day === 0 ? -6 : 1 - jan4Day;
        const firstMonday = new Date(jan4.getTime() + daysToMonday * 24 * 60 * 60 * 1000);

        // Calculate the Monday of the requested week
        const targetMonday = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
        return targetMonday;
    }

    async loadWeekView() {
        if (!this.currentUser || !this.currentWeek) return;

        console.log('loadWeekView - this.currentWeek:', this.currentWeek);
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

            console.log('API Request:', {
                user_id: this.currentUser,
                start_date: this.currentWeek,
                end_date: weekEnd.toISOString().split('T')[0]
            });
            console.log('API Response:', timeEntries);

            // Convert to simple format
            this.weekData = {};
            timeEntries.forEach(entry => {
                // Extract just the date part (YYYY-MM-DD) from the ISO timestamp
                const dateOnly = entry.entry_date.split('T')[0];
                const hours = parseFloat(entry.hours);
                // Convert negative hours (PTO) back to -1 for UI logic
                this.weekData[dateOnly] = hours < 0 ? -1 : hours;
            });

            console.log('Week Data:', this.weekData);

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
        console.log('Current week start:', this.currentWeek);
        console.log('Week dates:', weekDates);
        // Only count positive hours (exclude PTO days which are -1)
        const weekTotal = weekDates.reduce((sum, day) => {
            const hours = parseFloat(this.weekData[day.date]) || 0;
            return sum + (hours > 0 ? hours : 0);
        }, 0);

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
                    ${weekDates.map(day => {
                        const hours = this.weekData[day.date] || 0;
                        const isPTO = hours === -1; // Use -1 to indicate PTO/Sick
                        return `
                        <div class="day-entry ${isPTO ? 'pto-day' : ''}">
                            <label class="day-label">
                                ${day.dayName}
                                <span class="day-date">${day.dayNumber}</span>
                            </label>
                            <div class="day-inputs">
                                <input
                                    type="number"
                                    class="hours-input"
                                    value="${isPTO ? '' : (hours || '')}"
                                    step="0.5"
                                    min="0"
                                    max="24"
                                    data-date="${day.date}"
                                    placeholder="0"
                                    onchange="simpleTimeTracking.updateHours(this)"
                                    ${isPTO ? 'disabled' : ''}
                                >
                                <span class="hours-label">hours</span>
                                <label class="pto-checkbox">
                                    <input
                                        type="checkbox"
                                        data-date="${day.date}"
                                        ${isPTO ? 'checked' : ''}
                                        onchange="simpleTimeTracking.togglePTO(this)"
                                    >
                                    <span class="pto-label">PTO</span>
                                </label>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>

                <div class="week-actions">
                    <button class="btn btn-primary" onclick="simpleTimeTracking.saveWeek()">
                        <i class="fas fa-save"></i> Save Week
                    </button>
                    <button class="btn btn-secondary" onclick="simpleTimeTracking.clearWeek()">
                        <i class="fas fa-eraser"></i> Clear Week
                    </button>
                </div>
                
                <div class="pto-note">
                    <small>PTO includes paid time off, illness, public holidays, etc.</small>
                </div>
            </div>
        `;

        // Only re-attach navigation button listeners (not all listeners)
        this.setupNavigationListeners();
    }

    updateHours(input) {
        const date = input.dataset.date;
        const hours = parseFloat(input.value) || 0;

        this.weekData[date] = hours;
        this.updateWeekTotal();
    }

    togglePTO(checkbox) {
        const date = checkbox.dataset.date;
        const hoursInput = document.querySelector(`input.hours-input[data-date="${date}"]`);
        const dayEntry = checkbox.closest('.day-entry');

        if (checkbox.checked) {
            // Mark as PTO/Sick
            this.weekData[date] = -1; // Use -1 to indicate PTO
            hoursInput.value = '';
            hoursInput.disabled = true;
            dayEntry.classList.add('pto-day');
        } else {
            // Remove PTO/Sick
            this.weekData[date] = 0;
            hoursInput.disabled = false;
            dayEntry.classList.remove('pto-day');
        }

        this.updateWeekTotal();
    }

    updateWeekTotal() {
        const weekDates = getWeekDates(this.currentWeek);
        // Only count positive hours (exclude PTO days which are -1)
        const weekTotal = weekDates.reduce((sum, day) => {
            const hours = parseFloat(this.weekData[day.date]) || 0;
            return sum + (hours > 0 ? hours : 0);
        }, 0);

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
                // Save regular hours (> 0) and PTO days (-1)
                if (hours > 0) {
                    entries.push({
                        user_id: parseInt(this.currentUser),
                        entry_date: date,
                        hours: hours
                    });
                } else if (hours === -1) {
                    // Save PTO as -8 hours in the database (standard work day)
                    entries.push({
                        user_id: parseInt(this.currentUser),
                        entry_date: date,
                        hours: -8
                    });
                }
            });

            if (entries.length > 0) {
                await api.bulkUpdateTimeEntries(entries);
                this.showSuccess('Time entries saved successfully!');
            } else {
                this.showSuccess('No entries to save.');
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
            position: fixed; top: 20px; right: 20px; background: #c8ff00; color: #1a1a1a;
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
            position: fixed; top: 20px; right: 20px; background: #ff00c8; color: white;
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