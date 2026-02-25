cat > app.js <<'EOF'
// --- Storage ---
const KEY = "pretty_todo_tasks_v1";

function loadTasks() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? []; }
  catch { return []; }
}
function saveTasks(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

// --- State ---
let tasks = loadTasks();
let filter = "all"; // all | active | completed
let q = "";         // search query

// --- Elements ---
const listEl = document.getElementById("list");
const inputEl = document.getElementById("newTaskInput");
const addBtn = document.getElementById("addBtn");
const tabs = document.querySelectorAll(".tab");
const searchEl = document.getElementById("searchInput");
const clearCompletedBtn = document.getElementById("clearCompletedBtn");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const linkGitHub = document.getElementById("githubLink");

const countAll = document.getElementById("countAll");
const countActive = document.getElementById("countActive");
const countDone = document.getElementById("countDone");

// Ustaw link do repo (podmień USERNAME i REPO)
linkGitHub.href = `https://github.com/${'${GH_USER:-USERNAME}'}/${'${REPO:-todo-pretty}'}`;

// --- Helpers ---
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function filtered() {
  let arr = [...tasks];
  if (filter === "active") arr = arr.filter(t => !t.done);
  if (filter === "completed") arr = arr.filter(t => t.done);
  if (q.trim()) {
    const qq = q.trim().toLowerCase();
    arr = arr.filter(t => t.text.toLowerCase().includes(qq));
  }
  return arr;
}

function updateCounters() {
  const all = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const active = all - done;
  countAll.textContent = `All: ${all}`;
  countActive.textContent = `Active: ${active}`;
  countDone.textContent = `Done: ${done}`;
}

function render() {
  listEl.innerHTML = "";
  updateCounters();
  const data = filtered();

  if (data.length === 0) {
    const empty = document.createElement("div");
    empty.style.color = "#8ea0cf";
    empty.style.textAlign = "center";
    empty.style.padding = "14px";
    empty.textContent = "No tasks found.";
    listEl.appendChild(empty);
    return;
  }

  for (const t of data) {
    const li = document.createElement("li");
    li.className = "item";
    li.draggable = true;
    li.dataset.id = t.id;

    const checkbox = document.createElement("button");
    checkbox.className = "checkbox" + (t.done ? " done" : "");
    checkbox.title = t.done ? "Mark as active" : "Mark as done";
    checkbox.textContent = t.done ? "✓" : "";
    checkbox.onclick = () => {
      t.done = !t.done; saveTasks(tasks); render();
    };

    const text = document.createElement("div");
    text.className = "text" + (t.done ? " done" : "");
    text.textContent = t.text;
    text.title = "Double‑click to edit";
    text.ondblclick = () => startInlineEdit(text, t);

    const actions = document.createElement("div");
    actions.className = "actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.title = "Edit";
    editBtn.innerHTML = `<span class="icon">✎</span>`;
    editBtn.onclick = () => startInlineEdit(text, t);

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.title = "Delete";
    delBtn.innerHTML = `<span class="icon">🗑</span>`;
    delBtn.onclick = () => { tasks = tasks.filter(x => x.id !== t.id); saveTasks(tasks); render(); };

    actions.append(editBtn, delBtn);
    li.append(checkbox, text, actions);

    // Drag & Drop
    li.addEventListener("dragstart", (e) => {
      li.classList.add("dragging");
      e.dataTransfer.setData("text/plain", t.id);
    });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));

    listEl.appendChild(li);
  }
}

function startInlineEdit(textEl, task) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = task.text;
  input.className = "input";
  textEl.replaceWith(input);
  input.focus();
  input.onblur = finish;
  input.onkeydown = (e) => {
    if (e.key === "Enter") finish();
    if (e.key === "Escape") { input.value = task.text; finish(); }
  };
  function finish() {
    const newText = input.value.trim();
    if (newText) task.text = newText;
    saveTasks(tasks);
    render();
  }
}

// DnD container
listEl.addEventListener("dragover", (e) => {
  e.preventDefault();
  const dragging = document.querySelector(".item.dragging");
  const afterEl = getDragAfterElement(listEl, e.clientY);
  if (!dragging) return;
  if (afterEl == null) listEl.appendChild(dragging);
  else listEl.insertBefore(dragging, afterEl);
});

listEl.addEventListener("drop", () => {
  // Zapisz nową kolejność wg DOM
  const ids = [...listEl.querySelectorAll(".item")].map(li => li.dataset.id);
  tasks.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  saveTasks(tasks);
});

function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll(".item:not(.dragging)")];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - (box.top + box.height/2);
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    else return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// --- Events ---
const addBtnEl = document.getElementById("addBtn");
addBtnEl.onclick = () => {
  const val = inputEl.value.trim();
  if (!val) return;
  tasks.push({ id: uid(), text: val, done: false });
  inputEl.value = "";
  saveTasks(tasks);
  render();
};

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addBtnEl.click();
});

const tabsEls = document.querySelectorAll(".tab");
tabsEls.forEach(btn => {
  btn.onclick = () => {
    tabsEls.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    filter = btn.dataset.filter;
    render();
  };
});

const searchEl2 = document.getElementById("searchInput");
searchEl2.oninput = () => {
  q = searchEl2.value || "";
  render();
};

clearCompletedBtn.onclick = () => {
  tasks = tasks.filter(t => !t.done);
  saveTasks(tasks); render();
};

exportBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "tasks.json"; a.click();
  URL.revokeObjectURL(url);
};

importFile.onchange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("Invalid JSON");
    const map = new Map(tasks.map(t => [t.id, t]));
    for (const t of data) {
      if (t && typeof t.text === "string") map.set(t.id ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
        { id: t.id ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2), text: t.text, done: !!t.done });
    }
    tasks = [...map.values()];
    saveTasks(tasks); render();
  } catch {
    alert("Import failed: invalid JSON file.");
  } finally {
    e.target.value = "";
  }
};

// Start
render();
EOF
