import './style.css'

// Detect environment and apply class to both html and body
const isElectron = typeof window.require !== 'undefined';
const className = isElectron ? 'is-electron' : 'is-web';
document.documentElement.classList.add(className);
document.body.classList.add(className);

// Register Service Worker for PWA (only in web mode)
if ('serviceWorker' in navigator && !isElectron) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('ServiceWorker registered:', registration);
      })
      .catch((error) => {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}

// API endpoint
const API_URL = 'https://k4w411-t0d0-be.vercel.app';
let currentUser = localStorage.getItem('todoUsername');

// Kiểm tra xem đã có user chưa
if (!currentUser) {
  showLoginScreen();
} else {
  showTodoApp();
}

function showLoginScreen() {
  document.querySelector('#app').innerHTML = `
    <div class="login-screen">
      <div class="title-bar">
        <button id="close-btn">×</button>
      </div>
      <h1><iconify-icon icon="fluent-emoji:rabbit-face" class="wow-icon"></iconify-icon> Welcome! <iconify-icon icon="fluent-emoji:bear" class="wow-icon"></iconify-icon></h1>
      <div class="login-form">
        <input type="text" id="username-input" placeholder="Enter your username..." />
        <button id="login-btn">Start</button>
      </div>
    </div>
  `;

  setupCloseButton();

  const usernameInput = document.getElementById('username-input');
  const loginBtn = document.getElementById('login-btn');

  const handleLogin = async () => {
    const username = usernameInput.value.trim();
    if (username === '') {
      alert('Please enter a username!');
      return;
    }

    currentUser = username;
    localStorage.setItem('todoUsername', username);

    // Fetch tasks from server
    await fetchTasksFromServer();

    showTodoApp();
  };

  loginBtn.addEventListener('click', handleLogin);
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
}

function showTodoApp() {
  document.querySelector('#app').innerHTML = `
    <div class="todo-app">
      <div class="title-bar">
          <button id="logout-btn" title="Change user">👤</button>
          <button id="refresh-btn" title="Refresh">🔄</button>
          <button id="close-btn">×</button>
        </div>
      <h1><iconify-icon icon="fluent-emoji:rabbit-face" class="wow-icon"></iconify-icon> ${currentUser}'s Todo <iconify-icon icon="fluent-emoji:bear" class="wow-icon"></iconify-icon></h1>
      <div class="add-task">
        <input type="text" id="task-input" placeholder="Add a new task..." />
        <label class="repeat-checkbox-label">
          <input type="checkbox" id="repeat-daily-checkbox" />
          <span>REPEAT</span>
        </label>
        <button id="add-btn">Add</button>
      </div>
      <ul id="task-list"></ul>
    </div>
  `;

  setupCloseButton();
  setupLogoutButton();
  setupRefreshButton();
  initializeTodoApp();
}


function setupCloseButton() {
  const closeBtn = document.getElementById('close-btn');
  if (typeof window.require !== 'undefined') {
    const { ipcRenderer } = window.require('electron');
    closeBtn.addEventListener('click', () => {
      ipcRenderer.send('close-app');
    });
  } else {
    closeBtn.style.display = 'none';
  }
}

function setupLogoutButton() {
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn.addEventListener('click', () => {
    if (confirm('Do you want to change user?')) {
      currentUser = null;
      localStorage.removeItem('todoUsername');
      showLoginScreen();
    }
  });
}

function setupRefreshButton() {
  const refreshBtn = document.getElementById('refresh-btn');
  if (!refreshBtn) return;

  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '⏳';
    try {
      await fetchTasksFromServer();
      // Clear current list and reload from localStorage
      reloadTaskList();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = '🔄';
    }
  });
}

function reloadTaskList() {
  const taskList = document.getElementById('task-list');
  if (!taskList) return;
  // Clear existing DOM items
  taskList.innerHTML = '';
  // Reload from localStorage
  loadTasks();
}

async function fetchTasksFromServer() {
  try {
    const response = await fetch(`${API_URL}/${currentUser}`);
    if (response.ok) {
      const data = await response.json();
      if (data.listTask && Array.isArray(data.listTask)) {
        // Lưu tasks vào localStorage
        const tasks = data.listTask.map(task => ({
          text: task.content,
          completed: task.isDone,
          repeatDaily: task.isRepeated
        }));
        localStorage.setItem('todoTasks', JSON.stringify(tasks));
        localStorage.setItem('lastSaveDate', getCurrentDate());
      }
    }
  } catch (error) {
    console.error('Error fetching tasks from server:', error);
  }
}

async function syncTasksToServer() {
  const tasks = [];
  const taskItems = document.querySelectorAll('#task-list li');

  taskItems.forEach(li => {
    const taskText = li.querySelector('.task-text')?.textContent || '';
    const isCompleted = li.querySelector('.task-checkbox')?.checked || false;
    const isRepeatDaily = li.dataset.repeatDaily === 'true';

    tasks.push({
      content: taskText,
      isDone: isCompleted,
      isRepeated: isRepeatDaily
    });
  });

  const payload = {
    user: currentUser,
    listTask: tasks
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Failed to sync tasks to server');
    }
  } catch (error) {
    console.error('Error syncing tasks to server:', error);
  }
}

function initializeTodoApp() {
  const taskInput = document.getElementById('task-input');
  const addBtn = document.getElementById('add-btn');
  const repeatDailyCheckbox = document.getElementById('repeat-daily-checkbox');

  // Load tasks from localStorage when app starts
  loadTasks();

  addBtn.addEventListener('click', () => addTask());
  taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
  });
}

function addTask(taskText = null, isRepeatDaily = null, isCompleted = false, shouldSave = true) {
  const taskInput = document.getElementById('task-input');
  const repeatDailyCheckbox = document.getElementById('repeat-daily-checkbox');
  const taskList = document.getElementById('task-list');

  // Nếu không truyền tham số, lấy từ input
  if (taskText === null) {
    taskText = taskInput.value.trim();
    if (taskText === '') return;
    isRepeatDaily = repeatDailyCheckbox.checked;
  }

  const li = document.createElement('li');
  li.innerHTML = `
    <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''}>
    <span class="task-text">${taskText}</span>
    ${isRepeatDaily ? '<iconify-icon icon="fluent-emoji:repeat-button" class="repeat-icon" title="Lặp lại hàng ngày"></iconify-icon>' : ''}
    <button class="edit-btn"><iconify-icon icon="mingcute:edit-line"></iconify-icon></button>
    <button class="delete-btn"><iconify-icon icon="iconoir:trash"></iconify-icon></button>
  `;

  if (isRepeatDaily) {
    li.dataset.repeatDaily = 'true';
  }

  if (isCompleted) {
    li.classList.add('completed');
  }

  taskList.appendChild(li);

  // Clear input chỉ khi thêm task mới từ UI
  if (shouldSave) {
    taskInput.value = '';
    repeatDailyCheckbox.checked = false;
  }

  const checkbox = li.querySelector('.task-checkbox');
  const editBtn = li.querySelector('.edit-btn');
  const deleteBtn = li.querySelector('.delete-btn');

  checkbox.addEventListener('change', () => {
    li.classList.toggle('completed');
    saveTasks();
  });

  editBtn.addEventListener('click', () => {
    const taskTextSpan = li.querySelector('.task-text');
    const existingInput = li.querySelector('.edit-input');

    if (existingInput) return;
    if (!taskTextSpan) return;

    const currentText = taskTextSpan.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'edit-input';

    taskTextSpan.replaceWith(input);
    input.focus();

    const saveEdit = () => {
      const newText = input.value.trim();
      const newSpan = document.createElement('span');
      newSpan.className = 'task-text';
      newSpan.textContent = newText !== '' ? newText : currentText;
      input.replaceWith(newSpan);
      saveTasks();
    };

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveEdit();
      }
    });
  });

  deleteBtn.addEventListener('click', () => {
    li.remove();
    saveTasks();
  });

  // Lưu task nếu shouldSave = true (tức là task mới từ UI)
  if (shouldSave) {
    saveTasks();
  }
}

function saveTasks() {
  const taskList = document.getElementById('task-list');
  const tasks = [];
  const taskItems = taskList.querySelectorAll('li');

  taskItems.forEach(li => {
    const taskText = li.querySelector('.task-text')?.textContent || '';
    const isCompleted = li.querySelector('.task-checkbox')?.checked || false;
    const isRepeatDaily = li.dataset.repeatDaily === 'true';

    tasks.push({
      text: taskText,
      completed: isCompleted,
      repeatDaily: isRepeatDaily
    });
  });

  localStorage.setItem('todoTasks', JSON.stringify(tasks));
  localStorage.setItem('lastSaveDate', getCurrentDate());

  // Sync to server
  syncTasksToServer();
}

function loadTasks() {
  const savedTasks = localStorage.getItem('todoTasks');
  const lastSaveDate = localStorage.getItem('lastSaveDate');
  const currentDate = getCurrentDate();

  if (!savedTasks) return;

  try {
    const tasks = JSON.parse(savedTasks);
    const isNewDay = lastSaveDate !== currentDate;

    tasks.forEach(task => {
      // Nếu là ngày mới và task lặp lại hàng ngày, reset trạng thái completed
      const shouldResetCompleted = isNewDay && task.repeatDaily;
      const isCompleted = shouldResetCompleted ? false : task.completed;

      // shouldSave = false vì đang load, không phải thêm mới
      addTask(task.text, task.repeatDaily, isCompleted, false);
    });

    // Nếu là ngày mới, cập nhật lại lastSaveDate và lưu lại tasks với trạng thái mới
    if (isNewDay) {
      localStorage.setItem('lastSaveDate', currentDate);
      saveTasks();
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}

function getCurrentDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
