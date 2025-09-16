// Team Management Component
import { api, formatDate, showLoading, hideLoading, showModal } from '../utils/api.js';

class TeamComponent {
    constructor() {
        this.users = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showInitialMessage();
        // Don't automatically load team data - let the app controller handle this
    }

    setupEventListeners() {
        const addTeamMemberBtn = document.getElementById('add-team-member-btn');

        if (addTeamMemberBtn) {
            addTeamMemberBtn.addEventListener('click', () => this.showAddTeamMemberModal());
        }
    }

    async loadTeam() {
        showLoading();
        try {
            // Ensure we're authenticated before making the request
            if (!api.isAuthenticated()) {
                throw new Error('Authentication required');
            }

            this.users = await api.getUsers();
            this.renderTeam();
        } catch (error) {
            console.error('Failed to load team:', error);
            this.renderError(error);
        } finally {
            hideLoading();
        }
    }

    showInitialMessage() {
        const container = document.getElementById('team-list');
        if (container) {
            container.innerHTML = `
                <div class="text-center" style="grid-column: 1 / -1; padding: 3rem; color: #64748b;">
                    <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>Select a team member to track time</h3>
                    <p>Choose a team member from the dropdown above to see their weekly time entries.</p>
                </div>
            `;
        }
    }

    renderTeam() {
        const container = document.getElementById('team-list');
        if (!container) return;

        if (this.users.length === 0) {
            container.innerHTML = `
                <div class="text-center" style="grid-column: 1 / -1; padding: 3rem; color: #64748b;">
                    <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>No team members found</h3>
                    <p>Add your first team member to get started with project management and time tracking.</p>
                    <button class="btn btn-primary" onclick="team.showAddTeamMemberModal()">
                        <i class="fas fa-user-plus"></i> Add First Team Member
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.users.map(user => {
            const initials = `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
            const statusClass = user.is_active ? 'active' : 'inactive';
            const statusText = user.is_active ? 'Active' : 'Inactive';

            return `
                <div class="team-card ${statusClass}" onclick="team.viewTeamMember(${user.id})">
                    <div class="team-avatar">
                        ${initials}
                    </div>

                    <div class="team-name">${user.first_name} ${user.last_name}</div>
                    <div class="team-email">${user.email || 'No email provided'}</div>

                    <div class="team-status">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>

                    <div class="team-meta">
                        <div class="meta-item">
                            <span class="meta-label">User ID:</span>
                            <span class="meta-value">${user.id}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Joined:</span>
                            <span class="meta-value">${formatDate(user.created_at)}</span>
                        </div>
                    </div>

                    <div class="team-stats" id="team-stats-${user.id}">
                        <div class="team-stat">
                            <div class="team-stat-value">-</div>
                            <div class="team-stat-label">Projects</div>
                        </div>
                        <div class="team-stat">
                            <div class="team-stat-value">-</div>
                            <div class="team-stat-label">Hours (Week)</div>
                        </div>
                    </div>

                    <div class="team-actions" onclick="event.stopPropagation()">
                        <button class="btn btn-sm btn-secondary" onclick="team.editTeamMember(${user.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm ${user.is_active ? 'btn-warning' : 'btn-success'}"
                                onclick="team.toggleTeamMemberStatus(${user.id})">
                            <i class="fas ${user.is_active ? 'fa-pause' : 'fa-play'}"></i>
                            ${user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Load stats for each team member
        this.loadTeamStats();
    }

    async loadTeamStats() {
        // Get current week dates
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

        const startDate = startOfWeek.toISOString().split('T')[0];
        const endDate = endOfWeek.toISOString().split('T')[0];

        try {
            // Get all projects once
            const allProjects = await api.getProjects({});

            for (const user of this.users) {
                try {
                    // Get user's time summary for this week
                    const timeSummary = await api.getUserTimeSummary(user.id, startDate, endDate);

                    // Filter projects where this user is assigned (tier1, tier2, or tier3)
                    const userProjects = allProjects.filter(project => {
                        // Check if user is tier1 or tier2 owner
                        if (project.tier1_owner_id === user.id || project.tier2_owner_id === user.id) {
                            return true;
                        }

                        // Check if user is in tier3_owners array
                        if (project.tier3_owners) {
                            try {
                                const tier3Owners = JSON.parse(project.tier3_owners);
                                return Array.isArray(tier3Owners) && tier3Owners.includes(user.id);
                            } catch (e) {
                                // If JSON parsing fails, ignore tier3_owners
                                return false;
                            }
                        }

                        return false;
                    });

                    // Calculate total hours for the week (exclude PTO - negative hours)
                    const totalHours = timeSummary.reduce((sum, project) => {
                        const hours = parseFloat(project.total_hours || 0);
                        return sum + (hours > 0 ? hours : 0); // Only count positive hours, exclude PTO
                    }, 0);

                    // Update the stats display
                    const statsContainer = document.getElementById(`team-stats-${user.id}`);
                    if (statsContainer) {
                        statsContainer.innerHTML = `
                            <div class="team-stat">
                                <div class="team-stat-value">${userProjects.length}</div>
                                <div class="team-stat-label">Projects</div>
                            </div>
                            <div class="team-stat">
                                <div class="team-stat-value">${totalHours.toFixed(1)}</div>
                                <div class="team-stat-label">Hours (Week)</div>
                            </div>
                        `;
                    }
                } catch (error) {
                    console.error(`Failed to load stats for user ${user.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Failed to load projects:', error);
        }
    }

    renderError(error) {
        const container = document.getElementById('team-list');
        if (container) {
            const isAuthError = error && error.message === 'Authentication required';
            const errorMessage = isAuthError
                ? 'Please log in to view team members.'
                : 'There was an error loading the team members. Please try again.';

            container.innerHTML = `
                <div class="text-center" style="grid-column: 1 / -1; padding: 3rem; color: #ff00c8;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3>Failed to load team</h3>
                    <p>${errorMessage}</p>
                    ${!isAuthError ? `
                        <button class="btn btn-primary" onclick="team.loadTeam()">
                            <i class="fas fa-refresh"></i> Retry
                        </button>
                    ` : ''}
                </div>
            `;
        }
    }

    async viewTeamMember(userId) {
        try {
            showLoading();
            const user = await api.getUser(userId);

            // Get additional data
            const [timeSummary, projects] = await Promise.all([
                api.getUserTimeSummary(userId),
                api.getProjects({ owner_id: userId })
            ]);

            this.showTeamMemberDetailsModal(user, timeSummary, projects);
        } catch (error) {
            console.error('Failed to load team member details:', error);
        } finally {
            hideLoading();
        }
    }

    showTeamMemberDetailsModal(user, timeSummary, projects) {
        const initials = `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
        const statusClass = user.is_active ? 'active' : 'inactive';
        const statusText = user.is_active ? 'Active' : 'Inactive';

        // Calculate total hours (exclude PTO - negative hours)
        const totalHours = timeSummary.reduce((sum, project) => {
            const hours = parseFloat(project.total_hours || 0);
            return sum + (hours > 0 ? hours : 0); // Only count positive hours, exclude PTO
        }, 0);
        const activeProjects = projects.filter(p => p.status === 'in_progress').length;

        const content = `
            <div class="team-member-details">
                <div class="team-member-header">
                    <div class="team-avatar-large">
                        ${initials}
                    </div>
                    <div class="team-member-info">
                        <h3>${user.first_name} ${user.last_name}</h3>
                        <p class="team-member-email">${user.email || 'No email provided'}</p>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                </div>

                <div class="team-member-stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-project-diagram"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${projects.length}</div>
                            <div class="stat-label">Total Projects</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-tasks"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${activeProjects}</div>
                            <div class="stat-label">Active Projects</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${totalHours.toFixed(1)}</div>
                            <div class="stat-label">Total Hours</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-calendar"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${formatDate(user.created_at)}</div>
                            <div class="stat-label">Joined</div>
                        </div>
                    </div>
                </div>

                ${projects.length > 0 ? `
                    <div class="team-member-projects">
                        <h4>Owned Projects</h4>
                        <div class="projects-list">
                            ${projects.slice(0, 5).map(project => `
                                <div class="project-item">
                                    <div class="project-info">
                                        <span class="project-name">${project.project_name}</span>
                                        <span class="project-status">${project.status}</span>
                                    </div>
                                    <div class="health-badge ${project.health}">${project.health}</div>
                                </div>
                            `).join('')}
                            ${projects.length > 5 ? `<p class="text-center">... and ${projects.length - 5} more projects</p>` : ''}
                        </div>
                    </div>
                ` : ''}

                ${timeSummary.length > 0 ? `
                    <div class="team-member-time">
                        <h4>Recent Time Tracking</h4>
                        <div class="time-summary-list">
                            ${timeSummary.slice(0, 5).map(entry => `
                                <div class="time-entry">
                                    <span class="project-name">${entry.name}</span>
                                    <span class="time-hours">${entry.total_hours}h</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>

            <style>
                .team-member-details {
                    max-width: 600px;
                }

                .team-member-header {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid #e2e8f0;
                }

                .team-avatar-large {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    background: #c8ff00;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                    color: white;
                    font-weight: bold;
                }

                .team-member-info h3 {
                    margin: 0 0 0.5rem 0;
                    color: #1e293b;
                }

                .team-member-email {
                    color: #64748b;
                    margin: 0 0 0.5rem 0;
                }

                .status-badge {
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .status-badge.active {
                    background: #dcfce7;
                    color: #166534;
                }

                .status-badge.inactive {
                    background: #fee2e2;
                    color: #991b1b;
                }

                .team-member-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 1rem;
                    margin-bottom: 2rem;
                }

                .stat-card {
                    background: #f8fafc;
                    padding: 1rem;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .stat-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    background: #c8ff00;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }

                .stat-value {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #1e293b;
                }

                .stat-label {
                    font-size: 0.75rem;
                    color: #64748b;
                    text-transform: uppercase;
                }

                .team-member-projects,
                .team-member-time {
                    margin-top: 1.5rem;
                }

                .team-member-projects h4,
                .team-member-time h4 {
                    margin-bottom: 1rem;
                    color: #374151;
                }

                .projects-list,
                .time-summary-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .project-item,
                .time-entry {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem;
                    background: #f8fafc;
                    border-radius: 6px;
                }

                .project-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .project-name {
                    font-weight: 600;
                    color: #374151;
                }

                .project-status {
                    font-size: 0.75rem;
                    color: #6b7280;
                    text-transform: capitalize;
                }

                .time-hours {
                    font-weight: 600;
                    color: #00c8ff;
                }
            </style>
        `;

        const actions = [
            {
                text: 'Edit Member',
                class: 'btn-primary',
                onclick: `hideModal(); team.editTeamMember(${user.id});`
            },
            {
                text: 'View Time Tracking',
                class: 'btn-secondary',
                onclick: `hideModal(); app.showPage('time-tracking'); document.getElementById('user-select').value = '${user.id}'; timeTracking.currentUser = '${user.id}'; timeTracking.loadWeekView();`
            },
            {
                text: 'Close',
                class: 'btn-secondary',
                onclick: 'hideModal()'
            }
        ];

        showModal('Team Member Details', content, actions);
    }

    showAddTeamMemberModal() {
        const content = `
            <form id="add-team-member-form">
                <div class="form-group">
                    <label class="form-label">Tier</label>
                    <select class="form-select" name="tier">
                        <option value="2">T2</option>
                        <option value="1">T1</option>
                        <option value="3">T3</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">First Name *</label>
                    <input type="text" class="form-input" name="first_name" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Last Name *</label>
                    <input type="text" class="form-input" name="last_name" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-input" name="email" placeholder="user@company.com">
                </div>
            </form>

            <style>
                .form-help {
                    display: block;
                    margin-top: 0.25rem;
                    font-size: 0.75rem;
                    color: #6b7280;
                }
            </style>
        `;

        const actions = [
            {
                text: 'Add Team Member',
                class: 'btn-primary',
                onclick: 'team.createTeamMember()'
            },
            {
                text: 'Cancel',
                class: 'btn-secondary',
                onclick: 'hideModal()'
            }
        ];

        showModal('Add Team Member', content, actions);
    }

    async createTeamMember() {
        const form = document.getElementById('add-team-member-form');
        if (!form) return;

        const formData = new FormData(form);
        const userData = {};

        for (let [key, value] of formData.entries()) {
            if (value) {
                if (key === 'tier') {
                    userData[key] = parseInt(value);
                } else {
                    userData[key] = value;
                }
            }
        }

        if (!userData.first_name || !userData.last_name) {
            alert('First name and last name are required');
            return;
        }

        try {
            showLoading();
            await api.createUser(userData);
            hideModal();
            this.loadTeam();
            this.showSuccess('Team member added successfully!');
        } catch (error) {
            console.error('Failed to create team member:', error);
            if (error.message.includes('already exists')) {
                this.showError('A user with this User ID or email already exists.');
            } else {
                this.showError('Failed to add team member. Please try again.');
            }
        } finally {
            hideLoading();
        }
    }

    async editTeamMember(userId) {
        try {
            showLoading();
            const user = await api.getUser(userId);
            this.showEditTeamMemberModal(user);
        } catch (error) {
            console.error('Failed to load team member for editing:', error);
        } finally {
            hideLoading();
        }
    }

    showEditTeamMemberModal(user) {
        const content = `
            <form id="edit-team-member-form">
                <div class="form-group">
                    <label class="form-label">User ID</label>
                    <input type="number" class="form-input" value="${user.id}" disabled>
                    <small class="form-help">User ID cannot be changed</small>
                </div>

                <div class="form-group">
                    <label class="form-label">First Name *</label>
                    <input type="text" class="form-input" name="first_name" value="${user.first_name}" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Last Name *</label>
                    <input type="text" class="form-input" name="last_name" value="${user.last_name}" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-input" name="email" value="${user.email || ''}">
                </div>

                <div class="form-group">
                    <label class="form-label">
                        <input type="checkbox" name="is_active" ${user.is_active ? 'checked' : ''}>
                        Active team member
                    </label>
                </div>
            </form>

            <style>
                .form-help {
                    display: block;
                    margin-top: 0.25rem;
                    font-size: 0.75rem;
                    color: #6b7280;
                }
            </style>
        `;

        const actions = [
            {
                text: 'Update Team Member',
                class: 'btn-primary',
                onclick: `team.updateTeamMember(${user.id})`
            },
            {
                text: 'Cancel',
                class: 'btn-secondary',
                onclick: 'hideModal()'
            }
        ];

        showModal('Edit Team Member', content, actions);
    }

    async updateTeamMember(userId) {
        const form = document.getElementById('edit-team-member-form');
        if (!form) return;

        const formData = new FormData(form);
        const userData = {};

        for (let [key, value] of formData.entries()) {
            if (key === 'is_active') {
                userData[key] = true;
            } else if (value) {
                userData[key] = value;
            }
        }

        if (!userData.first_name || !userData.last_name) {
            alert('First name and last name are required');
            return;
        }

        try {
            showLoading();
            await api.updateUser(userId, userData);
            hideModal();
            this.loadTeam();
            this.showSuccess('Team member updated successfully!');
        } catch (error) {
            console.error('Failed to update team member:', error);
            this.showError('Failed to update team member. Please try again.');
        } finally {
            hideLoading();
        }
    }

    async toggleTeamMemberStatus(userId) {
        const user = this.users.find(u => u.user_id === userId);
        if (!user) return;

        const action = user.is_active ? 'deactivate' : 'activate';
        if (!confirm(`Are you sure you want to ${action} this team member?`)) {
            return;
        }

        try {
            showLoading();
            await api.updateUser(userId, { is_active: !user.is_active });
            this.loadTeam();
            this.showSuccess(`Team member ${action}d successfully!`);
        } catch (error) {
            console.error(`Failed to ${action} team member:`, error);
            this.showError(`Failed to ${action} team member. Please try again.`);
        } finally {
            hideLoading();
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
export const team = new TeamComponent();

// Make it globally available
window.team = team;