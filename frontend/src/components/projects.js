// Projects Component
import { api, formatCurrency, formatDate, getHealthColor, showLoading, hideLoading, showModal } from '../utils/api.js';

class ProjectsComponent {
    constructor() {
        this.projects = [];
        this.users = [];
        this.filters = {
            status: '',
            health: ''
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        // Don't automatically load data - let the app controller handle this
    }

    setupEventListeners() {
        const statusFilter = document.getElementById('status-filter');
        const healthFilter = document.getElementById('health-filter');
        const addProjectBtn = document.getElementById('add-project-btn');

        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.loadProjects();
            });
        }

        if (healthFilter) {
            healthFilter.addEventListener('change', (e) => {
                this.filters.health = e.target.value;
                this.loadProjects();
            });
        }

        if (addProjectBtn) {
            addProjectBtn.addEventListener('click', () => this.showAddProjectModal());
        }
    }

    async loadUsers() {
        try {
            // Ensure we're authenticated before making the request
            if (!api.isAuthenticated()) {
                return; // Skip loading users if not authenticated
            }
            this.users = await api.getUsers();
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    }

    async loadProjects() {
        showLoading();
        try {
            // Ensure we're authenticated before making the request
            if (!api.isAuthenticated()) {
                throw new Error('Authentication required');
            }

            this.projects = await api.getProjects(this.filters);
            this.renderProjects();
        } catch (error) {
            console.error('Failed to load projects:', error);
            this.renderError(error);
        } finally {
            hideLoading();
        }
    }

    renderProjects() {
        const container = document.getElementById('projects-list');
        if (!container) return;

        if (this.projects.length === 0) {
            container.innerHTML = `
                <div class="text-center" style="grid-column: 1 / -1; padding: 3rem; color: #64748b;">
                    <i class="fas fa-project-diagram" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>No projects found</h3>
                    <p>No projects match your current filters, or no projects have been created yet.</p>
                    <button class="btn btn-primary" onclick="projects.showAddProjectModal()">
                        <i class="fas fa-plus"></i> Create First Project
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.projects.map(project => {
            const healthColor = getHealthColor(project.health);
            const arrDisplay = project.arr_value ? formatCurrency(project.arr_value) : '';
            const startDate = project.start_date ? formatDate(project.start_date) : '';
            const closeDate = project.close_date ? formatDate(project.close_date) : '';

            // Check if project is closed based on close date
            const isClosedByDate = project.close_date && new Date(project.close_date) < new Date();
            const displayStatus = isClosedByDate ? 'Closed' : project.status;

            // Get tier names
            const tier1Name = project.tier_1_name || '';
            const tier2Name = project.tier_2_name || '';

            // Handle multiple tier 3 names
            let tier3Names = [];
            if (project.tier3_owners) {
                try {
                    const tier3_ids = JSON.parse(project.tier3_owners);
                    tier3Names = tier3_ids.map(id => {
                        const user = this.users.find(u => u.id === id);
                        return user ? `${user.first_name} ${user.last_name}` : null;
                    }).filter(name => name);
                } catch (e) {
                    console.error('Error parsing tier3_owners:', e);
                }
            }

            const tier3Display = tier3Names.length > 0 ? tier3Names.join(', ') : '';
            const tierDisplay = [tier1Name, tier2Name, tier3Display].filter(name => name).join(' | ') || 'No tiers assigned';

            return `
                <div class="project-card" onclick="projects.viewProject(${project.id})">
                    <div class="project-header">
                        <div>
                            <div class="project-title">${project.project_name}</div>
                            <div class="project-owner">
                                <i class="fas fa-users"></i> ${tierDisplay}
                            </div>
                        </div>
                        <div class="health-badge ${healthColor}">${project.health}</div>
                    </div>

                    <div class="project-meta">
                        <div class="project-status">
                            <i class="fas fa-info-circle"></i> ${displayStatus}
                        </div>
                        ${arrDisplay ? `<div class="project-arr"><i class="fas fa-dollar-sign"></i> ${arrDisplay} ARR</div>` : ''}
                        ${startDate ? `<div class="project-dates"><i class="fas fa-calendar-alt"></i> Started: ${startDate}</div>` : ''}
                        ${closeDate ? `<div class="project-dates"><i class="fas fa-handshake"></i> Close: ${closeDate}</div>` : ''}
                    </div>

                    ${project.latest_note ? `
                        <div class="project-notes">
                            <i class="fas fa-sticky-note"></i>
                            ${project.latest_note.length > 150 ?
                                project.latest_note.substring(0, 150) + '...' :
                                project.latest_note
                            }
                        </div>
                    ` : ''}

                    <div class="project-actions" onclick="event.stopPropagation()">
                        <button class="btn btn-sm btn-secondary" onclick="projects.editProject(${project.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="projects.addNote(${project.id})">
                            <i class="fas fa-comment-plus"></i> Add Note
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="projects.deleteProject(${project.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderError(error) {
        const container = document.getElementById('projects-list');
        if (container) {
            const isAuthError = error && error.message === 'Authentication required';
            const errorMessage = isAuthError
                ? 'Please log in to view projects.'
                : 'There was an error loading the projects. Please try again.';

            container.innerHTML = `
                <div class="text-center" style="grid-column: 1 / -1; padding: 3rem; color: #ff00c8;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3>Failed to load projects</h3>
                    <p>${errorMessage}</p>
                    ${!isAuthError ? `
                        <button class="btn btn-primary" onclick="projects.loadProjects()">
                            <i class="fas fa-refresh"></i> Retry
                        </button>
                    ` : ''}
                </div>
            `;
        }
    }

    async viewProject(projectId) {
        try {
            showLoading();
            const project = await api.getProject(projectId);
            this.showProjectDetailsModal(project);
        } catch (error) {
            console.error('Failed to load project:', error);
        } finally {
            hideLoading();
        }
    }

    showProjectDetailsModal(project) {
        const healthColor = getHealthColor(project.health);
        const arrDisplay = project.arr_value ? formatCurrency(project.arr_value) : 'Not specified';
        const startDate = project.start_date ? formatDate(project.start_date) : 'Not set';
        const closeDate = project.close_date ? formatDate(project.close_date) : 'Not set';

        // Check if project is closed based on close date
        const isClosedByDate = project.close_date && new Date(project.close_date) < new Date();
        const displayStatus = isClosedByDate ? 'Closed' : project.status;

        const content = `
            <div class="project-details-full">
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
                        <label>Tier 2:</label>
                        <span>${project.tier_2_name || 'Not assigned'}</span>
                    </div>
                    <div class="meta-item">
                        <label>Tier 3:</label>
                        <span>${(() => {
                            if (project.tier3_owners) {
                                try {
                                    const tier3_array = JSON.parse(project.tier3_owners);
                                    if (tier3_array.length > 0) {
                                        const tier3Names = tier3_array.map(id => {
                                            const user = this.users.find(u => u.id === id);
                                            return user ? `${user.first_name} ${user.last_name}` : null;
                                        }).filter(name => name);
                                        return tier3Names.length > 0 ? tier3Names.join(', ') : 'Not assigned';
                                    }
                                } catch (e) {
                                    console.error('Error parsing tier3_owners:', e);
                                }
                            }
                            return 'Not assigned';
                        })()}</span>
                    </div>
                    <div class="meta-item">
                        <label>Status:</label>
                        <span>${displayStatus}</span>
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
                        <label>Close Date:</label>
                        <span>${closeDate}</span>
                    </div>
                </div>

                ${project.notes && project.notes.length > 0 ? `
                    <div class="project-notes-section">
                        <div class="section-header">
                            <h4>Project Notes</h4>
                            <button class="btn btn-sm btn-primary" onclick="hideModal(); projects.addNote(${project.id});">
                                <i class="fas fa-plus"></i> Add Note
                            </button>
                        </div>
                        <div class="notes-list">
                            ${project.notes.map(note => `
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
                ` : `
                    <div class="project-notes-section">
                        <div class="section-header">
                            <h4>Project Notes</h4>
                            <button class="btn btn-sm btn-primary" onclick="hideModal(); projects.addNote(${project.id});">
                                <i class="fas fa-plus"></i> Add Note
                            </button>
                        </div>
                        <p class="text-center" style="color: #64748b; padding: 2rem;">No notes yet. Add the first note to track project progress.</p>
                    </div>
                `}

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
                .project-details-full {
                    max-width: 600px;
                }

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

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .section-header h4 {
                    margin: 0;
                    color: #374151;
                }

                .notes-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    max-height: 300px;
                    overflow-y: auto;
                }

                .note-item {
                    background: #f8fafc;
                    padding: 1rem;
                    border-radius: 8px;
                    border-left: 3px solid #00c8ff;
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
                    white-space: pre-wrap;
                }
            </style>
        `;

        const actions = [
            {
                text: 'Edit Project',
                class: 'btn-primary',
                onclick: `hideModal(); projects.editProject(${project.id});`
            },
            {
                text: 'Add Note',
                class: 'btn-secondary',
                onclick: `hideModal(); projects.addNote(${project.id});`
            },
            {
                text: 'Close',
                class: 'btn-secondary',
                onclick: 'hideModal()'
            }
        ];

        showModal('Project Details', content, actions);
    }

    showAddProjectModal() {
        const userOptions = this.users
            .filter(user => user.is_active)
            .map(user => `<option value="${user.id}">${user.first_name} ${user.last_name}</option>`)
            .join('');

        const content = `
            <form id="add-project-form">
                <div class="form-group">
                    <label class="form-label">Project Name *</label>
                    <input type="text" class="form-input" name="project_name" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Tier 1</label>
                    <select class="form-select" name="tier_1">
                        <option value="">Select Tier 1</option>
                        ${userOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Tier 2</label>
                    <select class="form-select" name="tier_2">
                        <option value="">Select Tier 2</option>
                        ${userOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Tier 3 (Multiple)</label>
                    <select class="form-select" name="tier_3" multiple style="min-height: 120px;">
                        ${userOptions}
                    </select>
                    <small class="form-help">Hold Ctrl/Cmd to select multiple users</small>
                </div>

                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select class="form-select" name="status">
                        <option value="in_progress">In Progress</option>
                        <option value="in_planning">In Planning</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Health Status</label>
                    <select class="form-select" name="health">
                        <option value="green">Green</option>
                        <option value="yellow">Yellow</option>
                        <option value="red">Red</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">ARR Value ($)</label>
                    <input type="number" class="form-input" name="arr_value" step="0.01" min="0">
                </div>

                <div class="form-group">
                    <label class="form-label">Start Date</label>
                    <input type="date" class="form-input" name="start_date">
                </div>

                <div class="form-group">
                    <label class="form-label">Close Date</label>
                    <input type="date" class="form-input" name="close_date">
                </div>
            </form>
        `;

        const actions = [
            {
                text: 'Create Project',
                class: 'btn-primary',
                onclick: 'projects.createProject()'
            },
            {
                text: 'Cancel',
                class: 'btn-secondary',
                onclick: 'hideModal()'
            }
        ];

        showModal('Add New Project', content, actions);
    }

    async createProject() {
        const form = document.getElementById('add-project-form');
        if (!form) return;

        const formData = new FormData(form);
        const projectData = {};

        for (let [key, value] of formData.entries()) {
            if (value) {
                if (key === 'arr_value') {
                    projectData[key] = parseFloat(value);
                } else if (key === 'tier_1') {
                    projectData['tier1_owner_id'] = parseInt(value);
                } else if (key === 'tier_2') {
                    projectData['tier2_owner_id'] = parseInt(value);
                } else if (key === 'tier_3') {
                    // Handle multiple tier 3 selections
                    if (!projectData['tier3_owner_ids']) {
                        projectData['tier3_owner_ids'] = [];
                    }
                    projectData['tier3_owner_ids'].push(parseInt(value));
                } else {
                    projectData[key] = value;
                }
            }
        }

        if (!projectData.project_name) {
            alert('Project name is required');
            return;
        }

        try {
            showLoading();
            await api.createProject(projectData);
            hideModal();
            this.loadProjects();
            this.showSuccess('Project created successfully!');
        } catch (error) {
            console.error('Failed to create project:', error);
            this.showError('Failed to create project. Please try again.');
        } finally {
            hideLoading();
        }
    }

    async editProject(projectId) {
        try {
            showLoading();
            const project = await api.getProject(projectId);
            this.showEditProjectModal(project);
        } catch (error) {
            console.error('Failed to load project for editing:', error);
        } finally {
            hideLoading();
        }
    }

    showEditProjectModal(project) {
        const tier1Options = this.users
            .filter(user => user.is_active)
            .map(user => `
                <option value="${user.id}" ${project.tier1_owner_id === user.id ? 'selected' : ''}>
                    ${user.first_name} ${user.last_name}
                </option>
            `)
            .join('');

        const tier2Options = this.users
            .filter(user => user.is_active)
            .map(user => `
                <option value="${user.id}" ${project.tier2_owner_id === user.id ? 'selected' : ''}>
                    ${user.first_name} ${user.last_name}
                </option>
            `)
            .join('');

        // Handle tier3_owners JSON array
        let tier3_selected_ids = [];
        if (project.tier3_owners) {
            try {
                tier3_selected_ids = JSON.parse(project.tier3_owners);
            } catch (e) {
                console.error('Error parsing tier3_owners:', e);
            }
        }

        const tier3Options = this.users
            .filter(user => user.is_active)
            .map(user => `
                <option value="${user.id}" ${tier3_selected_ids.includes(user.id) ? 'selected' : ''}>
                    ${user.first_name} ${user.last_name}
                </option>
            `)
            .join('');

        const content = `
            <form id="edit-project-form">
                <div class="form-group">
                    <label class="form-label">Project Name *</label>
                    <input type="text" class="form-input" name="project_name" value="${project.project_name}" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Tier 1</label>
                    <select class="form-select" name="tier_1">
                        <option value="">Select Tier 1</option>
                        ${tier1Options}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Tier 2</label>
                    <select class="form-select" name="tier_2">
                        <option value="">Select Tier 2</option>
                        ${tier2Options}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Tier 3 (Multiple)</label>
                    <select class="form-select" name="tier_3" multiple style="min-height: 120px;">
                        ${tier3Options}
                    </select>
                    <small class="form-help">Hold Ctrl/Cmd to select multiple users</small>
                </div>

                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select class="form-select" name="status">
                        <option value="in_progress" ${project.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                        <option value="in_planning" ${project.status === 'in_planning' ? 'selected' : ''}>In Planning</option>
                        <option value="on_hold" ${project.status === 'on_hold' ? 'selected' : ''}>On Hold</option>
                        <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="cancelled" ${project.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Health Status</label>
                    <select class="form-select" name="health">
                        <option value="green" ${project.health === 'green' ? 'selected' : ''}>Green</option>
                        <option value="yellow" ${project.health === 'yellow' ? 'selected' : ''}>Yellow</option>
                        <option value="red" ${project.health === 'red' ? 'selected' : ''}>Red</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Health Change Reason</label>
                    <input type="text" class="form-input" name="health_change_reason" placeholder="Reason for health status change">
                </div>

                <div class="form-group">
                    <label class="form-label">ARR Value ($)</label>
                    <input type="number" class="form-input" name="arr_value" value="${project.arr_value || ''}" step="0.01" min="0">
                </div>

                <div class="form-group">
                    <label class="form-label">Start Date</label>
                    <input type="date" class="form-input" name="start_date" value="${project.start_date || ''}">
                </div>

                <div class="form-group">
                    <label class="form-label">Close Date</label>
                    <input type="date" class="form-input" name="close_date" value="${project.close_date || ''}">
                </div>

                <div class="form-group">
                    <label class="form-label">
                        <input type="checkbox" name="is_closed" ${project.is_closed ? 'checked' : ''}>
                        Project is closed
                    </label>
                </div>
            </form>
        `;

        const actions = [
            {
                text: 'Update Project',
                class: 'btn-primary',
                onclick: `projects.updateProject(${project.id})`
            },
            {
                text: 'Cancel',
                class: 'btn-secondary',
                onclick: 'hideModal()'
            }
        ];

        showModal('Edit Project', content, actions);
    }

    async updateProject(projectId) {
        const form = document.getElementById('edit-project-form');
        if (!form) return;

        const formData = new FormData(form);
        const projectData = { changed_by: null }; // You might want to track who made the change

        for (let [key, value] of formData.entries()) {
            if (key === 'is_closed') {
                projectData[key] = true;
            } else if (value) {
                if (key === 'arr_value') {
                    projectData[key] = parseFloat(value);
                } else if (key === 'tier_1') {
                    projectData['tier1_owner_id'] = parseInt(value);
                } else if (key === 'tier_2') {
                    projectData['tier2_owner_id'] = parseInt(value);
                } else if (key === 'tier_3') {
                    // Handle multiple tier 3 selections
                    if (!projectData['tier3_owner_ids']) {
                        projectData['tier3_owner_ids'] = [];
                    }
                    projectData['tier3_owner_ids'].push(parseInt(value));
                } else {
                    projectData[key] = value;
                }
            }
        }

        if (!projectData.project_name) {
            alert('Project name is required');
            return;
        }

        try {
            showLoading();
            await api.updateProject(projectId, projectData);
            hideModal();
            this.loadProjects();
            this.showSuccess('Project updated successfully!');
        } catch (error) {
            console.error('Failed to update project:', error);
            this.showError('Failed to update project. Please try again.');
        } finally {
            hideLoading();
        }
    }

    async addNote(projectId) {
        const content = `
            <form id="add-note-form">
                <div class="form-group">
                    <label class="form-label">Note *</label>
                    <textarea class="form-textarea" name="note_text" rows="5" required
                              placeholder="Enter project note or update..."></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label">Created By</label>
                    <select class="form-select" name="created_by">
                        <option value="">Select User</option>
                        ${this.users
                            .filter(user => user.is_active)
                            .map(user => `<option value="${user.id}">${user.first_name} ${user.last_name}</option>`)
                            .join('')
                        }
                    </select>
                </div>
            </form>
        `;

        const actions = [
            {
                text: 'Add Note',
                class: 'btn-primary',
                onclick: `projects.saveNote(${projectId})`
            },
            {
                text: 'Cancel',
                class: 'btn-secondary',
                onclick: 'hideModal()'
            }
        ];

        showModal('Add Project Note', content, actions);
    }

    async saveNote(projectId) {
        const form = document.getElementById('add-note-form');
        if (!form) return;

        const formData = new FormData(form);
        const noteData = {};

        for (let [key, value] of formData.entries()) {
            if (value) {
                if (key === 'created_by') {
                    noteData[key] = parseInt(value);
                } else {
                    noteData[key] = value;
                }
            }
        }

        if (!noteData.note_text) {
            alert('Note text is required');
            return;
        }

        try {
            showLoading();
            await api.addProjectNote(projectId, noteData);
            hideModal();
            this.showSuccess('Note added successfully!');
        } catch (error) {
            console.error('Failed to add note:', error);
            this.showError('Failed to add note. Please try again.');
        } finally {
            hideLoading();
        }
    }

    async deleteProject(projectId) {
        if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
            return;
        }

        try {
            showLoading();
            await api.deleteProject(projectId);
            this.loadProjects();
            this.showSuccess('Project deleted successfully!');
        } catch (error) {
            console.error('Failed to delete project:', error);
            this.showError('Failed to delete project. Please try again.');
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
export const projects = new ProjectsComponent();

// Make it globally available
window.projects = projects;