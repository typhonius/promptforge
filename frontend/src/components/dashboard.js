// Dashboard Component
import { api, formatCurrency, formatDate, getHealthColor, showLoading, hideLoading } from '../utils/api.js';

class DashboardComponent {
    constructor() {
        this.executiveData = null;
        this.init();
    }

    init() {
        // Don't automatically load dashboard data - let the app controller handle this
        // Refresh data every 5 minutes
        setInterval(() => {
            if (api.isAuthenticated()) {
                this.loadDashboardData();
            }
        }, 5 * 60 * 1000);
    }

    async loadDashboardData() {
        try {
            console.log('Loading dashboard data...');
            
            // Ensure we're authenticated before making the request
            if (!api.isAuthenticated()) {
                throw new Error('Authentication required');
            }
            
            // Get last week's data for the executive report
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);

            console.log('Fetching executive report from', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
            
            this.executiveData = await api.getExecutiveReport(
                startDate.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0]
            );

            console.log('Executive data received:', this.executiveData);

            this.renderMetrics();
            this.renderProjectHealth();
            this.renderRecentActivity();
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.renderError(error);
        }
    }

    renderMetrics() {
        console.log('Rendering metrics with data:', this.executiveData);
        
        if (!this.executiveData) {
            console.log('No executive data available for metrics');
            return;
        }

        const { project_health, capacity_analysis } = this.executiveData;
        console.log('Project health:', project_health);
        console.log('Capacity analysis:', capacity_analysis);

        // Update metric cards
        const totalProjectsEl = document.getElementById('total-projects');
        const teamUtilizationEl = document.getElementById('team-utilization');
        const totalArrEl = document.getElementById('total-arr');
        const arrAtRiskEl = document.getElementById('arr-at-risk');

        if (totalProjectsEl) totalProjectsEl.textContent = project_health?.total_projects || 0;
        if (teamUtilizationEl) teamUtilizationEl.textContent = `${capacity_analysis?.utilization_percentage || 0}%`;
        if (totalArrEl) totalArrEl.textContent = formatCurrency(project_health?.total_arr || 0);
        if (arrAtRiskEl) arrAtRiskEl.textContent = formatCurrency(project_health?.arr_at_risk || 0);
    }

    renderProjectHealth() {
        const container = document.getElementById('project-health-overview');
        if (!container || !this.executiveData) return;

        const { projects_by_health } = this.executiveData.project_health;
        const allProjects = [
            ...(projects_by_health.red || []),
            ...(projects_by_health.yellow || []),
            ...(projects_by_health.green || [])
        ];

        if (allProjects.length === 0) {
            container.innerHTML = `
                <div class="text-center" style="padding: 2rem; color: #64748b;">
                    <i class="fas fa-project-diagram" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No active projects found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = allProjects.map(project => {
            const healthColor = getHealthColor(project.health);
            const arrDisplay = project.arr_value ? formatCurrency(project.arr_value) : '';
            const closeDate = project.close_date ? formatDate(project.close_date) : '';
            
            return `
                <div class="project-health-item ${healthColor}" onclick="dashboard.viewProject(${project.id})">
                    <div class="project-info">
                        <h4>${project.project_name}</h4>
                        <p>${[project.tier_1_name, project.tier_2_name].filter(name => name).join(', ') || 'No tiers assigned'}</p>
                        ${project.latest_note ? `<p class="project-note">${project.latest_note.substring(0, 100)}${project.latest_note.length > 100 ? '...' : ''}</p>` : ''}
                    </div>
                    <div class="project-meta">
                        <div class="health-badge ${healthColor}">${project.health}</div>
                        ${arrDisplay ? `<div class="project-arr">${arrDisplay} ARR</div>` : ''}
                        ${closeDate ? `<div class="project-dates">Closes: ${closeDate}</div>` : ''}
                        ${project.period_hours ? `<div class="project-hours">${project.period_hours}h this week</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderRecentActivity() {
        const container = document.getElementById('recent-activity');
        if (!container) return;

        // For now, show some sample activity based on the data we have
        const activities = [];

        if (this.executiveData) {
            const { project_health, capacity_analysis } = this.executiveData;
            
            // Add capacity-related activity
            if (capacity_analysis.utilization_percentage < 70) {
                activities.push({
                    icon: 'fas fa-exclamation-triangle',
                    title: 'Low Team Utilization',
                    description: `Team utilization at ${capacity_analysis.utilization_percentage}% - consider adding more projects`,
                    time: 'Now',
                    type: 'warning'
                });
            }

            // Add project health activities
            if (project_health.red_projects > 0) {
                activities.push({
                    icon: 'fas fa-heartbeat',
                    title: 'Projects Need Attention',
                    description: `${project_health.red_projects} project(s) marked as red - immediate action required`,
                    time: 'Now',
                    type: 'danger'
                });
            }

            if (project_health.arr_at_risk > 0) {
                activities.push({
                    icon: 'fas fa-dollar-sign',
                    title: 'Revenue at Risk',
                    description: `${formatCurrency(project_health.arr_at_risk)} ARR at risk from troubled projects`,
                    time: 'Now',
                    type: 'warning'
                });
            }

            // Add positive activities
            if (project_health.green_projects > 0) {
                activities.push({
                    icon: 'fas fa-check-circle',
                    title: 'Healthy Projects',
                    description: `${project_health.green_projects} project(s) are performing well`,
                    time: 'Now',
                    type: 'success'
                });
            }
        }

        if (activities.length === 0) {
            container.innerHTML = `
                <div class="text-center" style="padding: 2rem; color: #64748b;">
                    <i class="fas fa-history" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        container.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-description">${activity.description}</div>
                </div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `).join('');
    }

    renderError(error) {
        const container = document.getElementById('project-health-overview');
        if (container) {
            const isAuthError = error && error.message === 'Authentication required';
            const errorMessage = isAuthError
                ? 'Please log in to view dashboard data.'
                : 'Failed to load dashboard data';
            
            container.innerHTML = `
                <div class="text-center" style="padding: 2rem; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>${errorMessage}</p>
                    ${!isAuthError ? `
                        <button class="btn btn-primary" onclick="dashboard.loadDashboardData()">
                            <i class="fas fa-refresh"></i> Retry
                        </button>
                    ` : ''}
                </div>
            `;
        }

        // Reset metrics to show error state
        const totalProjectsEl = document.getElementById('total-projects');
        const teamUtilizationEl = document.getElementById('team-utilization');
        const totalArrEl = document.getElementById('total-arr');
        const arrAtRiskEl = document.getElementById('arr-at-risk');
        
        if (totalProjectsEl) totalProjectsEl.textContent = '-';
        if (teamUtilizationEl) teamUtilizationEl.textContent = '-';
        if (totalArrEl) totalArrEl.textContent = '-';
        if (arrAtRiskEl) arrAtRiskEl.textContent = '-';
    }

    async viewProject(projectId) {
        try {
            showLoading();
            const project = await api.getProject(projectId);
            this.showProjectModal(project);
        } catch (error) {
            console.error('Failed to load project:', error);
        } finally {
            hideLoading();
        }
    }

    showProjectModal(project) {
        const healthColor = getHealthColor(project.health);
        const arrDisplay = project.arr_value ? formatCurrency(project.arr_value) : 'Not specified';
        const startDate = project.start_date ? formatDate(project.start_date) : 'Not set';
        const closeDate = project.close_date ? formatDate(project.close_date) : 'Not set';
        
        // Check if project is closed based on close date
        const isClosedByDate = project.close_date && new Date(project.close_date) < new Date();
        const displayStatus = isClosedByDate ? 'Closed' : project.status;

        const content = `
            <div class="project-details">
                <div class="project-header-modal">
                    <h3>${project.project_name}</h3>
                    <div class="health-badge ${healthColor}">${project.health}</div>
                </div>
                
                <div class="project-meta-grid">
                    <div class="meta-item">
                        <label>Tier 1:</label>
                        <span>${project.tier_1_name || 'Not assigned'}</span>
                    </div>
                    <div class="meta-item">
                        <label>Status:</label>
                        <span>${project.status}</span>
                    </div>
                    <div class="meta-item">
                        <label>ARR:</label>
                        <span>${arrDisplay}</span>
                    </div>
                    <div class="meta-item">
                        <label>Start Date:</label>
                        <span>${startDate}</span>
                    </div>
                    <div class="meta-item">
                        <label>Due Date:</label>
                        <span>${dueDate}</span>
                    </div>
                    <div class="meta-item">
                        <label>Close Date:</label>
                        <span>${closeDate}</span>
                    </div>
                </div>

                ${project.notes && project.notes.length > 0 ? `
                    <div class="project-notes-section">
                        <h4>Recent Notes</h4>
                        <div class="notes-list">
                            ${project.notes.slice(0, 3).map(note => `
                                <div class="note-item">
                                    <div class="note-header">
                                        <span class="note-author">${note.created_by_name || 'Unknown'}</span>
                                        <span class="note-date">${formatDate(note.created_at)}</span>
                                    </div>
                                    <div class="note-text">${note.note_text}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${project.custom_fields && project.custom_fields.length > 0 ? `
                    <div class="custom-fields-section">
                        <h4>Additional Information</h4>
                        <div class="custom-fields-grid">
                            ${project.custom_fields.map(field => `
                                <div class="meta-item">
                                    <label>${field.field_name}:</label>
                                    <span>${field.field_value}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>

            <style>
                .project-header-modal {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .project-meta-grid,
                .custom-fields-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                
                .meta-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }
                
                .meta-item label {
                    font-weight: 600;
                    color: #374151;
                    font-size: 0.875rem;
                }
                
                .meta-item span {
                    color: #6b7280;
                }
                
                .project-notes-section,
                .custom-fields-section {
                    margin-top: 1.5rem;
                }
                
                .project-notes-section h4,
                .custom-fields-section h4 {
                    margin-bottom: 1rem;
                    color: #374151;
                }
                
                .notes-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .note-item {
                    background: #f8fafc;
                    padding: 1rem;
                    border-radius: 8px;
                    border-left: 3px solid #3b82f6;
                }
                
                .note-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                    font-size: 0.875rem;
                }
                
                .note-author {
                    font-weight: 600;
                    color: #374151;
                }
                
                .note-date {
                    color: #6b7280;
                }
                
                .note-text {
                    color: #4b5563;
                    line-height: 1.5;
                }
            </style>
        `;

        const actions = [
            {
                text: 'View Full Project',
                class: 'btn-primary',
                onclick: `hideModal(); app.showPage('projects'); projects.viewProject(${project.id});`
            },
            {
                text: 'Close',
                class: 'btn-secondary',
                onclick: 'hideModal()'
            }
        ];

        showModal('Project Details', content, actions);
    }

    refresh() {
        this.loadDashboardData();
    }
}

// Create and export instance
export const dashboard = new DashboardComponent();

// Make it globally available
window.dashboard = dashboard;