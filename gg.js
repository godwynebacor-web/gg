/* ============================================================
   gg.js — merged script for Info:Sched
   Backend: BACOR University Supabase project
   Tables: users, appointments, announcements
   Storage: avatars, id-cards buckets
   User types: 'admin' or 'resident'
   Appointment status: pending / approved / completed / cancelled
   Auto-complete: approved → completed 1 hour after scheduled date+time
   ============================================================ */

const SUPABASE_URL = 'https://hpqfsdgbppwlosltbemk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwcWZzZGdicHB3bG9zbHRiZW1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNTA0NDYsImV4cCI6MjA5NjkyNjQ0Nn0.Qphtm4_wMlDEbPRyuR0_g-LxPc4AOu2ZFSIzAapBnOA';

let supabase = null;
(function initSupabase() {
    console.log('🔄 Initializing Supabase...');
    function tryInit() {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            try {
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('✅ Supabase initialized successfully');
                console.log('🔗 Connected to:', SUPABASE_URL);
                return true;
            } catch (e) {
                console.log('❌ Failed to create Supabase client:', e);
                return false;
            }
        }
        return false;
    }
    if (!tryInit()) {
        console.log('⚠️ Supabase library not found, loading dynamically...');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js';
        script.onload = function () {
            console.log('✅ Supabase library loaded dynamically');
            tryInit();
        };
        script.onerror = function () {
            console.log('❌ Failed to load Supabase library');
        };
        document.head.appendChild(script);
    }
})();

/* ============================================================
   0. GLOBAL UI — TOAST + CONFIRM
   ============================================================ */
const GG = (function () {
    'use strict';

    let confirmOpen = false;
    let lastToast = { msg: '', time: 0 };

    function ensureContainer() {
        let c = document.querySelector('.toast-container');
        if (!c) {
            c = document.createElement('div');
            c.className = 'toast-container';
            document.body.appendChild(c);
        }
        return c;
    }
    const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

    function toast(message, type, title, duration) {
        type = type || 'info';
        title = title || ({ success: 'Success', error: 'Error', warning: 'Warning', info: 'Notice' }[type] || 'Notice');
        duration = (duration === undefined) ? 4000 : duration;

        const now = Date.now();
        if (lastToast.msg === message && (now - lastToast.time) < 500) return null;
        lastToast = { msg: message, time: now };

        const c = ensureContainer();
        const el = document.createElement('div');
        el.className = 'toast toast-' + type;
        el.innerHTML = `
            <span class="toast-icon icon-text">${ICONS[type] || 'ℹ'}</span>
            <div class="toast-body">
                <span class="toast-title">${title}</span>
                <span class="toast-text">${message}</span>
            </div>
            <button class="toast-close" aria-label="Close">✕</button>`;
        el.querySelector('.toast-close').addEventListener('click', () => dismiss(el));
        c.appendChild(el);
        if (duration > 0) setTimeout(() => dismiss(el), duration);
        return el;
    }
    function dismiss(el) {
        if (!el || el.classList.contains('toast-out')) return;
        el.classList.add('toast-out');
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }

    function confirmDialog(opts) {
        if (confirmOpen) return Promise.resolve(false);
        confirmOpen = true;

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'gg-confirm-overlay';
            const confirmLabel = (opts && opts.confirmLabel) || 'Yes';
            const cancelLabel  = (opts && opts.cancelLabel)  || 'Cancel';
            const title        = (opts && opts.title)        || 'Please Confirm';
            const message      = (opts && opts.message)      || '';
            const confirmClass = (opts && opts.confirmClass) || 'btn btn-primary';
            overlay.innerHTML = `
                <div class="gg-confirm-box" role="dialog" aria-modal="true">
                    <div class="gg-confirm-title"><span class="icon-text">⚠</span> ${title}</div>
                    <div class="gg-confirm-msg">${message}</div>
                    <div class="gg-confirm-actions">
                        <button class="btn btn-secondary" data-act="cancel">${cancelLabel}</button>
                        <button class="${confirmClass}" data-act="ok">${confirmLabel}</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);

            let closed = false;
            function close(result) {
                if (closed) return;
                closed = true;
                confirmOpen = false;
                overlay.style.transition = 'opacity 0.2s ease';
                overlay.style.opacity = '0';
                setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); resolve(result); }, 200);
            }
            overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
            overlay.querySelector('[data-act="ok"]').addEventListener('click', () => close(true));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
            document.addEventListener('keydown', function onKey(e) {
                if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(false); }
            });
        });
    }

    return { toast, confirm: confirmDialog };
})();
window.ggToast = GG.toast;
window.ggConfirm = GG.confirm;

/* ---------- Shared validators ---------- */
function ggIsValidName(name) { return /^[A-Za-z\s\-']+$/.test(name); }
function ggIsAtLeast18(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 18;
}
function ggValidatePasswordStrength(pw) {
    return pw.length >= 8 && /[0-9]/.test(pw) && /[A-Za-z]/.test(pw) && /[!@#$%^&*(),.?":{}|<>]/.test(pw);
}
function ggValidateGmail(email) {
    return typeof email === 'string' && email.toLowerCase().endsWith('@gmail.com');
}
function ggIsValidPhone(phone) {
    return /^09[0-9]{9}$/.test(phone);
}
function ggTogglePassword(fieldId, button) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    const icon = button ? button.querySelector('.password-toggle-icon') : null;
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.textContent = '◉';
    } else {
        input.type = 'password';
        if (icon) icon.textContent = '○';
    }
}
window.togglePassword = ggTogglePassword;

/* ---------- Avatar Upload ---------- */
async function ggUploadAvatar(file, userEmail) {
    if (!supabase) throw new Error('Database not connected');
    if (!file) throw new Error('No file selected');
    if (!file.type.startsWith('image/')) throw new Error('Please select an image file (JPG, PNG, etc.)');
    if (file.size > 2 * 1024 * 1024) throw new Error('Image must be under 2MB');

    const ext = file.name.split('.').pop().toLowerCase();
    const safeEmail = userEmail.replace(/[^a-z0-9]/gi, '_');
    const filename = `${safeEmail}_${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filename, file, { cacheControl: '3600', upsert: true });
    if (error) throw new Error('Upload failed: ' + error.message);

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filename);
    return urlData.publicUrl;
}
window.ggUploadAvatar = ggUploadAvatar;

/* ---------- ID Card Upload ---------- */
async function ggUploadIdCard(file, userEmail, side) {
    if (!supabase) throw new Error('Database not connected');
    if (!file) throw new Error('No file selected');
    if (!file.type.startsWith('image/')) throw new Error('Please select an image file (JPG, PNG)');
    if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5 MB');

    const ext = file.name.split('.').pop().toLowerCase();
    const safeEmail = userEmail.replace(/[^a-z0-9]/gi, '_');
    const filename = `${safeEmail}_${side}_${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
        .from('id-cards')
        .upload(filename, file, { cacheControl: '3600', upsert: true });
    if (error) throw new Error('ID upload failed: ' + error.message);

    const { data: urlData } = supabase.storage.from('id-cards').getPublicUrl(filename);
    return urlData.publicUrl;
}
window.ggUploadIdCard = ggUploadIdCard;

/* ---------- Avatar HTML ---------- */
function ggBuildAvatarHtml(user, size, border) {
    size = size || 36;
    border = border || 0;
    const first = (user.first_name || '').trim().charAt(0).toUpperCase();
    const last  = (user.last_name || '').trim().charAt(0).toUpperCase();
    const initials = (first + last) || '?';
    const fontSize = Math.max(0.65, size / 45);
    const wrapStyle = `display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#d32f2f,#b71c1c);color:#fff;font-weight:700;font-size:${fontSize}rem;overflow:hidden;flex-shrink:0;${border ? 'border:' + border + 'px solid #ffc107;' : ''}`;
    if (user.avatar_url) {
        return `<span style="${wrapStyle}"><img src="${user.avatar_url}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" onerror="this.style.display='none';this.parentNode.textContent='${initials}';"></span>`;
    }
    return `<span style="${wrapStyle}">${initials}</span>`;
}
window.ggBuildAvatarHtml = ggBuildAvatarHtml;

/* ============================================================
   APPOINTMENT STATUS HELPERS
   ============================================================ */
function ggStatusLabel(status) {
    const s = (status || 'pending').toLowerCase();
    if (s === 'approved')  return 'Approved';
    if (s === 'completed') return 'Completed';
    if (s === 'cancelled') return 'Cancelled';
    return 'Pending';
}
function ggStatusClass(status) {
    const s = (status || 'pending').toLowerCase();
    if (s === 'approved')  return 'status-approved';
    if (s === 'completed') return 'status-completed';
    if (s === 'cancelled') return 'status-cancelled';
    return 'status-pending';
}

/* Parse the appointment's `date` (which may be "September 29, 2026") + `time` ("3:00 PM")
   into a real Date object. Returns null if it can't. */
function ggParseApptDateTime(appt) {
    if (!appt) return null;
    const dateStr = appt.date || '';
    const timeStr = appt.time || '';

    /* Try to parse the date first (locale-friendly) */
    let dateObj = new Date(dateStr);
    if (isNaN(dateObj)) return null;

    /* Then parse the time like "3:00 PM" and merge into dateObj */
    const m = String(timeStr).match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (m) {
        let h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const ap = m[3].toUpperCase();
        if (ap === 'PM' && h !== 12) h += 12;
        if (ap === 'AM' && h === 12) h = 0;
        dateObj.setHours(h, min, 0, 0);
    }
    return dateObj;
}

/* Auto-complete rule:
   If status = 'approved' AND (appointment date+time + 1 hour) < now
   → change to 'completed'. */
function ggShouldAutoComplete(appt) {
    if (!appt) return false;
    if ((appt.status || '').toLowerCase() !== 'approved') return false;
    const dt = ggParseApptDateTime(appt);
    if (!dt) return false;
    const oneHourAfter = new Date(dt.getTime() + 60 * 60 * 1000);
    return oneHourAfter < new Date();
}

/* Apply auto-complete to a list of appointments. */
async function ggAutoCompleteAppointments(appointments) {
    if (!supabase || !Array.isArray(appointments)) return appointments;
    const toComplete = appointments.filter(a => ggShouldAutoComplete(a));
    if (toComplete.length === 0) return appointments;

    for (const a of toComplete) {
        try {
            await supabase
                .from('appointments')
                .update({ status: 'completed' })
                .eq('id', a.id);
            a.status = 'completed';
        } catch (e) { console.warn('Auto-complete failed for', a.id, e); }
    }
    return appointments;
}

/* ---------- Date + escape helpers ---------- */
function ggFormatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date)) return '';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function ggEscape(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
async function ggFetchAnnouncements() {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('is_published', true)
            .order('event_date', { ascending: true });
        if (error) { console.warn('ggFetchAnnouncements error:', error); return []; }
        return data || [];
    } catch (e) {
        console.warn('ggFetchAnnouncements exception:', e);
        return [];
    }
}

/* ============================================================
   SIDEBAR TOGGLE
   ============================================================ */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('open');
    if (backdrop) {
        if (isOpen) backdrop.classList.add('active');
        else backdrop.classList.remove('active');
    }
}
window.toggleSidebar = toggleSidebar;

function ggWireMobileMenuClose() {
    document.querySelectorAll('.menu-item[data-view], .menu-item[data-target]').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const backdrop = document.getElementById('sidebarBackdrop');
                if (sidebar && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                    if (backdrop) backdrop.classList.remove('active');
                }
            }
        });
    });
}

/* ============================================================
   1. LANDING MODULE
   ============================================================ */
(function landingModule() {
    'use strict';
    document.addEventListener('DOMContentLoaded', async function () {
        if (!document.body.classList.contains('landing-page')) return;
        console.log('[Landing] module running');

        let ALL_ANNOUNCEMENTS = [];
        let calCursor = new Date();

        function showLandingSection(sectionId) {
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            const target = document.getElementById(sectionId);
            if (target) target.classList.add('active');
            const tab = document.querySelector(`.nav-tab[data-target="${sectionId}"]`);
            if (tab) tab.classList.add('active');
        }

        function loadAnnouncementBar() {
            const el = document.getElementById('announcementText');
            if (!el) return;
            if (!ALL_ANNOUNCEMENTS.length) {
                el.textContent = 'No announcements yet — check back soon.';
            } else {
                el.textContent = ALL_ANNOUNCEMENTS.map(a => a.title || 'Untitled').join('   •   ');
            }
            const pauseBtn = document.getElementById('pauseAnnouncement');
            const playBtn = document.getElementById('playAnnouncement');
            if (pauseBtn && playBtn) {
                pauseBtn.onclick = () => {
                    el.style.animationPlayState = 'paused';
                    pauseBtn.style.display = 'none';
                    playBtn.style.display = 'inline-flex';
                };
                playBtn.onclick = () => {
                    el.style.animationPlayState = 'running';
                    playBtn.style.display = 'none';
                    pauseBtn.style.display = 'inline-flex';
                };
            }
        }

        function updateHeroStats() {
            const today = new Date().toISOString().split('T')[0];
            const thisMonth = today.slice(0, 7);
            const upcoming = ALL_ANNOUNCEMENTS.filter(e => e.event_date >= today).length;
            const month = ALL_ANNOUNCEMENTS.filter(e => (e.event_date || '').startsWith(thisMonth)).length;
            const todayCount = ALL_ANNOUNCEMENTS.filter(e => e.event_date === today).length;
            const a = document.getElementById('upcomingEventsCount'); if (a) a.textContent = upcoming;
            const b = document.getElementById('monthEventsCount');    if (b) b.textContent = month;
            const c = document.getElementById('todayEventsCount');    if (c) c.textContent = todayCount;
        }

        function renderCalendar() {
            const grid = document.getElementById('calendarDays');
            const title = document.getElementById('currentMonth');
            if (!grid || !title) return;
            const y = calCursor.getFullYear(), m = calCursor.getMonth();
            title.textContent = `${calCursor.toLocaleString('en-US', { month: 'long' })} ${y}`;
            grid.innerHTML = '';
            const firstDay = new Date(y, m, 1).getDay();
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const todayStr = new Date().toISOString().split('T')[0];
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            for (let i = 0; i < firstDay; i++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-day';
                cell.style.visibility = 'hidden';
                grid.appendChild(cell);
            }
            for (let day = 1; day <= daysInMonth; day++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-day';
                const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                if (iso === todayStr) cell.classList.add('today');
                const dayIdx = (firstDay + day - 1) % 7;
                cell.innerHTML = `<div class="day-header">${dayNames[dayIdx]}</div><div class="day-number">${day}</div>`;
                const evs = ALL_ANNOUNCEMENTS.filter(e => (e.event_date || '').slice(0, 10) === iso);
                evs.forEach(ev => {
                    const chip = document.createElement('div');
                    chip.className = 'event';
                    chip.textContent = ev.title || 'Untitled';
                    chip.title = 'Log in to see details';
                    chip.onclick = (e) => {
                        e.stopPropagation();
                        GG.toast('Please log in to see the full details.', 'info', 'Log In Required');
                        setTimeout(() => { window.location.href = 'login.html'; }, 900);
                    };
                    cell.appendChild(chip);
                });
                grid.appendChild(cell);
            }
        }

        function prevMonth() { calCursor.setMonth(calCursor.getMonth() - 1); renderCalendar(); }
        function nextMonth() { calCursor.setMonth(calCursor.getMonth() + 1); renderCalendar(); }

        function renderNewsHighlights() {
            const box = document.getElementById('newsHighlights');
            if (!box) return;
            box.innerHTML = '';
            if (!ALL_ANNOUNCEMENTS.length) {
                box.innerHTML = `<div class="empty-state"><span class="icon-large">▢</span><h3>No announcements yet</h3><p>Check back soon.</p></div>`;
                return;
            }
            ALL_ANNOUNCEMENTS.slice(0, 6).forEach(n => {
                const card = document.createElement('div');
                card.className = 'news-highlight';
                card.innerHTML = `
                    <div class="news-image"><span class="icon-text">▤</span></div>
                    <div class="news-content">
                        <h4>${ggEscape(n.title || 'Untitled')}</h4>
                        <div class="news-date"><span class="icon-text">▦</span> ${ggEscape(ggFormatDate(n.event_date))}</div>
                        <p><strong style="color:var(--primary-red);">${ggEscape((n.category || 'event').toUpperCase())}</strong></p>
                        <p style="font-size:0.85rem;color:#888;">Full details are visible after login.</p>
                        <button class="read-more" onclick="window.location.href='login.html'">Log In to Read More</button>
                    </div>`;
                box.appendChild(card);
            });
        }

        function renderEventsGrid() {
            const grid = document.getElementById('eventsGrid');
            if (!grid) return;
            grid.innerHTML = '';
            const catFilter = document.getElementById('categoryFilter')?.value || 'all';
            const statusFilter = document.getElementById('statusFilter')?.value || 'all';
            const today = new Date().toISOString().split('T')[0];
            const filtered = ALL_ANNOUNCEMENTS.filter(item => {
                if (catFilter !== 'all' && (item.category || '') !== catFilter) return false;
                const d = (item.event_date || '').slice(0, 10);
                if (statusFilter === 'upcoming' && !(d >= today)) return false;
                if (statusFilter === 'today' && d !== today) return false;
                if (statusFilter === 'completed' && !(d < today)) return false;
                return true;
            });
            if (!filtered.length) {
                grid.innerHTML = `<div class="empty-state"><span class="icon-large">▢</span><h3>No announcements</h3><p>Nothing matches the current filters.</p></div>`;
                return;
            }
            filtered.forEach(item => {
                const card = document.createElement('div');
                card.className = 'news-highlight';
                card.innerHTML = `
                    <div class="news-image"><span class="icon-text">▤</span></div>
                    <div class="news-content">
                        <h4>${ggEscape(item.title || 'Untitled')}</h4>
                        <div class="news-date"><span class="icon-text">▦</span> ${ggEscape(ggFormatDate(item.event_date))}</div>
                        <p><strong style="color:var(--primary-red);">${ggEscape((item.category || 'event').toUpperCase())}</strong></p>
                        <p style="font-size:0.85rem;color:#888;">Full details are visible after login.</p>
                        <button class="read-more" onclick="window.location.href='login.html'">Log In to Read More</button>
                    </div>`;
                grid.appendChild(card);
            });
        }

        ALL_ANNOUNCEMENTS = await ggFetchAnnouncements();
        loadAnnouncementBar();
        updateHeroStats();
        renderCalendar();
        renderNewsHighlights();
        renderEventsGrid();

        document.querySelectorAll('.nav-tab[data-target]').forEach(tab => {
            tab.addEventListener('click', () => showLandingSection(tab.getAttribute('data-target')));
        });
        const prev = document.getElementById('prevMonth'); if (prev) prev.onclick = prevMonth;
        const next = document.getElementById('nextMonth'); if (next) next.onclick = nextMonth;
        ['categoryFilter', 'statusFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.onchange = renderEventsGrid;
        });
    });
})();

/* ============================================================
   2. AUTH MODULE
   ============================================================ */
(function authModule() {
    'use strict';
    document.addEventListener('DOMContentLoaded', function () {
        if (!document.body.classList.contains('auth-page')) return;
        console.log('[Auth] module running');

        function showAuthPanel(name) {
            document.querySelectorAll('[data-auth-panel]').forEach(p => p.style.display = 'none');
            const target = document.querySelector(`[data-auth-panel="${name}"]`);
            if (target) target.style.display = 'block';
            ['loginLoadingSpinner','loginSuccessMessage','signupLoadingSpinner','signupSuccessMessage','forgotLoadingSpinner','forgotSuccessMessage']
                .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
        }
        function goToLandingPage() { window.location.href = 'index.html'; }
        function goToLoginPanel()   { showAuthPanel('login'); }
        function goToSignupPanel()  { showAuthPanel('signup'); }
        function goToForgotPanel()  { showAuthPanel('forgot'); }

        function showFieldError(inputEl, errorElement, message) {
            if (inputEl) { inputEl.classList.add('input-error'); inputEl.classList.remove('input-success'); }
            if (errorElement) { errorElement.textContent = message; errorElement.style.display = 'block'; errorElement.classList.add('show'); }
        }
        function clearFieldError(inputEl, errorElement) {
            if (inputEl) inputEl.classList.remove('input-error');
            if (errorElement) { errorElement.style.display = 'none'; errorElement.classList.remove('show'); }
        }

        function updatePasswordChecklist(pw) {
            pw = pw || '';
            const checks = [
                { id: 'reqLength', ok: pw.length >= 8 },
                { id: 'reqNumber', ok: /[0-9]/.test(pw) },
                { id: 'reqLetter', ok: /[A-Za-z]/.test(pw) },
                { id: 'reqSymbol', ok: /[!@#$%^&*(),.?":{}|<>]/.test(pw) }
            ];
            checks.forEach(c => {
                const el = document.getElementById(c.id);
                if (!el) return;
                const icon = el.querySelector('.req-check');
                if (c.ok) { el.classList.add('met'); if (icon) icon.textContent = '✓'; }
                else { el.classList.remove('met'); if (icon) icon.textContent = '○'; }
            });
        }

        function validateLoginEmail(silent) {
            const input = document.getElementById('loginEmail');
            const err = document.getElementById('loginEmailError');
            if (!input) return false;
            const v = input.value.trim();
            if (!v) { if (!silent) showFieldError(input, err, 'Please enter your email address'); else clearFieldError(input, err); return false; }
            if (!ggValidateGmail(v)) { showFieldError(input, err, 'Email must be a Gmail address (@gmail.com)'); return false; }
            clearFieldError(input, err); return true;
        }
        function validateLoginPassword(silent) {
            const input = document.getElementById('loginPassword');
            const err = document.getElementById('loginPasswordError');
            if (!input) return false;
            if (!input.value) { if (!silent) showFieldError(input, err, 'Please enter your password'); else clearFieldError(input, err); return false; }
            clearFieldError(input, err); return true;
        }

        async function signIn() {
            if (!validateLoginEmail() || !validateLoginPassword()) return;
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const spinner = document.getElementById('loginLoadingSpinner');
            const btn = document.getElementById('loginBtn');
            const success = document.getElementById('loginSuccessMessage');

            if (spinner) { spinner.style.display = 'block'; spinner.classList.add('show'); }
            if (btn) { btn.disabled = true; btn.innerHTML = '<span class="icon-text">⋯</span> Signing in…'; }

            try {
                if (!supabase) throw new Error('Database not connected. Please refresh.');
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', email)
                    .eq('password', password);

                if (error) throw new Error(error.message);
                if (!data || data.length === 0) throw new Error('Invalid email or password.');

                const user = data[0];
                const userType = (user.user_type || 'resident').toLowerCase();

                localStorage.setItem('currentUser', JSON.stringify({
                    firstName: user.first_name || '',
                    lastName: user.last_name || '',
                    email: user.email || '',
                    phone: user.phone || '',
                    address: user.address || '',
                    dob: user.dob || '',
                    password: user.password || '',
                    userType: userType,
                    avatarUrl: user.avatar_url || ''
                }));
                sessionStorage.setItem('currentUser', JSON.stringify({
                    id: user.id,
                    email: user.email,
                    full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                    fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                    phone: user.phone || '',
                    address: user.address || '',
                    role: userType,
                    avatarUrl: user.avatar_url || ''
                }));

                try { sessionStorage.removeItem('appointmentFormDraft_' + user.email); } catch (e) {}

                if (userType === 'admin') {
                    localStorage.setItem('isAdminLoggedIn', 'true');
                    if (success) { success.style.display = 'block'; success.classList.add('show'); }
                    if (spinner) { spinner.style.display = 'none'; spinner.classList.remove('show'); }
                    GG.toast(`Welcome, ${user.first_name || 'Admin'}!`, 'success', 'Signed In');
                    setTimeout(() => { window.location.href = 'admin.html'; }, 1200);
                } else {
                    localStorage.removeItem('isAdminLoggedIn');
                    if (success) { success.style.display = 'block'; success.classList.add('show'); }
                    if (spinner) { spinner.style.display = 'none'; spinner.classList.remove('show'); }
                    GG.toast(`Welcome back, ${user.first_name || 'Resident'}!`, 'success', 'Signed In');
                    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
                }
            } catch (err) {
                console.error('Sign in error:', err);
                if (spinner) { spinner.style.display = 'none'; spinner.classList.remove('show'); }
                if (btn) { btn.disabled = false; btn.innerHTML = '<span class="icon-text">→</span> Sign In'; }
                GG.toast(err.message, 'error', 'Sign In Failed');
            }
        }

        function validateFirstName(silent) {
            const input = document.getElementById('signupFirstName');
            const err = document.getElementById('signupFirstNameError');
            if (!input) return false;
            const v = input.value.trim();
            if (!v) { if (!silent) showFieldError(input, err, 'First name is required'); else clearFieldError(input, err); return false; }
            if (v.length < 2) { showFieldError(input, err, 'First name must be at least 2 characters'); return false; }
            if (!ggIsValidName(v)) { showFieldError(input, err, 'Name cannot contain numbers or special characters'); return false; }
            clearFieldError(input, err); return true;
        }
        function validateLastName(silent) {
            const input = document.getElementById('signupLastName');
            const err = document.getElementById('signupLastNameError');
            if (!input) return false;
            const v = input.value.trim();
            if (!v) { if (!silent) showFieldError(input, err, 'Last name is required'); else clearFieldError(input, err); return false; }
            if (v.length < 2) { showFieldError(input, err, 'Last name must be at least 2 characters'); return false; }
            if (!ggIsValidName(v)) { showFieldError(input, err, 'Name cannot contain numbers or special characters'); return false; }
            clearFieldError(input, err); return true;
        }
        function validateAddress(silent) {
            const input = document.getElementById('signupAddress');
            const err = document.getElementById('signupAddressError');
            if (!input) return false;
            const v = input.value.trim();
            if (!v) { if (!silent) showFieldError(input, err, 'Address is required'); else clearFieldError(input, err); return false; }
            if (v.length < 5) { showFieldError(input, err, 'Please provide a complete address'); return false; }
            clearFieldError(input, err); return true;
        }
        function validateBirthDate(silent) {
            const input = document.getElementById('signupBirthDate');
            const err = document.getElementById('signupBirthDateError');
            if (!input) return false;
            const v = input.value;
            if (!v) { if (!silent) showFieldError(input, err, 'Date of birth is required'); else clearFieldError(input, err); return false; }
            if (!ggIsAtLeast18(v)) { showFieldError(input, err, 'You must be at least 18 years old'); return false; }
            clearFieldError(input, err); return true;
        }
        function validateSignupPassword(silent) {
            const input = document.getElementById('signupPassword');
            const err = document.getElementById('signupPasswordError');
            if (!input) return false;
            const v = input.value;
            if (!v) { if (!silent) showFieldError(input, err, 'Password is required'); else clearFieldError(input, err); return false; }
            if (!ggValidatePasswordStrength(v)) { showFieldError(input, err, 'Password needs 8+ chars, 1 number, 1 letter, 1 symbol'); return false; }
            clearFieldError(input, err); return true;
        }
        function validateConfirmPassword(silent) {
            const p1 = document.getElementById('signupPassword');
            const p2 = document.getElementById('signupConfirmPassword');
            const err = document.getElementById('signupConfirmPasswordError');
            if (!p1 || !p2) return false;
            if (!p2.value) { if (!silent) showFieldError(p2, err, 'Please confirm your password'); else clearFieldError(p2, err); return false; }
            if (p1.value !== p2.value) { showFieldError(p2, err, 'Passwords do not match'); return false; }
            clearFieldError(p2, err); return true;
        }
        function validatePhoneFormat(silent) {
            const input = document.getElementById('signupPhoneNumber');
            const err = document.getElementById('signupPhoneError');
            if (!input) return false;
            const v = input.value.trim();
            if (!v) { if (!silent) showFieldError(input, err, 'Phone number is required'); else clearFieldError(input, err); return false; }
            if (!/^[0-9]+$/.test(v)) { showFieldError(input, err, 'Phone number must contain only digits'); return false; }
            if (v.length !== 11) { showFieldError(input, err, 'Phone number must be exactly 11 digits'); return false; }
            if (!v.startsWith('09')) { showFieldError(input, err, 'Phone number must start with 09'); return false; }
            clearFieldError(input, err); return true;
        }
        function validateEmailFormat(silent) {
            const input = document.getElementById('signupEmail');
            const err = document.getElementById('signupEmailError');
            if (!input) return false;
            const v = input.value.trim();
            if (!v) { if (!silent) showFieldError(input, err, 'Email is required'); else clearFieldError(input, err); return false; }
            if (!ggValidateGmail(v)) { showFieldError(input, err, 'Email must be a Gmail address (@gmail.com)'); return false; }
            clearFieldError(input, err); return true;
        }

        async function registerUser() {
            const btn = document.getElementById('registerBtn');
            if (btn) { btn.disabled = true; btn.innerHTML = '<span class="icon-text">⋯</span> Processing…'; }
            const success = document.getElementById('signupSuccessMessage');
            if (success) { success.style.display = 'none'; success.classList.remove('show'); }

            const checks = [
                validateFirstName(),
                validateLastName(),
                validateAddress(),
                validateBirthDate(),
                validatePhoneFormat(),
                validateEmailFormat(),
                validateSignupPassword(),
                validateConfirmPassword()
            ];
            if (!checks.every(Boolean)) {
                if (btn) { btn.disabled = false; btn.innerHTML = '<span class="icon-text">＋</span> Create Account'; }
                GG.toast('Please fix the errors in the form before submitting.', 'error', 'Check the Form');
                return;
            }

            const spinner = document.getElementById('signupLoadingSpinner');
            if (spinner) { spinner.style.display = 'block'; spinner.classList.add('show'); }

            try {
                if (!supabase) throw new Error('Database not connected. Please refresh.');

                const firstName = document.getElementById('signupFirstName').value.trim();
                const lastName  = document.getElementById('signupLastName').value.trim();
                const address   = document.getElementById('signupAddress').value.trim();
                const phone     = document.getElementById('signupPhoneNumber').value.trim();
                const dob       = document.getElementById('signupBirthDate').value;
                const email     = document.getElementById('signupEmail').value.trim().toLowerCase();
                const password  = document.getElementById('signupPassword').value;

                const { data: existing } = await supabase
                    .from('users')
                    .select('email, phone')
                    .or(`email.eq.${email},phone.eq.${phone}`);

                if (existing && existing.length > 0) {
                    const emailTaken = existing.some(u => (u.email || '').toLowerCase() === email);
                    const phoneTaken = existing.some(u => (u.phone || '') === phone);
                    if (emailTaken && phoneTaken) throw new Error('Both this email and phone number are already registered.');
                    else if (emailTaken) throw new Error('This email is already registered.');
                    else if (phoneTaken) throw new Error('This phone number is already registered.');
                }

                const payload = {
                    first_name: firstName, last_name: lastName, email, password,
                    phone, address, dob, user_type: 'resident'
                };

                const { error } = await supabase.from('users').insert([payload]).select();
                if (error) {
                    if (error.message && error.message.toLowerCase().includes('duplicate')) {
                        throw new Error('This email or phone number is already registered.');
                    }
                    throw new Error(error.message);
                }

                if (spinner) { spinner.style.display = 'none'; spinner.classList.remove('show'); }
                if (success) {
                    success.style.display = 'block';
                    success.classList.add('show', 'success-pulse');
                    success.innerHTML = 'Registration successful! You can now sign in.';
                }
                if (btn) { btn.disabled = false; btn.innerHTML = '<span class="icon-text">＋</span> Create Account'; }
                const form = document.getElementById('registerForm'); if (form) form.reset();
                updatePasswordChecklist('');

                GG.toast(`Welcome, ${firstName}! Your account has been created.`, 'success', 'Registration Complete', 5000);

                const loginEmailEl = document.getElementById('loginEmail');
                if (loginEmailEl) loginEmailEl.value = email;
                setTimeout(() => { showAuthPanel('login'); }, 2000);
            } catch (err) {
                console.error('Registration error:', err);
                if (spinner) { spinner.style.display = 'none'; spinner.classList.remove('show'); }
                if (btn) { btn.disabled = false; btn.innerHTML = '<span class="icon-text">＋</span> Create Account'; }
                GG.toast(err.message, 'error', 'Registration Failed');
            }
        }

        function validateResetEmail(silent) {
            const input = document.getElementById('forgotResetEmail');
            const err = document.getElementById('forgotResetEmailError');
            if (!input) return false;
            const v = input.value.trim();
            if (!v) { if (!silent) showFieldError(input, err, 'Please enter your email address'); else clearFieldError(input, err); return false; }
            if (!ggValidateGmail(v)) { showFieldError(input, err, 'Email must be a Gmail address (@gmail.com)'); return false; }
            clearFieldError(input, err); return true;
        }
        async function resetPassword() {
            if (!validateResetEmail()) return;
            const email = document.getElementById('forgotResetEmail').value.trim();
            const spinner = document.getElementById('forgotLoadingSpinner');
            const btn = document.getElementById('resetPasswordBtn');
            if (spinner) { spinner.style.display = 'block'; spinner.classList.add('show'); }
            if (btn) { btn.disabled = true; btn.innerHTML = '<span class="icon-text">⋯</span> Sending…'; }
            try {
                if (!supabase) throw new Error('Database not connected.');
                const { data } = await supabase.from('users').select('email').eq('email', email).limit(1);
                if (!data || data.length === 0) throw new Error('No account found with that email.');

                const ok = document.getElementById('forgotSuccessMessage');
                if (ok) { ok.style.display = 'block'; ok.classList.add('show'); }
                if (spinner) { spinner.style.display = 'none'; spinner.classList.remove('show'); }
                if (btn) btn.innerHTML = '<span class="icon-text">➤</span> Send Reset Link';
                GG.toast('If an account exists, a reset link has been sent.', 'success', 'Check Your Email');
                setTimeout(() => {
                    if (ok) { ok.style.display = 'none'; ok.classList.remove('show'); }
                    if (btn) btn.disabled = false;
                }, 5000);
            } catch (err) {
                if (spinner) { spinner.style.display = 'none'; spinner.classList.remove('show'); }
                if (btn) { btn.disabled = false; btn.innerHTML = '<span class="icon-text">➤</span> Send Reset Link'; }
                GG.toast(err.message || 'Failed to send reset link.', 'error', 'Reset Failed');
            }
        }

        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.addEventListener('submit', e => { e.preventDefault(); signIn(); });
        const rf = document.getElementById('registerForm');
        if (rf) rf.addEventListener('submit', e => { e.preventDefault(); registerUser(); });
        const fp = document.getElementById('forgotPasswordForm');
        if (fp) fp.addEventListener('submit', e => { e.preventDefault(); resetPassword(); });

        function hideHelperOnInput(inputId, helperId) {
            const input = document.getElementById(inputId);
            const helper = document.getElementById(helperId);
            if (!input || !helper) return;
            input.addEventListener('input', function () {
                helper.style.display = this.value.length > 0 ? 'none' : 'block';
            });
        }
        hideHelperOnInput('signupPhoneNumber', 'signupPhoneHelper');
        hideHelperOnInput('signupEmail', 'signupEmailHelper');

        function liveValidate(inputId, validatorFn, errorId) {
            const input = document.getElementById(inputId);
            const err = document.getElementById(errorId);
            if (!input) return;
            input.addEventListener('input', function () {
                if (this.value.length === 0) { clearFieldError(this, err); return; }
                validatorFn(true);
            });
            input.addEventListener('blur', function () {
                if (this.value.length > 0) validatorFn();
            });
        }

        liveValidate('signupFirstName', validateFirstName, 'signupFirstNameError');
        liveValidate('signupLastName',  validateLastName,  'signupLastNameError');
        liveValidate('signupAddress',   validateAddress,   'signupAddressError');
        liveValidate('signupBirthDate', validateBirthDate, 'signupBirthDateError');
        liveValidate('signupPhoneNumber', validatePhoneFormat, 'signupPhoneError');
        liveValidate('signupEmail',       validateEmailFormat, 'signupEmailError');
        liveValidate('signupPassword',  validateSignupPassword, 'signupPasswordError');
        liveValidate('signupConfirmPassword', validateConfirmPassword, 'signupConfirmPasswordError');
        liveValidate('loginEmail',      validateLoginEmail,    'loginEmailError');
        liveValidate('loginPassword',   validateLoginPassword, 'loginPasswordError');
        liveValidate('forgotResetEmail', validateResetEmail,   'forgotResetEmailError');

        const phoneEl = document.getElementById('signupPhoneNumber');
        if (phoneEl) phoneEl.addEventListener('input', function () {
            this.value = this.value.replace(/[^0-9]/g, '').slice(0, 11);
        });

        const pwEl = document.getElementById('signupPassword');
        if (pwEl) pwEl.addEventListener('input', function () { updatePasswordChecklist(this.value); });

        const panelFromUrl = new URLSearchParams(window.location.search).get('panel');
        showAuthPanel(panelFromUrl || 'login');
        updatePasswordChecklist('');

        window.showAuthPanel      = showAuthPanel;
        window.goToLandingPage    = goToLandingPage;
        window.goToLoginPanel     = goToLoginPanel;
        window.goToSignupPanel    = goToSignupPanel;
        window.goToForgotPanel    = goToForgotPanel;
        window.goToLoginPage      = goToLoginPanel;
        window.goToSignup         = goToSignupPanel;
        window.goToForgotPassword = goToForgotPanel;
        window.togglePassword     = ggTogglePassword;
        window.signIn             = signIn;
        window.registerUser       = registerUser;
        window.resetPassword      = resetPassword;
        window.showDbSetupModal   = function () {};
        window.closeDbSetupModal  = function () {};
        window.closeModal         = function () {};
    });
})();

/* ============================================================
   3. RESIDENT MODULE
   ============================================================ */
(function residentModule() {
    'use strict';
    document.addEventListener('DOMContentLoaded', async function () {
        if (!document.body.classList.contains('app-shell')) return;
        if (document.querySelector('.tab-nav-item[data-tab]')) return;
        if (!document.getElementById('appointment-view')) return;
        console.log('[Resident] module running');

        const storedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (!storedUser || storedUser.userType !== 'resident') {
            console.log('[Resident] No resident session — redirecting to index.html');
            window.location.href = 'index.html';
            return;
        }

        let currentUser = storedUser;
        let appointmentData = {};
        let currentDate = new Date();
        let selectedDate = null;
        let selectedTime = null;
        let ALL_ANNOUNCEMENTS = [];
        let MY_APPOINTMENTS = [];

        const DRAFT_KEY = 'appointmentFormDraft_' + (currentUser.email || 'unknown');

        function saveDraft() {
            try {
                const draft = {
                    serviceType: document.getElementById('serviceType')?.value || '',
                    purpose: document.getElementById('purpose')?.value || '',
                    firstName: document.getElementById('firstName')?.value || '',
                    lastName: document.getElementById('lastName')?.value || '',
                    address: document.getElementById('address')?.value || '',
                    contactNumber: document.getElementById('contactNumber')?.value || '',
                    selectedDateISO: selectedDate ? selectedDate.toISOString() : null,
                    selectedTime: selectedTime || null
                };
                sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
            } catch (e) { console.warn('saveDraft failed:', e); }
        }
        function loadDraft() {
            try {
                const raw = sessionStorage.getItem(DRAFT_KEY);
                if (!raw) return null;
                return JSON.parse(raw);
            } catch (e) { return null; }
        }
        function clearDraft() {
            try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) {}
        }
        function applyDraft(draft) {
            if (!draft) return;
            const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
            setVal('purpose', draft.purpose);
            setVal('firstName', draft.firstName);
            setVal('lastName', draft.lastName);
            setVal('address', draft.address);
            setVal('contactNumber', draft.contactNumber);

            if (draft.serviceType) {
                const hidden = document.getElementById('serviceType');
                if (hidden) hidden.value = draft.serviceType;
                const match = document.querySelector(`.app-type-option[data-type="${draft.serviceType}"]`);
                if (match) match.classList.add('selected');
            }
            if (draft.selectedDateISO) {
                const d = new Date(draft.selectedDateISO);
                if (!isNaN(d)) { selectedDate = d; currentDate = new Date(d); }
            }
            if (draft.selectedTime) selectedTime = draft.selectedTime;
        }
        function wireDraftAutoSave() {
            const ids = ['purpose', 'firstName', 'lastName', 'address', 'contactNumber'];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', saveDraft);
                if (el) el.addEventListener('change', saveDraft);
            });
        }

        function showResidentView(name) {
            const dash = document.getElementById('dashboard-view');
            const appt = document.getElementById('appointment-view');
            if (!dash || !appt) return;
            if (name === 'appointment') {
                dash.style.display = 'none';
                appt.style.display = 'block';
                document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
                document.querySelector('.menu-item[data-view="appointment"]')?.classList.add('active');
                const t = document.querySelector('.page-title'); if (t) t.textContent = 'Appointment';
                const draft = loadDraft();
                if (draft) {
                    applyDraft(draft);
                    renderCalendar();
                }
            } else {
                appt.style.display = 'none';
                dash.style.display = 'block';
                document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
                document.querySelector('.menu-item[data-view="dashboard"]')?.classList.add('active');
                const t = document.querySelector('.page-title'); if (t) t.textContent = 'Dashboard';
                const apptSection = document.getElementById('appointmentsSection');
                const newsSection = document.getElementById('newsSection');
                const fullAppts = document.getElementById('allAppointmentsView');
                if (apptSection) apptSection.style.display = '';
                if (newsSection) newsSection.style.display = '';
                if (fullAppts) fullAppts.style.display = 'none';
            }
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const backdrop = document.getElementById('sidebarBackdrop');
                if (sidebar && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                    if (backdrop) backdrop.classList.remove('active');
                }
            }
        }
        function goToAppointmentPage() { showResidentView('appointment'); }
        function goToDashboard()       { showResidentView('dashboard'); }
        function goToLandingPage()     { window.location.href = 'index.html'; }

        async function logout() {
            const ok = await GG.confirm({
                title: 'Log Out?',
                message: 'Are you sure you want to log out of your account?',
                confirmLabel: 'Log Out', cancelLabel: 'Stay'
            });
            if (!ok) return;
            clearDraft();
            localStorage.removeItem('currentUser');
            localStorage.removeItem('isAdminLoggedIn');
            sessionStorage.removeItem('currentUser');
            GG.toast('You have been logged out.', 'info', 'Goodbye', 1800);
            setTimeout(() => { window.location.href = 'index.html'; }, 900);
        }

        function populateProfileForm() {
            const fn = document.getElementById('editFirstName');   if (fn) fn.value = currentUser.firstName || '';
            const ln = document.getElementById('editLastName');    if (ln) ln.value = currentUser.lastName  || '';
            const em = document.getElementById('editEmail');       if (em) em.value = currentUser.email || '';
            const ph = document.getElementById('editPhone');       if (ph) ph.value = currentUser.phone || '';
            const cp = document.getElementById('currentPassword'); if (cp) cp.value = '';
            const np = document.getElementById('newPassword');     if (np) np.value = '';
            const ec = document.getElementById('editConfirmPassword'); if (ec) ec.value = '';
            ['currentPassword','newPassword','editConfirmPassword'].forEach(id => {
                const el = document.getElementById(id); if (el) el.type = 'password';
            });
            ['editFirstNameError','editLastNameError','editEmailError','editPhoneError','editNewPasswordError','editConfirmPasswordError']
                .forEach(id => { const el = document.getElementById(id); if (el) { el.style.display = 'none'; el.classList.remove('show'); } });
            ['editFirstName','editLastName','editEmail','editPhone','newPassword','editConfirmPassword']
                .forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('input-error'); });
            const emh = document.getElementById('editEmailHelper'); if (emh) emh.style.display = 'none';
            const phh = document.getElementById('editPhoneHelper'); if (phh) phh.style.display = 'none';
            updateEditPasswordChecklist('');

            const preview = document.getElementById('avatarPreview');
            if (preview) {
                if (currentUser.avatarUrl) {
                    preview.src = currentUser.avatarUrl;
                    preview.style.display = 'block';
                } else {
                    preview.removeAttribute('src');
                    preview.style.display = 'none';
                }
            }
            const avatarInput = document.getElementById('avatarInput');
            if (avatarInput) avatarInput.value = '';
        }
        function openEditProfile() {
            populateProfileForm();
            const m = document.getElementById('editProfileModal'); if (m) m.style.display = 'flex';
        }
        function closeEditProfile() {
            const m = document.getElementById('editProfileModal'); if (m) m.style.display = 'none';
        }
        function previewAvatar() {
            const input = document.getElementById('avatarInput');
            const preview = document.getElementById('avatarPreview');
            if (input && input.files && input.files[0] && preview) {
                const r = new FileReader();
                r.onload = e => {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                };
                r.readAsDataURL(input.files[0]);
            }
        }
        function updateEditPasswordChecklist(pw) {
            pw = pw || '';
            const checks = [
                { id: 'editReqLength', ok: pw.length >= 8 },
                { id: 'editReqNumber', ok: /[0-9]/.test(pw) },
                { id: 'editReqLetter', ok: /[A-Za-z]/.test(pw) },
                { id: 'editReqSymbol', ok: /[!@#$%^&*(),.?":{}|<>]/.test(pw) }
            ];
            checks.forEach(c => {
                const el = document.getElementById(c.id);
                if (!el) return;
                const icon = el.querySelector('.req-check');
                if (c.ok) { el.classList.add('met'); if (icon) icon.textContent = '✓'; }
                else { el.classList.remove('met'); if (icon) icon.textContent = '○'; }
            });
        }
        function showEditError(inputEl, errorEl, msg) {
            if (inputEl) inputEl.classList.add('input-error');
            if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; errorEl.classList.add('show'); }
        }
        function clearEditError(inputEl, errorEl) {
            if (inputEl) inputEl.classList.remove('input-error');
            if (errorEl) { errorEl.style.display = 'none'; errorEl.classList.remove('show'); }
        }
        function validateEditFirstName(silent) {
            const i = document.getElementById('editFirstName'); const e = document.getElementById('editFirstNameError');
            if (!i) return false;
            const v = i.value.trim();
            if (!v) { if (!silent) showEditError(i, e, 'First name is required'); else clearEditError(i, e); return false; }
            if (v.length < 2) { showEditError(i, e, 'First name must be at least 2 characters'); return false; }
            if (!ggIsValidName(v)) { showEditError(i, e, 'Name cannot contain numbers or special characters'); return false; }
            clearEditError(i, e); return true;
        }
        function validateEditLastName(silent) {
            const i = document.getElementById('editLastName'); const e = document.getElementById('editLastNameError');
            if (!i) return false;
            const v = i.value.trim();
            if (!v) { if (!silent) showEditError(i, e, 'Last name is required'); else clearEditError(i, e); return false; }
            if (v.length < 2) { showEditError(i, e, 'Last name must be at least 2 characters'); return false; }
            if (!ggIsValidName(v)) { showEditError(i, e, 'Name cannot contain numbers or special characters'); return false; }
            clearEditError(i, e); return true;
        }
        function validateEditEmail(silent) {
            const i = document.getElementById('editEmail'); const e = document.getElementById('editEmailError');
            if (!i) return false;
            const v = i.value.trim();
            if (!v) { if (!silent) showEditError(i, e, 'Email is required'); else clearEditError(i, e); return false; }
            if (!ggValidateGmail(v)) { showEditError(i, e, 'Email must be a Gmail address (@gmail.com)'); return false; }
            clearEditError(i, e); return true;
        }
        function validateEditPhone(silent) {
            const i = document.getElementById('editPhone'); const e = document.getElementById('editPhoneError');
            if (!i) return false;
            const v = i.value.trim();
            if (!v) { if (!silent) showEditError(i, e, 'Phone number is required'); else clearEditError(i, e); return false; }
            if (!/^[0-9]+$/.test(v)) { showEditError(i, e, 'Phone number must contain only digits'); return false; }
            if (v.length !== 11) { showEditError(i, e, 'Phone number must be exactly 11 digits'); return false; }
            if (!v.startsWith('09')) { showEditError(i, e, 'Phone number must start with 09'); return false; }
            clearEditError(i, e); return true;
        }
        function validateEditNewPassword(silent) {
            const i = document.getElementById('newPassword'); const e = document.getElementById('editNewPasswordError');
            if (!i) return false;
            const v = i.value;
            if (!v) { clearEditError(i, e); return true; }
            if (!ggValidatePasswordStrength(v)) { showEditError(i, e, 'Password needs 8+ chars, 1 number, 1 letter, 1 symbol'); return false; }
            clearEditError(i, e); return true;
        }
        function validateEditConfirmPassword(silent) {
            const p1 = document.getElementById('newPassword');
            const p2 = document.getElementById('editConfirmPassword');
            const e = document.getElementById('editConfirmPasswordError');
            if (!p1 || !p2) return false;
            if (!p2.value && !p1.value) { clearEditError(p2, e); return true; }
            if (!p2.value) { if (!silent) showEditError(p2, e, 'Please confirm your new password'); else clearEditError(p2, e); return false; }
            if (p1.value !== p2.value) { showEditError(p2, e, 'Passwords do not match'); return false; }
            clearEditError(p2, e); return true;
        }

        async function saveProfile() {
            try {
                const firstName = (document.getElementById('editFirstName')?.value || '').trim();
                const lastName  = (document.getElementById('editLastName')?.value  || '').trim();
                const email     = (document.getElementById('editEmail')?.value     || '').trim();
                const phone     = (document.getElementById('editPhone')?.value     || '').trim();
                const currentPassword = (document.getElementById('currentPassword')?.value || '');
                const newPassword     = (document.getElementById('newPassword')?.value     || '');
                const confirmPassword = (document.getElementById('editConfirmPassword')?.value || '');
                const avatarInput     = document.getElementById('avatarInput');
                const oldEmail = currentUser.email;

                const profileChanged =
                    firstName !== (currentUser.firstName || '') ||
                    lastName  !== (currentUser.lastName  || '') ||
                    email     !== (currentUser.email     || '') ||
                    phone     !== (currentUser.phone     || '');
                const passwordEntered = newPassword.length > 0 || confirmPassword.length > 0 || currentPassword.length > 0;
                const newPhotoSelected = avatarInput && avatarInput.files && avatarInput.files[0];

                if (!profileChanged && !passwordEntered && !newPhotoSelected) return;

                const formatOk = [
                    validateEditFirstName(),
                    validateEditLastName(),
                    validateEditEmail(),
                    validateEditPhone(),
                    validateEditNewPassword(),
                    validateEditConfirmPassword()
                ].every(Boolean);

                if (!formatOk) {
                    GG.toast('Please fix the errors in the form before saving.', 'error', 'Check the Form');
                    return;
                }

                if (passwordEntered) {
                    if (!currentPassword) { GG.toast('Please enter your current password.', 'warning', 'Password Change'); return; }
                    if (currentPassword !== (currentUser.password || '')) { GG.toast('Current password is incorrect.', 'error', 'Password Change'); return; }
                    if (newPassword === currentPassword) { GG.toast('Your new password must be different from your current password.', 'warning', 'Same Password'); return; }
                    if (!newPassword) { GG.toast('Please enter a new password.', 'warning', 'Password Change'); return; }
                    if (newPassword !== confirmPassword) { GG.toast('New passwords do not match.', 'error', 'Password Change'); return; }
                }

                if (!supabase) throw new Error('Database not connected.');

                if (profileChanged && (email !== oldEmail || phone !== (currentUser.phone || ''))) {
                    const { data: existing } = await supabase
                        .from('users')
                        .select('email, phone')
                        .or(`email.eq.${email},phone.eq.${phone}`);
                    if (existing && existing.length > 0) {
                        const emailTaken = email !== oldEmail &&
                            existing.some(u => (u.email || '').toLowerCase() === email &&
                                (u.email || '').toLowerCase() !== oldEmail.toLowerCase());
                        const phoneTaken = phone !== (currentUser.phone || '') &&
                            existing.some(u => (u.phone || '') === phone &&
                                (u.phone || '') !== (currentUser.phone || ''));
                        if (emailTaken && phoneTaken) { GG.toast('Both this email and phone number are already registered.', 'error', 'Update Failed'); return; }
                        else if (emailTaken) { GG.toast('This email is already registered.', 'error', 'Update Failed'); return; }
                        else if (phoneTaken) { GG.toast('This phone number is already registered.', 'error', 'Update Failed'); return; }
                    }
                }

                const updateData = {};
                if (profileChanged) { updateData.first_name = firstName; updateData.last_name = lastName; updateData.email = email; updateData.phone = phone; }
                if (passwordEntered) updateData.password = newPassword;

                let newAvatarUrl = null;
                if (newPhotoSelected) {
                    GG.toast('Uploading photo…', 'info', 'Please wait', 2000);
                    newAvatarUrl = await ggUploadAvatar(avatarInput.files[0], oldEmail);
                    updateData.avatar_url = newAvatarUrl;
                }

                const { error } = await supabase.from('users').update(updateData).eq('email', oldEmail);
                if (error) throw new Error(error.message);

                if (profileChanged) { currentUser.firstName = firstName; currentUser.lastName = lastName; currentUser.email = email; currentUser.phone = phone; }
                if (passwordEntered) currentUser.password = newPassword;
                if (newAvatarUrl) currentUser.avatarUrl = newAvatarUrl;

                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                updateUserUI();

                if (newAvatarUrl) GG.toast('Profile photo updated.', 'success', 'Saved');
                if (profileChanged && passwordEntered) GG.toast('Profile and password updated.', 'success', 'Saved');
                else if (profileChanged) GG.toast('Profile updated.', 'success', 'Saved');
                else if (passwordEntered) GG.toast('Password changed successfully.', 'success', 'Saved');

                closeEditProfile();
            } catch (e) { GG.toast(e.message, 'error', 'Update Failed'); }
        }
        function updateUserUI() {
            const name = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || 'User';
            const nameEl = document.getElementById('userName'); if (nameEl) nameEl.textContent = name;
            const welcome = document.getElementById('welcomeTitle'); if (welcome) welcome.textContent = `Welcome back, ${currentUser.firstName || 'Resident'}!`;

            const img = document.getElementById('userAvatarImg');
            if (img) {
                if (currentUser.avatarUrl) {
                    img.src = currentUser.avatarUrl;
                    img.style.display = 'block';
                } else {
                    img.style.display = 'none';
                }
            }
        }

        function wireEditField(inputId, validatorFn, errorId, helperId, digitsOnly) {
            const input = document.getElementById(inputId);
            const err = document.getElementById(errorId);
            const helper = helperId ? document.getElementById(helperId) : null;
            if (!input) return;
            input.addEventListener('input', function () {
                if (digitsOnly) this.value = this.value.replace(/[^0-9]/g, '').slice(0, 11);
                if (helper) helper.style.display = this.value.length === 0 ? 'block' : 'none';
                if (this.value.length === 0) { clearEditError(this, err); return; }
                validatorFn(true);
            });
            input.addEventListener('blur', function () { if (this.value.length > 0) validatorFn(); });
        }
        wireEditField('editFirstName', validateEditFirstName, 'editFirstNameError', null, false);
        wireEditField('editLastName',  validateEditLastName,  'editLastNameError',  null, false);
        wireEditField('editEmail',     validateEditEmail,     'editEmailError',     'editEmailHelper', false);
        wireEditField('editPhone',     validateEditPhone,     'editPhoneError',     'editPhoneHelper', true);
        wireEditField('newPassword',   validateEditNewPassword, 'editNewPasswordError', null, false);
        wireEditField('editConfirmPassword', validateEditConfirmPassword, 'editConfirmPasswordError', null, false);

        const editNewPw = document.getElementById('newPassword');
        if (editNewPw) editNewPw.addEventListener('input', function () { updateEditPasswordChecklist(this.value); });

        /* ---------- APPOINTMENT FORM: error helpers ---------- */
        function setApptError(inputId, errorId, msg) {
            const input = document.getElementById(inputId);
            const err = document.getElementById(errorId);
            if (input) input.classList.add('input-error');
            if (err) { err.textContent = msg; err.style.display = 'block'; err.classList.add('show'); }
        }
        function clearApptError(inputId, errorId) {
            const input = document.getElementById(inputId);
            const err = document.getElementById(errorId);
            if (input) input.classList.remove('input-error');
            if (err) { err.style.display = 'none'; err.classList.remove('show'); }
        }
        function setServiceTypeError() {
            document.querySelectorAll('.app-type-option').forEach(o => o.style.borderColor = '#f44336');
            const err = document.getElementById('serviceTypeError');
            if (err) { err.textContent = 'Please select a service type'; err.style.display = 'block'; err.classList.add('show'); }
        }
        function clearServiceTypeError() {
            document.querySelectorAll('.app-type-option').forEach(o => o.style.borderColor = '');
            const err = document.getElementById('serviceTypeError');
            if (err) { err.style.display = 'none'; err.classList.remove('show'); }
        }
        function setDateTimeError(msg) {
            const err = document.getElementById('dateTimeError');
            if (err) { err.textContent = msg; err.style.display = 'block'; err.classList.add('show'); }
        }
        function clearDateTimeError() {
            const err = document.getElementById('dateTimeError');
            if (err) { err.style.display = 'none'; err.classList.remove('show'); }
        }

        function ensureAppointmentErrorSlots() {
            if (!document.getElementById('serviceTypeError')) {
                const grid = document.querySelector('.app-type-options');
                if (grid && grid.parentNode) {
                    const e = document.createElement('div');
                    e.id = 'serviceTypeError';
                    e.className = 'error-message';
                    grid.parentNode.insertBefore(e, grid.nextSibling);
                }
            }
            if (!document.getElementById('purposeError')) {
                const p = document.getElementById('purpose');
                if (p && p.parentNode) {
                    const e = document.createElement('div');
                    e.id = 'purposeError';
                    e.className = 'error-message';
                    p.parentNode.appendChild(e);
                }
            }
            if (!document.getElementById('firstNameError')) {
                const i = document.getElementById('firstName');
                if (i && i.parentNode) {
                    const e = document.createElement('div');
                    e.id = 'firstNameError';
                    e.className = 'error-message';
                    i.parentNode.appendChild(e);
                }
            }
            if (!document.getElementById('lastNameError')) {
                const i = document.getElementById('lastName');
                if (i && i.parentNode) {
                    const e = document.createElement('div');
                    e.id = 'lastNameError';
                    e.className = 'error-message';
                    i.parentNode.appendChild(e);
                }
            }
            if (!document.getElementById('addressError')) {
                const i = document.getElementById('address');
                if (i && i.parentNode) {
                    const e = document.createElement('div');
                    e.id = 'addressError';
                    e.className = 'error-message';
                    i.parentNode.appendChild(e);
                }
            }
            if (!document.getElementById('dateTimeError')) {
                const slots = document.getElementById('timeSlots');
                if (slots && slots.parentNode) {
                    const e = document.createElement('div');
                    e.id = 'dateTimeError';
                    e.className = 'error-message';
                    e.style.marginTop = '0.75rem';
                    slots.parentNode.appendChild(e);
                }
            }
        }

        function wireAppointmentFieldLive(inputId, errorId, validatorFn) {
            const input = document.getElementById(inputId);
            if (!input) return;
            input.addEventListener('input', function () {
                if (errorId) clearApptError(inputId, errorId);
                if (typeof validatorFn === 'function') validatorFn(this);
            });
        }

        function setupContactNumberValidation() {
            const input = document.getElementById('contactNumber');
            const err = document.getElementById('contactNumberError');
            if (!input) return;
            input.addEventListener('input', function () {
                this.value = this.value.replace(/[^0-9]/g, '').slice(0, 11);
                const v = this.value;
                if (v.length === 0) { input.classList.remove('input-error'); if (err) { err.style.display = 'none'; err.classList.remove('show'); } return; }
                if (/^09[0-9]{9}$/.test(v)) {
                    input.classList.remove('input-error');
                    if (err) { err.style.display = 'none'; err.classList.remove('show'); }
                } else {
                    input.classList.add('input-error');
                    if (err) { err.textContent = 'Must be 11 digits starting with 09'; err.style.display = 'block'; err.classList.add('show'); }
                }
            });
            input.addEventListener('blur', function () {
                const v = this.value;
                if (v.length === 0) return;
                if (!/^09[0-9]{9}$/.test(v)) {
                    input.classList.add('input-error');
                    if (err) { err.textContent = 'Must be 11 digits starting with 09'; err.style.display = 'block'; err.classList.add('show'); }
                }
            });
        }

        function selectAppType(el, type) {
            document.querySelectorAll('.app-type-option').forEach(o => { o.classList.remove('selected'); o.style.borderColor = ''; });
            el.classList.add('selected');
            const h = document.getElementById('serviceType'); if (h) h.value = type;
            clearServiceTypeError();
            saveDraft();
        }
        function selectIdOption(el, value) {
            document.querySelectorAll('.id-option').forEach(o => o.classList.remove('selected'));
            el.classList.add('selected');
            const r = el.querySelector('input[type="radio"]'); if (r) r.checked = true;
        }

        function renderCalendar() {
            const grid = document.getElementById('calendarGrid');
            const title = document.getElementById('currentMonth');
            if (!grid) return;
            grid.innerHTML = '';
            if (title) title.textContent = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
                const h = document.createElement('div'); h.className = 'calendar-day-header'; h.textContent = d; grid.appendChild(h);
            });
            const today = new Date(); today.setHours(0,0,0,0);
            const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
            const days = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            for (let i = 0; i < first; i++) {
                const c = document.createElement('div'); c.className = 'calendar-day unavailable'; grid.appendChild(c);
            }
            for (let d = 1; d <= days; d++) {
                const c = document.createElement('div');
                const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
                cellDate.setHours(0,0,0,0);
                const isPast = cellDate < today;
                c.className = 'calendar-day ' + (isPast ? 'unavailable' : 'available');
                if (!isPast && selectedDate && selectedDate.toDateString() === cellDate.toDateString()) c.classList.add('selected');
                c.textContent = d;
                if (!isPast) c.addEventListener('click', () => {
                    selectedDate = cellDate;
                    selectedTime = null;
                    clearDateTimeError();
                    saveDraft();
                    renderCalendar();
                });
                grid.appendChild(c);
            }
            renderTimeSlots();
        }
        function changeMonth(dir) { currentDate.setMonth(currentDate.getMonth() + dir); renderCalendar(); }

        function renderTimeSlots() {
            const box = document.getElementById('timeSlots');
            if (!box) return;
            box.innerHTML = '';

            if (!selectedDate) {
                box.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 1.25rem; color:#888; font-size:0.9rem; background: var(--dirty-white); border-radius: 8px;">Please select a date first to see available time slots.</div>';
                return;
            }

            const allSlots = ['8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM',
                              '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM'];
            const now = new Date();
            const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
            const isToday = selectedDate.toDateString() === now.toDateString();

            allSlots.forEach(s => {
                const slotDate = parseTimeSlot(s, selectedDate);
                const isAvailable = !(isToday && slotDate && slotDate < twoHoursFromNow);
                const slot = document.createElement('div');
                if (!isAvailable) {
                    slot.className = 'time-slot unavailable';
                    slot.title = 'Must be at least 2 hours from now';
                } else {
                    slot.className = 'time-slot available' + (selectedTime === s ? ' selected' : '');
                    slot.addEventListener('click', () => {
                        selectedTime = s;
                        clearDateTimeError();
                        saveDraft();
                        renderTimeSlots();
                    });
                }
                slot.textContent = s;
                box.appendChild(slot);
            });
        }

        function parseTimeSlot(str, day) {
            if (!day) return null;
            const m = str.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
            if (!m) return null;
            let h = parseInt(m[1], 10);
            const min = parseInt(m[2], 10);
            const ap = m[3].toUpperCase();
            if (ap === 'PM' && h !== 12) h += 12;
            if (ap === 'AM' && h === 12) h = 0;
            const d = new Date(day);
            d.setHours(h, min, 0, 0);
            return d;
        }

        function getServiceTypeDisplayName(t) {
            return {
                'barangay-clearance': 'Barangay Clearance',
                'business-permit': 'Business Permit',
                'blotter': 'Blotter',
                'katarungang-pambarangay': 'Katarungang Pambarangay'
            }[t] || t || 'Appointment';
        }

        function buildApptCard(a) {
            const status = (a.status || 'pending').toLowerCase();
            const statusLabel = ggStatusLabel(status);
            const statusClass = ggStatusClass(status);
            const rejectLine = (status === 'cancelled' && a.reject_reason)
                ? `<div class="appointment-reject-reason"><span class="icon-text">⚠</span> ${ggEscape(a.reject_reason)}</div>`
                : '';
            return `
                <div class="appointment-header">
                    <h3 class="appointment-title">${ggEscape(a.type || 'Appointment')}</h3>
                    <span class="appointment-status ${statusClass}">${statusLabel}</span>
                </div>
                <div class="appointment-details">
                    <div class="appointment-detail"><span class="icon-text">▦</span> ${ggEscape(a.date || '')}</div>
                    <div class="appointment-detail"><span class="icon-text">◷</span> ${ggEscape(a.time || '')}</div>
                </div>
                ${rejectLine}`;
        }

        function renderAppointmentLists() {
            const dashBox = document.getElementById('appointmentsList');
            const apptBox = document.getElementById('apptViewAppointmentsList');
            const fullBox = document.getElementById('allAppointmentsList');

            const list = MY_APPOINTMENTS.slice().sort((x, y) => {
                const dx = new Date(x.created_at || 0);
                const dy = new Date(y.created_at || 0);
                return dy - dx;
            });

            if (dashBox) {
                if (!list.length) {
                    dashBox.innerHTML = `<div class="no-appointments"><span class="icon-large">▢</span><p>No appointments scheduled</p></div>`;
                } else {
                    dashBox.innerHTML = '';
                    list.slice(0, 5).forEach(a => {
                        const item = document.createElement('div');
                        item.className = 'appointment-item';
                        item.innerHTML = buildApptCard(a);
                        dashBox.appendChild(item);
                    });
                }
            }
            if (apptBox) {
                if (!list.length) {
                    apptBox.innerHTML = `<div class="no-appointments"><span class="icon-large">▢</span><p>You haven't booked any appointment yet</p></div>`;
                } else {
                    apptBox.innerHTML = '';
                    list.slice(0, 5).forEach(a => {
                        const item = document.createElement('div');
                        item.className = 'appointment-item';
                        item.innerHTML = buildApptCard(a);
                        apptBox.appendChild(item);
                    });
                }
            }
            if (fullBox) {
                if (!list.length) {
                    fullBox.innerHTML = `<div class="no-appointments"><span class="icon-large">▢</span><p>No appointments scheduled</p></div>`;
                } else {
                    fullBox.innerHTML = '';
                    list.forEach(a => {
                        const item = document.createElement('div');
                        item.className = 'appointment-item';
                        item.innerHTML = buildApptCard(a);
                        fullBox.appendChild(item);
                    });
                }
            }
        }

        function showAllAppointments() {
            const apptSection = document.getElementById('appointmentsSection');
            const newsSection = document.getElementById('newsSection');
            const view = document.getElementById('allAppointmentsView');
            if (!view) return;
            if (newsSection) newsSection.style.display = 'none';
            if (apptSection) apptSection.style.display = 'none';
            view.style.display = 'block';
            renderAppointmentLists();
        }

        async function loadAppointments() {
            try {
                if (!supabase || !currentUser.email) return;
                const { data, error } = await supabase
                    .from('appointments')
                    .select('*')
                    .eq('user_email', currentUser.email)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                MY_APPOINTMENTS = await ggAutoCompleteAppointments(data || []);
                renderAppointmentLists();
            } catch (e) { console.warn('loadAppointments:', e); }
        }

        function confirmAppointment() {
            clearServiceTypeError();
            clearApptError('purpose', 'purposeError');
            clearApptError('firstName', 'firstNameError');
            clearApptError('lastName', 'lastNameError');
            clearApptError('address', 'addressError');
            clearApptError('contactNumber', 'contactNumberError');
            clearDateTimeError();

            let hasError = false;

            const serviceType = document.getElementById('serviceType')?.value;
            if (!serviceType) { setServiceTypeError(); hasError = true; }

            const purpose = document.getElementById('purpose')?.value?.trim();
            if (!purpose) { setApptError('purpose', 'purposeError', 'Purpose of application is required'); hasError = true; }

            const firstName = document.getElementById('firstName')?.value?.trim();
            if (!firstName) { setApptError('firstName', 'firstNameError', 'First name is required'); hasError = true; }
            const lastName  = document.getElementById('lastName')?.value?.trim();
            if (!lastName) { setApptError('lastName', 'lastNameError', 'Last name is required'); hasError = true; }

            const address = document.getElementById('address')?.value?.trim();
            if (!address) { setApptError('address', 'addressError', 'Address is required'); hasError = true; }

            const contactNumber = document.getElementById('contactNumber')?.value?.trim();
            if (!contactNumber) { setApptError('contactNumber', 'contactNumberError', 'Contact number is required'); hasError = true; }
            else if (!/^09[0-9]{9}$/.test(contactNumber)) { setApptError('contactNumber', 'contactNumberError', 'Must be 11 digits starting with 09'); hasError = true; }

            if (!selectedDate) { setDateTimeError('Please select a date'); hasError = true; }
            else if (!selectedTime) { setDateTimeError('Please select a time'); hasError = true; }

            if (hasError) {
                GG.toast('Please fill in all the highlighted fields.', 'error', 'Incomplete Form');
                const firstErr = document.querySelector('.input-error, .error-message.show');
                if (firstErr && firstErr.scrollIntoView) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            appointmentData = {
                serviceType, purpose, firstName, lastName, address, contactNumber,
                dateStr: selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                timeStr: selectedTime
            };
            const details = document.getElementById('confirmationDetails');
            if (details) details.innerHTML = `
                <div class="detail-row"><div class="detail-label">Service Type:</div><div class="detail-value">${getServiceTypeDisplayName(serviceType)}</div></div>
                <div class="detail-row"><div class="detail-label">Purpose:</div><div class="detail-value">${purpose}</div></div>
                <div class="detail-row"><div class="detail-label">Name:</div><div class="detail-value">${firstName} ${lastName}</div></div>
                <div class="detail-row"><div class="detail-label">Address:</div><div class="detail-value">${address}</div></div>
                <div class="detail-row"><div class="detail-label">Contact Number:</div><div class="detail-value">${contactNumber}</div></div>
                <div class="detail-row"><div class="detail-label">Appointment Date:</div><div class="detail-value">${appointmentData.dateStr}</div></div>
                <div class="detail-row"><div class="detail-label">Appointment Time:</div><div class="detail-value">${appointmentData.timeStr}</div></div>`;
            const formC = document.getElementById('appointmentFormContainer'); if (formC) formC.style.display = 'none';
            const confirmC = document.getElementById('confirmationSection'); if (confirmC) confirmC.style.display = 'block';

            resetIdPreviews();
        }
        function backToForm() {
            const confirmC = document.getElementById('confirmationSection'); if (confirmC) confirmC.style.display = 'none';
            const formC = document.getElementById('appointmentFormContainer'); if (formC) formC.style.display = 'block';
        }
        function updateProgress(pct, msg) {
            const fill = document.getElementById('progressFill'); if (fill) fill.style.width = `${pct}%`;
            const text = document.getElementById('progressText'); if (text) text.textContent = msg;
        }

        /* ---------- ID RADIO + UPLOAD ---------- */
        function setupIdRadioCards() {
            document.querySelectorAll('#idRadioGrid .id-radio-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    const input = card.querySelector('input[type="radio"]');
                    if (input && !input.checked) {
                        e.preventDefault();
                        input.checked = true;
                    }
                    document.querySelectorAll('#idRadioGrid .id-radio-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    const err = document.getElementById('idTypeError');
                    if (err) { err.style.display = 'none'; err.classList.remove('show'); }
                });
            });
        }
        function getSelectedIdType() {
            const checked = document.querySelector('#idRadioGrid input[name="idType"]:checked');
            return checked ? checked.value : null;
        }
        function resetIdRadio() {
            document.querySelectorAll('#idRadioGrid input[name="idType"]').forEach(i => { i.checked = false; });
            document.querySelectorAll('#idRadioGrid .id-radio-card').forEach(c => c.classList.remove('selected'));
            const err = document.getElementById('idTypeError');
            if (err) { err.style.display = 'none'; err.classList.remove('show'); }
        }
        function handleIdFileChange(side) {
            const inputId = side === 'front' ? 'idFrontInput' : 'idBackInput';
            const errId   = side === 'front' ? 'idFrontError' : 'idBackError';
            const fileId  = side === 'front' ? 'idFrontFilename' : 'idBackFilename';
            const fillId  = side === 'front' ? 'idFrontProgressFill' : 'idBackProgressFill';
            const imgId   = side === 'front' ? 'idFrontPreviewImg' : 'idBackPreviewImg';
            const iconId  = side === 'front' ? 'idFrontIconWrap' : 'idBackIconWrap';

            const input = document.getElementById(inputId);
            const err   = document.getElementById(errId);
            const fileLabel = document.getElementById(fileId);
            const fill  = document.getElementById(fillId);
            const img   = document.getElementById(imgId);
            const icon  = document.getElementById(iconId);

            if (!input || !input.files || !input.files[0]) return;
            const file = input.files[0];

            if (!file.type.startsWith('image/')) {
                GG.toast('Please select an image file (JPG or PNG)', 'error', 'Invalid File');
                input.value = '';
                if (fileLabel) fileLabel.textContent = 'your file here';
                if (fill) fill.style.width = '0%';
                if (img) { img.style.display = 'none'; }
                if (icon) { icon.style.display = 'flex'; }
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                GG.toast('Image must be under 5 MB', 'error', 'File Too Large');
                input.value = '';
                if (fileLabel) fileLabel.textContent = 'your file here';
                if (fill) fill.style.width = '0%';
                if (img) { img.style.display = 'none'; }
                if (icon) { icon.style.display = 'flex'; }
                return;
            }

            const r = new FileReader();
            r.onload = e => {
                if (img) { img.src = e.target.result; img.style.display = 'block'; }
                if (icon) icon.style.display = 'none';
            };
            r.readAsDataURL(file);

            if (fileLabel) fileLabel.textContent = file.name;
            if (fill) fill.style.width = '100%';
            if (err) { err.style.display = 'none'; err.classList.remove('show'); }
        }
        function resetIdPreviews() {
            ['idFrontInput', 'idBackInput'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            ['idFrontFilename', 'idBackFilename'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = 'your file here'; });
            ['idFrontProgressFill', 'idBackProgressFill'].forEach(id => { const el = document.getElementById(id); if (el) el.style.width = '0%'; });
            ['idFrontPreviewImg', 'idBackPreviewImg'].forEach(id => { const el = document.getElementById(id); if (el) { el.removeAttribute('src'); el.style.display = 'none'; } });
            ['idFrontIconWrap', 'idBackIconWrap'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'flex'; });
            ['idFrontError', 'idBackError'].forEach(id => { const el = document.getElementById(id); if (el) { el.style.display = 'none'; el.classList.remove('show'); } });
            resetIdRadio();
        }
        function setIdError(side, msg) {
            const errId = side === 'front' ? 'idFrontError' : 'idBackError';
            const err = document.getElementById(errId);
            if (err) { err.textContent = msg; err.style.display = 'block'; err.classList.add('show'); }
        }
        function clearIdError(side) {
            const errId = side === 'front' ? 'idFrontError' : 'idBackError';
            const err = document.getElementById(errId);
            if (err) { err.style.display = 'none'; err.classList.remove('show'); }
        }

        async function submitAppointment() {
            try {
                const idType = getSelectedIdType();
                if (!idType) {
                    const err = document.getElementById('idTypeError');
                    if (err) { err.textContent = 'Please select a valid ID type'; err.style.display = 'block'; err.classList.add('show'); }
                    GG.toast('Please select a valid ID type.', 'error', 'ID Required');
                    return;
                }

                const frontFile = document.getElementById('idFrontInput')?.files?.[0];
                const backFile  = document.getElementById('idBackInput')?.files?.[0];

                clearIdError('front'); clearIdError('back');

                let hasIdError = false;
                if (!frontFile) { setIdError('front', 'Front of ID is required'); hasIdError = true; }
                if (!backFile)  { setIdError('back',  'Back of ID is required');  hasIdError = true; }
                if (hasIdError) {
                    GG.toast('Please upload both the front and back of your valid ID.', 'error', 'ID Required');
                    return;
                }

                const prog = document.getElementById('imageProgress'); if (prog) prog.style.display = 'block';
                updateProgress(15, 'Uploading front ID…');
                const frontUrl = await ggUploadIdCard(frontFile, currentUser.email, 'front');

                updateProgress(45, 'Uploading back ID…');
                const backUrl = await ggUploadIdCard(backFile, currentUser.email, 'back');

                updateProgress(75, 'Saving appointment…');

                if (!supabase) throw new Error('Database not connected.');
                if (!currentUser || !currentUser.email) throw new Error('Please sign in again.');

                const payload = {
                    id: Date.now(),
                    user_email: currentUser.email,
                    date: appointmentData.dateStr,
                    time: appointmentData.timeStr,
                    type: getServiceTypeDisplayName(appointmentData.serviceType),
                    message: appointmentData.purpose,
                    id_type: idType,
                    id_front_url: frontUrl,
                    id_back_url: backUrl,
                    status: 'pending',
                    created_at: new Date().toISOString()
                };
                const { error } = await supabase.from('appointments').insert([payload]).select();
                if (error) throw error;

                updateProgress(100, 'Appointment scheduled successfully!');
                GG.toast('Your appointment has been submitted. Awaiting admin approval.', 'success', 'Submitted');

                clearDraft();
                selectedDate = null; selectedTime = null;
                appointmentData = {};
                const svc = document.getElementById('serviceType'); if (svc) svc.value = '';
                document.querySelectorAll('.app-type-option').forEach(o => { o.classList.remove('selected'); o.style.borderColor = ''; });
                const resetIds = ['purpose','address','contactNumber'];
                resetIds.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
                resetIdPreviews();
                const formC = document.getElementById('appointmentFormContainer'); if (formC) formC.style.display = 'block';
                const confirmC = document.getElementById('confirmationSection'); if (confirmC) confirmC.style.display = 'none';
                if (prog) prog.style.display = 'none';

                await loadAppointments();

                setTimeout(() => { showResidentView('dashboard'); }, 1200);
            } catch (e) {
                console.error('Error scheduling appointment:', e);
                GG.toast(e.message, 'error', 'Booking Failed');
                const prog = document.getElementById('imageProgress'); if (prog) prog.style.display = 'none';
            }
        }

        function renderAnnouncementBanner() {
            const t = document.getElementById('announcementTitle');
            const c = document.getElementById('announcementText');
            if (!t || !c) return;
            if (!ALL_ANNOUNCEMENTS.length) {
                t.textContent = 'No announcements yet';
                c.textContent = 'Check back soon for updates from the barangay.';
                return;
            }
            const latest = ALL_ANNOUNCEMENTS[ALL_ANNOUNCEMENTS.length - 1];
            t.textContent = latest.title || 'Announcement';
            const preview = (latest.content || '').replace(/\s+/g, ' ').slice(0, 140);
            c.textContent = preview + (latest.content && latest.content.length > 140 ? '…' : '');
        }

        function renderFeaturedAndRecent() {
            const featured = document.getElementById('featuredNewsContainer');
            const recent = document.getElementById('recentNewsContainer');
            if (!featured || !recent) return;
            featured.innerHTML = '';
            recent.innerHTML = '';
            if (!ALL_ANNOUNCEMENTS.length) {
                featured.innerHTML = `<div class="no-appointments"><span class="icon-large">▢</span><p>No announcements yet</p></div>`;
                recent.innerHTML = '';
                return;
            }
            const latest = ALL_ANNOUNCEMENTS[ALL_ANNOUNCEMENTS.length - 1];
            const card = document.createElement('div');
            card.className = 'featured-news-card';
            card.onclick = () => openAnnouncementDetail(latest);
            card.innerHTML = `
                <div class="featured-news-image">
                    <span class="icon-text" style="font-size:2rem;">▤</span>
                </div>
                <div class="featured-news-content">
                    <h3 class="featured-news-title">${ggEscape(latest.title || 'Untitled')}</h3>
                    <p class="featured-news-excerpt">${ggEscape((latest.content || '').slice(0, 160))}${latest.content && latest.content.length > 160 ? '…' : ''}</p>
                    <div class="featured-news-meta">
                        <span>${ggEscape(ggFormatDate(latest.event_date))}</span>
                        <span>${ggEscape((latest.category || 'event').toUpperCase())}</span>
                    </div>
                </div>`;
            featured.appendChild(card);

            const rest = ALL_ANNOUNCEMENTS.slice().reverse().slice(1, 5);
            rest.forEach(n => {
                const item = document.createElement('div');
                item.className = 'news-item';
                item.onclick = () => openAnnouncementDetail(n);
                item.innerHTML = `
                    <div class="news-image-sm"><span class="icon-text">▤</span></div>
                    <div class="news-content">
                        <h4 class="news-title">${ggEscape(n.title || 'Untitled')}</h4>
                        <p class="news-excerpt">${ggEscape((n.content || '').slice(0, 100))}${n.content && n.content.length > 100 ? '…' : ''}</p>
                        <div class="news-meta">
                            <span>${ggEscape(ggFormatDate(n.event_date))}</span>
                            <span>${ggEscape((n.category || 'event').toUpperCase())}</span>
                        </div>
                    </div>`;
                recent.appendChild(item);
            });
        }

        function renderUpcomingList() {
            const box = document.getElementById('eventsListContainer');
            if (!box) return;
            const today = new Date().toISOString().split('T')[0];
            const upcoming = ALL_ANNOUNCEMENTS.filter(a => (a.event_date || '').slice(0, 10) >= today).slice(0, 5);
            box.innerHTML = '';
            if (!upcoming.length) {
                box.innerHTML = `<div class="no-appointments"><span class="icon-large">▢</span><p>No upcoming announcements</p></div>`;
                return;
            }
            upcoming.forEach(n => {
                const item = document.createElement('div');
                item.className = 'event-item';
                item.onclick = () => openAnnouncementDetail(n);
                item.innerHTML = `
                    <div class="event-date"><span class="icon-text">▦</span> ${ggEscape(ggFormatDate(n.event_date))}</div>
                    <h3 class="event-title">${ggEscape(n.title || 'Untitled')}</h3>
                    <p class="event-description">${ggEscape((n.content || '').slice(0, 120))}${n.content && n.content.length > 120 ? '…' : ''}</p>
                    <div class="event-meta"><span>${ggEscape((n.category || 'event').toUpperCase())}</span><span>View →</span></div>`;
                box.appendChild(item);
            });
        }

        function openAnnouncementDetail(n) {
            const titleEl = document.getElementById('detailTitle');
            const dateEl  = document.getElementById('detailDate');
            const contEl  = document.getElementById('detailContent');
            const view    = document.getElementById('newsDetailView');
            const section = document.getElementById('newsSection');
            if (!titleEl || !contEl || !view) return;
            titleEl.textContent = n.title || 'Untitled';
            if (dateEl) dateEl.textContent = ggFormatDate(n.event_date) + '  •  ' + ((n.category || 'event').toUpperCase());
            contEl.innerHTML = `<p style="white-space: pre-wrap;">${ggEscape(n.content || '')}</p>`;
            if (section) section.style.display = 'none';
            view.style.display = 'block';
        }

        showResidentView('dashboard');
        ensureAppointmentErrorSlots();
        setupContactNumberValidation();
        setupIdRadioCards();
        wireAppointmentFieldLive('purpose', 'purposeError');
        wireAppointmentFieldLive('firstName', 'firstNameError');
        wireAppointmentFieldLive('lastName', 'lastNameError');
        wireAppointmentFieldLive('address', 'addressError');
        wireDraftAutoSave();
        document.querySelectorAll('.menu-item[data-view]').forEach(item => {
            item.addEventListener('click', () => showResidentView(item.getAttribute('data-view')));
        });
        updateUserUI();
        renderCalendar();

        const draftAtStart = loadDraft();
        const fullName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
        if (fullName && (!draftAtStart || (!draftAtStart.firstName && !draftAtStart.lastName))) {
            const parts = fullName.split(/\s+/);
            const f = document.getElementById('firstName'); if (f) f.value = parts[0] || '';
            const l = document.getElementById('lastName');  if (l) l.value = parts.slice(1).join(' ') || '';
        }

        ALL_ANNOUNCEMENTS = await ggFetchAnnouncements();
        renderAnnouncementBanner();
        renderFeaturedAndRecent();
        renderUpcomingList();
        await loadAppointments();

        function viewAppointmentDetails(id) { GG.toast('Appointment ID ' + id, 'info', 'Appointment'); }
        function rescheduleAppointment(id)   { GG.toast('Reschedule: ' + id, 'info', 'Appointment'); }
        function showAllNews() {
            const section = document.getElementById('newsSection');
            const view = document.getElementById('allNewsView');
            const container = document.getElementById('allNewsContainer');
            if (!view || !container) return;
            if (section) section.style.display = 'none';
            view.style.display = 'block';
            container.innerHTML = '';
            ALL_ANNOUNCEMENTS.slice().reverse().forEach(n => {
                const item = document.createElement('div');
                item.className = 'news-item';
                item.onclick = () => openAnnouncementDetail(n);
                item.innerHTML = `
                    <div class="news-image-sm"><span class="icon-text">▤</span></div>
                    <div class="news-content">
                        <h4 class="news-title">${ggEscape(n.title || 'Untitled')}</h4>
                        <p class="news-excerpt">${ggEscape((n.content || '').slice(0, 120))}${n.content && n.content.length > 120 ? '…' : ''}</p>
                        <div class="news-meta">
                            <span>${ggEscape(ggFormatDate(n.event_date))}</span>
                            <span>${ggEscape((n.category || 'event').toUpperCase())}</span>
                        </div>
                    </div>`;
                container.appendChild(item);
            });
        }
        function showNewsDetail() { showAllNews(); }
        function showAllEvents() {
            const section = document.getElementById('eventsSection');
            const view = document.getElementById('allEventsView');
            const upBox = document.getElementById('upcomingEventsContainer');
            const pastBox = document.getElementById('pastEventsContainer');
            if (!view) return;
            if (section) section.style.display = 'none';
            view.style.display = 'block';
            const today = new Date().toISOString().split('T')[0];
            const up = ALL_ANNOUNCEMENTS.filter(a => (a.event_date || '').slice(0, 10) >= today);
            const past = ALL_ANNOUNCEMENTS.filter(a => (a.event_date || '').slice(0, 10) < today);
            if (upBox) {
                upBox.innerHTML = up.length ? '' : `<div class="no-appointments"><span class="icon-large">▢</span><p>No upcoming</p></div>`;
                up.forEach(n => upBox.appendChild(makeEventRow(n)));
            }
            if (pastBox) {
                pastBox.innerHTML = past.length ? '' : `<div class="no-appointments"><span class="icon-large">▢</span><p>No past</p></div>`;
                past.forEach(n => pastBox.appendChild(makeEventRow(n)));
            }
        }
        function makeEventRow(n) {
            const item = document.createElement('div');
            item.className = 'event-item';
            item.onclick = () => openAnnouncementDetail(n);
            item.innerHTML = `
                <div class="event-date"><span class="icon-text">▦</span> ${ggEscape(ggFormatDate(n.event_date))}</div>
                <h3 class="event-title">${ggEscape(n.title || 'Untitled')}</h3>
                <p class="event-description">${ggEscape((n.content || '').slice(0, 120))}${n.content && n.content.length > 120 ? '…' : ''}</p>
                <div class="event-meta"><span>${ggEscape((n.category || 'event').toUpperCase())}</span><span>View →</span></div>`;
            return item;
        }
        function residentSwitchEventsTab(name) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const tab = document.querySelector(`.tab[onclick*="'${name}'"]`);
            if (tab) tab.classList.add('active');
            const content = document.getElementById(`${name}Tab`);
            if (content) content.classList.add('active');
        }

        window.showResidentView      = showResidentView;
        window.goToDashboard         = goToDashboard;
        window.goToAppointmentPage   = goToAppointmentPage;
        window.goToLandingPage       = goToLandingPage;
        window.logout                = logout;
        window.openEditProfile       = openEditProfile;
        window.closeEditProfile      = closeEditProfile;
        window.previewAvatar         = previewAvatar;
        window.saveProfile           = saveProfile;
        window.selectAppType         = selectAppType;
        window.selectIdOption        = selectIdOption;
        window.changeMonth           = changeMonth;
        window.resendCode            = function () { GG.toast('Email verification is not required.', 'info', 'Skipped'); };
        window.confirmAppointment    = confirmAppointment;
        window.backToForm            = backToForm;
        window.submitAppointment     = submitAppointment;
        window.handleIdFileChange    = handleIdFileChange;
        window.showAllAppointments   = showAllAppointments;
        window.viewAppointmentDetails = viewAppointmentDetails;
        window.rescheduleAppointment = rescheduleAppointment;
        window.showAllNews           = showAllNews;
        window.showNewsDetail        = showNewsDetail;
        window.showAllEvents         = showAllEvents;
        window.residentSwitchEventsTab = residentSwitchEventsTab;
    });
})();

/* ============================================================
   4. ADMIN MODULE
   ============================================================ */
(function adminModule() {
    'use strict';
    document.addEventListener('DOMContentLoaded', function () {
        if (!document.body.classList.contains('app-shell')) return;
        if (!document.querySelector('.tab-nav-item[data-tab]')) return;
        console.log('[Admin] module running');

        const isAdminLoggedIn = localStorage.getItem('isAdminLoggedIn');
        const loggedAdmin = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (!isAdminLoggedIn || !loggedAdmin || loggedAdmin.userType !== 'admin') {
            console.log('[Admin] No admin session — redirecting to index.html');
            window.location.href = 'index.html';
            return;
        }

        ggWireMobileMenuClose();

        let currentAppt = null;

        function getInitials(first, last) {
            const f = (first || '').trim().charAt(0).toUpperCase();
            const l = (last || '').trim().charAt(0).toUpperCase();
            return (f + l) || 'AD';
        }
        function populateAdminSidebar() {
            const first = loggedAdmin.firstName || '';
            const last  = loggedAdmin.lastName  || '';
            const full  = `${first} ${last}`.trim() || loggedAdmin.email || 'Admin';
            const nameEl = document.getElementById('adminName'); if (nameEl) nameEl.textContent = full;
            const avatarEl = document.getElementById('adminAvatar'); if (avatarEl) avatarEl.textContent = getInitials(first, last);
            const roleEl = document.getElementById('adminRole'); if (roleEl) roleEl.textContent = 'Administrator';
            const fullNameField = document.getElementById('adminFullName'); if (fullNameField) fullNameField.value = full;
            const emailField = document.getElementById('adminEmail'); if (emailField) emailField.value = loggedAdmin.email || '';
            const bioField = document.getElementById('adminBio'); if (bioField) bioField.value = 'Administrator of Info:Sched.';
        }
        populateAdminSidebar();

        function formatDate(dateString) {
            if (!dateString) return 'N/A';
            try {
                const d = new Date(dateString);
                if (isNaN(d.getTime())) return dateString;
                return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            } catch { return dateString; }
        }
        function showLoader(id) { const el = document.getElementById(id); if (el) { el.style.display = 'block'; el.classList.add('show'); } }
        function hideLoader(id) { const el = document.getElementById(id); if (el) { el.style.display = 'none'; el.classList.remove('show'); } }
        function showError(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.style.display = 'block'; el.classList.add('block'); } }
        function hideError(id) { const el = document.getElementById(id); if (el) { el.style.display = 'none'; el.classList.remove('block'); } }
        function createLoadingSpinner() {
            return `<div style="display:flex;justify-content:center;align-items:center;padding:20px;"><div style="width:40px;height:40px;border:4px solid #f3f3f3;border-top:4px solid #dc3545;border-radius:50%;animation:gg-spin 1s linear infinite;"></div></div>`;
        }

        async function updateStats() {
            try {
                if (!supabase) throw new Error('Database not connected');
                const [users, appointments] = await Promise.all([
                    supabase.from('users').select('*'),
                    supabase.from('appointments').select('*')
                ]);
                const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
                const userList = users.data || [];
                const admins    = userList.filter(u => (u.user_type || '').toLowerCase() === 'admin').length;
                const residents = userList.filter(u => (u.user_type || '').toLowerCase() !== 'admin').length;
                const aptList   = appointments.data || [];
                const active    = aptList.filter(a => {
                    const s = (a.status || 'pending').toLowerCase();
                    return s === 'pending' || s === 'approved';
                }).length;
                set('totalUsers', users.error ? 'Error' : userList.length);
                set('totalAppointments', appointments.error ? 'Error' : active);
                set('totalEvents', residents);
                set('totalAnnouncements', admins);
                updateRecentActivity();
            } catch (e) {
                console.error('updateStats:', e);
                ['totalUsers','totalAppointments','totalEvents','totalAnnouncements'].forEach(id => {
                    const el = document.getElementById(id); if (el) el.textContent = 'Error';
                });
            }
        }
        async function updateRecentActivity() {
            const list = document.getElementById('recentActivity');
            if (!list) return;
            try {
                if (!supabase) throw new Error('not connected');
                const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(5);
                list.innerHTML = '';
                if (!data || !data.length) {
                    list.innerHTML = `<li style="padding:.5rem 0;display:flex;align-items:center;"><span class="icon-text">ℹ</span><span>No recent activity</span></li>`;
                    return;
                }
                data.forEach(x => {
                    const li = document.createElement('li');
                    li.style.cssText = 'padding:.5rem 0;border-bottom:1px solid #dee2e6;display:flex;align-items:center;';
                    li.innerHTML = `<span class="icon-text" style="color:#dc3545;margin-right:.5rem;">▸</span><span>${x.title || 'Untitled'} — ${formatDate(x.created_at)}</span>`;
                    list.appendChild(li);
                });
            } catch (e) { console.error('updateRecentActivity:', e); }
        }

        async function loadContent() {
            const body = document.getElementById('contentTableBody');
            if (!body) return;
            showLoader('contentLoading'); hideError('contentError');
            body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;">${createLoadingSpinner()} Loading…</td></tr>`;
            try {
                if (!supabase) throw new Error('Database not connected');
                const { data, error } = await supabase
                    .from('announcements')
                    .select('*')
                    .order('event_date', { ascending: false });
                if (error) throw error;
                body.innerHTML = '';
                if (!data || !data.length) {
                    body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:#6c757d;">No announcements yet. Click "Add New Announcement" to create one.</td></tr>`;
                    return;
                }
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.title || 'Untitled'}</td>
                        <td>${formatDate(item.event_date)}</td>
                        <td>${(item.category || 'event').toUpperCase()}</td>
                        <td>${item.is_published ? 'Published' : 'Draft'}</td>
                        <td>
                            <div class="action-buttons" style="display:flex;gap:5px;">
                                <button class="btn btn-small btn-edit" onclick="editContent('${item.id}')">Edit</button>
                                <button class="btn btn-small btn-delete" onclick="deleteContent('${item.id}')">Delete</button>
                            </div>
                        </td>`;
                    body.appendChild(tr);
                });
            } catch (e) {
                console.error('loadContent:', e);
                showError('contentError', `Error: ${e.message}`);
                body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:#dc3545;">Error loading announcements</td></tr>`;
            } finally { hideLoader('contentLoading'); }
        }
        function addNewContent() {
            const form = document.getElementById('contentFormElement'); if (form) form.reset();
            document.getElementById('contentId').value = '';
            document.getElementById('contentTitle').value = '';
            document.getElementById('contentDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('contentCategory').value = 'event';
            document.getElementById('contentStatus').value = 'published';
            document.getElementById('contentDescription').value = '';
            const ft = document.getElementById('contentFormTitle'); if (ft) ft.textContent = 'Add New Announcement';
            const sb = document.getElementById('contentSubmitBtn'); if (sb) sb.textContent = 'Save Announcement';
            switchAdminTab('content-form');
        }
        async function editContent(id) {
            try {
                if (!supabase) throw new Error('Database not connected');
                const { data, error } = await supabase.from('announcements').select('*').eq('id', id).single();
                if (error) throw error;
                const set = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v || ''; };
                set('contentId', data.id);
                set('contentTitle', data.title);
                set('contentDate', (data.event_date || '').slice(0, 10));
                set('contentCategory', data.category || 'event');
                set('contentStatus', data.is_published ? 'published' : 'draft');
                set('contentDescription', data.content);
                const ft = document.getElementById('contentFormTitle'); if (ft) ft.textContent = 'Edit Announcement';
                const sb = document.getElementById('contentSubmitBtn'); if (sb) sb.textContent = 'Update Announcement';
                switchAdminTab('content-form');
            } catch (e) { GG.toast(e.message, 'error', 'Load Failed'); }
        }
        async function saveContent(event) {
            if (event) event.preventDefault();
            const id = document.getElementById('contentId')?.value;
            const title = document.getElementById('contentTitle')?.value?.trim();
            const date = document.getElementById('contentDate')?.value;
            const category = document.getElementById('contentCategory')?.value;
            const status = document.getElementById('contentStatus')?.value;
            const content = document.getElementById('contentDescription')?.value?.trim();

            if (!title || !date || !category || !content) {
                GG.toast('Please fill in all required fields.', 'warning', 'Missing Fields');
                return;
            }
            if (!supabase) { GG.toast('Database not connected.', 'error', 'Error'); return; }

            const payload = {
                title: title,
                content: content,
                category: category,
                event_date: date,
                is_published: status === 'published'
            };

            try {
                if (id) {
                    const { error } = await supabase.from('announcements').update(payload).eq('id', id);
                    if (error) throw error;
                    GG.toast('Announcement updated.', 'success', 'Saved');
                } else {
                    const { error } = await supabase.from('announcements').insert([payload]);
                    if (error) throw error;
                    GG.toast('Announcement created.', 'success', 'Saved');
                }
                const form = document.getElementById('contentFormElement'); if (form) form.reset();
                switchAdminTab('content-list');
                loadContent();
                updateStats();
            } catch (e) { GG.toast(e.message, 'error', 'Save Failed'); }
        }
        async function deleteContent(id) {
            if (!id) { GG.toast('Invalid ID.', 'error', 'Delete Failed'); return; }
            const ok = await GG.confirm({
                title: 'Delete announcement?',
                message: 'This action cannot be undone.',
                confirmLabel: 'Delete',
                confirmClass: 'btn btn-delete'
            });
            if (!ok) return;
            try {
                const { error } = await supabase.from('announcements').delete().eq('id', id);
                if (error) throw error;
                GG.toast('Announcement deleted.', 'success', 'Deleted');
                loadContent();
                updateStats();
            } catch (e) { GG.toast(e.message, 'error', 'Delete Failed'); }
        }

        async function loadAnnouncements() {
            const body = document.getElementById('announcementsTableBody');
            if (!body) return;
            showLoader('announcementsLoading'); hideError('announcementsError');
            body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;">${createLoadingSpinner()} Loading…</td></tr>`;
            try {
                if (!supabase) throw new Error('Database not connected');
                const { data, error } = await supabase.from('users').select('*').eq('user_type', 'admin');
                if (error) throw error;
                body.innerHTML = '';
                if (!data || !data.length) {
                    body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:#6c757d;">No admins found.</td></tr>`;
                    return;
                }
                data.forEach(a => {
                    const isMe = (a.email || '').toLowerCase() === (loggedAdmin.email || '').toLowerCase();
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>
                            <div style="display:flex;align-items:center;gap:0.6rem;">
                                ${ggBuildAvatarHtml(a, 36)}
                                <span>${a.first_name || ''} ${a.last_name || ''}${isMe ? ' <span style="color:#1e7e34;font-weight:700;font-size:0.75rem;">(You)</span>' : ''}</span>
                            </div>
                        </td>
                        <td>${a.email || ''}</td>
                        <td>${a.dob || '—'}</td>
                        <td>${a.user_type || ''}</td>
                        <td><span style="color:#666;">—</span></td>`;
                    body.appendChild(tr);
                });
            } catch (e) {
                showError('announcementsError', `Error: ${e.message}`);
                body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:#dc3545;">Error loading admins</td></tr>`;
            } finally { hideLoader('announcementsLoading'); }
        }

        async function loadAppointments() {
            const body = document.getElementById('appointmentsTableBody');
            if (!body) return;
            showLoader('appointmentsLoading'); hideError('appointmentsError');
            body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;">${createLoadingSpinner()} Loading…</td></tr>`;
            try {
                if (!supabase) throw new Error('Database not connected');
                const [aptRes, usrRes] = await Promise.all([
                    supabase.from('appointments').select('*').order('created_at', { ascending: false }),
                    supabase.from('users').select('email, first_name, last_name')
                ]);
                if (aptRes.error) throw aptRes.error;
                let appointments = aptRes.data || [];
                appointments = await ggAutoCompleteAppointments(appointments);
                const users = usrRes.data || [];
                body.innerHTML = '';

                const statusFilter = (document.getElementById('appointmentStatusFilter')?.value || 'all').toLowerCase();
                const dateFilter   = document.getElementById('appointmentDateFilter')?.value || '';

                let filtered = appointments;
                if (statusFilter !== 'all') {
                    filtered = filtered.filter(a => (a.status || 'pending').toLowerCase() === statusFilter);
                }
                if (dateFilter) {
                    filtered = filtered.filter(a => {
                        const d = ggParseApptDateTime(a);
                        if (!d) return false;
                        const iso = d.toISOString().split('T')[0];
                        return iso === dateFilter;
                    });
                }

                if (!filtered.length) {
                    body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#6c757d;">No appointments found.</td></tr>`;
                    return;
                }
                filtered.forEach(a => {
                    const u = users.find(x => x.email === a.user_email);
                    const name = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : (a.user_email || 'Unknown');
                    const status = (a.status || 'pending').toLowerCase();
                    const statusLabel = ggStatusLabel(status);
                    const statusClass = ggStatusClass(status);
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${a.id || ''}</td>
                        <td>${name}</td>
                        <td>${a.type || 'Appointment'}</td>
                        <td>${a.date || ''}</td>
                        <td><span class="appointment-status ${statusClass}">${statusLabel}</span></td>
                        <td>
                            <div class="action-buttons" style="display:flex;gap:5px;">
                                <button class="btn btn-small btn-view"   onclick="viewAppointment('${a.id}')">View</button>
                                <button class="btn btn-small btn-delete" onclick="deleteAppointment('${a.id}')">Delete</button>
                            </div>
                        </td>`;
                    body.appendChild(tr);
                });
            } catch (e) {
                showError('appointmentsError', `Error: ${e.message}`);
                body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#dc3545;">Error loading appointments</td></tr>`;
            } finally { hideLoader('appointmentsLoading'); }
        }
        function filterAppointments() { loadAppointments(); }

        async function viewAppointment(id) {
            try {
                if (!supabase) throw new Error('Database not connected');
                const { data: a, error } = await supabase.from('appointments').select('*').eq('id', id).single();
                if (error) throw error;
                currentAppt = a;

                const status = (a.status || 'pending').toLowerCase();
                const statusLabel = ggStatusLabel(status);
                const statusClass = ggStatusClass(status);

                let userName = a.user_email || 'Unknown';
                try {
                    const { data: u } = await supabase.from('users').select('first_name, last_name').eq('email', a.user_email).single();
                    if (u) userName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || userName;
                } catch (e) {}

                const idImages = (a.id_front_url || a.id_back_url) ? `
                    <div class="admin-id-images">
                        <div class="admin-id-col">
                            <div class="admin-id-label">ID Type</div>
                            <div class="admin-id-value">${ggEscape(a.id_type || 'Not specified')}</div>
                        </div>
                        <div class="admin-id-col">
                            <div class="admin-id-label">Front</div>
                            ${a.id_front_url ? `<img src="${a.id_front_url}" alt="ID Front" class="admin-id-img" onclick="window.open('${a.id_front_url}','_blank')">` : `<div class="admin-id-img-empty">No image</div>`}
                        </div>
                        <div class="admin-id-col">
                            <div class="admin-id-label">Back</div>
                            ${a.id_back_url ? `<img src="${a.id_back_url}" alt="ID Back" class="admin-id-img" onclick="window.open('${a.id_back_url}','_blank')">` : `<div class="admin-id-img-empty">No image</div>`}
                        </div>
                    </div>` : '';

                const rejectNote = (a.reject_reason && status === 'cancelled') ? `
                    <div class="admin-reject-note"><strong>Rejection reason:</strong> ${ggEscape(a.reject_reason)}</div>
                ` : '';

                const content = document.getElementById('appointmentDetailsContent');
                if (content) content.innerHTML = `
                    <div style="padding:0.5rem 0;">
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:1rem;">
                            <h3 style="color:#d32f2f;margin:0;">Appointment Details</h3>
                            <span class="appointment-status ${statusClass}">${statusLabel}</span>
                        </div>
                        <p><strong>ID:</strong> ${a.id}</p>
                        <p><strong>Resident:</strong> ${ggEscape(userName)}</p>
                        <p><strong>Email:</strong> ${ggEscape(a.user_email || 'N/A')}</p>
                        <p><strong>Service Type:</strong> ${ggEscape(a.type || 'N/A')}</p>
                        <p><strong>Date:</strong> ${ggEscape(a.date || 'N/A')}</p>
                        <p><strong>Time:</strong> ${ggEscape(a.time || 'N/A')}</p>
                        <p><strong>Message:</strong> ${ggEscape(a.message || 'N/A')}</p>
                        ${rejectNote}
                        ${idImages}
                    </div>`;

                const rejectBox = document.getElementById('rejectReasonBox');
                if (rejectBox) rejectBox.style.display = 'none';
                const rejectInput = document.getElementById('rejectReasonInput');
                if (rejectInput) rejectInput.value = '';

                const btnApprove  = document.getElementById('btnApprove');
                const btnReject   = document.getElementById('btnReject');
                const btnComplete = document.getElementById('btnComplete');

                if (btnApprove)  btnApprove.style.display  = (status === 'pending') ? '' : 'none';
                if (btnReject)   btnReject.style.display   = (status === 'pending' || status === 'approved') ? '' : 'none';
                if (btnComplete) btnComplete.style.display = (status === 'approved') ? '' : 'none';

                toggleModal('appointmentModal');
            } catch (e) { GG.toast(e.message, 'error', 'Load Failed'); }
        }

        async function approveAppointment() {
            if (!currentAppt) return;
            const ok = await GG.confirm({
                title: 'Approve this appointment?',
                message: 'The resident will see the status change to Approved.',
                confirmLabel: 'Approve',
                confirmClass: 'btn btn-approve'
            });
            if (!ok) return;
            try {
                const { data, error } = await supabase
                    .from('appointments')
                    .update({ status: 'approved', approved_at: new Date().toISOString(), reject_reason: null })
                    .eq('id', currentAppt.id)
                    .select();
                if (error) throw error;
                if (!data || !data.length) throw new Error('Update did not affect any row. Check RLS policy.');
                GG.toast('Appointment approved.', 'success', 'Approved');
                toggleModal('appointmentModal');
                loadAppointments();
                updateStats();
            } catch (e) {
                console.error('Approve failed:', e);
                GG.toast(e.message || 'Approve failed.', 'error', 'Approve Failed');
            }
        }

        function openRejectPrompt() {
            const box = document.getElementById('rejectReasonBox');
            if (box) box.style.display = 'block';
            const input = document.getElementById('rejectReasonInput');
            if (input) { input.focus(); }
        }
        function cancelRejectPrompt() {
            const box = document.getElementById('rejectReasonBox');
            if (box) box.style.display = 'none';
            const err = document.getElementById('rejectReasonError');
            if (err) { err.style.display = 'none'; err.classList.remove('show'); }
        }
        async function confirmRejectAppointment() {
            if (!currentAppt) return;
            const input = document.getElementById('rejectReasonInput');
            const err = document.getElementById('rejectReasonError');
            const reason = (input?.value || '').trim();

            if (!reason) {
                if (err) { err.style.display = 'block'; err.classList.add('show'); }
                return;
            }
            if (err) { err.style.display = 'none'; err.classList.remove('show'); }

            try {
                const { data, error } = await supabase
                    .from('appointments')
                    .update({ status: 'cancelled', reject_reason: reason })
                    .eq('id', currentAppt.id)
                    .select();
                if (error) throw error;
                if (!data || !data.length) throw new Error('Update did not affect any row. Check RLS policy.');
                GG.toast('Appointment rejected.', 'success', 'Rejected');
                toggleModal('appointmentModal');
                loadAppointments();
                updateStats();
            } catch (e) {
                console.error('Reject failed:', e);
                GG.toast(e.message || 'Reject failed.', 'error', 'Reject Failed');
            }
        }

        async function deleteAppointment(id) {
            const ok = await GG.confirm({
                title: 'Delete appointment?',
                message: 'This action cannot be undone.',
                confirmLabel: 'Delete',
                confirmClass: 'btn btn-delete'
            });
            if (!ok) return;
            try {
                const { error } = await supabase.from('appointments').delete().eq('id', id);
                if (error) throw error;
                GG.toast('Appointment deleted.', 'success', 'Deleted');
                loadAppointments(); updateStats();
            } catch (e) { GG.toast(e.message, 'error', 'Delete Failed'); }
        }

        async function loadUsers() {
            const body = document.getElementById('usersTableBody');
            if (!body) return;
            showLoader('usersLoading'); hideError('usersError');
            body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;">${createLoadingSpinner()} Loading…</td></tr>`;
            try {
                if (!supabase) throw new Error('Database not connected');
                const { data, error } = await supabase.from('users').select('*');
                if (error) throw error;
                body.innerHTML = '';
                if (!data || !data.length) {
                    body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:#6c757d;">No users found.</td></tr>`;
                    return;
                }

                const admins = data.filter(u => (u.user_type || '').toLowerCase() === 'admin');
                const residents = data.filter(u => (u.user_type || '').toLowerCase() !== 'admin');

                const sortByName = (a, b) => {
                    const na = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase();
                    const nb = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase();
                    return na.localeCompare(nb);
                };
                admins.sort(sortByName);
                residents.sort(sortByName);
                const sorted = admins.concat(residents);

                sorted.forEach(u => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${u.id || ''}</td>
                        <td>
                            <div style="display:flex;align-items:center;gap:0.6rem;">
                                ${ggBuildAvatarHtml(u, 36)}
                                <span>${u.first_name || ''} ${u.last_name || ''}</span>
                            </div>
                        </td>
                        <td>${u.email || ''}</td>
                        <td>${u.phone || '—'}</td>
                        <td>${u.password || '—'}</td>
                        <td>${u.address || '—'}</td>
                        <td>${u.dob || '—'}</td>
                        <td>${u.user_type || 'resident'}</td>
                        <td>
                            <div class="action-buttons" style="display:flex;gap:5px;">
                                <button class="btn btn-small btn-view"   onclick="viewUser('${u.email}')">View</button>
                                <button class="btn btn-small btn-delete" onclick="deleteUser('${u.email}')">Delete</button>
                            </div>
                        </td>`;
                    body.appendChild(tr);
                });
            } catch (e) {
                showError('usersError', `Error: ${e.message}`);
                body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:#dc3545;">Error loading users</td></tr>`;
            } finally { hideLoader('usersLoading'); }
        }
        async function viewUser(email) {
            try {
                if (!supabase) throw new Error('Database not connected');
                const { data: u, error } = await supabase.from('users').select('*').eq('email', email).single();
                if (error) throw error;
                const content = document.getElementById('appointmentDetailsContent');
                if (content) content.innerHTML = `
                    <div style="padding:1rem 0;">
                        <h3 style="color:#d32f2f;">User Details</h3>
                        <div style="display:flex;justify-content:center;margin:1rem 0;">
                            ${ggBuildAvatarHtml(u, 80, 3)}
                        </div>
                        <p><strong>ID:</strong> ${u.id || '—'}</p>
                        <p><strong>Name:</strong> ${u.first_name || ''} ${u.last_name || ''}</p>
                        <p><strong>Email:</strong> ${u.email || ''}</p>
                        <p><strong>Phone:</strong> ${u.phone || '—'}</p>
                        <p><strong>Address:</strong> ${u.address || '—'}</p>
                        <p><strong>DOB:</strong> ${u.dob || '—'}</p>
                        <p><strong>Type:</strong> ${u.user_type || 'resident'}</p>
                    </div>`;
                const actions = document.getElementById('appointmentAdminActions');
                if (actions) actions.style.display = 'none';
                const rejectBox = document.getElementById('rejectReasonBox');
                if (rejectBox) rejectBox.style.display = 'none';
                toggleModal('appointmentModal');
            } catch (e) { GG.toast(e.message, 'error', 'Load Failed'); }
        }
        async function deleteUser(email) {
            const ok = await GG.confirm({
                title: 'Delete user?',
                message: `Delete account ${email}? This also removes their appointments.`,
                confirmLabel: 'Delete',
                confirmClass: 'btn btn-delete'
            });
            if (!ok) return;
            try {
                await supabase.from('appointments').delete().eq('user_email', email);
                const { error } = await supabase.from('users').delete().eq('email', email);
                if (error) throw error;
                GG.toast('User deleted.', 'success', 'Deleted');
                loadUsers(); updateStats();
            } catch (e) { GG.toast(e.message, 'error', 'Delete Failed'); }
        }

        function showSection(sectionId) {
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
            const target = document.getElementById(sectionId);
            if (target) target.classList.add('active');
            const menu = document.querySelector(`.menu-item[data-target="${sectionId}"]`);
            if (menu) menu.classList.add('active');
            switch (sectionId) {
                case 'dashboard':     updateStats();       break;
                case 'content':       loadContent();       break;
                case 'announcements': loadAnnouncements(); break;
                case 'appointments':  loadAppointments();  break;
                case 'users':         loadUsers();         break;
            }
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const backdrop = document.getElementById('sidebarBackdrop');
                if (sidebar && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                    if (backdrop) backdrop.classList.remove('active');
                }
            }
        }
        function switchAdminTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-nav-item').forEach(i => i.classList.remove('active'));
            const target = document.getElementById(tabId);
            if (target) target.classList.add('active');
            const nav = document.querySelector(`.tab-nav-item[data-tab="${tabId}"]`);
            if (nav) nav.classList.add('active');
        }
        function toggleModal(id) {
            const m = document.getElementById(id);
            if (!m) return;
            m.classList.toggle('active');
            if (id === 'appointmentModal' && m.classList.contains('active')) {
                const actions = document.getElementById('appointmentAdminActions');
                if (actions) actions.style.display = '';
            }
        }
        function refreshAllData() {
            updateStats(); loadContent(); loadAnnouncements(); loadAppointments(); loadUsers();
            GG.toast('All data refreshed.', 'success', 'Refreshed');
        }
        async function signOut() {
            const ok = await GG.confirm({
                title: 'Sign out?',
                message: 'You will be returned to the home page.',
                confirmLabel: 'Sign Out', cancelLabel: 'Stay'
            });
            if (!ok) return;
            localStorage.removeItem('isAdminLoggedIn');
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        }

        document.querySelectorAll('.menu-item[data-target]').forEach(item => {
            item.addEventListener('click', () => showSection(item.getAttribute('data-target')));
        });
        document.querySelectorAll('.tab-nav-item').forEach(item => {
            item.addEventListener('click', () => switchAdminTab(item.getAttribute('data-tab')));
        });
        const cf = document.getElementById('contentFormElement');
        if (cf) cf.addEventListener('submit', saveContent);
        const pf = document.getElementById('profileForm');
        if (pf) pf.addEventListener('submit', e => { e.preventDefault(); GG.toast('Profile updated (demo).', 'success', 'Saved'); toggleModal('profileModal'); });
        document.querySelectorAll('.modal').forEach(m => {
            m.addEventListener('click', e => { if (e.target === m) toggleModal(m.id); });
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') document.querySelectorAll('.modal.active').forEach(m => toggleModal(m.id));
        });
        document.querySelectorAll('.close-modal').forEach(b => {
            b.addEventListener('click', function () {
                const m = this.closest('.modal'); if (m) toggleModal(m.id);
            });
        });
        showSection('dashboard');

        window.showSection = showSection;
        window.toggleModal = toggleModal;
        window.refreshAllData = refreshAllData;
        window.signOut = signOut;
        window.addNewContent = addNewContent;
        window.editContent = editContent;
        window.deleteContent = deleteContent;
        window.switchTab = switchAdminTab;
        window.viewAppointment = viewAppointment;
        window.approveAppointment = approveAppointment;
        window.openRejectPrompt = openRejectPrompt;
        window.cancelRejectPrompt = cancelRejectPrompt;
        window.confirmRejectAppointment = confirmRejectAppointment;
        window.deleteAppointment = deleteAppointment;
        window.filterAppointments = filterAppointments;
        window.viewUser = viewUser;
        window.deleteUser = deleteUser;
    });
})();