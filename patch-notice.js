(() => {
  const PATCH_NOTICE_VERSION = "2026-03-17";
  const PATCH_NOTICE_STORAGE_KEY = "patchNotice:lastSeenVersion";
  const PATCH_NOTICE_TITLE = "3월 17일 패치 내용";
  const PATCH_NOTICE_ITEMS = [
    "하드모드 추가",
    "월루테마 추가(beta)",
    "🆕루틴 설정 기능"
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
        <button type="button" id="patchNoticeCloseBtn" class="modal-close-btn" aria-label="닫기">×</button>
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
    overlay.querySelector("#patchNoticeCloseBtn")?.addEventListener("click", () => {
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
