/* =========================================================
   MI CALENDARIO PERSONAL
   Versión limpia y compatible con iPhone / Safari
   ========================================================= */

const STORAGE_KEY = "mi_calendario_personal_clean_v1";
const NOTES_KEY = "mi_calendario_personal_notes_v1";

let selectedDate = todayString();
let currentFilter = "today";

let calendarMonth = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1
);

let browseMonth = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1
);

/* =========================================================
   UTILIDADES
   ========================================================= */

const $ = id => document.getElementById(id);

function todayString() {
  return formatDate(new Date());
}

function formatDate(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function dateFromString(s) {
  const [y, m, d] = String(s).split("-").map(Number);
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

function esc(v) {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function load() {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
  } catch {
    return [];
  }
}

function save(data) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(data)
  );
}

function loadNotes() {
  try {
    return JSON.parse(
      localStorage.getItem(NOTES_KEY) || "[]"
    );
  } catch {
    return [];
  }
}

function saveNotes(data) {
  localStorage.setItem(
    NOTES_KEY,
    JSON.stringify(data)
  );
}

/* =========================================================
   DATOS INICIALES
   ========================================================= */

function seed() {
  if (load().length > 0) return;

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

/* =========================================================
   REPETICIONES
   ========================================================= */

function occurrenceDates(task, from, to) {
  const result = [];

  const start = dateFromString(task.date);
  const end = dateFromString(to);

  let d = new Date(start);

  while (d <= end) {
    const current = formatDate(d);

    if (current >= from) {
      const daysSince = Math.round(
        (d - start) / 86400000
      );

      const weekday = d.getDay();

      const valid =
        task.repeat === "daily" ||
        (
          task.repeat === "weekdays" &&
          weekday >= 1 &&
          weekday <= 5
        ) ||
        (
          task.repeat === "weekly" &&
          daysSince % 7 === 0
        ) ||
        task.repeat === "once";

      if (valid) {
        result.push(current);
      }
    }

    if (task.repeat === "once") {
      break;
    }

    d.setDate(d.getDate() + 1);
  }

  return result;
}

function expandTasks() {
  const base = load();
  const result = [];

  let rangeStart;
  let rangeEnd;

  if (currentFilter === "past") {
    rangeStart = "2000-01-01";
    rangeEnd = todayString();
  } else if (currentFilter === "future") {
    rangeStart = todayString();
    rangeEnd = "2035-12-31";
  } else {
    rangeStart = selectedDate;
    rangeEnd = selectedDate;
  }

  base.forEach(task => {
    const dates = occurrenceDates(
      task,
      rangeStart,
      rangeEnd
    );

    dates.forEach(date => {
      const occurrenceId =
        task.id + "_" + date;

      const storedStatus =
        localStorage.getItem(
          "status_" + occurrenceId
        );

      result.push({
        ...task,
        pinned: !!task.pinned,
        occurrenceId,
        date,
        status: storedStatus || task.status
      });
    });
  });

  return result;
}

/* =========================================================
   RENDER PRINCIPAL
   ========================================================= */

function render() {
  $("currentDate").textContent =
    dateText(selectedDate);

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
    tasks = tasks.filter(
      task => task.date === selectedDate
    );
  }

  if (currentFilter === "future") {
    tasks = tasks.filter(
      task => task.date > todayString()
    );
  }

  if (currentFilter === "past") {
    tasks = tasks.filter(
      task => task.date < todayString()
    );
  }

  tasks.sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
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

  $("taskCount").textContent =
    tasks.length;

  if (!tasks.length) {
    $("taskList").innerHTML =
      '<div class="empty">' +
      'No hay pendientes aquí.<br><br>' +
      'Agrega uno con el botón de abajo.' +
      '</div>';

    return;
  }

  $("taskList").innerHTML = tasks
    .map(task => {
      const symbol =
        task.status === "done"
          ? "✓"
          : task.status === "notdone"
          ? "×"
          : "◷";

      const repeat =
        task.repeat !== "once"
          ? "↻ "
          : "";

      const pin =
        task.pinned
          ? " 📌"
          : "";

      let reminderText;

      if (task.reminder === "none") {
        reminderText = "sin aviso";
      } else if (task.reminder === "0") {
        reminderText = "solo a la hora";
      } else {
        reminderText =
          task.reminder +
          " min antes";
      }

      return `
        <article
          class="task ${esc(task.status)}"
          data-id="${esc(task.id)}"
          data-date="${esc(task.date)}"
        >
          <div class="task-time">
            ${esc(task.time)}
          </div>

          <div class="task-state">
            ${symbol}
          </div>

          <div class="task-body">
            <div class="task-title">
              ${esc(task.title)}${pin}
            </div>

            <div class="task-meta">
              ${
                currentFilter !== "today"
                  ? esc(dateText(task.date)) + " · "
                  : ""
              }
              ${repeat}
              ${reminderText}
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  document
    .querySelectorAll(".task[data-id]")
    .forEach(element => {
      element.onclick = () => {
        openTask(
          element.dataset.id,
          element.dataset.date
        );
      };
    });
}

/* =========================================================
   IMPORTANTES / PINEADOS
   ========================================================= */

function renderPriority() {
  const container =
    $("priorityList");

  if (!container) return;

  const tasks =
    load().filter(task => task.pinned);

  const notes =
    loadNotes().filter(note => note.pinned);

  if (!tasks.length && !notes.length) {
    container.innerHTML =
      '<div class="empty">' +
      'Todavía no tienes nada pineado.' +
      '</div>';

    return;
  }

  let html = "";

  tasks.forEach(task => {
    html += `
      <article
        class="task pinned-task"
        data-priority-task="${esc(task.id)}"
      >
        <div class="task-time">
          ${esc(task.time)}
        </div>

        <div class="task-state">
          📌
        </div>

        <div class="task-body">
          <div class="task-title">
            ${esc(task.title)}
          </div>

          <div class="task-meta">
            ${esc(dateText(task.date))}
          </div>
        </div>
      </article>
    `;
  });

  notes.forEach(note => {
    html += `
      <article
        class="task pinned-note"
        data-priority-note="${esc(note.id)}"
      >
        <div class="task-time">
          📌
        </div>

        <div class="task-state">
          📝
        </div>

        <div class="task-body">
          <div class="task-title">
            ${esc(note.title)}
          </div>

          <div class="task-meta">
            Nota importante
          </div>
        </div>
      </article>
    `;
  });

  container.innerHTML = html;

  container
    .querySelectorAll("[data-priority-task]")
    .forEach(element => {
      element.onclick = () => {
        const task = load().find(
          item =>
            item.id ===
            element.dataset.priorityTask
        );

        if (!task) return;

        selectedDate = task.date;
        currentFilter = "today";

        render();

        openTask(
          task.id,
          task.date
        );
      };
    });

  container
    .querySelectorAll("[data-priority-note]")
    .forEach(element => {
      element.onclick = () => {
        const note = loadNotes().find(
          item =>
            item.id ===
            element.dataset.priorityNote
        );

        if (note) {
          openNoteDetail(note);
        }
      };
    });
}

/* =========================================================
   CALENDARIO PARA AGREGAR PENDIENTE
   ========================================================= */

function renderCalendar() {
  const container =
    $("calendarPicker");

  const dateInput =
    $("taskDate");

  if (!container || !dateInput) {
    return;
  }

  /* Siempre mantenemos calendarMonth en el día 1 */
  calendarMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1
  );

  const year =
    calendarMonth.getFullYear();

  const month =
    calendarMonth.getMonth();

  const firstDay =
    new Date(year, month, 1);

  const start =
    (firstDay.getDay() + 6) % 7;

  const totalDays =
    new Date(
      year,
      month + 1,
      0
    ).getDate();

  const previousMonthDays =
    new Date(
      year,
      month,
      0
    ).getDate();

  let html = `
    <div class="calendar-head">

      <strong>
        ${calendarMonth.toLocaleDateString(
          "es-PE",
          {
            month: "long",
            year: "numeric"
          }
        )}
      </strong>

      <div class="calendar-nav">

        <button
          type="button"
          id="taskCalendarPrev"
          aria-label="Mes anterior"
        >
          ‹
        </button>

        <button
          type="button"
          id="taskCalendarNext"
          aria-label="Mes siguiente"
        >
          ›
        </button>

      </div>

    </div>

    <div class="calendar-week">
      ${[
        "L",
        "M",
        "M",
        "J",
        "V",
        "S",
        "D"
      ]
        .map(day =>
          `<span>${day}</span>`
        )
        .join("")}
    </div>

    <div class="calendar-grid">
  `;

  for (let i = 0; i < 42; i++) {
    const number =
      i - start + 1;

    let date;

    if (number < 1) {
      date = new Date(
        year,
        month - 1,
        previousMonthDays + number
      );
    } else if (
      number > totalDays
    ) {
      date = new Date(
        year,
        month + 1,
        number - totalDays
      );
    } else {
      date = new Date(
        year,
        month,
        number
      );
    }

    const dateString =
      formatDate(date);

    const isMuted =
      date.getMonth() !== month;

    const isSelected =
      dateString === dateInput.value;

    const isToday =
      dateString === todayString();

    html += `
      <button
        type="button"
        class="calendar-day ${
          isMuted ? "muted" : ""
        } ${
          isSelected ? "selected" : ""
        } ${
          isToday ? "today" : ""
        }"
        data-task-date="${dateString}"
        aria-label="${dateString}"
      >
        ${date.getDate()}
      </button>
    `;
  }

  html += "</div>";

  container.innerHTML = html;

  /* -------------------------------------------------------
     IMPORTANTE PARA IPHONE:
     Eventos directos en los botones.
     No usamos event.target.closest().
     ------------------------------------------------------- */

  const previousButton =
    $("taskCalendarPrev");

  const nextButton =
    $("taskCalendarNext");

  if (previousButton) {
    previousButton.onclick = function(event) {
      event.preventDefault();

      calendarMonth = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() - 1,
        1
      );

      renderCalendar();
    };
  }

  if (nextButton) {
    nextButton.onclick = function(event) {
      event.preventDefault();

      calendarMonth = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + 1,
        1
      );

      renderCalendar();
    };
  }

  container
    .querySelectorAll("[data-task-date]")
    .forEach(button => {

      button.onclick = function(event) {
        event.preventDefault();

        const chosenDate =
          button.dataset.taskDate;

        dateInput.value =
          chosenDate;

        const chosen =
          dateFromString(chosenDate);

        calendarMonth = new Date(
          chosen.getFullYear(),
          chosen.getMonth(),
          1
        );

        renderCalendar();
      };

    });
}

/* =========================================================
   CALENDARIO PRINCIPAL
   ========================================================= */

function renderBrowseCalendar() {
  const container =
    $("browseCalendar");

  if (!container) return;

  browseMonth = new Date(
    browseMonth.getFullYear(),
    browseMonth.getMonth(),
    1
  );

  const year =
    browseMonth.getFullYear();

  const month =
    browseMonth.getMonth();

  const firstDay =
    new Date(year, month, 1);

  const start =
    (firstDay.getDay() + 6) % 7;

  const totalDays =
    new Date(
      year,
      month + 1,
      0
    ).getDate();

  const previousMonthDays =
    new Date(
      year,
      month,
      0
    ).getDate();

  let html = `
    <div class="calendar-head">

      <strong>
        ${browseMonth.toLocaleDateString(
          "es-PE",
          {
            month: "long",
            year: "numeric"
          }
        )}
      </strong>

      <div class="calendar-nav">

        <button
          type="button"
          id="browsePrev"
        >
          ‹
        </button>

        <button
          type="button"
          id="browseNext"
        >
          ›
        </button>

      </div>
    </div>

    <div class="calendar-week">
      ${[
        "L",
        "M",
        "M",
        "J",
        "V",
        "S",
        "D"
      ]
        .map(day =>
          `<span>${day}</span>`
        )
        .join("")}
    </div>

    <div class="calendar-grid">
  `;

  for (let i = 0; i < 42; i++) {
    const number =
      i - start + 1;

    let date;

    if (number < 1) {
      date = new Date(
        year,
        month - 1,
        previousMonthDays + number
      );
    } else if (
      number > totalDays
    ) {
      date = new Date(
        year,
        month + 1,
        number - totalDays
      );
    } else {
      date = new Date(
        year,
        month,
        number
      );
    }

    const dateString =
      formatDate(date);

    html += `
      <button
        type="button"
        class="calendar-day ${
          date.getMonth() !== month
            ? "muted"
            : ""
        } ${
          dateString === selectedDate
            ? "selected"
            : ""
        } ${
          dateString === todayString()
            ? "today"
            : ""
        }"
        data-browse-date="${dateString}"
      >
        ${date.getDate()}
      </button>
    `;
  }

  html += "</div>";

  container.innerHTML = html;

  const previous =
    $("browsePrev");

  const next =
    $("browseNext");

  if (previous) {
    previous.onclick = function(event) {
      event.preventDefault();

      browseMonth = new Date(
        browseMonth.getFullYear(),
        browseMonth.getMonth() - 1,
        1
      );

      renderBrowseCalendar();
    };
  }

  if (next) {
    next.onclick = function(event) {
      event.preventDefault();

      browseMonth = new Date(
        browseMonth.getFullYear(),
        browseMonth.getMonth() + 1,
        1
      );

      renderBrowseCalendar();
    };
  }

  container
    .querySelectorAll("[data-browse-date]")
    .forEach(button => {

      button.onclick = function(event) {
        event.preventDefault();

        selectedDate =
          button.dataset.browseDate;

        currentFilter = "today";

        $("calendarDialog").close();

        render();
      };

    });
}

/* =========================================================
   AGREGAR PENDIENTE
   ========================================================= */

$("addBtn").onclick = function() {

  $("taskForm").reset();

  $("taskDate").value =
    selectedDate;

  const selected =
    dateFromString(selectedDate);

  calendarMonth = new Date(
    selected.getFullYear(),
    selected.getMonth(),
    1
  );

  renderCalendar();

  $("taskDialog").showModal();
};

$("closeDialog").onclick =
  function() {
    $("taskDialog").close();
  };

$("taskForm").onsubmit =
  function(event) {

    event.preventDefault();

    const title =
      $("title").value.trim();

    const date =
      $("taskDate").value;

    const time =
      $("taskTime").value;

    if (!title || !date || !time) {
      return;
    }

    const task = {
      id: crypto.randomUUID(),
      title,
      date,
      time,
      repeat: $("repeat").value,
      reminder: $("reminder").value,
      status: "pending",
      pinned: false,
      series: null
    };

    const tasks = load();

    tasks.push(task);

    save(tasks);

    selectedDate =
      task.date;

    currentFilter =
      "today";

    $("taskForm").reset();

    $("taskDialog").close();

    render();
  };

/* =========================================================
   DETALLE DE PENDIENTE
   ========================================================= */

function openTask(id, date) {

  const task =
    expandTasks().find(
      item =>
        item.id === id &&
        item.date === date
    );

  if (!task) return;

  $("detailContent").innerHTML = `
    <div class="dialog-head">

      <div>
        <div class="eyebrow">
          PENDIENTE
        </div>

        <h2>
          ${
            task.pinned
              ? "📌 "
              : ""
          }
          ${esc(task.title)}
        </h2>
      </div>

      <button
        class="close-btn"
        id="detailClose"
        type="button"
      >
        ×
      </button>

    </div>

    <div class="detail-date">
      ${esc(dateText(task.date))}
      ·
      ${esc(task.time)}
      ${
        task.repeat !== "once"
          ? " · ↻ repetitivo"
          : ""
      }
    </div>

    <div class="detail-actions">

      <button
        class="action-btn"
        data-status="done"
        type="button"
      >
        <b>✓</b>
        Realizado
      </button>

      <button
        class="action-btn"
        data-status="notdone"
        type="button"
      >
        <b>×</b>
        No realizado
      </button>

      <button
        class="action-btn"
        data-status="pending"
        type="button"
      >
        <b>◷</b>
        Pendiente
      </button>

    </div>

    <div class="quick-actions">

      <button
        class="action-btn"
        id="pinBtn"
        type="button"
      >
        ${
          task.pinned
            ? "📌 Quitar prioridad"
            : "📌 Pinear como prioridad"
        }
      </button>

      <button
        class="action-btn"
        id="tomorrowBtn"
        type="button"
      >
        Mañana · misma hora
      </button>

      <button
        class="action-btn"
        id="editBtn"
        type="button"
      >
        Cambiar fecha/hora
      </button>

      <button
        class="action-btn"
        id="deleteBtn"
        type="button"
      >
        Eliminar
      </button>

    </div>
  `;

  $("taskDetailDialog").showModal();

  $("detailClose").onclick =
    function() {
      $("taskDetailDialog").close();
    };

  document
    .querySelectorAll("[data-status]")
    .forEach(button => {

      button.onclick = function() {

        localStorage.setItem(
          "status_" +
          task.occurrenceId,
          button.dataset.status
        );

        $("taskDetailDialog").close();

        render();
      };

    });

  $("pinBtn").onclick =
    function() {

      const all =
        load();

      const base =
        all.find(
          item =>
            item.id === task.id
        );

      if (base) {
        base.pinned =
          !base.pinned;

        save(all);
      }

      $("taskDetailDialog").close();

      render();
    };

  $("tomorrowBtn").onclick =
    function() {

      const tomorrow =
        addDays(task.date, 1);

      const all =
        load();

      const base =
        all.find(
          item =>
            item.id === task.id
        );

      if (!base) return;

      if (base.repeat === "once") {

        base.date =
          tomorrow;

        base.status =
          "pending";

        save(all);

      } else {

        localStorage.setItem(
          "status_" +
          task.occurrenceId,
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
          pinned: !!base.pinned,
          series: null
        });

        save(all);
      }

      $("taskDetailDialog").close();

      selectedDate =
        tomorrow;

      currentFilter =
        "today";

      render();
    };

  $("editBtn").onclick =
    function() {

      $("taskDetailDialog").close();

      openEdit(task);
    };

  $("deleteBtn").onclick =
    function() {

      if (
        !confirm(
          "¿Eliminar este pendiente?"
        )
      ) {
        return;
      }

      save(
        load().filter(
          item =>
            item.id !== task.id
        )
      );

      $("taskDetailDialog").close();

      render();
    };
}

/* =========================================================
   EDITAR PENDIENTE
   ========================================================= */

function openEdit(task) {

  $("detailContent").innerHTML = `
    <div class="dialog-head">

      <div>
        <div class="eyebrow">
          REPROGRAMAR
        </div>

        <h2>
          Editar pendiente
        </h2>
      </div>

      <button
        class="close-btn"
        id="editClose"
        type="button"
      >
        ×
      </button>

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

        <input
          id="editDate"
          type="date"
          required
          value="${esc(task.date)}"
        >
      </label>

      <label>
        Hora

        <input
          id="editTime"
          type="time"
          required
          value="${esc(task.time)}"
        >
      </label>

      <button
        class="primary-btn"
        type="submit"
      >
        Guardar cambios
      </button>

    </form>
  `;

  $("taskDetailDialog").showModal();

  $("editClose").onclick =
    function() {
      $("taskDetailDialog").close();
    };

  $("editForm").onsubmit =
    function(event) {

      event.preventDefault();

      const tasks =
        load();

      const base =
        tasks.find(
          item =>
            item.id === task.id
        );

      if (!base) return;

      base.title =
        $("editTitle").value.trim();

      base.date =
        $("editDate").value;

      base.time =
        $("editTime").value;

      base.status =
        "pending";

      save(tasks);

      selectedDate =
        base.date;

      currentFilter =
        "today";

      $("taskDetailDialog").close();

      render();
    };
}

/* =========================================================
   NOTAS
   ========================================================= */

function renderNotes() {

  const container =
    $("notesList");

  if (!container) return;

  const notes =
    loadNotes();

  if (!notes.length) {

    container.innerHTML =
      '<div class="empty">' +
      'Todavía no tienes notas.' +
      '</div>';

    return;
  }

  container.innerHTML =
    notes
      .map(note => {

        return `
          <article
            class="note-card ${
              note.pinned
                ? "pinned-note"
                : ""
            }"
            data-note-id="${esc(note.id)}"
          >

            <div class="note-head">

              <strong>
                ${
                  note.pinned
                    ? "📌 "
                    : "📝 "
                }
                ${esc(note.title)}
              </strong>

              <button
                class="note-more"
                type="button"
                data-note-menu="${esc(note.id)}"
              >
                •••
              </button>

            </div>

            ${
              note.text
                ? `
                  <div class="note-text">
                    ${esc(note.text)}
                  </div>
                `
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

          </article>
        `;
      })
      .join("");

  document
    .querySelectorAll(".note-card")
    .forEach(card => {

      card.onclick =
        function(event) {

          if (
            event.target.closest(
              ".note-more"
            )
          ) {
            return;
          }

          const note =
            notes.find(
              item =>
                item.id ===
                card.dataset.noteId
            );

          if (note) {
            openNoteDetail(note);
          }
        };
    });

  document
    .querySelectorAll("[data-note-menu]")
    .forEach(button => {

      button.onclick =
        function(event) {

          event.preventDefault();
          event.stopPropagation();

          const note =
            notes.find(
              item =>
                item.id ===
                button.dataset.noteMenu
            );

          if (note) {
            openNoteDetail(note);
          }
        };
    });
}

/* =========================================================
   NUEVA NOTA
   ========================================================= */

$("addNoteBtn").onclick =
  function() {

    $("noteDialogTitle").textContent =
      "Nueva nota";

    $("noteForm").reset();

    delete $("noteForm")
      .dataset.editId;

    $("noteDialog").showModal();
  };

$("closeNoteDialog").onclick =
  function() {
    $("noteDialog").close();
  };

$("noteForm").onsubmit =
  function(event) {

    event.preventDefault();

    const notes =
      loadNotes();

    const editId =
      $("noteForm").dataset.editId;

    if (editId) {

      const note =
        notes.find(
          item =>
            item.id === editId
        );

      if (note) {

        note.title =
          $("noteTitle").value.trim();

        note.text =
          $("noteText").value.trim();

        note.link =
          $("noteLink").value.trim();

        note.pinned =
          $("notePinned").checked;
      }

    } else {

      notes.push({
        id: crypto.randomUUID(),

        title:
          $("noteTitle")
            .value
            .trim(),

        text:
          $("noteText")
            .value
            .trim(),

        link:
          $("noteLink")
            .value
            .trim(),

        pinned:
          $("notePinned")
            .checked
      });
    }

    saveNotes(notes);

    $("noteForm").reset();

    delete $("noteForm")
      .dataset.editId;

    $("noteDialog").close();

    render();
  };

/* =========================================================
   DETALLE DE NOTA
   ========================================================= */

function openNoteDetail(note) {

  $("noteDetailContent").innerHTML = `
    <div class="dialog-head">

      <div>

        <div class="eyebrow">
          NOTA
        </div>

        <h2>
          ${
            note.pinned
              ? "📌 "
              : ""
          }
          ${esc(note.title)}
        </h2>

      </div>

      <button
        class="close-btn"
        id="closeNoteDetail"
        type="button"
      >
        ×
      </button>

    </div>

    <div
      style="
        padding:0 20px 20px;
      "
    >

      ${
        note.text
          ? `
            <div class="note-detail">
              ${esc(note.text)}
            </div>
          `
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

        <button
          class="action-btn"
          id="notePinBtn"
          type="button"
        >
          ${
            note.pinned
              ? "📌 Quitar prioridad"
              : "📌 Marcar como prioridad"
          }
        </button>

        <button
          class="action-btn"
          id="noteEditBtn"
          type="button"
        >
          Editar
        </button>

        <button
          class="action-btn"
          id="noteDeleteBtn"
          type="button"
        >
          Eliminar
        </button>

      </div>

    </div>
  `;

  $("noteDetailDialog").showModal();

  $("closeNoteDetail").onclick =
    function() {
      $("noteDetailDialog").close();
    };

  $("notePinBtn").onclick =
    function() {

      const notes =
        loadNotes();

      const base =
        notes.find(
          item =>
            item.id === note.id
        );

      if (base) {

        base.pinned =
          !base.pinned;

        saveNotes(notes);
      }

      $("noteDetailDialog").close();

      render();
    };

  $("noteEditBtn").onclick =
    function() {

      $("noteDetailDialog").close();

      openNoteEdit(note);
    };

  $("noteDeleteBtn").onclick =
    function() {

      if (
        !confirm(
          "¿Eliminar esta nota?"
        )
      ) {
        return;
      }

      saveNotes(
        loadNotes().filter(
          item =>
            item.id !== note.id
        )
      );

      $("noteDetailDialog").close();

      render();
    };
}

/* =========================================================
   EDITAR NOTA
   ========================================================= */

function openNoteEdit(note) {

  $("noteDialogTitle").textContent =
    "Editar nota";

  $("noteTitle").value =
    note.title;

  $("noteText").value =
    note.text || "";

  $("noteLink").value =
    note.link || "";

  $("notePinned").checked =
    !!note.pinned;

  $("noteForm")
    .dataset
    .editId =
    note.id;

  $("noteDialog").showModal();
}

/* =========================================================
   NAVEGACIÓN ENTRE DÍAS
   ========================================================= */

$("prevDay").onclick =
  function() {

    selectedDate =
      addDays(
        selectedDate,
        -1
      );

    currentFilter =
      "today";

    render();
  };

$("nextDay").onclick =
  function() {

    selectedDate =
      addDays(
        selectedDate,
        1
      );

    currentFilter =
      "today";

    render();
  };

/* =========================================================
   FILTROS
   ========================================================= */

document
  .querySelectorAll(
    ".filter[data-filter]"
  )
  .forEach(button => {

    button.onclick =
      function() {

        currentFilter =
          button.dataset.filter;

        if (
          currentFilter ===
          "today"
        ) {
          selectedDate =
            todayString();
        }

        render();
      };
  });

/* =========================================================
   SELECTOR DE FECHA PRINCIPAL
   ========================================================= */

$("datePickerBtn").onclick =
  function() {

    browseMonth =
      dateFromString(
        selectedDate
      );

    browseMonth =
      new Date(
        browseMonth.getFullYear(),
        browseMonth.getMonth(),
        1
      );

    $("calendarDialog")
      .showModal();

    renderBrowseCalendar();
  };

$("closeCalendarDialog").onclick =
  function() {
    $("calendarDialog").close();
  };

/* =========================================================
   SETTINGS
   ========================================================= */

$("settingsBtn").onclick =
  function() {

    alert(
      "Las notificaciones se pueden añadir después. " +
      "El calendario compartido no está activado."
    );
  };

/* =========================================================
   INICIO
   ========================================================= */

seed();
render();
