let mode = "all"; // "all" 또는 "wrong"
let words = [];
let currentWord = null;
let shuffledWords = [];
let currentIndex = 0;
let isChecking = false;
let studyTimerIntervalId = null;
let totalAttempts = parseInt(localStorage.getItem("totalAttempts") || "0", 10);
let correctAttempts = parseInt(localStorage.getItem("correctAttempts") || "0", 10);
let studyTimerState = JSON.parse(localStorage.getItem("studyTimerState")) || {
  date: null,
  elapsedMs: 0,
  isRunning: false,
  startedAt: null
};

// 기존 저장된 데이터 불러오기
let correctWords = JSON.parse(localStorage.getItem("correctWords")) || [];
let wrongWords = JSON.parse(localStorage.getItem("wrongWords")) || [];

// JSON 불러오기
fetch("words.json")
  .then(response => response.json())
  .then(data => {
    words = data;

    if (!loadProgress()) {
      shuffledWords = shuffleArray([...words]);
      currentIndex = 0;
      saveProgress();
    }

    updateAccuracy();
    showCurrentWord();
  });

document.addEventListener("DOMContentLoaded", () => {
  if (!sessionStorage.getItem("welcomePopupShown")) {
    showWelcomePopup();
    sessionStorage.setItem("welcomePopupShown", "true");
  }
  initializeStudyTimer();

  const answerInput = document.getElementById("answer");
  if (!answerInput) return;

  answerInput.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    checkAnswer();
  });
});

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayStudyTimeStore() {
  return JSON.parse(localStorage.getItem("studyTime")) || {};
}

function saveStudyTimerState() {
  localStorage.setItem("studyTimerState", JSON.stringify(studyTimerState));
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
    `오늘 학습 종료하시겠습니끼❓\n\n순공시간 ${formatDuration(elapsedMs)} 이(가) ${today}에 저장됩니듀😄`
  );
  if (!shouldEnd) return;

  const studyTime = getTodayStudyTimeStore();
  studyTime[today] = (studyTime[today] || 0) + elapsedMs;
  localStorage.setItem("studyTime", JSON.stringify(studyTime));

  resetStudyTimerStateForToday();
  stopStudyTimerTick();
  updateStudyTimerDisplay();

  alert(`오늘 순공시간 ${formatDuration(elapsedMs)} 저장 완료! 캘린더에서 확인할 수 있습니듀😄`);
}

function markAttendanceAndGoCalendar() {
  const attendance = JSON.parse(localStorage.getItem("attendance")) || {};
  attendance[getTodayDateString()] = true;
  localStorage.setItem("attendance", JSON.stringify(attendance));
  location.href = "calendar.html";
}

function showWelcomePopup() {
  const overlay = document.createElement("div");
  overlay.className = "welcome-popup-overlay";
  overlay.innerHTML = `
    <div class="welcome-popup" role="dialog" aria-modal="true" aria-label="출석 체크">
      <p class="welcome-popup-message">반갑습니두! 오늘도 힘내볼끼끼❓</p>
      <div class="welcome-popup-actions">
        <button type="button" id="attendanceCheckBtn">출석체크</button>
        <button type="button" id="welcomeCloseBtn" class="small-btn">닫기</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closePopup = () => overlay.remove();
  overlay.querySelector("#attendanceCheckBtn").addEventListener("click", markAttendanceAndGoCalendar);
  overlay.querySelector("#welcomeCloseBtn").addEventListener("click", closePopup);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) closePopup();
  });
}

function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

function normalizeMeaningText(text) {
  return String(text)
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function parseMeaningInput(text) {
  return String(text)
    .split(",")
    .map(item => normalizeMeaningText(item))
    .filter(Boolean);
}

function saveAccuracy() {
  localStorage.setItem("totalAttempts", totalAttempts);
  localStorage.setItem("correctAttempts", correctAttempts);
}

function updateAccuracy() {
  const accuracyElement = document.getElementById("accuracy");
  if (!accuracyElement) return;

  if (totalAttempts === 0) {
    accuracyElement.innerText = "정답률: 0% (0/0)";
    return;
  }

  const accuracy = Math.round((correctAttempts / totalAttempts) * 100);
  accuracyElement.innerText =
    `정답률: ${accuracy}% (${correctAttempts}/${totalAttempts})`;
}

function showCurrentWord() {
  if (currentIndex >= shuffledWords.length) {
    document.getElementById("word").innerText = "모든 문제 정복ㅋ 🎉";
    return;
  }

  currentWord = shuffledWords[currentIndex];
  document.getElementById("word").innerText = currentWord.word;

  updateProgress();
}

function updateProgress() {
  document.getElementById("progress").innerText =
    (currentIndex + 1) + " / " + shuffledWords.length;
}

function setAllMode() {
  mode = "all";
  shuffledWords = shuffleArray([...words]);
  currentIndex = 0;
  saveProgress();
  document.getElementById("result").innerText = "";
  document.getElementById("answer").value = "";
  isChecking = false;
  showCurrentWord();
  document.getElementById("answer").focus();
}

function setWrongMode() {
  mode = "wrong";
  const wrongWordSet = new Set(wrongWords);
  const wrongOnlyWords = words.filter(item => wrongWordSet.has(item.word));

  if (wrongOnlyWords.length === 0) {
    alert("오답 기록이 없습니두ㅋ");
    return;
  }

  shuffledWords = shuffleArray([...wrongOnlyWords]);
  currentIndex = 0;
  document.getElementById("result").innerText = "";
  document.getElementById("answer").value = "";
  isChecking = false;
  showCurrentWord();
  document.getElementById("answer").focus();
}

function saveProgress() {
  localStorage.setItem("shuffledWords", JSON.stringify(shuffledWords));
  localStorage.setItem("currentIndex", currentIndex);
}

function loadProgress() {
  const savedWords = localStorage.getItem("shuffledWords");
  const savedIndex = localStorage.getItem("currentIndex");

  if (savedWords && savedIndex !== null) {
    shuffledWords = JSON.parse(savedWords);
    currentIndex = parseInt(savedIndex, 10);
    return true;
  }
  return false;
}

function checkAnswer() {
  if (isChecking) return;

  const userInput = document.getElementById("answer").value.trim();
  const result = document.getElementById("result");
  const wordElement = document.getElementById("word");
  const answerInput = document.getElementById("answer");
  if (!currentWord || userInput === "") return;

  isChecking = true;

  const normalizedCorrectMeanings = currentWord.meanings.map(normalizeMeaningText);
  const userAnswers = parseMeaningInput(userInput);

  const isCorrect =
    userAnswers.length > 0 &&
    userAnswers.every(answer => normalizedCorrectMeanings.includes(answer));

  if (isCorrect) {
    result.innerText = "정답입니두 😎";
    correctAttempts++;

    if (!correctWords.includes(currentWord.word)) {
      correctWords.push(currentWord.word);
      localStorage.setItem("correctWords", JSON.stringify(correctWords));
    }
  } else {
    result.innerText = "틀렸습니두ㅋ 😅";

    if (!wrongWords.includes(currentWord.word)) {
      wrongWords.push(currentWord.word);
      localStorage.setItem("wrongWords", JSON.stringify(wrongWords));
    }
  }
  totalAttempts++;
  saveAccuracy();
  updateAccuracy();

  wordElement.innerText =
    currentWord.word + " : " + currentWord.meanings.join(", ");

  answerInput.value = "";

  setTimeout(() => {
    currentIndex++;
    saveProgress();
    showCurrentWord();
    result.innerText = "";
    isChecking = false;
    answerInput.focus();
  }, 1500);
}

function resetProgress() {
  const confirmReset = confirm("정말 처음부터 다시 시작하시겠습니끼❓");
  if (!confirmReset) return;

  // 진행 상태 초기화
  currentIndex = 0;

  // 단어 다시 섞기
  shuffledWords = shuffleArray([...words]);
  correctWords = [];
  wrongWords = [];
  totalAttempts = 0;
  correctAttempts = 0;

  // localStorage 정리
  localStorage.removeItem("shuffledWords");
  localStorage.removeItem("currentIndex");
  localStorage.removeItem("correctWords");
  localStorage.removeItem("wrongWords");
  localStorage.removeItem("totalAttempts");
  localStorage.removeItem("correctAttempts");
  saveProgress();

  // 화면 초기화
  document.getElementById("result").innerText = "";
  document.getElementById("answer").value = "";
  isChecking = false;
  updateAccuracy();

  // 첫 문제 표시
  showCurrentWord();
}
