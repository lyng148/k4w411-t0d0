import './style.css';
import Sortable from 'sortablejs';
import {
  createIcons,
  Sparkles,
  Plus,
  Minus,
  Trash2,
  Pencil,
  RefreshCw,
  Settings,
  User,
  Square,
  Copy,
  X,
  Check,
  Tag,
  Repeat,
  Smile,
  CheckSquare,
  FolderPlus,
  Clock,
  ExternalLink
} from 'lucide';

function renderLucideIcons() {
  createIcons({
    icons: {
      Sparkles,
      Plus,
      Minus,
      Trash2,
      Pencil,
      RefreshCw,
      Settings,
      User,
      Square,
      Copy,
      X,
      Check,
      Tag,
      Repeat,
      Smile,
      CheckSquare,
      FolderPlus,
      Clock,
      ExternalLink
    }
  });
}

// Environment detection & Query Params
const isElectron = typeof window.electronAPI !== 'undefined';
const className = isElectron ? 'is-electron' : 'is-web';
document.documentElement.classList.add(className);
document.body.classList.add(className);

const urlParams = new URLSearchParams(window.location.search);
const standaloneGroupId = urlParams.get('standaloneGroup');

// Register Service Worker for PWA (web mode)
if ('serviceWorker' in navigator && !isElectron) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('ServiceWorker registered:', registration.scope);
      })
      .catch((error) => {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}

// API Endpoint & State
const API_URL = 'https://k4w411-t0d0-be.vercel.app';
let currentUser = (localStorage.getItem('todoUsername') || 'rin').trim().toLowerCase();
localStorage.setItem('todoUsername', currentUser);

const DEFAULT_GROUPS = [
  { id: 'group-tieng-nhat', name: 'HỌC TIẾNG NHẬT 🇯🇵', theme: 'green' },
  { id: 'group-do-an', name: 'RINGO & PAPER 🎓', theme: 'purple' },
  { id: 'group-ca-nhan', name: 'CÁ NHÂN & CÔNG VIỆC 🌸', theme: 'sand' }
];

const DEFAULT_TASKS = [
  { id: 'task-rin-1-1786214778874', text: 'Shadowing', groupId: 'group-tieng-nhat', completed: false, priority: 'high', tags: ['Tiếng Nhật', 'N3/N2'] },
  { id: 'task-rin-2-1786214779075', text: 'Học từ vựng Anki mỗi ngày', groupId: 'group-tieng-nhat', completed: false, priority: 'high', tags: ['Anki', 'Từ vựng'] },
  { id: 'task-1786215599916-ydf9', text: 'Đọc báo', groupId: 'group-tieng-nhat', completed: false, priority: 'medium', tags: [] },
  { id: 'task-rin-5-1786214779250', text: 'Thực hiện check ver 1 paper + Check kế hoạch kiểm thử BT2', groupId: 'group-do-an', completed: false, priority: 'high', tags: ['Đồ án'] },
  { id: 'task-1786215526983-sgnj', text: 'Làm task GTM + bổ sung học liệu', groupId: 'group-do-an', completed: false, priority: 'medium', tags: [] },
  { id: 'task-rin-12-1786214779661', text: 'Làm checklist giấy tờ COE', groupId: 'group-ca-nhan', completed: false, priority: 'medium', tags: ['Thủ tục'] },
  { id: 'task-1786215700853-y5c8', text: 'Có thể là học thêm RAG + AWS', groupId: 'group-ca-nhan', completed: false, priority: 'medium', tags: [] },
  { id: 'task-1786215715575-8nv4', text: 'Maxxing', groupId: 'group-ca-nhan', completed: false, priority: 'medium', tags: [] }
];

let groups = JSON.parse(localStorage.getItem('todoGroups') || 'null') || DEFAULT_GROUPS;
let tasks = JSON.parse(localStorage.getItem('todoTasks') || 'null') || DEFAULT_TASKS;
let sortableInstances = [];
let groupSortableInstance = null;
let syncTimeout = null;

// HTML Escaping
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCurrentDateFormatted() {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `DATE: ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

// Toast Notifications
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    const appEl = document.querySelector('#app');
    if (appEl) appEl.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = escapeHTML(message);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

// App Initialization
if (standaloneGroupId) {
  // Standalone Floating Desktop Sticky Note Mode
  initStandaloneNoteMode();
} else if (!currentUser) {
  showLoginScreen();
} else {
  showTodoApp();
}

function initStandaloneNoteMode() {
  document.body.classList.add('is-standalone');
  document.documentElement.classList.add('is-standalone');
  loadTasks();
  const group = groups.find(g => g.id === standaloneGroupId) || groups[0] || { id: standaloneGroupId, name: 'Sticky Note', theme: 'purple' };
  
  document.querySelector('#app').innerHTML = `
    <div class="standalone-note-card group-theme-${group.theme || 'purple'}">
      <div class="standalone-note-header">
        <div class="title-drag-area">
          <h2 class="group-title">${escapeHTML(group.name)}</h2>
          <span class="group-count" id="standalone-count">0</span>
        </div>
        <div class="group-actions" style="-webkit-app-region: no-drag !important; position: relative; z-index: 100; pointer-events: auto;">
          <button class="btn-group-add-task" id="standalone-add-btn" title="Thêm công việc">
            <i data-lucide="plus"></i>
          </button>
          <span class="action-divider"></span>
          <button class="action-btn" id="standalone-minimize-btn" title="Thu nhỏ" style="width: 24px; height: 24px; font-size: 0.8rem;">
            <i data-lucide="minus"></i>
          </button>
          <button class="action-btn btn-close" id="standalone-close-btn" title="Đóng giấy nhớ" style="width: 24px; height: 24px; font-size: 0.8rem;">
            <i data-lucide="x"></i>
          </button>
        </div>
      </div>
      <ul class="group-task-list" id="standalone-task-list" data-group-id="${group.id}"></ul>
    </div>
  `;

  renderLucideIcons();

  document.getElementById('standalone-close-btn').addEventListener('click', () => {
    window.electronAPI?.closeApp();
  });

  document.getElementById('standalone-minimize-btn').addEventListener('click', () => {
    window.electronAPI?.minimizeApp();
  });

  document.getElementById('standalone-add-btn').addEventListener('click', () => {
    openTaskModal(null, group.id);
  });

  renderStandaloneGroupTasks(group.id);
}

function renderStandaloneGroupTasks(groupId) {
  const taskListEl = document.getElementById('standalone-task-list');
  const countEl = document.getElementById('standalone-count');
  if (!taskListEl) return;

  taskListEl.innerHTML = '';
  const groupTasks = tasks.filter(t => t.groupId === groupId);
  if (countEl) countEl.textContent = groupTasks.length;

  groupTasks.forEach(task => {
    const li = createTaskCardElement(task);
    taskListEl.appendChild(li);
  });

  new Sortable(taskListEl, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: () => {
      const liElements = Array.from(taskListEl.children);
      const reorderedTaskIds = liElements.map(el => el.dataset.taskId);
      const otherTasks = tasks.filter(t => t.groupId !== groupId);
      const updatedGroupTasks = reorderedTaskIds.map(id => tasks.find(t => t.id === id)).filter(Boolean);
      tasks = [...otherTasks, ...updatedGroupTasks];
      saveTasks();
    }
  });

  renderLucideIcons();
}

function showLoginScreen() {
  document.querySelector('#app').innerHTML = `
    <!-- Botanical Line Art -->
    <svg class="floral-bg-top" viewBox="0 0 100 100" fill="none" stroke="#8C7A6B" stroke-width="1.2">
      <circle cx="70" cy="30" r="10" stroke="#8C7A6B" stroke-dasharray="2 2" />
      <path d="M 70 20 Q 65 8 70 3 Q 75 8 70 20 Z" />
      <path d="M 70 40 Q 65 52 70 57 Q 75 52 70 40 Z" />
      <path d="M 60 30 Q 48 25 43 30 Q 48 35 60 30 Z" />
      <path d="M 80 30 Q 92 25 97 30 Q 92 35 80 30 Z" />
      <path d="M 63 23 Q 52 14 55 10 Q 62 14 63 23 Z" />
      <path d="M 77 37 Q 88 46 85 50 Q 78 46 77 37 Z" />
      <path d="M 77 23 Q 88 14 85 10 Q 78 14 77 23 Z" />
      <path d="M 63 37 Q 52 46 55 50 Q 62 46 63 37 Z" />
    </svg>

    <div class="login-drag-bar"></div>
    <div class="login-screen">
      <div class="login-card">
        <h1 class="login-title">
          <i data-lucide="sparkles" class="icon-purple"></i>
          Welcome!
          <i data-lucide="smile" class="icon-amber"></i>
        </h1>
        <div class="login-form">
          <input type="text" id="username-input" placeholder="Nhập tên người dùng..." autocomplete="off" />
          <div id="login-warning" class="login-warning"></div>
          <button id="login-btn" class="btn-add-main" style="width: 100%; justify-content: center;">Bắt đầu</button>
        </div>
      </div>
    </div>
  `;

  renderLucideIcons();
  applySavedSettings();

  const usernameInput = document.getElementById('username-input');
  const loginBtn = document.getElementById('login-btn');
  const loginWarning = document.getElementById('login-warning');

  const handleLogin = async () => {
    const rawName = usernameInput.value.trim();
    if (rawName === '') {
      usernameInput.classList.add('error');
      loginWarning.textContent = 'Vui lòng nhập tên người dùng hợp lệ!';
      setTimeout(() => usernameInput.classList.remove('error'), 500);
      return;
    }

    const username = rawName.toLowerCase();
    currentUser = username;
    localStorage.setItem('todoUsername', username);
    localStorage.removeItem('todoTasks');
    localStorage.removeItem('todoGroups');

    loginBtn.disabled = true;
    loginBtn.textContent = 'Đang tải dữ liệu...';

    await fetchTasksFromServer();
    showTodoApp();
    showToast(`Xin chào, ${rawName}!`, 'success');
  };

  loginBtn.addEventListener('click', handleLogin);
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  usernameInput.addEventListener('input', () => {
    loginWarning.textContent = '';
  });
}

let trashTasks = [];

function loadTrash() {
  const savedTrash = localStorage.getItem('todoTrash');
  if (savedTrash) {
    try { trashTasks = JSON.parse(savedTrash); } catch (e) { trashTasks = []; }
  }
  cleanupTrash();
}

function cleanupTrash() {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  trashTasks = trashTasks.filter(t => {
    const deletedTime = t.deletedAt ? new Date(t.deletedAt).getTime() : now;
    return (now - deletedTime) <= SEVEN_DAYS_MS;
  });
  localStorage.setItem('todoTrash', JSON.stringify(trashTasks));
  updateTrashBadge();
}

function saveTrash() {
  localStorage.setItem('todoTrash', JSON.stringify(trashTasks));
  updateTrashBadge();
}

function updateTrashBadge() {
  const badge = document.getElementById('trash-badge');
  if (badge) {
    if (trashTasks.length > 0) {
      badge.textContent = trashTasks.length;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

function showTodoApp() {
  document.querySelector('#app').innerHTML = `
    <!-- Botanical Daisy Line Art Decorations -->
    <svg class="floral-bg-top" viewBox="0 0 100 100" fill="none" stroke="#8C7A6B" stroke-width="1.2">
      <circle cx="70" cy="30" r="10" stroke="#8C7A6B" stroke-dasharray="2 2" />
      <path d="M 70 20 Q 65 8 70 3 Q 75 8 70 20 Z" />
      <path d="M 70 40 Q 65 52 70 57 Q 75 52 70 40 Z" />
      <path d="M 60 30 Q 48 25 43 30 Q 48 35 60 30 Z" />
      <path d="M 80 30 Q 92 25 97 30 Q 92 35 80 30 Z" />
      <path d="M 63 23 Q 52 14 55 10 Q 62 14 63 23 Z" />
      <path d="M 77 37 Q 88 46 85 50 Q 78 46 77 37 Z" />
      <path d="M 77 23 Q 88 14 85 10 Q 78 14 77 23 Z" />
      <path d="M 63 37 Q 52 46 55 50 Q 62 46 63 37 Z" />
    </svg>
    <svg class="floral-bg-bottom" viewBox="0 0 120 80" fill="none" stroke="#8C7A6B" stroke-width="1.2">
      <circle cx="60" cy="65" r="12" stroke="#8C7A6B" stroke-dasharray="2 2" />
      <path d="M 60 53 Q 55 35 60 20 Q 65 35 60 53 Z" />
      <path d="M 48 65 Q 25 60 15 65 Q 25 70 48 65 Z" />
      <path d="M 72 65 Q 95 60 105 65 Q 95 70 72 65 Z" />
      <path d="M 52 56 Q 34 38 38 32 Q 47 41 52 56 Z" />
      <path d="M 68 56 Q 86 38 82 32 Q 73 41 68 56 Z" />
    </svg>

    <div class="todo-app">
      <header class="header-bar">
        <div class="title-drag-area">
          <h1 class="header-title">TO DO LIST</h1>
          <span class="header-date-badge">${getCurrentDateFormatted()}</span>
        </div>
        <div class="title-bar-actions">
          <button id="trash-btn" class="action-btn" title="Thùng Rác (Xem & Khôi phục công việc đã xóa)" aria-label="Trash Bin" style="position:relative;">
            <i data-lucide="trash-2" class="icon-rose"></i>
            <span id="trash-badge" class="trash-badge" style="display:none;">0</span>
          </button>
          <button id="settings-btn" class="action-btn" title="Cài đặt" aria-label="Settings">
            <i data-lucide="settings" class="icon-slate"></i>
          </button>
          <button id="refresh-btn" class="action-btn" title="Đồng bộ" aria-label="Refresh Sync">
            <i data-lucide="refresh-cw" class="icon-indigo"></i>
          </button>
          <button id="logout-btn" class="action-btn" title="Đổi tài khoản" aria-label="Change User">
            <i data-lucide="user" class="icon-purple"></i>
          </button>
          ${isElectron ? `<span class="action-divider"></span>` : ''}
          ${isElectron ? `
            <button id="minimize-btn" class="action-btn" title="Thu nhỏ xuống Taskbar" aria-label="Minimize">
              <i data-lucide="minus" class="icon-amber"></i>
            </button>
            <button id="maximize-btn" class="action-btn" title="Phóng to" aria-label="Maximize">
              <i data-lucide="square" class="icon-blue"></i>
            </button>
            <button id="close-btn" class="action-btn btn-close" title="Đóng" aria-label="Close">
              <i data-lucide="x" class="icon-rose"></i>
            </button>
          ` : ''}
        </div>
      </header>

      <div class="app-toolbar">
        <button id="btn-open-add-task" class="btn-add-main">
          <i data-lucide="plus"></i> Thêm Công Việc
        </button>
        <button id="btn-open-add-group" class="btn-add-group">
          <i data-lucide="folder-plus" class="icon-indigo"></i> Thêm Giấy Nhớ
        </button>
      </div>

      <div id="groups-container" class="groups-container"></div>
    </div>
  `;

  renderLucideIcons();
  setupCloseButton();
  setupMaximizeButton();
  setupMinimizeButton();
  setupSettingsButton();
  setupLogoutButton();
  setupRefreshButton();
  
  const trashBtn = document.getElementById('trash-btn');
  if (trashBtn) {
    trashBtn.addEventListener('click', () => openTrashModal());
  }

  document.getElementById('btn-open-add-task').addEventListener('click', () => openTaskModal());
  document.getElementById('btn-open-add-group').addEventListener('click', () => openGroupModal());

  loadTasks();
  loadTrash();
  applySavedSettings();

  const container = document.getElementById('groups-container');
  if (container && (!tasks || tasks.length === 0)) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #8C7A6B; font-family: 'Patrick Hand', cursive; font-size: 1.25rem;">
        <i data-lucide="refresh-cw" class="icon-indigo spinning" style="font-size: 1.6rem; display: inline-block; margin-bottom: 8px;"></i>
        <div>Đang đồng bộ dữ liệu từ máy chủ...</div>
      </div>
    `;
    renderLucideIcons();
  } else {
    renderGroupsAndTasks();
  }

  // Fetch latest tasks & groups from server on app startup
  fetchTasksFromServer().then(() => {
    renderGroupsAndTasks();
  });
}

function setupCloseButton() {
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn && isElectron) {
    closeBtn.addEventListener('click', () => window.electronAPI?.closeApp());
  }
}

function setupMaximizeButton() {
  const maximizeBtn = document.getElementById('maximize-btn');
  if (maximizeBtn && isElectron) {
    maximizeBtn.addEventListener('click', () => window.electronAPI?.maximizeApp());

    window.electronAPI?.onMaximizeStateChange((isMaximized) => {
      if (isMaximized) {
        maximizeBtn.setAttribute('title', 'Thu nhỏ cửa sổ (Restore)');
        maximizeBtn.innerHTML = '<i data-lucide="copy" class="icon-blue"></i>';
      } else {
        maximizeBtn.setAttribute('title', 'Phóng to');
        maximizeBtn.innerHTML = '<i data-lucide="square" class="icon-blue"></i>';
      }
      renderLucideIcons();
    });
  }
}

function setupMinimizeButton() {
  const minimizeBtn = document.getElementById('minimize-btn');
  if (minimizeBtn && isElectron) {
    minimizeBtn.addEventListener('click', () => window.electronAPI?.minimizeApp());
  }
}

function setupSettingsButton() {
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', toggleSettingsPanel);
  }
}

function toggleSettingsPanel() {
  let panel = document.getElementById('settings-panel');
  if (panel) {
    panel.remove();
    return;
  }

  panel = document.createElement('div');
  panel.id = 'settings-panel';
  panel.className = 'settings-panel';

  const currentScale = localStorage.getItem('appScale') || '1';
  const currentFontSize = localStorage.getItem('appFontSize') || '17';

  panel.innerHTML = `
    <div class="settings-content">
      <h3>Cài Đặt</h3>
      <div class="setting-item">
        <label>Chế độ Kích thước:</label>
        <select id="width-mode-select" class="form-select">
          <option value="full" ${currentWidthMode === 'full' ? 'selected' : ''}>Toàn Cửa Sổ (Tự co giãn)</option>
          <option value="medium" ${currentWidthMode === 'medium' ? 'selected' : ''}>Vừa Vặn (580px)</option>
          <option value="compact" ${currentWidthMode === 'compact' ? 'selected' : ''}>Nhỏ Gọn (460px)</option>
        </select>
      </div>
      <div class="setting-item">
        <label>Tỷ Lệ Giao Diện: <span id="scale-val">${currentScale}</span></label>
        <input type="range" id="scale-slider" min="0.75" max="1.3" step="0.05" value="${currentScale}">
      </div>
      <div class="setting-item">
        <label>Cỡ Chữ Viết Tay: <span id="font-val">${currentFontSize}px</span></label>
        <input type="range" id="font-slider" min="14" max="22" step="1" value="${currentFontSize}">
      </div>
      <button id="restore-backup-btn" class="btn-add-group" style="width: 100%; justify-content: center; margin-top: 4px;">
        <i data-lucide="refresh-cw"></i> Khôi Phục Sao Lưu Local
      </button>
      <button id="close-settings" class="btn-add-main" style="margin-top: 6px; width: 100%; justify-content: center;">Đóng</button>
    </div>
  `;

  document.querySelector('#app').appendChild(panel);
  renderLucideIcons();

  const scaleSlider = document.getElementById('scale-slider');
  const fontSlider = document.getElementById('font-slider');
  const widthSelect = document.getElementById('width-mode-select');
  const restoreBackupBtn = document.getElementById('restore-backup-btn');
  const closeSettings = document.getElementById('close-settings');

  widthSelect.addEventListener('change', (e) => {
    const mode = e.target.value;
    localStorage.setItem('appWidthMode', mode);
    applyWidthMode(mode);
  });

  scaleSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    document.getElementById('scale-val').textContent = val;
    document.documentElement.style.setProperty('--app-scale', val);
    localStorage.setItem('appScale', val);
  });

  fontSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    document.getElementById('font-val').textContent = val + 'px';
    document.documentElement.style.setProperty('--app-font-size', val + 'px');
    localStorage.setItem('appFontSize', val);
  });

  if (restoreBackupBtn) {
    restoreBackupBtn.addEventListener('click', () => {
      const backupTasks = localStorage.getItem('todoTasks_backup');
      const backupGroups = localStorage.getItem('todoGroups_backup');
      if (backupTasks) {
        try {
          tasks = JSON.parse(backupTasks);
          if (backupGroups) groups = JSON.parse(backupGroups);
          saveTasks();
          renderGroupsAndTasks();
          showToast('Đã khôi phục bản sao lưu local thành công!', 'success');
          panel.remove();
        } catch (e) {
          showToast('Lỗi đọc bản sao lưu', 'error');
        }
      } else {
        showToast('Chưa có bản sao lưu local', 'info');
      }
    });
  }

  closeSettings.addEventListener('click', () => panel.remove());
}

function applyWidthMode(mode) {
  const appEl = document.getElementById('app');
  if (!appEl) return;
  if (mode === 'compact') {
    appEl.style.setProperty('--app-max-width', '460px');
  } else if (mode === 'medium') {
    appEl.style.setProperty('--app-max-width', '580px');
  } else {
    appEl.style.setProperty('--app-max-width', '100%');
  }
}

function applySavedSettings() {
  const scale = localStorage.getItem('appScale') || '1';
  const fontSize = localStorage.getItem('appFontSize') || '17';
  const widthMode = localStorage.getItem('appWidthMode') || 'full';
  document.documentElement.style.setProperty('--app-scale', scale);
  document.documentElement.style.setProperty('--app-font-size', fontSize + 'px');
  applyWidthMode(widthMode);
}

function setupLogoutButton() {
  const logoutBtn = document.getElementById('logout-btn');
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('todoUsername');
    showLoginScreen();
    showToast('Đã đăng xuất', 'info');
  });
}

function setupRefreshButton() {
  const refreshBtn = document.getElementById('refresh-btn');
  if (!refreshBtn) return;

  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.style.opacity = '0.6';
    try {
      await fetchTasksFromServer();
      renderGroupsAndTasks();
      showToast('Đã đồng bộ công việc', 'success');
    } catch (err) {
      console.error('Refresh failed:', err);
      showToast('Lỗi đồng bộ', 'error');
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.style.opacity = '1';
    }
  });
}

function renderGroupsAndTasks() {
  const container = document.getElementById('groups-container');
  if (!container) return;

  sortableInstances.forEach(inst => inst.destroy());
  sortableInstances = [];

  if (groupSortableInstance) groupSortableInstance.destroy();

  container.innerHTML = '';

  if (groups.length === 0) {
    groups = DEFAULT_GROUPS;
  }

  groups.forEach(group => {
    const groupTasks = tasks.filter(t => t.groupId === group.id || (!t.groupId && group.id === groups[0].id));

    const section = document.createElement('div');
    section.className = `group-section group-theme-${group.theme || 'purple'}`;
    section.dataset.groupId = group.id;

    section.innerHTML = `
      <div class="group-header">
        <div class="group-title-wrapper">
          <h2 class="group-title" title="Nhấp để đổi tên giấy nhớ">${escapeHTML(group.name)}</h2>
          <span class="group-count">${groupTasks.length}</span>
        </div>
        <div class="group-actions">
          <button class="btn-group-add-task" data-group-id="${group.id}" title="Thêm công việc vào ${escapeHTML(group.name)}">
            <i data-lucide="plus"></i>
          </button>
          ${isElectron ? `<button class="btn-group-popout" data-group-id="${group.id}" title="Tách ra thành Giấy nhớ độc lập trên Desktop"><i data-lucide="external-link"></i></button>` : ''}
          ${groups.length > 1 ? `<button class="btn-group-delete" data-group-id="${group.id}" title="Xóa giấy nhớ này"><i data-lucide="trash-2"></i></button>` : ''}
        </div>
      </div>
      <ul class="group-task-list" data-group-id="${group.id}"></ul>
    `;

    container.appendChild(section);

    const groupTitleEl = section.querySelector('.group-title');
    groupTitleEl.addEventListener('click', () => {
      const currentName = group.name;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'group-title-input';
      input.value = currentName;
      input.style.fontFamily = "'Patrick Hand', cursive";
      input.style.fontWeight = '700';
      input.style.fontSize = '1.25rem';
      input.style.border = '1px dashed #5C4A3E';
      input.style.borderRadius = '6px';
      input.style.padding = '1px 6px';
      input.style.outline = 'none';
      input.style.color = 'inherit';
      input.style.background = '#FFFFFF';

      groupTitleEl.replaceWith(input);
      input.focus();

      let isSaved = false;
      const saveGroupName = () => {
        if (isSaved) return;
        isSaved = true;
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
          group.name = newName;
          saveTasks();
          showToast(`Đã đổi tên thành "${newName}"`, 'success');
        }
        renderGroupsAndTasks();
      };

      input.addEventListener('blur', saveGroupName);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          saveGroupName();
        } else if (e.key === 'Escape') {
          isSaved = true;
          renderGroupsAndTasks();
        }
      });
    });

    const popoutBtn = section.querySelector('.btn-group-popout');
    if (popoutBtn && isElectron) {
      popoutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.electronAPI?.openStandaloneNote(group.id);
        showToast(`Đã tách "${group.name}" ra Desktop!`, 'success');
      });
    }

    const deleteGroupBtn = section.querySelector('.btn-group-delete');
    if (deleteGroupBtn) {
      deleteGroupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Bạn có chắc chắn muốn xóa giấy nhớ "${group.name}"?`)) {
          groups = groups.filter(g => g.id !== group.id);
          const targetGroup = groups[0];
          tasks.forEach(t => {
            if (t.groupId === group.id) t.groupId = targetGroup.id;
          });
          saveTasks();
          renderGroupsAndTasks();
          showToast('Đã xóa giấy nhớ', 'info');
        }
      });
    }

    const taskListEl = section.querySelector('.group-task-list');

    groupTasks.forEach(task => {
      const li = createTaskCardElement(task);
      taskListEl.appendChild(li);
    });

    section.querySelector('.btn-group-add-task').addEventListener('click', (e) => {
      e.stopPropagation();
      openTaskModal(null, group.id);
    });

    const sortable = new Sortable(taskListEl, {
      group: 'shared-tasks',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: (evt) => {
        const targetGroupId = evt.to.dataset.groupId;
        const taskId = evt.item.dataset.taskId;
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          task.groupId = targetGroupId;
        }
        saveTasks();
      }
    });

    sortableInstances.push(sortable);
  });

  groupSortableInstance = new Sortable(container, {
    animation: 200,
    handle: '.group-header',
    ghostClass: 'group-sortable-ghost',
    onEnd: () => {
      const groupElements = Array.from(container.querySelectorAll('.group-section'));
      const newGroupsOrder = [];
      groupElements.forEach(el => {
        const gId = el.dataset.groupId;
        const found = groups.find(g => g.id === gId);
        if (found) newGroupsOrder.push(found);
      });
      groups = newGroupsOrder;
      saveTasks();
      showToast('Đã đổi thứ tự các Nhóm', 'info');
    }
  });

  renderLucideIcons();
}

function createTaskCardElement(task) {
  const li = document.createElement('li');
  li.className = `task-card ${task.completed ? 'completed' : ''}`;
  li.dataset.taskId = task.id;

  const safeText = escapeHTML(task.text);
  const priorityClass = task.priority || 'medium';

  const repeatHTML = task.repeatDaily ? `<span class="task-pill repeat-pill" title="Tự động reset về chưa hoàn thành mỗi ngày lúc 0h"><i data-lucide="repeat"></i> Hàng ngày</span>` : '';
  const tagsHTML = (task.tags || []).map(tag => `<span class="task-pill">${escapeHTML(tag)}</span>`).join('');
  const allPillsHTML = repeatHTML + tagsHTML;

  li.innerHTML = `
    <input type="checkbox" class="task-checkbox-custom" ${task.completed ? 'checked' : ''} aria-label="Mark task completed">
    <div class="task-content-block">
      <div class="priority-dot ${priorityClass}" title="Độ ưu tiên: ${priorityClass}"></div>
      <span class="task-title">${safeText}</span>
    </div>
    ${allPillsHTML ? `<div class="task-tags-row">${allPillsHTML}</div>` : ''}
    <div class="task-actions">
      <button class="btn-card-action btn-edit-task" title="Sửa công việc">
        <i data-lucide="pencil" class="icon-indigo"></i>
      </button>
      <button class="btn-card-action btn-delete-task" title="Xóa công việc">
        <i data-lucide="trash-2" class="icon-rose"></i>
      </button>
    </div>
  `;

  const checkbox = li.querySelector('.task-checkbox-custom');
  const editBtn = li.querySelector('.btn-edit-task');
  const deleteBtn = li.querySelector('.btn-delete-task');

  checkbox.addEventListener('change', () => {
    task.completed = checkbox.checked;
    li.classList.toggle('completed', task.completed);
    saveTasks();
    if (standaloneGroupId) {
      renderStandaloneGroupTasks(standaloneGroupId);
    }
  });

  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openTaskModal(task);
  });

  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    if (!Array.isArray(trashTasks)) {
      trashTasks = [];
    }

    // 1. Move task to Trash Bin (stored for 7 days)
    const deletedTaskCopy = { ...task, deletedAt: new Date().toISOString() };
    trashTasks.push(deletedTaskCopy);
    saveTrash();

    // 2. Record deleted ID to prevent resurrection
    const deletedIds = JSON.parse(localStorage.getItem('todoDeletedTaskIds') || '[]');
    if (!deletedIds.includes(task.id)) {
      deletedIds.push(task.id);
      localStorage.setItem('todoDeletedTaskIds', JSON.stringify(deletedIds));
    }

    // 3. Remove locally from tasks array & save
    tasks = tasks.filter(t => t.id !== task.id);
    saveTasks();

    // 4. Animate remove card from DOM immediately
    li.style.transform = 'scale(0.9)';
    li.style.opacity = '0';
    setTimeout(() => {
      if (standaloneGroupId) {
        renderStandaloneGroupTasks(standaloneGroupId);
      } else {
        renderGroupsAndTasks();
      }
      showToast('Đã chuyển công việc vào Thùng Rác', 'info');
    }, 180);

    // 5. Fire-and-forget async DELETE to backend server with encodeURIComponent
    if (currentUser && task.id) {
      fetch(`${API_URL}/${encodeURIComponent(currentUser)}/task/${encodeURIComponent(task.id)}`, { method: 'DELETE' })
        .catch(err => console.warn('Backend DELETE sync warning (task removed locally):', err));
    }
  });

  return li;
}

function openTaskModal(existingTask = null, defaultGroupId = null) {
  let modal = document.getElementById('task-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'task-modal';
  modal.className = 'modal-backdrop';

  const isEdit = !!existingTask;
  const taskText = existingTask ? existingTask.text : '';
  const selectedGroupId = existingTask ? existingTask.groupId : (defaultGroupId || groups[0]?.id || 'group-1');
  const priority = existingTask ? (existingTask.priority || 'medium') : 'medium';
  const repeatDaily = existingTask ? !!existingTask.repeatDaily : false;
  const tagsStr = existingTask && existingTask.tags ? existingTask.tags.join(', ') : '';

  const groupOptionsHTML = groups.map(g => `<option value="${g.id}" ${g.id === selectedGroupId ? 'selected' : ''}>${escapeHTML(g.name)}</option>`).join('');

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h3>${isEdit ? 'Sửa Công Việc' : 'Công Việc Mới'}</h3>
        <button class="btn-modal-close" id="btn-close-modal">
          <i data-lucide="x" class="icon-slate"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nội dung công việc</label>
          <input type="text" id="modal-task-title" class="form-input" placeholder="ví dụ: Move drafts in Figma..." value="${escapeHTML(taskText)}" />
        </div>
        <div class="form-group">
          <label>Giấy Nhớ / Nhóm</label>
          <select id="modal-task-group" class="form-select">
            ${groupOptionsHTML}
          </select>
        </div>
        <div class="form-group">
          <label>Thẻ Tag (phân cách bằng dấu phẩy)</label>
          <input type="text" id="modal-task-tags" class="form-input" placeholder="ví dụ: admin, low-energy, quick" value="${escapeHTML(tagsStr)}" />
        </div>
        <div class="form-group">
          <label>Độ Ưu Tiên</label>
          <div class="priority-selector">
            <button type="button" class="priority-btn ${priority === 'high' ? 'active' : ''}" data-priority="high">🔴 Cao</button>
            <button type="button" class="priority-btn ${priority === 'medium' ? 'active' : ''}" data-priority="medium">🟡 Vừa</button>
            <button type="button" class="priority-btn ${priority === 'low' ? 'active' : ''}" data-priority="low">🟢 Thấp</button>
          </div>
        </div>
        <div class="form-group" style="margin-top: 6px;">
          <label class="checkbox-label-row">
            <input type="checkbox" id="modal-task-repeat" ${repeatDaily ? 'checked' : ''} class="task-checkbox-custom" style="margin-top:0;">
            <span>🔄 Lặp lại hàng ngày (Tự reset về chưa xong sau 0h)</span>
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button id="btn-cancel-modal" class="btn-secondary">Hủy</button>
        <button id="btn-save-modal" class="btn-add-main">${isEdit ? 'Lưu Thay Đổi' : 'Thêm Công Việc'}</button>
      </div>
    </div>
  `;

  document.querySelector('#app').appendChild(modal);
  renderLucideIcons();

  const titleInput = document.getElementById('modal-task-title');
  const groupSelect = document.getElementById('modal-task-group');
  const tagsInput = document.getElementById('modal-task-tags');
  const repeatInput = document.getElementById('modal-task-repeat');
  const saveBtn = document.getElementById('btn-save-modal');
  const cancelBtn = document.getElementById('btn-cancel-modal');
  const closeBtn = document.getElementById('btn-close-modal');

  let currentPriority = priority;

  modal.querySelectorAll('.priority-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPriority = btn.dataset.priority;
    });
  });

  titleInput.focus();

  const handleSave = () => {
    const text = titleInput.value.trim();
    if (!text) {
      titleInput.style.borderColor = '#E55353';
      return;
    }

    const tags = tagsInput.value.split(',').map(s => s.trim()).filter(Boolean);
    const isRepeatDaily = repeatInput.checked;

    if (isEdit) {
      existingTask.text = text;
      existingTask.groupId = groupSelect.value;
      existingTask.priority = currentPriority;
      existingTask.repeatDaily = isRepeatDaily;
      existingTask.tags = tags;
    } else {
      tasks.push({
        id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        text,
        groupId: groupSelect.value,
        completed: false,
        repeatDaily: isRepeatDaily,
        priority: currentPriority,
        tags
      });
    }

    saveTasks();
    if (standaloneGroupId) {
      renderStandaloneGroupTasks(standaloneGroupId);
    } else {
      renderGroupsAndTasks();
    }
    closeModalWithAnimation(modal);
  };

  saveBtn.addEventListener('click', handleSave);
  titleInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSave(); });
  cancelBtn.addEventListener('click', () => closeModalWithAnimation(modal));
  closeBtn.addEventListener('click', () => closeModalWithAnimation(modal));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModalWithAnimation(modal); });
}

function openGroupModal() {
  let modal = document.getElementById('group-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'group-modal';
  modal.className = 'modal-backdrop';

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h3>Thêm Giấy Nhớ Mới</h3>
        <button class="btn-modal-close" id="btn-close-gmodal">
          <i data-lucide="x" class="icon-slate"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Tên Giấy Nhớ</label>
          <input type="text" id="modal-group-name" class="form-input" placeholder="ví dụ: Projects, Personal..." />
        </div>
        <div class="form-group">
          <label>Màu Tờ Giấy Nhớ</label>
          <select id="modal-group-theme" class="form-select">
            <option value="purple">Tím Oải Hương (Lavender)</option>
            <option value="blue">Xanh Lam Nhạt (Soft Blue)</option>
            <option value="green">Xanh Lụa (Sage Green)</option>
            <option value="sand">Màu Cát Ấm (Warm Sand)</option>
            <option value="rose">Hồng Phấn (Soft Rose)</option>
            <option value="amber">Vàng Nắng (Warm Amber)</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button id="btn-cancel-gmodal" class="btn-secondary">Hủy</button>
        <button id="btn-save-gmodal" class="btn-add-main">Tạo Giấy Nhớ</button>
      </div>
    </div>
  `;

  document.querySelector('#app').appendChild(modal);
  renderLucideIcons();

  const nameInput = document.getElementById('modal-group-name');
  const themeSelect = document.getElementById('modal-group-theme');
  const saveBtn = document.getElementById('btn-save-gmodal');

  nameInput.focus();

  const handleSave = () => {
    const name = nameInput.value.trim();
    if (!name) return;

    groups.push({
      id: 'group-' + Date.now(),
      name,
      theme: themeSelect.value
    });

    localStorage.setItem('todoGroups', JSON.stringify(groups));
    saveTasks();
    renderGroupsAndTasks();
    closeModalWithAnimation(modal);
  };

  saveBtn.addEventListener('click', handleSave);
  nameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSave(); });
  document.getElementById('btn-cancel-gmodal').addEventListener('click', () => closeModalWithAnimation(modal));
  document.getElementById('btn-close-gmodal').addEventListener('click', () => closeModalWithAnimation(modal));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModalWithAnimation(modal); });
}

function closeModalWithAnimation(modal) {
  if (!modal) return;
  modal.classList.add('is-closing');
  setTimeout(() => {
    if (modal && modal.parentNode) {
      modal.remove();
    }
  }, 160);
}

function openTrashModal() {
  cleanupTrash();
  let modal = document.getElementById('trash-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'trash-modal';
  modal.className = 'modal-backdrop';

  const trashItemsHTML = trashTasks.length === 0
    ? `<div class="empty-trash-state">
         <p>🗑️ Thùng rác rỗng</p>
         <small>Các công việc bị xóa sẽ lưu ở đây 7 ngày trước khi tự động dọn dẹp.</small>
       </div>`
    : trashTasks.map(task => {
        const group = groups.find(g => g.id === task.groupId) || { name: 'Giấy nhớ' };
        const daysLeft = task.deletedAt ? Math.max(1, 7 - Math.floor((Date.now() - new Date(task.deletedAt).getTime()) / (24 * 60 * 60 * 1000))) : 7;

        return `
          <div class="trash-item-row" data-trash-id="${task.id}">
            <div class="trash-item-info">
              <span class="trash-task-title">${escapeHTML(task.text)}</span>
              <div class="trash-item-meta">
                <span class="trash-group-pill">${escapeHTML(group.name)}</span>
                <span class="trash-expiry-badge">Còn ${daysLeft} ngày</span>
              </div>
            </div>
            <div class="trash-item-actions">
              <button class="btn-restore-task" data-id="${task.id}" title="Khôi phục công việc">
                <i data-lucide="refresh-cw" class="icon-indigo"></i> Khôi phục
              </button>
              <button class="btn-perm-delete-task" data-id="${task.id}" title="Xóa vĩnh viễn">
                <i data-lucide="trash-2" class="icon-rose"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');

  modal.innerHTML = `
    <div class="modal-card trash-modal-card">
      <div class="modal-header">
        <h3>🗑️ Thùng Rác <span class="sub-header-note">(Tự dọn sau 7 ngày)</span></h3>
        <button class="btn-modal-close" id="btn-close-trash-modal">
          <i data-lucide="x" class="icon-slate"></i>
        </button>
      </div>
      <div class="modal-body trash-body-scroll">
        ${trashItemsHTML}
      </div>
      <div class="modal-footer" style="justify-content: space-between;">
        ${trashTasks.length > 0 ? `<button id="btn-empty-trash" class="btn-secondary" style="color: #E55353;">Dọn Sạch Thùng Rác</button>` : '<div></div>'}
        <button id="btn-close-trash" class="btn-add-main">Đóng</button>
      </div>
    </div>
  `;

  document.querySelector('#app').appendChild(modal);
  renderLucideIcons();

  modal.querySelectorAll('.btn-restore-task').forEach(btn => {
    btn.addEventListener('click', () => {
      const tId = btn.dataset.id;
      const targetIndex = trashTasks.findIndex(t => t.id === tId);
      if (targetIndex !== -1) {
        const restoredTask = trashTasks.splice(targetIndex, 1)[0];
        delete restoredTask.deletedAt;

        let deletedIds = JSON.parse(localStorage.getItem('todoDeletedTaskIds') || '[]');
        deletedIds = deletedIds.filter(id => id !== tId);
        localStorage.setItem('todoDeletedTaskIds', JSON.stringify(deletedIds));

        tasks.push(restoredTask);
        saveTasks();
        saveTrash();
        renderGroupsAndTasks();
        showToast(`Đã khôi phục "${restoredTask.text}"`, 'success');
        openTrashModal();
      }
    });
  });

  modal.querySelectorAll('.btn-perm-delete-task').forEach(btn => {
    btn.addEventListener('click', () => {
      const tId = btn.dataset.id;
      trashTasks = trashTasks.filter(t => t.id !== tId);
      saveTrash();
      showToast('Đã xóa vĩnh viễn', 'info');
      openTrashModal();
    });
  });

  const emptyBtn = modal.querySelector('#btn-empty-trash');
  if (emptyBtn) {
    emptyBtn.addEventListener('click', () => {
      if (confirm('Bạn có chắc chắn muốn xóa vĩnh viễn tất cả công việc trong thùng rác?')) {
        trashTasks = [];
        saveTrash();
        showToast('Đã dọn sạch thùng rác', 'info');
        openTrashModal();
      }
    });
  }

  document.getElementById('btn-close-trash-modal').addEventListener('click', () => closeModalWithAnimation(modal));
  document.getElementById('btn-close-trash').addEventListener('click', () => closeModalWithAnimation(modal));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModalWithAnimation(modal); });
}

function saveTasks() {
  if (tasks && tasks.length > 0) {
    localStorage.setItem('todoTasks_backup', JSON.stringify(tasks));
  }
  if (groups && groups.length > 0) {
    localStorage.setItem('todoGroups_backup', JSON.stringify(groups));
  }

  localStorage.setItem('todoTasks', JSON.stringify(tasks));
  localStorage.setItem('todoGroups', JSON.stringify(groups));
  localStorage.setItem('lastSaveDate', getCurrentDate());

  debouncedSync();
}

function debouncedSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncTasksToServer();
  }, 600);
}

async function syncTasksToServer() {
  const payload = {
    user: currentUser,
    listTask: tasks.map(t => ({
      id: t.id,
      content: t.text,
      isDone: t.completed,
      isRepeated: t.repeatDaily,
      groupId: t.groupId,
      priority: t.priority,
      tags: t.tags
    })),
    groups: groups
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      console.error('Failed to sync tasks to server');
    }
  } catch (error) {
    console.error('Error syncing tasks to server:', error);
  }
}

async function fetchTasksFromServer() {
  try {
    if (!currentUser) currentUser = 'rin';
    if (tasks && tasks.length > 0) {
      localStorage.setItem('todoTasks_backup', JSON.stringify(tasks));
    }
    if (groups && groups.length > 0) {
      localStorage.setItem('todoGroups_backup', JSON.stringify(groups));
    }

    const response = await fetch(`${API_URL}/${currentUser}`);
    if (response.ok) {
      const data = await response.json();

      if (data.listTask && Array.isArray(data.listTask)) {
        if (data.listTask.length > 0) {
          const serverTasks = data.listTask.map((task, idx) => ({
            id: task.id || 'task-' + idx + '-' + Date.now(),
            text: task.content,
            completed: task.isDone,
            repeatDaily: task.isRepeated,
            groupId: task.groupId || DEFAULT_GROUPS[0].id,
            priority: task.priority || 'medium',
            tags: task.tags || []
          }));

          // Use server tasks directly as ground truth
          tasks = serverTasks;

          if (data.groups && Array.isArray(data.groups) && data.groups.length > 0) {
            groups = data.groups.map(g => ({
              id: g.id,
              name: g.name,
              theme: g.theme || 'purple'
            }));
          }

          localStorage.setItem('todoTasks', JSON.stringify(tasks));
          localStorage.setItem('todoGroups', JSON.stringify(groups));
          localStorage.setItem('lastSaveDate', getCurrentDate());

          if (!standaloneGroupId) {
            renderGroupsAndTasks();
          }
        } else if (tasks.length > 0) {
          // If server returned empty list BUT local tasks exist, push local tasks to server!
          syncTasksToServer();
        }
      }
    }
  } catch (error) {
    console.error('Error fetching tasks from server:', error);
  }
}

function loadTasks() {
  loadTrash();
  localStorage.removeItem('todoDeletedTaskIds');
  const savedTasks = localStorage.getItem('todoTasks');
  const savedGroups = localStorage.getItem('todoGroups');
  const lastSaveDate = localStorage.getItem('lastSaveDate');
  const currentDate = getCurrentDate();

  if (savedGroups) {
    try { groups = JSON.parse(savedGroups); } catch (e) {}
  }
  if (!groups || groups.length === 0) groups = DEFAULT_GROUPS;

  if (savedTasks) {
    try {
      tasks = JSON.parse(savedTasks);
      const isNewDay = lastSaveDate !== currentDate;

      if (isNewDay) {
        tasks.forEach(t => {
          if (t.repeatDaily) t.completed = false;
        });
        localStorage.setItem('lastSaveDate', currentDate);
        saveTasks();
      }
    } catch (e) {
      tasks = DEFAULT_TASKS;
    }
  } else {
    tasks = DEFAULT_TASKS;
    saveTasks();
  }

  if (!tasks || tasks.length === 0) {
    tasks = DEFAULT_TASKS;
  }

  if (!standaloneGroupId) {
    renderGroupsAndTasks();
  }
}

function getCurrentDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function checkMidnightReset() {
  const lastSaveDate = localStorage.getItem('lastSaveDate');
  const currentDate = getCurrentDate();
  if (lastSaveDate && lastSaveDate !== currentDate) {
    let resetCount = 0;
    tasks.forEach(t => {
      if (t.repeatDaily && t.completed) {
        t.completed = false;
        resetCount++;
      }
    });
    if (resetCount > 0) {
      saveTasks();
      renderGroupsAndTasks();
      showToast(`🌅 Đã tự động reset ${resetCount} công việc lặp lại hàng ngày!`, 'info');
    }
    localStorage.setItem('lastSaveDate', currentDate);
  }
}

// Periodically check for midnight 0h reset every 60 seconds
setInterval(checkMidnightReset, 60000);
