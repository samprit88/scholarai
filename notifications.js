/**
 * Notifications Module for ScholarAI
 * Handles browser notifications, reminders, and in-app notification UI
 */
const Notifications = (() => {
    let permissionGranted = false;
    let classCheckInterval = null;
    let overdueCheckInterval = null;

    function init() {
        requestPermission();
        checkAssignmentReminders();
        startClassReminder();
        startOverdueCheck();
    }

    async function requestPermission() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') {
            permissionGranted = true;
        } else if (Notification.permission !== 'denied') {
            const result = await Notification.requestPermission();
            permissionGranted = result === 'granted';
        }
    }

    function sendBrowserNotification(title, body, icon) {
        if (!permissionGranted) return;
        const settings = ScholarDB.getSettings();
        if (!settings.notifications) return;
        try {
            new Notification(title, {
                body,
                icon: icon || '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                tag: title
            });
        } catch (e) {
            console.log('Notification failed:', e);
        }
    }

    function addInApp(title, body, type = 'info') {
        ScholarDB.addNotification({ title, body, type });
        updateBadge();
    }

    function updateBadge() {
        const notifs = ScholarDB.getAll('notifications');
        const unread = notifs.filter(n => !n.read).length;
        const badge = document.getElementById('notif-badge');
        if (badge) {
            badge.textContent = unread;
            badge.style.display = unread > 0 ? 'flex' : 'none';
        }
    }

    // ── Assignment Reminders (on load) ──────────────────
    function checkAssignmentReminders() {
        const assignments = ScholarDB.getAll('assignments').filter(a => a.status !== 'done');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        assignments.forEach(a => {
            const due = new Date(a.dueDate);
            due.setHours(0, 0, 0, 0);
            const diff = Math.ceil((due - today) / 86400000);

            if (diff === 0) {
                sendBrowserNotification('🚨 Due TODAY!', a.title);
                addInApp('🚨 Due TODAY', a.title, 'danger');
            } else if (diff === 1) {
                sendBrowserNotification('⚠️ Due Tomorrow', a.title);
                addInApp('⚠️ Due Tomorrow', a.title, 'warning');
            } else if (diff === 3) {
                sendBrowserNotification('📚 Due in 3 days', a.title);
                addInApp('📚 Due in 3 days', a.title, 'info');
            } else if (diff < 0) {
                addInApp('🚨 OVERDUE', `${a.title} was due ${Math.abs(diff)} days ago`, 'danger');
            }
        });
    }

    // ── Class Reminder (every minute) ───────────────────
    function startClassReminder() {
        if (classCheckInterval) clearInterval(classCheckInterval);
        classCheckInterval = setInterval(() => {
            const settings = ScholarDB.getSettings();
            if (settings.notifications && !settings.notifications.classReminders) return;

            const now = new Date();
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const today = days[now.getDay()];
            const classes = ScholarDB.getAll('timetable').filter(c => c.day === today);
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            classes.forEach(c => {
                const [h, m] = c.startTime.split(':').map(Number);
                const classMinutes = h * 60 + m;
                const diff = classMinutes - currentMinutes;

                if (diff === 15) {
                    const sub = ScholarDB.getSubjectById(c.subjectId);
                    sendBrowserNotification('📖 Class in 15 minutes', `${sub ? sub.name : 'Class'} at ${c.startTime} in ${c.room}`);
                    addInApp('Class Starting Soon', `${sub ? sub.name : 'Class'} in ${c.room} at ${c.startTime}`, 'info');
                }
            });
        }, 60000);
    }

    // ── Overdue Check (every hour) ──────────────────────
    function startOverdueCheck() {
        if (overdueCheckInterval) clearInterval(overdueCheckInterval);
        overdueCheckInterval = setInterval(() => {
            const assignments = ScholarDB.getAll('assignments').filter(a => a.status !== 'done');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            assignments.forEach(a => {
                const due = new Date(a.dueDate);
                due.setHours(0, 0, 0, 0);
                if (due < today) {
                    sendBrowserNotification('🚨 Assignment Overdue', a.title);
                }
            });
        }, 3600000);
    }

    // ── Weekly Summary (Sunday 8AM) ─────────────────────
    function checkWeeklySummary() {
        const now = new Date();
        if (now.getDay() === 0 && now.getHours() === 8 && now.getMinutes() === 0) {
            const assignments = ScholarDB.getAll('assignments').filter(a => a.status !== 'done');
            const events = ScholarDB.getAll('events');
            sendBrowserNotification(
                '📋 Weekly Summary',
                `You have ${assignments.length} pending assignments and ${events.length} upcoming events this week.`
            );
        }
    }

    function renderDropdown() {
        const notifs = ScholarDB.getAll('notifications').slice(0, 20);
        const container = document.getElementById('notif-dropdown-list');
        if (!container) return;

        if (notifs.length === 0) {
            container.innerHTML = '<div class="notif-empty"><span class="material-symbols-outlined">notifications_off</span><p>No notifications yet</p></div>';
            return;
        }

        container.innerHTML = notifs.map(n => {
            const time = formatTimeAgo(n.timestamp);
            const typeClass = n.type === 'danger' ? 'notif-danger' : n.type === 'warning' ? 'notif-warning' : '';
            return `<div class="notif-item ${n.read ? 'notif-read' : ''} ${typeClass}">
                <div class="notif-item-content">
                    <strong>${n.title}</strong>
                    <p>${n.body}</p>
                </div>
                <span class="notif-time">${time}</span>
            </div>`;
        }).join('');
    }

    function formatTimeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    }

    return { init, updateBadge, renderDropdown, addInApp, sendBrowserNotification };
})();
