/**
 * ScholarDB — Central Data Architecture
 * Manages all localStorage stores for ScholarAI
 */
const ScholarDB = (() => {
    const STORES = ['subjects', 'notes', 'assignments', 'timetable', 'events', 'groupMembers', 'settings', 'studyGroup', 'notifications'];
    const DB_PREFIX = 'scholarai_';

    // ── Helpers ──────────────────────────────────────────
    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function get(store) {
        try {
            const raw = localStorage.getItem(DB_PREFIX + store);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    function set(store, data) {
        localStorage.setItem(DB_PREFIX + store, JSON.stringify(data));
    }

    // ── Sample Data ─────────────────────────────────────
    const SUBJECT_COLORS = {
        physics: '#7B3FA0',
        chemistry: '#C4853A',
        math: '#4A7C59',
        english: '#C0392B',
        biology: '#5B7BA0'
    };

    function defaultSubjects() {
        return [];
    }

    function defaultNotes() {
        return [];
    }

    function defaultAssignments() {
        return [];
    }

    function defaultTimetable() {
        return [];
    }

    function defaultEvents() {
        return [];
    }

    function defaultSettings() {
        return {
            name: 'Scholar',
            class: 'Class 11',
            groqKey: '',
            ariaPersonality: 'warm',
            avatarColor: '#7B3FA0',
            avatarPhoto: '',
            profileJoinedAt: Date.now(),
            notifications: {
                classReminders: true,
                assignmentReminders: true,
                weeklyDigest: true
            }
        };
    }

    // ── Init / Seed ─────────────────────────────────────
    function init() {
        if (!localStorage.getItem(DB_PREFIX + 'initialized')) {
            set('subjects', defaultSubjects());
            set('notes', defaultNotes());
            set('assignments', defaultAssignments());
            set('timetable', defaultTimetable());
            set('events', defaultEvents());
            set('groupMembers', []);
            set('settings', defaultSettings());
            set('studyGroup', null);
            set('notifications', []);
            localStorage.setItem(DB_PREFIX + 'initialized', 'true');
        }
    }

    // ── CRUD Helpers ────────────────────────────────────
    function getAll(store) {
        return get(store) || [];
    }

    function getById(store, id) {
        return getAll(store).find(item => item.id === id) || null;
    }

    function add(store, item) {
        const items = getAll(store);
        if (!item.id) item.id = uid();
        items.push(item);
        set(store, items);
        return item;
    }

    function update(store, id, updates) {
        const items = getAll(store);
        const idx = items.findIndex(i => i.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...updates };
        set(store, items);
        return items[idx];
    }

    function remove(store, id) {
        const items = getAll(store).filter(i => i.id !== id);
        set(store, items);
    }

    function getSettings() {
        return get('settings') || defaultSettings();
    }

    function updateSettings(updates) {
        const s = getSettings();
        const merged = { ...s, ...updates };
        set('settings', merged);
        return merged;
    }

    function getSubjectById(id) {
        return getById('subjects', id);
    }

    function clearAll() {
        STORES.forEach(s => localStorage.removeItem(DB_PREFIX + s));
        localStorage.removeItem(DB_PREFIX + 'initialized');
        localStorage.removeItem(DB_PREFIX + 'onboarding_complete');
    }

    function exportAll() {
        const data = {};
        STORES.forEach(s => { data[s] = get(s); });
        return data;
    }

    function importAll(data) {
        STORES.forEach(s => {
            if (data[s] !== undefined) set(s, data[s]);
        });
    }

    function isOnboarded() {
        return localStorage.getItem(DB_PREFIX + 'onboarding_complete') === 'true';
    }

    function setOnboarded() {
        localStorage.setItem(DB_PREFIX + 'onboarding_complete', 'true');
    }

    function getStudyGroup() {
        return get('studyGroup');
    }

    function setStudyGroup(group) {
        set('studyGroup', group);
    }

    function addNotification(notif) {
        const notifs = getAll('notifications');
        notifs.unshift({ id: uid(), read: false, timestamp: Date.now(), ...notif });
        if (notifs.length > 50) notifs.length = 50;
        set('notifications', notifs);
    }

    function markAllNotificationsRead() {
        const notifs = getAll('notifications').map(n => ({ ...n, read: true }));
        set('notifications', notifs);
    }

    return {
        init, uid, getAll, getById, add, update, remove,
        getSettings, updateSettings, getSubjectById,
        clearAll, exportAll, importAll,
        isOnboarded, setOnboarded,
        getStudyGroup, setStudyGroup,
        addNotification, markAllNotificationsRead
    };
})();
