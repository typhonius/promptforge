// API utility functions for Rocketlane Replacement

const API_BASE_URL = '/api';

class ApiClient {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.authCredentials = null;
        this.isAuthenticating = false;
        this.authPromise = null;
    }

    setCredentials(password) {
        // Use a default username since we only need password
        this.authCredentials = btoa(`user:${password}`);
        // Store in sessionStorage (not localStorage for security)
        sessionStorage.setItem('auth_credentials', this.authCredentials);
    }

    getAuthHeader() {
        if (!this.authCredentials) {
            // Try to get from sessionStorage
            this.authCredentials = sessionStorage.getItem('auth_credentials');
        }
        return this.authCredentials ? `Basic ${this.authCredentials}` : null;
    }

    clearCredentials() {
        this.authCredentials = null;
        sessionStorage.removeItem('auth_credentials');
    }

    async request(endpoint, options = {}) {
        // Wait for any ongoing authentication to complete
        if (this.authPromise) {
            await this.authPromise;
        }

        const url = `${this.baseURL}${endpoint}`;
        const authHeader = this.getAuthHeader();

        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader && { 'Authorization': authHeader }),
                ...options.headers,
            },
            ...options,
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);

            if (response.status === 401) {
                // Clear invalid credentials
                this.clearCredentials();
                throw new Error('Authentication required');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    async requestWithRetry(endpoint, options = {}, maxRetries = 2) {
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.request(endpoint, options);
            } catch (error) {
                lastError = error;

                // Don't retry authentication errors or client errors (4xx)
                if (error.message === 'Authentication required' ||
                    (error.message.includes('HTTP error') && error.message.includes('4'))) {
                    throw error;
                }

                // If this isn't the last attempt, wait before retrying
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
                    console.log(`API request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    // Authentication methods
    async login(password) {
        // Prevent concurrent login attempts
        if (this.isAuthenticating) {
            return this.authPromise;
        }

        this.isAuthenticating = true;
        this.authPromise = this._performLogin(password);

        try {
            const result = await this.authPromise;
            return result;
        } finally {
            this.isAuthenticating = false;
            this.authPromise = null;
        }
    }

    async _performLogin(password) {
        this.setCredentials(password);
        try {
            // Test the credentials with a simple API call
            await this.healthCheck();
            return { success: true };
        } catch (error) {
            this.clearCredentials();
            throw new Error('Invalid password');
        }
    }

    logout() {
        this.clearCredentials();
    }

    isAuthenticated() {
        return !!this.getAuthHeader();
    }

    // Generic CRUD methods
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: data,
        });
    }

    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data,
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // Users API
    async getUsers() {
        return this.requestWithRetry('/users', { method: 'GET' });
    }

    async getUser(userId) {
        return this.requestWithRetry(`/users/${userId}`, { method: 'GET' });
    }

    async createUser(userData) {
        return this.post('/users', userData);
    }

    async updateUser(userId, userData) {
        return this.put(`/users/${userId}`, userData);
    }

    async deleteUser(userId) {
        return this.delete(`/users/${userId}`);
    }

    async getUserTimeSummary(userId, startDate, endDate) {
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        return this.requestWithRetry(`/users/${userId}/time-summary?${params}`, { method: 'GET' });
    }

    // Projects API
    async getProjects(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) params.append(key, value);
        });

        return this.requestWithRetry(`/projects?${params}`, { method: 'GET' });
    }

    async getProject(projectId) {
        return this.get(`/projects/${projectId}`);
    }

    async createProject(projectData) {
        return this.post('/projects', projectData);
    }

    async updateProject(projectId, projectData) {
        return this.put(`/projects/${projectId}`, projectData);
    }

    async deleteProject(projectId) {
        return this.delete(`/projects/${projectId}`);
    }

    async addProjectNote(projectId, noteData) {
        return this.post(`/projects/${projectId}/notes`, noteData);
    }

    async getProjectHealthHistory(projectId) {
        return this.get(`/projects/${projectId}/health-history`);
    }

    async getProjectTimeSummary(projectId, startDate, endDate) {
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        return this.get(`/projects/${projectId}/time-summary?${params}`);
    }

    // Time Entries API
    async getTimeEntries(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) params.append(key, value);
        });

        return this.get(`/time-entries?${params}`);
    }

    async getWeekView(userId, weekStart) {
        return this.get(`/time-entries/week-view/${userId}?week_start=${weekStart}`);
    }

    async createTimeEntry(entryData) {
        return this.post('/time-entries', entryData);
    }

    async updateTimeEntry(entryId, entryData) {
        return this.put(`/time-entries/${entryId}`, entryData);
    }

    async deleteTimeEntry(entryId) {
        return this.delete(`/time-entries/${entryId}`);
    }

    async bulkUpdateTimeEntries(entries) {
        return this.post('/time-entries/bulk-update', { entries });
    }

    async getCapacityReport(startDate, endDate) {
        return this.get(`/time-entries/reports/capacity?start_date=${startDate}&end_date=${endDate}`);
    }

    // Reports API
    async getExecutiveReport(startDate, endDate) {
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        return this.requestWithRetry(`/reports/executive?${params}`, { method: 'GET' });
    }

    async getProjectHealthTrends(days = 30) {
        return this.get(`/reports/project-health-trends?days=${days}`);
    }

    async getTimeSummary(startDate, endDate, groupBy = 'user') {
        return this.get(`/reports/time-summary?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}`);
    }

    async getProjectRisks() {
        return this.get('/reports/project-risks');
    }

    async exportProjects() {
        return this.get('/reports/export/projects');
    }

    async exportTimeEntries(startDate, endDate) {
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        return this.get(`/reports/export/time-entries?${params}`);
    }

    async generateAIReport(startDate, endDate) {
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        return this.post(`/reports/ai-report?${params}`, {});
    }

    // Health check
    async healthCheck() {
        return this.get('/health');
    }
}

// Utility functions
export const formatCurrency = (amount) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

export const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export const formatDateTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const getWeekStart = (date = new Date()) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Calculate days to go back to get to Monday
    let daysBack;
    if (day === 0) { // Sunday
        daysBack = 6; // Go back 6 days to Monday
    } else { // Monday = 1, Tuesday = 2, etc.
        daysBack = day - 1; // Go back to Monday
    }

    const monday = new Date(d.getTime() - (daysBack * 24 * 60 * 60 * 1000));
    return monday.toISOString().split('T')[0];
};

export const getWeekDates = (weekStart) => {
    const dates = [];
    const start = new Date(weekStart + 'T00:00:00'); // Add time to avoid timezone issues

    for (let i = 0; i < 7; i++) {
        const date = new Date(start.getTime() + (i * 24 * 60 * 60 * 1000));
        dates.push({
            date: date.toISOString().split('T')[0],
            dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNumber: date.getDate(),
        });
    }

    return dates;
};

export const getHealthColor = (health) => {
    switch (health?.toLowerCase()) {
        case 'green':
        case 'healthy':
        case 'good':
            return 'green';
        case 'yellow':
        case 'at_risk':
        case 'warning':
        case 'amber':
            return 'yellow';
        case 'red':
        case 'critical':
        case 'poor':
        case 'blocked':
            return 'red';
        default:
            return 'yellow';
    }
};

export const showLoading = () => {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.add('active');
};

export const hideLoading = () => {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.remove('active');
};

export const showModal = (title, content, actions = []) => {
    const overlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');

    modalContent.innerHTML = `
        <div class="modal-header">
            <h2 class="modal-title">${title}</h2>
            <button class="modal-close" onclick="hideModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            ${content}
        </div>
        <div class="modal-footer">
            ${actions.map(action => `
                <button class="btn ${action.class || 'btn-secondary'}" onclick="${action.onclick}">
                    ${action.text}
                </button>
            `).join('')}
        </div>
    `;

    overlay.classList.add('active');

    // Add escape key listener
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            hideModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    // Store the handler so we can remove it later
    overlay.escapeHandler = escapeHandler;
};

export const hideModal = () => {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');

    // Remove escape key listener if it exists
    if (overlay.escapeHandler) {
        document.removeEventListener('keydown', overlay.escapeHandler);
        overlay.escapeHandler = null;
    }
};

// Make hideModal globally available
window.hideModal = hideModal;

// Create and export API client instance
export const api = new ApiClient();

// Make API client globally available for debugging
window.api = api;