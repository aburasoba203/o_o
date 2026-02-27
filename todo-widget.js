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
    return todoItems.filter(item => !item.done).length;
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

  function closeTodoOverlay() {
    document.getElementById("todoWidgetOverlay")?.remove();
    updateFabVisibility();
  }

  function renderTodoList(listEl) {
    if (!listEl) return;
    listEl.innerHTML = "";
    const items = sortItems(todoItems);

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "todo-empty";
      empty.textContent = "TO-DO가 없습니다.";
      listEl.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const row = document.createElement("div");
      row.className = `todo-item${item.done ? " done" : ""}`;

      const left = document.createElement("button");
      left.type = "button";
      left.className = "todo-toggle";
      left.textContent = item.done ? "완료" : "진행";
      left.addEventListener("click", () => {
        todoItems = todoItems.map(v => (v.id === item.id ? { ...v, done: !v.done } : v));
        saveItems();
        renderTodoList(listEl);
        updateFabVisibility();
      });

      const textWrap = document.createElement("div");
      textWrap.className = "todo-item-text";
      textWrap.innerHTML = `
        <div class="todo-item-title">${item.text}</div>
        <div class="todo-item-meta">${item.dueDate ? `기한 ${item.dueDate}` : "기한 없음"}</div>
      `;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "small-btn";
      del.textContent = "삭제";
      del.addEventListener("click", () => {
        todoItems = todoItems.filter(v => v.id !== item.id);
        saveItems();
        renderTodoList(listEl);
        updateFabVisibility();
      });

      row.appendChild(left);
      row.appendChild(textWrap);
      row.appendChild(del);
      listEl.appendChild(row);
    });
  }

  function openTodoOverlay() {
    if (document.getElementById("todoWidgetOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "todoWidgetOverlay";
    overlay.className = "calendar-modal-overlay";
    overlay.innerHTML = `
      <div class="calendar-modal todo-widget-modal" role="dialog" aria-modal="true" aria-label="TO-DO">
        <p class="calendar-modal-title">TO-DO</p>
        <div id="todoWidgetList" class="todo-list"></div>
        <div class="calendar-modal-actions">
          <button type="button" class="small-btn" id="todoWidgetCloseBtn">닫기</button>
        </div>
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
