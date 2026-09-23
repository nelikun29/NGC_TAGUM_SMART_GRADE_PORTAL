// ============================================================
// SMART GRADE & ATTENDANCE PORTAL
// APP.JS — COMPLETE ENHANCED VERSION
// ============================================================
// Preserves existing application functionality while adding:
// - Approval notification system
// - Admin pending-registration badge
// - Teacher pending-student badge
// - Automatic notification refresh
// - Notification click navigation
// - Safe UI fallbacks
//
// IMPORTANT:
// The client never computes or sends a final grade.
// All authoritative grade calculations remain server-side.
// ============================================================


// ============================================================
// API CLIENT
// ============================================================

const API_BASE = window.SMARTGRADE_API_BASE || '/api';


const Store = {
  get token() {
    return localStorage.getItem('sg_token');
  },

  set token(v) {
    v
      ? localStorage.setItem('sg_token', v)
      : localStorage.removeItem('sg_token');
  },

  get user() {
    try {
      return JSON.parse(localStorage.getItem('sg_user'));
    } catch {
      return null;
    }
  },

  set user(v) {
    v
      ? localStorage.setItem('sg_user', JSON.stringify(v))
      : localStorage.removeItem('sg_user');
  },
};

const AttendanceQr = {
  key: 'sg_pending_attendance_qr',
  captureFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('attendanceSession');
    const token = params.get('attendanceToken');
    if (!sid || !token) return;
    sessionStorage.setItem(this.key, JSON.stringify({ sessionId: sid, token }));
    history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  },
  getPending() {
    try { return JSON.parse(sessionStorage.getItem(this.key)); } catch { return null; }
  },
  clear() { sessionStorage.removeItem(this.key); },
  async submitPending() {
    const pending = this.getPending();
    if (!pending || Store.user?.role !== 'student' || !Store.token) return false;
    try {
      const data = await api('POST', '/attendance/submit-qr', pending);
      this.clear();
      Toast.show('Attendance Recorded', data.message || 'Your attendance has been recorded.', 'success');
      return true;
    } catch (e) {
      const message = String(e?.message || '');
      if (/already been recorded|expired|closed|not enrolled|not found|finalized|released/i.test(message)) this.clear();
      return false;
    }
  }
};
AttendanceQr.captureFromUrl();


async function api(method, path, body) {

  const headers = {
    'Content-Type': 'application/json'
  };

  if (Store.token) {
    headers['Authorization'] = `Bearer ${Store.token}`;
  }

  let res;

  try {

    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

  } catch (e) {

    Toast.show(
      'Connection Error',
      'Unable to connect to the server. Please try again.',
      'error'
    );

    throw e;
  }


  let data = null;

  try {
    data = await res.json();
  } catch {
    // Some endpoints may return non-JSON content.
  }


  if (!res.ok) {

    let message =
      (data && data.error) ||
      'An unexpected error occurred.';

    const sessionEnded =
      !Store.token ||
      !Store.user;

    if (
      !sessionEnded ||
      (res.status !== 401 && res.status !== 403)
    ) {
      Toast.show(
        'Error',
        message,
        'error'
      );
    }

    throw new Error(message);
  }


  return data;
}


// ============================================================
// TOAST
// ============================================================

const Toast = {

  show(title, message, type = 'info') {

    let c = document.getElementById('toast-container');

    // Safety fallback
    if (!c) {

      c = document.createElement('div');

      c.id = 'toast-container';

      c.className =
        'fixed top-5 right-5 z-[9999] space-y-3 max-w-sm';

      document.body.appendChild(c);
    }


    const el = document.createElement('div');


    let bg = 'bg-slate-800 text-white';
    let icon = 'fa-circle-info text-blue-400';


    if (type === 'success') {

      bg = 'bg-emerald-700 text-white';
      icon = 'fa-circle-check text-emerald-300';

    }


    if (type === 'error') {

      bg = 'bg-red-700 text-white';
      icon = 'fa-circle-xmark text-red-300';

    }


    el.className =
      `p-4 rounded-xl shadow-2xl flex items-start gap-3
       text-xs font-semibold ${bg}
       transition-all transform translate-y-2 opacity-0`;


    el.innerHTML = `
      <i class="fa-solid ${icon} text-lg mt-0.5"></i>

      <div>
        <h5 class="font-extrabold">
          ${esc(title)}
        </h5>

        <p class="opacity-90 mt-0.5">
          ${esc(message)}
        </p>
      </div>
    `;


    c.appendChild(el);


    requestAnimationFrame(() => {

      el.classList.remove(
        'translate-y-2',
        'opacity-0'
      );

    });


    setTimeout(() => {

      el.classList.add('opacity-0');

      setTimeout(() => {
        el.remove();
      }, 300);

    }, 4000);
  }

};


// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function esc(s) {

  return String(s ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );

}


function pct(v) {

  return (
    v === null ||
    v === undefined
  )
    ? '—'
    : `${Number(v).toFixed(1)}%`;

}


function val(id) {

  const el = document.getElementById(id);

  return el
    ? el.value.trim()
    : '';

}


// ============================================================
// APPROVAL NOTIFICATION SYSTEM
// ============================================================

const ApprovalManager = {

  state: {

    adminPending: 0,

    teacherPending: 0,

    unfinalizePending: 0,

    loading: false,

    timer: null

  },


  // ----------------------------------------------------------
  // INITIALIZE
  // ----------------------------------------------------------

  init() {

    this.ensureNotificationUI();

    this.refresh();

    this.startAutoRefresh();

  },


  // ----------------------------------------------------------
  // CREATE FALLBACK NOTIFICATION UI
  // ----------------------------------------------------------

  ensureNotificationUI() {

    // If the enhanced index.html already provides the UI,
    // use it.

    const existing =
      document.getElementById(
        'approval-notification'
      );

    if (existing) {

      existing.addEventListener(
        'click',
        () => this.handleClick()
      );

      return;
    }


    // --------------------------------------------------------
    // Fallback notification button
    // --------------------------------------------------------

    const headerProfile =
      document.getElementById(
        'user-header-profile'
      );

    if (!headerProfile) return;


    const wrapper =
      document.createElement('div');


    wrapper.id =
      'approval-notification-wrapper';


    wrapper.className =
      'relative flex items-center';


    wrapper.innerHTML = `

      <button
        id="approval-notification"
        type="button"
        aria-label="Approval notifications"
        title="Approval notifications"
        class="relative w-10 h-10
               rounded-xl
               flex items-center justify-center
               text-slate-600
               hover:bg-slate-100
               transition">

        <i class="fa-solid fa-bell"></i>

        <span
          id="approval-notification-badge"
          class="hidden absolute
                 -top-1 -right-1
                 min-w-[20px] h-5
                 px-1
                 rounded-full
                 bg-red-600
                 text-white
                 text-[10px]
                 font-black
                 items-center
                 justify-center
                 border-2
                 border-white">
          0
        </span>

      </button>

    `;


    headerProfile.prepend(wrapper);


    const btn =
      document.getElementById(
        'approval-notification'
      );


    if (btn) {

      btn.addEventListener(
        'click',
        () => this.handleClick()
      );

    }

  },


  // ----------------------------------------------------------
  // UPDATE BADGE
  // ----------------------------------------------------------

  updateBadge(total) {

    const badge =
      document.getElementById(
        'approval-notification-badge'
      );


    if (!badge) return;


    if (total > 0) {

      badge.textContent =
        total > 99
          ? '99+'
          : String(total);

      badge.classList.remove('hidden');

      badge.classList.add('flex');

    } else {

      badge.textContent = '0';

      badge.classList.add('hidden');

      badge.classList.remove('flex');

    }

  },


  // ----------------------------------------------------------
  // UPDATE NOTIFICATION TITLE
  // ----------------------------------------------------------

  updateTitle(total) {

    const btn =
      document.getElementById(
        'approval-notification'
      );


    if (!btn) return;


    if (total > 0) {

      btn.title =
        `${total} pending approval${total === 1 ? '' : 's'}`;

      btn.setAttribute(
        'aria-label',
        btn.title
      );

    } else {

      btn.title =
        'Approval notifications';

      btn.setAttribute(
        'aria-label',
        'Approval notifications'
      );

    }

  },


  // ----------------------------------------------------------
  // REFRESH COUNTS
  // ----------------------------------------------------------

  async refresh() {

    const user =
      Store.user;


    if (!user || !Store.token) {

      this.state.adminPending = 0;

      this.state.teacherPending = 0;
      this.state.unfinalizePending = 0;

      this.updateBadge(0);

      return;

    }


    if (this.state.loading) return;


    this.state.loading = true;


    try {

      // ------------------------------------------------------
      // ADMIN
      // ------------------------------------------------------

      if (user.role === 'admin') {

        const dashboard =
          await api(
            'GET',
            '/admin/dashboard'
          ).catch(() => null);


        this.state.adminPending =
          Number(
            dashboard?.pendingRegistrations || 0
          );


        this.state.teacherPending = 0;
        const unfinalizeRows = await api('GET','/admin/unfinalize-requests?status=pending').catch(() => []);
        this.state.unfinalizePending = Array.isArray(unfinalizeRows) ? unfinalizeRows.length : 0;

      }


      // ------------------------------------------------------
      // TEACHER
      // ------------------------------------------------------

      else if (user.role === 'teacher') {

        const classes =
          await api(
            'GET',
            '/classes'
          ).catch(() => []);


        let total = 0;


        for (const cls of classes) {

          try {

            const rows =
              await api(
                'GET',
                `/classes/${cls.id}/pending-enrollments`
              );


            total +=
              Array.isArray(rows)
                ? rows.length
                : 0;

          } catch {
            // Ignore individual class errors.
          }

        }


        this.state.teacherPending =
          total;

        this.state.adminPending = 0;
        this.state.unfinalizePending = 0;

      }


      // ------------------------------------------------------
      // OTHER ROLES
      // ------------------------------------------------------

      else {

        this.state.adminPending = 0;

        this.state.teacherPending = 0;
        this.state.unfinalizePending = 0;

      }


      const total =
        this.state.adminPending +
        this.state.teacherPending +
        this.state.unfinalizePending;


      this.updateBadge(total);

      this.updateTitle(total);


      // Update optional enhanced HTML elements
      this.updateEnhancedUI();


    } finally {

      this.state.loading = false;

    }

  },


  // ----------------------------------------------------------
  // OPTIONAL ENHANCED HTML UI
  // ----------------------------------------------------------

  updateEnhancedUI() {

    const adminCount =
      document.getElementById(
        'admin-approval-count'
      );


    if (adminCount) {

      adminCount.textContent =
        this.state.adminPending;

      adminCount.classList.toggle(
        'hidden',
        this.state.adminPending === 0
      );

    }


    const teacherCount =
      document.getElementById(
        'teacher-approval-count'
      );


    if (teacherCount) {

      teacherCount.textContent =
        this.state.teacherPending;

      teacherCount.classList.toggle(
        'hidden',
        this.state.teacherPending === 0
      );

    }


    const unfinalizeTab = document.querySelector('#admin-section [data-admin-unfinalize]');
    if (unfinalizeTab) {
      let badge=unfinalizeTab.querySelector('.sg-unfinalize-count');
      if(!badge){badge=document.createElement('span');badge.className='sg-unfinalize-count ml-1 inline-flex min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black items-center justify-center';unfinalizeTab.appendChild(badge);}
      badge.textContent=this.state.unfinalizePending;
      badge.classList.toggle('hidden',this.state.unfinalizePending===0);
    }

    const genericCount =
      document.getElementById(
        'approval-count'
      );


    if (genericCount) {

      const total =
        this.state.adminPending +
        this.state.teacherPending +
        this.state.unfinalizePending;


      genericCount.textContent =
        total;


      genericCount.classList.toggle(
        'hidden',
        total === 0
      );

    }

  },


  // ----------------------------------------------------------
  // HANDLE NOTIFICATION CLICK
  // ----------------------------------------------------------

  handleClick() {

    const user =
      Store.user;


    if (!user) return;


    if (
      user.role === 'admin' &&
      (this.state.adminPending > 0 || this.state.unfinalizePending > 0)
    ) {

      Admin.tab = this.state.adminPending > 0 ? 'approvals' : 'unfinalize';

      Views.renderForRole();

      return;

    }


    if (
      user.role === 'teacher' &&
      this.state.teacherPending > 0
    ) {

      Teacher.state.tab =
        'approvals';

      Views.renderForRole();

      return;

    }


    Toast.show(
      'Approvals',
      'There are currently no pending approvals.',
      'info'
    );

  },


  // ----------------------------------------------------------
  // START AUTOMATIC REFRESH
  // ----------------------------------------------------------

  startAutoRefresh() {

    if (this.state.timer) {

      clearInterval(
        this.state.timer
      );

    }


    // Refresh every 30 seconds.

    this.state.timer =
      setInterval(
        () => {

          if (Store.user) {

            this.refresh();

          }

        },
        30000
      );

  },


  // ----------------------------------------------------------
  // STOP AUTOMATIC REFRESH
  // ----------------------------------------------------------

  stopAutoRefresh() {

    if (this.state.timer) {
      clearInterval(this.state.timer);
      this.state.timer = null;
    }

    this.state.loading = false;
    this.state.adminPending = 0;
    this.state.teacherPending = 0;
    this.state.unfinalizePending = 0;
    this.updateBadge(0);
    this.updateTitle(0);

  },


  // ----------------------------------------------------------
  // FORCE REFRESH
  // ----------------------------------------------------------

  forceRefresh() {

    return this.refresh();

  }

};


// ============================================================
// AUTH
// ============================================================

const Auth = {

  async login(e) {

    e.preventDefault();


    const email =
      document
        .getElementById('login-email')
        .value
        .trim();


    const password =
      document
        .getElementById('login-password')
        .value;


    try {

      const data =
        await api(
          'POST',
          '/auth/login',
          {
            email,
            password
          }
        );


      Store.token =
        data.token;


      Store.user =
        data.user;


      Toast.show(
        'Welcome',
        `Logged in as ${data.user.role}.`,
        'success'
      );


      Views.renderForRole();

      if (data.user.role === 'student' && data.user.accountVerificationStatus === 'verified') {
        setTimeout(() => AttendanceQr.submitPending(), 250);
      }


      // Immediately refresh notifications.

      setTimeout(() => {

        ApprovalManager.forceRefresh();

      }, 200);


    } catch {
      // Toast already shown.
    }


    return false;

  },


  async registerStudent(e) {

    e.preventDefault();


    const payload = {

      studentNumber:
        val('sr-studentNumber'),

      firstName:
        val('sr-firstName'),

      middleName:
        val('sr-middleName'),

      lastName:
        val('sr-lastName'),

      yearLevel:
        val('sr-yearLevel'),

      roomNumber:
        val('sr-roomNumber'),

      email:
        val('sr-email'),

      password:
        val('sr-password')

    };


    try {

      const data =
        await api(
          'POST',
          '/auth/register/student',
          payload
        );


      Toast.show(
        'Registered',
        data.message,
        'success'
      );


      Views.authTab('login');

    } catch {}


    return false;

  },


  async registerTeacher(e) {

    e.preventDefault();


    const payload = {

      firstName:
        val('tr-firstName'),

      lastName:
        val('tr-lastName'),

      department:
        val('tr-department'),

      email:
        val('tr-email'),

      password:
        val('tr-password')

    };


    try {

      const data =
        await api(
          'POST',
          '/auth/register/teacher',
          payload
        );


      Toast.show(
        'Submitted',
        data.message,
        'success'
      );


      Views.authTab('login');

    } catch {}


    return false;

  },


  logout() {

    ApprovalManager.stopAutoRefresh();

    if (Teacher?._attendanceQrTimer) {
      clearInterval(Teacher._attendanceQrTimer);
      Teacher._attendanceQrTimer = null;
    }

    api(
      'POST',
      '/auth/logout'
    ).catch(() => {});

    Store.token = null;
    Store.user = null;

    Views.renderForRole();

    Toast.show(
      'Logged Out',
      'You have been logged out successfully.',
      'success'
    );

  }

};


// ============================================================
// VIEW ROUTER
// ============================================================

const Views = {

  home() {

    this.renderForRole();

  },


  authTab(tab) {

    document
      .querySelectorAll('.tab-btn')
      .forEach(b => {

        b.classList.toggle(
          'active',
          b.dataset.tab === tab
        );

      });


    [
      'login-form',
      'student-reg-form',
      'teacher-reg-form'
    ].forEach(id => {

      const el =
        document.getElementById(id);

      if (el) {
        el.classList.add('hidden');
      }

    });


    const map = {

      login:
        'login-form',

      'reg-student':
        'student-reg-form',

      'reg-teacher':
        'teacher-reg-form'

    };


    const target =
      document.getElementById(
        map[tab]
      );


    if (target) {

      target.classList.remove(
        'hidden'
      );

    }

  },


  renderForRole() {

    const user =
      Store.user;


    const auth =
      document.getElementById(
        'auth-section'
      );


    if (auth) {

      auth.classList.toggle(
        'hidden',
        !!user
      );

    }


    [
      'student-section',
      'teacher-section',
      'admin-section'
    ].forEach(id => {

      const el =
        document.getElementById(id);

      if (el) {

        el.classList.add('hidden');

      }

    });


    const profile =
      document.getElementById(
        'user-header-profile'
      );


    if (profile) {

      profile.classList.toggle(
        'hidden',
        !user
      );

    }


    const logout =
      document.getElementById(
        'logout-btn'
      );


    if (logout) {

      logout.classList.toggle(
        'hidden',
        !user
      );

    }


    if (!user) {

      ApprovalManager.updateBadge(0);

      return;

    }


    const avatar =
      document.getElementById(
        'user-avatar'
      );


    if (avatar) {

      avatar.textContent =
        user.role[0].toUpperCase();

    }


    const roleBadge =
      document.getElementById(
        'user-role-badge'
      );


    if (roleBadge) {

      roleBadge.textContent =
        user.role;

    }


    const nameDisplay =
      document.getElementById(
        'user-name-display'
      );


    if (nameDisplay) {

      nameDisplay.textContent =
        user.profile
          ? `${user.profile.first_name} ${user.profile.last_name}`
          : user.email;

    }

    if (
      user.role === 'student' &&
      user.accountVerificationStatus &&
      user.accountVerificationStatus !== 'verified'
    ) {
      const el = document.getElementById('student-section');
      if (el) {
        el.classList.remove('hidden');
        el.innerHTML = `
          <div class="mx-auto max-w-2xl glass-card rounded-3xl p-7 text-center">
            <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <i class="fa-solid fa-user-shield text-2xl"></i>
            </div>
            <h2 class="mt-4 text-2xl font-black text-slate-900">Account Verification Pending</h2>
            <p class="mt-3 text-sm leading-6 text-slate-600">
              Another learner record has the same full name. Your registration was not deleted or rejected,
              but academic access is temporarily restricted while an administrator verifies the accounts.
            </p>
            <div class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900">
              <p><b>Status:</b> ${esc(String(user.accountVerificationStatus).replaceAll('_',' '))}</p>
              <p class="mt-1"><b>${user.studentIdClaim ? 'Claimed Student ID' : 'Student ID'}:</b> ${esc(user.studentIdClaim?.claimed_student_number || user.profile?.student_number || '—')}</p>
              <p class="mt-1"><b>Email:</b> ${esc(user.email || '—')}</p>
              ${user.verificationNote ? `<p class="mt-1"><b>Note:</b> ${esc(user.verificationNote)}</p>` : ''}
            </div>
            <p class="mt-4 text-xs text-slate-500">You may sign out normally. Enrollment, attendance, assessments, and grades remain protected until verification is completed.</p>
          </div>`;
      }
      ApprovalManager.updateBadge(0);
      return;
    }


    if (
      user.role === 'student'
    ) {

      const el =
        document.getElementById(
          'student-section'
        );

      if (el) {

        el.classList.remove(
          'hidden'
        );

        Student.render();

      }

    }


    if (
      user.role === 'teacher'
    ) {

      const el =
        document.getElementById(
          'teacher-section'
        );

      if (el) {

        el.classList.remove(
          'hidden'
        );

        Teacher.render();

      }

    }


    if (
      user.role === 'admin'
    ) {

      const el =
        document.getElementById(
          'admin-section'
        );

      if (el) {

        el.classList.remove(
          'hidden'
        );

        Admin.render();

      }

    }


    // Refresh notification state after rendering.

    ApprovalManager.forceRefresh();

  }

};


// ============================================================
// APPLICATION INITIALIZATION
// ============================================================

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    if (Store.token && Store.user) {
      try {
        const session = await api('GET', '/auth/me');
        Store.user = {
          ...Store.user,
          ...session.user,
          profile: session.profile || Store.user.profile || null,
          studentIdClaim: session.studentIdClaim || null
        };
      } catch {
        // Preserve the cached shell during a temporary connection failure;
        // protected APIs still enforce the live verification status.
      }
    }

    Views.renderForRole();


    ApprovalManager.init();


    // Pull institution name from backend.

    fetch(`${API_BASE}/config`)
      .then(r => r.json())
      .then(cfg => {

        if (
          !cfg ||
          !cfg.institutionName
        ) {
          return;
        }


        document
          .querySelectorAll(
            '#institution-name-header, #institution-name-login'
          )
          .forEach(el => {

            el.textContent =
              cfg.institutionName;

          });


        document.title =
          `${cfg.institutionName} — Smart Grade & Attendance Portal`;

      })
      .catch(() => {});

  }
);


// ============================================================
// STUDENT VIEW
// ============================================================

const Student = {

  async render() {

    const el =
      document.getElementById(
        'student-section'
      );


    if (!el) return;


    el.innerHTML =
      `<div class="text-center py-10 text-slate-400">
        Loading your dashboard…
      </div>`;


    const user =
      Store.user;


    const classes =
      await api(
        'GET',
        '/classes'
      ).catch(() => []);


    let gradesHtml = '';


    for (
      const c of classes
    ) {

      if (
        c.enrollment_status ===
        'pending'
      ) {

        gradesHtml +=
          Student.pendingCard(c);

        continue;

      }


      const grade =
        await api(
          'GET',
          `/grades/${c.id}/students/${user.id}`
        ).catch(() => null);


      gradesHtml +=
        Student.classCard(
          c,
          grade
        );

    }


    if (
      classes.length === 0
    ) {

      gradesHtml =
        `<p class="text-sm text-slate-500 italic">
          You are not enrolled in any classes yet. Join one below.
        </p>`;

    }


    const pendingQr = AttendanceQr.getPending();

    el.innerHTML = `

      ${pendingQr ? `<div class="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><div class="font-black text-slate-800"><i class="fa-solid fa-qrcode text-amber-600 mr-2"></i>QR Attendance Detected</div><p class="text-xs text-slate-600 mt-1">Submit this attendance check-in while the QR credential is still valid.</p></div><button onclick="Student.submitPendingQr()" class="bg-slate-900 text-amber-300 px-4 py-2 rounded-xl text-sm font-black">Record Attendance</button></div>` : ''}

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div class="glass-card rounded-2xl p-5 lg:col-span-1">

          <h3 class="font-bold text-lg mb-3">
            <i class="fa-solid fa-id-card text-eduBlue-600"></i>
            Profile
          </h3>

          <p class="text-sm">
            <b>Student ID:</b>
            ${esc(user.profile.student_number)}
          </p>

          <p class="text-sm">
            <b>Name:</b>
            ${esc(user.profile.first_name)}
            ${esc(user.profile.last_name)}
          </p>

          <p class="text-sm">
            <b>Year Level:</b>
            ${esc(user.profile.year_level)}
          </p>

          <p class="text-sm">
            <b>Room:</b>
            ${esc(user.profile.room_number || '—')}
          </p>

          <button
            type="button"
            onclick="Student.showEditProfile()"
            class="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-eduBlue-700 text-sm font-bold hover:bg-blue-100 transition"
          >
            <i class="fa-solid fa-user-pen"></i>
            Edit Profile
          </button>


          <div class="mt-5 pt-4 border-t">

            <h4 class="font-bold text-sm mb-2">
              <i class="fa-solid fa-door-open"></i>
              Join a Class
            </h4>

            <form
              onsubmit="return Student.joinClass(event)"
              class="flex gap-2"
            >

              <input
                id="join-class-code"
                required
                placeholder="Class Code"
                class="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm uppercase"
              >

              <button
                class="bg-eduBlue-600 text-white px-3 rounded-xl text-sm font-bold"
              >
                Join
              </button>

            </form>

          </div>


          <div class="mt-5 pt-4 border-t">

            <h4 class="font-bold text-sm mb-2">
              <i class="fa-solid fa-qrcode"></i>
              Submit Attendance
            </h4>

            <form
              onsubmit="return Student.submitAttendance(event)"
              class="flex gap-2"
            >

              <input
                id="attendance-code"
                required
                placeholder="Attendance Code"
                class="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm uppercase"
              >

              <button
                class="bg-eduYellow-500 text-eduBlue-800 px-3 rounded-xl text-sm font-bold"
              >
                Submit
              </button>

            </form>

            <button type="button" onclick="Student.openQrScanner()" class="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-amber-300 text-sm font-black hover:bg-slate-800 transition shadow-sm">
              <i class="fa-solid fa-camera"></i>
              Scan QR Code
            </button>

          </div>

        </div>


        <div class="lg:col-span-2 space-y-4">

          <h3 class="font-bold text-lg">

            <i class="fa-solid fa-chart-line text-eduBlue-600"></i>

            My Classes &amp; Grades

          </h3>

          <div class="student-class-card-grid">
            ${gradesHtml}
          </div>

        </div>

      </div>

    `;

  },


  showEditProfile() {
    const p = Store.user?.profile || {};
    const host = document.createElement('div');
    host.id = 'student-edit-profile-modal';
    host.className = 'fixed inset-0 z-[80] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4';
    host.innerHTML = `
      <div class="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b">
          <div><h3 class="font-black text-lg text-slate-800"><i class="fa-solid fa-user-pen text-eduBlue-600 mr-2"></i>Edit Profile</h3><p class="text-xs text-slate-500 mt-1">Update your student information.</p></div>
          <button type="button" onclick="Student.closeEditProfile()" class="w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form onsubmit="return Student.saveProfile(event)" class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="text-xs font-bold text-slate-600">First Name<input id="student-profile-first" required value="${esc(p.first_name || '')}" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"></label>
          <label class="text-xs font-bold text-slate-600">Middle Name<input id="student-profile-middle" value="${esc(p.middle_name || '')}" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"></label>
          <label class="text-xs font-bold text-slate-600">Last Name<input id="student-profile-last" required value="${esc(p.last_name || '')}" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"></label>
          <label class="text-xs font-bold text-slate-600">Year Level<input id="student-profile-year" required value="${esc(p.year_level || '')}" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"></label>
          <label class="text-xs font-bold text-slate-600 sm:col-span-2">Email Address<input id="student-profile-email" type="email" required value="${esc(Store.user?.email || '')}" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"><span class="block mt-1 text-[10px] font-medium text-slate-400">Use an active email address. This is where password-reset links will be sent.</span></label>
          <label class="text-xs font-bold text-slate-600 sm:col-span-2">Room<input id="student-profile-room" value="${esc(p.room_number || '')}" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"></label>
          <div class="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" onclick="Student.closeEditProfile()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold">Cancel</button><button type="submit" class="px-4 py-2 rounded-xl bg-eduBlue-600 text-white text-sm font-bold"><i class="fa-solid fa-floppy-disk mr-1"></i>Save Changes</button></div>
        </form>
      </div>`;
    document.body.appendChild(host);
  },

  closeEditProfile() {
    document.getElementById('student-edit-profile-modal')?.remove();
  },

  async saveProfile(e) {
    e.preventDefault();
    try {
      const data = await api('PUT', '/auth/profile/student', {
        firstName: val('student-profile-first'),
        middleName: val('student-profile-middle'),
        lastName: val('student-profile-last'),
        yearLevel: val('student-profile-year'),
        roomNumber: val('student-profile-room'),
        email: val('student-profile-email')
      });
      // Store.user is a localStorage-backed getter. Mutating the returned
      // object does not persist it, so write the complete user object back.
      const currentUser = Store.user || {};
      Store.user = {
        ...currentUser,
        email: data.email || currentUser.email,
        profile: data.profile,
        accountVerificationStatus: data.accountVerificationStatus || currentUser.accountVerificationStatus || 'verified',
        verificationNote: data.verificationNote || null
      };
      Student.closeEditProfile();
      Toast.show('Profile Updated', data.message || 'Your profile was updated successfully.', 'success');
      Views.renderForRole();
    } catch {}
    return false;
  },


  pendingCard(c) {

    return `

      <div class="glass-card rounded-2xl p-5 border-l-4 border-amber-400">

        <div class="flex justify-between items-start">

          <div>

            <h4 class="font-bold">
              ${esc(c.subject)}
              —
              ${esc(c.section)}
            </h4>

            <p class="text-xs text-slate-500">
              Room ${esc(c.room_number || '—')}
              · Code ${esc(c.class_code)}
            </p>

          </div>

          <span
            class="text-[10px] font-bold uppercase px-2 py-1 rounded bg-amber-100 text-amber-700"
          >
            Pending Approval
          </span>

        </div>


        <p class="mt-3 text-sm text-amber-700">

          <i class="fa-solid fa-hourglass-half"></i>

          Your teacher hasn't approved your join request yet.
          You'll be able to submit attendance and see grades once approved.

        </p>

      </div>

    `;

  },


  classCard(c, grade) {

    const g =
      grade || {

        complete: false,

        message:
          'Grade Incomplete.',

        components: {},

        finalGrade: null,

        status:
          'in_progress',

        visibleToStudent:
          false

      };


    const comps =
      g.components || {};


    const rows =
      [
        'attendance',
        'quiz',
        'performance',
        'exam'
      ]
        .map(k => {

          const c2 =
            comps[k] || {};


          return `

            <div
              class="flex justify-between text-xs border-b py-1"
            >

              <span class="capitalize">
                ${k}
              </span>

              <span>
                ${pct(c2.percent)}
              </span>

            </div>

          `;

        })
        .join('');


    let gradeBlock;


    if (
      g.status === 'released' &&
      g.finalGrade !== null
    ) {

      gradeBlock = `

        <div
          class="mt-2 text-2xl font-black text-emerald-700"
        >

          ${g.finalGrade}

          <span
            class="text-sm font-medium text-slate-400"
          >
            / 100
          </span>

        </div>

      `;

    } else if (
      g.complete
    ) {

      gradeBlock = `

        <div
          class="mt-2 text-sm text-amber-700 font-semibold"
        >

          <i class="fa-solid fa-lock"></i>

          Grade computed but not yet released by your teacher.

        </div>

      `;

    } else {

      gradeBlock = `

        <div
          class="mt-2 text-sm text-red-600 font-semibold"
        >

          <i class="fa-solid fa-triangle-exclamation"></i>

          ${esc(
            g.message ||
            'Grade Incomplete.'
          )}

        </div>

      `;

    }


    return `

      <div class="glass-card rounded-2xl p-5">

        <div class="flex justify-between items-start">

          <div>

            <h4 class="font-bold">
              ${esc(c.subject)}
              —
              ${esc(c.section)}
            </h4>

            <p class="text-xs text-slate-500">
              Room ${esc(c.room_number || '—')}
              · Code ${esc(c.class_code)}
            </p>

          </div>


          <span
            class="text-[10px] font-bold uppercase px-2 py-1 rounded bg-slate-100 text-slate-600"
          >
            ${esc(g.status)}
          </span>

        </div>


        <div class="mt-3">
          ${rows}
        </div>


        ${gradeBlock}

      </div>

    `;

  },


  async joinClass(e) {

    e.preventDefault();


    const classCode =
      document
        .getElementById('join-class-code')
        .value
        .trim()
        .toUpperCase();


    try {

      const data =
        await api(
          'POST',
          '/classes/join',
          { classCode }
        );


      Toast.show(
        'Joined',
        data.message,
        'success'
      );


      Student.render();

    } catch {}


    return false;

  },


  async openQrScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      Toast.show('Camera Unavailable', 'This browser does not support camera scanning. You can still enter the Attendance Code.', 'error');
      return;
    }
    if (typeof jsQR === 'undefined') {
      Toast.show('Scanner Unavailable', 'QR scanner failed to load. You can still enter the Attendance Code.', 'error');
      return;
    }
    Student.closeQrScanner();
    const host = document.createElement('div');
    host.id = 'student-qr-scanner-modal';
    host.className = 'fixed inset-0 z-[90] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4';
    host.innerHTML = `<div class="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"><div class="flex items-center justify-between px-5 py-4 border-b"><div><h3 class="font-black text-lg text-slate-800"><i class="fa-solid fa-qrcode text-amber-500 mr-2"></i>Scan Attendance QR</h3><p class="text-xs text-slate-500 mt-1">Point your camera at the QR code shown by your teacher.</p></div><button type="button" onclick="Student.closeQrScanner()" class="w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button></div><div class="p-4"><div class="relative overflow-hidden rounded-2xl bg-black aspect-square"><video id="student-qr-video" playsinline muted class="w-full h-full object-cover"></video><div class="absolute inset-[12%] border-2 border-amber-300 rounded-2xl pointer-events-none"></div></div><p id="student-qr-status" class="mt-3 text-center text-xs font-bold text-slate-500">Starting camera…</p><button type="button" onclick="Student.closeQrScanner()" class="mt-3 w-full px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold">Cancel</button></div></div>`;
    document.body.appendChild(host);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      Student._qrStream = stream;
      const video = document.getElementById('student-qr-video');
      if (!video) return Student.closeQrScanner();
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const scan = () => {
        if (!Student._qrStream || !document.getElementById('student-qr-scanner-modal')) return;
        if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
          if (code?.data) return Student.handleScannedAttendanceQr(code.data);
        }
        Student._qrFrame = requestAnimationFrame(scan);
      };
      document.getElementById('student-qr-status').textContent = 'Ready — align the teacher QR inside the frame.';
      Student._qrFrame = requestAnimationFrame(scan);
    } catch (e) {
      Student.closeQrScanner();
      Toast.show('Camera Permission Required', 'Allow camera access to scan the QR code. You can still use the Attendance Code.', 'error');
    }
  },

  closeQrScanner() {
    if (Student._qrFrame) cancelAnimationFrame(Student._qrFrame);
    Student._qrFrame = null;
    if (Student._qrStream) Student._qrStream.getTracks().forEach(t => t.stop());
    Student._qrStream = null;
    document.getElementById('student-qr-scanner-modal')?.remove();
  },

  async handleScannedAttendanceQr(raw) {
    let url;
    try { url = new URL(raw); } catch { Toast.show('Invalid QR Code', 'This is not a Smart Grade attendance QR code.', 'error'); return; }
    if (url.origin !== window.location.origin) { Toast.show('Invalid QR Code', 'This QR code does not belong to this portal.', 'error'); return; }
    const sessionId = url.searchParams.get('attendanceSession');
    const token = url.searchParams.get('attendanceToken');
    if (!sessionId || !token) { Toast.show('Invalid QR Code', 'This QR code is not a valid attendance credential.', 'error'); return; }
    Student.closeQrScanner();
    sessionStorage.setItem(AttendanceQr.key, JSON.stringify({ sessionId, token }));
    const ok = await AttendanceQr.submitPending();
    if (ok) Student.render();
  },

  async submitPendingQr() {
    const ok = await AttendanceQr.submitPending();
    if (ok) Student.render();
  },


  async submitAttendance(e) {

    e.preventDefault();


    const attendanceCode =
      document
        .getElementById('attendance-code')
        .value
        .trim()
        .toUpperCase();


    try {

      const data =
        await api(
          'POST',
          '/attendance/submit',
          { attendanceCode }
        );


      Toast.show(
        'Attendance',
        data.message,
        'success'
      );


      document
        .getElementById('attendance-code')
        .value = '';

    } catch {}


    return false;

  }

};


// ============================================================
// TEACHER VIEW
// ============================================================

const Teacher = {

  state: {
    classId: null,
    tab: 'gradebook'
  },

  _classes: [],


  // ==========================================================
  // MAIN TEACHER DASHBOARD
  // ==========================================================

  async render() {

    const el =
      document.getElementById(
        'teacher-section'
      );

    if (!el) return;


    // --------------------------------------------------------
    // LOAD CLASSES
    // --------------------------------------------------------

    const classes =
      await api(
        'GET',
        '/classes'
      ).catch(() => []);


    Teacher._classes =
      Array.isArray(classes)
        ? classes
        : [];


    // --------------------------------------------------------
    // PRESERVE SELECTED CLASS
    // --------------------------------------------------------

    if (
      Teacher._classes.length > 0
    ) {

      const stillExists =
        Teacher._classes.some(
          c =>
            String(c.id) ===
            String(Teacher.state.classId)
        );


      if (!stillExists) {

        Teacher.state.classId =
          Teacher._classes[0].id;

      }

    } else {

      Teacher.state.classId =
        null;

    }


    // --------------------------------------------------------
    // RENDER DASHBOARD
    // --------------------------------------------------------

    el.innerHTML = `

      <div class="space-y-6">

        <!-- ==================================================
             HEADER
        =================================================== -->

        <div
          class="flex
                 flex-col
                 lg:flex-row
                 lg:items-center
                 lg:justify-between
                 gap-4"
        >

          <div>

            <div
              class="flex
                     items-center
                     gap-3"
            >

              <div
                class="w-11
                       h-11
                       rounded-2xl
                       bg-eduBlue-100
                       flex
                       items-center
                       justify-center
                       shrink-0"
              >

                <i
                  class="fa-solid
                         fa-chalkboard-user
                         text-eduBlue-600
                         text-lg"
                ></i>

              </div>


              <div>

                <h2
                  class="text-xl
                         md:text-2xl
                         font-black
                         text-slate-800"
                >

                  Teacher Dashboard

                </h2>


                <p
                  class="text-sm
                         text-slate-500"
                >

                  Manage your classes,
                  learners, grades, and attendance.

                </p>

              </div>

            </div>

          </div>


          <button
            onclick="Teacher.showCreateClass()"
            class="inline-flex
                   items-center
                   justify-center
                   gap-2
                   bg-eduBlue-600
                   hover:bg-eduBlue-700
                   text-white
                   px-5
                   py-2.5
                   rounded-xl
                   text-sm
                   font-bold
                   shadow-sm
                   transition"
          >

            <i
              class="fa-solid fa-plus"
            ></i>

            Create Class

          </button>

        </div>


        <!-- ==================================================
             MY CLASSES
        =================================================== -->

        <div>

          <div
            class="flex
                   items-center
                   justify-between
                   mb-4"
          >

            <div>

              <h3
                class="text-lg
                       font-black
                       text-slate-800"
              >

                My Classes

              </h3>


              <p
                class="text-xs
                       text-slate-500
                       mt-1"
              >

                ${
                  Teacher._classes.length
                }
                ${
                  Teacher._classes.length === 1
                    ? 'class'
                    : 'classes'
                }
                assigned to you.

              </p>

            </div>

          </div>


          ${
            Teacher._classes.length === 0

              ? Teacher.renderEmptyClasses()

              : `

                <div
                  class="grid
                         grid-cols-1
                         md:grid-cols-2
                         xl:grid-cols-3
                         gap-5"
                >

                  ${Teacher._classes
                    .map(
                      c =>
                        Teacher.renderClassCard(c)
                    )
                    .join('')}


                  <!-- CREATE CLASS CARD -->

                  <button
                    type="button"
                    onclick="Teacher.showCreateClass()"
                    class="min-h-[300px]
                           rounded-2xl
                           border-2
                           border-dashed
                           border-slate-300
                           hover:border-eduBlue-400
                           hover:bg-eduBlue-50/40
                           transition
                           flex
                           flex-col
                           items-center
                           justify-center
                           gap-3
                           text-slate-500
                           hover:text-eduBlue-600"
                  >

                    <span
                      class="w-14
                             h-14
                             rounded-2xl
                             bg-slate-100
                             flex
                             items-center
                             justify-center"
                    >

                      <i
                        class="fa-solid
                               fa-plus
                               text-xl"
                      ></i>

                    </span>


                    <span
                      class="font-bold"
                    >

                      Create New Class

                    </span>


                    <span
                      class="text-xs
                             text-slate-400"
                    >

                      Add another class

                    </span>

                  </button>

                </div>

              `
          }

        </div>


        ${
          Teacher._classes.length > 0

            ? `

              <!-- ==========================================
                   SELECTED CLASS
              =========================================== -->

              <div
                class="glass-card
                       rounded-2xl
                       p-4
                       md:p-5"
              >

                <div
                  class="flex
                         flex-col
                         lg:flex-row
                         lg:items-center
                         lg:justify-between
                         gap-4"
                >

                  <div>

                    <p
                      class="text-xs
                             uppercase
                             tracking-wider
                             font-bold
                             text-slate-400
                             mb-1"
                    >

                      Selected Class

                    </p>


                    <h3
                      id="teacher-selected-class-name"
                      class="text-lg
                             font-black
                             text-slate-800"
                    >

                      ${esc(
                        Teacher.getSelectedClass()?.subject ||
                        'Select a class'
                      )}

                    </h3>


                    <p
                      id="teacher-selected-class-meta"
                      class="text-xs
                             text-slate-500
                             mt-1"
                    >

                      ${Teacher.getSelectedClass()
                        ? `${esc(Teacher.getSelectedClass().year_level || '')} • ${esc(Teacher.getSelectedClass().section || '')}`
                        : ''}

                    </p>

                  </div>


                  <div
                    class="flex
                           flex-wrap
                           items-center
                           gap-2"
                  >

                    <label
                      for="teacher-class-select"
                      class="text-xs
                             font-semibold
                             text-slate-500"
                    >

                      Quick Select

                    </label>


                    <select
                      id="teacher-class-select"
                      onchange="Teacher.selectClass(this.value)"
                      class="px-3
                             py-2
                             rounded-xl
                             border
                             border-slate-300
                             bg-white
                             text-sm
                             font-semibold
                             outline-none
                             focus:ring-2
                             focus:ring-eduBlue-300"
                    >

                      ${Teacher._classes
                        .map(
                          c => `

                            <option
                              value="${esc(c.id)}"
                              ${
                                String(c.id) ===
                                String(Teacher.state.classId)
                                  ? 'selected'
                                  : ''
                              }
                            >

                              ${esc(c.subject)}
                              —
                              ${esc(c.section)}

                            </option>

                          `
                        )
                        .join('')}

                    </select>

                  </div>

                </div>

              </div>


              <!-- ==========================================
                   TEACHER TABS
              =========================================== -->

              <div
                class="glass-card
                       rounded-2xl
                       overflow-hidden"
              >

                <div
                  class="flex
                         gap-1
                         border-b
                         border-slate-200
                         px-2
                         overflow-x-auto"
                >

                  ${[
                    'gradebook',
                    'approvals',
                    'attendance',
                    'quizzes',
                    'performance',
                    'exams',
                    'weights'
                  ]
                    .map(
                      t => `

                        <button
                          class="tab-btn
                                 whitespace-nowrap
                                 ${
                                   Teacher.state.tab === t
                                     ? 'active'
                                     : ''
                                 }
                                 px-4
                                 py-3
                                 text-sm
                                 font-semibold"
                          onclick="Teacher.switchTab('${t}')"
                        >

                          ${
                            t === 'gradebook'
                              ? '<i class="fa-solid fa-table-list mr-1"></i> Gradebook'
                              : t === 'approvals'
                                ? '<i class="fa-solid fa-user-check mr-1"></i> Approvals'
                                : t === 'attendance'
                                  ? '<i class="fa-solid fa-calendar-check mr-1"></i> Attendance'
                                  : t === 'quizzes'
                                    ? '<i class="fa-solid fa-circle-question mr-1"></i> Quizzes'
                                    : t === 'performance'
                                      ? '<i class="fa-solid fa-chart-line mr-1"></i> Performance'
                                      : t === 'exams'
                                        ? '<i class="fa-solid fa-file-pen mr-1"></i> Exams'
                                        : '<i class="fa-solid fa-sliders mr-1"></i> Weights'
                          }

                        </button>

                      `
                    )
                    .join('')}

                </div>


                <div
                  id="teacher-tab-content"
                  class="p-4 md:p-5"
                ></div>

              </div>

            `

            : ''

        }

      </div>

    `;


    // --------------------------------------------------------
    // RENDER SELECTED TAB
    // --------------------------------------------------------

    if (
      Teacher._classes.length > 0
    ) {

      Teacher.switchTab(
        Teacher.state.tab
      );

    }

  },


  // ==========================================================
  // EMPTY CLASS STATE
  // ==========================================================

  renderEmptyClasses() {

    return `

      <div
        class="glass-card
               rounded-2xl
               p-10
               text-center"
      >

        <div
          class="w-16
                 h-16
                 mx-auto
                 rounded-2xl
                 bg-eduBlue-100
                 flex
                 items-center
                 justify-center
                 mb-4"
        >

          <i
            class="fa-solid
                   fa-layer-group
                   text-eduBlue-600
                   text-2xl"
          ></i>

        </div>


        <h4
          class="font-black
                 text-slate-700"
        >

          No Classes Yet

        </h4>


        <p
          class="text-sm
                 text-slate-500
                 max-w-md
                 mx-auto
                 mt-2"
        >

          Create your first class to start managing
          learners, attendance, assessments, and grades.

        </p>


        <button
          onclick="Teacher.showCreateClass()"
          class="mt-5
                 bg-eduBlue-600
                 hover:bg-eduBlue-700
                 text-white
                 px-5
                 py-2.5
                 rounded-xl
                 text-sm
                 font-bold"
        >

          <i
            class="fa-solid fa-plus mr-1"
          ></i>

          Create Your First Class

        </button>

      </div>

    `;

  },


  // ==========================================================
  // CLASS CARD
  // ==========================================================

  renderClassCard(c) {

    const studentCount =
      Number(
        c.student_count || 0
      );


    const pendingCount =
      Number(
        c.pending_count || 0
      );


    const selected =
      String(c.id) ===
      String(Teacher.state.classId);


    return `

      <div
        class="relative
               overflow-hidden
               rounded-2xl
               border
               ${
                 selected
                   ? 'border-eduBlue-400 ring-2 ring-eduBlue-100'
                   : 'border-slate-200'
               }
               bg-white
               shadow-sm
               hover:shadow-lg
               transition"
      >

        <!-- TOP ACCENT -->

        <div
          class="h-1.5
                 ${
                   selected
                     ? 'bg-eduBlue-600'
                     : 'bg-slate-200'
                 }"
        ></div>


        <div
          class="p-5"
        >

          <!-- SUBJECT -->

          <div
            class="flex
                   items-start
                   justify-between
                   gap-3"
          >

            <div
              class="flex
                     gap-3
                     min-w-0"
            >

              <div
                class="w-11
                       h-11
                       rounded-xl
                       bg-eduBlue-100
                       flex
                       items-center
                       justify-center
                       shrink-0"
              >

                <i
                  class="fa-solid
                         fa-book-open
                         text-eduBlue-600"
                ></i>

              </div>


              <div
                class="min-w-0"
              >

                <h4
                  class="font-black
                         text-slate-800
                         truncate"
                  title="${esc(c.subject || '')}"
                >

                  ${esc(
                    c.subject ||
                    'Untitled Subject'
                  )}

                </h4>


                <p
                  class="text-xs
                         text-slate-500
                         mt-1"
                >

                  ${esc(
                    c.year_level ||
                    'Year Level'
                  )}

                  <span
                    class="mx-1"
                  >
                    •
                  </span>

                  ${esc(
                    c.section ||
                    'Section'
                  )}

                </p>

              </div>

            </div>


            ${
              selected

                ? `

                  <span
                    class="shrink-0
                           text-[10px]
                           font-black
                           uppercase
                           px-2
                           py-1
                           rounded-full
                           bg-eduBlue-100
                           text-eduBlue-700"
                  >

                    Selected

                  </span>

                `

                : ''

            }

          </div>


          <!-- CLASS DETAILS -->

          <div
            class="mt-5
                   space-y-2.5"
          >

            <div
              class="flex
                     items-center
                     justify-between
                     gap-3
                     text-sm"
            >

              <span
                class="text-slate-500"
              >

                <i
                  class="fa-solid
                         fa-door-open
                         w-5
                         text-slate-400"
                ></i>

                Room

              </span>


              <span
                class="font-semibold
                       text-slate-700"
              >

                ${esc(
                  c.room_number ||
                  'Not assigned'
                )}

              </span>

            </div>


            <div
              class="border-t
                     border-slate-100"
            ></div>


            <div>

              <p
                class="text-[10px]
                       uppercase
                       tracking-wider
                       font-bold
                       text-slate-400"
              >

                Class Code

              </p>


              <div
                class="mt-1
                       flex
                       items-center
                       justify-between
                       gap-2"
              >

                <code
                  class="text-sm
                         font-black
                         tracking-wider
                         text-eduBlue-700
                         break-all"
                >

                  ${esc(
                    c.class_code ||
                    '—'
                  )}

                </code>


                <button
                  type="button"
                  onclick="Teacher.copyClassCode('${esc(c.class_code || '')}')"
                  class="shrink-0
                         w-8
                         h-8
                         rounded-lg
                         bg-slate-100
                         hover:bg-eduBlue-100
                         text-slate-500
                         hover:text-eduBlue-600"
                  title="Copy class code"
                >

                  <i
                    class="fa-regular fa-copy"
                  ></i>

                </button>

              </div>

            </div>

          </div>


          <!-- COUNTS -->

          <div
            class="grid
                   grid-cols-2
                   gap-2
                   mt-5"
          >

            <div
              class="rounded-xl
                     bg-slate-50
                     p-3"
            >

              <div
                class="flex
                       items-center
                       gap-2"
              >

                <i
                  class="fa-solid
                         fa-users
                         text-eduBlue-600"
                ></i>


                <span
                  class="text-xs
                         text-slate-500"
                >

                  Students

                </span>

              </div>


              <p
                class="text-lg
                       font-black
                       text-slate-800
                       mt-1"
              >

                ${studentCount}

              </p>

            </div>


            <div
              class="rounded-xl
                     ${
                       pendingCount > 0
                         ? 'bg-amber-50'
                         : 'bg-slate-50'
                     }
                     p-3"
            >

              <div
                class="flex
                       items-center
                       gap-2"
              >

                <i
                  class="fa-solid
                         fa-user-clock
                         ${
                           pendingCount > 0
                             ? 'text-amber-500'
                             : 'text-slate-400'
                         }"
                ></i>


                <span
                  class="text-xs
                         ${
                           pendingCount > 0
                             ? 'text-amber-700'
                             : 'text-slate-500'
                         }"
                >

                  Pending

                </span>

              </div>


              <p
                class="text-lg
                       font-black
                       ${
                         pendingCount > 0
                           ? 'text-amber-700'
                           : 'text-slate-800'
                       }
                       mt-1"
              >

                ${pendingCount}

              </p>

            </div>

          </div>


          <!-- ACTIONS -->

          <div
            class="grid
                   grid-cols-2
                   gap-2
                   mt-5"
          >

            <button
              type="button"
              onclick="Teacher.selectClass('${esc(c.id)}')"
              class="inline-flex
                     items-center
                     justify-center
                     gap-2
                     bg-eduBlue-600
                     hover:bg-eduBlue-700
                     text-white
                     px-3
                     py-2.5
                     rounded-xl
                     text-xs
                     font-bold
                     transition"
            >

              <i
                class="fa-solid fa-folder-open"
              ></i>

              Open Class

            </button>


            <button
              type="button"
              onclick="Teacher.editClass('${esc(c.id)}')"
              class="inline-flex
                     items-center
                     justify-center
                     gap-2
                     bg-slate-100
                     hover:bg-slate-200
                     text-slate-700
                     px-3
                     py-2.5
                     rounded-xl
                     text-xs
                     font-bold
                     transition"
            >

              <i
                class="fa-solid fa-pen-to-square"
              ></i>

              Edit Class

            </button>

          </div>

        </div>

      </div>

    `;

  },


  // ==========================================================
  // GET SELECTED CLASS
  // ==========================================================

  getSelectedClass() {

    return Teacher._classes.find(
      c =>
        String(c.id) ===
        String(Teacher.state.classId)
    ) || null;

  },


  // ==========================================================
  // SELECT CLASS
  // ==========================================================

  async selectClass(id) {

    const exists =
      Teacher._classes.some(
        c =>
          String(c.id) ===
          String(id)
      );


    if (!exists) return;


    Teacher.state.classId =
      id;


    // Keep current tab.

    await Teacher.render();

  },


  // ==========================================================
  // COPY CLASS CODE
  // ==========================================================

  async copyClassCode(code) {

    if (!code) return;


    try {

      await navigator.clipboard.writeText(
        code
      );


      Toast.show(
        'Copied',
        'Class code copied to clipboard.',
        'success'
      );

    } catch {

      Toast.show(
        'Copy Failed',
        'Unable to copy the class code.',
        'error'
      );

    }

  },


  // ==========================================================
  // CREATE CLASS PANEL / MODAL
  // ==========================================================

  showCreateClass() {

    const existing =
      document.getElementById(
        'teacher-class-modal'
      );


    if (existing) {
      existing.remove();
    }


    document.body.insertAdjacentHTML(
      'beforeend',
      `

        <div
          id="teacher-class-modal"
          class="fixed
                 inset-0
                 z-[100]
                 flex
                 items-center
                 justify-center
                 p-4"
        >

          <div
            class="absolute
                   inset-0
                   bg-slate-900/60
                   backdrop-blur-sm"
            onclick="Teacher.closeClassModal()"
          ></div>


          <div
            class="relative
                   w-full
                   max-w-lg
                   bg-white
                   rounded-2xl
                   shadow-2xl
                   overflow-hidden"
          >

            <!-- HEADER -->

            <div
              class="px-5
                     py-4
                     bg-eduBlue-600
                     text-white"
            >

              <div
                class="flex
                       items-center
                       justify-between
                       gap-3"
              >

                <div>

                  <h3
                    class="font-black
                           text-lg"
                  >

                    Create New Class

                  </h3>


                  <p
                    class="text-xs
                           text-white/80
                           mt-1"
                  >

                    Add a class to your teacher dashboard.

                  </p>

                </div>


                <button
                  type="button"
                  onclick="Teacher.closeClassModal()"
                  class="w-9
                         h-9
                         rounded-xl
                         bg-white/10
                         hover:bg-white/20
                         flex
                         items-center
                         justify-center"
                >

                  <i
                    class="fa-solid fa-xmark"
                  ></i>

                </button>

              </div>

            </div>


            <!-- FORM -->

            <form
              onsubmit="return Teacher.createClass(event)"
              class="p-5
                     space-y-4"
            >

              <div>

                <label
                  class="block
                         text-sm
                         font-bold
                         text-slate-700
                         mb-1"
                >

                  Subject

                </label>


                <input
                  id="cc-subject"
                  type="text"
                  required
                  placeholder="e.g. General Mathematics"
                  class="w-full
                         px-3
                         py-2.5
                         rounded-xl
                         border
                         border-slate-300
                         outline-none
                         focus:ring-2
                         focus:ring-eduBlue-300"
                >

              </div>


              <div
                class="grid
                       grid-cols-1
                       sm:grid-cols-2
                       gap-4"
              >

                <div>

                  <label
                    class="block
                           text-sm
                           font-bold
                           text-slate-700
                           mb-1"
                  >

                    Section

                  </label>


                  <input
                    id="cc-section"
                    type="text"
                    required
                    placeholder="e.g. STEM-A"
                    class="w-full
                           px-3
                           py-2.5
                           rounded-xl
                           border
                           border-slate-300
                           outline-none
                           focus:ring-2
                           focus:ring-eduBlue-300"
                  >

                </div>


                <div>

                  <label
                    class="block
                           text-sm
                           font-bold
                           text-slate-700
                           mb-1"
                  >

                    Year Level

                  </label>


                  <input
                    id="cc-yearLevel"
                    type="text"
                    required
                    placeholder="e.g. Grade 12"
                    class="w-full
                           px-3
                           py-2.5
                           rounded-xl
                           border
                           border-slate-300
                           outline-none
                           focus:ring-2
                           focus:ring-eduBlue-300"
                  >

                </div>

              </div>


              <div>

                <label
                  class="block
                         text-sm
                         font-bold
                         text-slate-700
                         mb-1"
                >

                  Room Number
                  <span
                    class="font-normal
                           text-slate-400"
                  >
                    (optional)
                  </span>

                </label>


                <input
                  id="cc-roomNumber"
                  type="text"
                  placeholder="e.g. Room 204"
                  class="w-full
                         px-3
                         py-2.5
                         rounded-xl
                         border
                         border-slate-300
                         outline-none
                         focus:ring-2
                         focus:ring-eduBlue-300"
                >

              </div>


              <div
                class="rounded-xl
                       bg-blue-50
                       border
                       border-blue-100
                       p-3"
              >

                <div
                  class="flex
                         gap-2"
                >

                  <i
                    class="fa-solid
                           fa-circle-info
                           text-eduBlue-600
                           mt-0.5"
                  ></i>


                  <p
                    class="text-xs
                           text-slate-600"
                  >

                    A unique class code will be generated
                    automatically after the class is created.

                  </p>

                </div>

              </div>


              <div
                class="flex
                       flex-col-reverse
                       sm:flex-row
                       sm:justify-end
                       gap-2
                       pt-2"
              >

                <button
                  type="button"
                  onclick="Teacher.closeClassModal()"
                  class="px-4
                         py-2.5
                         rounded-xl
                         bg-slate-100
                         hover:bg-slate-200
                         text-slate-700
                         text-sm
                         font-bold"
                >

                  Cancel

                </button>


                <button
                  type="submit"
                  class="px-5
                         py-2.5
                         rounded-xl
                         bg-eduBlue-600
                         hover:bg-eduBlue-700
                         text-white
                         text-sm
                         font-bold"
                >

                  <i
                    class="fa-solid fa-plus mr-1"
                  ></i>

                  Create Class

                </button>

              </div>

            </form>

          </div>

        </div>

      `
    );

  },


  // ==========================================================
  // CLOSE CLASS MODAL
  // ==========================================================

  closeClassModal() {

    const modal =
      document.getElementById(
        'teacher-class-modal'
      );


    if (modal) {
      modal.remove();
    }

  },


  // ==========================================================
  // CREATE CLASS
  // ==========================================================

  async createClass(e) {

    e.preventDefault();


    const subject =
      val('cc-subject').trim();

    const section =
      val('cc-section').trim();

    const yearLevel =
      val('cc-yearLevel').trim();

    const roomNumber =
      val('cc-roomNumber').trim();


    if (
      !subject ||
      !section ||
      !yearLevel
    ) {

      Toast.show(
        'Missing Information',
        'Subject, section, and year level are required.',
        'error'
      );

      return false;

    }


    try {

      const created =
        await api(
          'POST',
          '/classes',
          {
            subject,
            section,
            yearLevel,
            roomNumber
          }
        );


      Toast.show(
        'Class Created',
        'Your class has been created successfully.',
        'success'
      );


      Teacher.closeClassModal();


      if (created?.id) {

        Teacher.state.classId =
          created.id;

      }


      await Teacher.render();


      ApprovalManager.forceRefresh();


    } catch {}


    return false;

  },


  // ==========================================================
  // EDIT CLASS
  // ==========================================================

  editClass(classId) {

    const cls =
      Teacher._classes.find(
        c =>
          String(c.id) ===
          String(classId)
      );


    if (!cls) {

      Toast.show(
        'Class Not Found',
        'The selected class could not be found.',
        'error'
      );

      return;

    }


    const existing =
      document.getElementById(
        'teacher-class-modal'
      );


    if (existing) {
      existing.remove();
    }


    document.body.insertAdjacentHTML(
      'beforeend',
      `

        <div
          id="teacher-class-modal"
          class="fixed
                 inset-0
                 z-[100]
                 flex
                 items-center
                 justify-center
                 p-4"
        >

          <div
            class="absolute
                   inset-0
                   bg-slate-900/60
                   backdrop-blur-sm"
            onclick="Teacher.closeClassModal()"
          ></div>


          <div
            class="relative
                   w-full
                   max-w-lg
                   bg-white
                   rounded-2xl
                   shadow-2xl
                   overflow-hidden"
          >

            <!-- HEADER -->

            <div
              class="px-5
                     py-4
                     bg-slate-800
                     text-white"
            >

              <div
                class="flex
                       items-center
                       justify-between
                       gap-3"
              >

                <div>

                  <h3
                    class="font-black
                           text-lg"
                  >

                    Edit Class

                  </h3>


                  <p
                    class="text-xs
                           text-white/70
                           mt-1"
                  >

                    Update the basic class information.

                  </p>

                </div>


                <button
                  type="button"
                  onclick="Teacher.closeClassModal()"
                  class="w-9
                         h-9
                         rounded-xl
                         bg-white/10
                         hover:bg-white/20
                         flex
                         items-center
                         justify-center"
                >

                  <i
                    class="fa-solid fa-xmark"
                  ></i>

                </button>

              </div>

            </div>


            <!-- FORM -->

            <form
              onsubmit="return Teacher.saveClass(event, '${esc(cls.id)}')"
              class="p-5
                     space-y-4"
            >

              <div>

                <label
                  class="block
                         text-sm
                         font-bold
                         text-slate-700
                         mb-1"
                >

                  Subject

                </label>


                <input
                  id="edit-class-subject"
                  type="text"
                  required
                  value="${esc(cls.subject || '')}"
                  class="w-full
                         px-3
                         py-2.5
                         rounded-xl
                         border
                         border-slate-300
                         outline-none
                         focus:ring-2
                         focus:ring-eduBlue-300"
                >

              </div>


              <div
                class="grid
                       grid-cols-1
                       sm:grid-cols-2
                       gap-4"
              >

                <div>

                  <label
                    class="block
                           text-sm
                           font-bold
                           text-slate-700
                           mb-1"
                  >

                    Section

                  </label>


                  <input
                    id="edit-class-section"
                    type="text"
                    required
                    value="${esc(cls.section || '')}"
                    class="w-full
                           px-3
                           py-2.5
                           rounded-xl
                           border
                           border-slate-300
                           outline-none
                           focus:ring-2
                           focus:ring-eduBlue-300"
                  >

                </div>


                <div>

                  <label
                    class="block
                           text-sm
                           font-bold
                           text-slate-700
                           mb-1"
                  >

                    Year Level

                  </label>


                  <input
                    id="edit-class-yearLevel"
                    type="text"
                    required
                    value="${esc(cls.year_level || '')}"
                    class="w-full
                           px-3
                           py-2.5
                           rounded-xl
                           border
                           border-slate-300
                           outline-none
                           focus:ring-2
                           focus:ring-eduBlue-300"
                  >

                </div>

              </div>


              <div>

                <label
                  class="block
                         text-sm
                         font-bold
                         text-slate-700
                         mb-1"
                >

                  Room Number

                </label>


                <input
                  id="edit-class-roomNumber"
                  type="text"
                  value="${esc(cls.room_number || '')}"
                  placeholder="e.g. Room 204"
                  class="w-full
                         px-3
                         py-2.5
                         rounded-xl
                         border
                         border-slate-300
                         outline-none
                         focus:ring-2
                         focus:ring-eduBlue-300"
                >

              </div>


              <!-- LOCKED INFORMATION -->

              <div
                class="rounded-xl
                       bg-slate-50
                       border
                       border-slate-200
                       p-3
                       space-y-2"
              >

                <p
                  class="text-[10px]
                         uppercase
                         tracking-wider
                         font-black
                         text-slate-400"
                >

                  Protected Class Information

                </p>


                <div
                  class="flex
                         items-center
                         justify-between
                         gap-3
                         text-xs"
                >

                  <span
                    class="text-slate-500"
                  >

                    Class Code

                  </span>


                  <code
                    class="font-bold
                           text-slate-700"
                  >

                    ${esc(
                      cls.class_code ||
                      '—'
                    )}

                  </code>

                </div>


                <div
                  class="flex
                         items-center
                         justify-between
                         gap-3
                         text-xs"
                >

                  <span
                    class="text-slate-500"
                  >

                    Academic Term

                  </span>


                  <span
                    class="font-semibold
                           text-slate-700"
                  >

                    ${
                      cls.academic_year
                        ? `${esc(cls.academic_year)} • ${esc(cls.semester || '')}`
                        : 'Current Term'
                    }

                  </span>

                </div>


                <p
                  class="text-[10px]
                         text-slate-400
                         pt-1"
                >

                  Class code, teacher assignment,
                  academic term, and grading weights
                  cannot be changed here.

                </p>

              </div>


              <!-- ACTIONS -->

              <div
                class="flex
                       flex-col-reverse
                       sm:flex-row
                       sm:justify-end
                       gap-2
                       pt-2"
              >

                <button
                  type="button"
                  onclick="Teacher.closeClassModal()"
                  class="px-4
                         py-2.5
                         rounded-xl
                         bg-slate-100
                         hover:bg-slate-200
                         text-slate-700
                         text-sm
                         font-bold"
                >

                  Cancel

                </button>


                <button
                  type="submit"
                  class="px-5
                         py-2.5
                         rounded-xl
                         bg-eduBlue-600
                         hover:bg-eduBlue-700
                         text-white
                         text-sm
                         font-bold"
                >

                  <i
                    class="fa-solid
                           fa-floppy-disk
                           mr-1"
                  ></i>

                  Save Changes

                </button>

              </div>

            </form>

          </div>

        </div>

      `
    );

  },


  // ==========================================================
  // SAVE CLASS EDIT
  // ==========================================================

  async saveClass(
    e,
    classId
  ) {

    e.preventDefault();


    const subject =
      val(
        'edit-class-subject'
      ).trim();

    const section =
      val(
        'edit-class-section'
      ).trim();

    const yearLevel =
      val(
        'edit-class-yearLevel'
      ).trim();

    const roomNumber =
      val(
        'edit-class-roomNumber'
      ).trim();


    if (
      !subject ||
      !section ||
      !yearLevel
    ) {

      Toast.show(
        'Missing Information',
        'Subject, section, and year level are required.',
        'error'
      );

      return false;

    }


    try {

      const response =
        await api(
          'PUT',
          `/classes/${classId}`,
          {
            subject,
            section,
            yearLevel,
            roomNumber
          }
        );


      Toast.show(
        'Class Updated',
        'Class information has been updated successfully.',
        'success'
      );


      Teacher.closeClassModal();


      // Keep edited class selected.

      Teacher.state.classId =
        classId;


      await Teacher.render();


    } catch {}


    return false;

  },


  // ==========================================================
  // SWITCH TEACHER TAB
  // ==========================================================

  switchTab(tab) {

    Teacher.state.tab =
      tab;


    document
      .querySelectorAll(
        '#teacher-section .tab-btn'
      )
      .forEach(
        b => {

          b.classList.toggle(
            'active',
            b.dataset?.tab === tab ||
            b.textContent
              .trim()
              .toLowerCase()
              .includes(
                tab.replace(
                  '-',
                  ' '
                )
              )
          );

        }
      );


    const functions = {

      gradebook:
        Teacher.renderGradebook,

      approvals:
        Teacher.renderApprovals,

      attendance:
        Teacher.renderAttendance,

      quizzes:
        () =>
          Teacher.renderAssessment(
            'quizzes'
          ),

      performance:
        () =>
          Teacher.renderAssessment(
            'performance'
          ),

      exams:
        () =>
          Teacher.renderAssessment(
            'exams'
          ),

      weights:
        Teacher.renderWeights

    };


    const fn =
      functions[tab];


    if (
      typeof fn === 'function'
    ) {

      fn();

    }


    if (
      tab === 'approvals'
    ) {

      ApprovalManager.forceRefresh();

    }

  },


  // ==========================================================
  // GRADEBOOK
  // ==========================================================

  async renderGradebook() {

    const box =
      document.getElementById(
        'teacher-tab-content'
      );


    if (!box) return;


    const cid =
      Teacher.state.classId;


    if (!cid) {

      box.innerHTML = '';

      return;

    }


    const rows =
      await api(
        'GET',
        `/grades/${cid}`
      ).catch(() => []);


    box.innerHTML = `

      <div
        class="space-y-4"
      >

        <div
          class="flex
                 flex-col
                 sm:flex-row
                 sm:items-center
                 sm:justify-between
                 gap-3"
        >

          <div>

            <h4
              class="font-black
                     text-slate-800"
            >

              Gradebook

            </h4>


            <p
              class="text-xs
                     text-slate-500"
                     mt-1"
            >

              Manage learner grades for the selected class.

            </p>

          </div>


          <input
            id="teacher-grade-filter"
            type="search"
            placeholder="Search student..."
            oninput="Teacher.filterGradebook()"
            class="w-full
                   sm:w-64
                   px-3
                   py-2
                   rounded-xl
                   border
                   border-slate-300
                   text-sm"
          >

        </div>


        <div
          class="glass-card
                 rounded-2xl
                 overflow-x-auto"
        >

          <table
            id="teacher-grade-table"
            class="gradebook
                   w-full
                   text-left"
          >

            <thead
              class="text-xs
                     uppercase
                     text-slate-500
                     border-b"
            >

              <tr>

                <th>Student</th>
                <th>Attendance</th>
                <th>Quiz</th>
                <th>Performance</th>
                <th>Exam</th>
                <th>Final</th>
                <th>Status</th>
                <th>Actions</th>

              </tr>

            </thead>


            <tbody>

              ${
                Array.isArray(rows)
                  ? rows
                      .map(
                        r =>
                          Teacher.gradebookRow(r)
                      )
                      .join('')
                  : ''
              }

            </tbody>

          </table>

        </div>

      </div>

    `;

  },


  gradebookRow(r) {

    const adjustBtn = (component) => `
      <button
        onclick="Teacher.openAdjustmentModal('${esc(r.studentId)}', '${component}')"
        title="Edit ${component} total"
        class="ml-1
               text-slate-400
               hover:text-eduBlue-600"
      >
        <i class="fa-solid fa-pen text-[10px]"></i>
      </button>
    `;

    return `

      <tr
        class="border-b
               hover:bg-slate-50"
      >

        <td
          class="font-semibold"
        >

${esc(
  r.studentName ||
  (
    (r.last_name || r.s_last || '') +
    ', ' +
    (r.first_name || r.s_first || '')
  )
)}

        </td>


        <td>
          ${esc(r.attendance ?? '—')}${adjustBtn('attendance')}
        </td>


        <td>
          ${esc(r.quiz ?? '—')}${adjustBtn('quiz')}
        </td>


        <td>
          ${esc(r.performance ?? '—')}${adjustBtn('performance')}
        </td>


        <td>
          ${esc(r.exam ?? '—')}${adjustBtn('exam')}
        </td>


        <td
          class="font-black"
        >
          ${esc(
            r.final_grade ??
            r.finalGrade ??
            '—'
          )}
        </td>


        <td>

          ${
            r.status
              ? `
                <span
                  class="text-xs
                         font-bold
                         ${
                           r.status === 'released'
                             ? 'text-emerald-600'
                             : 'text-amber-600'
                         }"
                >

                  ${esc(r.status)}

                </span>
              `
              : '—'
          }

        </td>

        <td>
          ${
            r.status === 'released'
              ? `<span class="text-[10px] font-bold text-emerald-600"><i class="fa-solid fa-check"></i> Released</span>`
              : r.status === 'finalized'
                ? `<button onclick="Teacher.releaseGrade('${esc(r.studentId)}')" class="text-[11px] font-bold text-eduBlue-600 hover:underline">Release</button>`
                : `<button onclick="Teacher.finalizeGrade('${esc(r.studentId)}')" class="text-[11px] font-bold text-slate-600 hover:underline">Finalize</button>`
          }
        </td>

      </tr>

    `;

  },


  // ==========================================================
  // GRADE COMPONENT ADJUSTMENTS (manual total override)
  //
  // Backed by:
  //   GET    /grades/:classId/students/:studentId/adjustments
  //   PUT    /grades/:classId/students/:studentId/adjustments (atomic batch)
  //   DELETE /grades/:classId/students/:studentId/adjustments/:component
  //
  // The server always validates the new total against that component's
  // actual maximum (total attendance sessions, or sum of quiz/performance/
  // exam max scores) and never lets an adjustment exceed it or go negative.
  // Original attendance/quiz/performance/exam records are never touched —
  // this only affects the percentage that feeds into the final grade.
  // ==========================================================

  closeAdjustmentModal() {
    const modal = document.getElementById('teacher-adjustment-modal');
    if (modal) modal.remove();
  },

  async openAdjustmentModal(studentId, component) {
    const cid = Teacher.state.classId;
    const all = await api('GET', `/grades/${cid}/students/${studentId}/adjustments`).catch(() => null);
    if (!all) return;

    const ctx = all[component];
    const existing = document.getElementById('teacher-adjustment-modal');
    if (existing) existing.remove();

    const label = component[0].toUpperCase() + component.slice(1);

    const bodyHtml = !ctx || !ctx.available
      ? `<p class="text-sm text-slate-500 py-4">${esc((ctx && ctx.message) || 'No data available for this component yet.')}</p>`
      : `
        <p class="text-xs text-slate-500 mb-3">
          Current total (from recorded ${ctx.label}${ctx.currentAdjustmentPoints ? ', including an existing adjustment' : ''}):
          <span class="font-black text-slate-800">${ctx.currentTotal} / ${ctx.max}</span>
        </p>
        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">New Total (out of ${ctx.max})</label>
        <input id="adj-new-total" type="number" step="any" min="0" max="${ctx.max}" value="${ctx.currentTotal}"
          class="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm mb-3">
        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Reason (optional)</label>
        <input id="adj-reason" type="text" placeholder="e.g. Excused absence reviewed after the fact"
          class="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm">
      `;

    document.body.insertAdjacentHTML('beforeend', `
      <div id="teacher-adjustment-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="Teacher.closeAdjustmentModal()"></div>
        <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div class="px-5 py-4 bg-slate-800 text-white flex items-center justify-between gap-3">
            <div>
              <h3 class="font-black text-lg">Edit ${label} Total</h3>
              <p class="text-xs text-white/70 mt-1">Adjusts the overall ${component} grade component for this student.</p>
            </div>
            <button type="button" onclick="Teacher.closeAdjustmentModal()" class="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="p-5">
            ${bodyHtml}
          </div>
          <div class="px-5 py-4 bg-slate-50 border-t flex items-center justify-between gap-2">
            ${ctx && ctx.available && ctx.currentAdjustmentPoints ? `
              <button onclick="Teacher.removeAdjustment('${esc(studentId)}', '${component}')" class="text-xs font-bold text-red-600">
                Remove Adjustment
              </button>` : `<span></span>`}
            <div class="flex gap-2">
              <button onclick="Teacher.closeAdjustmentModal()" class="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
              ${ctx && ctx.available ? `
                <button onclick="Teacher.saveAdjustment('${esc(studentId)}', '${component}')" class="px-4 py-2 rounded-xl text-sm font-bold bg-eduBlue-600 text-white">Save Adjustment</button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `);
  },

  async saveAdjustment(studentId, component) {
    const input = document.getElementById('adj-new-total');
    if (!input) return;
    const newTotal = parseFloat(input.value);
    if (Number.isNaN(newTotal)) {
      Toast.show('Invalid Total', 'Please enter a valid number.', 'error');
      return;
    }
    const reason = (document.getElementById('adj-reason') || {}).value || '';
    const cid = Teacher.state.classId;
    try {
      const result = await api('PUT', `/grades/${cid}/students/${studentId}/adjustments`, { adjustments: { [component]: newTotal }, reason });
      Toast.show('Adjusted', result.message || 'Total adjusted.', 'success');
      Teacher.closeAdjustmentModal();
      Teacher.renderGradebook();
    } catch {}
  },

  async removeAdjustment(studentId, component) {
    const cid = Teacher.state.classId;
    try {
      const result = await api('DELETE', `/grades/${cid}/students/${studentId}/adjustments/${component}`);
      Toast.show('Reverted', result.message || 'Adjustment removed.', 'success');
      Teacher.closeAdjustmentModal();
      Teacher.renderGradebook();
    } catch {}
  },

  async finalizeGrade(studentId) {
    const cid = Teacher.state.classId;
    try {
      const result = await api('POST', `/grades/${cid}/students/${studentId}/finalize`);
      Toast.show('Finalized', result.message || 'Grade finalized.', 'success');
      Teacher.renderGradebook();
    } catch {}
  },

  async releaseGrade(studentId) {
    const cid = Teacher.state.classId;
    try {
      const result = await api('POST', `/grades/${cid}/students/${studentId}/release`);
      Toast.show('Released', result.message || 'Grade released to student.', 'success');
      Teacher.renderGradebook();
    } catch {}
  },


  filterGradebook() {

    const input =
      document.getElementById(
        'teacher-grade-filter'
      );


    const table =
      document.getElementById(
        'teacher-grade-table'
      );


    if (!input || !table) return;


    const query =
      input.value
        .trim()
        .toLowerCase();


    table
      .querySelectorAll(
        'tbody tr'
      )
      .forEach(
        row => {

          row.style.display =
            row.textContent
              .toLowerCase()
              .includes(query)
                ? ''
                : 'none';

        }
      );

  },


  // ==========================================================
  // APPROVALS
  // ==========================================================

  async renderApprovals() {

    const box =
      document.getElementById(
        'teacher-tab-content'
      );


    if (!box) return;


    const cid =
      Teacher.state.classId;


    if (!cid) return;


    const rows =
      await api(
        'GET',
        `/classes/${cid}/pending-enrollments`
      ).catch(() => []);


    box.innerHTML = `

      <div
        class="glass-card
               rounded-2xl
               p-4"
      >

        <div
          class="flex
                 items-center
                 justify-between
                 gap-3
                 mb-4"
        >

          <div>

            <h4
              class="font-black"
            >

              Student Approvals

            </h4>


            <p
              class="text-xs
                     text-slate-500
                     mt-1"
            >

              Review students requesting to join this class.

            </p>

          </div>


          <span
            class="px-3
                   py-1
                   rounded-full
                   text-xs
                   font-bold
                   ${
                     rows.length
                       ? 'bg-amber-100 text-amber-700'
                       : 'bg-emerald-100 text-emerald-700'
                   }"
          >

            ${rows.length}
            Pending

          </span>

        </div>


        ${
          rows.length === 0

            ? `

              <div
                class="text-center
                       py-10"
              >

                <i
                  class="fa-solid
                         fa-circle-check
                         text-emerald-500
                         text-3xl
                         mb-3"
                ></i>


                <p
                  class="font-semibold
                         text-slate-600"
                >

                  No pending requests

                </p>

              </div>

            `

            : rows
                .map(
                  r => `

                    <div
                      class="flex
                             flex-col
                             sm:flex-row
                             sm:items-center
                             sm:justify-between
                             gap-3
                             border-b
                             py-3"
                    >

                      <div>

                        <b>

                          ${esc(
                            r.first_name || ''
                          )}

                          ${esc(
                            r.last_name || ''
                          )}

                        </b>


                        <p
                          class="text-xs
                                 text-slate-500"
                        >

                          ${esc(
                            r.email || ''
                          )}

                        </p>

                      </div>


                      <div
                        class="flex
                               gap-2"
                      >

                        <button
                          onclick="Teacher.approveStudent('${esc(r.id)}')"
                          class="bg-emerald-600
                                 hover:bg-emerald-700
                                 text-white
                                 px-3
                                 py-1.5
                                 rounded-lg
                                 text-xs
                                 font-bold"
                        >

                          Approve

                        </button>


                        <button
                          onclick="Teacher.rejectStudent('${esc(r.id)}')"
                          class="bg-red-600
                                 hover:bg-red-700
                                 text-white
                                 px-3
                                 py-1.5
                                 rounded-lg
                                 text-xs
                                 font-bold"
                        >

                          Reject

                        </button>

                      </div>

                    </div>

                  `
                )
                .join('')
        }

      </div>

    `;

  },


  async approveStudent(
    studentId
  ) {

    try {

      await api(
        'POST',
        `/classes/${Teacher.state.classId}/enrollments/${studentId}/approve`
      );


      Toast.show(
        'Approved',
        'Student approved successfully.',
        'success'
      );


      await Teacher.render();


      ApprovalManager.forceRefresh();

    } catch {}

  },


  async rejectStudent(
    studentId
  ) {

    try {

      await api(
        'POST',
        `/classes/${Teacher.state.classId}/enrollments/${studentId}/reject`
      );


      Toast.show(
        'Rejected',
        'Student request rejected.',
        'success'
      );


      await Teacher.render();


      ApprovalManager.forceRefresh();

    } catch {}

  },


  // ==========================================================
  // ATTENDANCE
  // ==========================================================

  async renderAttendance() {

    const box =
      document.getElementById(
        'teacher-tab-content'
      );


    if (!box) return;


    const cid =
      Teacher.state.classId;


    if (!cid) return;


    const rows =
      await api(
        'GET',
        `/attendance/classes/${cid}/sessions`
      ).catch(() => []);


    box.innerHTML = `

      <div
        class="space-y-4"
      >

        <div
          class="flex
                 items-center
                 justify-between
                 gap-3"
        >

          <div>

            <h4
              class="font-black"
            >

              Attendance

            </h4>


            <p
              class="text-xs
                     text-slate-500
                     mt-1"
            >

              Manage attendance sessions for this class.

            </p>

          </div>


          <button
            onclick="Teacher.manageSession()"
            class="bg-eduBlue-600
                   hover:bg-eduBlue-700
                   text-white
                   px-4
                   py-2
                   rounded-xl
                   text-xs
                   font-bold"
          >

            <i
              class="fa-solid fa-plus mr-1"
            ></i>

            New Session

          </button>

        </div>


        <div
          class="glass-card
                 rounded-2xl
                 overflow-hidden"
        >

          ${
            Array.isArray(rows) &&
            rows.length

              ? rows
                  .map(
                    r => `

                      <div
                        class="p-4
                               border-b
                               last:border-b-0"
                      >

                        <div
                          class="flex
                                 items-center
                                 justify-between
                                 gap-3"
                        >

                          <div>

                            <b>

                              ${esc(
                                r.session_date ||
                                r.date ||
                                'Attendance Session'
                              )}

                            </b>


                            <p
                              class="text-xs
                                     text-slate-500
                                     mt-1"
                            >

                              ${esc(
                                r.status ||
                                ''
                              )}

                            </p>

                          </div>


                          <button
                            onclick="Teacher.openSession('${esc(r.id)}')"
                            class="text-xs
                                   font-bold
                                   text-eduBlue-600"
                          >

                            Manage

                          </button>

                        </div>

                      </div>

                    `
                  )
                  .join('')

              : `

                <div
                  class="text-center
                         py-10
                         text-sm
                         text-slate-500"
                >

                  No attendance sessions yet.

                </div>

              `
          }

        </div>

      </div>

    `;

  },


  // ==========================================================
  // ATTENDANCE SESSION CREATION
  // ==========================================================

  manageSession() {

    const cid =
      Teacher.state.classId;


    if (!cid) return;


    const date =
      prompt(
        'Enter attendance date (YYYY-MM-DD):',
        new Date()
          .toISOString()
          .slice(0, 10)
      );


    if (!date) return;


    Teacher.startAttendanceSession(
      date
    );

  },


  async startAttendanceSession(
    date
  ) {

    try {

      await api(
        'POST',
        '/attendance/sessions',
        {
          classId:
            Teacher.state.classId,

          sessionDate:
            date
        }
      );


      Toast.show(
        'Session Created',
        'Attendance session created.',
        'success'
      );


      Teacher.renderAttendance();

    } catch {}

  },


  async openSession(
    sessionId
  ) {

    if (Teacher._attendanceQrTimer) { clearInterval(Teacher._attendanceQrTimer); Teacher._attendanceQrTimer = null; }

    const box =
      document.getElementById(
        'teacher-tab-content'
      );


    if (!box) return;

    box.innerHTML = `<div class="text-center py-10 text-slate-400 text-sm">Loading roster…</div>`;

    const data =
      await api(
        'GET',
        `/attendance/sessions/${sessionId}/roster`
      ).catch(() => null);


    if (!data) return;

    const { session, roster } = data;

    const statusBtn = (studentId, status, current) => {
      const active = current === status;
      const colors = { present: 'emerald', late: 'amber', absent: 'red', excused: 'slate' };
      const c = colors[status];
      return `<button onclick="Teacher.setAttendanceStatus('${esc(sessionId)}', '${esc(studentId)}', '${status}')"
        class="px-2 py-1 rounded-lg text-[11px] font-bold border ${active ? `bg-${c}-600 text-white border-${c}-600` : `bg-white text-${c}-700 border-${c}-300 hover:bg-${c}-50`}">
        ${status[0].toUpperCase() + status.slice(1)}</button>`;
    };

    box.innerHTML = `

      <div
        class="glass-card
               rounded-2xl
               p-5"
      >

        <button
          onclick="Teacher.renderAttendance()"
          class="text-sm
                 font-bold
                 text-eduBlue-600
                 mb-4"
        >

          <i
            class="fa-solid fa-arrow-left mr-1"
          ></i>

          Back to Attendance

        </button>

        <div class="flex justify-between items-center mb-4">
          <div>
            <h4 class="font-black">${esc(session.session_date)}</h4>
            <p class="text-xs text-slate-500">
              Status: ${esc(session.status)}
              ${session.status === 'open' ? ` &middot; Code: <span class="font-mono font-bold">${esc(session.attendance_code)}</span>` : ''}
            </p>
          </div>
          ${session.status === 'open' ? `
            <button onclick="Teacher.closeAttendanceSession('${esc(sessionId)}')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-bold">
              <i class="fa-solid fa-stop mr-1"></i> Close Session
            </button>` : ''}
        </div>

        ${session.status === 'open' ? `
        <div class="mb-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <div class="flex flex-col lg:flex-row lg:items-center gap-4">
            <div class="flex-1">
              <div class="text-[11px] font-black uppercase tracking-widest text-slate-500">Student Check-in</div>
              <div class="mt-1 flex flex-wrap items-center gap-2">
                <span class="text-sm font-bold text-slate-700">Attendance Code</span>
                <span class="px-3 py-1 rounded-lg bg-slate-900 text-amber-300 font-mono font-black tracking-[0.2em]">${esc(session.attendance_code)}</span>
              </div>
              <p class="mt-2 text-xs text-slate-500">Learners may use the Attendance Code or scan the rotating QR code. The QR refreshes automatically every minute.</p>
            </div>
            <button onclick="Teacher.showAttendanceQr('${esc(sessionId)}')" class="bg-slate-900 hover:bg-slate-800 text-amber-300 px-4 py-2.5 rounded-xl text-xs font-black shadow-lg">
              <i class="fa-solid fa-qrcode mr-2"></i> Show QR Code
            </button>
          </div>
          <div id="attendance-qr-panel" class="hidden mt-4 pt-4 border-t border-amber-200 text-center">
            <div id="attendance-qr-canvas" class="inline-flex bg-white p-4 rounded-2xl shadow-sm"></div>
            <div id="attendance-qr-countdown" class="mt-2 text-xs font-bold text-slate-500"></div>
          </div>
        </div>
        ` : ''}

        <div class="space-y-2">
          ${
            Array.isArray(roster) && roster.length
              ? roster.map(s => `
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b py-3">
                  <span class="font-semibold text-sm">${esc(s.last_name)}, ${esc(s.first_name)} <span class="text-slate-400 text-xs">(${esc(s.student_number)})</span></span>
                  <div class="flex gap-1">
                    ${['present', 'late', 'absent', 'excused'].map(st => statusBtn(s.id, st, s.status)).join('')}
                  </div>
                </div>
              `).join('')
              : `<p class="text-sm text-slate-500 italic py-4">No active students enrolled in this class yet.</p>`
          }
        </div>

      </div>

    `;

  },


  async showAttendanceQr(sessionId) {
    const panel = document.getElementById('attendance-qr-panel');
    if (!panel) return;
    panel.classList.remove('hidden');
    if (Teacher._attendanceQrTimer) clearInterval(Teacher._attendanceQrTimer);
    const refresh = async () => {
      const data = await api('GET', `/attendance/sessions/${sessionId}/qr`).catch(() => null);
      if (!data) return;
      const target = document.getElementById('attendance-qr-canvas');
      if (!target || typeof QRCode === 'undefined') return Toast.show('QR unavailable','QR renderer failed to load. Attendance Code remains available.','error');
      target.innerHTML = '';
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      url.searchParams.set('attendanceSession', data.sessionId);
      url.searchParams.set('attendanceToken', data.token);
      const payload = url.toString();
      new QRCode(target, { text: payload, width: 240, height: 240, correctLevel: QRCode.CorrectLevel.M });
      let remaining = Number(data.expiresInSeconds || 60);
      const countdown = document.getElementById('attendance-qr-countdown');
      if (countdown) countdown.textContent = `QR refreshes in about ${remaining}s`;
    };
    await refresh();
    Teacher._attendanceQrTimer = setInterval(refresh, 55000);
  },

  async setAttendanceStatus(sessionId, studentId, status) {
    try {
      await api('PUT', `/attendance/sessions/${sessionId}/records/${studentId}`, { status });
      Toast.show('Saved', `Marked ${status}.`, 'success');
      Teacher.openSession(sessionId);
    } catch {}
  },

  async closeAttendanceSession(sessionId) {
    if (Teacher._attendanceQrTimer) { clearInterval(Teacher._attendanceQrTimer); Teacher._attendanceQrTimer = null; }
    try {
      await api('POST', `/attendance/sessions/${sessionId}/close`);
      Toast.show('Closed', 'Attendance session closed.', 'success');
      Teacher.openSession(sessionId);
    } catch {}
  },


  // ==========================================================
  // ASSESSMENTS
  // ==========================================================

  async renderAssessment(
    kind
  ) {

    const box =
      document.getElementById(
        'teacher-tab-content'
      );


    if (!box) return;


    const cid =
      Teacher.state.classId;


    if (!cid) return;


    const endpoint =
      kind === 'quizzes'
        ? `/assessments/quizzes?classId=${encodeURIComponent(cid)}`
        : kind === 'performance'
          ? `/assessments/performance-tasks?classId=${encodeURIComponent(cid)}`
          : `/assessments/exams?classId=${encodeURIComponent(cid)}`;


    const rows =
      await api(
        'GET',
        endpoint
      ).catch(() => []);


    const title =
      kind === 'quizzes'
        ? 'Quizzes'
        : kind === 'performance'
          ? 'Performance Tasks'
          : 'Examinations';

    // Exams are grouped into PRELIM / MIDTERM / FINAL tabs using each
    // exam's existing exam_type field — no backend/schema change needed,
    // this is purely a display grouping. The grading formula still treats
    // all exams as one combined "exam" component, unchanged.
    const examPeriods = ['Prelim', 'Midterm', 'Final'];
    let visibleRows = rows;
    let periodTabsHtml = '';
    if (kind === 'exams' && Array.isArray(rows)) {
      if (!Teacher.state.examPeriod) Teacher.state.examPeriod = 'All';
      const activePeriod = Teacher.state.examPeriod;
      visibleRows = activePeriod === 'All'
        ? rows
        : rows.filter(r => String(r.exam_type || '').toLowerCase() === activePeriod.toLowerCase());
      periodTabsHtml = `
        <div class="flex gap-2 border-b mb-4 overflow-x-auto">
          ${['All', ...examPeriods].map(p => `
            <button onclick="Teacher.setExamPeriod('${p}')"
              class="px-4 py-2 text-xs font-bold whitespace-nowrap ${activePeriod === p ? 'border-b-2 border-eduBlue-600 text-eduBlue-600' : 'text-slate-500 hover:text-eduBlue-600'}">
              ${p}
            </button>`).join('')}
        </div>`;
    }

    box.innerHTML = `

      <div
        class="space-y-4"
      >

        <div
          class="flex
                 flex-col
                 sm:flex-row
                 sm:items-center
                 sm:justify-between
                 gap-3"
        >

          <div>

            <h4
              class="font-black"
            >

              ${title}

            </h4>


            <p
              class="text-xs
                     text-slate-500
                     mt-1"
            >

              Manage ${kind.replace('-', ' ')}
              for this class.

            </p>

          </div>


          <button
            onclick="Teacher.createAssessment('${kind}')"
            class="bg-eduBlue-600
                   hover:bg-eduBlue-700
                   text-white
                   px-4
                   py-2
                   rounded-xl
                   text-xs
                   font-bold"
          >

            <i
              class="fa-solid fa-plus mr-1"
            ></i>

            Add ${title.replace('Examinations', 'Exam')}

          </button>

        </div>

        ${periodTabsHtml}

        <div
          class="grid
                 grid-cols-1
                 md:grid-cols-2
                 gap-4"
        >

          ${
            Array.isArray(visibleRows)
              ? (visibleRows.length
                  ? visibleRows
                      .map(
                        r =>
                          Teacher.assessmentCard(
                            r,
                            kind
                          )
                      )
                      .join('')
                  : `<p class="text-sm text-slate-500 italic col-span-2">No ${kind === 'exams' && Teacher.state.examPeriod !== 'All' ? Teacher.state.examPeriod.toLowerCase() + ' exams' : kind.replace('-', ' ')} yet.</p>`)
              : ''
          }

        </div>

      </div>

    `;

  },

  setExamPeriod(period) {
    Teacher.state.examPeriod = period;
    Teacher.renderAssessment('exams');
  },


  assessmentCard(
    item,
    kind
  ) {

    const id =
      item.id;


    return `

      <div
        class="glass-card
               rounded-2xl
               p-4"
      >

        <div
          class="flex
                 items-start
                 justify-between
                 gap-3"
        >

          <div>

            <h5
              class="font-black"
            >

              ${esc(
                item.title ||
                item.name ||
                'Assessment'
              )}

            </h5>


            <p
              class="text-xs
                     text-slate-500
                     mt-1"
            >

              Max Score:
              ${esc(
                item.max_score ??
                item.maxScore ??
                '—'
              )}
              ${item.exam_type ? ` &middot; ${esc(item.exam_type)}` : ''}

            </p>

          </div>


          <span
            class="text-[10px]
                   uppercase
                   font-bold
                   px-2
                   py-1
                   rounded-full
                   ${
                     item.is_locked
                       ? 'bg-slate-100 text-slate-500'
                       : 'bg-emerald-100 text-emerald-700'
                   }"
          >

            ${
              item.is_locked
                ? 'Locked'
                : 'Open'
            }

          </span>

        </div>


        <div
          class="flex
                 flex-wrap
                 gap-2
                 mt-4"
        >

          <button
            onclick="Teacher.showScoreEntry('${kind}', '${esc(id)}')"
            class="bg-eduBlue-600
                   hover:bg-eduBlue-700
                   text-white
                   px-3
                   py-2
                   rounded-lg
                   text-xs
                   font-bold"
          >

            Enter Scores

          </button>


          <button
            onclick="Teacher.lockAssessment('${kind}', '${esc(id)}')"
            class="bg-slate-100
                   hover:bg-slate-200
                   text-slate-700
                   px-3
                   py-2
                   rounded-lg
                   text-xs
                   font-bold"
          >

            ${
              item.is_locked
                ? 'Locked'
                : 'Lock'
            }

          </button>

        </div>

      </div>

    `;

  },


  async createAssessment(
    kind
  ) {

    const title =
      prompt(
        'Assessment title:'
      );


    if (!title) return;


    const maxScore =
      parseFloat(
        prompt(
          'Maximum score:',
          '100'
        )
      );


    if (
      Number.isNaN(maxScore)
    ) return;


    let examType = null;
    if (kind === 'exams') {
      examType = prompt('Exam period (Prelim, Midterm, or Final):', 'Prelim');
      if (!examType || !examType.trim()) return;
    }


    const endpoint =
      kind === 'quizzes'
        ? '/assessments/quizzes'
        : kind === 'performance'
          ? '/assessments/performance-tasks'
          : '/assessments/exams';


    try {

      await api(
        'POST',
        endpoint,
        {
          classId:
            Teacher.state.classId,

          title,

          maxScore,

          ...(examType ? { examType: examType.trim() } : {})
        }
      );


      Toast.show(
        'Created',
        'Assessment created successfully.',
        'success'
      );


      Teacher.renderAssessment(
        kind
      );

    } catch {}

  },


  async lockAssessment(
    kind,
    id
  ) {

    const endpoint =
      kind === 'quizzes'
        ? `/assessments/quizzes/${id}/lock`
        : kind === 'performance'
          ? `/assessments/performance-tasks/${id}/lock`
          : `/assessments/exams/${id}/lock`;


    try {

      await api(
        'POST',
        endpoint
      );


      Toast.show(
        'Assessment Locked',
        'Assessment has been locked.',
        'success'
      );


      Teacher.renderAssessment(
        kind
      );

    } catch {}

  },


  async showScoreEntry(
    kind,
    itemId
  ) {

    const box =
      document.getElementById(
        'teacher-tab-content'
      );


    if (!box) return;


    const roster =
      await api(
        'GET',
        `/classes/${Teacher.state.classId}/roster`
      ).catch(() => []);


    box.innerHTML = `

      <div
        class="space-y-4"
      >

        <button
          onclick="Teacher.renderAssessment('${kind}')"
          class="text-sm
                 font-bold
                 text-eduBlue-600"
        >

          <i
            class="fa-solid
                   fa-arrow-left
                   mr-1"
          ></i>

          Back

        </button>


        <div
          class="glass-card
                 rounded-2xl
                 p-4"
        >

          <h4
            class="font-black
                   mb-4"
          >

            Enter Scores

          </h4>


          <div
            class="space-y-2"
          >

            ${
              Array.isArray(roster)
                ? roster
                    .map(
                      s => `

                        <div
                          class="flex
                                 flex-col
                                 sm:flex-row
                                 sm:items-center
                                 sm:justify-between
                                 gap-2
                                 border-b
                                 py-3"
                        >

                          <span
                            class="font-semibold
                                   text-sm"
                          >

                            ${esc(
                              s.last_name || ''
                            )}

                            ,

                            ${esc(
                              s.first_name || ''
                            )}

                          </span>


                          <div
                            class="flex
                                   gap-2"
                          >

                            <input
                              id="score-${esc(itemId)}-${esc(s.id)}"
                              type="number"
                              step="any"
                              placeholder="Score"
                              class="w-28
                                     px-2
                                     py-2
                                     rounded-lg
                                     border
                                     border-slate-300"
                            >


                            <button
                              onclick="Teacher.saveScore('${kind}', '${esc(itemId)}', '${esc(s.id)}')"
                              class="bg-eduBlue-600
                                     text-white
                                     px-3
                                     py-2
                                     rounded-lg
                                     text-xs
                                     font-bold"
                            >

                              Save

                            </button>

                          </div>

                        </div>

                      `
                    )
                    .join('')
                : ''
            }

          </div>

        </div>

      </div>

    `;

  },


  async saveScore(
    kind,
    itemId,
    studentId
  ) {

    const input =
      document.getElementById(
        `score-${itemId}-${studentId}`
      );


    if (!input) return;


    const rawScore =
      parseFloat(
        input.value
      );


    if (
      Number.isNaN(rawScore)
    ) {

      Toast.show(
        'Invalid Score',
        'Please enter a valid score.',
        'error'
      );

      return;

    }


    const path =
      kind === 'quizzes'
        ? `/assessments/quizzes/${itemId}/scores/${studentId}`
        : kind === 'performance'
          ? `/assessments/performance-tasks/${itemId}/scores/${studentId}`
          : `/assessments/exams/${itemId}/scores/${studentId}`;


    try {

      await api(
        'PUT',
        path,
        {
          rawScore
        }
      );


      Toast.show(
        'Saved',
        'Score saved.',
        'success'
      );

    } catch {}

  },


  // ==========================================================
  // WEIGHTS
  // ==========================================================

  async renderWeights() {

    const box =
      document.getElementById(
        'teacher-tab-content'
      );


    if (!box) return;


    const cid =
      Teacher.state.classId;


    const w =
      await api(
        'GET',
        `/classes/${cid}/weights`
      ).catch(() => ({}));


    box.innerHTML = `

      <div
        class="glass-card
               rounded-2xl
               p-5
               max-w-md"
      >

        <h4
          class="font-bold
                 mb-3"
        >

          Grading Weights
          (must total 100%)

        </h4>


        <form
          onsubmit="return Teacher.saveWeights(event)"
          class="space-y-2"
        >

          ${[
            'attendance_weight',
            'quiz_weight',
            'performance_weight',
            'exam_weight'
          ]
            .map(
              k => `

                <div
                  class="flex
                         justify-between
                         items-center"
                >

                  <label
                    class="text-sm
                           capitalize"
                  >

                    ${k.replace(
                      '_weight',
                      ''
                    )}

                  </label>


                  <input
                    type="number"
                    step="any"
                    id="w-${k}"
                    value="${w[k] ?? 0}"
                    class="w-24
                           px-2
                           py-1
                           rounded-lg
                           border
                           border-slate-300
                           text-sm"
                  >

                </div>

              `
            )
            .join('')}


          <button
            class="w-full
                   bg-eduBlue-600
                   text-white
                   py-2
                   rounded-xl
                   text-sm
                   font-bold
                   mt-2"
          >

            Save Weights

          </button>

        </form>

      </div>

    `;

  },


  async saveWeights(e) {

    e.preventDefault();


    const payload = {};


    [
      'attendance_weight',
      'quiz_weight',
      'performance_weight',
      'exam_weight'
    ].forEach(
      k => {

        payload[k] =
          parseFloat(
            val(`w-${k}`)
          );

      }
    );


    try {

      await api(
        'PUT',
        `/classes/${Teacher.state.classId}/weights`,
        payload
      );


      Toast.show(
        'Saved',
        'Grading weights updated.',
        'success'
      );

    } catch {}


    return false;

  }

};

// ============================================================
// ADMIN VIEW
// ============================================================

const Admin = {

  tab:
    'dashboard',


  async render() {

    const el =
      document.getElementById(
        'admin-section'
      );


    if (!el) return;


    el.innerHTML = `

      <div
        class="flex flex-col md:flex-row
               md:items-center
               md:justify-between
               gap-3"
      >

        <h2 class="text-xl font-bold">

          <i
            class="fa-solid fa-user-shield text-eduBlue-600"
          ></i>

          Admin Dashboard

        </h2>


        <div
          id="admin-pending-summary"
          class="hidden"
        ></div>

      </div>


      <div
        class="flex gap-2
               border-b
               text-sm
               font-semibold
               text-slate-600
               overflow-x-auto"
      >

        ${[
          'dashboard',
          'approvals',
          'users',
          'classes',
          'audit-log'
        ].map(t => `

          <button
            class="tab-btn
                   ${Admin.tab === t ? 'active' : ''}
                   px-4
                   py-2
                   capitalize"
            onclick="Admin.switchTab('${t}')"
          >

            ${t.replace(
              '-',
              ' '
            )}

          </button>

        `).join('')}

      </div>


      <div
        id="admin-tab-content"
      ></div>

    `;


    Admin.switchTab(
      Admin.tab
    );

  },


  switchTab(tab) {

    Admin.tab =
      tab;


    document
      .querySelectorAll(
        '#admin-section .tab-btn'
      )
      .forEach(b => {

        b.classList.toggle(
          'active',
          b.textContent
            .trim()
            .toLowerCase() ===
            tab.replace(
              '-',
              ' '
            )
        );

      });


    const functions = {

      dashboard:
        Admin.renderDashboard,

      approvals:
        Admin.renderApprovals,

      users:
        Admin.renderUsers,

      classes:
        Admin.renderClasses,

      'audit-log':
        Admin.renderAuditLog

    };


    const fn =
      functions[tab];


    if (typeof fn === 'function') {

      fn();

    }


    if (
      tab === 'approvals'
    ) {

      ApprovalManager.forceRefresh();

    }

  },


  // ==========================================================
  // ADMIN DASHBOARD
  // ==========================================================

  async renderDashboard() {

    const box =
      document.getElementById(
        'admin-tab-content'
      );


    if (!box) return;


    const s =
      await api(
        'GET',
        '/admin/dashboard'
      ).catch(() => ({}));


    const pending =
      Number(
        s.pendingRegistrations || 0
      );


    const cards = [

      [
        'Total Students',
        s.totalStudents,
        'fa-user-graduate'
      ],

      [
        'Total Teachers',
        s.totalTeachers,
        'fa-chalkboard-user'
      ],

      [
        'Total Classes',
        s.totalClasses,
        'fa-layer-group'
      ],

      [
        'Active Users',
        s.activeUsers,
        'fa-users'
      ],

      [
        'Pending Registrations',
        pending,
        'fa-hourglass-half'
      ],

      [
        'Attendance Sessions',
        s.attendanceSessions,
        'fa-qrcode'
      ],

      [
        'Finalized Grades',
        s.finalizedGrades,
        'fa-check-double'
      ]

    ];


    box.innerHTML = `

      <div
        class="grid
               grid-cols-2
               md:grid-cols-4
               gap-4"
      >

        ${cards.map(
          ([label, value, icon]) => `

            <div
              class="glass-card
                     stat-card
                     rounded-2xl
                     p-4
                     text-center"
            >

              <i
                class="fa-solid
                       ${icon}
                       text-2xl
                       text-eduBlue-600
                       mb-2"
              ></i>


              <p
                class="text-2xl
                       font-black"
              >

                ${value ?? 0}

              </p>


              <p
                class="text-xs
                       text-slate-500"
              >

                ${label}

              </p>

            </div>

          `
        ).join('')}

      </div>


      ${
        pending > 0

          ? `

            <div
              class="mt-5
                     glass-card
                     rounded-2xl
                     p-4
                     border-l-4
                     border-amber-400"
            >

              <div
                class="flex
                       flex-col
                       sm:flex-row
                       sm:items-center
                       sm:justify-between
                       gap-3"
              >

                <div>

                  <h4 class="font-bold">

                    <i
                      class="fa-solid
                             fa-bell
                             text-amber-500"
                    ></i>

                    Approval Required

                  </h4>


                  <p
                    class="text-sm
                           text-slate-500
                           mt-1"
                  >

                    There are
                    <b>${pending}</b>
                    pending registration${pending === 1 ? '' : 's'}.

                  </p>

                </div>


                <button
                  onclick="Admin.switchTab('approvals')"
                  class="bg-amber-500
                         hover:bg-amber-600
                         text-white
                         px-4
                         py-2
                         rounded-xl
                         text-sm
                         font-bold"
                >

                  Review Approvals

                </button>

              </div>

            </div>

          `

          : `

            <div
              class="mt-5
                     glass-card
                     rounded-2xl
                     p-4"
            >

              <p
                class="text-sm
                       text-slate-500"
              >

                <i
                  class="fa-solid
                         fa-circle-check
                         text-emerald-500"
                ></i>

                No pending registrations.

              </p>

            </div>

          `
      }

    `;


    // Synchronize notification badge.

    ApprovalManager.state.adminPending =
      pending;


   ApprovalManager.updateBadge(
      pending
    );


    ApprovalManager.updateEnhancedUI();

  },


  // ==========================================================
  // ADMIN APPROVALS
  // ==========================================================

  async renderApprovals() {

    const box =
      document.getElementById(
        'admin-tab-content'
      );


    if (!box) return;


    const rows =
      await api(
        'GET',
        '/admin/users/pending'
      ).catch(() => []);


    const count =
      Array.isArray(rows)
        ? rows.length
        : 0;


    ApprovalManager.state.adminPending =
      count;


    ApprovalManager.updateBadge(
      count
    );


    ApprovalManager.updateEnhancedUI();


    box.innerHTML = `

      <div
        class="glass-card
               rounded-2xl
               p-4"
      >

        <div
          class="flex
                 flex-col
                 sm:flex-row
                 sm:items-center
                 sm:justify-between
                 gap-2
                 mb-3"
        >

          <div>

            <h4 class="font-bold">

              <i
                class="fa-solid
                       fa-user-clock
                       text-amber-500"
              ></i>

              Pending Registrations

            </h4>


            <p
              class="text-xs
                     text-slate-500
                     mt-1"
            >

              Review new student and teacher accounts
              before granting system access.

            </p>

          </div>


          <span
            class="text-xs
                   font-bold
                   px-3
                   py-1
                   rounded-full
                   ${
                     count > 0
                       ? 'bg-amber-100 text-amber-700'
                       : 'bg-emerald-100 text-emerald-700'
                   }"
          >

            ${count}
            Pending

          </span>

        </div>


        ${
          rows.length === 0

            ? `

              <div
                class="text-center
                       py-10"
              >

                <i
                  class="fa-solid
                         fa-circle-check
                         text-emerald-500
                         text-4xl
                         mb-3"
                ></i>


                <p
                  class="font-semibold
                         text-slate-600"
                >

                  No pending registrations

                </p>


                <p
                  class="text-xs
                         text-slate-400
                         mt-1"
                >

                  New registrations will appear here.

                </p>

              </div>

            `

            : rows.map(u => `

              <div
                class="flex
                       flex-col
                       sm:flex-row
                       sm:justify-between
                       sm:items-center
                       gap-3
                       border-b
                       py-3
                       text-sm"
              >

                <div>

                  <b>

                    ${esc(u.first_name || '')}
                    ${esc(u.last_name || '')}

                  </b>


                  <span
                    class="text-slate-400"
                  >

                    (${esc(u.role)})

                  </span>


                  <br>


                  <span
                    class="text-xs
                           text-slate-500"
                  >

                    ${esc(u.email)}

                  </span>

                </div>


                <div
                  class="flex
                         gap-2"
                >

                  <button
                    onclick="Admin.approve('${u.id}')"
                    class="bg-emerald-600
                           hover:bg-emerald-700
                           text-white
                           px-3
                           py-1.5
                           rounded-lg
                           text-xs
                           font-bold"
                  >

                    <i
                      class="fa-solid fa-check"
                    ></i>

                    Approve

                  </button>


                  <button
                    onclick="Admin.reject('${u.id}')"
                    class="bg-red-600
                           hover:bg-red-700
                           text-white
                           px-3
                           py-1.5
                           rounded-lg
                           text-xs
                           font-bold"
                  >

                    <i
                      class="fa-solid fa-xmark"
                    ></i>

                    Reject

                  </button>

                </div>

              </div>

            `).join('')
        }

      </div>

    `;

  },


  async approve(id) {

    try {

      await api(
        'POST',
        `/admin/users/${id}/approve`
      );


      Toast.show(
        'Approved',
        'Account approved successfully.',
        'success'
      );


      await Admin.renderApprovals();


      ApprovalManager.forceRefresh();

    } catch {}

  },


  async reject(id) {

    try {

      await api(
        'POST',
        `/admin/users/${id}/reject`
      );


      Toast.show(
        'Rejected',
        'Account rejected.',
        'success'
      );


      await Admin.renderApprovals();


      ApprovalManager.forceRefresh();

    } catch {}

  },


  // ==========================================================
  // ADMIN USERS
  // ==========================================================

  async renderUsers() {

    const box =
      document.getElementById(
        'admin-tab-content'
      );


    if (!box) return;


    const rows =
      await api(
        'GET',
        '/admin/users'
      ).catch(() => []);


    box.innerHTML = `

      <div
        class="glass-card
               rounded-2xl
               p-4
               overflow-x-auto"
      >

        <table
          class="gradebook
                 w-full
                 text-left"
        >

          <thead
            class="text-xs
                   uppercase
                   text-slate-500
                   border-b"
          >

            <tr>

              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>

            </tr>

          </thead>


          <tbody>

            ${rows.map(u => `

              <tr
                class="border-b"
              >

                <td>

                  ${esc(
                    u.s_first ||
                    u.t_first ||
                    ''
                  )}

                  ${esc(
                    u.s_last ||
                    u.t_last ||
                    ''
                  )}

                </td>


                <td>
                  ${esc(u.email)}
                </td>


                <td
                  class="capitalize"
                >
                  ${esc(u.role)}
                </td>


                <td>

                  ${
                    u.is_active

                      ? '<span class="text-emerald-600 font-bold">Active</span>'

                      : '<span class="text-red-600 font-bold">Deactivated</span>'
                  }

                  ·

                  ${esc(
                    u.approval_status
                  )}

                </td>


                <td>

                  <div class="flex flex-wrap gap-3">
                    <button
                      onclick="Admin.resetPassword('${u.id}', '${esc(u.email)}')"
                      class="text-xs font-bold text-blue-600"
                    >
                      Reset Password
                    </button>

                    ${
                      u.is_active
                        ? `<button onclick="Admin.deactivate('${u.id}')" class="text-xs font-bold text-red-600">Deactivate</button>`
                        : `<button onclick="Admin.reactivate('${u.id}')" class="text-xs font-bold text-emerald-600">Reactivate</button>`
                    }
                  </div>

                </td>

              </tr>

            `).join('')}

          </tbody>

        </table>

      </div>

    `;

  },


  async resetPassword(id, email) {
    const m = document.createElement('div');
    m.className = 'fixed inset-0 z-[160] flex items-center justify-center p-4';
    m.innerHTML = `<div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" data-close></div><div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-5"><h3 class="text-lg font-black text-slate-800">Reset Password</h3><p class="text-sm text-slate-500 mt-1">Account: ${esc(email || '')}</p><form class="mt-4 space-y-3"><input name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="New password (minimum 8 characters)" class="w-full px-3 py-3 rounded-xl border border-slate-300 text-sm"><input name="confirm" type="password" autocomplete="new-password" minlength="8" required placeholder="Confirm new password" class="w-full px-3 py-3 rounded-xl border border-slate-300 text-sm"><div class="flex gap-2"><button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl">Reset Password</button><button type="button" data-close class="px-4 py-3 text-sm font-bold text-slate-500">Cancel</button></div></form></div>`;
    document.body.appendChild(m);
    const close=()=>m.remove();m.querySelectorAll('[data-close]').forEach(x=>x.onclick=close);
    m.querySelector('form').onsubmit=async e=>{e.preventDefault();const p=e.target.password.value;const confirm=e.target.confirm.value;if(p.length<8){Toast.show('Invalid Password','Password must be at least 8 characters.','error');return;}if(p!==confirm){Toast.show('Passwords Do Not Match','Please enter the same password twice.','error');return;}try{await api('POST',`/admin/users/${id}/reset-password`,{newPassword:p});Toast.show('Password Reset','Password updated and login lock cleared.','success');close();}catch{}};
  },


  async deactivate(id) {

    try {

      await api(
        'POST',
        `/admin/users/${id}/deactivate`
      );


      Toast.show(
        'Deactivated',
        'Account deactivated.',
        'success'
      );


      Admin.renderUsers();

    } catch {}

  },


  async reactivate(id) {

    try {

      await api(
        'POST',
        `/admin/users/${id}/reactivate`
      );


      Toast.show(
        'Reactivated',
        'Account reactivated.',
        'success'
      );


      Admin.renderUsers();

    } catch {}

  },


  // ==========================================================
  // ADMIN CLASSES
  // ==========================================================

  async renderClasses() {

    const box =
      document.getElementById(
        'admin-tab-content'
      );


    if (!box) return;


    const rows =
      await api(
        'GET',
        '/admin/classes'
      ).catch(() => []);


    box.innerHTML = `

      <div
        class="glass-card
               rounded-2xl
               p-4
               overflow-x-auto"
      >

        <table
          class="gradebook
                 w-full
                 text-left"
        >

          <thead
            class="text-xs
                   uppercase
                   text-slate-500
                   border-b"
          >

            <tr>

              <th>Subject</th>
              <th>Section</th>
              <th>Teacher</th>
              <th>Code</th>
              <th>Year Level</th>

            </tr>

          </thead>


          <tbody>

            ${rows.map(c => `

              <tr
                class="border-b"
              >

                <td>
                  ${esc(c.subject)}
                </td>

                <td>
                  ${esc(c.section)}
                </td>

                <td>
                  ${esc(c.teacher_first)}
                  ${esc(c.teacher_last)}
                </td>

                <td>
                  ${esc(c.class_code)}
                </td>

                <td>
                  ${esc(c.year_level)}
                </td>

              </tr>

            `).join('')}

          </tbody>

        </table>

      </div>

    `;

  },


  // ==========================================================
  // ADMIN AUDIT LOG
  // ==========================================================

  async renderAuditLog() {

    const box =
      document.getElementById(
        'admin-tab-content'
      );


    if (!box) return;


    const rows =
      await api(
        'GET',
        '/admin/audit-log?limit=200'
      ).catch(() => []);


    box.innerHTML = `

      <div
        class="glass-card
               rounded-2xl
               p-4
               overflow-x-auto
               max-h-[32rem]
               overflow-y-auto"
      >

        <table
          class="gradebook
                 w-full
                 text-left"
        >

          <thead
            class="text-xs
                   uppercase
                   text-slate-500
                   border-b
                   sticky
                   top-0
                   bg-white"
          >

            <tr>

              <th>Time</th>
              <th>Role</th>
              <th>Action</th>
              <th>Record</th>
              <th>IP</th>

            </tr>

          </thead>


          <tbody>

            ${rows.map(r => `

              <tr
                class="border-b"
              >

                <td
                  class="whitespace-nowrap"
                >
                  ${esc(r.created_at)}
                </td>


                <td
                  class="capitalize"
                >
                  ${esc(r.role || '—')}
                </td>


                <td>
                  ${esc(r.action)}
                </td>


                <td
                  class="text-xs
                         text-slate-500"
                >

                  ${esc(r.record_type || '')}

                  ${esc(
                    (r.record_id || '')
                      .slice(0, 8)
                  )}

                </td>


                <td
                  class="text-xs"
                >
                  ${esc(
                    r.ip_address || ''
                  )}
                </td>

              </tr>

            `).join('')}

          </tbody>

        </table>

      </div>

    `;

  }

};


// ============================================================
// END OF APP.JS
// ============================================================
