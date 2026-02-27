document.addEventListener("DOMContentLoaded", async () => {
  const calendarEl = document.getElementById("calendar");
  const ddaySummaryEl = document.getElementById("ddaySummary");

  let attendance = JSON.parse(localStorage.getItem("attendance")) || {};
  let schedules = JSON.parse(localStorage.getItem("schedule")) || {};
  let exams = JSON.parse(localStorage.getItem("exam")) || {};
  let studyTime = JSON.parse(localStorage.getItem("studyTime")) || {};
  const CALENDAR_VIEW_MODE_KEY = "calendarViewMode";
  const CALENDAR_VIEW_ANCHORS_KEY = "calendarViewAnchors";
  const MOBILE_PURPOSE_TAB_KEY = "calendarMobilePurposeTab";
  const DECOR_ITEMS_KEY = "calendarDecorItemsByMonth";
  const DECOR_IMAGE_MANIFEST_URL = "mydog/manifest.json";
  const DECOR_IMAGE_MANIFEST_CACHE_KEY = "calendarDecorImageManifest";
  let dogImages = [];
  const decorImageRatios = {};
  let decorItemsByMonth = JSON.parse(localStorage.getItem(DECOR_ITEMS_KEY) || "{}");
  let decorItems = [];
  let currentDecorScopeKey = "";
  let decorDragState = null;
  let decorPinchState = null;
  let selectedDecorItemId = null;
  let calendar = null;
  let calendarViewMode = localStorage.getItem(CALENDAR_VIEW_MODE_KEY) === "week" ? "week" : "month";
  let calendarViewAnchors = JSON.parse(localStorage.getItem(CALENDAR_VIEW_ANCHORS_KEY) || "null") || {};
  let currentMobilePurposeTab = localStorage.getItem(MOBILE_PURPOSE_TAB_KEY) || "calendar";

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

  function isPortraitMobile() {
    return window.matchMedia("(max-width: 980px) and (orientation: portrait)").matches;
  }

  function normalizeMobilePurposeTab(tab) {
    return tab === "decor" ? tab : "calendar";
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

  function normalizeDecorImageList(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map(item => String(item || "").trim())
      .filter(Boolean)
      .map(item => item.startsWith("mydog/") ? item : `mydog/${item}`)
      .filter(item => /\.(png|jpe?g|webp|gif|svg)$/i.test(item));
  }

  async function loadDecorImageManifest() {
    try {
      const response = await fetch(DECOR_IMAGE_MANIFEST_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`manifest http ${response.status}`);
      const data = await response.json();
      const list = normalizeDecorImageList(Array.isArray(data) ? data : data?.images);
      if (list.length > 0) {
        dogImages = list;
        localStorage.setItem(DECOR_IMAGE_MANIFEST_CACHE_KEY, JSON.stringify(list));
        return;
      }
      throw new Error("empty manifest");
    } catch (_) {
      const cached = JSON.parse(localStorage.getItem(DECOR_IMAGE_MANIFEST_CACHE_KEY) || "[]");
      dogImages = normalizeDecorImageList(cached);
    }
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
        id: `schedule:${date}`,
        title: `공부: ${schedules[date]}`,
        start: date,
        backgroundColor: "#4f7cff",
        borderColor: "#4f7cff",
        extendedProps: {
          recordType: "schedule",
          dateKey: date
        }
      });
    });

    Object.keys(exams).forEach(date => {
      events.push({
        id: `exam:${date}`,
        title: `시험: ${exams[date]}`,
        start: date,
        backgroundColor: "#ff5a5f",
        borderColor: "#ff5a5f",
        extendedProps: {
          recordType: "exam",
          dateKey: date
        }
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

    try {
      const todoItems = JSON.parse(localStorage.getItem("todoItems") || "[]");
      if (Array.isArray(todoItems)) {
        todoItems
          .filter(item => item && !item.done && isValidDateKey(item.dueDate) && String(item.text || "").trim())
          .forEach(item => {
            events.push({
              id: `todo:${item.id || `${item.dueDate}-${String(item.text || "").trim()}`}`,
              title: `TO-DO: ${String(item.text).trim()}`,
              start: item.dueDate,
              backgroundColor: "#ffe08a",
              borderColor: "#f2b705",
              textColor: "#503b00",
              extendedProps: {
                recordType: "todo",
                todoId: String(item.id || ""),
                dateKey: item.dueDate
              }
            });
          });
      }
    } catch (_) {
      // ignore malformed todo storage
    }

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
    } else if (action === "todo") {
      const text = prompt("TO-DO 내용을 입력해 주세요.");
      if (!text || !text.trim()) return;
      if (typeof window.addTodoItem === "function") {
        window.addTodoItem({ text: text.trim(), dueDate: dateStr });
      } else {
        const fallback = JSON.parse(localStorage.getItem("todoItems") || "[]");
        fallback.unshift({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: text.trim(),
          dueDate: dateStr,
          done: false,
          createdAt: Date.now()
        });
        localStorage.setItem("todoItems", JSON.stringify(fallback));
      }
    } else {
      return;
    }

    persistAll();
    updateDdaySummary();
    rerenderEvents();
  }

  function deleteCalendarRecordByEvent(event) {
    const recordType = event?.extendedProps?.recordType;
    const dateKey = String(event?.extendedProps?.dateKey || event?.startStr || "");
    if (recordType === "schedule" && dateKey) {
      if (!confirm(`공부 일정을 삭제할까요?\n${dateKey}`)) return true;
      delete schedules[dateKey];
      persistAll();
      rerenderEvents();
      updateDdaySummary();
      return true;
    }

    if (recordType === "exam" && dateKey) {
      if (!confirm(`시험 일정을 삭제할까요?\n${dateKey}`)) return true;
      delete exams[dateKey];
      persistAll();
      rerenderEvents();
      updateDdaySummary();
      return true;
    }

    if (recordType === "todo") {
      const todoId = String(event?.extendedProps?.todoId || "");
      if (!todoId) return true;
      if (!confirm("TO-DO를 삭제할까요?")) return true;
      try {
        const items = JSON.parse(localStorage.getItem("todoItems") || "[]");
        const nextItems = Array.isArray(items)
          ? items.filter(item => String(item?.id || "") !== todoId)
          : [];
        localStorage.setItem("todoItems", JSON.stringify(nextItems));
      } catch (_) {
        localStorage.setItem("todoItems", "[]");
      }
      window.dispatchEvent(new Event("todo:changed"));
      rerenderEvents();
      return true;
    }

    return false;
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
          <button type="button" data-action="todo">TO-DO 추가</button>
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
    let reservedHeight = 220; // nav + title + summary + helper text + margins
    if (isPortraitMobile()) {
      reservedHeight = 210;
    }
    const viewportHeight = window.visualViewport
      ? Math.floor(window.visualViewport.height)
      : window.innerHeight;
    return Math.max(380, viewportHeight - reservedHeight);
  }

  function syncCalendarHeight() {
    if (!calendar) return;
    calendar.setOption("height", getCalendarHeight());
    decorItems.forEach(clampDecorItem);
    renderDecorItems();
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
      calendar.setOption("hiddenDays", []);
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
    const { width: stageWidth, height: stageHeight } = getStageSize();
    return (Array.isArray(items) ? items : [])
      .map(item => ({
        id: String(item.id || `${Date.now()}-${Math.random()}`),
        src: String(item.src || ""),
        xPct: Number.isFinite(item.xPct)
          ? item.xPct
          : pxToPercent(Number.isFinite(item.x) ? item.x : 20, stageWidth),
        yPct: Number.isFinite(item.yPct)
          ? item.yPct
          : pxToPercent(Number.isFinite(item.y) ? item.y : 20, stageHeight),
        sizePct: Number.isFinite(item.sizePct)
          ? item.sizePct
          : pxToPercent(Number.isFinite(item.size) ? item.size : 56, stageWidth),
        ratio: Number.isFinite(item.ratio) && item.ratio > 0 ? item.ratio : 1
      }))
      .map(clampDecorItem)
      .filter(item => dogImages.length === 0 || dogImages.includes(item.src));
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

  function getCalendarStage() {
    return document.getElementById("calendarStage");
  }

  function getDecorLayer() {
    return document.getElementById("calendarDecorLayer");
  }

  function getStageSize() {
    const stage = getCalendarStage();
    return {
      width: Math.max(1, stage?.clientWidth || 1),
      height: Math.max(1, stage?.clientHeight || 1)
    };
  }

  function percentToPx(percent, totalPx) {
    return (percent / 100) * totalPx;
  }

  function pxToPercent(px, totalPx) {
    return totalPx > 0 ? (px / totalPx) * 100 : 0;
  }

  function getDecorPixelBox(item) {
    const { width: stageWidth, height: stageHeight } = getStageSize();
    const ratio = Number.isFinite(item.ratio) && item.ratio > 0 ? item.ratio : 1;
    const baseSizePx = percentToPx(item.sizePct, stageWidth);
    const width = ratio >= 1 ? baseSizePx : baseSizePx * ratio;
    const height = ratio >= 1 ? baseSizePx / ratio : baseSizePx;
    const left = percentToPx(item.xPct, stageWidth);
    const top = percentToPx(item.yPct, stageHeight);
    return { left, top, width, height };
  }

  function clampDecorItem(item) {
    const { width: stageWidth, height: stageHeight } = getStageSize();
    const ratio = Number.isFinite(item.ratio) && item.ratio > 0 ? item.ratio : 1;
    const baseSizePx = percentToPx(item.sizePct, stageWidth);
    const stickerWidth = ratio >= 1 ? baseSizePx : baseSizePx * ratio;
    const stickerHeight = ratio >= 1 ? baseSizePx / ratio : baseSizePx;
    const minSizePct = pxToPercent(28, stageWidth);
    const maxSizePct = pxToPercent(120, stageWidth);
    const maxXPct = pxToPercent(Math.max(0, stageWidth - stickerWidth), stageWidth);
    const maxYPct = pxToPercent(Math.max(0, stageHeight - stickerHeight), stageHeight);
    item.sizePct = Math.min(Math.max(item.sizePct, minSizePct), maxSizePct);
    item.xPct = Math.min(Math.max(item.xPct, 0), maxXPct);
    item.yPct = Math.min(Math.max(item.yPct, 0), maxYPct);
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
      ? `선택됨: ${selected.sizePct.toFixed(1)}% (${Math.round(percentToPx(selected.sizePct, getStageSize().width))}px)`
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
      const { left, top, width, height } = getDecorPixelBox(item);
      sticker.style.width = `${width}px`;
      sticker.style.height = `${height}px`;
      sticker.style.left = `${left}px`;
      sticker.style.top = `${top}px`;
      sticker.addEventListener("pointerdown", startDecorDrag);
      layer.appendChild(sticker);
    });
    updateDecorSizeStatus();
  }

  function addDecorItem(src) {
    if (!isDecorEditMode()) return;
    const stage = getCalendarStage();
    const spreadX = ((decorItems.length % 5) - 2) * 16;
    const spreadY = ((decorItems.length % 4) - 1.5) * 14;
    const fallbackX = 12 + (decorItems.length % 6) * 14;
    const fallbackY = 12 + (decorItems.length % 4) * 14;
    const startX = stage
      ? Math.max(12, Math.round(stage.clientWidth * 0.5 - 28 + spreadX))
      : fallbackX;
    const startY = stage
      ? Math.max(140, Math.round(stage.clientHeight * 0.45 - 28 + spreadY))
      : fallbackY;

    const ratio = Number.isFinite(decorImageRatios[src]) && decorImageRatios[src] > 0
      ? decorImageRatios[src]
      : 1;
    const { width: stageWidth, height: stageHeight } = getStageSize();
    const item = clampDecorItem({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      src,
      xPct: pxToPercent(startX, stageWidth),
      yPct: pxToPercent(startY, stageHeight),
      sizePct: pxToPercent(56, stageWidth),
      ratio
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
    dogImages.forEach(src => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "decor-thumb-btn";
      button.title = "클릭해서 배치";
      button.innerHTML = `<img src="${src}" alt="">`;
      const img = button.querySelector("img");
      img?.addEventListener("load", () => {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          decorImageRatios[src] = img.naturalWidth / img.naturalHeight;
          let updated = false;
          decorItems.forEach(item => {
            if (item.src === src && (!Number.isFinite(item.ratio) || item.ratio <= 0 || item.ratio === 1)) {
              item.ratio = decorImageRatios[src];
              clampDecorItem(item);
              updated = true;
            }
          });
          if (updated) {
            saveDecorItems();
            renderDecorItems();
          }
        }
      });
      button.addEventListener("click", () => addDecorItem(src));
      listEl.appendChild(button);
    });

    if (dogImages.length === 0) {
      const empty = document.createElement("div");
      empty.className = "decor-thumb-empty";
      empty.textContent = "mydog/manifest.json에 이미지 목록을 넣어주세요.";
      listEl.appendChild(empty);
    }
  }

  function isDecorEditMode() {
    const overlay = document.getElementById("decorPaletteOverlay");
    return Boolean(overlay && !overlay.hidden);
  }

  function syncDecorEditModeState(isOpen) {
    const stage = getCalendarStage();
    if (stage) {
      stage.classList.toggle("decor-edit-mode", isOpen);
    }
    if (!isOpen) {
      decorDragState = null;
    }
  }

  function setMobilePurposeTab(tab, options = {}) {
    const nextTab = normalizeMobilePurposeTab(tab);
    const tabsWrap = document.getElementById("mobilePurposeTabs");
    const helpEl = document.querySelector(".calendar-help");
    const stageEl = getCalendarStage();

    currentMobilePurposeTab = nextTab;
    if (!options.skipPersist) {
      localStorage.setItem(MOBILE_PURPOSE_TAB_KEY, currentMobilePurposeTab);
    }

    if (!isPortraitMobile()) {
      document.body.classList.remove("mobile-purpose-mode", "mobile-purpose-calendar", "mobile-purpose-decor");
      if (tabsWrap) tabsWrap.hidden = true;
      if (ddaySummaryEl) ddaySummaryEl.hidden = false;
      if (helpEl) helpEl.hidden = false;
      if (stageEl) stageEl.hidden = false;
      setDecorPaletteOpen(false);
      return;
    }

    document.body.classList.add("mobile-purpose-mode");
    document.body.classList.remove("mobile-purpose-calendar", "mobile-purpose-decor");
    document.body.classList.add(`mobile-purpose-${currentMobilePurposeTab}`);

    if (tabsWrap) {
      tabsWrap.hidden = false;
      tabsWrap.querySelectorAll("[data-mobile-purpose]").forEach(btn => {
        const isActive = btn.dataset.mobilePurpose === currentMobilePurposeTab;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    }

    const isCalendar = currentMobilePurposeTab === "calendar";
    const isDecor = currentMobilePurposeTab === "decor";
    if (ddaySummaryEl) ddaySummaryEl.hidden = !isCalendar;
    if (helpEl) helpEl.hidden = !isCalendar;
    if (stageEl) stageEl.hidden = !isCalendar;
    setDecorPaletteOpen(isDecor);
    syncCalendarHeight();
  }

  function syncMobilePurposeLayout() {
    setMobilePurposeTab(currentMobilePurposeTab, { skipPersist: true });
  }

  function setDecorPaletteOpen(isOpen) {
    const overlay = document.getElementById("decorPaletteOverlay");
    const toggleBtn = document.getElementById("decorPaletteToggleBtn");
    if (!overlay) return;
    overlay.hidden = !isOpen;
    syncDecorEditModeState(isOpen);
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  }

  function toggleDecorPalette(forceOpen) {
    const overlay = document.getElementById("decorPaletteOverlay");
    if (!overlay) return;
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : overlay.hidden;
    setDecorPaletteOpen(shouldOpen);
  }

  function clearDecorItems() {
    if (!isDecorEditMode()) return;
    if (!confirm("꾸미기를 모두 지우시겠습니끼?")) return;
    decorItems = [];
    selectedDecorItemId = null;
    saveDecorItems();
    renderDecorItems();
  }

  function resizeSelectedDecorItem(delta) {
    if (!isDecorEditMode()) return;
    const item = getSelectedDecorItem();
    if (!item) {
      alert("크기 조절할 스티커를 먼저 눌러주세요.");
      return;
    }
    const { width: stageWidth } = getStageSize();
    item.sizePct += pxToPercent(delta, stageWidth);
    clampDecorItem(item);
    saveDecorItems();
    renderDecorItems();
  }

  function startDecorDrag(event) {
    if (!isDecorEditMode()) return;
    const target = event.currentTarget;
    const itemId = target?.dataset?.id;
    const stage = getCalendarStage();
    if (!itemId || !stage) return;
    const item = decorItems.find(v => v.id === itemId);
    if (!item) return;
    selectedDecorItemId = itemId;

    const rect = stage.getBoundingClientRect();
    const { left, top } = getDecorPixelBox(item);
    decorDragState = {
      id: itemId,
      offsetX: event.clientX - rect.left - left,
      offsetY: event.clientY - rect.top - top
    };
    target.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    renderDecorItems();
  }

  function handleDecorPointerMove(event) {
    if (!isDecorEditMode()) return;
    if (!decorDragState) return;
    const stage = getCalendarStage();
    if (!stage) return;
    const item = decorItems.find(v => v.id === decorDragState.id);
    if (!item) return;
    const rect = stage.getBoundingClientRect();
    const { width: stageWidth, height: stageHeight } = getStageSize();

    item.xPct = pxToPercent(event.clientX - rect.left - decorDragState.offsetX, stageWidth);
    item.yPct = pxToPercent(event.clientY - rect.top - decorDragState.offsetY, stageHeight);
    clampDecorItem(item);
    renderDecorItems();
  }

  function handleDecorPointerUp() {
    if (!isDecorEditMode()) return;
    if (!decorDragState) return;
    decorDragState = null;
    saveDecorItems();
  }

  function getTouchDistance(touchA, touchB) {
    const dx = touchA.clientX - touchB.clientX;
    const dy = touchA.clientY - touchB.clientY;
    return Math.hypot(dx, dy);
  }

  function getStickerIdFromTouch(touch) {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    return el?.closest(".calendar-decor-item")?.dataset?.id || null;
  }

  function handleDecorTouchStart(event) {
    if (!isDecorEditMode()) return;
    if (event.touches.length < 2) return;

    const idA = getStickerIdFromTouch(event.touches[0]);
    const idB = getStickerIdFromTouch(event.touches[1]);
    const candidateId = idA || idB || selectedDecorItemId;
    if (!candidateId) return;
    if (idA && idB && idA !== idB) return;

    const item = decorItems.find(v => v.id === candidateId);
    if (!item) return;

    const distance = getTouchDistance(event.touches[0], event.touches[1]);
    if (!Number.isFinite(distance) || distance <= 0) return;

    selectedDecorItemId = item.id;
    const { width: stageWidth } = getStageSize();
    decorPinchState = {
      id: item.id,
      startDistance: distance,
      startSizePct: item.sizePct,
      startStageWidth: stageWidth
    };
    event.preventDefault();
    renderDecorItems();
  }

  function handleDecorTouchMove(event) {
    if (!isDecorEditMode()) return;
    if (!decorPinchState) return;
    if (event.touches.length < 2) return;

    const item = decorItems.find(v => v.id === decorPinchState.id);
    if (!item) {
      decorPinchState = null;
      return;
    }

    const distance = getTouchDistance(event.touches[0], event.touches[1]);
    if (!Number.isFinite(distance) || distance <= 0) return;

    const scale = distance / decorPinchState.startDistance;
    const baseSizePx = percentToPx(decorPinchState.startSizePct, decorPinchState.startStageWidth);
    const nextSizePx = baseSizePx * scale;
    const { width: stageWidth } = getStageSize();
    item.sizePct = pxToPercent(nextSizePx, stageWidth);
    clampDecorItem(item);
    renderDecorItems();
    event.preventDefault();
  }

  function handleDecorTouchEnd(event) {
    if (!decorPinchState) return;
    if (event.touches.length >= 2) return;
    decorPinchState = null;
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
      if (isDecorEditMode()) return;
      openDateActionModal(formatDateKey(info.date));
    },
    eventClick(info) {
      if (isDecorEditMode()) return;
      const handled = deleteCalendarRecordByEvent(info.event);
      if (handled) {
        info.jsEvent?.preventDefault?.();
      }
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
      syncCalendarHeight();
    }
  });

  await loadDecorImageManifest();
  migrateLegacyDecorStorageIfNeeded();
  loadDecorItemsForCurrentMonth();
  updateDdaySummary();
  renderDecorPalette();
  calendar.render();
  applyCalendarViewMode(calendarViewMode);
  updateCalendarViewButtons();
  loadDecorItemsForCurrentMonth();
  refreshAttendanceStyles();
  renderDecorItems();
  syncMobilePurposeLayout();

  const mobilePurposeTabs = document.getElementById("mobilePurposeTabs");
  mobilePurposeTabs?.addEventListener("click", event => {
    const button = event.target.closest("button[data-mobile-purpose]");
    if (!button) return;
    setMobilePurposeTab(button.dataset.mobilePurpose || "calendar");
  });

  window.addEventListener("todo:changed", rerenderEvents);
  window.addEventListener("storage", event => {
    if (event.key === "todoItems") {
      rerenderEvents();
    }
  });

  window.addEventListener("pointermove", handleDecorPointerMove);
  window.addEventListener("pointerup", handleDecorPointerUp);
  const calendarStage = getCalendarStage();
  calendarStage?.addEventListener("touchstart", handleDecorTouchStart, { passive: false });
  calendarStage?.addEventListener("touchmove", handleDecorTouchMove, { passive: false });
  calendarStage?.addEventListener("touchend", handleDecorTouchEnd, { passive: false });
  calendarStage?.addEventListener("touchcancel", handleDecorTouchEnd, { passive: false });
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      setDecorPaletteOpen(false);
    }
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncCalendarHeight);
  }
  window.addEventListener("orientationchange", syncCalendarHeight);
  window.addEventListener("orientationchange", syncMobilePurposeLayout);
  window.addEventListener("resize", syncMobilePurposeLayout);
  openTodayAttendancePopupIfNeeded();
});
