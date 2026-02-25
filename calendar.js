document.addEventListener("DOMContentLoaded", () => {
  const calendarEl = document.getElementById("calendar");
  const ddaySummaryEl = document.getElementById("ddaySummary");

  let attendance = JSON.parse(localStorage.getItem("attendance")) || {};
  let schedules = JSON.parse(localStorage.getItem("schedule")) || {};
  let exams = JSON.parse(localStorage.getItem("exam")) || {};
  let studyTime = JSON.parse(localStorage.getItem("studyTime")) || {};
  const CALENDAR_VIEW_MODE_KEY = "calendarViewMode";
  const CALENDAR_VIEW_ANCHORS_KEY = "calendarViewAnchors";
  const DECOR_ITEMS_KEY = "calendarDecorItemsByMonth";
  const DOG_IMAGES = Array.from({ length: 18 }, (_, i) => `mydog/dog${i + 1}.png`);
  let decorItemsByMonth = JSON.parse(localStorage.getItem(DECOR_ITEMS_KEY) || "{}");
  let decorItems = [];
  let currentDecorScopeKey = "";
  let decorDragState = null;
  let selectedDecorItemId = null;
  let calendar = null;
  let calendarViewMode = localStorage.getItem(CALENDAR_VIEW_MODE_KEY) === "week" ? "week" : "month";
  let calendarViewAnchors = JSON.parse(localStorage.getItem(CALENDAR_VIEW_ANCHORS_KEY) || "null") || {};

  function toDateOnly(dateString) {
    return new Date(`${dateString}T00:00:00`);
  }

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatMonthKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  function getTodayDateOnly() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function getCurrentCalendarMonthKey() {
    if (calendar) return formatMonthKey(calendar.getDate());
    return formatMonthKey(getTodayDateOnly());
  }

  function getWeekStartDate(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // 0 Sun ~ 6 Sat
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday);
    return d;
  }

  function getCurrentDecorScopeKey() {
    const baseDate = calendar ? calendar.getDate() : getTodayDateOnly();
    if (calendarViewMode === "week") {
      return `week:${formatDateKey(getWeekStartDate(baseDate))}`;
    }
    return `month:${formatMonthKey(baseDate)}`;
  }

  function saveCalendarViewAnchors() {
    localStorage.setItem(CALENDAR_VIEW_ANCHORS_KEY, JSON.stringify(calendarViewAnchors));
  }

  function formatStudyTime(ms) {
    const totalSeconds = Math.floor((ms || 0) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}시간 ${minutes}분`;
    if (minutes > 0) return `${minutes}분`;
    return `${seconds}초`;
  }

  function isValidDateKey(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return false;
    const date = toDateOnly(dateStr);
    return !Number.isNaN(date.getTime()) && formatDateKey(date) === dateStr;
  }

  function enumerateDateKeys(startDateStr, endDateStr) {
    const start = toDateOnly(startDateStr);
    const end = toDateOnly(endDateStr);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

    const from = start <= end ? start : end;
    const to = start <= end ? end : start;
    const result = [];
    const cursor = new Date(from);

    while (cursor <= to) {
      result.push(formatDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  function buildEvents() {
    const events = [];

    Object.keys(schedules).forEach(date => {
      events.push({
        title: `공부: ${schedules[date]}`,
        start: date,
        backgroundColor: "#4f7cff",
        borderColor: "#4f7cff"
      });
    });

    Object.keys(exams).forEach(date => {
      events.push({
        title: `시험: ${exams[date]}`,
        start: date,
        backgroundColor: "#ff5a5f",
        borderColor: "#ff5a5f"
      });
    });

    Object.keys(studyTime).forEach(date => {
      events.push({
        title: `순공: ${formatStudyTime(studyTime[date])}`,
        start: date,
        backgroundColor: "#8c7cf0",
        borderColor: "#8c7cf0"
      });
    });

    return events;
  }

  function refreshAttendanceStyles() {
    calendarEl.querySelectorAll(".attended-day").forEach(el => {
      el.classList.remove("attended-day");
    });

    Object.keys(attendance).forEach(dateStr => {
      const cell = calendarEl.querySelector(`[data-date="${dateStr}"]`);
      if (cell) {
        cell.classList.add("attended-day");
      }
    });
  }

  function updateDdaySummary() {
    if (!ddaySummaryEl) return;

    const today = getTodayDateOnly();
    const upcomingExams = Object.entries(exams)
      .map(([date, name]) => ({ date, name, dateObj: toDateOnly(date) }))
      .filter(item => !Number.isNaN(item.dateObj.getTime()) && item.dateObj >= today)
      .sort((a, b) => a.dateObj - b.dateObj);

    if (upcomingExams.length === 0) {
      ddaySummaryEl.innerText = "시험 일정이 없습니디리링.";
      return;
    }

    ddaySummaryEl.innerHTML = upcomingExams
      .slice(0, 5)
      .map(exam => {
        const dayDiff = Math.round((exam.dateObj - today) / (1000 * 60 * 60 * 24));
        const ddayLabel = dayDiff === 0 ? "D-Day" : `D-${dayDiff}`;
        return `<div>${ddayLabel} | ${exam.name} (${exam.date})</div>`;
      })
      .join("");
  }

  function persistAll() {
    localStorage.setItem("attendance", JSON.stringify(attendance));
    localStorage.setItem("schedule", JSON.stringify(schedules));
    localStorage.setItem("exam", JSON.stringify(exams));
    localStorage.setItem("studyTime", JSON.stringify(studyTime));
  }

  function markTodayAttendance() {
    const todayKey = formatDateKey(getTodayDateOnly());
    attendance[todayKey] = true;
    persistAll();
    refreshAttendanceStyles();
  }

  function rerenderEvents() {
    calendar.removeAllEvents();
    buildEvents().forEach(event => calendar.addEvent(event));
    refreshAttendanceStyles();
  }

  function applyCalendarAction(action, dateStr) {
    if (action === "study") {
      const text = prompt("공부 일정 내용을 입력하세요:");
      if (!text || !text.trim()) return;
      schedules[dateStr] = text.trim();
    } else if (action === "study-range") {
      const endDateInput = prompt(
        `종료 날짜를 입력하세요 (YYYY-MM-DD)\n시작 날짜: ${dateStr}`,
        dateStr
      );
      if (!endDateInput) return;

      const endDateStr = endDateInput.trim();
      if (!isValidDateKey(endDateStr)) {
        alert("날짜 형식이 올바르지 않아요. 예: 2026-02-24");
        return;
      }

      const text = prompt("기간에 적용할 공부 일정 내용을 입력하세요:");
      if (!text || !text.trim()) return;

      const rangeDates = enumerateDateKeys(dateStr, endDateStr);
      rangeDates.forEach(key => {
        schedules[key] = text.trim();
      });
    } else if (action === "exam") {
      const text = prompt("시험 이름을 입력하세요:");
      if (!text || !text.trim()) return;
      exams[dateStr] = text.trim();
    } else if (action === "delete") {
      delete schedules[dateStr];
      delete exams[dateStr];
      delete attendance[dateStr];
      delete studyTime[dateStr];
    } else {
      return;
    }

    persistAll();
    updateDdaySummary();
    rerenderEvents();
  }

  function openDateActionModal(dateStr) {
    const overlay = document.createElement("div");
    overlay.className = "calendar-modal-overlay";
    overlay.innerHTML = `
      <div class="calendar-modal" role="dialog" aria-modal="true" aria-label="일정 관리">
        <p class="calendar-modal-title">${dateStr}</p>
        <div class="calendar-modal-actions">
          <button type="button" data-action="study-range">공부 일정 추가</button>
          <button type="button" data-action="exam">시험 일정 추가</button>
          <button type="button" data-action="delete" class="danger">일정/출석/순공 삭제</button>
          <button type="button" data-action="close" class="small-btn">닫기</button>
        </div>
      </div>
    `;

    const closeModal = () => overlay.remove();

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        closeModal();
        return;
      }

      const button = event.target.closest("button[data-action]");
      if (!button) return;

      const action = button.dataset.action;
      if (action === "close") {
        closeModal();
        return;
      }

      closeModal();
      applyCalendarAction(action, dateStr);
    });

    document.body.appendChild(overlay);
  }

  function openTodayAttendancePopupIfNeeded() {
    const todayKey = formatDateKey(getTodayDateOnly());
    if (attendance[todayKey]) return;

    const overlay = document.createElement("div");
    overlay.className = "welcome-popup-overlay";
    overlay.innerHTML = `
      <div class="welcome-popup" role="dialog" aria-modal="true" aria-label="오늘 출석 체크">
        <p class="welcome-popup-message">오늘 출석체크가 아직 안 되어있습니두?! 👀</p>
        <div class="welcome-popup-actions">
          <button type="button" id="calendarAttendanceCheckBtn">출석체크</button>
          <button type="button" id="calendarAttendanceCloseBtn" class="small-btn">닫기</button>
        </div>
      </div>
    `;

    const closePopup = () => overlay.remove();

    overlay.querySelector("#calendarAttendanceCheckBtn").addEventListener("click", () => {
      markTodayAttendance();
      closePopup();
    });

    overlay.querySelector("#calendarAttendanceCloseBtn").addEventListener("click", closePopup);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) closePopup();
    });

    document.body.appendChild(overlay);
  }

  function getCalendarHeight() {
    const reservedHeight = 220; // nav + title + summary + helper text + margins
    return Math.max(380, window.innerHeight - reservedHeight);
  }

  function updateCalendarViewButtons() {
    const monthBtn = document.getElementById("calendarMonthViewBtn");
    const weekBtn = document.getElementById("calendarWeekViewBtn");
    if (!monthBtn || !weekBtn) return;

    monthBtn.classList.toggle("is-active", calendarViewMode === "month");
    weekBtn.classList.toggle("is-active", calendarViewMode === "week");
  }

  function applyCalendarViewMode(mode) {
    if (!calendar) return;
    const previousMode = calendarViewMode;
    calendarViewAnchors[previousMode] = formatDateKey(calendar.getDate());
    saveCalendarViewAnchors();

    calendarViewMode = mode === "week" ? "week" : "month";
    localStorage.setItem(CALENDAR_VIEW_MODE_KEY, calendarViewMode);
    const targetDate = calendarViewAnchors[calendarViewMode] || formatDateKey(getTodayDateOnly());

    if (calendarViewMode === "week") {
      calendar.setOption("hiddenDays", [0, 6]);
      calendar.changeView("dayGridWeek", targetDate);
    } else {
      calendar.setOption("hiddenDays", []);
      calendar.changeView("dayGridMonth", targetDate);
    }

    updateCalendarViewButtons();
    renderDecorItems();
  }

  function setCalendarViewMode(mode) {
    applyCalendarViewMode(mode);
  }

  function saveDecorItems() {
    decorItemsByMonth[currentDecorScopeKey] = decorItems;
    localStorage.setItem(DECOR_ITEMS_KEY, JSON.stringify(decorItemsByMonth));
  }

  function normalizeDecorItems(items) {
    return (Array.isArray(items) ? items : [])
      .map(item => ({
        id: String(item.id || `${Date.now()}-${Math.random()}`),
        src: String(item.src || ""),
        x: Number.isFinite(item.x) ? item.x : 20,
        y: Number.isFinite(item.y) ? item.y : 20,
        size: Number.isFinite(item.size) ? item.size : 56
      }))
      .filter(item => DOG_IMAGES.includes(item.src));
  }

  function migrateLegacyDecorStorageIfNeeded() {
    if (Array.isArray(decorItemsByMonth)) {
      const legacyItems = normalizeDecorItems(decorItemsByMonth);
      decorItemsByMonth = {};
      if (legacyItems.length > 0) {
        decorItemsByMonth[`month:${getCurrentCalendarMonthKey()}`] = legacyItems;
      }
      localStorage.setItem(DECOR_ITEMS_KEY, JSON.stringify(decorItemsByMonth));
      return;
    }

    if (!decorItemsByMonth || typeof decorItemsByMonth !== "object") {
      decorItemsByMonth = {};
    }
  }

  function loadDecorItemsForCurrentMonth() {
    currentDecorScopeKey = getCurrentDecorScopeKey();
    let items = decorItemsByMonth[currentDecorScopeKey];

    if (!items && calendarViewMode === "month") {
      const legacyMonthKey = getCurrentCalendarMonthKey();
      if (Array.isArray(decorItemsByMonth[legacyMonthKey])) {
        items = decorItemsByMonth[legacyMonthKey];
        decorItemsByMonth[currentDecorScopeKey] = normalizeDecorItems(items);
        delete decorItemsByMonth[legacyMonthKey];
        localStorage.setItem(DECOR_ITEMS_KEY, JSON.stringify(decorItemsByMonth));
      }
    }

    decorItems = normalizeDecorItems(items || []);
    if (!decorItems.some(item => item.id === selectedDecorItemId)) {
      selectedDecorItemId = null;
    }
  }

  migrateLegacyDecorStorageIfNeeded();
  loadDecorItemsForCurrentMonth();

  function getCalendarStage() {
    return document.getElementById("calendarStage");
  }

  function getDecorLayer() {
    return document.getElementById("calendarDecorLayer");
  }

  function clampDecorItem(item) {
    const stage = getCalendarStage();
    if (!stage) return item;
    const maxX = Math.max(0, stage.clientWidth - item.size);
    const maxY = Math.max(0, stage.clientHeight - item.size);
    item.x = Math.min(Math.max(0, item.x), maxX);
    item.y = Math.min(Math.max(0, item.y), maxY);
    return item;
  }

  function getSelectedDecorItem() {
    return decorItems.find(item => item.id === selectedDecorItemId) || null;
  }

  function updateDecorSizeStatus() {
    const statusEl = document.getElementById("decorSizeStatus");
    if (!statusEl) return;
    const selected = getSelectedDecorItem();
    statusEl.textContent = selected
      ? `선택됨: ${Math.round(selected.size)}px`
      : "선택한 스티커 없음";
  }

  function renderDecorItems() {
    const layer = getDecorLayer();
    if (!layer) return;
    layer.innerHTML = "";

    decorItems.forEach(item => {
      const sticker = document.createElement("img");
      sticker.className = "calendar-decor-item";
      if (item.id === selectedDecorItemId) {
        sticker.classList.add("is-selected");
      }
      sticker.src = item.src;
      sticker.alt = "";
      sticker.draggable = false;
      sticker.dataset.id = item.id;
      sticker.style.width = `${item.size}px`;
      sticker.style.height = `${item.size}px`;
      sticker.style.left = `${item.x}px`;
      sticker.style.top = `${item.y}px`;
      sticker.addEventListener("pointerdown", startDecorDrag);
      layer.appendChild(sticker);
    });
    updateDecorSizeStatus();
  }

  function addDecorItem(src) {
    const item = clampDecorItem({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      src,
      x: 12 + (decorItems.length % 6) * 14,
      y: 12 + (decorItems.length % 4) * 14,
      size: 56
    });
    decorItems.push(item);
    selectedDecorItemId = item.id;
    saveDecorItems();
    renderDecorItems();
  }

  function renderDecorPalette() {
    const listEl = document.getElementById("decorThumbList");
    if (!listEl) return;
    listEl.innerHTML = "";
    DOG_IMAGES.forEach(src => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "decor-thumb-btn";
      button.title = "클릭해서 배치";
      button.innerHTML = `<img src="${src}" alt="">`;
      button.addEventListener("click", () => addDecorItem(src));
      listEl.appendChild(button);
    });
  }

  function toggleDecorPalette() {
    const palette = document.getElementById("decorPalette");
    if (!palette) return;
    palette.hidden = !palette.hidden;
  }

  function clearDecorItems() {
    if (!confirm("꾸미기를 모두 지우시겠습니끼?")) return;
    decorItems = [];
    selectedDecorItemId = null;
    saveDecorItems();
    renderDecorItems();
  }

  function resizeSelectedDecorItem(delta) {
    const item = getSelectedDecorItem();
    if (!item) {
      alert("크기 조절할 스티커를 먼저 눌러주세요.");
      return;
    }
    item.size = Math.min(120, Math.max(28, item.size + delta));
    clampDecorItem(item);
    saveDecorItems();
    renderDecorItems();
  }

  function startDecorDrag(event) {
    const target = event.currentTarget;
    const itemId = target?.dataset?.id;
    const stage = getCalendarStage();
    if (!itemId || !stage) return;
    const item = decorItems.find(v => v.id === itemId);
    if (!item) return;
    selectedDecorItemId = itemId;

    const rect = stage.getBoundingClientRect();
    decorDragState = {
      id: itemId,
      offsetX: event.clientX - rect.left - item.x,
      offsetY: event.clientY - rect.top - item.y
    };
    target.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    renderDecorItems();
  }

  function handleDecorPointerMove(event) {
    if (!decorDragState) return;
    const stage = getCalendarStage();
    if (!stage) return;
    const item = decorItems.find(v => v.id === decorDragState.id);
    if (!item) return;
    const rect = stage.getBoundingClientRect();

    item.x = event.clientX - rect.left - decorDragState.offsetX;
    item.y = event.clientY - rect.top - decorDragState.offsetY;
    clampDecorItem(item);
    renderDecorItems();
  }

  function handleDecorPointerUp() {
    if (!decorDragState) return;
    decorDragState = null;
    saveDecorItems();
  }

  window.toggleDecorPalette = toggleDecorPalette;
  window.clearDecorItems = clearDecorItems;
  window.resizeSelectedDecorItem = resizeSelectedDecorItem;
  window.setCalendarViewMode = setCalendarViewMode;

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    height: getCalendarHeight(),
    firstDay: 1,
    selectable: true,
    events: buildEvents(),
    dateClick(info) {
      openDateActionModal(formatDateKey(info.date));
    },
    datesSet() {
      calendarViewAnchors[calendarViewMode] = formatDateKey(calendar.getDate());
      saveCalendarViewAnchors();
      loadDecorItemsForCurrentMonth();
      refreshAttendanceStyles();
      renderDecorItems();
    },
    dayCellDidMount(info) {
      info.el.title = "클릭해서 일정 추가";
    },
    windowResize() {
      calendar.setOption("height", getCalendarHeight());
    }
  });

  updateDdaySummary();
  renderDecorPalette();
  calendar.render();
  applyCalendarViewMode(calendarViewMode);
  updateCalendarViewButtons();
  loadDecorItemsForCurrentMonth();
  refreshAttendanceStyles();
  renderDecorItems();
  window.addEventListener("pointermove", handleDecorPointerMove);
  window.addEventListener("pointerup", handleDecorPointerUp);
  openTodayAttendancePopupIfNeeded();
});
