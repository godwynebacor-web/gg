/* ============================================================
   gg.js — merged script for Info:Sched
   Backend: BACOR University Supabase project
   Tables: users, appointments
   Login: match users.email + users.password, route by user_type
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
            function close(result) {
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

/* ============================================================
   1. LANDING MODULE (placeholder data)
   ============================================================ */
(function landingModule() {
    'use strict';
    document.addEventListener('DOMContentLoaded', function () {
        if (!document.body.classList.contains('landing-page')) return;
        console.log('[Landing] module running');

        const PLACEHOLDER_EVENTS = [
            { id: 'e1', title: 'Sample Event 1 — Replace me', date: isoOffset(3),  category: 'community',    type: 'event', status: 'upcoming',  description: 'Temporary placeholder event.' },
            { id: 'e2', title: 'Sample Event 2 — Replace me', date: isoOffset(10), category: 'cultural',     type: 'event', status: 'upcoming',  description: 'Temporary placeholder event.' },
            { id: 'e3', title: 'Sample Event 3 — Replace me', date: isoOffset(0),  category: 'healthcare',   type: 'event', status: 'today',     description: 'Temporary placeholder event.' },
            { id: 'e4', title: 'Sample Event 4 — Replace me', date: isoOffset(-5), category: 'infrastructure', type: 'event', status: 'completed', description: 'Temporary placeholder event.' }
        ];
        const PLACEHOLDER_NEWS = [
            { id: 'n1', title: 'Sample News 1 — Replace me', date: isoOffset(-1), category: 'announcement', type: 'news', status: 'published', description: 'Temporary placeholder news.' },
            { id: 'n2', title: 'Sample News 2 — Replace me', date: isoOffset(-4), category: 'update',       type: 'news', status: 'published', description: 'Temporary placeholder news.' }
        ];
        const PLACEHOLDER_ANNOUNCEMENTS = [
            'TEMPORARY: This announcement is a placeholder.',
            'Welcome to Info:Sched — stay tuned for community updates.',
            'Contact the barangay office for more information.'
        ];

        function isoOffset(days) {
            const d = new Date();
            d.setDate(d.getDate() + days);
            return d.toISOString().split('T')[0];
        }
        function fmtDate(d) {
            if (!d) return '';
            const date = new Date(d);
            if (isNaN(date)) return '';
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }

        function showLandingSection(sectionId) {
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            const target = document.getElementById(sectionId);
            if (target) target.classList.add('active');
            const tab = document.querySelector(`.nav-tab[data-target="${sectionId}"]`);
            if (tab) tab.classList.add('active');
        }

        function loadAnnouncements() {
            const el = document.getElementById('announcementText');
            if (!el) return;
            el.textContent = PLACEHOLDER_ANNOUNCEMENTS.join('   •   ');
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
            const upcoming = PLACEHOLDER_EVENTS.filter(e => e.date >= today).length;
            const month = PLACEHOLDER_EVENTS.filter(e => e.date.startsWith(thisMonth)).length;
            const todayCount = PLACEHOLDER_EVENTS.filter(e => e.date === today).length;
            const a = document.getElementById('upcomingEventsCount'); if (a) a.textContent = upcoming;
            const b = document.getElementById('monthEventsCount');    if (b) b.textContent = month;
            const c = document.getElementById('todayEventsCount');    if (c) c.textContent = todayCount;
        }

        let calCursor = new Date();
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
                const evs = PLACEHOLDER_EVENTS.filter(e => e.date === iso);
                evs.forEach(ev => {
                    const chip = document.createElement('div');
                    chip.className = 'event';
                    chip.textContent = ev.title;
                    chip.onclick = (e) => { e.stopPropagation(); openEventModal(ev); };
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
            PLACEHOLDER_NEWS.forEach(n => {
                const card = document.createElement('div');
                card.className = 'news-highlight';
                card.innerHTML = `
                    <div class="news-image"><span class="icon-text">▤</span></div>
                    <div class="news-content">
                        <h4>${n.title}</h4>
                        <div class="news-date"><span class="icon-text">▦</span> ${fmtDate(n.date)}</div>
                        <p>${n.description}</p>
                        <button class="read-more" onclick="landingOpenFullInfo('${n.id}')">Read more</button>
                    </div>`;
                box.appendChild(card);
            });
        }

        function renderEventsGrid() {
            const grid = document.getElementById('eventsGrid');
            if (!grid) return;
            grid.innerHTML = '';
            const catFilter = document.getElementById('categoryFilter')?.value || 'all';
            const typeFilter = document.getElementById('typeFilter')?.value || 'all';
            const statusFilter = document.getElementById('statusFilter')?.value || 'all';
            const today = new Date().toISOString().split('T')[0];
            const combined = PLACEHOLDER_EVENTS.concat(PLACEHOLDER_NEWS);
            const filtered = combined.filter(item => {
                if (catFilter !== 'all' && item.category !== catFilter) return false;
                if (typeFilter !== 'all' && item.type !== typeFilter) return false;
                if (statusFilter === 'upcoming' && !(item.date >= today)) return false;
                if (statusFilter === 'today' && item.date !== today) return false;
                if (statusFilter === 'completed' && !(item.date < today)) return false;
                return true;
            });
            if (filtered.length === 0) {
                grid.innerHTML = `<div class="empty-state"><span class="icon-large">▢</span><h3>No items</h3><p>Nothing matches the current filters.</p></div>`;
                return;
            }
            filtered.forEach(item => {
                const card = document.createElement('div');
                card.className = 'news-highlight';
                card.innerHTML = `
                    <div class="news-image"><span class="icon-text">${item.type === 'event' ? '▦' : '▤'}</span></div>
                    <div class="news-content">
                        <h4>${item.title}</h4>
                        <div class="news-date"><span class="icon-text">▦</span> ${fmtDate(item.date)}</div>
                        <p>${item.description}</p>
                        <button class="read-more" onclick="landingOpenEvent('${item.id}')">View details</button>
                    </div>`;
                grid.appendChild(card);
            });
        }
        function applyLandingFilters() { renderEventsGrid(); }

        function openEventModal(item) {
            const modal = document.getElementById('eventModal');
            if (!modal) return;
            document.getElementById('modalTitle').textContent = item.title || 'Event';
            document.getElementById('modalImage').src = 'https://www.projectlupad.com/wp-content/uploads/2019/04/Easter-Sunday-2019-at-Opol-Beach-Aerial-View-Copyright-to-Project-LUPAD-0010.jpg';
            document.getElementById('modalDate').textContent = fmtDate(item.date);
            document.getElementById('modalCategory').textContent = item.category || '';
            document.getElementById('modalType').textContent = item.type || '';
            document.getElementById('modalStatus').textContent = item.status || '';
            document.getElementById('modalDescription').textContent = item.description || '';
            modal.classList.add('active');
        }
        function closeEventModal() {
            const m = document.getElementById('eventModal');
            if (m) m.classList.remove('active');
        }
        function openFullInfoModal(item) {
            const modal = document.getElementById('fullInfoModal');
            if (!modal) return;
            document.getElementById('fullInfoTitle').textContent = item.title || 'Info';
            document.getElementById('fullInfoContent').innerHTML = `
                <p><strong>Date:</strong> ${fmtDate(item.date)}</p>
                <p><strong>Category:</strong> ${item.category || ''}</p>
                <p><strong>Type:</strong> ${item.type || ''}</p>
                <p style="margin-top:1rem;">${item.description || ''}</p>
                <p style="margin-top:1rem;color:#a00;font-weight:600;">TEMPORARY placeholder content.</p>`;
            modal.classList.add('active');
        }
        function closeFullInfoModal() {
            const m = document.getElementById('fullInfoModal');
            if (m) m.classList.remove('active');
        }

        loadAnnouncements();
        updateHeroStats();
        renderCalendar();
        renderNewsHighlights();
        renderEventsGrid();

        document.querySelectorAll('.nav-tab[data-target]').forEach(tab => {
            tab.addEventListener('click', () => showLandingSection(tab.getAttribute('data-target')));
        });
        const prev = document.getElementById('prevMonth'); if (prev) prev.onclick = prevMonth;
        const next = document.getElementById('nextMonth'); if (next) next.onclick = nextMonth;
        ['categoryFilter', 'typeFilter', 'statusFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.onchange = applyLandingFilters;
        });
        const c1 = document.getElementById('closeModal');        if (c1) c1.onclick = closeEventModal;
        const c2 = document.getElementById('closeFullInfoModal'); if (c2) c2.onclick = closeFullInfoModal;
        document.querySelectorAll('.modal-overlay').forEach(ov => {
            ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('active'); });
        });

        window.landingOpenEvent = function (id) {
            const item = PLACEHOLDER_EVENTS.concat(PLACEHOLDER_NEWS).find(x => x.id === id);
            if (item) openEventModal(item);
        };
        window.landingOpenFullInfo = function (id) {
            const item = PLACEHOLDER_NEWS.find(x => x.id === id) || PLACEHOLDER_EVENTS.find(x => x.id === id);
            if (item) openFullInfoModal(item);
        };
    });
})();

/* ============================================================
   2. AUTH MODULE — BACOR backend
   ============================================================ */
(function authModule() {
    'use strict';
    document.addEventListener('DOMContentLoaded', function () {
        if (!document.body.classList.contains('auth-page')) return;
        console.log('[Auth] module running (BACOR backend)');

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

        function togglePassword(fieldId, button) {
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
        function showFieldError(inputEl, errorElement, message) {
            if (inputEl) { inputEl.classList.add('input-error'); inputEl.classList.remove('input-success'); }
            if (errorElement) { errorElement.textContent = message; errorElement.style.display = 'block'; errorElement.classList.add('show'); }
        }
        function clearFieldError(inputEl, errorElement) {
            if (inputEl) inputEl.classList.remove('input-error');
            if (errorElement) { errorElement.style.display = 'none'; errorElement.classList.remove('show'); }
        }
        function isValidName(name) { return /^[A-Za-z\s\-']+$/.test(name); }
        function isAtLeast18YearsOld(birthDate) {
            const today = new Date();
            const birth = new Date(birthDate);
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
            return age >= 18;
        }
        function validatePasswordStrength(pw) {
            return pw.length >= 8 && /[0-9]/.test(pw) && /[A-Za-z]/.test(pw) && /[!@#$%^&*(),.?":{}|<>]/.test(pw);
        }
        function validateGmail(email) {
            return typeof email === 'string' && email.toLowerCase().endsWith('@gmail.com');
        }

        /* LOGIN */
        function validateLoginEmail() {
            const input = document.getElementById('loginEmail');
            const err = document.getElementById('loginEmailError');
            if (!input) return false;
            const v = input.value.trim();
            if (!v) { showFieldError(input, err, 'Please enter your email address'); return false; }
            if (!validateGmail(v)) { showFieldError(input, err, 'Email must be a Gmail address (@gmail.com)'); return false; }
            clearFieldError(input, err); return true;
        }
        function validateLoginPassword() {
            const input = document.getElementById('loginPassword');
            const err = document.getElementById('loginPasswordError');
            if (!input) return false;
            if (!input.value) { showFieldError(input, err, 'Please enter your password'); return false; }
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

                console.log('🔍 Checking login for:', email);
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', email)
                    .eq('password', password);

                if (error) throw new Error(error.message);
                if (!data || data.length === 0) throw new Error('Invalid email or password.');

                const user = data[0];
                const userType = (user.user_type || 'student').toLowerCase();
                console.log('✅ User found:', user.first_name, '| type:', userType);

                localStorage.setItem('currentUser', JSON.stringify({
                    firstName: user.first_name || '',
                    lastName: user.last_name || '',
                    email: user.email || '',
                    dob: user.dob || '',
                    userType: userType
                }));
                sessionStorage.setItem('currentUser', JSON.stringify({
                    id: user.id,
                    email: user.email,
                    full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                    fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                    phone: '',
                    role: userType
                }));

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
                    GG.toast(`Welcome back, ${user.first_name || 'Student'}!`, 'success', 'Signed In');
                    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
                }
            } catch (err) {
                console.error('Sign in error:', err);
                if (spinner) { spinner.style.display = 'none'; spinner.classList.remove('show'); }
                if (btn) { btn.disabled = false; btn.innerHTML = '<span class="icon-text">→</span> Sign In'; }
                GG.toast(err.message, 'error', 'Sign In Failed');
            }
        }

        /* SIGNUP */
        function validateFullName() {
            const input = document.getElementById('signupFullName');
            const err = document.getElementById('signupFullNameError');
            if (!input) return false;
            const v = input.value.trim();
            if (!v) { showFieldError(input, err, 'Full name is required'); return false; }
            if (v.length < 2) { showFieldError(input, err, 'Full name must be at least 2 characters'); return false; }
            if (!isValidName(v)) { showFieldError(input, err, 'Name cannot contain numbers or special characters'); return false; }
            clearFieldError(input, err); return true;
        }
        function validateBirthDate() {
            const input = document.getElementById('signupBirthDate');
            const err = document.getElementById('signupBirthDateError');
            if (!input) return false;
            const v = input.value;
            if (!v) { showFieldError(input, err, 'Date of birth is required'); return false; }
            if (!isAtLeast18YearsOld(v)) { showFieldError(input, err, 'You must be at least 18 years old'); return false; }
            clearFieldError(input, err); return true;
        }
        function validateAddress() {
            const input = document.getElementById('signupAddress');
            const err = document.getElementById('signupAddressError');
            if (!input) return false;
            const v = input.value.trim();
            if (!v) { showFieldError(input, err, 'Address is required'); return false; }
            if (v.length < 10) { showFieldError(input, err, 'Please provide a complete address'); return false; }
            clearFieldError(input, err); return true;
        }
        function validatePhone() {
            const input = document.getElementById('signupPhoneNumber');
            const err = document.getElementById('signupPhoneError');
            if (!input) return false;
            const v = input.value.trim();
            const re = /^09[0-9]{9}$/;
            if (!v) { showFieldError(input, err, 'Phone number is required'); return false; }
            if (!re.test(v)) { showFieldError(input, err, 'Please enter a valid phone number (09XXXXXXXXX)'); return false; }
            clearFieldError(input, err); return true;
        }
        async function validateSignupEmail() {
            const input = document.getElementById('signupEmail');
            const err = document.getElementById('signupEmailError');
            if (!input) return false;
            const email = input.value.trim();
            if (!email) { showFieldError(input, err, 'Email is required'); return false; }
            if (!validateGmail(email)) { showFieldError(input, err, 'Email must be a Gmail address (@gmail.com)'); return false; }
            try {
                if (supabase) {
                    const { data, error } = await supabase.from('users').select('email').eq('email', email.toLowerCase()).limit(1);
                    if (!error && data && data.length > 0) {
                        showFieldError(input, err, 'This email is already registered.');
                        return false;
                    }
                }
            } catch (_) { }
            clearFieldError(input, err); return true;
        }
        function validateSignupPassword() {
            const input = document.getElementById('signupPassword');
            const err = document.getElementById('signupPasswordError');
            if (!input) return false;
            const v = input.value;
            if (!v) { showFieldError(input, err, 'Password is required'); return false; }
            if (!validatePasswordStrength(v)) { showFieldError(input, err, 'Password needs 8+ chars, 1 number, 1 letter, 1 symbol'); return false; }
            clearFieldError(input, err); return true;
        }
        function validateConfirmPassword() {
            const p1 = document.getElementById('signupPassword');
            const p2 = document.getElementById('signupConfirmPassword');
            const err = document.getElementById('signupConfirmPasswordError');
            if (!p1 || !p2) return false;
            if (!p2.value) { showFieldError(p2, err, 'Please confirm your password'); return false; }
            if (p1.value !== p2.value) { showFieldError(p2, err, 'Passwords do not match'); return false; }
            clearFieldError(p2, err); return true;
        }

        async function registerUser() {
            const btn = document.getElementById('registerBtn');
            if (btn) { btn.disabled = true; btn.innerHTML = '<span class="icon-text">⋯</span> Processing…'; }
            const success = document.getElementById('signupSuccessMessage');
            if (success) { success.style.display = 'none'; success.classList.remove('show'); }

            const checks = [
                validateFullName(),
                validateBirthDate(),
                validateAddress(),
                validatePhone(),
                await validateSignupEmail(),
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

                const fullName = document.getElementById('signupFullName').value.trim();
                const parts = fullName.split(/\s+/);
                const firstName = parts.shift() || '';
                const lastName = parts.join(' ') || '';
                const dob = document.getElementById('signupBirthDate').value;
                const email = document.getElementById('signupEmail').value.trim().toLowerCase();
                const password = document.getElementById('signupPassword').value;

                const payload = {
                    first_name: firstName,
                    last_name: lastName,
                    email: email,
                    password: password,
                    dob: dob,
                    user_type: 'student'
                };

                const { error } = await supabase.from('users').insert([payload]).select();
                if (error) {
                    if (error.message && error.message.toLowerCase().includes('duplicate')) {
                        throw new Error('This email is already registered.');
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

        /* FORGOT */
        function validateResetEmail() {
            const input = document.getElementById('forgotResetEmail');
            const err = document.getElementById('forgotResetEmailError');
            if (!input) return false;
            const v = input.value.trim();
            if (!v) { showFieldError(input, err, 'Please enter your email address'); return false; }
            if (!validateGmail(v)) { showFieldError(input, err, 'Email must be a Gmail address (@gmail.com)'); return false; }
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

        const lfEmail = document.getElementById('loginEmail'); if (lfEmail) lfEmail.addEventListener('blur', validateLoginEmail);
        const lfPass = document.getElementById('loginPassword'); if (lfPass) lfPass.addEventListener('blur', validateLoginPassword);
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.addEventListener('submit', e => { e.preventDefault(); signIn(); });
        const rf = document.getElementById('registerForm');
        if (rf) rf.addEventListener('submit', e => { e.preventDefault(); registerUser(); });
        const fp = document.getElementById('forgotPasswordForm');
        if (fp) fp.addEventListener('submit', e => { e.preventDefault(); resetPassword(); });
        const cf = document.getElementById('signupConfirmPassword');
        if (cf) cf.addEventListener('input', () => { if (document.getElementById('signupPassword')?.value) validateConfirmPassword(); });

        const panelFromUrl = new URLSearchParams(window.location.search).get('panel');
        showAuthPanel(panelFromUrl || 'login');

        window.showAuthPanel      = showAuthPanel;
        window.goToLandingPage    = goToLandingPage;
        window.goToLoginPanel     = goToLoginPanel;
        window.goToSignupPanel    = goToSignupPanel;
        window.goToForgotPanel    = goToForgotPanel;
        window.goToLoginPage      = goToLoginPanel;
        window.goToSignup         = goToSignupPanel;
        window.goToForgotPassword = goToForgotPanel;
        window.togglePassword     = togglePassword;
        window.signIn             = signIn;
        window.registerUser       = registerUser;
        window.resetPassword      = resetPassword;
        window.showDbSetupModal   = function () {};
        window.closeDbSetupModal  = function () {};
        window.closeModal         = function () {};
    });
})();

/* ============================================================
   3. RESIDENT MODULE — BACOR backend
   ============================================================ */
(function residentModule() {
    'use strict';
    document.addEventListener('DOMContentLoaded', function () {
        if (!document.body.classList.contains('app-shell')) return;
        if (document.querySelector('.tab-nav-item[data-tab]')) return;
        if (!document.getElementById('appointment-view')) return;
        console.log('[Resident] module running (BACOR backend)');

        const bacorUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (!bacorUser) {
            GG.toast('Please sign in to access the dashboard.', 'warning', 'Not Signed In');
            setTimeout(() => { window.location.href = 'login.html'; }, 1200);
            return;
        }
        if (bacorUser.userType === 'admin') {
            window.location.href = 'admin.html';
            return;
        }

        let currentUser = bacorUser;
        let appointmentData = {};
        let currentDate = new Date();
        let selectedDate = null;
        let selectedTime = null;

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
            } else {
                appt.style.display = 'none';
                dash.style.display = 'block';
                document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
                document.querySelector('.menu-item[data-view="dashboard"]')?.classList.add('active');
                const t = document.querySelector('.page-title'); if (t) t.textContent = 'Dashboard';
            }
        }
        function goToAppointmentPage() { showResidentView('appointment'); }
        function goToDashboard()       { showResidentView('dashboard'); }
        function goToLandingPage()     { window.location.href = 'index.html'; }

        async function logout() {
            const ok = await GG.confirm({
                title: 'Log Out?',
                message: 'Are you sure you want to log out of your account?',
                confirmLabel: 'Log Out',
                cancelLabel: 'Stay'
            });
            if (!ok) return;
            localStorage.removeItem('currentUser');
            localStorage.removeItem('isAdminLoggedIn');
            sessionStorage.removeItem('currentUser');
            GG.toast('You have been logged out.', 'info', 'Goodbye', 1800);
            setTimeout(() => { window.location.href = 'index.html'; }, 900);
        }

        function openEditProfile() {
            populateProfileForm();
            const m = document.getElementById('editProfileModal'); if (m) m.style.display = 'flex';
        }
        function closeEditProfile() {
            const m = document.getElementById('editProfileModal'); if (m) m.style.display = 'none';
        }
        function populateProfileForm() {
            const f = document.getElementById('fullNameInput');   if (f) f.value = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
            const e = document.getElementById('emailInput');      if (e) e.value = currentUser.email || '';
            const p = document.getElementById('phoneInput');      if (p) p.value = currentUser.phone || '';
        }
        function previewAvatar() {
            const input = document.getElementById('avatarInput');
            const preview = document.getElementById('avatarPreview');
            if (input && input.files && input.files[0] && preview) {
                const r = new FileReader();
                r.onload = e => { preview.src = e.target.result; };
                r.readAsDataURL(input.files[0]);
            }
        }
        async function saveProfile() {
            try {
                const fullName = document.getElementById('fullNameInput')?.value || '';
                const parts = fullName.trim().split(/\s+/);
                const firstName = parts.shift() || '';
                const lastName = parts.join(' ') || '';
                const email = document.getElementById('emailInput')?.value?.trim();
                const oldEmail = currentUser.email;

                if (!supabase) throw new Error('Database not connected.');

                const { error } = await supabase
                    .from('users')
                    .update({ first_name: firstName, last_name: lastName, email: email })
                    .eq('email', oldEmail);
                if (error) throw new Error(error.message);

                currentUser.firstName = firstName;
                currentUser.lastName = lastName;
                currentUser.email = email;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                updateUserUI();
                GG.toast('Your profile has been updated.', 'success', 'Saved');
                closeEditProfile();
            } catch (e) {
                GG.toast(e.message, 'error', 'Update Failed');
            }
        }
        function updateUserUI() {
            const name = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || 'User';
            const nameEl = document.getElementById('userName'); if (nameEl) nameEl.textContent = name;
            const welcome = document.getElementById('welcomeTitle'); if (welcome) welcome.textContent = `Welcome back, ${currentUser.firstName || 'Student'}!`;
        }

        function selectAppType(el, type) {
            document.querySelectorAll('.app-type-option').forEach(o => o.classList.remove('selected'));
            el.classList.add('selected');
            const h = document.getElementById('serviceType'); if (h) h.value = type;
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
                const h = document.createElement('div');
                h.className = 'calendar-day-header';
                h.textContent = d;
                grid.appendChild(h);
            });
            const today = new Date(); today.setHours(0,0,0,0);
            const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
            const days = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            for (let i = 0; i < first; i++) {
                const c = document.createElement('div');
                c.className = 'calendar-day unavailable';
                grid.appendChild(c);
            }
            for (let d = 1; d <= days; d++) {
                const c = document.createElement('div');
                const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
                cellDate.setHours(0,0,0,0);
                const isPast = cellDate < today;
                c.className = 'calendar-day ' + (isPast ? 'unavailable' : 'available');
                if (!isPast && selectedDate && selectedDate.toDateString() === cellDate.toDateString()) {
                    c.classList.add('selected');
                }
                c.textContent = d;
                if (!isPast) {
                    c.addEventListener('click', () => {
                        selectedDate = cellDate;
                        renderCalendar();
                        renderTimeSlots();
                    });
                }
                grid.appendChild(c);
            }
            renderTimeSlots();
        }
        function changeMonth(dir) { currentDate.setMonth(currentDate.getMonth() + dir); renderCalendar(); }
        function renderTimeSlots() {
            const box = document.getElementById('timeSlots');
            if (!box) return;
            box.innerHTML = '';
            ['8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM',
             '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM'].forEach(s => {
                const slot = document.createElement('div');
                slot.className = 'time-slot available' + (selectedTime === s ? ' selected' : '');
                slot.textContent = s;
                slot.addEventListener('click', () => {
                    selectedTime = s;
                    renderTimeSlots();
                });
                box.appendChild(slot);
            });
        }

        function getServiceTypeDisplayName(t) {
            return {
                'barangay-clearance': 'Barangay Clearance',
                'business-permit': 'Business Permit',
                'blotter': 'Blotter',
                'katarungang-pambarangay': 'Katarungang Pambarangay'
            }[t] || t || 'Appointment';
        }

        function confirmAppointment() {
            const serviceType = document.getElementById('serviceType')?.value;
            if (!serviceType) return GG.toast('Please select a service type.', 'warning', 'Missing Field');
            const purpose = document.getElementById('purpose')?.value?.trim();
            if (!purpose) return GG.toast('Please provide the purpose of your application.', 'warning', 'Missing Field');
            const firstName = document.getElementById('firstName')?.value?.trim();
            const lastName  = document.getElementById('lastName')?.value?.trim();
            if (!firstName || !lastName) return GG.toast('Please provide your first and last name.', 'warning', 'Missing Field');
            const address = document.getElementById('address')?.value?.trim();
            if (!address) return GG.toast('Please provide your address.', 'warning', 'Missing Field');
            const contactNumber = document.getElementById('contactNumber')?.value?.trim();
            if (!contactNumber) return GG.toast('Please provide your contact number.', 'warning', 'Missing Field');
            if (!selectedDate) return GG.toast('Please select a date.', 'warning', 'Missing Field');
            if (!selectedTime) return GG.toast('Please select a time.', 'warning', 'Missing Field');

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
        }

        function backToForm() {
            const confirmC = document.getElementById('confirmationSection'); if (confirmC) confirmC.style.display = 'none';
            const formC = document.getElementById('appointmentFormContainer'); if (formC) formC.style.display = 'block';
        }
        function updateProgress(pct, msg) {
            const fill = document.getElementById('progressFill'); if (fill) fill.style.width = `${pct}%`;
            const text = document.getElementById('progressText'); if (text) text.textContent = msg;
        }

        async function submitAppointment() {
            try {
                const prog = document.getElementById('imageProgress'); if (prog) prog.style.display = 'block';
                updateProgress(30, 'Saving appointment…');

                if (!supabase) throw new Error('Database not connected.');
                if (!currentUser || !currentUser.email) throw new Error('Please sign in again.');

                const payload = {
                    id: Date.now(),
                    user_email: currentUser.email,
                    date: appointmentData.dateStr,
                    time: appointmentData.timeStr,
                    type: getServiceTypeDisplayName(appointmentData.serviceType),
                    message: appointmentData.purpose,
                    created_at: new Date().toISOString()
                };

                const { error } = await supabase.from('appointments').insert([payload]).select();
                if (error) throw error;

                updateProgress(100, 'Appointment scheduled successfully!');
                GG.toast('Your appointment has been scheduled.', 'success', 'Appointment Booked');

                selectedDate = null; selectedTime = null;
                appointmentData = {};
                const formC = document.getElementById('appointmentFormContainer'); if (formC) formC.style.display = 'block';
                const confirmC = document.getElementById('confirmationSection'); if (confirmC) confirmC.style.display = 'none';
                if (prog) prog.style.display = 'none';

                setTimeout(() => { showResidentView('dashboard'); }, 1200);
            } catch (e) {
                console.error('Error scheduling appointment:', e);
                GG.toast(e.message, 'error', 'Booking Failed');
                const prog = document.getElementById('imageProgress'); if (prog) prog.style.display = 'none';
            }
        }

        async function loadAnnouncements() {
            const t = document.getElementById('announcementTitle');
            const c = document.getElementById('announcementText');
            if (t) t.textContent = 'Welcome to Info:Sched';
            if (c) c.textContent = 'Schedule an appointment from the Appointment tab.';
        }

        async function loadAppointments() {
            try {
                if (!supabase) return;
                const container = document.getElementById('appointmentsList');
                if (!container) return;

                const { data, error } = await supabase
                    .from('appointments')
                    .select('*')
                    .eq('user_email', currentUser.email)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                if (!data || data.length === 0) {
                    container.innerHTML = `<div class="no-appointments"><span class="icon-large">▢</span><p>No appointments scheduled</p></div>`;
                    return;
                }
                container.innerHTML = '';
                data.slice(0, 5).forEach(a => {
                    const item = document.createElement('div');
                    item.className = 'appointment-item';
                    item.innerHTML = `
                        <div class="appointment-header">
                            <h3 class="appointment-title">${a.type || 'Appointment'}</h3>
                            <span class="appointment-status status-pending">Scheduled</span>
                        </div>
                        <div class="appointment-details">
                            <div class="appointment-detail"><span class="icon-text">▦</span> ${a.date || ''}</div>
                            <div class="appointment-detail"><span class="icon-text">◷</span> ${a.time || ''}</div>
                        </div>`;
                    container.appendChild(item);
                });
            } catch (e) { console.warn('loadAppointments:', e); }
        }

        function viewAppointmentDetails(id) { GG.toast('Appointment ID ' + id, 'info', 'Appointment'); }
        function rescheduleAppointment(id)   { GG.toast('Reschedule: ' + id, 'info', 'Appointment'); }
        function showAllNews() { GG.toast('Show all news — coming soon.', 'info', 'Not Yet'); }
        function showNewsDetail() { GG.toast('News detail — coming soon.', 'info', 'Not Yet'); }
        function showAllEvents() { GG.toast('Show all events — coming soon.', 'info', 'Not Yet'); }
        function residentSwitchEventsTab(name) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const tab = document.querySelector(`.tab[onclick*="'${name}'"]`);
            if (tab) tab.classList.add('active');
            const content = document.getElementById(`${name}Tab`);
            if (content) content.classList.add('active');
        }

        showResidentView('dashboard');
        document.querySelectorAll('.menu-item[data-view]').forEach(item => {
            item.addEventListener('click', () => showResidentView(item.getAttribute('data-view')));
        });
        updateUserUI();
        renderCalendar();

        const fullName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
        if (fullName) {
            const parts = fullName.split(/\s+/);
            const f = document.getElementById('firstName'); if (f) f.value = parts[0] || '';
            const l = document.getElementById('lastName');  if (l) l.value = parts.slice(1).join(' ') || '';
        }
        const em = document.getElementById('emailInput'); if (em) em.value = currentUser.email || '';

        loadAnnouncements();
        loadAppointments();

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
        window.viewAppointmentDetails = viewAppointmentDetails;
        window.rescheduleAppointment = rescheduleAppointment;
        window.showAllNews           = showAllNews;
        window.showNewsDetail        = showNewsDetail;
        window.showAllEvents         = showAllEvents;
        window.residentSwitchEventsTab = residentSwitchEventsTab;
    });
})();

/* ============================================================
   4. ADMIN MODULE — BACOR backend
   ============================================================ */
(function adminModule() {
    'use strict';
    document.addEventListener('DOMContentLoaded', function () {
        if (!document.body.classList.contains('app-shell')) return;
        if (!document.querySelector('.tab-nav-item[data-tab]')) return;
        console.log('[Admin] module running (BACOR backend)');

        const isAdminLoggedIn = localStorage.getItem('isAdminLoggedIn');
        if (!isAdminLoggedIn) {
            GG.toast('Admin access required.', 'warning', 'Not Signed In');
            setTimeout(() => { window.location.href = 'login.html'; }, 1200);
            return;
        }

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
                const admins   = userList.filter(u => (u.user_type || '').toLowerCase() === 'admin').length;
                const students = userList.filter(u => (u.user_type || '').toLowerCase() === 'student').length;
                set('totalUsers', users.error ? 'Error' : userList.length);
                set('totalAppointments', appointments.error ? 'Error' : ((appointments.data || []).length));
                set('totalEvents', students);
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
                const { data } = await supabase.from('appointments').select('*').order('created_at', { ascending: false }).limit(5);
                list.innerHTML = '';
                if (!data || !data.length) {
                    list.innerHTML = `<li style="padding:.5rem 0;display:flex;align-items:center;"><span class="icon-text">ℹ</span><span>No recent activity</span></li>`;
                    return;
                }
                data.forEach(x => {
                    const li = document.createElement('li');
                    li.style.cssText = 'padding:.5rem 0;border-bottom:1px solid #dee2e6;display:flex;align-items:center;';
                    li.innerHTML = `<span class="icon-text" style="color:#dc3545;margin-right:.5rem;">▸</span><span>${x.type || 'Appointment'} — ${x.user_email || ''} (${formatDate(x.created_at)})</span>`;
                    list.appendChild(li);
                });
            } catch (e) { console.error('updateRecentActivity:', e); }
        }

        async function loadContent() {
            const body = document.getElementById('contentTableBody');
            if (!body) return;
            showLoader('contentLoading'); hideError('contentError');
            body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;">${createLoadingSpinner()} Loading…</td></tr>`;
            try {
                if (!supabase) throw new Error('Database not connected');
                const { data, error } = await supabase.from('users').select('*');
                if (error) throw error;
                body.innerHTML = '';
                if (!data || !data.length) {
                    body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#6c757d;">No users found.</td></tr>`;
                    return;
                }
                data.forEach(u => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${u.first_name || ''} ${u.last_name || ''}</td>
                        <td>${u.email || ''}</td>
                        <td>${u.dob || '—'}</td>
                        <td>${u.user_type || 'student'}</td>
                        <td>${u.password ? '••••••' : '—'}</td>
                        <td>
                            <div class="action-buttons" style="display:flex;gap:5px;">
                                <button class="btn btn-small btn-delete" onclick="deleteUser('${u.email}')">Delete</button>
                            </div>
                        </td>`;
                    body.appendChild(tr);
                });
            } catch (e) {
                console.error('loadContent:', e);
                showError('contentError', `Error: ${e.message}`);
                body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#dc3545;">Error loading users</td></tr>`;
            } finally { hideLoader('contentLoading'); }
        }

        function addNewContent() { switchAdminTab('content-list'); }
        async function editContent() { GG.toast('Editing is disabled for this project.', 'info', 'Not Available'); }
        async function saveContent(event) { if (event) event.preventDefault(); GG.toast('Content editing is disabled.', 'info', 'Not Available'); }
        async function deleteContent() { GG.toast('Use the User Management section to delete users.', 'info', 'Not Available'); }

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
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${a.first_name || ''} ${a.last_name || ''}</td>
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
        async function saveAnnouncement(e) { if (e) e.preventDefault(); GG.toast('Announcements feature is disabled.', 'info', 'Not Available'); }
        async function editAnnouncement()  { GG.toast('Editing is disabled.', 'info', 'Not Available'); }
        async function deleteAnnouncement(){ GG.toast('Deleting is disabled.', 'info', 'Not Available'); }

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
                const appointments = aptRes.data || [];
                const users = usrRes.data || [];

                body.innerHTML = '';
                if (!appointments.length) {
                    body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#6c757d;">No appointments found.</td></tr>`;
                    return;
                }
                appointments.forEach(a => {
                    const u = users.find(x => x.email === a.user_email);
                    const name = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : (a.user_email || 'Unknown');
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${a.id || ''}</td>
                        <td>${name}</td>
                        <td>${a.type || 'Appointment'}</td>
                        <td>${a.date || ''}</td>
                        <td>${a.status || 'pending'}</td>
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
                const content = document.getElementById('appointmentDetailsContent');
                if (content) content.innerHTML = `
                    <div style="padding:1rem 0;">
                        <h3 style="color:#d32f2f;">Appointment Details</h3>
                        <p><strong>ID:</strong> ${a.id}</p>
                        <p><strong>User Email:</strong> ${a.user_email || 'N/A'}</p>
                        <p><strong>Type:</strong> ${a.type || 'N/A'}</p>
                        <p><strong>Date:</strong> ${a.date || 'N/A'}</p>
                        <p><strong>Time:</strong> ${a.time || 'N/A'}</p>
                        <p><strong>Message:</strong> ${a.message || 'N/A'}</p>
                    </div>`;
                toggleModal('appointmentModal');
            } catch (e) { GG.toast(e.message, 'error', 'Load Failed'); }
        }
        async function editAppointmentStatus(id) { GG.toast('Status editing is not used in this project.', 'info', 'Not Available'); }
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
            body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;">${createLoadingSpinner()} Loading…</td></tr>`;
            try {
                if (!supabase) throw new Error('Database not connected');
                const { data, error } = await supabase.from('users').select('*');
                if (error) throw error;
                body.innerHTML = '';
                if (!data || !data.length) {
                    body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#6c757d;">No users found.</td></tr>`;
                    return;
                }
                data.forEach(u => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${u.id || ''}</td>
                        <td>${u.first_name || ''} ${u.last_name || ''}</td>
                        <td>${u.email || ''}</td>
                        <td>${u.dob || '—'}</td>
                        <td>${u.user_type || 'student'}</td>
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
                body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#dc3545;">Error loading users</td></tr>`;
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
                        <p><strong>ID:</strong> ${u.id || '—'}</p>
                        <p><strong>Name:</strong> ${u.first_name || ''} ${u.last_name || ''}</p>
                        <p><strong>Email:</strong> ${u.email || ''}</p>
                        <p><strong>DOB:</strong> ${u.dob || '—'}</p>
                        <p><strong>Type:</strong> ${u.user_type || 'student'}</p>
                    </div>`;
                toggleModal('appointmentModal');
            } catch (e) { GG.toast(e.message, 'error', 'Load Failed'); }
        }
        async function deleteUser(email) {
            const ok = await GG.confirm({
                title: 'Delete user?',
                message: `Delete account ${email}? This also removes their appointments. This cannot be undone.`,
                confirmLabel: 'Delete',
                confirmClass: 'btn btn-delete'
            });
            if (!ok) return;
            try {
                await supabase.from('appointments').delete().eq('user_email', email);
                const { error } = await supabase.from('users').delete().eq('email', email);
                if (error) throw error;
                GG.toast('User deleted.', 'success', 'Deleted');
                loadUsers(); loadContent(); updateStats();
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
        }
        function switchAdminTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-nav-item').forEach(i => i.classList.remove('active'));
            const target = document.getElementById(tabId);
            if (target) target.classList.add('active');
            const nav = document.querySelector(`.tab-nav-item[data-tab="${tabId}"]`);
            if (nav) nav.classList.add('active');
        }
        function toggleModal(id) { const m = document.getElementById(id); if (m) m.classList.toggle('active'); }
        function refreshAllData() {
            updateStats(); loadContent(); loadAnnouncements(); loadAppointments(); loadUsers();
            GG.toast('All data refreshed.', 'success', 'Refreshed');
        }
        async function signOut() {
            const ok = await GG.confirm({
                title: 'Sign out?',
                message: 'You will be returned to the home page.',
                confirmLabel: 'Sign Out',
                cancelLabel: 'Stay'
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
        const af = document.getElementById('announcementForm'); if (af) af.addEventListener('submit', saveAnnouncement);
        const cf = document.getElementById('contentFormElement'); if (cf) cf.addEventListener('submit', saveContent);
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
                const m = this.closest('.modal');
                if (m) toggleModal(m.id);
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
        window.editAnnouncement = editAnnouncement;
        window.deleteAnnouncement = deleteAnnouncement;
        window.viewAppointment = viewAppointment;
        window.editAppointmentStatus = editAppointmentStatus;
        window.deleteAppointment = deleteAppointment;
        window.filterAppointments = filterAppointments;
        window.viewUser = viewUser;
        window.deleteUser = deleteUser;
    });
})();