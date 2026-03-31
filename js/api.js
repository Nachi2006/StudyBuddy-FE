// api.js

const API_BASE_URL = 'http://localhost:4000';

/**
 * Helper to fetch data with common configuration
 */
async function fetchApi(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };

    const config = {
        method: options.method || 'GET',
        headers: options.headers ? { ...defaultHeaders, ...options.headers } : defaultHeaders,
        credentials: 'include', // Very important for sending/receiving session cookies
        ...options
    };

    if (options.body) {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, config);
        
        let data;
        try {
            data = await response.json();
        } catch(e) {
            data = null; // Some responses might not have JSON body
        }

        if (!response.ok) {
            throw { status: response.status, message: data?.error || data?.message || 'Something went wrong' };
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        
        // Handle CORS / Network offline errors
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
             throw { 
                 status: 0, 
                 message: 'Failed to fetch. Make sure your local Backend (localhost:4000) is running AND has CORS configured (origin must match frontend URL, credentials set to true).'
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

    // Dashboard
    getDashboard: () => fetchApi('/dashboard'),

    // Subjects
    getSubjects: () => fetchApi('/subjects'),
    createSubject: (subjectName) => fetchApi('/subjects', { method: 'POST', body: { subjectName } }),
    getSubject: (id) => fetchApi(`/subjects/${id}`),

    // Notes
    getNotes: () => fetchApi('/notes'),
    createNote: (title, fileLink, subjectId) => fetchApi('/notes', { method: 'POST', body: { title, fileLink, subjectId } }),

    // Assignments
    getAssignments: () => fetchApi('/assignments'),
    createAssignment: (title, deadline, subjectId) => fetchApi('/assignments', { method: 'POST', body: { title, deadline, subjectId } }),
    updateAssignmentStatus: (id, status) => fetchApi(`/assignments/${id}`, { method: 'PUT', body: { status } }),
    deleteAssignment: (id) => fetchApi(`/assignments/${id}`, { method: 'DELETE' }),

    // Doubts
    getDoubts: () => fetchApi('/doubts'),
    postDoubt: (question) => fetchApi('/doubts', { method: 'POST', body: { question } }),
    postAnswer: (doubtId, answer) => fetchApi(`/doubts/${doubtId}/answers`, { method: 'POST', body: { answer } })
};

// Export to global scope
window.api = api;
