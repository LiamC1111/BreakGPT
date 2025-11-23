// File: Website/nav.js
(function () {
  const mount = document.getElementById('site-nav');
  if (!mount) return;

  // Figure out base /Website/ path so links work no matter where nav.js is included
  let WEBROOT = '/Website/';
  try {
    const s = document.currentScript || Array.from(document.scripts).find(x => (x.src || '').includes('nav.js'));
    if (s) {
      const u = new URL(s.src, location.href);
      WEBROOT = u.pathname.replace(/nav\.js(?:\?.*)?$/, '');
      if (!WEBROOT.endsWith('/')) WEBROOT += '/';
    }
  } catch (_) {}

  // Destinations
  const HREF_HOME       = `${WEBROOT}index.html`;
  const HREF_CHALLENGES = `${WEBROOT}challenge_selection.html`;
  const HREF_LEADER     = `${WEBROOT}leaderboard.html`;
  const HREF_PROFILE    = `${WEBROOT}profile.html`;
  const HREF_LOGIN      = `${WEBROOT}login.html`;

  // Inject navbar HTML
  mount.innerHTML = `
    <div class="nav-center">
      <button data-href="${HREF_HOME}"        data-nav="home">Home</button>
      <button data-href="${HREF_CHALLENGES}"  data-nav="challenges">Challenges</button>
      <button data-href="${HREF_LEADER}"      data-nav="leaderboard">Leaderboard</button>
      <button data-href="${HREF_PROFILE}"     data-nav="profile">Profile</button>
    </div>

    <div class="nav-right" id="nav-right">
      <div class="toggle-container">
        <label class="switch theme-switch" aria-label="Toggle dark mode">
          <input type="checkbox" id="theme-toggle" />
          <span class="slider theme-slider">
            <span class="icon sun" aria-hidden="true">☀</span>
            <span class="icon moon" aria-hidden="true">🌙</span>
            <span class="knob"></span>
          </span>
        </label>
      </div>
    </div>
  `;

  // Helper: mark which nav button should be "active"
  function markActiveNav() {
    const path = location.pathname; // full path like /Website/index.html or /Website/Challenges/Challenge3/challenge.html
    let activeKey = null;

    if (path.includes('/Challenges/')) {
      // any actual challenge page -> "Challenges"
      activeKey = 'challenges';
    } else if (path.endsWith('challenge_selection.html')) {
      activeKey = 'challenges';
    } else if (path.endsWith('leaderboard.html')) {
      activeKey = 'leaderboard';
    } else if (path.endsWith('profile.html')) {
      activeKey = 'profile';
    } else if (path.endsWith('index.html') || path === '/' || path === WEBROOT) {
      activeKey = 'home';
    }

    if (activeKey) {
      const btn = mount.querySelector(`.nav-center [data-nav="${activeKey}"]`);
      if (btn) {
        btn.classList.add('active');
        btn.setAttribute('aria-current', 'page'); // a11y
      }
    }
  }

  // Wire up nav button clicks
  mount.querySelectorAll('[data-href]').forEach(btn => {
    btn.addEventListener('click', () => {
      location.href = btn.getAttribute('data-href');
    });
  });

  // Run active marker once nav buttons exist
  markActiveNav();

  // Dark mode toggle
  const themeToggle = mount.querySelector('#theme-toggle');
  const savedTheme  = localStorage.getItem('theme');

  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.checked = true;
  }

  themeToggle.addEventListener('change', () => {
    const darkOn = themeToggle.checked;
    document.body.classList.toggle('dark-mode', darkOn);
    localStorage.setItem('theme', darkOn ? 'dark' : 'light');
  });

  // Greeting + logout (with avatar)
  const navRight   = mount.querySelector('#nav-right');
  const toggleWrap = mount.querySelector('.toggle-container');

  let user, username = 'User';
  try {
    const raw = localStorage.getItem('user');
    user = raw ? JSON.parse(raw) : null;
    username = (user && (user.username || user.name || user.email)) || 'User';
  } catch {
    localStorage.removeItem('user');
  }

  const userKey = (user && (user._id || user.email || user.username)) || 'default';
  let avatarSrc = localStorage.getItem(`avatar:${userKey}`) || '';
  if (avatarSrc && !avatarSrc.startsWith('/')) {
    avatarSrc = WEBROOT + avatarSrc.replace(/^\/+/, '');
  }

  const greetBtn = document.createElement('button');
  greetBtn.className = 'primary-btn nav-greet';
  const initial = (username.trim()[0] || 'U').toUpperCase();
  greetBtn.innerHTML = avatarSrc
    ? `<img class="nav-avatar" src="${avatarSrc}" alt="" aria-hidden="true"><span>Hi, ${username}</span>`
    : `<span class="nav-avatar nav-avatar-fallback">${initial}</span><span>Hi, ${username}</span>`;
  greetBtn.addEventListener('click', () => (location.href = HREF_PROFILE));

  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'logout-btn';
  logoutBtn.className = 'primary-btn';
  logoutBtn.textContent = 'Logout';
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('user');
    location.replace(HREF_LOGIN);
  });

  // insert greeting + logout before the toggle
  navRight.insertBefore(greetBtn,  toggleWrap);
  navRight.insertBefore(logoutBtn, toggleWrap);
})();
