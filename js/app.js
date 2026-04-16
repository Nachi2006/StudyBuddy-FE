// app.js

document.addEventListener('DOMContentLoaded', () => {
    // === Core State & DOM Elements ===
    let currentUser = null;
    let currentData = {
        subjects: [],
        notes: [],
        assignments: [],
        doubts: []
    };

    const DOM = {
        nav: document.getElementById('main-nav'),
        navProfile: document.getElementById('nav-profile'),
        userName: document.getElementById('current-user-name'),
        loader: document.getElementById('full-loader'),
        toastContainer: document.getElementById('toast-container'),
        views: document.querySelectorAll('.view'),
        navLinks: document.querySelectorAll('.nav-link'),
        menuToggle: document.getElementById('menu-toggle'),
        navMenu: document.getElementById('nav-menu')
    };

    // === Expose globals BEFORE init so AngularJS can access them ===
    window.showToast = showToast;
    window.showLoader = showLoader;
    window.hideLoader = hideLoader;
    window.showApp = showApp;
    window.showAuth = showAuth;
    window.loadViewData = loadViewData;

    // === Initialization ===
    init();

    async function init() {
        setupRouting();
        setupAuthToggle();
        setupModals();
        setupForms();

        // Check if user is already logged in via session cookie
        try {
            showLoader();
            const data = await api.getMe();
            // User returned successfully — session is alive
            currentUser = data?.name || 'Student';
            DOM.userName.textContent = currentUser;
            showApp();
        } catch (e) {
            // Not logged in or backend unreachable
            hideLoader();
            showAuth();
        }
    }

    // === Routing (View Switching) ===
    function setupRouting() {
        DOM.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('data-target');
                switchView(targetId);
                // close mobile menu
                DOM.navMenu.classList.remove('show');
            });
        });

        DOM.menuToggle.addEventListener('click', () => {
            DOM.navMenu.classList.toggle('show');
        });
    }

    function switchView(viewId) {
        DOM.views.forEach(view => {
            if (view.id === viewId) {
                view.classList.remove('hidden');
                view.classList.add('active');
                loadViewData(viewId);
            } else {
                view.classList.remove('active');
                view.classList.add('hidden');
            }
        });

        DOM.navLinks.forEach(link => {
            if (link.getAttribute('data-target') === viewId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    async function loadViewData(viewId) {
        showLoader();
        try {
            switch (viewId) {
                case 'view-dashboard':
                    await loadDashboard();
                    break;
                case 'view-subjects':
                    await Promise.all([loadSubjects(), loadNotes()]);
                    break;
                case 'view-assignments':
                    await Promise.all([loadAssignments(), loadSubjects()]);
                    break;
                case 'view-doubts':
                    await loadDoubts();
                    break;
                case 'view-planner':
                    // Planner is local storage based — handled by AngularJS
                    break;
            }
        } catch (e) {
            console.error('loadViewData error:', e);
            if (e?.status === 401) {
                showToast('Session expired. Please log in again.', 'error');
                showAuth();
            } else {
                showToast('Failed to load data.', 'error');
            }
        } finally {
            hideLoader();
        }
    }

    // === API Data Loaders ===
    async function loadDashboard() {
        // Load all data needed for the dashboard
        const data = await api.getDashboard().catch(() => ({}));

        currentData.subjects = data?.subjects || [];
        currentData.notes = data?.notes || [];
        currentData.assignments = data?.assignments || [];

        populateSubjectDropdowns();

        if (window.syncAngularData) {
            window.syncAngularData('subjects', currentData.subjects);
            window.syncAngularData('notes', currentData.notes);
            window.syncAngularData('assignments', currentData.assignments);
        }
    }

    async function loadSubjects() {
        currentData.subjects = await api.getSubjects() || [];
        populateSubjectDropdowns();
        if (window.syncAngularData) {
            window.syncAngularData('subjects', currentData.subjects);
        }
    }

    async function loadNotes() {
        currentData.notes = await api.getNotes() || [];
        if (window.syncAngularData) {
            window.syncAngularData('notes', currentData.notes);
        }
    }

    async function loadAssignments() {
        currentData.assignments = await api.getAssignments() || [];
        if (window.syncAngularData) {
            window.syncAngularData('assignments', currentData.assignments);
        }
    }

    async function loadDoubts() {
        currentData.doubts = await api.getDoubts() || [];
        if (window.syncAngularData) {
            window.syncAngularData('doubts', currentData.doubts);
        }
    }

    // === View Logic: Subjects & Notes ===
    function populateSubjectDropdowns() {
        const noteSubj = document.getElementById('note-subject');
        const assignSubj = document.getElementById('assign-subject');

        const options = '<option value="">Select a Subject</option>' +
            currentData.subjects.map(sub => `<option value="${sub._id}">${sub.subjectName}</option>`).join('');

        if (noteSubj) noteSubj.innerHTML = options;
        if (assignSubj) assignSubj.innerHTML = options;
    }

    // === Form Setup & Validation ===
    function setupForms() {
        // Login
        document.getElementById('form-login').addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('login-email');
            const passInput = document.getElementById('login-password');

            emailInput.classList.remove('invalid');
            passInput.classList.remove('invalid');

            if (!emailInput.value || !emailInput.validity.valid) {
                emailInput.classList.add('invalid');
                showToast('Please enter a valid email address', 'error');
                return;
            }
            if (!passInput.value) {
                passInput.classList.add('invalid');
                showToast('Please enter your password', 'error');
                return;
            }

            showLoader();
            try {
                const response = await api.login(emailInput.value, passInput.value);
                currentUser = response?.name || emailInput.value.split('@')[0] || 'Student';
                DOM.userName.textContent = currentUser;
                showToast('Login successful', 'success');
                showApp();
                e.target.reset();
            } catch (err) {
                showToast(err.message || 'Login failed', 'error');
            } finally {
                hideLoader();
            }
        });

        // Signup
        document.getElementById('form-signup').addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('signup-name');
            const emailInput = document.getElementById('signup-email');
            const passInput = document.getElementById('signup-password');

            nameInput.classList.remove('invalid');
            emailInput.classList.remove('invalid');
            passInput.classList.remove('invalid');

            if (!nameInput.value || nameInput.value.length < 2) {
                nameInput.classList.add('invalid');
                showToast('Name must be at least 2 characters', 'error');
                return;
            }
            if (!emailInput.value || !emailInput.validity.valid) {
                emailInput.classList.add('invalid');
                showToast('Please enter a valid email address', 'error');
                return;
            }
            if (!passInput.value || passInput.value.length < 6) {
                passInput.classList.add('invalid');
                showToast('Password must be at least 6 characters', 'error');
                return;
            }

            showLoader();
            try {
                await api.signup(nameInput.value, emailInput.value, passInput.value);
                showToast('Account created! Please log in.', 'success');
                e.target.reset();
                document.getElementById('tab-login').click();
            } catch (err) {
                showToast(err.message || 'Signup failed', 'error');
            } finally {
                hideLoader();
            }
        });

        // Subject
        document.getElementById('form-add-subject').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('subject-name').value.trim();
            if (!name) return showToast('Subject name is required', 'error');

            showLoader();
            try {
                await api.createSubject(name);
                showToast('Subject created!', 'success');
                document.getElementById('subject-name').value = '';
                document.getElementById('subject-form-container').classList.add('hidden');
                await loadSubjects();
            } catch (err) {
                showToast(err.message || 'Failed to create subject', 'error');
            } finally {
                hideLoader();
            }
        });

        // Notes
        document.getElementById('form-add-note').addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('note-title').value.trim();
            const link = document.getElementById('note-link').value.trim();
            const subjectId = document.getElementById('note-subject').value;

            if (!subjectId) return showToast('Please select a subject', 'error');
            if (!title) return showToast('Note title is required', 'error');

            showLoader();
            try {
                await api.createNote(title, link, subjectId);
                showToast('Note uploaded!', 'success');
                e.target.reset();
                document.getElementById('note-form-container').classList.add('hidden');
                await loadNotes();
            } catch (err) {
                showToast(err.message || 'Failed to upload note', 'error');
            } finally {
                hideLoader();
            }
        });

        // Assignment
        document.getElementById('form-add-assignment').addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('assign-title').value.trim();
            const deadline = document.getElementById('assign-deadline').value;
            const subjectId = document.getElementById('assign-subject').value;

            if (!subjectId) return showToast('Please select a subject', 'error');
            if (!title) return showToast('Assignment title is required', 'error');
            if (!deadline) return showToast('Please set a deadline', 'error');

            showLoader();
            try {
                await api.createAssignment(title, new Date(deadline).toISOString(), subjectId);
                showToast('Assignment created!', 'success');
                e.target.reset();
                document.getElementById('assignment-form-container').classList.add('hidden');
                await loadAssignments();
            } catch (err) {
                showToast(err.message || 'Failed to create assignment', 'error');
            } finally {
                hideLoader();
            }
        });

        // Doubt
        document.getElementById('form-add-doubt').addEventListener('submit', async (e) => {
            e.preventDefault();
            const q = document.getElementById('doubt-question').value.trim();
            if (!q) return showToast('Please enter a question', 'error');

            showLoader();
            try {
                await api.postDoubt(q);
                showToast('Doubt posted!', 'success');
                e.target.reset();
                await loadDoubts();
            } catch (err) {
                showToast(err.message || 'Failed to post doubt', 'error');
            } finally {
                hideLoader();
            }
        });

        // Logout
        document.getElementById('btn-logout').addEventListener('click', async () => {
            showLoader();
            try {
                await api.logout();
            } catch (e) {
                // ignore logout errors
            } finally {
                hideLoader();
            }
            currentUser = null;
            currentData = { subjects: [], notes: [], assignments: [], doubts: [] };
            showAuth();
            showToast('Logged out successfully');
        });
    }

    // === Helpers, Modals & UI ===
    function showApp() {
        DOM.nav.classList.remove('hidden');
        DOM.navProfile.classList.remove('hidden');
        // Switch to dashboard and load data
        switchView('view-dashboard');
    }

    function showAuth() {
        DOM.nav.classList.add('hidden');
        DOM.navProfile.classList.add('hidden');
        DOM.views.forEach(v => {
            v.classList.add('hidden');
            v.classList.remove('active');
        });
        const authView = document.getElementById('view-auth');
        if (authView) {
            authView.classList.remove('hidden');
            authView.classList.add('active');
        }
    }

    function showLoader() {
        if (DOM.loader) DOM.loader.classList.remove('hidden');
    }

    function hideLoader() {
        if (DOM.loader) DOM.loader.classList.add('hidden');
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const iconClass = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
        toast.innerHTML = `<i class="fas ${iconClass}"></i> <span>${message}</span>`;
        DOM.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function setupAuthToggle() {
        const tabLogin = document.getElementById('tab-login');
        const tabSignup = document.getElementById('tab-signup');
        const formLogin = document.getElementById('form-login');
        const formSignup = document.getElementById('form-signup');

        tabLogin.addEventListener('click', () => {
            tabLogin.classList.add('active');
            tabSignup.classList.remove('active');
            formLogin.classList.remove('hidden');
            formSignup.classList.add('hidden');
        });

        tabSignup.addEventListener('click', () => {
            tabSignup.classList.add('active');
            tabLogin.classList.remove('active');
            formSignup.classList.remove('hidden');
            formLogin.classList.add('hidden');
        });
    }

    function setupModals() {
        document.getElementById('btn-add-subject').addEventListener('click', () => {
            document.getElementById('subject-form-container').classList.toggle('hidden');
            document.getElementById('note-form-container').classList.add('hidden');
        });
        document.getElementById('btn-cancel-subject').addEventListener('click', () => {
            document.getElementById('subject-form-container').classList.add('hidden');
        });

        document.getElementById('btn-add-note').addEventListener('click', () => {
            document.getElementById('note-form-container').classList.toggle('hidden');
            document.getElementById('subject-form-container').classList.add('hidden');
        });
        document.getElementById('btn-cancel-note').addEventListener('click', () => {
            document.getElementById('note-form-container').classList.add('hidden');
        });

        document.getElementById('btn-add-assignment-modal').addEventListener('click', () => {
            document.getElementById('assignment-form-container').classList.toggle('hidden');
        });
        document.getElementById('btn-cancel-assignment').addEventListener('click', () => {
            document.getElementById('assignment-form-container').classList.add('hidden');
        });
    }
});
