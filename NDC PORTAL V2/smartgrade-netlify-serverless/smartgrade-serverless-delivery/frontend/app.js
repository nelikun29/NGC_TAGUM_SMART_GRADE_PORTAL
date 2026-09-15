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

    const message =
      (data && data.error) ||
      'An unexpected error occurred.';

    Toast.show(
      'Error',
      message,
      'error'
    );

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

const ApprovalNotification = {

  state: {

    adminPending: 0,

    teacherPending: 0,

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

      }


      // ------------------------------------------------------
      // OTHER ROLES
      // ------------------------------------------------------

      else {

        this.state.adminPending = 0;

        this.state.teacherPending = 0;

      }


      const total =
        this.state.adminPending +
        this.state.teacherPending;


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


    const genericCount =
      document.getElementById(
        'approval-count'
      );


    if (genericCount) {

      const total =
        this.state.adminPending +
        this.state.teacherPending;


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
      this.state.adminPending > 0
    ) {

      Admin.tab =
        'approvals';

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


      // Immediately refresh notifications.

      setTimeout(() => {

        ApprovalNotification.forceRefresh();

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

    api(
      'POST',
      '/auth/logout'
    ).catch(() => {});


    Store.token = null;

    Store.user = null;


    ApprovalNotification.refresh();


    Views.renderForRole();

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

      ApprovalNotification.updateBadge(0);

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

    ApprovalNotification.forceRefresh();

  }

};


// ============================================================
// APPLICATION INITIALIZATION
// ============================================================

document.addEventListener(
  'DOMContentLoaded',
  () => {

    Views.renderForRole();


    ApprovalNotification.init();


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


    el.innerHTML = `

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

          </div>

        </div>


        <div class="lg:col-span-2 space-y-4">

          <h3 class="font-bold text-lg">

            <i class="fa-solid fa-chart-line text-eduBlue-600"></i>

            My Classes &amp; Grades

          </h3>

          ${gradesHtml}

        </div>

      </div>

    `;

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


  async render() {

    const el =
      document.getElementById(
        'teacher-section'
      );


    if (!el) return;


    const classes =
      await api(
        'GET',
        '/classes'
      ).catch(() => []);


    if (
      !Teacher.state.classId &&
      classes.length
    ) {

      Teacher.state.classId =
        classes[0].id;

    }


    el.innerHTML = `

      <div
        class="flex flex-col md:flex-row justify-between md:items-center gap-3"
      >

        <h2 class="text-xl font-bold">

          <i class="fa-solid fa-chalkboard-user text-eduBlue-600"></i>

          Teacher Dashboard

        </h2>


        <div class="flex gap-2 items-center">

          <select
            id="teacher-class-select"
            onchange="Teacher.selectClass(this.value)"
            class="px-3 py-2 rounded-xl border border-slate-300 text-sm"
          >

            ${classes.map(c => `

              <option
                value="${c.id}"
                ${c.id === Teacher.state.classId ? 'selected' : ''}
              >

                ${esc(c.subject)}
                -
                ${esc(c.section)}
                (${esc(c.class_code)})

              </option>

            `).join('')}

          </select>


          <button
            onclick="Teacher.showCreateClass()"
            class="bg-eduBlue-600 text-white px-3 py-2 rounded-xl text-sm font-bold"
          >

            <i class="fa-solid fa-plus"></i>

            New Class

          </button>

        </div>

      </div>


      <div
        id="teacher-create-class-panel"
        class="hidden glass-card rounded-2xl p-5"
      ></div>


      <div
        class="flex gap-2 border-b text-sm font-semibold text-slate-600 overflow-x-auto"
      >

        ${[
          'gradebook',
          'approvals',
          'attendance',
          'quizzes',
          'performance',
          'exams',
          'weights'
        ].map(t => `

          <button
            class="tab-btn ${Teacher.state.tab === t ? 'active' : ''} px-4 py-2 capitalize"
            onclick="Teacher.switchTab('${t}')"
          >

            ${t}

          </button>

        `).join('')}

      </div>


      <div id="teacher-tab-content"></div>

    `;


    if (!classes.length) {

      document
        .getElementById(
          'teacher-tab-content'
        )
        .innerHTML = `

          <p class="text-sm text-slate-500 italic p-4">
            Create a class to get started.
          </p>

        `;

      return;

    }


    Teacher.switchTab(
      Teacher.state.tab
    );

  },


  selectClass(id) {

    Teacher.state.classId =
      id;

    Teacher.switchTab(
      Teacher.state.tab
    );

    ApprovalNotification.forceRefresh();

  },


  showCreateClass() {

    const panel =
      document.getElementById(
        'teacher-create-class-panel'
      );


    if (!panel) return;


    panel.classList.remove(
      'hidden'
    );


    panel.innerHTML = `

      <h4 class="font-bold mb-3">
        Create Class
      </h4>


      <form
        onsubmit="return Teacher.createClass(event)"
        class="grid grid-cols-2 md:grid-cols-4 gap-2"
      >

        <input
          required
          id="cc-subject"
          placeholder="Subject *"
          class="px-3 py-2 rounded-xl border border-slate-300 text-sm"
        >

        <input
          required
          id="cc-section"
          placeholder="Section *"
          class="px-3 py-2 rounded-xl border border-slate-300 text-sm"
        >

        <input
          required
          id="cc-yearLevel"
          placeholder="Year Level *"
          class="px-3 py-2 rounded-xl border border-slate-300 text-sm"
        >

        <input
          id="cc-roomNumber"
          placeholder="Room Number"
          class="px-3 py-2 rounded-xl border border-slate-300 text-sm"
        >

        <button
          class="col-span-2 md:col-span-4 bg-eduBlue-600 text-white py-2 rounded-xl text-sm font-bold"
        >
          Create
        </button>

      </form>

    `;

  },


  async createClass(e) {

    e.preventDefault();


    try {

      await api(
        'POST',
        '/classes',
        {
          subject:
            val('cc-subject'),

          section:
            val('cc-section'),

          yearLevel:
            val('cc-yearLevel'),

          roomNumber:
            val('cc-roomNumber')
        }
      );


      Toast.show(
        'Created',
        'Class created.',
        'success'
      );


      Teacher.render();

    } catch {}


    return false;

  },


  switchTab(tab) {

    Teacher.state.tab =
      tab;


    document
      .querySelectorAll(
        '#teacher-section .tab-btn'
      )
      .forEach(b => {

        b.classList.toggle(
          'active',
          b.textContent
            .trim()
            .toLowerCase() === tab
        );

      });


    const fn = {

      gradebook:
        Teacher.renderGradebook,

      approvals:
        Teacher.renderApprovals,

      attendance:
        Teacher.renderAttendance,

      quizzes:
        () =>
          Teacher.renderAssessmentTab(
            'quizzes'
          ),

      performance:
        () =>
          Teacher.renderAssessmentTab(
            'performance'
          ),

      exams:
        () =>
          Teacher.renderAssessmentTab(
            'exams'
          ),

      weights:
        Teacher.renderWeights

    }[tab];


    if (typeof fn === 'function') {

      fn();

    }


    if (tab === 'approvals') {

      ApprovalNotification.forceRefresh();

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


    box.innerHTML =
      `<div class="text-slate-400 text-sm py-6">
        Loading gradebook…
      </div>`;


    const cid =
      Teacher.state.classId;


    const rows =
      await api(
        'GET',
        `/grades/${cid}/gradebook`
      ).catch(() => []);


    box.innerHTML = `

      <div
        class="glass-card rounded-2xl p-4 overflow-x-auto"
      >

        <div
          class="flex justify-between items-center mb-2"
        >

          <input
            id="gb-search"
            oninput="Teacher.filterGradebook()"
            placeholder="Search student..."
            class="px-3 py-2 rounded-xl border border-slate-300 text-sm w-64"
          >


          <a
            href="${API_BASE}/reports/${cid}/grade-sheet.csv"
            target="_blank"
            class="text-sm font-bold text-eduBlue-600"
          >

            <i class="fa-solid fa-file-csv"></i>
            Export CSV

          </a>

        </div>


        <table class="gradebook w-full text-left">

          <thead
            class="text-xs uppercase text-slate-500 border-b"
          >

            <tr>

              <th>Student ID</th>
              <th>Name</th>
              <th>Att.</th>
              <th>Quiz</th>
              <th>Perf.</th>
              <th>Exam</th>
              <th>Final</th>
              <th>Status</th>
              <th>Actions</th>

            </tr>

          </thead>


          <tbody id="gb-body">

            ${Teacher.gradebookRows(rows)}

          </tbody>

        </table>

      </div>

    `;


    Teacher._gbRows =
      rows;

  },


  gradebookRows(rows) {

    if (!rows.length) {

      return `

        <tr>

          <td
            colspan="9"
            class="text-center text-slate-400 py-6"
          >
            No students enrolled yet.
          </td>

        </tr>

      `;

    }


    return rows.map(r => `

      <tr
        class="border-b hover:bg-slate-50"
      >

        <td>
          ${esc(r.studentNumber)}
        </td>

        <td>
          ${esc(r.studentName)}
        </td>

        <td>
          ${pct(r.attendance)}
        </td>

        <td>
          ${pct(r.quiz)}
        </td>

        <td>
          ${pct(r.performance)}
        </td>

        <td>
          ${pct(r.exam)}
        </td>

        <td class="font-bold">
          ${r.finalGrade ?? '—'}
        </td>

        <td>

          <span
            class="text-[10px] font-bold uppercase px-2 py-1 rounded bg-slate-100"
          >
            ${esc(r.status)}
          </span>

        </td>

        <td class="whitespace-nowrap">

          <button
            onclick="Teacher.finalize('${r.studentId}')"
            class="text-xs text-eduBlue-600 font-bold mr-2"
            title="Finalize"
          >

            <i class="fa-solid fa-lock"></i>

          </button>


          <button
            onclick="Teacher.release('${r.studentId}')"
            class="text-xs text-emerald-600 font-bold"
            title="Release to student"
          >

            <i class="fa-solid fa-paper-plane"></i>

          </button>

        </td>

      </tr>

    `).join('');

  },


  filterGradebook() {

    const search =
      document.getElementById(
        'gb-search'
      );


    const body =
      document.getElementById(
        'gb-body'
      );


    if (!search || !body) return;


    const q =
      search.value
        .toLowerCase();


    const rows =
      (Teacher._gbRows || [])
        .filter(r =>

          String(
            r.studentName || ''
          )
            .toLowerCase()
            .includes(q)

          ||

          String(
            r.studentNumber || ''
          )
            .toLowerCase()
            .includes(q)

        );


    body.innerHTML =
      Teacher.gradebookRows(
        rows
      );

  },


  async finalize(studentId) {

    try {

      await api(
        'POST',
        `/grades/${Teacher.state.classId}/students/${studentId}/finalize`
      );


      Toast.show(
        'Finalized',
        'Grade finalized.',
        'success'
      );


      Teacher.renderGradebook();

    } catch {}

  },


  async release(studentId) {

    try {

      await api(
        'POST',
        `/grades/${Teacher.state.classId}/students/${studentId}/release`
      );


      Toast.show(
        'Released',
        'Grade released to student.',
        'success'
      );


      Teacher.renderGradebook();

    } catch {}

  },


  // ==========================================================
  // STUDENT JOIN APPROVALS
  // ==========================================================

  async renderApprovals() {

    const box =
      document.getElementById(
        'teacher-tab-content'
      );


    if (!box) return;


    const cid =
      Teacher.state.classId;


    const rows =
      await api(
        'GET',
        `/classes/${cid}/pending-enrollments`
      ).catch(() => []);


    box.innerHTML = `

      <div
        class="glass-card rounded-2xl p-4"
      >

        <div
          class="flex flex-col sm:flex-row
                 sm:items-center
                 sm:justify-between
                 gap-2
                 mb-3"
        >

          <h4 class="font-bold">

            <i
              class="fa-solid fa-user-clock text-amber-500"
            ></i>

            Pending Join Requests

          </h4>


          <span
            class="text-xs font-bold
                   px-3 py-1
                   rounded-full
                   bg-amber-100
                   text-amber-700"
          >

            ${rows.length}
            Pending

          </span>

        </div>


        ${
          rows.length === 0

            ? `

              <div class="text-center py-8">

                <i
                  class="fa-solid fa-circle-check
                         text-emerald-500
                         text-3xl mb-2"
                ></i>

                <p class="text-sm text-slate-500">
                  No pending requests.
                </p>

                <p class="text-xs text-slate-400 mt-1">
                  Students who join with your class code
                  will appear here for verification.
                </p>

              </div>

            `

            : rows.map(s => `

              <div
                class="flex flex-col sm:flex-row
                       sm:justify-between
                       sm:items-center
                       gap-3
                       border-b py-3 text-sm"
              >

                <div>

                  <b>
                    ${esc(s.last_name)},
                    ${esc(s.first_name)}
                  </b>

                  <span
                    class="text-slate-400 text-xs"
                  >
                    (${esc(s.student_number)}
                    ·
                    ${esc(s.year_level)})
                  </span>

                </div>


                <div
                  class="flex gap-2"
                >

                  <button
                    onclick="Teacher.approveEnrollment('${s.id}')"
                    class="bg-emerald-600
                           hover:bg-emerald-700
                           text-white
                           px-3 py-1.5
                           rounded-lg
                           text-xs
                           font-bold
                           transition"
                  >

                    <i class="fa-solid fa-check"></i>
                    Approve

                  </button>


                  <button
                    onclick="Teacher.rejectEnrollment('${s.id}')"
                    class="bg-red-600
                           hover:bg-red-700
                           text-white
                           px-3 py-1.5
                           rounded-lg
                           text-xs
                           font-bold
                           transition"
                  >

                    <i class="fa-solid fa-xmark"></i>
                    Reject

                  </button>

                </div>

              </div>

            `).join('')
        }

      </div>

    `;


    // Refresh notification count after loading
    // the actual approval list.

    ApprovalNotification.forceRefresh();

  },


  async approveEnrollment(studentId) {

    try {

      await api(
        'POST',
        `/classes/${Teacher.state.classId}/enrollments/${studentId}/approve`
      );


      Toast.show(
        'Approved',
        'Student added to the class.',
        'success'
      );


      await Teacher.renderApprovals();


      ApprovalNotification.forceRefresh();

    } catch {}

  },


  async rejectEnrollment(studentId) {

    try {

      await api(
        'POST',
        `/classes/${Teacher.state.classId}/enrollments/${studentId}/reject`
      );


      Toast.show(
        'Rejected',
        'Join request rejected.',
        'success'
      );


      await Teacher.renderApprovals();


      ApprovalNotification.forceRefresh();

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


    const sessions =
      await api(
        'GET',
        `/attendance/sessions?classId=${cid}`
      ).catch(() => []);


    box.innerHTML = `

      <div
        class="glass-card rounded-2xl p-5 mb-4"
      >

        <form
          onsubmit="return Teacher.openSession(event)"
          class="flex flex-col sm:flex-row gap-2 items-end"
        >

          <div>

            <label
              class="block text-xs font-bold mb-1"
            >
              Session Date
            </label>

            <input
              required
              type="date"
              id="att-date"
              class="px-3 py-2 rounded-xl border border-slate-300 text-sm"
            >

          </div>


          <button
            class="bg-eduBlue-600
                   text-white
                   px-4 py-2
                   rounded-xl
                   text-sm
                   font-bold"
          >

            <i class="fa-solid fa-play"></i>

            Open Attendance Session

          </button>

        </form>


        <div
          id="att-session-box"
          class="mt-4"
        ></div>

      </div>


      <div
        class="glass-card rounded-2xl p-4"
      >

        <h4 class="font-bold mb-3">

          <i
            class="fa-solid fa-list-check text-eduBlue-600"
          ></i>

          All Sessions — Manual Entry / Review

        </h4>


        <div
          id="att-sessions-list"
        >

          ${Teacher.sessionsListHtml(sessions)}

        </div>

      </div>


      <div
        id="att-manual-box"
      ></div>

    `;


    const date =
      document.getElementById(
        'att-date'
      );


    if (date) {

      date.value =
        new Date()
          .toISOString()
          .slice(0, 10);

    }


    Teacher._sessions =
      sessions;

  },


  sessionsListHtml(sessions) {

    if (!sessions.length) {

      return `

        <p class="text-sm text-slate-500 italic">

          No attendance sessions yet.
          Open one above, or create one just
          to record attendance manually.

        </p>

      `;

    }


    return `

      <div class="space-y-1">

        ${sessions.map(s => `

          <div
            class="flex flex-col sm:flex-row
                   sm:justify-between
                   sm:items-center
                   gap-2
                   text-sm
                   border-b
                   py-2"
          >

            <div>

              <b>
                ${esc(s.session_date)}
              </b>


              <span
                class="text-[10px]
                       font-bold
                       uppercase
                       px-2
                       py-0.5
                       rounded
                       ${s.status === 'open'
                         ? 'bg-emerald-100 text-emerald-700'
                         : 'bg-slate-100 text-slate-600'}
                       ml-2"
              >

                ${esc(s.status)}

              </span>


              <span
                class="text-xs text-slate-400 ml-2"
              >

                ${s.recorded_count}
                recorded

              </span>

            </div>


            <button
              onclick="Teacher.manageSession('${s.id}')"
              class="text-xs
                     font-bold
                     text-eduBlue-600"
            >

              <i class="fa-solid fa-pen"></i>

              Manage Attendance

            </button>

          </div>

        `).join('')}

      </div>

    `;

  },


  async manageSession(sessionId) {

    const box =
      document.getElementById(
        'att-manual-box'
      );


    if (!box) return;


    box.innerHTML = `

      <div
        class="glass-card
               rounded-2xl
               p-4
               mt-4
               text-slate-400
               text-sm"
      >

        Loading roster…

      </div>

    `;


    const data =
      await api(
        'GET',
        `/attendance/sessions/${sessionId}/roster`
      ).catch(() => null);


    if (!data) {

      box.innerHTML = '';

      return;

    }


    const {
      session,
      roster
    } = data;


    const statusBtn =
      (
        studentId,
        status,
        current
      ) => {

        const active =
          current === status;


        const colors = {

          present:
            'emerald',

          late:
            'amber',

          absent:
            'red',

          excused:
            'slate'

        };


        const c =
          colors[status];


        return `

          <button
            onclick="Teacher.setAttendance('${sessionId}','${studentId}','${status}')"
            class="px-2
                   py-1
                   rounded-lg
                   text-[11px]
                   font-bold
                   border
                   ${
                     active

                       ? `bg-${c}-600
                          text-white
                          border-${c}-600`

                       : `bg-white
                          text-${c}-700
                          border-${c}-300
                          hover:bg-${c}-50`
                   }"
          >

            ${status[0].toUpperCase() + status.slice(1)}

          </button>

        `;

      };


    box.innerHTML = `

      <div
        class="glass-card
               rounded-2xl
               p-4
               mt-4"
      >

        <div
          class="flex flex-col sm:flex-row
                 sm:justify-between
                 sm:items-center
                 gap-2
                 mb-3"
        >

          <h4 class="font-bold">

            Manual Attendance —
            ${esc(session.session_date)}

            <span
              class="text-xs
                     text-slate-400
                     font-normal"
            >

              (
              ${esc(session.status)}

              ${
                session.status === 'open'
                  ? `, code ${esc(session.attendance_code)}`
                  : ''
              }

              )

            </span>

          </h4>


          ${
            session.status === 'open'

              ? `

                <button
                  onclick="Teacher.closeSession('${session.id}', true)"
                  class="text-xs
                         font-bold
                         text-red-600"
                >

                  <i class="fa-solid fa-stop"></i>

                  Close Session

                </button>

              `

              : ''
          }

        </div>


        <div class="space-y-2">

          ${roster.map(s => `

            <div
              class="flex flex-col sm:flex-row
                     sm:justify-between
                     sm:items-center
                     gap-2
                     text-sm
                     border-b
                     py-2"
            >

              <span>

                ${esc(s.last_name)},
                ${esc(s.first_name)}

                <span
                  class="text-slate-400 text-xs"
                >

                  (${esc(s.student_number)})

                </span>

              </span>


              <div
                class="flex gap-1 flex-wrap"
              >

                ${[
                  'present',
                  'late',
                  'absent',
                  'excused'
                ]
                  .map(st =>
                    statusBtn(
                      s.id,
                      st,
                      s.status
                    )
                  )
                  .join('')}

              </div>

            </div>

          `).join('')}

        </div>

      </div>

    `;

  },


  async setAttendance(
    sessionId,
    studentId,
    status
  ) {

    try {

      await api(
        'PUT',
        `/attendance/sessions/${sessionId}/records/${studentId}`,
        { status }
      );


      Toast.show(
        'Saved',
        `Marked ${status}.`,
        'success'
      );


      Teacher.manageSession(
        sessionId
      );

    } catch {}

  },


  async openSession(e) {

    e.preventDefault();


    try {

      const s =
        await api(
          'POST',
          '/attendance/sessions',
          {
            classId:
              Teacher.state.classId,

            sessionDate:
              val('att-date')
          }
        );


      Teacher._session =
        s;


      document
        .getElementById(
          'att-session-box'
        )
        .innerHTML = `

          <div
            class="bg-eduYellow-100
                   border
                   border-eduYellow-400
                   rounded-xl
                   p-4
                   text-center"
          >

            <p
              class="text-xs
                     font-bold
                     uppercase
                     text-eduBlue-800"
            >

              Attendance Code
              (expires in 15 min)

            </p>


            <p
              class="text-4xl
                     font-black
                     tracking-widest
                     text-eduBlue-800
                     my-2"
            >

              ${esc(s.attendance_code)}

            </p>


            <button
              onclick="Teacher.closeSession('${s.id}')"
              class="bg-red-600
                     text-white
                     px-4
                     py-2
                     rounded-xl
                     text-sm
                     font-bold
                     mt-2"
            >

              <i class="fa-solid fa-stop"></i>

              Close Session

            </button>

          </div>

        `;


      Teacher.renderAttendanceSessionsList();

    } catch {}


    return false;

  },


  async renderAttendanceSessionsList() {

    const sessions =
      await api(
        'GET',
        `/attendance/sessions?classId=${Teacher.state.classId}`
      ).catch(() => []);


    Teacher._sessions =
      sessions;


    const el =
      document.getElementById(
        'att-sessions-list'
      );


    if (el) {

      el.innerHTML =
        Teacher.sessionsListHtml(
          sessions
        );

    }

  },


  async closeSession(
    sessionId,
    fromManual
  ) {

    try {

      await api(
        'POST',
        `/attendance/sessions/${sessionId}/close`
      );


      Toast.show(
        'Closed',
        'Attendance session closed.',
        'success'
      );


      if (fromManual) {

        Teacher.manageSession(
          sessionId
        );

      } else {

        const box =
          document.getElementById(
            'att-session-box'
          );


        if (box) {

          box.innerHTML = `

            <p
              class="text-sm
                     text-slate-500
                     italic"
            >

              Session closed.
              The code is no longer valid.

            </p>

          `;

        }

      }


      Teacher.renderAttendanceSessionsList();

    } catch {}

  },


  // ==========================================================
  // QUIZ / PERFORMANCE / EXAM
  // ==========================================================

  async renderAssessmentTab(kind) {

    const cfg = {

      quizzes: {

        endpoint:
          '/assessments/quizzes',

        createEndpoint:
          '/assessments/quizzes',

        maxField:
          'total_items',

        label:
          'Quiz',

        extra:
          'Total Items'

      },


      performance: {

        endpoint:
          '/assessments/performance-tasks',

        createEndpoint:
          '/assessments/performance-tasks',

        maxField:
          'max_score',

        label:
          'Performance Task',

        extra:
          'Max Score'

      },


      exams: {

        endpoint:
          '/assessments/exams',

        createEndpoint:
          '/assessments/exams',

        maxField:
          'max_score',

        label:
          'Examination',

        extra:
          'Max Score'

      }

    }[kind];


    Teacher._assessCfg =
      cfg;

    Teacher._assessKind =
      kind;


    const box =
      document.getElementById(
        'teacher-tab-content'
      );


    const cid =
      Teacher.state.classId;


    const items =
      await api(
        'GET',
        `${cfg.endpoint}?classId=${cid}`
      ).catch(() => []);


    box.innerHTML = `

      <div
        class="glass-card
               rounded-2xl
               p-5
               mb-4"
      >

        <h4 class="font-bold mb-3">

          Create
          ${cfg.label}

        </h4>


        <form
          onsubmit="return Teacher.createAssessment(event)"
          class="grid grid-cols-2 md:grid-cols-4 gap-2"
        >

          <input
            required
            id="as-title"
            placeholder="Title *"
            class="px-3 py-2 rounded-xl border border-slate-300 text-sm"
          >


          ${
            kind === 'exams'

              ? `

                <input
                  required
                  id="as-examType"
                  placeholder="Exam Type (Midterm/Final/...) *"
                  class="px-3 py-2 rounded-xl border border-slate-300 text-sm"
                >

              `

              : ''
          }


          <input
            required
            type="number"
            step="any"
            id="as-max"
            placeholder="${cfg.extra} *"
            class="px-3 py-2 rounded-xl border border-slate-300 text-sm"
          >


          <input
            type="date"
            id="as-date"
            class="px-3 py-2 rounded-xl border border-slate-300 text-sm"
          >


          <button
            class="bg-eduBlue-600
                   text-white
                   py-2
                   rounded-xl
                   text-sm
                   font-bold"
          >

            Create

          </button>

        </form>

      </div>


      <div class="space-y-4">

        ${
          items.length

            ? items
                .map(i =>
                  Teacher.assessmentCard(
                    kind,
                    i,
                    cfg
                  )
                )
                .join('')

            : '<p class="text-sm text-slate-500 italic">None created yet.</p>'
        }

      </div>

    `;

  },


  assessmentCard(
    kind,
    item,
    cfg
  ) {

    return `

      <div
        class="glass-card
               rounded-2xl
               p-4"
      >

        <div
          class="flex
                 justify-between
                 items-center"
        >

          <div>

            <h5 class="font-bold">

              ${esc(item.title)}

              ${
                item.exam_type
                  ? `

                    <span
                      class="text-xs text-slate-500"
                    >
                      (${esc(item.exam_type)})
                    </span>

                  `
                  : ''
              }

            </h5>


            <p
              class="text-xs text-slate-500"
            >

              ${cfg.extra}:
              ${item[cfg.maxField]}

              ${
                item.is_locked
                  ? ' · <span class="text-red-600 font-bold">LOCKED</span>'
                  : ''
              }

            </p>

          </div>


          <div class="flex gap-2">

            <button
              onclick="Teacher.showScoreEntry('${kind}','${item.id}', ${item[cfg.maxField]})"
              class="text-xs
                     font-bold
                     text-eduBlue-600"
            >

              <i class="fa-solid fa-pen"></i>

              Enter Scores

            </button>


            ${
              !item.is_locked

                ? `

                  <button
                    onclick="Teacher.lockAssessment('${kind}','${item.id}')"
                    class="text-xs
                           font-bold
                           text-red-600"
                  >

                    <i class="fa-solid fa-lock"></i>

                    Lock

                  </button>

                `

                : ''
            }

          </div>

        </div>


        <div
          id="score-entry-${item.id}"
          class="hidden mt-3 border-t pt-3"
        ></div>

      </div>

    `;

  },


  async createAssessment(e) {

    e.preventDefault();


    const kind =
      Teacher._assessKind;


    const cid =
      Teacher.state.classId;


    const payload = {

      classId:
        cid,

      title:
        val('as-title'),

      maxScore:
        parseFloat(
          val('as-max')
        )

    };


    if (
      kind === 'quizzes'
    ) {

      payload.totalItems =
        payload.maxScore;

    }


    if (
      kind === 'exams'
    ) {

      payload.examType =
        val('as-examType');

      payload.totalItems =
        payload.maxScore;

    }


    if (
      val('as-date')
    ) {

      payload[
        kind === 'quizzes'
          ? 'quizDate'
          : kind === 'exams'
            ? 'examDate'
            : 'taskDate'
      ] =
        val('as-date');

    }


    try {

      await api(
        'POST',
        Teacher
          ._assessCfg
          .createEndpoint,
        payload
      );


      Toast.show(
        'Created',
        `${Teacher._assessCfg.label} created.`,
        'success'
      );


      Teacher.renderAssessmentTab(
        kind
      );

    } catch {}


    return false;

  },


  async lockAssessment(
    kind,
    id
  ) {

    const path =
      kind === 'quizzes'

        ? `/assessments/quizzes/${id}/lock`

        : kind === 'performance'

          ? `/assessments/performance-tasks/${id}/lock`

          : `/assessments/exams/${id}/lock`;


    try {

      await api(
        'POST',
        path
      );


      Toast.show(
        'Locked',
        'Scores locked.',
        'success'
      );


      Teacher.renderAssessmentTab(
        kind
      );

    } catch {}

  },


  async showScoreEntry(
    kind,
    itemId,
    maxScore
  ) {

    const box =
      document.getElementById(
        `score-entry-${itemId}`
      );


    if (!box) return;


    box.classList.toggle(
      'hidden'
    );


    if (
      box.classList.contains(
        'hidden'
      ) ||
      box.dataset.loaded
    ) {

      return;

    }


    box.dataset.loaded =
      '1';


    const roster =
      await api(
        'GET',
        `/classes/${Teacher.state.classId}/roster`
      ).catch(() => []);


    box.innerHTML = `

      <div class="space-y-1">

        ${roster.map(s => `

          <div
            class="flex items-center
                   justify-between
                   gap-2
                   text-sm"
          >

            <span>

              ${esc(s.last_name)},
              ${esc(s.first_name)}

              <span
                class="text-slate-400 text-xs"
              >

                (${esc(s.student_number)})

              </span>

            </span>


            <div
              class="flex items-center gap-1"
            >

              <input
                type="number"
                step="any"
                min="0"
                max="${maxScore}"
                id="score-${itemId}-${s.id}"
                placeholder="/ ${maxScore}"
                class="w-24 px-2 py-1 rounded-lg border border-slate-300 text-sm"
              >


              <button
                onclick="Teacher.saveScore('${kind}','${itemId}','${s.id}')"
                class="text-xs
                       bg-eduBlue-600
                       text-white
                       px-2
                       py-1
                       rounded-lg
                       font-bold"
              >

                Save

              </button>

            </div>

          </div>

        `).join('')}

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
        { rawScore }
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

        <h4 class="font-bold mb-3">

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
          ].map(k => `

            <div
              class="flex
                     justify-between
                     items-center"
            >

              <label
                class="text-sm capitalize"
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
                class="w-24 px-2 py-1 rounded-lg border border-slate-300 text-sm"
              >

            </div>

          `).join('')}


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
    ].forEach(k => {

      payload[k] =
        parseFloat(
          val(`w-${k}`)
        );

    });


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

      ApprovalNotification.forceRefresh();

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

    ApprovalNotification.state.adminPending =
      pending;


    ApprovalNotification.updateBadge(
      pending
    );


    ApprovalNotification.updateEnhancedUI();

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


    ApprovalNotification.state.adminPending =
      count;


    ApprovalNotification.updateBadge(
      count
    );


    ApprovalNotification.updateEnhancedUI();


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


      ApprovalNotification.forceRefresh();

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


      ApprovalNotification.forceRefresh();

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

                  ${
                    u.is_active

                      ? `

                        <button
                          onclick="Admin.deactivate('${u.id}')"
                          class="text-xs
                                 font-bold
                                 text-red-600"
                        >

                          Deactivate

                        </button>

                      `

                      : `

                        <button
                          onclick="Admin.reactivate('${u.id}')"
                          class="text-xs
                                 font-bold
                                 text-emerald-600"
                        >

                          Reactivate

                        </button>

                      `
                  }

                </td>

              </tr>

            `).join('')}

          </tbody>

        </table>

      </div>

    `;

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
