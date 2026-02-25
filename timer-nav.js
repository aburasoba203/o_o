let studyTimerIntervalId = null;
let studyTimerState = JSON.parse(localStorage.getItem("studyTimerState")) || {
  date: null,
  elapsedMs: 0,
  isRunning: false,
  startedAt: null
};

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function saveStudyTimerState() {
  localStorage.setItem("studyTimerState", JSON.stringify(studyTimerState));
}

function getTodayStudyTimeStore() {
  return JSON.parse(localStorage.getItem("studyTime")) || {};
}

function resetStudyTimerStateForToday() {
  studyTimerState = {
    date: getTodayDateString(),
    elapsedMs: 0,
    isRunning: false,
    startedAt: null
  };
  saveStudyTimerState();
}

function ensureStudyTimerDate() {
  const today = getTodayDateString();
  if (studyTimerState.date !== today) {
    stopStudyTimerTick();
    resetStudyTimerStateForToday();
  }
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(Math.max(ms, 0) / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function getCurrentStudyElapsedMs() {
  if (!studyTimerState.isRunning || !studyTimerState.startedAt) {
    return studyTimerState.elapsedMs || 0;
  }
  return (studyTimerState.elapsedMs || 0) + (Date.now() - studyTimerState.startedAt);
}

function updateStudyTimerDisplay() {
  const displayButton = document.getElementById("studyTimerDisplay");
  if (!displayButton) return;

  const elapsedMs = getCurrentStudyElapsedMs();
  displayButton.innerText = `순공 ${formatDuration(elapsedMs)}`;
  displayButton.classList.toggle("running", !!studyTimerState.isRunning);
  displayButton.title = studyTimerState.isRunning
    ? "클릭하면 일시정지 여부를 물어봐요"
    : "클릭하면 다시 시작할지 물어봐요";

  updateStudyTimerActionButton();
}

function updateStudyTimerActionButton() {
  const actionButton = document.getElementById("studyTimerActionBtn");
  if (!actionButton) return;

  if (studyTimerState.isRunning) {
    actionButton.innerText = "순공 타이머 일시정지";
    return;
  }

  if ((studyTimerState.elapsedMs || 0) > 0) {
    actionButton.innerText = "순공 타이머 이어하기";
    return;
  }

  actionButton.innerText = "순공 타이머 시작";
}

function stopStudyTimerTick() {
  if (!studyTimerIntervalId) return;
  clearInterval(studyTimerIntervalId);
  studyTimerIntervalId = null;
}

function startStudyTimerTick() {
  stopStudyTimerTick();
  studyTimerIntervalId = setInterval(updateStudyTimerDisplay, 1000);
}

function initializeStudyTimer() {
  ensureStudyTimerDate();
  updateStudyTimerDisplay();
  if (studyTimerState.isRunning) {
    startStudyTimerTick();
  }
}

function startStudyTimer() {
  ensureStudyTimerDate();
  if (studyTimerState.isRunning) return;

  studyTimerState.isRunning = true;
  studyTimerState.startedAt = Date.now();
  saveStudyTimerState();
  startStudyTimerTick();
  updateStudyTimerDisplay();
}

function pauseStudyTimer() {
  if (!studyTimerState.isRunning) return;

  studyTimerState.elapsedMs = getCurrentStudyElapsedMs();
  studyTimerState.isRunning = false;
  studyTimerState.startedAt = null;
  saveStudyTimerState();
  stopStudyTimerTick();
  updateStudyTimerDisplay();
}

function handleStudyTimerActionButtonClick() {
  ensureStudyTimerDate();

  if (studyTimerState.isRunning) {
    pauseStudyTimer();
    return;
  }

  startStudyTimer();
}

function handleTimerDisplayClick() {
  ensureStudyTimerDate();

  if (studyTimerState.isRunning) {
    if (confirm("순공 타이머를 일시정지할끼끼❓")) {
      pauseStudyTimer();
    }
    return;
  }

  if ((studyTimerState.elapsedMs || 0) > 0) {
    if (confirm("타이머 일시정지 상태입니두. 다시 시작할끼끼❓")) {
      startStudyTimer();
    }
    return;
  }

  alert("먼저 '순공 타이머 시작' 버튼을 눌러주세듀😁");
}

function endStudySession() {
  ensureStudyTimerDate();
  const elapsedMs = getCurrentStudyElapsedMs();

  if (elapsedMs < 1000) {
    alert("기록할 순공 시간이 아직 없어요.");
    return;
  }

  const today = getTodayDateString();
  const shouldEnd = confirm(
    `오늘 학습 종료하시겠습니까?\n\n순공시간 ${formatDuration(elapsedMs)} 이(가) ${today}에 저장됩니다.`
  );
  if (!shouldEnd) return;

  const studyTime = getTodayStudyTimeStore();
  studyTime[today] = (studyTime[today] || 0) + elapsedMs;
  const todayTotalMs = studyTime[today];
  localStorage.setItem("studyTime", JSON.stringify(studyTime));

  resetStudyTimerStateForToday();
  stopStudyTimerTick();
  updateStudyTimerDisplay();

  alert(
    `이번 순공 ${formatDuration(elapsedMs)} 저장 완료!\n오늘 누적 순공 ${formatDuration(todayTotalMs)} (캘린더 반영)`
  );
}

document.addEventListener("DOMContentLoaded", initializeStudyTimer);
