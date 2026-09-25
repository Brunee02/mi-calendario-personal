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
  const dateInput = $("taskDate");
  if (!c || !dateInput) return;

  calendarMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1
  );

  const y = calendarMonth.getFullYear();
  const m = calendarMonth.getMonth();
  const first = new Date(y, m, 1);
  const start = (first.getDay() + 6) % 7;
  const total = new Date(y, m + 1, 0).getDate();
  const prevTotal = new Date(y, m, 0).getDate();

  let h = `
    <div class="calendar-head">
      <strong>${calendarMonth.toLocaleDateString("es-PE", {
        month: "long",
        year: "numeric"
      })}</strong>
      <div class="calendar-nav">
        <button type="button" class="calendar-nav-btn" data-calendar-nav="prev" aria-label="Mes anterior">‹</button>
        <button type="button" class="calendar-nav-btn" data-calendar-nav="next" aria-label="Mes siguiente">›</button>
      </div>
    </div>
    <div class="calendar-week">
      ${["L","M","M","J","V","S","D"].map(x => `<span>${x}</span>`).join("")}
    </div>
    <div class="calendar-grid">
  `;

  for (let i = 0; i < 42; i++) {
    const n = i - start + 1;
    let dt;
    if (n < 1) dt = new Date(y, m - 1, prevTotal + n);
    else if (n > total) dt = new Date(y, m + 1, n - total);
    else dt = new Date(y, m, n);

    const ds = formatDate(dt);
    h += `
      <button type="button"
        class="calendar-day ${dt.getMonth() !== m ? "muted" : ""} ${ds === dateInput.value ? "selected" : ""} ${ds === todayString() ? "today" : ""}"
        data-calendar-date="${ds}"
        aria-label="${ds}">
        ${dt.getDate()}
      </button>
    `;
  }

  c.innerHTML = h + "</div>";

  // iPhone/Safari: usar handlers directos + pointer/touch, sin delegación.
  const prev = c.querySelector('[data-calendar-nav="prev"]');
  const next = c.querySelector('[data-calendar-nav="next"]');

  const goMonth = direction => {
    calendarMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + direction,
      1
    );
    renderCalendar();
  };

  if (prev) {
    prev.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      goMonth(-1);
    };
  }

  if (next) {
    next.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      goMonth(1);
    };
  }

  c.querySelectorAll("[data-calendar-date]").forEach(button => {
    button.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      const chosenDate = button.dataset.calendarDate;
      dateInput.value = chosenDate;
      const d = dateFromString(chosenDate);
      calendarMonth = new Date(d.getFullYear(), d.getMonth(), 1);
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
    window.selectedDate = tomorrow;
    window.currentFilter = "today";

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
   INICIAR
========================= */

seed();
render();
/* =========================
   VERSION FINAL - MEJORAS
   ========================= */
(function(){
  const FINAL_KEY="mi_calendario_final_settings_v1";
  let finalSearch="", finalCategory="all", finalPriority="all", finalMonth=false, finalEditing=null;
  const q=id=>document.getElementById(id);
  const getTasks=()=>{try{return JSON.parse(localStorage.getItem("mi_calendario_personal_clean_v1")||"[]")}catch{return[]}};
  const putTasks=a=>localStorage.setItem("mi_calendario_personal_clean_v1",JSON.stringify(a));
  const getNotes=()=>{try{return JSON.parse(localStorage.getItem("mi_calendario_personal_notes_v1")||"[]")}catch{return[]}};
  const putNotes=a=>localStorage.setItem("mi_calendario_personal_notes_v1",JSON.stringify(a));
  const day=s=>new Date(...s.split('-').map((v,i)=>i===1?+v-1:+v));
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const txt=s=>day(s).toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'});
  const esc2=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const norm=()=>{let a=getTasks().map(t=>({...t,pinned:!!t.pinned,priority:t.priority||'medium',category:t.category||''}));putTasks(a);let n=getNotes().map(x=>({...x,pinned:!!x.pinned,category:x.category||''}));putNotes(n);};
  norm();

  function cats(){return [...new Set([...getTasks().map(t=>t.category).filter(Boolean),...getNotes().map(n=>n.category).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'es'));}
  function fillCats(){const c=cats();const s=q('categoryFilter');if(s){s.innerHTML='<option value="all">Todas las categorías</option>'+c.map(x=>`<option value="${esc2(x)}">${esc2(x)}</option>`).join('');s.value=c.includes(finalCategory)?finalCategory:'all';finalCategory=s.value;}const d=q('categoryOptions');if(d)d.innerHTML=c.map(x=>`<option value="${esc2(x)}">`).join('');}
  function searchMatch(t){if(!finalSearch)return true;return `${t.title} ${t.category||''} ${t.date} ${txt(t.date)}`.toLowerCase().includes(finalSearch)}
  function rebuildList(){
    const list=q('taskList'); if(!list||finalMonth)return;
    let tasks=[];
    const base=getTasks();
    base.forEach(t=>{
      let d=new Date(...t.date.split('-').map((v,i)=>i===1?+v-1:+v));
      const limit=new Date(2035,11,31), from=new Date(2000,0,1);
      while(d<=limit){const ds=fmt(d),weekday=d.getDay(),ok=t.repeat==='daily'||(t.repeat==='weekdays'&&weekday>=1&&weekday<=5)||(t.repeat==='weekly'&&Math.round((d-new Date(...t.date.split('-').map((v,i)=>i===1?+v-1:+v)))/86400000)%7===0)||t.repeat==='once';if(ok){const inFilter=window.currentFilter;let show=inFilter==='today'?ds===window.selectedDate:inFilter==='future'?ds>fmt(new Date()):inFilter==='past'?ds<fmt(new Date()):true;if(show)tasks.push({...t,date:ds,status:localStorage.getItem('status_'+t.id+'_'+ds)||t.status});}if(t.repeat==='once')break;d.setDate(d.getDate()+1);}
    });
    tasks=tasks.filter(t=>searchMatch(t)&&(finalCategory==='all'||t.category===finalCategory)&&(finalPriority==='all'||(t.priority||'medium')===finalPriority));
    tasks.sort((a,b)=>Number(b.pinned)-Number(a.pinned)||a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
    q('taskCount').textContent=tasks.length;
    if(!tasks.length){list.innerHTML='<div class="empty">No hay pendientes que coincidan.<br><br>Agrega uno con el botón de abajo.</div>';return;}
    list.innerHTML=tasks.map(t=>{const sym=t.status==='done'?'✓':t.status==='notdone'?'×':'◷';const pr=t.priority||'medium';const pl=pr==='high'?'Alta':pr==='low'?'Baja':'Media';const meta=[window.currentFilter!=='today'?txt(t.date):'',t.repeat!=='once'?'↻ repetitivo':'',pl,t.category||'',t.reminder==='none'?'sin aviso':t.reminder==='0'?'a la hora':`${t.reminder} min antes`].filter(Boolean).join(' · ');return `<article class="task ${t.status} ${t.pinned?'pinned-task':''}" data-id="${esc2(t.id)}" data-date="${esc2(t.date)}"><div class="task-time">${esc2(t.time)}</div><div class="task-state">${sym}</div><div class="task-body"><div class="task-title">${t.pinned?'📌 ':''}${esc2(t.title)}</div><div class="task-meta">${esc2(meta)}</div></div><span class="priority-dot priority-dot-${pr}"></span></article>`}).join('');
    list.querySelectorAll('.task[data-id]').forEach(el=>el.onclick=()=>window.openTask(el.dataset.id,el.dataset.date));
  }
  function renderMonth(){
    const c=q('monthCalendar');if(!c)return;const base=new Date(window.calendarMonth||new Date()),y=base.getFullYear(),m=base.getMonth(),first=new Date(y,m,1),start=(first.getDay()+6)%7,total=new Date(y,m+1,0).getDate(),prev=new Date(y,m,0).getDate();
    const tasks=getTasks(),items={};tasks.forEach(t=>{let d=new Date(...t.date.split('-').map((v,i)=>i===1?+v-1:+v));const end=new Date(y,m+1,0);while(d<=end){const ds=fmt(d),wd=d.getDay(),ok=t.repeat==='daily'||(t.repeat==='weekdays'&&wd>=1&&wd<=5)||(t.repeat==='weekly'&&Math.round((d-new Date(...t.date.split('-').map((v,i)=>i===1?+v-1:+v)))/86400000)%7===0)||t.repeat==='once';if(ok&&(ds>=fmt(first)&&ds<=fmt(end))) (items[ds]??=[]).push({...t,date:ds});if(t.repeat==='once')break;d.setDate(d.getDate()+1);}});
    q('monthTitle').textContent=base.toLocaleDateString('es-PE',{month:'long',year:'numeric'}).toUpperCase();q('monthTaskCount').textContent=Object.values(items).reduce((n,a)=>n+a.length,0)+' pendientes';
    let h=`<div class="calendar-head"><strong>${base.toLocaleDateString('es-PE',{month:'long',year:'numeric'})}</strong><div class="calendar-nav"><button type="button" id="finalMonthPrev">‹</button><button type="button" id="finalMonthNext">›</button></div></div><div class="calendar-week">${['L','M','M','J','V','S','D'].map(x=>`<span>${x}</span>`).join('')}</div><div class="month-grid">`;
    for(let i=0;i<42;i++){const n=i-start+1;let dt=n<1?new Date(y,m-1,prev+n):n>total?new Date(y,m+1,n-total):new Date(y,m,n),ds=fmt(dt),arr=items[ds]||[];h+=`<button type="button" class="month-cell ${dt.getMonth()!==m?'muted':''} ${ds===fmt(new Date())?'today':''} ${ds===window.selectedDate?'selected':''}" data-month-date="${ds}"><span class="month-day-number">${dt.getDate()}</span>${arr.slice(0,3).map(t=>`<span class="month-item ${t.priority==='high'?'high':''}">${t.pinned?'📌 ':''}${esc2(t.title)}</span>`).join('')}${arr.length>3?`<span class="month-more">+${arr.length-3} más</span>`:''}</button>`}h+='</div>';c.innerHTML=h;q('finalMonthPrev').onclick=()=>{window.calendarMonth=new Date(y,m-1,1);renderMonth()};q('finalMonthNext').onclick=()=>{window.calendarMonth=new Date(y,m+1,1);renderMonth()};c.querySelectorAll('[data-month-date]').forEach(b=>b.onclick=()=>{window.selectedDate=b.dataset.monthDate;window.currentFilter='today';finalMonth=false;q('monthSection').classList.add('hidden');q('daySection').classList.remove('hidden');q('monthViewBtn').classList.remove('active');q('dayViewBtn').classList.add('active');if(typeof window.render==='function')window.render();rebuildList();});
  }
  const originalRender=window.render;
  window.render=function(){if(originalRender)originalRender();fillCats();if(finalMonth){q('monthSection').classList.remove('hidden');q('daySection').classList.add('hidden');renderMonth();}else{q('monthSection').classList.add('hidden');q('daySection').classList.remove('hidden');rebuildList();}updateNotificationUI();};
  window.currentFilter=window.currentFilter||'today';window.selectedDate=window.selectedDate||fmt(new Date());window.calendarMonth=window.calendarMonth||new Date();
  q('searchInput').oninput=e=>{finalSearch=e.target.value.trim().toLowerCase();rebuildList();renderNotesFinal();};
  q('categoryFilter').onchange=e=>{finalCategory=e.target.value;rebuildList();renderNotesFinal();};
  q('priorityFilter').onchange=e=>{finalPriority=e.target.value;rebuildList();};
  q('dayViewBtn').onclick=()=>{finalMonth=false;q('dayViewBtn').classList.add('active');q('monthViewBtn').classList.remove('active');window.render();};
  q('monthViewBtn').onclick=()=>{finalMonth=true;window.calendarMonth=day(window.selectedDate);q('monthViewBtn').classList.add('active');q('dayViewBtn').classList.remove('active');window.render();};
  function renderNotesFinal(){const c=q('notesList');if(!c)return;let n=getNotes().filter(x=>!finalSearch||`${x.title} ${x.text||''} ${x.category||''}`.toLowerCase().includes(finalSearch)).filter(x=>finalCategory==='all'||x.category===finalCategory);if(!n.length){c.innerHTML='<div class="empty">No hay notas que coincidan.</div>';return;}c.querySelectorAll('.note-card').forEach(()=>{});}
  function updateNotificationUI(){const t=q('notificationTitle'),s=q('notificationStatus');if(!t||!s)return;if(!('Notification'in window)){t.textContent='Notificaciones no disponibles';s.textContent='En iPhone, instala esta app en la pantalla de inicio para usar notificaciones.';}else if(Notification.permission==='granted'){t.textContent='Notificaciones activadas';s.textContent='Avisos mientras esta página esté abierta.';}else if(Notification.permission==='denied'){t.textContent='Notificaciones bloqueadas';s.textContent='Permítelas desde la configuración del navegador.';}else{t.textContent='Activar notificaciones';s.textContent='Avisos del navegador para tus pendientes.';}}
  function requestNotifications(){if(!('Notification'in window)){alert('En iPhone, agrega esta app a la pantalla de inicio y vuelve a abrirla desde allí para habilitar las notificaciones.');return;}Notification.requestPermission().then(()=>{updateNotificationUI();});}
  const REM='mi_calendario_personal_reminders_v2';
  function checkReminders(){if(!('Notification'in window)||Notification.permission!=='granted')return;let sent={};try{sent=JSON.parse(localStorage.getItem(REM)||'{}')}catch{};const now=new Date();getTasks().forEach(t=>{if(t.reminder==='none'||t.status==='done')return;const d=day(t.date),[hh,mm]=t.time.split(':').map(Number);d.setHours(hh,mm,0,0);const diff=(d-now)/60000,pre=t.reminder!=='0'&&Math.abs(diff-Number(t.reminder))<.75,due=Math.abs(diff)<.75,key=t.id+'_'+t.date+'_'+t.time;if((pre||due)&&!sent[key+(due?'d':'p')]){new Notification(due?'⏰ Pendiente':'🔔 Próximo pendiente',{body:`${t.title} · ${t.time}`,tag:key});sent[key+(due?'d':'p')]=Date.now();}});localStorage.setItem(REM,JSON.stringify(sent));}
  q('notificationBtn').onclick=requestNotifications;q('closeSettings').onclick=()=>q('settingsDialog').close();q('closeStats').onclick=()=>q('statsDialog').close();q('settingsBtn').onclick=()=>{q('settingsDialog').showModal();updateNotificationUI();};
  q('statsBtn').onclick=()=>{const a=getTasks(),n=getNotes(),done=a.filter(x=>x.status==='done').length,pin=a.filter(x=>x.pinned).length+n.filter(x=>x.pinned).length; q('statsContent').innerHTML=`<div class="stat-card"><strong>${a.length}</strong><span>Pendientes guardados</span></div><div class="stat-card"><strong>${done}</strong><span>Completados</span></div><div class="stat-card"><strong>${a.length-done}</strong><span>Sin completar</span></div><div class="stat-card"><strong>${pin}</strong><span>Prioridades</span></div><div class="stat-card"><strong>${a.filter(x=>x.priority==='high').length}</strong><span>Prioridad alta</span></div><div class="stat-card"><strong>${cats().length}</strong><span>Categorías</span></div>`;q('settingsDialog').close();q('statsDialog').showModal();};
  q('clearCompletedBtn').onclick=()=>{const a=getTasks(),keep=a.filter(x=>!(x.repeat==='once'&&x.status==='done'));if(keep.length===a.length){alert('No hay pendientes completados de una sola vez para limpiar.');return;}if(confirm('¿Eliminar los pendientes completados de una sola vez?')){putTasks(keep);window.render();}};
  const oldSubmit=q('taskForm').onsubmit;
  q('taskForm').onsubmit=function(e){e.preventDefault();const a=getTasks(),data={title:q('title').value.trim(),date:q('taskDate').value,time:q('taskTime').value,repeat:q('repeat').value,reminder:q('reminder').value,status:'pending',pinned:q('taskPinned').checked,priority:q('taskPriority').value,category:q('taskCategory').value.trim(),series:null};const id=finalEditing;if(id){const t=a.find(x=>x.id===id);if(t)Object.assign(t,data);}else{data.id=crypto.randomUUID();data.series=data.repeat==='once'?null:crypto.randomUUID();a.push(data);}putTasks(a);finalEditing=null;q('taskDialog').close();q('taskForm').reset();selectedDate=data.date;currentFilter='today';window.selectedDate=data.date;window.currentFilter='today';window.render();};
  const oldOpenEdit=window.openEdit;window.openEdit=function(t){finalEditing=t.id;q('taskDialogTitle').textContent='Editar pendiente';q('title').value=t.title;q('taskDate').value=t.date;q('taskTime').value=t.time;q('repeat').value=t.repeat||'once';selectedDate=t.date;window.selectedDate=t.date;q('reminder').value=t.reminder||'10';q('taskPinned').checked=!!t.pinned;q('taskPriority').value=t.priority||'medium';q('taskCategory').value=t.category||'';const d=day(t.date);window.calendarMonth=new Date(d.getFullYear(),d.getMonth(),1);window.renderCalendar();q('taskDialog').showModal();};
  q('addBtn').onclick=()=>{finalEditing=null;q('taskDialogTitle').textContent='Agregar pendiente';q('taskForm').reset();q('taskDate').value=selectedDate;const d=day(selectedDate);window.calendarMonth=new Date(d.getFullYear(),d.getMonth(),1);window.renderCalendar();q('taskDialog').showModal();};
  setInterval(checkReminders,30000);updateNotificationUI();window.render();
})();
