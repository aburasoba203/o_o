(() => {
  const TODO_STORAGE_KEY = "todoItems";
  const MAX_TEXT_LENGTH = 120;

  function parseArray(raw) {
    try {
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function normalizeTodoItem(item) {
    const text = String(item?.text || "").trim();
    if (!text) return null;
    return {
      id: String(item?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      text: text.slice(0, MAX_TEXT_LENGTH),
      dueDate: String(item?.dueDate || "").trim(),
      done: Boolean(item?.done),
      createdAt: Number.isFinite(item?.createdAt) ? item.createdAt : Date.now()
    };
  }

  function loadItems() {
    return parseArray(localStorage.getItem(TODO_STORAGE_KEY))
      .map(normalizeTodoItem)
      .filter(Boolean);
  }

  let todoItems = loadItems();

  function saveItems() {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todoItems));
    window.dispatchEvent(new Event("todo:changed"));
  }

  function getPendingCount() {
    return getVisibleTodoItems().filter(item => !item.done).length;
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function hasBlockingPopup() {
    const selectors = [
      ".calendar-modal-overlay",
      ".welcome-popup-overlay",
      ".word-import-overlay",
      ".help-modal-overlay",
      ".decor-palette-overlay",
      "#helpModalOverlay",
      "#wordImportModal",
      "#customWordsModal",
      "#patchNoticeOverlay",
      "#timerQuickMenuOverlay",
      "#todoWidgetOverlay"
    ];
    return selectors.some(selector => {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        if (isVisible(node)) return true;
      }
      return false;
    });
  }

  function ensureFab() {
    let fab = document.getElementById("todoFab");
    if (fab) return fab;

    fab = document.createElement("button");
    fab.id = "todoFab";
    fab.type = "button";
    fab.className = "todo-fab";
    fab.innerHTML = `
      <span class="todo-fab-label">TO-DO</span>
      <span id="todoFabCount" class="todo-fab-count">0</span>
    `;
    fab.addEventListener("click", openTodoOverlay);
    document.body.appendChild(fab);
    return fab;
  }

  function updateFabVisibility() {
    const fab = ensureFab();
    const count = getPendingCount();
    const countEl = document.getElementById("todoFabCount");
    if (countEl) countEl.textContent = count > 99 ? "99+" : String(count);
    fab.hidden = count === 0 || hasBlockingPopup();
  }

  function sortItems(items) {
    return [...items].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return b.createdAt - a.createdAt;
    });
  }

  function getTodayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function isDueTodayOrPast(dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate || ""))) return false;
    return String(dueDate) <= getTodayKey();
  }

  function isPastDue(dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate || ""))) return false;
    return String(dueDate) < getTodayKey();
  }

  function getVisibleTodoItems() {
    return todoItems.filter(item => !isPastDue(item?.dueDate));
  }

  function formatDueDateMMDD(dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate || ""))) return "--/--";
    return String(dueDate).slice(5).replace("-", "/");
  }

  function closeTodoOverlay() {
    document.getElementById("todoWidgetOverlay")?.remove();
    updateFabVisibility();
  }

  function renderTodoList(listEl) {
    if (!listEl) return;
    listEl.innerHTML = "";
    const items = sortItems(getVisibleTodoItems());
    const MIN_NOTE_LINES = 8;

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "todo-empty";
      empty.textContent = "TO-DO가 없습니다.";
      listEl.appendChild(empty);
    }

    items.forEach(item => {
      const row = document.createElement("div");
      const dueSoonOrLate = !item.done && isDueTodayOrPast(item.dueDate);
      row.className = `todo-item${item.done ? " done" : ""}${dueSoonOrLate ? " is-due-alert" : ""}`;

      const left = document.createElement("button");
      left.type = "button";
      left.className = "todo-toggle";
      left.classList.toggle("is-done", item.done);
      left.textContent = item.done ? "✓" : "";
      left.setAttribute("aria-label", item.done ? "완료로 표시됨" : "진행 중");
      left.addEventListener("click", () => {
        todoItems = todoItems.map(v => (v.id === item.id ? { ...v, done: !v.done } : v));
        saveItems();
        renderTodoList(listEl);
        updateFabVisibility();
      });

      const textWrap = document.createElement("div");
      textWrap.className = "todo-item-text";
      const displayTitle = dueSoonOrLate ? `‼️${item.text}‼️` : item.text;
      textWrap.innerHTML = `
        <div class="todo-item-title">${displayTitle}</div>
      `;

      const dueEl = document.createElement("div");
      dueEl.className = `todo-item-due${dueSoonOrLate ? " due-alert" : ""}`;
      dueEl.textContent = formatDueDateMMDD(item.dueDate);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "todo-delete-btn";
      del.innerHTML = `
        <svg viewBox="0 0 24 24" class="todo-trash-icon" aria-hidden="true" focusable="false">
          <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-2 6h10l-.8 10.5A2 2 0 0 1 14.21 21H9.79a2 2 0 0 1-1.99-1.5L7 9zm3 2v7h2v-7h-2zm4 0v7h2v-7h-2z"/>
        </svg>
      `;
      del.setAttribute("aria-label", "삭제");
      del.addEventListener("click", () => {
        todoItems = todoItems.filter(v => v.id !== item.id);
        saveItems();
        renderTodoList(listEl);
        updateFabVisibility();
      });

      row.appendChild(left);
      row.appendChild(textWrap);
      row.appendChild(dueEl);
      row.appendChild(del);
      listEl.appendChild(row);
    });

    const fillerCount = Math.max(0, MIN_NOTE_LINES - items.length);
    for (let i = 0; i < fillerCount; i++) {
      const filler = document.createElement("div");
      filler.className = "todo-filler-line";
      filler.setAttribute("aria-hidden", "true");
      listEl.appendChild(filler);
    }
  }

  function openTodoOverlay() {
    if (document.getElementById("todoWidgetOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "todoWidgetOverlay";
    overlay.className = "calendar-modal-overlay";
    overlay.innerHTML = `
      <div class="calendar-modal todo-widget-modal" role="dialog" aria-modal="true" aria-label="TO-DO">
        <button type="button" class="todo-widget-close-btn" id="todoWidgetCloseBtn" aria-label="닫기">×</button>
        <p class="calendar-modal-title todo-widget-title">To-Do List</p>
        <div class="todo-list-head">
          <span></span>
          <span></span>
          <span class="todo-list-head-date">due-date</span>
          <span></span>
        </div>
        <div id="todoWidgetList" class="todo-list"></div>
      </div>
    `;

    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeTodoOverlay();
    });

    overlay.querySelector("#todoWidgetCloseBtn")?.addEventListener("click", closeTodoOverlay);
    document.body.appendChild(overlay);
    renderTodoList(overlay.querySelector("#todoWidgetList"));
    updateFabVisibility();
  }

  function addTodoItem(payload) {
    const input = typeof payload === "string" ? { text: payload } : (payload || {});
    const normalized = normalizeTodoItem({
      text: String(input.text || "").trim(),
      dueDate: String(input.dueDate || "").trim(),
      done: false,
      createdAt: Date.now()
    });
    if (!normalized) return false;
    todoItems.unshift(normalized);
    saveItems();
    updateFabVisibility();
    return true;
  }

  window.addTodoItem = addTodoItem;
  window.openTodoOverlay = openTodoOverlay;

  document.addEventListener("DOMContentLoaded", () => {
    ensureFab();
    updateFabVisibility();

    window.addEventListener("storage", event => {
      if (event.key === TODO_STORAGE_KEY) {
        todoItems = loadItems();
        updateFabVisibility();
      }
    });

    window.addEventListener("todo:changed", updateFabVisibility);
    window.addEventListener("resize", updateFabVisibility);
    window.addEventListener("orientationchange", updateFabVisibility);
    document.addEventListener("click", () => {
      setTimeout(updateFabVisibility, 0);
    });
    document.addEventListener("keydown", () => {
      setTimeout(updateFabVisibility, 0);
    });
    window.setInterval(updateFabVisibility, 800);
  });
})();
