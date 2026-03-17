const ROUTINE_STORAGE_KEY = "dailyRoutineByWeekdayV3";
const ROUTINE_COLORS = [
  "#ffc6d9",
  "#ffd7ba",
  "#fff0b8",
  "#c7f1d8",
  "#bfe8ff",
  "#c9d4ff",
  "#e2ccff",
  "#ffd0c8"
];
const WEEK_DAYS = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" }
];

let routineStore = loadRoutineStore();
let currentWeekdayKey = getTodayWeekdayKey();
let selectedRoutineId = null;
let currentTimeTimerId = null;
let draftRoutine = null;
let activeDragHandle = null;
const ROUTINE_BANNER_TOGGLE_KEY = "routineBannerVisible";

function createEmptyRoutineStore() {
  return WEEK_DAYS.reduce((acc, day) => {
    acc[day.key] = [];
    return acc;
  }, {});
}

function loadRoutineStore() {
  const empty = createEmptyRoutineStore();
  try {
    const parsed = JSON.parse(localStorage.getItem(ROUTINE_STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object") return empty;
    WEEK_DAYS.forEach(day => {
      empty[day.key] = normalizeRoutineList(parsed[day.key]);
    });
    return empty;
  } catch (error) {
    console.warn("Failed to load routine store:", error);
    return empty;
  }
}

function saveRoutineStore() {
  localStorage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(routineStore));
}

function normalizeRoutineList(list) {
  return (Array.isArray(list) ? list : [])
    .map(normalizeRoutine)
    .filter(Boolean)
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

function normalizeRoutine(item) {
  if (!item) return null;
  const title = String(item.title || "").trim();
  const start = normalizeTimeString(item.start);
  const end = normalizeTimeString(item.end);
  if (!title || !start || !end || start === end) return null;
  return {
    id: String(item.id || `routine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    title,
    start,
    end,
    startMinutes: timeToMinutes(start),
    endMinutes: timeToMinutes(end),
    color: normalizeColor(item.color),
    note: String(item.note || "").trim()
  };
}

function normalizeTimeString(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : ROUTINE_COLORS[0];
}

function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const safe = ((Math.round(totalMinutes / 5) * 5) % 1440 + 1440) % 1440;
  const hours = String(Math.floor(safe / 60)).padStart(2, "0");
  const minutes = String(safe % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDurationMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}시간 ${minutes}분`;
}

function getRoutineDuration(routine) {
  if (routine.endMinutes > routine.startMinutes) {
    return routine.endMinutes - routine.startMinutes;
  }
  return (1440 - routine.startMinutes) + routine.endMinutes;
}

function getCurrentDayRoutines() {
  return routineStore[currentWeekdayKey] || [];
}

function setCurrentDayRoutines(routines) {
  routineStore[currentWeekdayKey] = normalizeRoutineList(routines);
  saveRoutineStore();
}

function getTodayWeekdayKey() {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
}

function getCurrentWeekdayAndMinutes() {
  const now = new Date();
  return {
    weekdayKey: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()],
    totalMinutes: (now.getHours() * 60) + now.getMinutes()
  };
}

function getWeekdayLabel(key) {
  return `${WEEK_DAYS.find(day => day.key === key)?.label || "?"}요일`;
}

function getCurrentTimeText() {
  const now = new Date();
  return `지금 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function getSelectedRoutine() {
  return getCurrentDayRoutines().find(routine => routine.id === selectedRoutineId) || null;
}

function isMinuteInRoutine(routine, totalMinutes) {
  if (routine.endMinutes > routine.startMinutes) {
    return totalMinutes >= routine.startMinutes && totalMinutes < routine.endMinutes;
  }
  return totalMinutes >= routine.startMinutes || totalMinutes < routine.endMinutes;
}

function getCurrentLiveRoutine() {
  const { weekdayKey, totalMinutes } = getCurrentWeekdayAndMinutes();
  const routines = routineStore[weekdayKey] || [];
  return routines.find(routine => isMinuteInRoutine(routine, totalMinutes)) || null;
}

function updateRoutineNowBanner() {
  const bannerEl = document.getElementById("routineNowBanner");
  if (!bannerEl) return;
  const routine = getCurrentLiveRoutine();
  if (!routine) {
    bannerEl.textContent = "지금은 쉬는 시간입니두.";
    bannerEl.classList.remove("has-routine");
    return;
  }
  const title = escapeHtml(routine.title);
  bannerEl.innerHTML = `지금은 <span class="routine-now-title">${title}</span>을 할 시간입니두.`;
  bannerEl.classList.add("has-routine");
}

function updateRoutineLiveCard() {
  const bannerEl = document.getElementById("routineNowBanner");
  const toggleEl = document.getElementById("routineBannerToggleInput");
  if (!bannerEl || !toggleEl) return;
  bannerEl.hidden = !toggleEl.checked;
}

function syncDayStatus(routine) {
  const statusEl = document.getElementById("routineDayStatus");
  if (!statusEl) return;
  if (!routine) {
    statusEl.textContent = `${getWeekdayLabel(currentWeekdayKey)} 루틴 · ${getCurrentTimeText()}`;
    return;
  }
  statusEl.textContent = `${getWeekdayLabel(currentWeekdayKey)} 루틴 · ${routine.title} ${routine.start} - ${routine.end}`;
}

function clearSelection() {
  selectedRoutineId = null;
  syncDayStatus(null);
  renderRoutineWheel();
}

function expandRoutineSegments(routine) {
  if (routine.endMinutes > routine.startMinutes) {
    return [{ start: routine.startMinutes, end: routine.endMinutes, label: routine.title }];
  }
  return [
    { start: routine.startMinutes, end: 1440, label: routine.title },
    { start: 0, end: routine.endMinutes, label: routine.title }
  ];
}

function routinesOverlap(candidate, ignoreId = null) {
  const candidateSegments = expandRoutineSegments(candidate);
  return getCurrentDayRoutines().some(routine => {
    if (routine.id === ignoreId) return false;
    return candidateSegments.some(candidateSegment =>
      expandRoutineSegments(routine).some(existingSegment =>
        candidateSegment.start < existingSegment.end && existingSegment.start < candidateSegment.end
      )
    );
  });
}

function createSvgEl(tagName, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
  return el;
}

function polarToCartesian(cx, cy, radius, angleDeg) {
  const radians = (angleDeg - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function minutesToAngle(minutes) {
  return (minutes / 1440) * 360;
}

function buildSegmentPath(startMinutes, endMinutes, radius) {
  const startAngle = minutesToAngle(startMinutes);
  const endAngle = minutesToAngle(endMinutes);
  const angleSpan = ((endAngle - startAngle) + 360) % 360 || 360;
  const largeArcFlag = angleSpan > 180 ? 1 : 0;
  const outerStart = polarToCartesian(180, 180, radius, startAngle);
  const outerEnd = polarToCartesian(180, 180, radius, endAngle);
  return [
    "M 180 180",
    `L ${outerStart.x} ${outerStart.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    "Z"
  ].join(" ");
}

function shortenLabel(text, maxLength) {
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

function buildSegmentLabelLines(text, maxCharsPerLine) {
  const source = String(text || "").trim();
  if (!source) return [];
  if (source.length <= maxCharsPerLine) return [source];

  const words = source.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const lines = [];
    let current = "";
    words.forEach(word => {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxCharsPerLine || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    });
    if (current) lines.push(current);
    if (lines.length === 1) return [shortenLabel(lines[0], maxCharsPerLine)];
    if (lines.length >= 2) {
      return [
        shortenLabel(lines[0], maxCharsPerLine),
        shortenLabel(lines.slice(1).join(" "), maxCharsPerLine)
      ];
    }
  }

  return [
    source.slice(0, maxCharsPerLine),
    shortenLabel(source.slice(maxCharsPerLine), maxCharsPerLine)
  ];
}

function buildVerticalLabelChars(text, maxChars) {
  const chars = Array.from(String(text || "").replace(/\s+/g, ""));
  if (chars.length <= maxChars) return chars;
  return [...chars.slice(0, Math.max(1, maxChars - 1)), "…"];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function appendSegmentLabel(svg, segment, routineId, isSelected) {
  const duration = segment.end - segment.start;
  if (duration < 28) return;
  const midMinutes = segment.start + (duration / 2);
  const angle = minutesToAngle(midMinutes);
  const chars = buildVerticalLabelChars(segment.label, duration < 45 ? 4 : duration < 70 ? 6 : duration < 110 ? 8 : 10);
  const point = polarToCartesian(180, 180, duration < 45 ? 84 : duration < 75 ? 92 : 98, angle);
  const radialText = createSvgEl("text", {
    x: point.x,
    y: point.y,
    "text-anchor": "middle",
    "dominant-baseline": "middle",
    class: `routine-segment-label routine-segment-label-radial${isSelected ? " is-selected" : ""}`,
    transform: `rotate(${angle}, ${point.x}, ${point.y})`
  });
  const charStep = 13;
  const startDy = chars.length > 1 ? -((chars.length - 1) * (charStep / 2)) : 0;
  chars.forEach((char, index) => {
    const tspan = createSvgEl("tspan", {
      x: point.x,
      dy: index === 0 ? startDy : charStep
    });
    tspan.textContent = char;
    radialText.appendChild(tspan);
  });
  radialText.addEventListener("click", () => openRoutineModal(routineId));
  svg.appendChild(radialText);
}

function appendCurrentTimeIndicator(svg) {
  const now = new Date();
  const totalMinutes = (now.getHours() * 60) + now.getMinutes() + (now.getSeconds() / 60);
  const angle = minutesToAngle(totalMinutes);
  const end = polarToCartesian(180, 180, 150, angle);
  svg.appendChild(createSvgEl("line", {
    x1: 180,
    y1: 180,
    x2: end.x,
    y2: end.y,
    class: "routine-current-time-line"
  }));
  svg.appendChild(createSvgEl("circle", {
    cx: end.x,
    cy: end.y,
    r: 4,
    class: "routine-current-time-dot"
  }));
}

function renderRoutineWheel() {
  const svg = document.querySelector(".routine-wheel");
  if (!svg) return;
  svg.innerHTML = "";

  svg.appendChild(createSvgEl("circle", {
    cx: 180,
    cy: 180,
    r: 138,
    fill: "rgba(255,255,255,0.22)",
    stroke: "rgba(255,255,255,0.62)",
    "stroke-width": 2
  }));

  for (let hour = 0; hour < 24; hour += 1) {
    const angle = (hour / 24) * 360;
    const outer = polarToCartesian(180, 180, 150, angle);
    const inner = polarToCartesian(180, 180, 116, angle);
    const labelPos = polarToCartesian(180, 180, 165, angle);
    svg.appendChild(createSvgEl("line", {
      x1: inner.x,
      y1: inner.y,
      x2: outer.x,
      y2: outer.y,
      stroke: hour % 6 === 0 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
      "stroke-width": hour % 6 === 0 ? 2.4 : 1.2
    }));
    const label = createSvgEl("text", {
      x: labelPos.x,
      y: labelPos.y,
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      class: "routine-wheel-hour"
    });
    label.textContent = String(hour).padStart(2, "0");
    svg.appendChild(label);
  }

  getCurrentDayRoutines().forEach(routine => {
    const isSelected = routine.id === selectedRoutineId;
    expandRoutineSegments(routine).forEach(segment => {
      const path = createSvgEl("path", {
        d: buildSegmentPath(segment.start, segment.end, 136),
        fill: routine.color,
        class: `routine-segment${isSelected ? " is-selected" : ""}`
      });
      path.addEventListener("click", () => openRoutineModal(routine.id));
      svg.appendChild(path);
      appendSegmentLabel(svg, segment, routine.id, isSelected);
    });
  });

  appendCurrentTimeIndicator(svg);
}

function renderWeekTabs() {
  const wrap = document.getElementById("routineWeekTabs");
  if (!wrap) return;
  wrap.innerHTML = WEEK_DAYS.map(day => `
    <button type="button" class="routine-week-tab${day.key === currentWeekdayKey ? " is-active" : ""}" data-weekday="${day.key}" role="tab" aria-selected="${day.key === currentWeekdayKey ? "true" : "false"}">${day.label}</button>
  `).join("");
  wrap.querySelectorAll("[data-weekday]").forEach(button => {
    button.addEventListener("click", () => {
      currentWeekdayKey = button.dataset.weekday || currentWeekdayKey;
      clearSelection();
      renderWeekTabs();
    });
  });
}

function angleFromPointer(event, svg) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(svg.getScreenCTM().inverse());
  return (Math.atan2(transformed.y - 180, transformed.x - 180) * 180 / Math.PI + 90 + 360) % 360;
}

function angleToMinutes(angle) {
  return Math.round((angle / 360) * 1440 / 5) * 5 % 1440;
}

function getDraftDurationMinutes() {
  if (!draftRoutine) return 0;
  if (draftRoutine.endMinutes > draftRoutine.startMinutes) {
    return draftRoutine.endMinutes - draftRoutine.startMinutes;
  }
  return (1440 - draftRoutine.startMinutes) + draftRoutine.endMinutes;
}

function syncDraftSummary() {
  if (!draftRoutine) return;
  document.getElementById("routineDraftTimeText").textContent = `${minutesToTime(draftRoutine.startMinutes)} - ${minutesToTime(draftRoutine.endMinutes)}`;
  document.getElementById("routineDraftDurationText").textContent = formatDurationMinutes(getDraftDurationMinutes());
}

function renderRoutinePicker() {
  const svg = document.querySelector(".routine-picker-wheel");
  if (!svg || !draftRoutine) return;
  svg.innerHTML = "";

  svg.appendChild(createSvgEl("circle", {
    cx: 180,
    cy: 180,
    r: 138,
    fill: "rgba(255,255,255,0.88)",
    stroke: "rgba(255,188,168,0.9)",
    "stroke-width": 6
  }));

  for (let hour = 0; hour < 24; hour += 1) {
    const angle = (hour / 24) * 360;
    const outer = polarToCartesian(180, 180, 150, angle);
    const inner = polarToCartesian(180, 180, 120, angle);
    const labelPos = polarToCartesian(180, 180, 162, angle);
    svg.appendChild(createSvgEl("line", {
      x1: inner.x,
      y1: inner.y,
      x2: outer.x,
      y2: outer.y,
      stroke: hour % 6 === 0 ? "rgba(219,121,95,0.9)" : "rgba(219,121,95,0.35)",
      "stroke-width": hour % 6 === 0 ? 2.4 : 1.2
    }));
    const label = createSvgEl("text", {
      x: labelPos.x,
      y: labelPos.y,
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      class: "routine-picker-hour"
    });
    label.textContent = String(hour).padStart(2, "0");
    svg.appendChild(label);
  }

  getCurrentDayRoutines().forEach(routine => {
    if (routine.id && draftRoutine.id && routine.id === draftRoutine.id) return;
    expandRoutineSegments(routine).forEach(segment => {
      svg.appendChild(createSvgEl("path", {
        d: buildSegmentPath(segment.start, segment.end, 132),
        fill: routine.color,
        class: "routine-picker-existing-segment"
      }));
    });
  });

  expandRoutineSegments({
    startMinutes: draftRoutine.startMinutes,
    endMinutes: draftRoutine.endMinutes,
    title: draftRoutine.title || "루틴"
  }).forEach(segment => {
    svg.appendChild(createSvgEl("path", {
      d: buildSegmentPath(segment.start, segment.end, 132),
      fill: draftRoutine.color,
      class: "routine-picker-segment"
    }));
  });

  ["start", "end"].forEach(handleType => {
    const minutes = handleType === "start" ? draftRoutine.startMinutes : draftRoutine.endMinutes;
    const point = polarToCartesian(180, 180, 132, minutesToAngle(minutes));
    svg.appendChild(createSvgEl("line", {
      x1: 180,
      y1: 180,
      x2: point.x,
      y2: point.y,
      class: `routine-picker-ray routine-picker-ray-${handleType}`
    }));
    const handle = createSvgEl("circle", {
      cx: point.x,
      cy: point.y,
      r: 10,
      class: `routine-picker-handle routine-picker-handle-${handleType}`
    });
    handle.dataset.handleType = handleType;
    svg.appendChild(handle);
  });

  syncDraftSummary();
}

function handlePickerPointerDown(event) {
  const handle = event.target.closest("[data-handle-type]");
  if (!handle) return;
  activeDragHandle = handle.dataset.handleType;
  handle.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function handlePickerPointerMove(event) {
  if (!activeDragHandle || !draftRoutine) return;
  const svg = document.querySelector(".routine-picker-wheel");
  if (!svg) return;
  const angle = angleFromPointer(event, svg);
  const minutes = angleToMinutes(angle);
  draftRoutine[activeDragHandle === "start" ? "startMinutes" : "endMinutes"] = minutes;
  if (draftRoutine.startMinutes === draftRoutine.endMinutes) {
    draftRoutine.endMinutes = (draftRoutine.endMinutes + 30) % 1440;
  }
  renderRoutinePicker();
}

function handlePickerPointerUp() {
  activeDragHandle = null;
}

function renderRoutineModalDayList() {
  const listEl = document.getElementById("routineModalDayList");
  if (!listEl) return;
  const routines = getCurrentDayRoutines();

  if (!routines.length) {
    listEl.innerHTML = `<p class="routine-modal-empty">${getWeekdayLabel(currentWeekdayKey)}에 저장된 루틴이 아직 없습니다.</p>`;
    return;
  }

  listEl.innerHTML = routines.map(routine => `
    <button type="button" class="routine-modal-list-item${routine.id === selectedRoutineId ? " is-selected" : ""}" data-routine-id="${routine.id}">
      <span class="routine-modal-list-swatch" style="background:${routine.color}"></span>
      <span class="routine-modal-list-copy">
        <strong>${escapeHtml(routine.title)}</strong>
        <span>${routine.start} - ${routine.end} · ${formatDurationMinutes(getRoutineDuration(routine))}</span>
      </span>
    </button>
  `).join("");

  listEl.querySelectorAll("[data-routine-id]").forEach(button => {
    button.addEventListener("click", () => openRoutineModal(button.dataset.routineId));
  });
}

function openRoutineModal(routineId = null) {
  const editing = routineId ? getCurrentDayRoutines().find(item => item.id === routineId) : null;
  selectedRoutineId = editing?.id || null;
  draftRoutine = editing ? {
    id: editing.id,
    title: editing.title,
    startMinutes: editing.startMinutes,
    endMinutes: editing.endMinutes,
    color: editing.color,
    note: editing.note
  } : {
    id: null,
    title: "",
    startMinutes: 420,
    endMinutes: 480,
    color: ROUTINE_COLORS[0],
    note: ""
  };

  document.getElementById("routineModalTitle").textContent = editing ? "루틴 수정" : "루틴 추가";
  document.getElementById("routineTitleInput").value = draftRoutine.title;
  document.getElementById("routineColorInput").value = draftRoutine.color;
  document.getElementById("routineNoteInput").value = draftRoutine.note;
  document.getElementById("routineSubmitBtn").textContent = editing ? "루틴 수정" : "루틴 저장";
  document.getElementById("deleteSelectedRoutineBtn").hidden = !editing;
  document.getElementById("routineModalOverlay").hidden = false;
  renderRoutinePicker();
  renderRoutineModalDayList();
}

function closeRoutineModal() {
  draftRoutine = null;
  activeDragHandle = null;
  document.getElementById("routineModalOverlay").hidden = true;
}

function deleteSelectedRoutine() {
  const selected = getSelectedRoutine();
  if (!selected) return;
  if (!confirm(`"${selected.title}" 루틴을 삭제할까요?`)) return;
  setCurrentDayRoutines(getCurrentDayRoutines().filter(routine => routine.id !== selected.id));
  renderRoutineModalDayList();
  closeRoutineModal();
  clearSelection();
}

function handleRoutineSubmit(event) {
  event.preventDefault();
  if (!draftRoutine) return;
  draftRoutine.title = String(document.getElementById("routineTitleInput").value || "").trim();
  draftRoutine.color = normalizeColor(document.getElementById("routineColorInput").value);
  draftRoutine.note = String(document.getElementById("routineNoteInput").value || "").trim();

  const candidate = normalizeRoutine({
    id: draftRoutine.id || undefined,
    title: draftRoutine.title,
    start: minutesToTime(draftRoutine.startMinutes),
    end: minutesToTime(draftRoutine.endMinutes),
    color: draftRoutine.color,
    note: draftRoutine.note
  });

  if (!candidate) {
    alert("루틴 이름과 시간을 확인해 주세요.");
    return;
  }

  if (routinesOverlap(candidate, selectedRoutineId)) {
    alert("같은 요일 안에서 시간이 겹치는 루틴이 이미 있습니다.");
    return;
  }

  const next = selectedRoutineId
    ? getCurrentDayRoutines().map(routine => routine.id === selectedRoutineId ? candidate : routine)
    : [...getCurrentDayRoutines(), candidate];

  setCurrentDayRoutines(next);
  renderRoutineModalDayList();
  closeRoutineModal();
  clearSelection();
}

function renderColorPresets() {
  const wrap = document.getElementById("routineColorPresets");
  const input = document.getElementById("routineColorInput");
  if (!wrap || !input) return;
  wrap.innerHTML = ROUTINE_COLORS.map(color => `
    <button type="button" class="routine-color-preset" data-color="${color}" style="background:${color}" aria-label="${color} 색상 선택"></button>
  `).join("");
  wrap.querySelectorAll("[data-color]").forEach(button => {
    button.addEventListener("click", () => {
      input.value = button.dataset.color || ROUTINE_COLORS[0];
      if (draftRoutine) {
        draftRoutine.color = input.value;
        renderRoutinePicker();
      }
    });
  });
}

function updateCurrentTimeLabel() {
  if (!getSelectedRoutine()) {
    syncDayStatus(null);
  }
  updateRoutineNowBanner();
  updateRoutineLiveCard();
  renderRoutineWheel();
}

function initializeCurrentTimeTicker() {
  if (currentTimeTimerId) clearInterval(currentTimeTimerId);
  updateCurrentTimeLabel();
  currentTimeTimerId = setInterval(updateCurrentTimeLabel, 1000);
}

function initializeRoutinePage() {
  document.body.classList.toggle("office-mode", localStorage.getItem("officeMode") === "true");
  renderWeekTabs();
  renderColorPresets();
  syncDayStatus(null);
  updateRoutineNowBanner();
  renderRoutineWheel();
  initializeCurrentTimeTicker();

  const liveToggleEl = document.getElementById("routineBannerToggleInput");
  if (liveToggleEl) {
    liveToggleEl.checked = localStorage.getItem(ROUTINE_BANNER_TOGGLE_KEY) !== "false";
    liveToggleEl.addEventListener("change", () => {
      localStorage.setItem(ROUTINE_BANNER_TOGGLE_KEY, liveToggleEl.checked ? "true" : "false");
      updateRoutineLiveCard();
    });
  }
  updateRoutineLiveCard();

  document.getElementById("openRoutineModalBtn")?.addEventListener("click", () => openRoutineModal());
  document.getElementById("closeRoutineModalBtn")?.addEventListener("click", closeRoutineModal);
  document.getElementById("routineModalOverlay")?.addEventListener("click", event => {
    if (event.target.id === "routineModalOverlay") closeRoutineModal();
  });
  document.getElementById("routineForm")?.addEventListener("submit", handleRoutineSubmit);
  document.getElementById("routineColorInput")?.addEventListener("input", event => {
    if (!draftRoutine) return;
    draftRoutine.color = normalizeColor(event.target.value);
    renderRoutinePicker();
  });
  document.getElementById("resetRoutineSelectionBtn")?.addEventListener("click", clearSelection);
  document.getElementById("deleteSelectedRoutineBtn")?.addEventListener("click", deleteSelectedRoutine);
  document.getElementById("clearDayRoutinesBtn")?.addEventListener("click", () => {
    if (!getCurrentDayRoutines().length) return;
    if (!confirm(`${getWeekdayLabel(currentWeekdayKey)} 루틴을 모두 삭제할까요?`)) return;
    setCurrentDayRoutines([]);
    renderRoutineModalDayList();
    closeRoutineModal();
    clearSelection();
  });

  const picker = document.querySelector(".routine-picker-wheel");
  picker?.addEventListener("pointerdown", handlePickerPointerDown);
  picker?.addEventListener("pointermove", handlePickerPointerMove);
  picker?.addEventListener("pointerup", handlePickerPointerUp);
  picker?.addEventListener("pointercancel", handlePickerPointerUp);
  picker?.addEventListener("lostpointercapture", handlePickerPointerUp);
}

document.addEventListener("DOMContentLoaded", initializeRoutinePage);
