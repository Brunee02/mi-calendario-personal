const STORAGE_KEY = "mi_calendario_personal_clean_v1";
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

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

function occurrenceDates(task, from, to) {
  const result = [];
  const start = dateFromString(task.date);
  const end = dateFromString(to);
  let d = new Date(start);

  while (d <= end) {
    const date = formatDate(d);

    if (date >= from) {
      const daysSince = Math.round((d - start) / 86400000);
      const weekday = d.getDay();

      const valid =
        task.repeat === "daily" ||
        (task.repeat === "weekdays" && weekday >= 1 && weekday <= 5) ||
        (task.repeat === "weekly" && daysSince % 7 === 0) ||
        task.repeat === "once";

      if (valid) result.push(date);
    }

    if (task.repeat === "once") break;

    d.setDate(d.getDate() + 1);
  }

  return result;
}

function expandTasks() {
  const base = load();
  const result = [];

  let from = "2000-01-01";
  let to = "2035-12-31";

  if (currentFilter === "today") {
    from = selectedDate;
    to = selectedDate;
  }

  if (currentFilter === "future") {
    from = todayString();
  }

  if (currentFilter === "past") {
    to = todayString();
  }

  base.forEach(task => {
    const dates = occurrenceDates(task, from, to);

    dates.forEach(date => {
      const occurrenceId = `${task.id}_${date}`;
      const storedStatus =
        localStorage.getItem("status_" + occurrenceId);

      result.push({
        ...task,
        occurrenceId,
        date,
        status: storedStatus || task.status || "pending"
      });
    });
  });

  return result;
}

/* =========================
   RENDER PRINCIPAL
========================= */

function render() {
  $("currentDate").textContent = dateText(selectedDate);
  $("currentYear").textContent =
    dateFromString(selectedDate).getFullYear();

  document
    .querySelectorAll(".filter[data-filter]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.filter === currentFilter
      );
    });

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

  $("taskList").innerHTML = tasks.map(task => {
    const symbol =
      task.status === "done"
        ? "✓"
        : task.status === "notdone"
        ? "×"
        : "◷";

    const repeat =
      task.repeat !== "once" ? "↻ " : "";

    const pin =
      task.pinned ? '<span class="pin-mini">📌</span>' : "";

    return `
      <article
        class="task ${task.status} ${task.pinned ? "pinned-task" : ""}"
        data-id="${task.id}"
        data-date="${task.date}"
      >
        <div class="task-time">${esc(task.time)}</div>
        <div class="task-state">${symbol}</div>

        <div class="task-body">
          <div class="task-title">
            ${pin}${esc(task.title)}
          </div>

          <div class="task-meta">
            ${
              currentFilter !== "today"
                ? esc(dateText(task.date)) + " · "
                : ""
            }
            ${repeat}
            ${
              task.reminder === "10"
                ? "10 min antes"
                : task.reminder === "none"
                ? "sin aviso"
                : task.reminder + " min antes"
            }
          </div>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".task").forEach(el => {
    el.onclick = () =>
      openTask(el.dataset.id, el.dataset.date);
  });
}

/* =========================
   IMPORTANTES / PINNED
========================= */

function renderPriority() {
  const list = $("priorityList");
  if (!list) return;

  const important = load().filter(item => item.pinned);

  if (!important.length) {
    list.innerHTML =
      '<div class="notes-empty empty">Todavía no tienes nada marcado como prioridad.</div>';
    return;
  }

  list.innerHTML = important.map(item => `
    <div class="priority-card" data-id="${item.id}">
      <div>📌</div>
      <div style="min-width:0;flex:1">
        <strong>${esc(item.title)}</strong>
        <div class="priority-meta">
          ${item.date ? esc(dateText(item.date)) : "Sin fecha"}
          ${item.time ? " · " + esc(item.time) : ""}
        </div>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".priority-card").forEach(card => {
    card.onclick = () => {
      const item = load().find(x => x.id === card.dataset.id);
      if (item) {
        openTask(item.id, item.date);
      }
    };
  });
}

/* =========================
   NOTAS
========================= */

function renderNotes() {
  const list = $("notesList");
  if (!list) return;

  const notes = JSON.parse(
    localStorage.getItem("mi_calendario_notes_v1") || "[]"
  );

  if (!notes.length) {
    list.innerHTML =
      '<div class="notes-empty empty">Todavía no tienes notas.</div>';
    return;
  }

  list.innerHTML = notes.map(note => `
    <article class="note-card ${note.pinned ? "pinned-note" : ""}"
      data-note-id="${note.id}">

      <div class="note-head">
        ${note.pinned ? "📌" : "📝"}

        <strong>${esc(note.title)}</strong>

        <button class="note-more" data-note-menu="${note.id}">
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
          ? `<a class="link-btn" href="${esc(note.link)}" target="_blank">
              Abrir enlace
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

  document.querySelectorAll("[data-note-menu]").forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();

      const note = notes.find(
        n => n.id === btn.dataset.noteMenu
      );

      if (!note) return;

      const action = prompt(
        "Escribe:\n1 = editar\n2 = eliminar\n3 = cambiar prioridad"
      );

      if (action === "1") {
        openNoteEdit(note);
      }

      if (action === "2") {
        if (confirm("¿Eliminar esta nota?")) {
          saveNotes(
            notes.filter(n => n.id !== note.id)
          );
          renderNotes();
        }
      }

      if (action === "3") {
        note.pinned = !note.pinned;
        saveNotes(notes);
        renderNotes();
      }
    };
  });
}

function getNotes() {
  return JSON.parse(
    localStorage.getItem("mi_calendario_notes_v1") || "[]"
  );
}

function saveNotes(notes) {
  localStorage.setItem(
    "mi_calendario_notes_v1",
    JSON.stringify(notes)
  );
}

function openNoteDetail(note) {
  $("noteDetailContent").innerHTML = `
    <div class="dialog-head">
      <div>
        <div class="eyebrow">NOTA</div>
        <h2>${note.pinned ? "📌 " : ""}${esc(note.title)}</h2>
      </div>

      <button class="close-btn" id="closeNoteDetail">×</button>
    </div>

    <div class="note-detail">
      ${esc(note.text || "")}
    </div>

    ${
      note.link
        ? `<a class="link-btn wide"
             href="${esc(note.link)}"
             target="_blank">
             Abrir enlace
           </a>`
        : ""
    }

    <div class="quick-actions">
      <button class="action-btn" id="editNoteDetail">
        Editar
      </button>

      <button class="action-btn" id="deleteNoteDetail">
        Eliminar
      </button>
    </div>
  `;

  $("noteDetailDialog").showModal();

  $("closeNoteDetail").onclick = () =>
    $("noteDetailDialog").close();

  $("editNoteDetail").onclick = () => {
    $("noteDetailDialog").close();
    openNoteEdit(note);
  };

  $("deleteNoteDetail").onclick = () => {
    if (!confirm("¿Eliminar esta nota?")) return;

    saveNotes(
      getNotes().filter(n => n.id !== note.id)
    );

    $("noteDetailDialog").close();
    renderNotes();
  };
}

function openNoteEdit(note) {
  $("noteDialogTitle").textContent = "Editar nota";

  $("noteTitle").value = note.title;
  $("noteText").value = note.text || "";
  $("noteLink").value = note.link || "";
  $("notePinned").checked = !!note.pinned;

  $("noteDialog").showModal();

  $("noteForm").dataset.editId = note.id;
}

/* =========================
   CALENDARIO PARA PENDIENTES
========================= */

function renderCalendar() {
  const container = $("calendarPicker");
  if (!container) return;

  renderCalendarInto(container, calendarMonth, date => {
    $("taskDate").value = date;

    const d = dateFromString(date);

    calendarMonth = new Date(
      d.getFullYear(),
      d.getMonth(),
      1
    );

    renderCalendar();
  });
}

function renderCalendarInto(container, monthDate, onSelect) {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();

  const first = new Date(y, m, 1);
  const start = (first.getDay() + 6) % 7;

  const total = new Date(y, m + 1, 0).getDate();
  const prevTotal = new Date(y, m, 0).getDate();

  let html = `
    <div class="calendar-head">
      <strong>
        ${monthDate.toLocaleDateString("es-PE", {
          month: "long",
          year: "numeric"
        })}
      </strong>

      <div class="calendar-nav">
        <button type="button" class="cal-prev">‹</button>
        <button type="button" class="cal-next">›</button>
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
    let date;

    if (n < 1) {
      date = new Date(y, m - 1, prevTotal + n);
    } else if (n > total) {
      date = new Date(y, m + 1, n - total);
    } else {
      date = new Date(y, m, n);
    }

    const dateString = formatDate(date);

    const selected =
      dateString === $("taskDate")?.value;

    const muted =
      date.getMonth() !== m;

    const isToday =
      dateString === todayString();

    html += `
      <button
        type="button"
        class="calendar-day
          ${muted ? "muted" : ""}
          ${selected ? "selected" : ""}
          ${isToday ? "today" : ""}"
        data-date="${dateString}">
        ${date.getDate()}
      </button>
    `;
  }

  html += "</div>";

  container.innerHTML = html;

  container.querySelector(".cal-prev").onclick = () => {
    calendarMonth = new Date(y, m - 1, 1);
    renderCalendar();
  };

  container.querySelector(".cal-next").onclick = () => {
    calendarMonth = new Date(y, m + 1, 1);
    renderCalendar();
  };

  container.querySelectorAll(".calendar-day").forEach(btn => {
    btn.onclick = () =>
      onSelect(btn.dataset.date);
  });
}

/* =========================
   CALENDARIO PARA FILTRAR
========================= */

function renderBrowseCalendar() {
  const container = $("browseCalendar");
  if (!container) return;

  renderCalendarInto(
    container,
    browseMonth,
    date => {
      selectedDate = date;
      currentFilter = "today";

      $("calendarDialog").close();
      render();
    }
  );
}

/* =========================
   DETALLE DE PENDIENTE
========================= */

function openTask(id, date) {
  const task = expandTasks().find(
    x => x.id === id && x.date === date
  );

  if (!task) return;

  $("detailContent").innerHTML = `
    <div class="dialog-head">
      <div>
        <div class="eyebrow">PENDIENTE</div>

        <h2>
          ${task.pinned ? "📌 " : ""}
          ${esc(task.title)}
        </h2>
      </div>

      <button class="close-btn" id="detailClose">×</button>
    </div>

    <div class="detail-date">
      ${esc(dateText(task.date))}
      · ${esc(task.time)}
      ${
        task.repeat !== "once"
          ? " · ↻ repetitivo"
          : ""
      }
    </div>

    <div class="detail-actions">
      <button class="action-btn" data-status="done">
        <b>✓</b>
        Realizado
      </button>

      <button class="action-btn" data-status="notdone">
        <b>×</b>
        No realizado
      </button>

      <button class="action-btn" data-status="pending">
        <b>◷</b>
        Pendiente
      </button>
    </div>

    <div class="quick-actions">
      <button class="action-btn" id="pinBtn">
        ${task.pinned ? "📌 Quitar prioridad" : "📌 Marcar prioridad"}
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

  document.querySelectorAll("[data-status]").forEach(button => {
    button.onclick = () => {
      localStorage.setItem(
        "status_" + task.occurrenceId,
        button.dataset.status
      );

      $("taskDetailDialog").close();
      render();
    };
  });

  $("pinBtn").onclick = () => {
    const all = load();
    const base = all.find(x => x.id === task.id);

    if (base) {
      base.pinned = !base.pinned;
      save(all);
    }

    $("taskDetailDialog").close();
    render();
  };

  $("tomorrowBtn").onclick = () => {
    const tomorrow = addDays(task.date, 1);
    const all = load();
    const base = all.find(x => x.id === task.id);

    if (base && base.repeat === "once") {
      base.date = tomorrow;
      base.status = "pending";
      save(all);
    } else if (base) {
      localStorage.setItem(
        "status_" + task.occurrenceId,
        "notdone"
      );

      all.push({
        id: crypto.randomUUID(),
        title: base.title,
        date: tomorrow,
        time: base.time,
        repeat: "once",
        reminder: base.reminder,
        status: "pending",
        pinned: base.pinned || false
      });

      save(all);
    }

    $("taskDetailDialog").close();

    selectedDate = tomorrow;
    currentFilter = "today";

    render();
  };

  $("editBtn").onclick = () => {
    $("taskDetailDialog").close();
    openEdit(task);
  };

  $("deleteBtn").onclick = () => {
    if (!confirm("¿Eliminar este pendiente?")) return;

    save(load().filter(x => x.id !== task.id));

    $("taskDetailDialog").close();
    render();
  };
}

/* =========================
   EDITAR PENDIENTE
========================= */

function openEdit(task) {
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
          value="${esc(task.title)}"
        >
      </label>

      <label>
        Fecha

        <div
          class="calendar-picker"
          id="editCalendar">
        </div>

        <input
          id="editDate"
          type="hidden"
          value="${task.date}"
          required
        >
      </label>

      <label>
        Hora
        <input
          id="editTime"
          type="time"
          required
          value="${task.time}"
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

  let editMonth = dateFromString(task.date);

  function drawEditCalendar() {
    renderCalendarInto(
      $("editCalendar"),
      editMonth,
      date => {
        $("editDate").value = date;
        editMonth = dateFromString(date);
        drawEditCalendar();
      }
    );
  }

  drawEditCalendar();

  $("editForm").onsubmit = e => {
    e.preventDefault();

    const all = load();
    const base = all.find(x => x.id === task.id);

    if (!base) return;

    base.title = $("editTitle").value.trim();
    base.date = $("editDate").value;
    base.time = $("editTime").value;
    base.status = "pending";

    save(all);

    selectedDate = base.date;
    currentFilter = "today";

    $("taskDetailDialog").close();

    render();
  };
}

/* =========================
   BOTONES PRINCIPALES
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
  .forEach(button => {
    button.onclick = () => {
      currentFilter = button.dataset.filter;

      if (currentFilter === "today") {
        selectedDate = todayString();
      }

      render();
    };
  });

/* Mini calendario para escoger una fecha */

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

  calendarMonth = dateFromString(selectedDate);

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
    pinned: false
  };

  const all = load();

  all.push(task);

  save(all);

  selectedDate = task.date;
  currentFilter = "today";

  $("taskForm").reset();
  $("taskDialog").close();

  render();
};

/* =========================
   NOTAS
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

  const notes = getNotes();

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

  $("noteDialog").close();

  delete $("noteForm").dataset.editId;

  renderNotes();
};

/* =========================
   INICIAR
========================= */

render();
