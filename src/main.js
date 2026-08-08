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
let currentUser = localStorage.getItem('todoUsername');

const DEFAULT_GROUPS = [
  { id: 'group-1', name: 'My awesome app', theme: 'purple' },
  { id: 'group-2', name: 'Home', theme: 'blue' }
];

let groups = JSON.parse(localStorage.getItem('todoGroups') || 'null') || DEFAULT_GROUPS;
let tasks = [];
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
    const username = usernameInput.value.trim();
    if (username === '') {
      usernameInput.classList.add('error');
      loginWarning.textContent = 'Vui lòng nhập tên người dùng hợp lệ!';
      setTimeout(() => usernameInput.classList.remove('error'), 500);
      return;
    }

    currentUser = username;
    localStorage.setItem('todoUsername', username);

    loginBtn.disabled = true;
    loginBtn.textContent = 'Đang tải...';

    await fetchTasksFromServer();
    showTodoApp();
    showToast(`Xin chào, ${username}!`, 'success');
  };

  loginBtn.addEventListener('click', handleLogin);
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  usernameInput.addEventListener('input', () => {
    loginWarning.textContent = '';
  });
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
  
  document.getElementById('btn-open-add-task').addEventListener('click', () => openTaskModal());
  document.getElementById('btn-open-add-group').addEventListener('click', () => openGroupModal());

  loadTasks();
  applySavedSettings();

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

  const tagsHTML = (task.tags || []).map(tag => `<span class="task-pill">${escapeHTML(tag)}</span>`).join('');

  li.innerHTML = `
    <input type="checkbox" class="task-checkbox-custom" ${task.completed ? 'checked' : ''} aria-label="Mark task completed">
    <div class="task-content-block">
      <span class="task-title">${safeText}</span>
      <div class="priority-dot ${priorityClass}" title="Độ ưu tiên: ${priorityClass}"></div>
    </div>
    ${tagsHTML ? `<div class="task-tags-row">${tagsHTML}</div>` : ''}
    <div class="task-actions">
      <button class="btn-card-action btn-edit-task" title="Sửa">
        <i data-lucide="pencil" class="icon-indigo"></i>
      </button>
      <button class="btn-card-action btn-delete-task" title="Xóa">
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

  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();

    // 1. Show loading state on card
    li.classList.add('is-deleting');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<i data-lucide="refresh-cw" class="icon-rose spinning"></i>';
    renderLucideIcons();

    try {
      // 2. Call backend DELETE API
      if (currentUser && task.id) {
        await fetch(`${API_URL}/${currentUser}/task/${task.id}`, { method: 'DELETE' });
      }

      // 3. Remove locally after backend confirmation
      tasks = tasks.filter(t => t.id !== task.id);
      saveTasks();

      // 4. Animate remove card from DOM
      li.style.transform = 'scale(0.9)';
      li.style.opacity = '0';
      setTimeout(() => {
        if (standaloneGroupId) {
          renderStandaloneGroupTasks(standaloneGroupId);
        } else {
          renderGroupsAndTasks();
        }
        showToast('Đã xóa công việc', 'info');
      }, 180);
    } catch (err) {
      console.error('Error deleting task on server:', err);
      // Rollback state on failure
      li.classList.remove('is-deleting');
      deleteBtn.disabled = false;
      deleteBtn.innerHTML = '<i data-lucide="trash-2" class="icon-rose"></i>';
      renderLucideIcons();
      showToast('Lỗi khi xóa công việc', 'error');
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

    if (isEdit) {
      existingTask.text = text;
      existingTask.groupId = groupSelect.value;
      existingTask.priority = currentPriority;
      existingTask.tags = tags;
    } else {
      tasks.push({
        id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        text,
        groupId: groupSelect.value,
        completed: false,
        repeatDaily: false,
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
    modal.remove();
  };

  saveBtn.addEventListener('click', handleSave);
  titleInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSave(); });
  cancelBtn.addEventListener('click', () => modal.remove());
  closeBtn.addEventListener('click', () => modal.remove());
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
    modal.remove();
  };

  saveBtn.addEventListener('click', handleSave);
  nameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSave(); });
  document.getElementById('btn-cancel-gmodal').addEventListener('click', () => modal.remove());
  document.getElementById('btn-close-gmodal').addEventListener('click', () => modal.remove());
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

          // Smart Merge: Merge server tasks with local tasks by ID
          const mergedTasks = [...serverTasks];
          tasks.forEach(localTask => {
            if (!mergedTasks.some(st => st.id === localTask.id)) {
              mergedTasks.push(localTask);
            }
          });
          tasks = mergedTasks;

          if (data.groups && Array.isArray(data.groups) && data.groups.length > 0) {
            const mergedGroups = [...data.groups];
            groups.forEach(localGroup => {
              if (!mergedGroups.some(sg => sg.id === localGroup.id)) {
                mergedGroups.push(localGroup);
              }
            });
            groups = mergedGroups;
          }

          localStorage.setItem('todoTasks', JSON.stringify(tasks));
          localStorage.setItem('todoGroups', JSON.stringify(groups));
          localStorage.setItem('lastSaveDate', getCurrentDate());
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
      tasks = [];
    }
  } else {
    // Sample tasks matching uploaded reference image
    tasks = [
      { id: 't1', text: 'Move drafts in Figma', groupId: groups[0]?.id || 'group-1', completed: false, priority: 'high', tags: ['admin', 'low-energy', 'quick'] },
      { id: 't2', text: 'Create a first draft for pricing', groupId: groups[0]?.id || 'group-1', completed: false, priority: 'medium', tags: ['design', 'personal', '2h'] },
      { id: 't3', text: 'Check a letter from a test user', groupId: groups[0]?.id || 'group-1', completed: false, priority: 'medium', tags: [] },
      { id: 't4', text: 'Buy tablets for dishwasher', groupId: groups[1]?.id || 'group-2', completed: false, priority: 'medium', tags: [] },
      { id: 't5', text: 'Clean up windows', groupId: groups[1]?.id || 'group-2', completed: false, priority: 'low', tags: ['frog', '3h'] },
      { id: 't6', text: 'Groceries', groupId: groups[1]?.id || 'group-2', completed: false, priority: 'low', tags: [] },
      { id: 't7', text: 'Replace battery in clock (kitchen)', groupId: groups[1]?.id || 'group-2', completed: false, priority: 'low', tags: [] }
    ];
    saveTasks();
  }

  if (!standaloneGroupId) {
    renderGroupsAndTasks();
  }
}

function getCurrentDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
