// Reports Component
import { api, formatCurrency, formatDate, getHealthColor, showLoading, hideLoading, getWeekStart, getWeekDates } from '../utils/api.js';

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
        const weekPicker = document.getElementById('report-week-picker');

        if (generateReportBtn) {
            generateReportBtn.addEventListener('click', () => this.generateReport());
        }

        // Auto-generate report when week changes
        if (weekPicker) {
            weekPicker.addEventListener('change', () => this.generateReport());
        }
    }

    setDefaultDates() {
        const currentWeek = getWeekStart(new Date());
        const weekPicker = document.getElementById('report-week-picker');

        if (weekPicker) {
            // Use the current date (not the week start date) for week number calculation
            const currentDate = new Date();
            const year = currentDate.getFullYear();
            const week = this.getWeekNumber(currentDate);
            weekPicker.value = `${year}-W${week.toString().padStart(2, '0')}`;
        }

        // Generate initial report
        this.generateReport();
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

    async generateReport() {
        const weekPicker = document.getElementById('report-week-picker');

        if (!weekPicker?.value) {
            return;
        }

        // Convert week picker value to start and end dates
        const [year, week] = weekPicker.value.split('-W');
        const weekStart = this.getDateFromWeek(parseInt(year), parseInt(week));
        const weekEnd = new Date(weekStart.getTime() + (6 * 24 * 60 * 60 * 1000));

        const startDate = weekStart.toISOString().split('T')[0];
        const endDate = weekEnd.toISOString().split('T')[0];

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
                ${this.renderAIReportSection()}
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
                                    <div class="project-owner">${[project.tier_1_name, project.tier_2_name, project.tier_3_names].filter(name => name && name.trim()).join(', ') || 'No tiers assigned'}</div>
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
                            <div class="metric-label">Overall Utilization</div>
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

                <div class="tier-breakdown">
                    <h4>Utilization by Tier</h4>
                    <div class="tier-metrics">
                        ${Object.entries(capacity_analysis.tier_breakdown || {}).map(([tierName, tierData]) => `
                            <div class="tier-section">
                                <div class="tier-header">
                                    <h5>Tier ${tierName.replace('tier', '')} (${tierData.active_users}/${tierData.total_users} active)</h5>
                                    <div class="tier-utilization ${tierData.utilization_percentage < 70 ? 'warning' : ''}">${tierData.utilization_percentage}%</div>
                                </div>
                                <div class="tier-stats">
                                    <span class="tier-hours">${tierData.total_hours}h total</span>
                                    <span class="tier-avg">${tierData.avg_hours_per_person}h avg</span>
                                    ${tierData.pto_hours > 0 ? `<span class="tier-pto">${tierData.pto_hours}h PTO</span>` : ''}
                                </div>
                                <div class="tier-users">
                                    ${tierData.users.map(user => `
                                        <div class="tier-user">
                                            <span class="user-name">${user.user_name}</span>
                                            <span class="user-hours">${user.total_hours}h</span>
                                            ${user.projects_worked > 0 ? `<span class="user-projects">${user.projects_worked} projects</span>` : ''}
                                        </div>
                                    `).join('')}
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
                                            <div class="project-owner">${[project.tier_1_name, project.tier_2_name, project.tier_3_names].filter(name => name && name.trim()).join(', ') || 'No tiers assigned'}</div>
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

    renderAIReportSection() {
        return `
            <div class="report-section">
                <div class="report-header">
                    <h3><i class="fas fa-robot"></i> AI Executive Report</h3>
                </div>

                <div class="ai-report-options">
                    <button class="btn btn-primary" onclick="reports.generateAIReport()" id="generate-ai-report-btn">
                        <i class="fas fa-magic"></i> Generate AI Report for Leadership
                    </button>
                    <div class="ai-report-info">
                        <p><i class="fas fa-info-circle"></i> Generate an AI-powered executive report formatted for Slack that includes risk assessments, actionable asks, and business impact analysis.</p>
                    </div>
                </div>

                <div id="ai-report-result" class="ai-report-result" style="display: none;">
                    <div class="report-header">
                        <h4><i class="fas fa-clipboard"></i> Generated Report</h4>
                        <button class="btn btn-secondary btn-sm" onclick="reports.copyAIReportToClipboard()" id="copy-ai-report-btn">
                            <i class="fas fa-copy"></i> Copy to Clipboard
                        </button>
                    </div>
                    <div class="ai-report-content">
                        <pre id="ai-report-text"></pre>
                    </div>
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
                <div class="text-center" style="padding: 3rem; color: #ff00c8;">
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

    async generateAIReport() {
        const generateBtn = document.getElementById('generate-ai-report-btn');
        const resultDiv = document.getElementById('ai-report-result');
        const reportText = document.getElementById('ai-report-text');

        if (!generateBtn || !resultDiv || !reportText) return;

        try {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating AI Report...';
            showLoading();

            // Get the selected week dates from the current report period
            const startDate = this.reportData?.period?.startDate;
            const endDate = this.reportData?.period?.endDate;

            const response = await api.generateAIReport(startDate, endDate);

            reportText.textContent = response.report;
            resultDiv.style.display = 'block';

            this.showSuccess('AI report generated successfully! Ready to copy to Slack.');

            // Scroll to the result
            resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (error) {
            console.error('Failed to generate AI report:', error);
            this.showError('Failed to generate AI report. Please try again.');
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate AI Report for Leadership';
            hideLoading();
        }
    }

    async copyAIReportToClipboard() {
        const reportText = document.getElementById('ai-report-text');
        const copyBtn = document.getElementById('copy-ai-report-btn');

        if (!reportText || !copyBtn) return;

        try {
            await navigator.clipboard.writeText(reportText.textContent);

            // Temporarily change button text to show success
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            copyBtn.classList.add('btn-success');
            copyBtn.classList.remove('btn-secondary');

            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.classList.remove('btn-success');
                copyBtn.classList.add('btn-secondary');
            }, 2000);

            this.showSuccess('Report copied to clipboard! Ready to paste into Slack.');
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.showError('Failed to copy to clipboard. Please select and copy manually.');
        }
    }
}

// Create and export instance
export const reports = new ReportsComponent();

// Make it globally available
window.reports = reports;