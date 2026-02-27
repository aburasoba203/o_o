(() => {
  const PATCH_NOTICE_VERSION = "2026-02-27-01-3";
  const PATCH_NOTICE_STORAGE_KEY = "patchNotice:lastSeenVersion";
  const PATCH_NOTICE_TITLE = "패치 내용";
  const PATCH_NOTICE_ITEMS = [
    "모바일 UI 개선ㅎ",
    "꾸미기 모드 편의성 개선",
    "꾸미기 팝업 위치 조정",
    "스티커 크기 단위 변경",
    "TO-DO 기능 추가"
  ];

  function hasSeenCurrentNotice() {
    return localStorage.getItem(PATCH_NOTICE_STORAGE_KEY) === PATCH_NOTICE_VERSION;
  }

  function markNoticeSeen() {
    localStorage.setItem(PATCH_NOTICE_STORAGE_KEY, PATCH_NOTICE_VERSION);
  }

  function closeNotice(overlay) {
    markNoticeSeen();
    overlay.remove();
  }

  function openPatchNotice() {
    if (hasSeenCurrentNotice()) return;
    if (document.getElementById("patchNoticeOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "patchNoticeOverlay";
    overlay.className = "calendar-modal-overlay";
    overlay.style.zIndex = "10001";

    const itemsHtml = PATCH_NOTICE_ITEMS.map(item => `<li>${item}</li>`).join("");
    overlay.innerHTML = `
      <div class="calendar-modal" role="dialog" aria-modal="true" aria-label="패치 안내">
        <p class="calendar-modal-title">${PATCH_NOTICE_TITLE} (${PATCH_NOTICE_VERSION})</p>
        <ul style="margin: 0 0 12px 18px; padding: 0; color: #1c1436;">
          ${itemsHtml}
        </ul>
        <div class="calendar-modal-actions">
          <button type="button" id="patchNoticeConfirmBtn">확인</button>
        </div>
      </div>
    `;

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        closeNotice(overlay);
      }
    });

    overlay.querySelector("#patchNoticeConfirmBtn")?.addEventListener("click", () => {
      closeNotice(overlay);
    });

    const onEsc = event => {
      if (event.key === "Escape") {
        closeNotice(overlay);
        window.removeEventListener("keydown", onEsc);
      }
    };
    window.addEventListener("keydown", onEsc);

    document.body.appendChild(overlay);
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(openPatchNotice, 120);
  });
})();
