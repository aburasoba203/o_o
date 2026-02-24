document.addEventListener("DOMContentLoaded", () => {
  const calendarEl = document.getElementById("calendar");
  const ddaySummaryEl = document.getElementById("ddaySummary");

  let attendance = JSON.parse(localStorage.getItem("attendance")) || {};
  let schedules = JSON.parse(localStorage.getItem("schedule")) || {};
  let exams = JSON.parse(localStorage.getItem("exam")) || {};
  let studyTime = JSON.parse(localStorage.getItem("studyTime")) || {};

  function toDateOnly(dateString) {
    return new Date(`${dateString}T00:00:00`);
  }

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getTodayDateOnly() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

  function buildEvents() {
    const events = [];

    Object.keys(attendance).forEach(date => {
      events.push({
        title: "출석체크",
        start: date,
        backgroundColor: "#2ecc71",
        borderColor: "#2ecc71"
      });
    });

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

  function updateDdaySummary() {
    if (!ddaySummaryEl) return;

    const today = getTodayDateOnly();
    const upcomingExams = Object.entries(exams)
      .map(([date, name]) => ({ date, name, dateObj: toDateOnly(date) }))
      .filter(item => !Number.isNaN(item.dateObj.getTime()) && item.dateObj >= today)
      .sort((a, b) => a.dateObj - b.dateObj);

    if (upcomingExams.length === 0) {
      ddaySummaryEl.innerText = "시험 일정이 없어요.";
      return;
    }

    ddaySummaryEl.innerHTML = upcomingExams
      .slice(0, 5)
      .map(exam => {
        const dayDiff = Math.round((exam.dateObj - today) / (1000 * 60 * 60 * 24));
        const ddayLabel = dayDiff === 0 ? "D-Day" : `D-${dayDiff}`;
        return `<div>${ddayLabel} | ${exam.name}</div>`;
      })
      .join("");
  }

  function persistAll() {
    localStorage.setItem("attendance", JSON.stringify(attendance));
    localStorage.setItem("schedule", JSON.stringify(schedules));
    localStorage.setItem("exam", JSON.stringify(exams));
    localStorage.setItem("studyTime", JSON.stringify(studyTime));
  }

  function rerenderEvents() {
    calendar.removeAllEvents();
    buildEvents().forEach(event => calendar.addEvent(event));
  }

  function applyCalendarAction(action, dateStr) {
    if (action === "study") {
      const text = prompt("공부 일정 내용을 입력하세요:");
      if (!text || !text.trim()) return;
      schedules[dateStr] = text.trim();
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
          <button type="button" data-action="study">공부 일정 추가</button>
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

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    selectable: true,
    events: buildEvents(),
    dayCellDidMount(info) {
      const dateStr = formatDateKey(info.date);
      info.el.title = "더블클릭해서 일정 추가";
      info.el.addEventListener("dblclick", () => {
        openDateActionModal(dateStr);
      });
    }
  });

  updateDdaySummary();
  calendar.render();
});
