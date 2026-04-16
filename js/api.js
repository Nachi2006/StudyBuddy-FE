// api.js

const API_BASE_URL = 'http://localhost:4000';

/**
 * Helper to fetch data with common configuration
 */
async function fetchApi(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;

    // Build config WITHOUT spreading options (that would overwrite our stringified body)
    const config = {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        credentials: 'include'
    };

    // Stringify body separately so the spread can't clobber it
    if (options.body) {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, config);

        let data = null;
        try {
            data = await response.json();
        } catch (e) {
            // non-JSON response (e.g. 204 No Content)
        }

        if (!response.ok) {
            throw { status: response.status, message: data?.error || data?.message || 'Something went wrong' };
        }

        return data;
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            throw {
                status: 0,
                message: 'Cannot reach the backend. Make sure the server is running on localhost:4000 and CORS is configured.'
            };
        }
        throw error;
    }
}

const api = {
    // Auth
    signup: (name, email, password) => fetchApi('/signup', { method: 'POST', body: { name, email, password } }),
    login: (email, password) => fetchApi('/login', { method: 'POST', body: { email, password } }),
    logout: () => fetchApi('/logout', { method: 'POST' }),
    getMe: () => fetchApi('/me'),

    // Dashboard
    getDashboard: () => fetchApi('/dashboard'),

    // Subjects
    getSubjects: () => fetchApi('/subjects'),
    createSubject: (subjectName) => fetchApi('/subjects', { method: 'POST', body: { subjectName } }),
    getSubject: (id) => fetchApi(`/subjects/${id}`),
    updateSubject: (id, subjectName) => fetchApi(`/subjects/${id}`, { method: 'PUT', body: { subjectName } }),
    deleteSubject: (id) => fetchApi(`/subjects/${id}`, { method: 'DELETE' }),

    // Notes
    getNotes: () => fetchApi('/notes'),
    getNoteById: (id) => fetchApi(`/notes/${id}`),
    createNote: (title, fileLink, subjectId) => fetchApi('/notes', { method: 'POST', body: { title, fileLink, subjectId } }),
    updateNote: (id, title, fileLink, subjectId) => fetchApi(`/notes/${id}`, { method: 'PUT', body: { title, fileLink, subjectId } }),
    deleteNote: (id) => fetchApi(`/notes/${id}`, { method: 'DELETE' }),

    // Assignments
    getAssignments: () => fetchApi('/assignments'),
    createAssignment: (title, deadline, subjectId) => fetchApi('/assignments', { method: 'POST', body: { title, deadline, subjectId } }),
    updateAssignmentStatus: (id, status) => fetchApi(`/assignments/${id}`, { method: 'PUT', body: { status } }),
    updateAssignment: (id, title, deadline, subjectId) => fetchApi(`/assignments/${id}`, { method: 'PUT', body: { title, deadline, subjectId } }),
    deleteAssignment: (id) => fetchApi(`/assignments/${id}`, { method: 'DELETE' }),

    // Doubts
    getDoubts: () => fetchApi('/doubts'),
    postDoubt: (question) => fetchApi('/doubts', { method: 'POST', body: { question } }),
    updateDoubt: (id, question) => fetchApi(`/doubts/${id}`, { method: 'PUT', body: { question } }),
    deleteDoubt: (id) => fetchApi(`/doubts/${id}`, { method: 'DELETE' }),
    postAnswer: (doubtId, answer) => fetchApi(`/doubts/${doubtId}/answers`, { method: 'POST', body: { answer } })
};

// Export to global scope
window.api = api;
