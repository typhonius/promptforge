// Main App Controller
import { api } from './api.js';

class App {
    constructor() {
        this.currentPage = 'dashboard';
        this.init();
    }

    init() {
        this.setupAuthentication();
        this.setupNavigation();
        this.setupErrorHandling();
        this.setupKeyboardShortcuts();
        this.setupRouting();

        // Check if user is already authenticated
        if (api.isAuthenticated()) {
            this.hideLoginOverlay();
            this.checkApiConnection();
            this.handleRoute();
        } else {
            this.showLoginOverlay();
        }
    }

    setupAuthentication() {
        const loginForm = document.getElementById('login-form');
        const loginError = document.getElementById('login-error');
        const logoutBtn = document.getElementById('logout-btn');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const password = document.getElementById('password').value;

            try {
                loginError.style.display = 'none';
                await api.login(password);

                this.hideLoginOverlay();
                this.showNotification('Login successful!', 'success');

                // Now safely load the dashboard and check API connection
                await this.checkApiConnection();
                this.showPage('dashboard');
            } catch (error) {
                loginError.textContent = error.message;
                loginError.style.display = 'block';
            }
        });

        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
    }

    showLoginOverlay() {
        const overlay = document.getElementById('login-overlay');
        overlay.classList.remove('hidden');

        // Focus on password field
        setTimeout(() => {
            document.getElementById('password').focus();
        }, 100);
    }

    hideLoginOverlay() {
        const overlay = document.getElementById('login-overlay');
        overlay.classList.add('hidden');
    }

    logout() {
        api.logout();
        this.showLoginOverlay();
        this.showNotification('Logged out successfully', 'info');
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                if (page) {
                    this.showPage(page);
                }
            });
        });
    }

    showPage(pageId, updateUrl = true) {
        // Hide all pages
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => page.classList.remove('active'));

        // Show selected page
        const targetPage = document.getElementById(`${pageId}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
        }

        // Update navigation
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === pageId) {
                link.classList.add('active');
            }
        });

        // Update page title
        this.updatePageTitle(pageId);

        // Update URL if requested
        if (updateUrl) {
            this.updateUrl(pageId);
        }

        // Initialize/refresh the page component after showing it
        this.initializePageComponent(pageId);
    }

    initializePageComponent(pageId) {
        // Only initialize components if we're authenticated
        if (!api.isAuthenticated()) {
            return;
        }

        // Initialize the specific page component
        switch (pageId) {
            case 'dashboard':
                if (window.dashboard) {
                    window.dashboard.loadDashboardData();
                }
                break;
            case 'projects':
                if (window.projects) {
                    window.projects.loadUsers();
                    window.projects.loadProjects();
                }
                break;
            case 'team':
                if (window.team) {
                    window.team.loadTeam();
                }
                break;
            case 'time-tracking':
                if (window.simpleTimeTracking) {
                    window.simpleTimeTracking.initializePage();
                }
                break;
            case 'reports':
                if (window.reports) {
                    window.reports.generateReport();
                }
                break;
        }
    }

    updatePageTitle(pageId) {
        const titles = {
            dashboard: 'Dashboard - PromptForge',
            'time-tracking': 'Time Tracking - PromptForge',
            projects: 'Projects - PromptForge',
            team: 'Team Management - PromptForge',
            reports: 'Reports - PromptForge'
        };

        document.title = titles[pageId] || 'PromptForge';
    }

    async checkApiConnection() {
        try {
            await api.healthCheck();
            this.showConnectionStatus('connected');
        } catch (error) {
            console.error('API connection failed:', error);
            this.showConnectionStatus('disconnected');
        }
    }

    showConnectionStatus(status) {
        // Remove any existing status indicators
        const existingStatus = document.querySelector('.connection-status');
        if (existingStatus) {
            existingStatus.remove();
        }

        if (status === 'disconnected') {
            const statusIndicator = document.createElement('div');
            statusIndicator.className = 'connection-status disconnected';
            statusIndicator.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <span>API Connection Failed</span>
                <button onclick="app.checkApiConnection()" class="retry-btn">
                    <i class="fas fa-refresh"></i>
                </button>
            `;
            statusIndicator.style.cssText = `
                position: fixed;
                top: 70px;
                right: 20px;
                background: #ff00c8;
                color: white;
                padding: 0.75rem 1rem;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1000;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.875rem;
            `;

            const retryBtn = statusIndicator.querySelector('.retry-btn');
            retryBtn.style.cssText = `
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.75rem;
            `;

            document.body.appendChild(statusIndicator);
        }
    }

    // Utility method to refresh current page data
    refreshCurrentPage() {
        switch (this.currentPage) {
            case 'dashboard':
                if (window.dashboard) {
                    window.dashboard.refresh();
                }
                break;
            case 'projects':
                if (window.projects) {
                    window.projects.loadProjects();
                }
                break;
            case 'team':
                if (window.team) {
                    window.team.loadTeam();
                }
                break;
            case 'time-tracking':
                if (window.timeTracking && window.timeTracking.currentUser) {
                    window.timeTracking.loadWeekView();
                }
                break;
            case 'reports':
                if (window.reports) {
                    window.reports.generateReport();
                }
                break;
        }
    }

    // Handle keyboard shortcuts
    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + R to refresh current page
        if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            this.refreshCurrentPage();
        }

        // Number keys to switch pages (1-5)
        if (event.altKey && event.key >= '1' && event.key <= '5') {
            event.preventDefault();
            const pages = ['dashboard', 'time-tracking', 'projects', 'team', 'reports'];
            const pageIndex = parseInt(event.key) - 1;
            if (pages[pageIndex]) {
                this.showPage(pages[pageIndex]);
            }
        }
    }

    // Show global notifications
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        const colors = {
            success: '#00c8ff',  // Changed to match info color (cyan blue)
            error: '#ff00c8',
            warning: '#ffcc00',
            info: '#00c8ff'
        };

        notification.innerHTML = `
            <i class="${icons[type] || icons.info}"></i>
            ${message}
        `;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;

        // Add animation styles
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }

                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notification);

        // Auto-remove notification
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, duration);

        return notification;
    }

    // Handle errors globally
    handleError(error, context = '') {
        console.error(`Error in ${context}:`, error);

        let message = 'An unexpected error occurred';
        if (error.message) {
            message = error.message;
        }

        // If authentication error, show login overlay
        if (error.message === 'Authentication required') {
            this.showLoginOverlay();
            this.showNotification('Please log in to continue', 'warning');
            return;
        }

        this.showNotification(`${context ? context + ': ' : ''}${message}`, 'error', 5000);
    }

    // Initialize error handling
    setupErrorHandling() {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, 'Unhandled Promise');
            event.preventDefault();
        });

        // Handle JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleError(new Error(event.message), 'JavaScript Error');
        });
    }

    // Setup keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event);
        });
    }

    // Setup URL routing
    setupRouting() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            if (api.isAuthenticated()) {
                this.handleRoute();
            }
        });
    }

    // Handle current route
    handleRoute() {
        const path = window.location.pathname;
        const pageId = this.getPageFromPath(path);
        this.showPage(pageId, false); // Don't update URL when handling route
    }

    // Get page ID from URL path
    getPageFromPath(path) {
        const routes = {
            '/': 'dashboard',
            '/dashboard': 'dashboard',
            '/team': 'team',
            '/time': 'time-tracking',
            '/time-tracking': 'time-tracking',
            '/projects': 'projects',
            '/reports': 'reports'
        };

        return routes[path] || 'dashboard';
    }

    // Update URL for current page
    updateUrl(pageId) {
        const paths = {
            'dashboard': '/',
            'team': '/team',
            'time-tracking': '/time',
            'projects': '/projects',
            'reports': '/reports'
        };

        const path = paths[pageId] || '/';
        if (window.location.pathname !== path) {
            window.history.pushState({ page: pageId }, '', path);
        }
    }

    // Add CSS for reports styling
    addReportsStyles() {
        if (document.querySelector('#reports-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'reports-styles';
        styles.textContent = `
            .reports-grid {
                display: flex;
                flex-direction: column;
                gap: 2rem;
            }

            .report-section {
                background: white;
                border-radius: 12px;
                padding: 2rem;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }

            .report-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
                padding-bottom: 1rem;
                border-bottom: 1px solid #e2e8f0;
            }

            .report-header h3 {
                color: #1e293b;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin: 0;
            }

            .report-period {
                color: #64748b;
                font-size: 0.875rem;
            }

            .executive-metrics {
                margin-bottom: 2rem;
            }

            .metric-row {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
            }

            .metric-item {
                text-align: center;
                padding: 1rem;
                background: #f8fafc;
                border-radius: 8px;
            }

            .metric-label {
                font-size: 0.875rem;
                color: #64748b;
                margin-bottom: 0.5rem;
            }

            .metric-value {
                font-size: 1.5rem;
                font-weight: 700;
                color: #1e293b;
            }

            .metric-value.risk {
                color: #ff00c8;
            }

            .metric-value.warning {
                color: #ffcc00;
            }

            .health-distribution h4 {
                margin-bottom: 1rem;
                color: #374151;
            }

            .health-bars {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }

            .health-bar {
                display: flex;
                align-items: center;
                gap: 1rem;
            }

            .health-label {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                min-width: 120px;
                font-size: 0.875rem;
            }

            .health-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
            }

            .health-dot.green { background: #c8ff00; }
            .health-dot.yellow { background: #ffcc00; }
            .health-dot.red { background: #ff00c8; }

            .health-progress {
                flex: 1;
                height: 8px;
                background: #e2e8f0;
                border-radius: 4px;
                overflow: hidden;
            }

            .health-fill {
                height: 100%;
                transition: width 0.3s ease;
            }

            .health-fill.green { background: #c8ff00; }
            .health-fill.yellow { background: #ffcc00; }
            .health-fill.red { background: #ff00c8; }

            .projects-health-list {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }

            .project-health-row {
                padding: 1rem;
                border-radius: 8px;
                border-left: 4px solid;
                background: #f8fafc;
            }

            .project-health-row.green { border-left-color: #c8ff00; }
            .project-health-row.yellow { border-left-color: #ffcc00; }
            .project-health-row.red { border-left-color: #ff00c8; }

            .project-info {
                margin-bottom: 0.5rem;
            }

            .project-name {
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 0.25rem;
            }

            .project-owner {
                font-size: 0.875rem;
                color: #64748b;
            }

            .project-metrics {
                display: flex;
                gap: 1rem;
                align-items: center;
                margin-bottom: 0.5rem;
            }

            .arr-value {
                font-weight: 600;
                color: #00c8ff;
            }

            .close-date {
                font-size: 0.875rem;
                color: #64748b;
            }

            .project-note {
                font-size: 0.875rem;
                color: #475569;
                font-style: italic;
                margin-top: 0.5rem;
            }

            .capacity-overview {
                margin-bottom: 2rem;
            }

            .capacity-metrics {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 1rem;
                margin-bottom: 1rem;
            }

            .capacity-metric {
                text-align: center;
                padding: 1rem;
                background: #f8fafc;
                border-radius: 8px;
            }

            .capacity-alert {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                background: #fef3c7;
                border: 1px solid #ffcc00;
                border-radius: 8px;
                color: #92400e;
            }

            .team-hours-breakdown h4 {
                margin-bottom: 1rem;
                color: #374151;
            }

            .hours-list {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .person-hours {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.75rem;
                background: #f8fafc;
                border-radius: 6px;
            }

            .person-name {
                font-weight: 600;
                color: #374151;
            }

            .person-stats {
                display: flex;
                gap: 1rem;
                font-size: 0.875rem;
                color: #64748b;
            }

            .hours {
                font-weight: 600;
                color: #00c8ff;
            }

            .risk-summary {
                margin-bottom: 2rem;
            }

            .risk-metric {
                text-align: center;
                padding: 1rem;
                background: #fee2e2;
                border-radius: 8px;
                border: 1px solid #ff00c8;
            }

            .risk-categories {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
            }

            .risk-category h4 {
                margin-bottom: 1rem;
                color: #374151;
            }

            .risk-projects {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }

            .risk-project {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem;
                background: #f8fafc;
                border-radius: 8px;
            }

            .risk-metrics {
                display: flex;
                gap: 1rem;
                align-items: center;
            }

            .arr-risk {
                font-weight: 600;
                color: #ff00c8;
                font-size: 0.875rem;
            }

            .time-summary-list {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .time-entry-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem;
                background: #f8fafc;
                border-radius: 8px;
            }

            .entry-name {
                font-weight: 600;
                color: #374151;
            }

            .entry-details {
                font-size: 0.875rem;
                color: #64748b;
                margin-top: 0.25rem;
            }

            .entry-hours {
                font-weight: 600;
                color: #00c8ff;
            }

            .export-options {
                display: flex;
                gap: 1rem;
                margin-bottom: 1rem;
                flex-wrap: wrap;
            }

            .export-info {
                padding: 1rem;
                background: #f0f9ff;
                border: 1px solid #0ea5e9;
                border-radius: 8px;
                color: #0c4a6e;
            }

            .export-info i {
                color: #0ea5e9;
                margin-right: 0.5rem;
            }
        `;
        document.head.appendChild(styles);
    }
}

// Initialize the app
const app = new App();

// Setup error handling and keyboard shortcuts
app.setupErrorHandling();
app.setupKeyboardShortcuts();
app.addReportsStyles();

// Make app globally available
window.app = app;

// Export for module usage
export default app;