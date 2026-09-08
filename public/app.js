"use strict";

const MINUTE = 60 * 1000;
const ENTRY_DURATION = 10 * MINUTE;
const BATTLE_DURATION = 10 * MINUTE;
const WAIT_DURATION = 7 * 60 * MINUTE + 50 * MINUTE;
const CYCLE_DURATION = ENTRY_DURATION + BATTLE_DURATION + WAIT_DURATION;

// Os dados são carregados de bosses.js antes deste arquivo.

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  day: "2-digit",
  month: "short"
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

const shortTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const grid = document.querySelector("#boss-grid");
const installButton = document.querySelector("#install-button");
const toast = document.querySelector("#toast");
let deferredInstallPrompt = null;

let toastTimer = null;

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function getBossState(boss, nowMs) {
  // Recalcular pelo relógio evita acumular atrasos de setInterval.
  // Módulo positivo também extrapola ciclos anteriores à referência.
  const elapsed = positiveModulo(nowMs - boss.anchorMs, CYCLE_DURATION);
  const cycleStart = nowMs - elapsed;

  if (elapsed < ENTRY_DURATION) {
    return {
      phase: "entry",
      status: "Entrada aberta",
      label: "entrada fecha em",
      remaining: ENTRY_DURATION - elapsed,
      phaseDuration: ENTRY_DURATION,
      phaseElapsed: elapsed,
      nextSpawn: cycleStart + CYCLE_DURATION,
      eventTime: cycleStart
    };
  }

  if (elapsed < ENTRY_DURATION + BATTLE_DURATION) {
    return {
      phase: "battle",
      status: "Em batalha",
      label: "batalha termina em",
      remaining: ENTRY_DURATION + BATTLE_DURATION - elapsed,
      phaseDuration: BATTLE_DURATION,
      phaseElapsed: elapsed - ENTRY_DURATION,
      nextSpawn: cycleStart + CYCLE_DURATION,
      eventTime: cycleStart + ENTRY_DURATION
    };
  }

  return {
    phase: "wait",
    status: "Aguardando",
    label: "até surgir",
    remaining: CYCLE_DURATION - elapsed,
    phaseDuration: WAIT_DURATION,
    phaseElapsed: elapsed - ENTRY_DURATION - BATTLE_DURATION,
    nextSpawn: cycleStart + CYCLE_DURATION,
    eventTime: cycleStart + CYCLE_DURATION
  };
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function locationIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
}

function createBossCards() {
  grid.innerHTML = bosses.map((boss) => `
    <article class="boss-card" id="boss-${boss.id}" data-phase="wait">
      <div>
        <p class="boss-level">NÍVEL ${boss.level}</p>
        <h3 class="boss-name">${boss.name}</h3>
        <p class="boss-location">${locationIcon()}<span>${boss.location}</span></p>
      </div>
      <div class="boss-timing">
        <span class="status">Aguardando</span>
        <strong class="boss-countdown">--:--:--</strong>
        <span class="boss-next">Próximo: --:--</span>
      </div>
      <div class="progress-track" aria-hidden="true"><div class="progress-fill"></div></div>
    </article>
  `).join("");
}

function updateCard(boss, state) {
  const card = document.querySelector(`#boss-${boss.id}`);
  card.dataset.phase = state.phase;
  card.querySelector(".status").textContent = state.status;
  card.querySelector(".boss-countdown").textContent = formatDuration(state.remaining);
  card.querySelector(".boss-next").textContent = state.phase === "entry"
    ? `Aberto desde ${shortTimeFormatter.format(new Date(state.eventTime))}`
    : `Próximo: ${shortTimeFormatter.format(new Date(state.nextSpawn))}`;
  const progress = Math.min(100, Math.max(0, (state.phaseElapsed / state.phaseDuration) * 100));
  card.querySelector(".progress-fill").style.width = `${progress}%`;
}

function getPriority(state) {
  if (state.phase === "entry") return 0;
  if (state.phase === "wait") return 1;
  return 2;
}

function updateHero(states) {
  const selected = [...states].sort((a, b) => {
    const phaseDifference = getPriority(a.state) - getPriority(b.state);
    return phaseDifference || a.state.remaining - b.state.remaining;
  })[0];

  const { boss, state } = selected;
  const title = state.phase === "entry"
    ? `${boss.name} está com entrada aberta`
    : state.phase === "battle"
      ? `${boss.name} está em batalha`
      : `${boss.name} surge às ${shortTimeFormatter.format(new Date(state.nextSpawn))}`;

  document.querySelector("#next-title").textContent = title;
  document.querySelector("#next-meta").textContent = `Nível ${boss.level} · ${boss.location}`;
  document.querySelector("#hero-countdown").textContent = formatDuration(state.remaining);
  document.querySelector("#hero-countdown-label").textContent = state.label;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.setAttribute("aria-hidden", "false");
  toast.classList.add("visible");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("visible");
    toast.setAttribute("aria-hidden", "true");
  }, 3600);
}

function updateClock(now) {
  document.querySelector("#current-date").textContent = dateFormatter.format(now).replace(".", "");
  document.querySelector("#current-time").textContent = timeFormatter.format(now);
}

function render() {
  const now = new Date();
  const nowMs = now.getTime();
  const states = bosses.map((boss) => ({ boss, state: getBossState(boss, nowMs) }));
  updateClock(now);
  states.forEach(({ boss, state }) => updateCard(boss, state));
  updateHero(states);
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installButton.hidden = true;
  showToast("Boss Watch instalado.");
});

// Mantém os arquivos disponíveis offline após o primeiro carregamento.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (error) {
      console.error("Não foi possível ativar o modo offline:", error);
    }
  });
}

document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });

createBossCards();
render();
window.setInterval(render, 1000);
