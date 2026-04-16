// angular-app.js
const angularApp = angular.module('StudyBuddyApp', []);

angularApp.controller('MainController', ['$scope', '$timeout', function($scope, $timeout) {
    // --- Reactive Data Store (populated via syncAngularData bridge) ---
    $scope.plannerTasks = [];
    $scope.doubts = [];
    $scope.assignments = [];
    $scope.subjects = [];
    $scope.notes = [];
    $scope.assignmentFilterStatus = 'all';
    $scope.noteSearchTerm = '';

    $scope.plannerFilterDate = new Date().toISOString().split('T')[0];
    $scope.newTask = { desc: '', date: new Date().toISOString().split('T')[0] };

    // --- Bridge: app.js calls this to push data into Angular scope ---
    window.syncAngularData = function(type, data) {
        $timeout(() => {
            switch (type) {
                case 'subjects':    $scope.subjects = data; break;
                case 'notes':       $scope.notes = data; break;
                case 'assignments': $scope.assignments = data; break;
                case 'doubts':      $scope.doubts = data; break;
                case 'planner':     $scope.plannerTasks = data; break;
            }
        });
    };

    // --- Helpers ---
    $scope.getSubjectName = function(subjectId) {
        if (!subjectId) return 'Unknown';
        const sId = (typeof subjectId === 'object') ? (subjectId._id || subjectId.id) : subjectId;
        const subject = $scope.subjects.find(s => s._id === sId);
        return subject ? subject.subjectName : 'Unknown Subject';
    };

    $scope.formatDate = function(dateStr) {
        return new Date(dateStr).toLocaleString();
    };

    // --- Dashboard ---
    $scope.getRecentAssignments = function() {
        return ($scope.assignments || [])
            .filter(a => a.status !== 'complete')
            .slice(0, 3);
    };

    $scope.getRecentNotes = function() {
        return ($scope.notes || []).slice(-3).reverse();
    };

    // --- Subjects CRUD ---
    $scope.editingSubject = null;
    $scope.editSubjectData = { name: '' };

    $scope.startEditSubject = function(sub) {
        $scope.editingSubject = sub._id;
        $scope.editSubjectData = { name: sub.subjectName };
    };

    $scope.cancelEditSubject = function() {
        $scope.editingSubject = null;
        $scope.editSubjectData = { name: '' };
    };

    $scope.saveEditSubject = async function(subjectId) {
        if (!$scope.editSubjectData.name || !$scope.editSubjectData.name.trim()) {
            if (window.showToast) window.showToast('Subject name is required', 'error');
            return;
        }
        if (window.showLoader) window.showLoader();
        try {
            await window.api.updateSubject(subjectId, $scope.editSubjectData.name.trim());
            if (window.showToast) window.showToast('Subject renamed!', 'success');
            $scope.editingSubject = null;
            $scope.editSubjectData = { name: '' };
            if (window.loadViewData) await window.loadViewData('view-subjects');
        } catch (err) {
            if (window.showToast) window.showToast(err.message || 'Error renaming subject', 'error');
        } finally {
            if (window.hideLoader) window.hideLoader();
        }
    };

    $scope.deleteSubject = async function(subjectId) {
        if (!confirm('Delete this subject? Notes linked to it may be affected.')) return;
        if (window.showLoader) window.showLoader();
        try {
            await window.api.deleteSubject(subjectId);
            if (window.showToast) window.showToast('Subject deleted', 'info');
            if (window.loadViewData) await window.loadViewData('view-subjects');
        } catch (err) {
            if (window.showToast) window.showToast(err.message || 'Error deleting subject', 'error');
        } finally {
            if (window.hideLoader) window.hideLoader();
        }
    };

    // --- Assignments ---
    $scope.statusFilter = function(assignment) {
        if ($scope.assignmentFilterStatus === 'all') return true;
        if ($scope.assignmentFilterStatus === 'complete') return assignment.status === 'complete';
        if ($scope.assignmentFilterStatus === 'incomplete') return assignment.status !== 'complete';
        return true;
    };

    $scope.setAssignmentFilter = function(status) {
        $scope.assignmentFilterStatus = status;
    };

    // --- Assignment Edit ---
    $scope.editingAssignment = null;
    $scope.editAssignData = { title: '', subjectId: '', deadline: '' };

    $scope.startEditAssignment = function(assign) {
        $scope.editingAssignment = assign._id;
        const subId = (typeof assign.subjectId === 'object')
            ? (assign.subjectId._id || assign.subjectId.id)
            : assign.subjectId;
        // Convert ISO deadline → datetime-local format (YYYY-MM-DDTHH:mm)
        let dl = '';
        if (assign.deadline) {
            dl = new Date(assign.deadline).toISOString().slice(0, 16);
        }
        $scope.editAssignData = { title: assign.title, subjectId: subId, deadline: dl };
    };

    $scope.cancelEditAssignment = function() {
        $scope.editingAssignment = null;
        $scope.editAssignData = { title: '', subjectId: '', deadline: '' };
    };

    $scope.saveEditAssignment = async function(assignId) {
        if (!$scope.editAssignData.title || !$scope.editAssignData.subjectId || !$scope.editAssignData.deadline) {
            if (window.showToast) window.showToast('All fields are required', 'error');
            return;
        }
        if (window.showLoader) window.showLoader();
        try {
            const deadlineISO = new Date($scope.editAssignData.deadline).toISOString();
            await window.api.updateAssignment(
                assignId,
                $scope.editAssignData.title,
                deadlineISO,
                $scope.editAssignData.subjectId
            );
            if (window.showToast) window.showToast('Assignment updated!', 'success');
            $scope.editingAssignment = null;
            $scope.editAssignData = { title: '', subjectId: '', deadline: '' };
            if (window.loadViewData) await window.loadViewData('view-assignments');
        } catch (err) {
            if (window.showToast) window.showToast(err.message || 'Error updating assignment', 'error');
        } finally {
            if (window.hideLoader) window.hideLoader();
        }
    };

    $scope.completeAssignment = async function(id) {
        if (window.showLoader) window.showLoader();
        try {
            await window.api.updateAssignmentStatus(id, 'complete');
            if (window.showToast) window.showToast('Assignment marked completed!', 'success');
            if (window.loadViewData) await window.loadViewData('view-assignments');
        } catch (err) {
            if (window.showToast) window.showToast('Error updating assignment', 'error');
        } finally {
            if (window.hideLoader) window.hideLoader();
        }
    };

    $scope.deleteAssignment = async function(id) {
        if (!confirm('Are you sure you want to delete this assignment?')) return;
        if (window.showLoader) window.showLoader();
        try {
            await window.api.deleteAssignment(id);
            if (window.showToast) window.showToast('Assignment deleted', 'info');
            if (window.loadViewData) await window.loadViewData('view-assignments');
        } catch (err) {
            if (window.showToast) window.showToast('Error deleting assignment', 'error');
        } finally {
            if (window.hideLoader) window.hideLoader();
        }
    };

    // --- Notes Filter ---
    $scope.notesFilter = function(note) {
        if (!$scope.noteSearchTerm) return true;
        const term = $scope.noteSearchTerm.toLowerCase();
        const subjectName = $scope.getSubjectName(note.subjectId).toLowerCase();
        return note.title.toLowerCase().includes(term) || subjectName.includes(term);
    };

    // --- Notes Edit/Delete ---
    $scope.editingNote = null;
    $scope.editNoteData = { title: '', fileLink: '', subjectId: '' };

    $scope.startEditNote = function(note) {
        $scope.editingNote = note._id;
        $scope.editNoteData = {
            title: note.title,
            fileLink: note.fileLink,
            subjectId: (typeof note.subjectId === 'object') ? (note.subjectId._id || note.subjectId.id) : note.subjectId
        };
    };

    $scope.cancelEditNote = function() {
        $scope.editingNote = null;
        $scope.editNoteData = { title: '', fileLink: '', subjectId: '' };
    };

    $scope.saveEditNote = async function(noteId) {
        if (!$scope.editNoteData.title || !$scope.editNoteData.subjectId) {
            if (window.showToast) window.showToast('Title and subject are required', 'error');
            return;
        }
        if (window.showLoader) window.showLoader();
        try {
            await window.api.updateNote(noteId, $scope.editNoteData.title, $scope.editNoteData.fileLink, $scope.editNoteData.subjectId);
            if (window.showToast) window.showToast('Note updated!', 'success');
            $scope.editingNote = null;
            $scope.editNoteData = { title: '', fileLink: '', subjectId: '' };
            if (window.loadViewData) await window.loadViewData('view-subjects');
        } catch (err) {
            if (window.showToast) window.showToast(err.message || 'Error updating note', 'error');
        } finally {
            if (window.hideLoader) window.hideLoader();
        }
    };

    $scope.deleteNote = async function(noteId) {
        if (!confirm('Are you sure you want to delete this note?')) return;
        if (window.showLoader) window.showLoader();
        try {
            await window.api.deleteNote(noteId);
            if (window.showToast) window.showToast('Note deleted', 'info');
            if (window.loadViewData) await window.loadViewData('view-subjects');
        } catch (err) {
            if (window.showToast) window.showToast(err.message || 'Error deleting note', 'error');
        } finally {
            if (window.hideLoader) window.hideLoader();
        }
    };

    // --- Doubts ---
    $scope.editingDoubt = null;
    $scope.editDoubtData = { question: '' };

    $scope.startEditDoubt = function(doubt) {
        $scope.editingDoubt = doubt._id;
        $scope.editDoubtData = { question: doubt.question };
    };

    $scope.cancelEditDoubt = function() {
        $scope.editingDoubt = null;
        $scope.editDoubtData = { question: '' };
    };

    $scope.saveEditDoubt = async function(doubtId) {
        if (!$scope.editDoubtData.question || !$scope.editDoubtData.question.trim()) {
            if (window.showToast) window.showToast('Question is required', 'error');
            return;
        }
        if (window.showLoader) window.showLoader();
        try {
            await window.api.updateDoubt(doubtId, $scope.editDoubtData.question.trim());
            if (window.showToast) window.showToast('Doubt updated!', 'success');
            $scope.editingDoubt = null;
            $scope.editDoubtData = { question: '' };
            if (window.loadViewData) await window.loadViewData('view-doubts');
        } catch (err) {
            if (window.showToast) window.showToast(err.message || 'Error updating doubt', 'error');
        } finally {
            if (window.hideLoader) window.hideLoader();
        }
    };

    $scope.postAnswer = async function(doubtId, answerText) {
        if (!answerText || !answerText.trim()) return;
        try {
            await window.api.postAnswer(doubtId, answerText);
            if (window.showToast) window.showToast('Answer posted!', 'success');
            if (window.loadViewData) await window.loadViewData('view-doubts');
        } catch (err) {
            if (window.showToast) window.showToast('Failed to post answer', 'error');
        }
    };

    $scope.deleteDoubt = async function(doubtId) {
        if (!confirm('Delete this doubt and all its answers?')) return;
        if (window.showLoader) window.showLoader();
        try {
            await window.api.deleteDoubt(doubtId);
            if (window.showToast) window.showToast('Doubt deleted', 'info');
            if (window.loadViewData) await window.loadViewData('view-doubts');
        } catch (err) {
            if (window.showToast) window.showToast(err.message || 'Error deleting doubt', 'error');
        } finally {
            if (window.hideLoader) window.hideLoader();
        }
    };

    // --- Study Planner (localStorage) ---
    $scope.initPlanner = function() {
        const saved = localStorage.getItem('studybuddy_planner');
        if (saved) {
            try { $scope.plannerTasks = JSON.parse(saved); } catch (e) { $scope.plannerTasks = []; }
        }
    };

    $scope.addTask = function() {
        if (!$scope.newTask.desc || !$scope.newTask.date) {
            if (window.showToast) window.showToast('Please enter a task description and date', 'error');
            return;
        }
        $scope.plannerTasks.push({
            id: Date.now().toString(),
            desc: $scope.newTask.desc,
            date: $scope.newTask.date,
            completed: false
        });
        $scope.savePlanner();
        $scope.newTask.desc = '';
        if (window.showToast) window.showToast('Task added!', 'success');
    };

    $scope.toggleTask = function(task) {
        task.completed = !task.completed;
        $scope.savePlanner();
    };

    $scope.deleteTask = function(taskId) {
        $scope.plannerTasks = $scope.plannerTasks.filter(t => t.id !== taskId);
        $scope.savePlanner();
    };

    $scope.savePlanner = function() {
        localStorage.setItem('studybuddy_planner', JSON.stringify($scope.plannerTasks));
    };

    // --- Initialize ---
    $scope.initPlanner();
}]);
