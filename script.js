let mode = "all"; // "all" 또는 "wrong"
let words = [];
let currentWord = null;
let shuffledWords = [];
let currentIndex = 0;

window.addEventListener("DOMContentLoaded", () => {
  alert("반가워요! 오늘도 힘내볼까요?");
});

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

    showCurrentWord();
  });

document.addEventListener("DOMContentLoaded", () => {
  const answerInput = document.getElementById("answer");
  if (!answerInput) return;

  answerInput.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    checkAnswer();
  });
});

function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

function showCurrentWord() {
  if (currentIndex >= shuffledWords.length) {
    document.getElementById("word").innerText = "모든 문제 완료 🎉";
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
  showCurrentWord();
  document.getElementById("answer").focus();
}

function setWrongMode() {
  mode = "wrong";
  const wrongWordSet = new Set(wrongWords);
  const wrongOnlyWords = words.filter(item => wrongWordSet.has(item.word));

  if (wrongOnlyWords.length === 0) {
    alert("오답 기록이 없어요.");
    return;
  }

  shuffledWords = shuffleArray([...wrongOnlyWords]);
  currentIndex = 0;
  document.getElementById("result").innerText = "";
  document.getElementById("answer").value = "";
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
  const userInput = document.getElementById("answer").value.trim();
  const result = document.getElementById("result");
  const wordElement = document.getElementById("word");
  const answerInput = document.getElementById("answer");

  const isCorrect = currentWord.meanings.some(
    meaning => meaning === userInput
  );

  if (isCorrect) {
    result.innerText = "정답 😎";

    if (!correctWords.includes(currentWord.word)) {
      correctWords.push(currentWord.word);
      localStorage.setItem("correctWords", JSON.stringify(correctWords));
    }
  } else {
    result.innerText = "오답 ❌";

    if (!wrongWords.includes(currentWord.word)) {
      wrongWords.push(currentWord.word);
      localStorage.setItem("wrongWords", JSON.stringify(wrongWords));
    }
  }

  wordElement.innerText =
    currentWord.word + " : " + currentWord.meanings.join(", ");

  answerInput.value = "";

  setTimeout(() => {
    currentIndex++;
    saveProgress();
    showCurrentWord();
    result.innerText = "";
    answerInput.focus();
  }, 1500);
}

function resetProgress() {
  const confirmReset = confirm("정말 처음부터 다시 시작하시겠습니까?");
  if (!confirmReset) return;

  // 진행 상태 초기화
  currentIndex = 0;

  // 단어 다시 섞기
  shuffledWords = shuffleArray([...words]);
  correctWords = [];
  wrongWords = [];

  // localStorage 정리
  localStorage.removeItem("shuffledWords");
  localStorage.removeItem("currentIndex");
  localStorage.removeItem("correctWords");
  localStorage.removeItem("wrongWords");
  saveProgress();

  // 화면 초기화
  document.getElementById("result").innerText = "";
  document.getElementById("answer").value = "";

  // 첫 문제 표시
  showCurrentWord();
}
