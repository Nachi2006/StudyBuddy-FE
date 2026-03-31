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

    // === Initialization ===
    init();

    async function init() {
        setupRouting();
        setupAuthToggle();
        setupModals();
        setupForms();
        setupFilters();
        setupPlanner();
        setupDoubts();

        // Check if user is already logged in by trying to hit dashboard
        try {
             showLoader();
             await loadDashboard(true); // silent check
             showApp();
             switchView('view-dashboard');
        } catch(e) {
             // Not logged in
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
                // load data dependent on view
                loadViewData(viewId);
            } else {
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
            switch(viewId) {
                case 'view-dashboard':
                    await loadDashboard();
                    break;
                case 'view-subjects':
                    await Promise.all([loadSubjects(), loadNotes()]);
                    renderNotesGrid(currentData.notes);
                    break;
                case 'view-assignments':
                    await Promise.all([loadAssignments(), loadSubjects()]);
                    break;
                case 'view-doubts':
                     await loadDoubts();
                     break;
            }
        } catch(e) {
             showToast('Failed to load data. Please log in again.', 'error');
             showAuth();
        } finally {
            hideLoader();
        }
    }

    // === API Data Loaders ===
    async function loadDashboard(silent = false) {
        const data = await api.getDashboard();
        // Assuming data returns stats or we calculate it manually if it returns arrays
        if (!silent) {
            // we will re-fetch explicitly to populate our lists just in case
            await Promise.all([
                loadSubjects(),
                loadNotes(),
                loadAssignments()
            ]);
            
            document.getElementById('stat-subjects').textContent = currentData.subjects.length;
            document.getElementById('stat-notes').textContent = currentData.notes.length;
            document.getElementById('stat-assignments').textContent = currentData.assignments.length;

            renderRecentItems();
        }
    }

    async function loadSubjects() {
        currentData.subjects = await api.getSubjects() || [];
        populateSubjectDropdowns();
    }

    async function loadNotes() {
        currentData.notes = await api.getNotes() || [];
    }

    async function loadAssignments() {
        currentData.assignments = await api.getAssignments() || [];
        renderAssignments('all');
    }
    
    async function loadDoubts() {
        currentData.doubts = await api.getDoubts() || [];
        renderDoubts();
    }

    // === View Logic: Subjects & Notes ===
    function populateSubjectDropdowns() {
        const $noteSubj = $('#note-subject');
        const $assignSubj = $('#assign-subject');
        
        const options = '<option value="">Select a Subject</option>' + 
            currentData.subjects.map(sub => `<option value="${sub._id}">${sub.subjectName}</option>`).join('');
            
        $noteSubj.html(options);
        $assignSubj.html(options);
    }

    function renderNotesGrid(notesToRender) {
        const $grid = $('#notes-grid');
        if (!notesToRender.length) {
            $grid.html('<div class="empty-state w-100 text-center">No notes found.</div>');
            return;
        }

        const notesHTML = notesToRender.map(note => {
            let subject = currentData.subjects.find(s => s._id === note.subjectId);
            let subName = subject ? subject.subjectName : 'Unknown Subject';
            
            // If subject not found locally, try to fetch it
            if (!subject && note.subjectId) {
                // Fetch subject details from backend
                const subjectId = typeof note.subjectId === 'object' ? note.subjectId._id || note.subjectId.id || note.subjectId : note.subjectId;
                api.getSubject(subjectId).then(subjectData => {
                    if (subjectData) {
                        // Update the note display with fetched subject name
                        const noteElement = document.querySelector(`[data-id="${note._id}"] .tag`);
                        if (noteElement) {
                            noteElement.textContent = subjectData.subjectName;
                        }
                    }
                }).catch(err => {
                    console.warn('Failed to fetch subject:', err);
                });
                subName = `Subject ID: ${subjectId}`;
            }
            
            return `
            <div class="item-card glass-panel" data-id="${note._id}">
                <div class="item-header">
                    <span class="tag">${subName}</span>
                </div>
                <h3>${note.title}</h3>
                <a href="${note.fileLink}" target="_blank" class="btn btn-sm btn-outline mt-3 w-100"><i class="fas fa-external-link-alt"></i> Open Note</a>
            </div>
            `;
        }).join('');
        
        $grid.html(notesHTML);
    }

    // === View Logic: Assignments ===
    function renderAssignments(filter = 'all') {
        const list = document.getElementById('assignments-list');
        
        let filtered = currentData.assignments;
        if (filter === 'completed') filtered = filtered.filter(a => a.status === 'completed');
        if (filter === 'incomplete') filtered = filtered.filter(a => a.status !== 'completed');

        if (!filtered.length) {
            list.innerHTML = `<div class="empty-state p-5 text-center">No assignments found for this filter.</div>`;
            return;
        }

        list.innerHTML = filtered.map(assign => {
            const d = new Date(assign.deadline);
            const isCompleted = assign.status === 'completed';
            const subject = currentData.subjects.find(s => s._id === assign.subjectId);
            const subName = subject ? subject.subjectName : 'Unknown Subject';

            return `
            <div class="item-card glass-panel mb-2 flex-between" data-id="${assign._id}">
                <div>
                    <div class="flex-row gap-4 mb-2">
                        <span class="tag">${subName}</span>
                        <span class="status-pill status-${isCompleted ? 'completed' : 'pending'}">${isCompleted ? 'Completed' : 'Pending'}</span>
                    </div>
                    <h3 class="m-0">${assign.title}</h3>
                    <small class="text-muted"><i class="fas fa-clock"></i> Due: ${d.toLocaleString()}</small>
                </div>
                <div class="flex-row">
                     ${!isCompleted ? `<button class="btn btn-sm btn-success btn-complete-assign" data-id="${assign._id}" title="Mark Complete"><i class="fas fa-check"></i></button>` : ''}
                     <button class="btn btn-sm btn-outline-danger btn-delete-assign" data-id="${assign._id}" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            `;
        }).join('');

        // Attach event listeners for delete and complete
        document.querySelectorAll('.btn-complete-assign').forEach(btn => {
             btn.addEventListener('click', async (e) => {
                 const id = e.currentTarget.getAttribute('data-id');
                 showLoader();
                 try {
                     await api.updateAssignmentStatus(id, 'completed');
                     showToast('Assignment marked completed!');
                     await loadAssignments();
                 } catch(err) { showToast('Error updating assignment', 'error'); }
                 hideLoader();
             });
        });

        document.querySelectorAll('.btn-delete-assign').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if(!confirm("Are you sure you want to delete this assignment?")) return;
                showLoader();
                try {
                    await api.deleteAssignment(id);
                    showToast('Assignment deleted');
                    await loadAssignments();
                } catch(err) { showToast('Error deleting assignment', 'error'); }
                hideLoader();
            });
       });
    }

    // === View Logic: Doubts ===
    function renderDoubts() {
        const feed = document.getElementById('doubts-feed');
        if(!currentData.doubts.length) {
            feed.innerHTML = '<div class="empty-state p-5 text-center">No doubts asked yet. Be the first!</div>';
            return;
        }

        feed.innerHTML = currentData.doubts.map(doubt => {
            const answersHTML = (doubt.answers || []).map(ans => `<div class="p-2 bg-black bg-opacity-20 rounded mb-1 text-sm border-l-2 border-primary pl-2" style="background: rgba(0,0,0,0.3); padding:0.5rem; margin-top:0.5rem; border-left: 2px solid var(--color-primary)">${ans}</div>`).join('');
            
            return `
            <div class="glass-panel mb-4">
               <h4 class="mb-2"><i class="fas fa-user-circle text-muted"></i> Student</h4>
               <p class="mb-4 text-lg font-medium">${doubt.question}</p>
               
               <div class="answers-container pl-4 mb-3">
                   ${answersHTML}
               </div>

               <form class="flex-row answer-form" data-id="${doubt._id}">
                   <input type="text" required placeholder="Type your answer..." class="flex-grow form-control-sm">
                   <button type="submit" class="btn btn-sm btn-outline">Reply</button>
               </form>
            </div>
            `
        }).join('');

        // Listen for answers
        document.querySelectorAll('.answer-form').forEach(form => {
             form.addEventListener('submit', async(e) => {
                 e.preventDefault();
                 const doubtId = form.getAttribute('data-id');
                 const answerInput = form.querySelector('input').value;
                 showLoader();
                 try {
                     await api.postAnswer(doubtId, answerInput);
                     showToast('Answer posted!');
                     await loadDoubts();
                 } catch(err) { showToast('Failed to post answer', 'error'); }
                 hideLoader();
             });
        });
    }

    function renderRecentItems() {
        const assignList = document.getElementById('dashboard-assignments-list');
        const notesList = document.getElementById('dashboard-notes-list');

        const pendings = currentData.assignments.filter(a => a.status !== 'completed').slice(0, 3);
        const recentNotes = currentData.notes.slice(-3).reverse();

        if (pendings.length) {
            assignList.innerHTML = pendings.map(a => `<li><b>${a.title}</b> <small class="text-warning ml-2">Due soon</small></li>`).join('');
        }
        if (recentNotes.length) {
            notesList.innerHTML = recentNotes.map(n => `<li><a href="${n.fileLink}" target="_blank"><i class="fas fa-file-pdf"></i> ${n.title}</a></li>`).join('');
        }
    }


    // === Form Setup & Validation ===
    function setupForms() {
        // Login & Signup
        $('#form-login').on('submit', async (e) => {
            e.preventDefault();
            const $email = $('#login-email');
            const $pass = $('#login-password');
            
            // Clear previous invalid states
            $email.removeClass('invalid');
            $pass.removeClass('invalid');
            
            // Validate form manually
            if (!$email.val() || !$email[0].validity.valid) {
                $email.addClass('invalid');
                showToast('Please enter a valid email address', 'error');
                return;
            }
            
            if (!$pass.val() || $pass.val().length < 1) {
                $pass.addClass('invalid');
                showToast('Please enter your password', 'error');
                return;
            }

            showLoader();
            try {
                const response = await api.login($email.val(), $pass.val());
                // Store user name from response or use email as fallback
                currentUser = response?.name || $email.val().split('@')[0] || 'Student';
                $('#current-user-name').text(currentUser);
                showToast('Login successful', 'success');
                showApp();
                switchView('view-dashboard');
                // Reset form
                e.target.reset();
            } catch (err) {
                showToast(err.message || 'Login failed', 'error');
            }
            hideLoader();
        });

        $('#form-signup').on('submit', async (e) => {
            e.preventDefault();
            const $name = $('#signup-name');
            const $email = $('#signup-email');
            const $pass = $('#signup-password');
            
            // Clear previous invalid states
            $name.removeClass('invalid');
            $email.removeClass('invalid');
            $pass.removeClass('invalid');
            
            // Validate form manually
            if (!$name.val() || $name.val().length < 2) {
                $name.addClass('invalid');
                showToast('Name must be at least 2 characters', 'error');
                return;
            }
            
            if (!$email.val() || !$email[0].validity.valid) {
                $email.addClass('invalid');
                showToast('Please enter a valid email address', 'error');
                return;
            }
            
            if (!$pass.val() || $pass.val().length < 6) {
                $pass.addClass('invalid');
                showToast('Password must be at least 6 characters', 'error');
                return;
            }

            showLoader();
            try {
                await api.signup($name.val(), $email.val(), $pass.val());
                showToast('Account created! Please log in.', 'success');
                // Reset form and switch to login
                e.target.reset();
                $('#tab-login').click(); // switch to login tab
            } catch (err) {
                showToast(err.message || 'Signup failed', 'error');
            }
            hideLoader();
        });

        // Subject
        document.getElementById('form-add-subject').addEventListener('submit', async (e) => {
             e.preventDefault();
             const name = document.getElementById('subject-name').value;
             showLoader();
             try {
                 await api.createSubject(name);
                 showToast('Subject created!', 'success');
                 document.getElementById('subject-name').value = '';
                 document.getElementById('subject-form-container').classList.add('hidden');
                 await loadSubjects();
             } catch(err) { showToast('Failed to create subject', 'error'); }
             hideLoader();
        });

        // Notes
        document.getElementById('form-add-note').addEventListener('submit', async (e) => {
             e.preventDefault();
             const title = document.getElementById('note-title').value;
             const link = document.getElementById('note-link').value;
             const subjectId = document.getElementById('note-subject').value;

             if(!subjectId) return showToast('Please select a subject', 'error');
             
             showLoader();
             try {
                 await api.createNote(title, link, subjectId);
                 showToast('Note uploaded!', 'success');
                 e.target.reset();
                 document.getElementById('note-form-container').classList.add('hidden');
                 await loadNotes();
                 renderNotesGrid(currentData.notes);
             } catch(err) { showToast('Failed to upload note', 'error'); }
             hideLoader();
        });

        // Assignment
        document.getElementById('form-add-assignment').addEventListener('submit', async (e) => {
             e.preventDefault();
             const title = document.getElementById('assign-title').value;
             const deadline = document.getElementById('assign-deadline').value;
             const subjectId = document.getElementById('assign-subject').value;

             if(!subjectId) return showToast('Please select a subject', 'error');

             showLoader();
             try {
                  await api.createAssignment(title, new Date(deadline).toISOString(), subjectId);
                  showToast('Assignment created!', 'success');
                  e.target.reset();
                  document.getElementById('assignment-form-container').classList.add('hidden');
                  await loadAssignments();
             } catch(err) { showToast('Failed to create assignment', 'error'); }
             hideLoader();
        });

        // Doubt
        document.getElementById('form-add-doubt').addEventListener('submit', async (e) => {
             e.preventDefault();
             const q = document.getElementById('doubt-question').value;
             showLoader();
             try {
                  await api.postDoubt(q);
                  showToast('Doubt posted!');
                  e.target.reset();
                  await loadDoubts();
             } catch(err) { showToast('Failed to post doubt', 'error'); }
             hideLoader();
        });

        // Logout
        document.getElementById('btn-logout').addEventListener('click', async () => {
             showLoader();
             try {
                 await api.logout();
             } catch(e) {} // ignore errors on logout
             showAuth();
             hideLoader();
             showToast('Logged out successfully');
        });
    }

    // === Helpers, Modals & UI Effects ===
    function showApp() {
         DOM.nav.classList.remove('hidden');
         DOM.navProfile.classList.remove('hidden');
         switchView('view-dashboard');
    }

    function showAuth() {
         DOM.nav.classList.add('hidden');
         DOM.navProfile.classList.add('hidden');
         switchView('view-auth');
    }

    function showLoader() { DOM.loader.classList.remove('hidden'); }
    function hideLoader() { DOM.loader.classList.add('hidden'); }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i> <span>${message}</span>`;
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
            tabLogin.classList.add('active'); tabSignup.classList.remove('active');
            formLogin.classList.remove('hidden'); formSignup.classList.add('hidden');
        });
        tabSignup.addEventListener('click', () => {
            tabSignup.classList.add('active'); tabLogin.classList.remove('active');
            formSignup.classList.remove('hidden'); formLogin.classList.add('hidden');
        });
    }

    function setupModals() {
        // Toggles for forms
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

    function setupFilters() {
        // Notes Search Filter
        document.getElementById('search-notes-input').addEventListener('input', (e) => {
             const term = e.target.value.toLowerCase();
             const filtered = currentData.notes.filter(n => {
                  const sub = currentData.subjects.find(s => s._id === n.subjectId);
                  const subName = sub ? sub.subjectName.toLowerCase() : '';
                  return n.title.toLowerCase().includes(term) || subName.includes(term);
             });
             renderNotesGrid(filtered);
        });

        // Assignment Status Filter
        document.querySelectorAll('.filter-btn').forEach(btn => {
             btn.addEventListener('click', (e) => {
                  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                  e.target.classList.add('active');
                  renderAssignments(e.target.getAttribute('data-filter'));
             });
        });
    }

    // === Study Planner (Local Storage) ===
    function setupPlanner() {
        const form = document.getElementById('form-planner');
        const list = document.getElementById('planner-tasks');
        const dateFilter = document.getElementById('planner-filter-date');

        // Set today as default
        const todayStr = new Date().toISOString().split('T')[0];
        document.getElementById('task-date').value = todayStr;
        dateFilter.value = todayStr;

        renderPlanner();

        form.addEventListener('submit', (e) => {
             e.preventDefault();
             if(!form.checkValidity()) return;
             
             const desc = document.getElementById('task-desc').value;
             const date = document.getElementById('task-date').value;
             const tasks = getPlannerTasks();
             
             tasks.push({ id: Date.now().toString(), desc, date, completed: false });
             localStorage.setItem('studybuddy_planner', JSON.stringify(tasks));
             
             document.getElementById('task-desc').value = '';
             renderPlanner();
             showToast('Planner task added!', 'success');
        });

        dateFilter.addEventListener('change', renderPlanner);

        function renderPlanner() {
             const tasks = getPlannerTasks();
             const selectedDate = dateFilter.value;
             const filtered = tasks.filter(t => t.date === selectedDate);
             
             if(!filtered.length) {
                 list.innerHTML = `<li class="empty-state">No tasks planned for this date.</li>`;
                 return;
             }
             
             list.innerHTML = filtered.map(t => `
                 <li class="task-item ${t.completed ? 'completed' : ''}">
                     <span>${t.desc}</span>
                     <div class="task-actions">
                         <button class="btn-toggle-task" data-id="${t.id}"><i class="fas fa-check-circle"></i></button>
                         <button class="btn-delete" data-id="${t.id}"><i class="fas fa-times-circle"></i></button>
                     </div>
                 </li>
             `).join('');

             list.querySelectorAll('.btn-toggle-task').forEach(btn => {
                  btn.addEventListener('click', (e) => {
                       const id = e.currentTarget.getAttribute('data-id');
                       const allTasks = getPlannerTasks();
                       const task = allTasks.find(tx => tx.id === id);
                       task.completed = !task.completed;
                       localStorage.setItem('studybuddy_planner', JSON.stringify(allTasks));
                       renderPlanner();
                  });
             });

             list.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                     const id = e.currentTarget.getAttribute('data-id');
                     const allTasks = getPlannerTasks().filter(tx => tx.id !== id);
                     localStorage.setItem('studybuddy_planner', JSON.stringify(allTasks));
                     renderPlanner();
                });
           });
        }

        function getPlannerTasks() {
             return JSON.parse(localStorage.getItem('studybuddy_planner') || '[]');
        }
    }
});
