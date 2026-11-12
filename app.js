const STORE_KEY = "coach-sportif-v1";

const DEFAULTS = {
  settings: {
    race1: "2027-03-07",
    race2: "2027-04-11",
    race3: "2027-10-10",
    weeklyKm: 20,
    paceSemi: "5:30",
    paceMarathon: "5:55"
  },
  sessions: [],
  tournaments: []
};

let state = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (raw && raw.settings) return { ...structuredClone(DEFAULTS), ...raw };
  } catch (e) {}
  return structuredClone(DEFAULTS);
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

const $ = (sel) => document.querySelector(sel);
const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric"
  });

function weeksBetween(fromIso, toIso) {
  return Math.floor((new Date(toIso) - new Date(fromIso)) / (7 * 86400000));
}

function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function paceToSec(p) {
  const [m, s] = p.split(":").map(Number);
  return (m || 0) * 60 + (s || 0);
}

/* ---------- Plans ---------- */

function planFor(raceIso, raceName, targetPace, lengthWeeks, baseKm) {
  const today = new Date().toISOString().slice(0, 10);
  const weeksLeft = weeksBetween(today, raceIso);
  if (weeksLeft < 1) return { raceName, raceIso, weeks: [], note: "Course passée ou cette semaine." };

  const startOffset = Math.max(0, lengthWeeks - weeksLeft);
  const weeks = [];
  for (let i = startOffset; i < lengthWeeks; i++) {
    const weeksToRace = lengthWeeks - i;
    const weekStart = addDays(raceIso, -7 * weeksToRace + 1);
    const progress = i / lengthWeeks;
    let phase, sessions;

    if (weeksToRace <= 2) {
      phase = "Affûtage";
      sessions = [
        { type: "Endurance fondamentale", km: Math.round(baseKm * 0.25) },
        { type: "Lignes droites", detail: "6 × 100 m souple", km: 4 },
        { type: `Sortie test ${raceName}`, detail: "20 min allure course", km: Math.round(baseKm * 0.35) }
      ];
    } else if (progress < 0.35) {
      phase = "Base";
      sessions = [
        { type: "Endurance fondamentale", km: Math.round(baseKm * 0.4) },
        { type: "Foulées / technique", detail: "8 × 100 m", km: 5 },
        { type: "Sortie longue", detail: "confort, talk-test", km: Math.round(baseKm * 0.55) }
      ];
    } else if (progress < 0.75) {
      phase = "Développement";
      sessions = [
        { type: "Fractionné", detail: `6-8 × 400 m à ${targetPace}/km -20 s`, km: Math.round(baseKm * 0.35) },
        { type: "Seuil", detail: `2 × 15 min à ${targetPace}/km +10 s`, km: Math.round(baseKm * 0.45) },
        { type: "Endurance fondamentale", km: Math.round(baseKm * 0.3) },
        { type: "Sortie longue", detail: `+10 min allure ${targetPace} en fin`, km: Math.round(baseKm * (0.6 + progress * 0.5)) }
      ];
    } else {
      phase = "Spécifique";
      sessions = [
        { type: "Allure course", detail: `3 × 2 km à ${targetPace}/km`, km: Math.round(baseKm * 0.45) },
        { type: "Endurance fondamentale", km: Math.round(baseKm * 0.3) },
        { type: "Seuil", detail: "1 × 20 min", km: Math.round(baseKm * 0.4) },
        { type: "Sortie longue", detail: "allure cible sur la 2e moitié", km: Math.round(baseKm * 0.85) }
      ];
    }
    weeks.push({ weekStart, weeksToRace, phase, sessions });
  }
  return { raceName, raceIso, weeks: weeks.reverse(), note: "" };
}

function renderPlans() {
  const s = state.settings;
  const plans = [
    planFor(s.race1, "Semi-marathon 1", s.paceSemi, 10, s.weeklyKm),
    planFor(s.race2, "Semi-marathon 2", s.paceSemi, 10, s.weeklyKm),
    planFor(s.race3, "Marathon", s.paceMarathon, 16, s.weeklyKm)
  ];
  const container = $("#plans-list");
  container.innerHTML = "";
  for (const plan of plans) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h3>${plan.raceName} — ${fmtDate(plan.raceIso)}</h3>`;
    if (plan.note) {
      card.innerHTML += `<p class="hint">${plan.note}</p>`;
    } else {
      for (const w of plan.weeks) {
        const row = document.createElement("div");
        row.className = "plan-week";
        const total = w.sessions.reduce((a, x) => a + (x.km || 0), 0);
        row.innerHTML = `
          <div class="week-label">S-${w.weeksToRace}<br><span class="phase-tag">${w.phase}</span></div>
          <div class="sessions">${w.sessions
            .map((x) => `<div>${x.type} — ${x.detail ? x.detail + " — " : ""}${x.km} km</div>`)
            .join("")}</div>
          <div class="meta">~${total} km<br>semaine du ${fmtDate(w.weekStart)}</div>`;
        card.appendChild(row);
      }
    }
    container.appendChild(card);
  }
}

/* ---------- Dashboard ---------- */

function renderCountdowns() {
  const s = state.settings;
  const today = new Date().toISOString().slice(0, 10);
  const races = [
    { name: "Semi-marathon 1", iso: s.race1 },
    { name: "Semi-marathon 2", iso: s.race2 },
    { name: "Marathon", iso: s.race3 }
  ];
  $("#countdowns").innerHTML = races
    .map((r) => {
      const days = Math.round((new Date(r.iso) - new Date(today)) / 86400000);
      const label = days > 0 ? `${days} jours` : days === 0 ? "Aujourd'hui !" : "Terminée";
      return `<div class="card countdown-card">
        <div class="race-name">${r.name}</div>
        <div class="days">${label}</div>
        <div class="date">${fmtDate(r.iso)}</div>
      </div>`;
    })
    .join("");
}

function currentWeekPlan() {
  const s = state.settings;
  const plans = [
    planFor(s.race1, "Semi 1", s.paceSemi, 10, s.weeklyKm),
    planFor(s.race3, "Marathon", s.paceMarathon, 16, s.weeklyKm)
  ];
  const today = new Date().toISOString().slice(0, 10);
  for (const p of plans) {
    const w = p.weeks.find((w) => w.weekStart <= today && today <= addDays(w.weekStart, 6));
    if (w) return { ...w, raceName: p.raceName };
  }
  return null;
}

function renderWeekPlan() {
  const w = currentWeekPlan();
  const el = $("#week-plan");
  if (!w) {
    el.innerHTML = `<p class="hint">Pas de plan actif cette semaine. Vérifie les dates de course dans « Réglages ». En attendant : 3 sorties faciles + 1 sortie longue.</p>`;
    return;
  }
  const total = w.sessions.reduce((a, x) => a + (x.km || 0), 0);
  el.innerHTML = `<h3>${w.raceName} — S-${w.weeksToRace} (${w.phase}) — ~${total} km</h3>` +
    w.sessions.map((x) => `<div>${x.type} — ${x.detail ? x.detail + " — " : ""}${x.km} km</div>`).join("");
}

function renderVolumeChart() {
  const el = $("#volume-chart");
  const weeks = [];
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - 7 * 7);
  for (let i = 0; i < 8; i++) {
    const start = new Date(monday);
    start.setDate(monday.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const km = state.sessions
      .filter((s) => {
        const d = new Date(s.date + "T00:00:00");
        return d >= start && d < end && s.distance;
      })
      .reduce((a, s) => a + Number(s.distance), 0);
    weeks.push({ label: `${start.getDate()}/${start.getMonth() + 1}`, km: Math.round(km * 10) / 10 });
  }
  const max = Math.max(...weeks.map((w) => w.km), 10);
  el.innerHTML = weeks
    .map((w) => `<div class="bar" style="height:${Math.max(2, (w.km / max) * 100)}%">
      <b>${w.km || ""}</b><span>${w.label}</span></div>`)
    .join("");
}

/* ---------- Journal ---------- */

function renderSessions() {
  const list = $("#sessions-list");
  const sessions = [...state.sessions].sort((a, b) => b.date.localeCompare(a.date));
  if (!sessions.length) {
    list.innerHTML = `<p class="hint">Aucune séance enregistrée.</p>`;
    return;
  }
  list.innerHTML = sessions
    .map(
      (s, i) => `<div class="session-row">
        <div><b>${fmtDate(s.date)}</b> — ${s.type}</div>
        <div class="meta">${s.duration ? s.duration + " min" : ""}${s.distance ? " · " + s.distance + " km" : ""}${s.feel ? " · ressenti " + s.feel + "/5" : ""}${s.notes ? " · " + s.notes : ""}</div>
        <button data-del="${state.sessions.indexOf(s)}">✕</button>
      </div>`
    )
    .join("");
  list.querySelectorAll("[data-del]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.sessions.splice(Number(btn.dataset.del), 1);
      save();
      renderAll();
    })
  );
}

/* ---------- Badminton ---------- */

function renderTournaments() {
  const list = $("#tournaments-list");
  const items = [...state.tournaments].sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) {
    list.innerHTML = `<p class="hint">Aucun tournoi enregistré.</p>`;
    return;
  }
  list.innerHTML = items
    .map(
      (t) => `<div class="session-row">
        <div><b>${fmtDate(t.date)}</b> — ${t.partner || "Doubles loisirs"}</div>
        <div class="meta">${t.result || ""}${t.notes ? " · " + t.notes : ""}</div>
        <button data-del="${state.tournaments.indexOf(t)}">✕</button>
      </div>`
    )
    .join("");
  list.querySelectorAll("[data-del]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.tournaments.splice(Number(btn.dataset.del), 1);
      save();
      renderAll();
    })
  );
}

/* ---------- Réglages ---------- */

function renderSettings() {
  const s = state.settings;
  $("#set-race1").value = s.race1;
  $("#set-race2").value = s.race2;
  $("#set-race3").value = s.race3;
  $("#set-weekly-km").value = s.weeklyKm;
  $("#set-pace-semi").value = s.paceSemi;
  $("#set-pace-marathon").value = s.paceMarathon;
}

/* ---------- Init ---------- */

function renderAll() {
  renderCountdowns();
  renderWeekPlan();
  renderVolumeChart();
  renderPlans();
  renderSessions();
  renderTournaments();
  renderSettings();
}

document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    $("#" + tab.dataset.tab).classList.add("active");
  })
);

$("#session-form").addEventListener("submit", (e) => {
  e.preventDefault();
  state.sessions.push({
    date: $("#s-date").value,
    type: $("#s-type").value,
    duration: Number($("#s-duration").value) || null,
    distance: $("#s-distance").value ? Number($("#s-distance").value) : null,
    feel: $("#s-feel").value ? Number($("#s-feel").value) : null,
    notes: $("#s-notes").value.trim()
  });
  save();
  e.target.reset();
  renderAll();
});

$("#tournament-form").addEventListener("submit", (e) => {
  e.preventDefault();
  state.tournaments.push({
    date: $("#t-date").value,
    partner: $("#t-partner").value.trim(),
    result: $("#t-result").value.trim(),
    notes: $("#t-notes").value.trim()
  });
  save();
  e.target.reset();
  renderAll();
});

$("#settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  state.settings = {
    race1: $("#set-race1").value || DEFAULTS.settings.race1,
    race2: $("#set-race2").value || DEFAULTS.settings.race2,
    race3: $("#set-race3").value || DEFAULTS.settings.race3,
    weeklyKm: Number($("#set-weekly-km").value) || DEFAULTS.settings.weeklyKm,
    paceSemi: $("#set-pace-semi").value.trim() || DEFAULTS.settings.paceSemi,
    paceMarathon: $("#set-pace-marathon").value.trim() || DEFAULTS.settings.paceMarathon
  };
  save();
  renderAll();
});

$("#reset-data").addEventListener("click", () => {
  if (confirm("Effacer toutes les données (séances, tournois, réglages) ?")) {
    localStorage.removeItem(STORE_KEY);
    state = load();
    renderAll();
  }
});

renderAll();
