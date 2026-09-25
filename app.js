const STORAGE_KEY = "mi_calendario_personal_clean_v1";
const NOTES_KEY = "mi_calendario_personal_notes_v1";

let selectedDate = todayString();
let currentFilter = "today";
let calendarMonth = new Date();
let browseMonth = new Date();

const $ = id => document.getElementById(id);

function todayString() {
  return formatDate(new Date());
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateFromString(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(s, n) {
  const d = dateFromString(s);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

function dateText(s) {
  return dateFromString(s).toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

function load() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function save(a) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
}

function loadNotes() {
  return JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");
}

function saveNotes(a) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(a));
}

function esc(v) {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

/* =========================
   PENDIENTES
========================= */

function seed() {
  if (load().length) return;

  const d = todayString();

  save([
    {
      id: crypto.randomUUID(),
      title: "Desayunar",
      date: d,
      time: "08:00",
      repeat: "once",
      reminder: "10",
      status: "done",
      pinned: false,
      series: null
    },
    {
      id: crypto.randomUUID(),
      title: "Bañar a Emma",
      date: d,
      time: "15:00",
      repeat: "once",
      reminder: "10",
      status: "pending",
      pinned: false,
      series: null
    },
    {
      id: crypto.randomUUID(),
      title: "Enviar constancia de trabajo",
      date: d,
      time: "17:30",
      repeat: "once",
      reminder: "10",
      status: "pending",
      pinned: false,
      series: null
    },
    {
      id: crypto.randomUUID(),
      title: "Entrenar",
      date: d,
      time: "21:00",
      repeat: "daily",
      reminder: "10",
      status: "pending",
      pinned: false,
      series: crypto.randomUUID()
    }
  ]);
}

function occurrenceDates(task, from, to) {
  const out = [];
  const start = dateFromString(task.date);
  const end = dateFromString(to);
  let d = new Date(start);

  while (d <= end) {
    const s = formatDate(d);

    if (s >= from) {
      const daysSince = Math.round((d - start) / 86400000);
      const weekday = d.getDay();

      const ok =
        task.repeat === "daily" ||
        (task.repeat === "weekdays" && weekday >= 1 && weekday <= 5) ||
        (task.repeat === "weekly" && daysSince % 7 === 0) ||
        task.repeat === "once";

      if (ok) out.push(s);
    }

    if (task.repeat === "once") break;

    d.setDate(d.getDate() + 1);
  }

  return out;
}

function expandTasks() {
  const base = load();
  const result = [];

  const rangeStart =
    currentFilter === "past"
      ? "2000-01-01"
      : currentFilter === "future"
      ? todayString()
      : selectedDate;

  const rangeEnd =
    currentFilter === "past"
      ? todayString()
      : currentFilter === "future"
      ? "2035-12-31"
      : selectedDate;

  base.forEach(task => {
    const dates = occurrenceDates(task, rangeStart, rangeEnd);

    dates.forEach(date => {
      const occurrenceId = `${task.id}_${date}`;
      const stored = localStorage.getItem("status_" + occurrenceId);

      result.push({
        ...task,
        pinned: !!task.pinned,
        occurrenceId,
        date,
        status: stored || task.status
      });
    });
  });

  return result;
}

/* =========================
   IMPORTANTES
========================= */

function renderPriority() {
  const container = $("priorityList");
  if (!container) return;

  const tasks = load().filter(t => t.pinned);
  const notes = loadNotes().filter(n => n.pinned);

  if (!tasks.length && !notes.length) {
    container.innerHTML =
      '<div class="empty">Todavía no tienes nada pineado.</div>';
    return;
  }

  let html = "";

  tasks.forEach(task => {
    html += `
      <article class="task pinned-task"
        data-priority-task="${task.id}">
        <div class="task-time">${esc(task.time)}</div>
        <div class="task-state">📌</div>
        <div class="task-body">
          <div class="task-title">${esc(task.title)}</div>
          <div class="task-meta">
            ${esc(dateText(task.date))}
          </div>
        </div>
      </article>
    `;
  });

  notes.forEach(note => {
    html += `
      <article class="task pinned-note"
        data-priority-note="${note.id}">
        <div class="task-time">📌</div>
        <div class="task-state">📝</div>
        <div class="task-body">
          <div class="task-title">${esc(note.title)}</div>
          <div class="task-meta">Nota importante</div>
        </div>
      </article>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll("[data-priority-task]").forEach(el => {
    el.onclick = () => {
      const id = el.dataset.priorityTask;
      const task = load().find(t => t.id === id);

      if (task) {
        selectedDate = task.date;
        currentFilter = "today";
        render();
        openTask(task.id, task.date);
      }
    };
  });

  container.querySelectorAll("[data-priority-note]").forEach(el => {
    el.onclick = () => {
      const note = loadNotes().find(
        n => n.id === el.dataset.priorityNote
      );

      if (note) openNoteDetail(note);
    };
  });
}

/* =========================
   RENDER PENDIENTES
========================= */

function render() {
  $("currentDate").textContent = dateText(selectedDate);
  $("currentYear").textContent =
    dateFromString(selectedDate).getFullYear();

  document
    .querySelectorAll(".filter[data-filter]")
    .forEach(b =>
      b.classList.toggle(
        "active",
        b.dataset.filter === currentFilter
      )
    );

  renderPriority();
  renderNotes();

  let tasks = expandTasks();

  if (currentFilter === "today") {
    tasks = tasks.filter(t => t.date === selectedDate);
  }

  if (currentFilter === "future") {
    tasks = tasks.filter(t => t.date > todayString());
  }

  if (currentFilter === "past") {
    tasks = tasks.filter(t => t.date < todayString());
  }

  tasks.sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return b.pinned ? 1 : -1;
    }

    return (
      a.date.localeCompare(b.date) ||
      a.time.localeCompare(b.time)
    );
  });

  $("sectionTitle").textContent =
    currentFilter === "today"
      ? "PENDIENTES DE HOY"
      : currentFilter === "future"
      ? "PRÓXIMOS"
      : currentFilter === "past"
      ? "PASADOS"
      : "TODAS LAS FECHAS";

  $("taskCount").textContent = tasks.length;

  if (!tasks.length) {
    $("taskList").innerHTML =
      '<div class="empty">No hay pendientes aquí.<br><br>Agrega uno con el botón de abajo.</div>';
    return;
  }

  $("taskList").innerHTML = tasks.map(t => {
    const symbol =
      t.status === "done"
        ? "✓"
        : t.status === "notdone"
        ? "×"
        : "◷";

    const repeat =
      t.repeat !== "once" ? "↻ " : "";

    const pin = t.pinned ? " 📌" : "";

    return `
      <article
        class="task ${t.status}"
        data-id="${t.id}"
        data-date="${t.date}"
      >
        <div class="task-time">${esc(t.time)}</div>
        <div class="task-state">${symbol}</div>

        <div class="task-body">
          <div class="task-title">
            ${esc(t.title)}${pin}
          </div>

          <div class="task-meta">
            ${
              currentFilter !== "today"
                ? esc(dateText(t.date)) + " · "
                : ""
            }
            ${repeat}
            ${
              t.reminder === "10"
                ? "10 min antes"
                : t.reminder === "none"
                ? "sin aviso"
                : t.reminder + " min antes"
            }
          </div>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".task[data-id]").forEach(el => {
    el.onclick = () =>
      openTask(el.dataset.id, el.dataset.date);
  });
}

/* =========================
   CALENDARIO PARA AGREGAR
========================= */

function renderCalendar() {
  const c = $("calendarPicker");
  if (!c) return;

  const y = calendarMonth.getFullYear();
  const m = calendarMonth.getMonth();

  const first = new Date(y, m, 1);
  const start = (first.getDay() + 6) % 7;
  const total = new Date(y, m + 1, 0).getDate();
  const prevTotal = new Date(y, m, 0).getDate();

  let h = `
    <div class="calendar-head">
      <strong>
        ${calendarMonth.toLocaleDateString("es-PE", {
          month: "long",
          year: "numeric"
        })}
      </strong>

      <div class="calendar-nav">
        <button type="button" id="calPrev">‹</button>
        <button type="button" id="calNext">›</button>
      </div>
    </div>

    <div class="calendar-week">
      ${["L","M","M","J","V","S","D"]
        .map(x => `<span>${x}</span>`)
        .join("")}
    </div>

    <div class="calendar-grid">
  `;

  for (let i = 0; i < 42; i++) {
    const n = i - start + 1;
    let dt;

    if (n < 1) {
      dt = new Date(y, m - 1, prevTotal + n);
    } else if (n > total) {
      dt = new Date(y, m + 1, n - total);
    } else {
      dt = new Date(y, m, n);
    }

    const ds = formatDate(dt);
    const selected = ds === $("taskDate").value;
    const muted = dt.getMonth() !== m;
    const isToday = ds === todayString();

    h += `
      <button
        type="button"
        class="calendar-day ${muted ? "muted" : ""} ${selected ? "selected" : ""} ${isToday ? "today" : ""}"
        data-date="${ds}"
      >
        ${dt.getDate()}
      </button>
    `;
  }

  c.innerHTML = h + "</div>";

  $("calPrev").onclick = () => {
    calendarMonth = new Date(y, m - 1, 1);
    renderCalendar();
  };

  $("calNext").onclick = () => {
    calendarMonth = new Date(y, m + 1, 1);
    renderCalendar();
  };

  c.querySelectorAll(".calendar-day").forEach(b => {
    b.onclick = () => {
      $("taskDate").value = b.dataset.date;

      const d = dateFromString(b.dataset.date);

      calendarMonth = new Date(
        d.getFullYear(),
        d.getMonth(),
        1
      );

      renderCalendar();
    };
  });
}

/* =========================
   MINI CALENDARIO DE FILTRO
========================= */

function renderBrowseCalendar() {
  const c = $("browseCalendar");
  if (!c) return;

  const y = browseMonth.getFullYear();
  const m = browseMonth.getMonth();

  const first = new Date(y, m, 1);
  const start = (first.getDay() + 6) % 7;
  const total = new Date(y, m + 1, 0).getDate();
  const prevTotal = new Date(y, m, 0).getDate();

  let h = `
    <div class="calendar-head">
      <strong>
        ${browseMonth.toLocaleDateString("es-PE", {
          month: "long",
          year: "numeric"
        })}
      </strong>

      <div class="calendar-nav">
        <button type="button" id="browsePrev">‹</button>
        <button type="button" id="browseNext">›</button>
      </div>
    </div>

    <div class="calendar-week">
      ${["L","M","M","J","V","S","D"]
        .map(x => `<span>${x}</span>`)
        .join("")}
    </div>

    <div class="calendar-grid">
  `;

  for (let i = 0; i < 42; i++) {
    const n = i - start + 1;
    let dt;

    if (n < 1) {
      dt = new Date(y, m - 1, prevTotal + n);
    } else if (n > total) {
      dt = new Date(y, m + 1, n - total);
    } else {
      dt = new Date(y, m, n);
    }

    const ds = formatDate(dt);

    h += `
      <button
        type="button"
        class="calendar-day
          ${dt.getMonth() !== m ? "muted" : ""}
          ${ds === selectedDate ? "selected" : ""}
          ${ds === todayString() ? "today" : ""}"
        data-date="${ds}"
      >
        ${dt.getDate()}
      </button>
    `;
  }

  c.innerHTML = h + "</div>";

  $("browsePrev").onclick = () => {
    browseMonth = new Date(y, m - 1, 1);
    renderBrowseCalendar();
  };

  $("browseNext").onclick = () => {
    browseMonth = new Date(y, m + 1, 1);
    renderBrowseCalendar();
  };

  c.querySelectorAll(".calendar-day").forEach(b => {
    b.onclick = () => {
      selectedDate = b.dataset.date;
      currentFilter = "today";

      $("calendarDialog").close();
      render();
    };
  });
}

/* =========================
   PENDIENTE DETALLE
========================= */

function openTask(id, date) {
  const t = expandTasks().find(
    x => x.id === id && x.date === date
  );

  if (!t) return;

  $("detailContent").innerHTML = `
    <div class="dialog-head">
      <div>
        <div class="eyebrow">PENDIENTE</div>
        <h2>${t.pinned ? "📌 " : ""}${esc(t.title)}</h2>
      </div>

      <button class="close-btn" id="detailClose">×</button>
    </div>

    <div style="padding:0 20px;color:var(--muted);font-size:12px">
      ${esc(dateText(t.date))} · ${esc(t.time)}
      ${t.repeat !== "once" ? " · ↻ repetitivo" : ""}
    </div>

    <div class="detail-actions">
      <button class="action-btn" data-status="done">
        <b>✓</b>Realizado
      </button>

      <button class="action-btn" data-status="notdone">
        <b>×</b>No realizado
      </button>

      <button class="action-btn" data-status="pending">
        <b>◷</b>Pendiente
      </button>
    </div>

    <div class="quick-actions">

      <button class="action-btn" id="pinBtn">
        ${t.pinned ? "📌 Quitar prioridad" : "📌 Pinear como prioridad"}
      </button>

      <button class="action-btn" id="tomorrowBtn">
        Mañana · misma hora
      </button>

      <button class="action-btn" id="editBtn">
        Cambiar fecha/hora
      </button>

      <button class="action-btn" id="deleteBtn">
        Eliminar
      </button>

    </div>
  `;

  $("taskDetailDialog").showModal();

  $("detailClose").onclick = () =>
    $("taskDetailDialog").close();

  document.querySelectorAll("[data-status]").forEach(b => {
    b.onclick = () => {
      localStorage.setItem(
        "status_" + t.occurrenceId,
        b.dataset.status
      );

      $("taskDetailDialog").close();
      render();
    };
  });

  $("pinBtn").onclick = () => {
    const all = load();
    const base = all.find(x => x.id === t.id);

    if (base) {
      base.pinned = !base.pinned;
      save(all);
    }

    $("taskDetailDialog").close();
    render();
  };

  $("tomorrowBtn").onclick = () => {
    const tomorrow = addDays(t.date, 1);
    const all = load();
    const base = all.find(x => x.id === t.id);

    if (base && base.repeat === "once") {
      base.date = tomorrow;
      base.status = "pending";
      save(all);

    } else if (base) {

      localStorage.setItem(
        "status_" + t.occurrenceId,
        "notdone"
      );

      const moved = {
        id: crypto.randomUUID(),
        title: base.title,
        date: tomorrow,
        time: base.time,
        repeat: "once",
        reminder: base.reminder,
        status: "pending",
        pinned: base.pinned || false,
        series: null
      };

      all.push(moved);
      save(all);
    }

    $("taskDetailDialog").close();

    selectedDate = tomorrow;
    currentFilter = "today";

    render();
  };

  $("editBtn").onclick = () => {
    $("taskDetailDialog").close();
    openEdit(t);
  };

  $("deleteBtn").onclick = () => {
    if (!confirm("¿Eliminar este pendiente?")) return;

    save(load().filter(x => x.id !== t.id));

    $("taskDetailDialog").close();
    render();
  };
}

/* =========================
   EDITAR PENDIENTE
========================= */

function openEdit(t) {
  $("detailContent").innerHTML = `
    <div class="dialog-head">
      <div>
        <div class="eyebrow">REPROGRAMAR</div>
        <h2>Editar pendiente</h2>
      </div>

      <button class="close-btn" id="editClose">×</button>
    </div>

    <form id="editForm">

      <label>
        Pendiente
        <input
          id="editTitle"
          required
          value="${esc(t.title)}"
        >
      </label>

      <label>
        Fecha
        <input
          id="editDate"
          type="date"
          required
          value="${t.date}"
        >
      </label>

      <label>
        Hora
        <input
          id="editTime"
          type="time"
          required
          value="${t.time}"
        >
      </label>

      <button class="primary-btn">
        Guardar cambios
      </button>

    </form>
  `;

  $("taskDetailDialog").showModal();

  $("editClose").onclick = () =>
    $("taskDetailDialog").close();

  $("editForm").onsubmit = e => {
    e.preventDefault();

    const a = load();
    const base = a.find(x => x.id === t.id);

    if (!base) return;

    Object.assign(base, {
      title: $("editTitle").value.trim(),
      date: $("editDate").value,
      time: $("editTime").value,
      status: "pending"
    });

    save(a);

    selectedDate = base.date;
    currentFilter = "today";

    $("taskDetailDialog").close();

    render();
  };
}

/* =========================
   NOTAS
========================= */

function renderNotes() {
  const container = $("notesList");
  if (!container) return;

  const notes = loadNotes();

  if (!notes.length) {
    container.innerHTML =
      '<div class="empty">Todavía no tienes notas.</div>';
    return;
  }

  container.innerHTML = notes.map(note => `
    <article
      class="note-card"
      data-note-id="${note.id}"
    >

      <div class="note-head">
        <strong>
          ${note.pinned ? "📌 " : "📝 "}
          ${esc(note.title)}
        </strong>

        <button
          class="note-more"
          type="button"
          data-note-menu="${note.id}"
        >
          •••
        </button>
      </div>

      ${
        note.text
          ? `<div class="note-text">${esc(note.text)}</div>`
          : ""
      }

      ${
        note.link
          ? `<a
               class="link-btn"
               href="${esc(note.link)}"
               target="_blank"
               rel="noopener"
             >
               🔗 Abrir enlace
             </a>`
          : ""
      }

    </article>
  `).join("");

  document.querySelectorAll(".note-card").forEach(card => {
    card.onclick = e => {
      if (e.target.closest(".note-more")) return;

      const note = notes.find(
        n => n.id === card.dataset.noteId
      );

      if (note) openNoteDetail(note);
    };
  });

  document.querySelectorAll("[data-note-menu]").forEach(button => {
    button.onclick = e => {
      e.stopPropagation();

      const note = notes.find(
        n => n.id === button.dataset.noteMenu
      );

      if (!note) return;

      openNoteDetail(note);
    };
  });
}

function openNoteDetail(note) {
  $("noteDetailContent").innerHTML = `
    <div class="dialog-head">
      <div>
        <div class="eyebrow">NOTA</div>

        <h2>
          ${note.pinned ? "📌 " : ""}
          ${esc(note.title)}
        </h2>
      </div>

      <button class="close-btn" id="closeNoteDetail">
        ×
      </button>
    </div>

    <div style="padding:0 20px 20px">
      ${
        note.text
          ? `<div class="note-detail">${esc(note.text)}</div>`
          : ""
      }

      ${
        note.link
          ? `
            <a
              class="link-btn"
              href="${esc(note.link)}"
              target="_blank"
              rel="noopener"
            >
              🔗 Abrir enlace
            </a>
          `
          : ""
      }

      <div class="quick-actions">

        <button class="action-btn" id="notePinBtn">
          ${
            note.pinned
              ? "📌 Quitar prioridad"
              : "📌 Marcar como prioridad"
          }
        </button>

        <button class="action-btn" id="noteEditBtn">
          Editar
        </button>

        <button class="action-btn" id="noteDeleteBtn">
          Eliminar
        </button>

      </div>
    </div>
  `;

  $("noteDetailDialog").showModal();

  $("closeNoteDetail").onclick = () =>
    $("noteDetailDialog").close();

  $("notePinBtn").onclick = () => {
    const notes = loadNotes();
    const base = notes.find(n => n.id === note.id);

    if (base) {
      base.pinned = !base.pinned;
      saveNotes(notes);
    }

    $("noteDetailDialog").close();
    render();
  };

  $("noteEditBtn").onclick = () => {
    $("noteDetailDialog").close();
    openNoteEdit(note);
  };

  $("noteDeleteBtn").onclick = () => {
    if (!confirm("¿Eliminar esta nota?")) return;

    saveNotes(
      loadNotes().filter(n => n.id !== note.id)
    );

    $("noteDetailDialog").close();

    render();
  };
}

function openNoteEdit(note) {
  $("noteDialogTitle").textContent = "Editar nota";

  $("noteTitle").value = note.title;
  $("noteText").value = note.text || "";
  $("noteLink").value = note.link || "";
  $("notePinned").checked = !!note.pinned;

  $("noteForm").dataset.editId = note.id;

  $("noteDialog").showModal();
}

/* =========================
   NAVEGACIÓN
========================= */

$("prevDay").onclick = () => {
  selectedDate = addDays(selectedDate, -1);
  currentFilter = "today";
  render();
};

$("nextDay").onclick = () => {
  selectedDate = addDays(selectedDate, 1);
  currentFilter = "today";
  render();
};

document
  .querySelectorAll(".filter[data-filter]")
  .forEach(b => {
    b.onclick = () => {
      currentFilter = b.dataset.filter;

      if (currentFilter === "today") {
        selectedDate = todayString();
      }

      render();
    };
  });

/* =========================
   MINI CALENDARIO DE FECHA
========================= */

$("datePickerBtn").onclick = () => {
  browseMonth = dateFromString(selectedDate);

  $("calendarDialog").showModal();

  renderBrowseCalendar();
};

$("closeCalendarDialog").onclick = () =>
  $("calendarDialog").close();

/* =========================
   AGREGAR PENDIENTE
========================= */

$("addBtn").onclick = () => {
  $("taskForm").reset();

  $("taskDate").value = selectedDate;

  calendarMonth = new Date(
    dateFromString(selectedDate).getFullYear(),
    dateFromString(selectedDate).getMonth(),
    1
  );

  renderCalendar();

  $("taskDialog").showModal();
};

$("closeDialog").onclick = () =>
  $("taskDialog").close();

$("taskForm").onsubmit = e => {
  e.preventDefault();

  const task = {
    id: crypto.randomUUID(),
    title: $("title").value.trim(),
    date: $("taskDate").value,
    time: $("taskTime").value,
    repeat: $("repeat").value,
    reminder: $("reminder").value,
    status: "pending",
    pinned: false,
    series: null
  };

  const a = load();

  a.push(task);

  save(a);

  selectedDate = task.date;
  currentFilter = "today";

  $("taskForm").reset();
  $("taskDialog").close();

  render();
};

/* =========================
   AGREGAR / EDITAR NOTA
========================= */

$("addNoteBtn").onclick = () => {
  $("noteDialogTitle").textContent = "Nueva nota";

  $("noteForm").reset();
  delete $("noteForm").dataset.editId;

  $("noteDialog").showModal();
};

$("closeNoteDialog").onclick = () =>
  $("noteDialog").close();

$("noteForm").onsubmit = e => {
  e.preventDefault();

  const notes = loadNotes();
  const editId = $("noteForm").dataset.editId;

  if (editId) {
    const note = notes.find(n => n.id === editId);

    if (note) {
      note.title = $("noteTitle").value.trim();
      note.text = $("noteText").value.trim();
      note.link = $("noteLink").value.trim();
      note.pinned = $("notePinned").checked;
    }

  } else {

    notes.push({
      id: crypto.randomUUID(),
      title: $("noteTitle").value.trim(),
      text: $("noteText").value.trim(),
      link: $("noteLink").value.trim(),
      pinned: $("notePinned").checked
    });
  }

  saveNotes(notes);

  $("noteForm").reset();
  delete $("noteForm").dataset.editId;

  $("noteDialog").close();

  render();
};

/* =========================
   SETTINGS
========================= */

$("settingsBtn").onclick = () =>
  alert("Aquí añadiremos después las notificaciones y el calendario compartido.");

/* =========================
   INICIAR
========================= */

seed();
render();
// Conectar botón para agregar notas
const addNoteBtn = document.getElementById("addNoteBtn");
const noteDialog = document.getElementById("noteDialog");

if (addNoteBtn && noteDialog) {
  addNoteBtn.addEventListener("click", () => {
    noteDialog.showModal();
  });
}
