(() => {
  const STORAGE_KEY = "dailyRoutineByWeekdayV3";
  const TOGGLE_KEY = "routineBannerVisible";
  const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  function readRoutineStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function timeToMinutes(time) {
    const [hours, minutes] = String(time || "00:00").split(":").map(Number);
    return (hours * 60) + minutes;
  }

  function isMinuteInRoutine(routine, totalMinutes) {
    const startMinutes = Number.isFinite(routine.startMinutes) ? routine.startMinutes : timeToMinutes(routine.start);
    const endMinutes = Number.isFinite(routine.endMinutes) ? routine.endMinutes : timeToMinutes(routine.end);
    if (endMinutes > startMinutes) {
      return totalMinutes >= startMinutes && totalMinutes < endMinutes;
    }
    return totalMinutes >= startMinutes || totalMinutes < endMinutes;
  }

  function getCurrentLiveRoutine() {
    const now = new Date();
    const weekdayKey = WEEKDAY_KEYS[now.getDay()];
    const totalMinutes = (now.getHours() * 60) + now.getMinutes();
    const store = readRoutineStore();
    const routines = Array.isArray(store[weekdayKey]) ? store[weekdayKey] : [];
    return routines.find(routine => routine && routine.title && isMinuteInRoutine(routine, totalMinutes)) || null;
  }

  function ensureBanner() {
    let banner = document.getElementById("routineNowBanner");
    if (banner) return banner;

    let host = document.getElementById("globalRoutineBannerHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "globalRoutineBannerHost";
      host.className = "global-routine-banner-host";

      banner = document.createElement("div");
      banner.id = "routineNowBanner";
      banner.className = "routine-now-banner global-routine-banner";
      host.appendChild(banner);

      const preferredContainer = document.querySelector(".calendar-container, .container");
      const nav = document.querySelector(".app-nav");
      if (preferredContainer) {
        preferredContainer.insertBefore(host, preferredContainer.firstChild);
      } else if (nav?.parentNode) {
        nav.parentNode.insertBefore(host, nav.nextSibling);
      } else {
        document.body.prepend(host);
      }
    }

    applyToggleState();
    return banner;
  }

  function applyToggleState() {
    const host = document.getElementById("globalRoutineBannerHost");
    const banner = document.getElementById("routineNowBanner");
    const isVisible = localStorage.getItem(TOGGLE_KEY) !== "false";
    if (banner) {
      banner.hidden = !isVisible;
    }
    if (host) {
      host.classList.toggle("is-collapsed", !isVisible);
    }
  }

  function renderBanner() {
    const banner = ensureBanner();
    applyToggleState();
    if (banner.hidden) return;
    const routine = getCurrentLiveRoutine();
    if (!routine) {
      banner.classList.remove("has-routine");
      banner.textContent = "지금은 쉬는 시간입니두.";
      return;
    }

    const title = String(routine.title || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    banner.classList.add("has-routine");
    banner.innerHTML = `지금은 <span class="routine-now-title">${title}</span>을 할 시간입니두.`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderBanner();
    setInterval(renderBanner, 1000);
  });
})();
