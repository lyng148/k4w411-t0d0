import './style.css'

document.querySelector('#app').innerHTML = `
  <div class="todo-app">
    <div class="title-bar">
      <button id="close-btn">×</button>
    </div>
    <h1><iconify-icon icon="fluent-emoji:rabbit-face" class="wow-icon"></iconify-icon> Todo List <iconify-icon icon="fluent-emoji:bear" class="wow-icon"></iconify-icon></h1>
    <div class="add-task">
      <input type="text" id="task-input" placeholder="Add a new task..." />
      <label class="repeat-checkbox-label">
        <input type="checkbox" id="repeat-daily-checkbox" />
        <span>Lặp lại hàng ngày</span>
      </label>
      <button id="add-btn">Add</button>
    </div>
    <ul id="task-list"></ul>
  </div>
`

// Close button functionality
const closeBtn = document.getElementById('close-btn');
if (typeof window.require !== 'undefined') {
  const { ipcRenderer } = window.require('electron');
  closeBtn.addEventListener('click', () => {
    ipcRenderer.send('close-app');
  });
} else {
  closeBtn.style.display = 'none'; // Hide if not in Electron
}

const taskInput = document.getElementById('task-input');
const addBtn = document.getElementById('add-btn');
const taskList = document.getElementById('task-list');
const repeatDailyCheckbox = document.getElementById('repeat-daily-checkbox');

// Load tasks from localStorage when app starts
loadTasks();

addBtn.addEventListener('click', () => addTask());
taskInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addTask();
});

function addTask(taskText = null, isRepeatDaily = null, isCompleted = false, shouldSave = true) {
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
    <button class="edit-btn"><iconify-icon icon="mingcute:edit-line" style="color: #9b87f5;"></iconify-icon></button>
    <button class="delete-btn"><iconify-icon icon="iconoir:trash" style="color: #ff69b4;"></iconify-icon></button>
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
    saveTasks(); // Lưu khi thay đổi trạng thái
  });

  editBtn.addEventListener('click', () => {
    // Tìm lại task-text hoặc edit-input mỗi lần click
    const taskTextSpan = li.querySelector('.task-text');
    const existingInput = li.querySelector('.edit-input');

    // Nếu đang edit rồi thì không làm gì
    if (existingInput) return;

    // Nếu không tìm thấy task-text thì return
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
      saveTasks(); // Lưu sau khi sửa
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
    saveTasks(); // Lưu sau khi xóa
  });

  // Lưu task nếu shouldSave = true (tức là task mới từ UI)
  if (shouldSave) {
    saveTasks();
  }
}

function saveTasks() {
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
