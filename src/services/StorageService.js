export const CONFIG = {
    FONTS: ['Inter', 'Comic Sans MS', 'Courier New', 'Georgia', 'Times New Roman', 'Roboto', 'Outfit', 'Google Sans'],
    COLORS_NOTE: ['#fef08a', '#bae6fd', '#bbf7d0', '#fbcfe8', '#e2e8f0', '#ffffff'],
    COLORS_BRUSH: ['#0f172a', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#ffffff'],
    COLORS_TEXT: ['#0f172a', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#ffffff'],
    MODES: { SELECT: 'SELECT', DRAW: 'DRAW', ERASE: 'ERASE', TEXT: 'TEXT' },
    DB_NAME: 'BrainstormProV2DB',
    DB_STORE: 'projects_v2',
    DEFAULT_NOTE_KEY: 'bs_pro_v2_note_defaults'
};

export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

export const StorageService = {
    db: null,
    init() {
        if (this.db) return Promise.resolve(this.db);
        return new Promise((resolve, reject) => {
            const req = window.indexedDB.open(CONFIG.DB_NAME, 1);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => { this.db = req.result; resolve(this.db); };
            req.onupgradeneeded = (e) => { e.target.result.createObjectStore(CONFIG.DB_STORE); };
        });
    },
    async saveState(id, data) {
        try {
            const db = await this.init();
            const tx = db.transaction(CONFIG.DB_STORE, 'readwrite');
            tx.objectStore(CONFIG.DB_STORE).put(data, id);
        } catch (e) {
            localStorage.setItem('bs_pro_v2_' + id, JSON.stringify(data));
        }
    },
    async loadState(id) {
        try {
            const db = await this.init();
            return new Promise(resolve => {
                const tx = db.transaction(CONFIG.DB_STORE, 'readonly');
                const req = tx.objectStore(CONFIG.DB_STORE).get(id);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return JSON.parse(localStorage.getItem('bs_pro_v2_' + id) || "null");
        }
    },
    exportProject(stateData, filename = 'brainstorm_project.json') {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(stateData));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", filename);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    },
    importProject(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (err) {
                    reject("Invalid JSON file");
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },
    saveNoteDefaults(defaults) {
        try {
            localStorage.setItem(CONFIG.DEFAULT_NOTE_KEY, JSON.stringify(defaults));
        } catch (e) {
            console.warn('Failed to save note defaults', e);
        }
    },
    loadNoteDefaults() {
        try {
            const raw = localStorage.getItem(CONFIG.DEFAULT_NOTE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }
};
