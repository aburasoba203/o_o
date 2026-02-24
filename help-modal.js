let helpModalReadmeCache = null;

async function loadReadmeText() {
  if (helpModalReadmeCache !== null) return helpModalReadmeCache;

  try {
    const response = await fetch("README.md");
    const text = await response.text();
    helpModalReadmeCache = text.trim() ? text : "README.md가 비어 있어요.";
  } catch (error) {
    console.error("README.md load failed:", error);
    helpModalReadmeCache = "README.md를 불러오지 못했어요.";
  }

  return helpModalReadmeCache;
}

async function openHelpModal() {
  const existing = document.getElementById("helpModalOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "helpModalOverlay";
  overlay.className = "help-modal-overlay";
  overlay.innerHTML = `
    <div class="help-modal" role="dialog" aria-modal="true" aria-label="도움말">
      <div class="help-modal-header">
        <h2>도움말 (README)</h2>
        <button type="button" class="small-btn" id="helpModalCloseBtn">닫기</button>
      </div>
      <pre id="helpModalContent" class="help-modal-content">불러오는 중...</pre>
    </div>
  `;

  const closeModal = () => overlay.remove();

  overlay.querySelector("#helpModalCloseBtn").addEventListener("click", closeModal);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeModal();
  });

  document.body.appendChild(overlay);

  const contentEl = overlay.querySelector("#helpModalContent");
  contentEl.textContent = await loadReadmeText();
}

function injectHelpButton() {
  const navLinks = document.querySelector(".app-nav .nav-links");
  if (!navLinks) return;
  if (navLinks.querySelector("[data-help-nav-btn]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "shift-btn";
  button.dataset.helpNavBtn = "true";
  button.textContent = "도움말";
  button.addEventListener("click", openHelpModal);
  navLinks.appendChild(button);
}

document.addEventListener("DOMContentLoaded", injectHelpButton);
