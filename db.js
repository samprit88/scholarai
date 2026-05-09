/**
 * ScholarDB — Central Data Architecture
 * Manages all localStorage stores for ScholarAI
 */
const ScholarDB = (() => {
    const STORES = ['subjects', 'notes', 'assignments', 'timetable', 'events', 'smartCalendarEvents', 'groupMembers', 'settings', 'studyGroup', 'notifications'];
    const DB_PREFIX = 'scholarai_';
    const CLOUD_STORES = ['assignments', 'notes', 'timetable'];
    const cloudCache = { assignments: [], notes: [], timetable: [] };
    let cloudReady = false;
    let cloudUser = null;
    let cloudUnsubs = [];

    // ── Helpers ──────────────────────────────────────────
    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function get(store) {
        if (CLOUD_STORES.includes(store)) return cloudCache[store] || [];
        try {
            const raw = localStorage.getItem(DB_PREFIX + store);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    function set(store, data) {
        if (CLOUD_STORES.includes(store)) {
            cloudCache[store] = Array.isArray(data) ? data : [];
            return;
        }
        localStorage.setItem(DB_PREFIX + store, JSON.stringify(data));
    }

    function getFirestore() {
        return window.ScholarFirebase?.firestore || null;
    }

    function getUserBase() {
        const db = getFirestore();
        const uid = cloudUser?.uid || window.ScholarFirebase?.auth?.currentUser?.uid;
        return db && uid ? db.collection('users').doc(uid) : null;
    }

    function normalizeAssignment(item) {
        return {
            ...item,
            subjectId: item.subjectId || item.subject || '',
            subject: item.subject || item.subjectId || '',
            dueDate: item.dueDate || item.deadline || '',
            deadline: item.deadline || item.dueDate || '',
            status: item.status || 'todo'
        };
    }

    function normalizeNote(item) {
        return {
            ...item,
            subjectId: item.subjectId || item.subject || '',
            subject: item.subject || item.subjectId || '',
            dateCreated: item.dateCreated || item.createdAt || Date.now(),
            createdAt: item.createdAt || item.dateCreated || Date.now()
        };
    }

    function normalizeCloudItem(store, id, data) {
        const item = { id, ...data };
        if (store === 'assignments') return normalizeAssignment(item);
        if (store === 'notes') return normalizeNote(item);
        return item;
    }

    function toFirestoreData(store, item) {
        if (store === 'assignments') {
            return {
                ...item,
                title: item.title || '',
                subject: item.subject || item.subjectId || '',
                deadline: item.deadline || item.dueDate || '',
                status: item.status || 'todo'
            };
        }
        if (store === 'notes') {
            return {
                ...item,
                title: item.title || '',
                subject: item.subject || item.subjectId || '',
                content: item.content || '',
                createdAt: item.createdAt || item.dateCreated || Date.now()
            };
        }
        return item;
    }

    function refreshVisiblePage() {
        if (typeof renderCurrentPage === 'function') renderCurrentPage();
        if (typeof Notifications !== 'undefined') Notifications.updateBadge?.();
    }

    async function initCloud(user) {
        cloudUser = user || null;
        cloudReady = Boolean(cloudUser);
        cloudUnsubs.forEach(unsub => {
            try { unsub(); } catch (e) {}
        });
        cloudUnsubs = [];
        cloudCache.assignments = [];
        cloudCache.notes = [];
        cloudCache.timetable = [];
        if (!cloudUser || !getFirestore()) return;

        const base = getUserBase();
        await migrateLocalCloudData(base, cloudUser.uid);
        cloudUnsubs.push(base.collection('assignments').onSnapshot(snapshot => {
            cloudCache.assignments = snapshot.docs.map(doc => normalizeCloudItem('assignments', doc.id, doc.data()));
            refreshVisiblePage();
        }));
        cloudUnsubs.push(base.collection('notes').onSnapshot(snapshot => {
            cloudCache.notes = snapshot.docs.map(doc => normalizeCloudItem('notes', doc.id, doc.data()));
            refreshVisiblePage();
        }));
        cloudUnsubs.push(base.collection('timetable').doc('weeklySchedule').onSnapshot(doc => {
            const data = doc.exists ? doc.data() : {};
            cloudCache.timetable = Array.isArray(data.items) ? data.items : [];
            refreshVisiblePage();
        }));
    }

    async function migrateLocalCloudData(base, userId) {
        const marker = DB_PREFIX + 'firebase_migrated_' + userId;
        if (localStorage.getItem(marker) === 'true') return;
        const parseLocal = store => {
            try {
                const raw = localStorage.getItem(DB_PREFIX + store);
                return raw ? JSON.parse(raw) : [];
            } catch {
                return [];
            }
        };
        const batch = getFirestore().batch();
        parseLocal('assignments').forEach(item => {
            const normalized = normalizeAssignment({ ...item, id: item.id || uid() });
            batch.set(base.collection('assignments').doc(normalized.id), toFirestoreData('assignments', normalized), { merge: true });
        });
        parseLocal('notes').forEach(item => {
            const normalized = normalizeNote({ ...item, id: item.id || uid() });
            batch.set(base.collection('notes').doc(normalized.id), toFirestoreData('notes', normalized), { merge: true });
        });
        const timetable = parseLocal('timetable');
        if (Array.isArray(timetable) && timetable.length) {
            batch.set(base.collection('timetable').doc('weeklySchedule'), { items: timetable, updatedAt: Date.now() }, { merge: true });
        }
        await batch.commit().catch(() => {});
        localStorage.setItem(marker, 'true');
    }

    async function writeCloudStore(store) {
        const base = getUserBase();
        if (!base) return;
        if (store === 'timetable') {
            await base.collection('timetable').doc('weeklySchedule').set({
                items: cloudCache.timetable || [],
                updatedAt: Date.now()
            }, { merge: true });
        }
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

    function defaultSmartCalendarEvents() {
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
            set('smartCalendarEvents', defaultSmartCalendarEvents());
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
        const normalized = store === 'assignments' ? normalizeAssignment(item) : store === 'notes' ? normalizeNote(item) : item;
        items.push(normalized);
        set(store, items);
        const base = getUserBase();
        if (base && store === 'assignments') base.collection('assignments').doc(normalized.id).set(toFirestoreData(store, normalized), { merge: true });
        else if (base && store === 'notes') base.collection('notes').doc(normalized.id).set(toFirestoreData(store, normalized), { merge: true });
        else if (base && store === 'timetable') writeCloudStore('timetable');
        return normalized;
    }

    function update(store, id, updates) {
        const items = getAll(store);
        const idx = items.findIndex(i => i.id === id);
        if (idx === -1) return null;
        items[idx] = store === 'assignments' ? normalizeAssignment({ ...items[idx], ...updates }) : store === 'notes' ? normalizeNote({ ...items[idx], ...updates }) : { ...items[idx], ...updates };
        set(store, items);
        const base = getUserBase();
        if (base && store === 'assignments') base.collection('assignments').doc(id).set(toFirestoreData(store, items[idx]), { merge: true });
        else if (base && store === 'notes') base.collection('notes').doc(id).set(toFirestoreData(store, items[idx]), { merge: true });
        else if (base && store === 'timetable') writeCloudStore('timetable');
        return items[idx];
    }

    function remove(store, id) {
        const items = getAll(store).filter(i => i.id !== id);
        set(store, items);
        const base = getUserBase();
        if (base && store === 'assignments') base.collection('assignments').doc(id).delete();
        else if (base && store === 'notes') base.collection('notes').doc(id).delete();
        else if (base && store === 'timetable') writeCloudStore('timetable');
    }

    function getSettings() {
        const settings = get('settings') || defaultSettings();
        const user = cloudUser || window.ScholarFirebase?.auth?.currentUser;
        if (user) {
            return {
                ...settings,
                name: settings.name && settings.name !== 'Scholar' ? settings.name : (user.displayName || settings.name || 'Scholar'),
                avatarPhoto: settings.avatarPhoto || user.photoURL || ''
            };
        }
        return settings;
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
        initCloud,
        getSettings, updateSettings, getSubjectById,
        clearAll, exportAll, importAll,
        isOnboarded, setOnboarded,
        getStudyGroup, setStudyGroup,
        addNotification, markAllNotificationsRead
    };
})();
