// Reports Component
import { api, formatCurrency, formatDate, getHealthColor, showLoading, hideLoading } from '../utils/api.js';

class ReportsComponent {
    constructor() {
        this.reportData = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setDefaultDates();
    }

    setupEventListeners() {
        const generateReportBtn = document.getElementById('generate-report-btn');
        const startDateInput = document.getElementById('report-start-date');
        const endDateInput = document.getElementById('report-end-date');

        if (generateReportBtn) {
            generateReportBtn.addEventListener('click', () => this.generateReport());
        }

        // Auto-generate report when dates change
        if (startDateInput && endDateInput) {
            startDateInput.addEventListener('change', () => this.generateReport());
            endDateInput.addEventListener('change', () => this.generateReport());
        }
    }

    setDefaultDates() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7); // Last 7 days

        const startDateInput = document.getElementById('report-start-date');
        const endDateInput = document.getElementById('report-end-date');

        if (startDateInput) startDateInput.value = startDate.toISOString().split('T')[0];
        if (endDateInput) endDateInput.value = endDate.toISOString().split('T')[0];

        // Generate initial report
        this.generateReport();
    }

    async generateReport() {
        const startDateInput = document.getElementById('report-start-date');
        const endDateInput = document.getElementById('report-end-date');

        if (!startDateInput?.value || !endDateInput?.value) {
            return;
        }

        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        showLoading();
        try {
            // Get multiple report types
            const [executiveReport, projectRisks, timeSummary, healthTrends] = await Promise.all([
                api.getExecutiveReport(startDate, endDate),
                api.getProjectRisks(),
                api.getTimeSummary(startDate, endDate, 'user'),
                api.getProjectHealthTrends(30)
            ]);

            this.reportData = {
                executive: executiveReport,
                risks: projectRisks,
                timeSummary: timeSummary,
                healthTrends: healthTrends,
                period: { startDate, endDate }
            };

            this.renderReports();
        } catch (error) {
            console.error('Failed to generate reports:', error);
            this.renderError();
        } finally {
            hideLoading();
        }
    }

    renderReports() {
        const container = document.getElementById('reports-content');
        if (!container || !this.reportData) return;

        container.innerHTML = `
            <div class="reports-grid">
                ${this.renderExecutiveSummary()}
                ${this.renderProjectHealthReport()}
                ${this.renderCapacityReport()}
                ${this.renderRiskAnalysis()}
                ${this.renderTimeTrackingReport()}
                ${this.renderExportOptions()}
            </div>
        `;
    }

    renderExecutiveSummary() {
        const { executive } = this.reportData;
        if (!executive) return '';

        const { project_health, capacity_analysis } = executive;

        return `
            <div class="report-section">
                <div class="report-header">
                    <h3><i class="fas fa-chart-line"></i> Executive Summary</h3>
                    <span class="report-period">${formatDate(this.reportData.period.startDate)} - ${formatDate(this.reportData.period.endDate)}</span>
                </div>

                <div class="executive-metrics">
                    <div class="metric-row">
                        <div class="metric-item">
                            <div class="metric-label">Active Projects</div>
                            <div class="metric-value">${project_health.total_projects}</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">Team Utilization</div>
                            <div class="metric-value">${capacity_analysis.utilization_percentage}%</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">Total ARR</div>
                            <div class="metric-value">${formatCurrency(project_health.total_arr)}</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">ARR at Risk</div>
                            <div class="metric-value risk">${formatCurrency(project_health.arr_at_risk)}</div>
                        </div>
                    </div>
                </div>

                <div class="health-distribution">
                    <h4>Project Health Distribution</h4>
                    <div class="health-bars">
                        <div class="health-bar">
                            <div class="health-label">
                                <span class="health-dot green"></span>
                                Green (${project_health.green_projects})
                            </div>
                            <div class="health-progress">
                                <div class="health-fill green" style="width: ${(project_health.green_projects / project_health.total_projects) * 100}%"></div>
                            </div>
                        </div>
                        <div class="health-bar">
                            <div class="health-label">
                                <span class="health-dot yellow"></span>
                                Yellow (${project_health.yellow_projects})
                            </div>
                            <div class="health-progress">
                                <div class="health-fill yellow" style="width: ${(project_health.yellow_projects / project_health.total_projects) * 100}%"></div>
                            </div>
                        </div>
                        <div class="health-bar">
                            <div class="health-label">
                                <span class="health-dot red"></span>
                                Red (${project_health.red_projects})
                            </div>
                            <div class="health-progress">
                                <div class="health-fill red" style="width: ${(project_health.red_projects / project_health.total_projects) * 100}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderProjectHealthReport() {
        const { executive } = this.reportData;
        if (!executive?.project_health?.projects_by_health) return '';

        const allProjects = [
            ...(executive.project_health.projects_by_health.red || []),
            ...(executive.project_health.projects_by_health.yellow || []),
            ...(executive.project_health.projects_by_health.green || [])
        ];

        return `
            <div class="report-section">
                <div class="report-header">
                    <h3><i class="fas fa-heartbeat"></i> Project Health Details</h3>
                </div>

                <div class="projects-health-list">
                    ${allProjects.map(project => {
                        const healthColor = getHealthColor(project.health);
                        return `
                            <div class="project-health-row ${healthColor}">
                                <div class="project-info">
                                    <div class="project-name">${project.project_name}</div>
                                    <div class="project-owner">${[project.tier_1_name, project.tier_2_name].filter(name => name).join(', ') || 'No tiers assigned'}</div>
                                </div>
                                <div class="project-metrics">
                                    <div class="health-badge ${healthColor}">${project.health}</div>
                                    ${project.arr_value ? `<div class="arr-value">${formatCurrency(project.arr_value)}</div>` : ''}
                                    ${project.close_date ? `<div class="close-date">Closes: ${formatDate(project.close_date)}</div>` : ''}
                                </div>
                                ${project.latest_note ? `
                                    <div class="project-note">
                                        ${project.latest_note.length > 100 ?
                                            project.latest_note.substring(0, 100) + '...' :
                                            project.latest_note
                                        }
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    renderCapacityReport() {
        const { executive } = this.reportData;
        if (!executive?.capacity_analysis) return '';

        const { capacity_analysis } = executive;

        return `
            <div class="report-section">
                <div class="report-header">
                    <h3><i class="fas fa-users"></i> Team Capacity Analysis</h3>
                </div>

                <div class="capacity-overview">
                    <div class="capacity-metrics">
                        <div class="capacity-metric">
                            <div class="metric-label">Total Hours</div>
                            <div class="metric-value">${capacity_analysis.total_hours}h</div>
                        </div>
                        <div class="capacity-metric">
                            <div class="metric-label">Average per Person</div>
                            <div class="metric-value">${capacity_analysis.avg_hours_per_person}h</div>
                        </div>
                        <div class="capacity-metric">
                            <div class="metric-label">Team Size</div>
                            <div class="metric-value">${capacity_analysis.active_team_size}/${capacity_analysis.team_size}</div>
                        </div>
                        <div class="capacity-metric">
                            <div class="metric-label">Utilization</div>
                            <div class="metric-value ${capacity_analysis.utilization_percentage < 70 ? 'warning' : ''}">${capacity_analysis.utilization_percentage}%</div>
                        </div>
                    </div>

                    ${capacity_analysis.utilization_percentage < 70 ? `
                        <div class="capacity-alert">
                            <i class="fas fa-exclamation-triangle"></i>
                            <div>
                                <strong>Low Utilization Alert</strong>
                                <p>Team utilization is below 70%. Consider adding more projects or adjusting resource allocation.</p>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <div class="team-hours-breakdown">
                    <h4>Individual Hours Breakdown</h4>
                    <div class="hours-list">
                        ${capacity_analysis.per_person_hours.map(person => `
                            <div class="person-hours">
                                <div class="person-name">${person.user_name}</div>
                                <div class="person-stats">
                                    <span class="hours">${person.total_hours}h</span>
                                    <span class="projects">${person.projects_worked} projects</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderRiskAnalysis() {
        const { risks } = this.reportData;
        if (!risks) return '';

        return `
            <div class="report-section">
                <div class="report-header">
                    <h3><i class="fas fa-exclamation-triangle"></i> Risk Analysis</h3>
                </div>

                <div class="risk-summary">
                    <div class="risk-metric">
                        <div class="metric-label">Total ARR at Risk</div>
                        <div class="metric-value risk">${formatCurrency(risks.total_arr_at_risk)}</div>
                    </div>
                </div>

                <div class="risk-categories">
                    ${Object.entries(risks.risk_groups).map(([category, projects]) => `
                        <div class="risk-category">
                            <h4>${category} (${projects.length} projects)</h4>
                            <div class="risk-projects">
                                ${projects.map(project => `
                                    <div class="risk-project">
                                        <div class="project-info">
                                            <div class="project-name">${project.project_name}</div>
                                            <div class="project-owner">${[project.tier_1_name, project.tier_2_name].filter(name => name).join(', ') || 'No tiers assigned'}</div>
                                        </div>
                                        <div class="risk-metrics">
                                            <div class="health-badge ${getHealthColor(project.health)}">${project.health}</div>
                                            ${project.arr_at_risk > 0 ? `<div class="arr-risk">${formatCurrency(project.arr_at_risk)} at risk</div>` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderTimeTrackingReport() {
        const { timeSummary } = this.reportData;
        if (!timeSummary?.data) return '';

        return `
            <div class="report-section">
                <div class="report-header">
                    <h3><i class="fas fa-clock"></i> Time Tracking Summary</h3>
                </div>

                <div class="time-summary-list">
                    ${timeSummary.data.map(entry => `
                        <div class="time-entry-row">
                            <div class="entry-info">
                                <div class="entry-name">${entry.name}</div>
                                <div class="entry-details">
                                    ${entry.projects_worked ? `${entry.projects_worked} projects` : ''}
                                    ${entry.days_worked ? `• ${entry.days_worked} days` : ''}
                                </div>
                            </div>
                            <div class="entry-hours">${entry.total_hours}h</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderExportOptions() {
        return `
            <div class="report-section">
                <div class="report-header">
                    <h3><i class="fas fa-download"></i> Export Options</h3>
                </div>

                <div class="export-options">
                    <button class="btn btn-secondary" onclick="reports.exportProjects()">
                        <i class="fas fa-project-diagram"></i> Export Projects Data
                    </button>
                    <button class="btn btn-secondary" onclick="reports.exportTimeEntries()">
                        <i class="fas fa-clock"></i> Export Time Entries
                    </button>
                    <button class="btn btn-secondary" onclick="reports.exportExecutiveReport()">
                        <i class="fas fa-chart-bar"></i> Export Executive Report
                    </button>
                </div>

                <div class="export-info">
                    <p><i class="fas fa-info-circle"></i> Exported data can be used with external reporting tools like Tableau, Power BI, or Excel for advanced analysis.</p>
                </div>
            </div>
        `;
    }

    renderError() {
        const container = document.getElementById('reports-content');
        if (container) {
            container.innerHTML = `
                <div class="text-center" style="padding: 3rem; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3>Failed to generate reports</h3>
                    <p>There was an error generating the reports. Please try again.</p>
                    <button class="btn btn-primary" onclick="reports.generateReport()">
                        <i class="fas fa-refresh"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    async exportProjects() {
        try {
            showLoading();
            const data = await api.exportProjects();
            this.downloadJSON(data, 'projects-export.json');
            this.showSuccess('Projects data exported successfully!');
        } catch (error) {
            console.error('Failed to export projects:', error);
            this.showError('Failed to export projects data.');
        } finally {
            hideLoading();
        }
    }

    async exportTimeEntries() {
        try {
            showLoading();
            const { startDate, endDate } = this.reportData.period;
            const data = await api.exportTimeEntries(startDate, endDate);
            this.downloadJSON(data, `time-entries-${startDate}-to-${endDate}.json`);
            this.showSuccess('Time entries exported successfully!');
        } catch (error) {
            console.error('Failed to export time entries:', error);
            this.showError('Failed to export time entries.');
        } finally {
            hideLoading();
        }
    }

    exportExecutiveReport() {
        if (!this.reportData) {
            this.showError('No report data available to export.');
            return;
        }

        const { startDate, endDate } = this.reportData.period;
        this.downloadJSON(this.reportData, `executive-report-${startDate}-to-${endDate}.json`);
        this.showSuccess('Executive report exported successfully!');
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
export const reports = new ReportsComponent();

// Make it globally available
window.reports = reports;