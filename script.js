let mode = "all"; // "all" 또는 "wrong"
const CUSTOM_WORDS_KEY = "customWords";
const CUSTOM_WORDS_SESSION_KEY = "customWordsSessionBackup";
let words = [];
let baseWords = [];
let currentWord = null;
let shuffledWords = [];
let currentIndex = 0;
let isChecking = false;
let wrongModePendingWords = [];
let studyTimerIntervalId = null;
let totalAttempts = parseInt(localStorage.getItem("totalAttempts") || "0", 10);
let correctAttempts = parseInt(localStorage.getItem("correctAttempts") || "0", 10);
let studyTimerState = JSON.parse(localStorage.getItem("studyTimerState")) || {
  date: null,
  elapsedMs: 0,
  isRunning: false,
  startedAt: null
};
localStorage.removeItem("correctWords");

// 기존 저장된 데이터 불러오기
let wrongWords = JSON.parse(localStorage.getItem("wrongWords")) || [];

function getCustomWords() {
  try {
    const localRaw = localStorage.getItem(CUSTOM_WORDS_KEY);
    const sessionRaw = sessionStorage.getItem(CUSTOM_WORDS_SESSION_KEY);
    const parsed = JSON.parse(localRaw || sessionRaw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to parse custom words from localStorage:", error);
    return [];
  }
}

function saveCustomWords(customWords) {
  const normalizedCustomWords = [...buildWordMap(customWords || []).values()];
  const serialized = JSON.stringify(normalizedCustomWords);
  localStorage.setItem(CUSTOM_WORDS_KEY, serialized);
  sessionStorage.setItem(CUSTOM_WORDS_SESSION_KEY, serialized);
  return normalizedCustomWords;
}

function mergeAndSaveCustomWords(incomingWords) {
  const customMap = buildWordMap(getCustomWords());
  (incomingWords || []).forEach(item => {
    if (!item || !item.word) return;
    customMap.set(String(item.word).trim(), {
      word: String(item.word).trim(),
      meanings: Array.isArray(item.meanings)
        ? item.meanings.map(v => String(v).trim()).filter(Boolean)
        : []
    });
  });
  return saveCustomWords([...customMap.values()]);
}

function getBaseWordSet() {
  return new Set((baseWords || []).map(item => item.word));
}

function buildWordMap(wordList) {
  const wordMap = new Map();
  wordList.forEach(item => {
    if (!item || !item.word) return;
    wordMap.set(String(item.word).trim(), {
      word: String(item.word).trim(),
      meanings: Array.isArray(item.meanings) ? item.meanings.map(v => String(v).trim()).filter(Boolean) : []
    });
  });
  return wordMap;
}

function rebuildWords() {
  const wordMap = buildWordMap(baseWords);
  getCustomWords().forEach(item => {
    if (!item || !item.word) return;
    wordMap.set(item.word, item);
  });
  words = [...wordMap.values()].filter(item => item.word && item.meanings.length > 0);
}

function resetQuizStateWithCurrentWords() {
  mode = "all";
  currentIndex = 0;
  isChecking = false;
  wrongModePendingWords = [];
  shuffledWords = shuffleArray([...words]);
  saveProgress();

  const resultElement = document.getElementById("result");
  const answerInput = document.getElementById("answer");
  if (resultElement) resultElement.innerText = "";
  if (answerInput) answerInput.value = "";

  showCurrentWord();
  if (answerInput) answerInput.focus();
}

function resetQuizStateWithPriorityWords(priorityWords) {
  mode = "all";
  currentIndex = 0;
  isChecking = false;
  wrongModePendingWords = [];

  const prioritySet = new Set((priorityWords || []).map(item => item.word));
  const restWords = shuffleArray(words.filter(item => !prioritySet.has(item.word)));
  shuffledWords = [...(priorityWords || []), ...restWords];
  saveProgress();

  const resultElement = document.getElementById("result");
  const answerInput = document.getElementById("answer");
  if (resultElement) resultElement.innerText = "";
  if (answerInput) answerInput.value = "";

  showCurrentWord();
  if (answerInput) answerInput.focus();
}

// JSON 불러오기
(async () => {
  try {
    const response = await fetch("words.json");
    const text = await response.text();
    let data = [];

    if (text.trim()) {
      const parsed = JSON.parse(text);
      data = Array.isArray(parsed) ? parsed : [];
    }

    baseWords = data;
  } catch (error) {
    console.error("words.json load failed. Falling back to custom words only:", error);
    baseWords = [];
  }

  rebuildWords();

  if (!loadProgress()) {
    shuffledWords = shuffleArray([...words]);
    currentIndex = 0;
    saveProgress();
  }

  updateAccuracy();
  showCurrentWord();
})();

document.addEventListener("DOMContentLoaded", () => {
  if (!sessionStorage.getItem("welcomePopupShown")) {
    showWelcomePopup();
    sessionStorage.setItem("welcomePopupShown", "true");
  }
  initializeStudyTimer();

  const answerInput = document.getElementById("answer");
  if (!answerInput) return;
  let isComposingAnswer = false;

  answerInput.addEventListener("compositionstart", () => {
    isComposingAnswer = true;
  });

  answerInput.addEventListener("compositionend", () => {
    isComposingAnswer = false;
  });

  answerInput.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    if (isComposingAnswer || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    checkAnswer();
  });

  const wordImportModal = document.getElementById("wordImportModal");
  if (wordImportModal) {
    wordImportModal.addEventListener("click", event => {
      if (event.target === wordImportModal) {
        closeWordImportModal();
      }
    });
  }

  const customWordsModal = document.getElementById("customWordsModal");
  if (customWordsModal) {
    customWordsModal.addEventListener("click", event => {
      if (event.target === customWordsModal) {
        closeCustomWordsModal();
      }
    });
  }
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
    `오늘 학습 종료하시겠습니끼❓\n\n순공시간 ${formatDuration(elapsedMs)} 이(가) ${today}에 저장됩니듀😄`
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

function getMeaningAnswerVariants(text) {
  const source = String(text || "");
  let variants = new Set([source]);

  // ()와 [] 내부 표기는 선택 입력으로 허용한다. 예: 견과(류) => 견과, 견과류
  const optionalPatterns = [/\(([^()]*)\)/g, /\[([^\[\]]*)\]/g];

  optionalPatterns.forEach(pattern => {
    let changed = true;
    while (changed) {
      changed = false;
      const nextVariants = new Set();

      variants.forEach(value => {
        const match = value.match(pattern);
        if (!match) {
          nextVariants.add(value);
          return;
        }

        changed = true;
        const full = match[0];
        const inner = match[1];
        nextVariants.add(value.replace(full, ""));
        nextVariants.add(value.replace(full, inner));
      });

      variants = nextVariants;
    }
  });

  return [...variants].map(normalizeMeaningText).filter(Boolean);
}

function parseMeaningInput(text) {
  return String(text)
    .split(",")
    .map(item => normalizeMeaningText(item))
    .filter(Boolean);
}

function parseWordImportText(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { items: [], error: "입력된 내용이 없어요." };
  }

  if (lines.length % 2 !== 0) {
    return { items: [], error: "영단어/뜻이 2줄씩 짝이 맞아야 해요." };
  }

  const items = [];

  for (let i = 0; i < lines.length; i += 2) {
    const word = lines[i];
    const meanings = lines[i + 1]
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);

    if (!word || meanings.length === 0) {
      return { items: [], error: "빈 단어 또는 뜻이 있어요." };
    }

    items.push({ word, meanings });
  }

  return { items, error: null };
}

function openWordImportModal() {
  const modal = document.getElementById("wordImportModal");
  const textarea = document.getElementById("wordImportTextarea");
  if (!modal || !textarea) return;

  modal.hidden = false;
  textarea.focus();
}

function closeWordImportModal() {
  const modal = document.getElementById("wordImportModal");
  if (!modal) return;
  modal.hidden = true;
}

function renderCustomWordsList() {
  const listEl = document.getElementById("customWordsList");
  const summaryEl = document.getElementById("customWordsSummary");
  if (!listEl || !summaryEl) return;

  const customWords = [...buildWordMap(getCustomWords()).values()]
    .sort((a, b) => a.word.localeCompare(b.word, "en", { sensitivity: "base" }));

  summaryEl.innerText = `${customWords.length}개`;

  if (customWords.length === 0) {
    listEl.innerHTML = '<p class="custom-words-empty">아직 추가한 단어가 없어요.</p>';
    return;
  }

  listEl.innerHTML = customWords
    .map(item => {
      const safeWord = escapeHtml(item.word);
      const safeMeanings = (Array.isArray(item.meanings) ? item.meanings : [])
        .map(meaning => escapeHtml(meaning))
        .join(", ");
      return `
        <div class="custom-word-item">
          <div class="custom-word-title">${safeWord}</div>
          <div class="custom-word-meanings">${safeMeanings}</div>
        </div>
      `;
    })
    .join("");
}

function openCustomWordsModal() {
  renderCustomWordsList();
  const modal = document.getElementById("customWordsModal");
  if (!modal) return;
  modal.hidden = false;
}

function closeCustomWordsModal() {
  const modal = document.getElementById("customWordsModal");
  if (!modal) return;
  modal.hidden = true;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function submitWordImport() {
  const textarea = document.getElementById("wordImportTextarea");
  if (!textarea) return;

  const { items, error } = parseWordImportText(textarea.value);
  if (error) {
    alert(error);
    return;
  }

  mergeAndSaveCustomWords(items);
  rebuildWords();
  renderCustomWordsList();
  resetQuizStateWithPriorityWords(items);

  alert(`${items.length}개 단어 추가 완료!`);
  textarea.value = "";
  closeWordImportModal();
}

function resetCustomWords() {
  const shouldReset = confirm("추가한 단어장만 초기화할까요? (기본 단어는 유지돼요)");
  if (!shouldReset) return;

  saveCustomWords([]);
  sessionStorage.removeItem(CUSTOM_WORDS_SESSION_KEY);
  rebuildWords();
  renderCustomWordsList();
  resetQuizStateWithCurrentWords();
  alert("추가한 단어장을 초기화했어요.");
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

function getWordsByWordList(wordList) {
  const wordSet = new Set(wordList);
  return words.filter(item => wordSet.has(item.word));
}

function showCurrentWord() {
  if (currentIndex >= shuffledWords.length) {
    if (mode === "wrong") {
      const remainingWrongWords = getWordsByWordList(wrongModePendingWords);
      if (remainingWrongWords.length > 0) {
        shuffledWords = shuffleArray([...remainingWrongWords]);
        currentIndex = 0;
        saveProgress();
        document.getElementById("result").innerText = "오답 다시 갑니두 😤";
      } else {
        document.getElementById("word").innerText = "오답 모드 올클리어 🎉";
        return;
      }
    } else {
      document.getElementById("word").innerText = "모든 문제 정복ㅋ 🎉";
      return;
    }
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
  wrongModePendingWords = [];
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
  wrongModePendingWords = [...wrongWords];
  const wrongOnlyWords = getWordsByWordList(wrongModePendingWords);

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
    const parsedSavedWords = JSON.parse(savedWords);
    const savedWordList = Array.isArray(parsedSavedWords) ? parsedSavedWords : [];
    const savedWordMap = new Map(
      savedWordList
        .filter(item => item && item.word)
        .map(item => [item.word, item])
    );

    const currentWordMap = new Map(words.map(item => [item.word, item]));
    const baseWordSet = getBaseWordSet();
    const recoveredCustomWords = [];

    // customWords 로드가 비어도, 저장된 진행목록에 있는 "기본 단어가 아닌 단어"는 복구한다.
    savedWordList.forEach(item => {
      if (!item || !item.word || !Array.isArray(item.meanings)) return;
      if (!baseWordSet.has(item.word) && !currentWordMap.has(item.word)) {
        const recoveredItem = {
          word: String(item.word).trim(),
          meanings: item.meanings.map(v => String(v).trim()).filter(Boolean)
        };
        if (!recoveredItem.word || recoveredItem.meanings.length === 0) return;
        currentWordMap.set(recoveredItem.word, recoveredItem);
        recoveredCustomWords.push(recoveredItem);
      }
    });

    if (recoveredCustomWords.length > 0) {
      const customMap = buildWordMap(getCustomWords());
      recoveredCustomWords.forEach(item => customMap.set(item.word, item));
      saveCustomWords([...customMap.values()]);
      words = [...currentWordMap.values()];
    }

    // 현재 단어장을 기준으로 저장된 순서를 최대한 유지하고, 새로 추가된 단어는 뒤에 붙인다.
    const restoredWords = [];
    savedWordMap.forEach((_, word) => {
      if (currentWordMap.has(word)) restoredWords.push(currentWordMap.get(word));
    });
    currentWordMap.forEach((item, word) => {
      if (!savedWordMap.has(word)) restoredWords.push(item);
    });

    shuffledWords = restoredWords;
    currentIndex = Math.min(parseInt(savedIndex, 10) || 0, Math.max(restoredWords.length - 1, 0));
    saveProgress();
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

  const normalizedCorrectMeanings = new Set(
    currentWord.meanings.flatMap(getMeaningAnswerVariants)
  );
  const userAnswers = parseMeaningInput(userInput);

  const isCorrect =
    userAnswers.length > 0 &&
    userAnswers.every(answer => normalizedCorrectMeanings.has(answer));

  if (isCorrect) {
    result.innerText = "정답입니두 😎";
    correctAttempts++;

    if (mode === "wrong") {
      wrongModePendingWords = wrongModePendingWords.filter(word => word !== currentWord.word);
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
  wrongWords = [];
  wrongModePendingWords = [];
  totalAttempts = 0;
  correctAttempts = 0;

  // localStorage 정리
  localStorage.removeItem("shuffledWords");
  localStorage.removeItem("currentIndex");
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
