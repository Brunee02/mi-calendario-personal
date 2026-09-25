const STORAGE_KEY="mi_calendario_personal_clean_v1";
let selectedDate=todayString(), currentFilter="today";
let calendarMonth=new Date();

const $=id=>document.getElementById(id);
function todayString(){return formatDate(new Date())}
function formatDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function dateFromString(s){const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function addDays(s,n){const d=dateFromString(s);d.setDate(d.getDate()+n);return formatDate(d)}
function dateText(s){return dateFromString(s).toLocaleDateString("es-PE",{weekday:"long",day:"numeric",month:"long"})}
function diff(a,b){return Math.round((dateFromString(a)-dateFromString(b))/86400000)}
function load(){return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")}
function save(a){localStorage.setItem(STORAGE_KEY,JSON.stringify(a))}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function seed(){
  if(load().length)return;
  const d=todayString();
  save([
    {id:crypto.randomUUID(),title:"Desayunar",date:d,time:"08:00",repeat:"once",reminder:"10",status:"done",series:null},
    {id:crypto.randomUUID(),title:"Bañar a Emma",date:d,time:"15:00",repeat:"once",reminder:"10",status:"pending",series:null},
    {id:crypto.randomUUID(),title:"Enviar constancia de trabajo",date:d,time:"17:30",repeat:"once",reminder:"10",status:"pending",series:null},
    {id:crypto.randomUUID(),title:"Entrenar",date:d,time:"21:00",repeat:"daily",reminder:"10",status:"pending",series:crypto.randomUUID()}
  ]);
}

function occurrenceDates(task,from,to){
  const out=[], start=dateFromString(task.date), end=dateFromString(to);
  let d=new Date(start);
  while(d<=end){
    const s=formatDate(d);
    if(s>=from){
      const daysSince=Math.round((d-start)/86400000);
      const weekday=d.getDay();
      const ok=task.repeat==="daily" || (task.repeat==="weekdays" && weekday>=1 && weekday<=5) || (task.repeat==="weekly" && daysSince%7===0) || task.repeat==="once";
      if(ok) out.push(s);
    }
    if(task.repeat==="once")break;
    d.setDate(d.getDate()+1);
  }
  return out;
}

function expandTasks(){
  const base=load(), result=[];
  const rangeStart=currentFilter==="past"?"2000-01-01":currentFilter==="future"?todayString():selectedDate;
  const rangeEnd=currentFilter==="past"?todayString():currentFilter==="future"? "2035-12-31":selectedDate;

  base.forEach(task=>{
    const dates=occurrenceDates(task,rangeStart,rangeEnd);
    dates.forEach(date=>{
      const occurrenceId=`${task.id}_${date}`;
      const stored=localStorage.getItem("status_"+occurrenceId);
      result.push({...task,occurrenceId,date,status:stored||task.status});
    });
  });
  return result;
}

function render(){
  $("currentDate").textContent=dateText(selectedDate);
  $("currentYear").textContent=dateFromString(selectedDate).getFullYear();
  document.querySelectorAll(".filter[data-filter]").forEach(b=>b.classList.toggle("active",b.dataset.filter===currentFilter));

  let tasks=expandTasks();
  if(currentFilter==="today") tasks=tasks.filter(t=>t.date===selectedDate);
  if(currentFilter==="future") tasks=tasks.filter(t=>t.date>todayString());
  if(currentFilter==="past") tasks=tasks.filter(t=>t.date<todayString());
  tasks.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));

  $("sectionTitle").textContent=currentFilter==="today"?"PENDIENTES DE HOY":currentFilter==="future"?"PRÓXIMOS":currentFilter==="past"?"PASADOS":"TODAS LAS FECHAS";
  $("taskCount").textContent=tasks.length;

  if(!tasks.length){$("taskList").innerHTML='<div class="empty">No hay pendientes aquí.<br><br>Agrega uno con el botón de abajo.</div>';return}

  $("taskList").innerHTML=tasks.map(t=>{
    const symbol=t.status==="done"?"✓":t.status==="notdone"?"×":"◷";
    const repeat=t.repeat!=="once"?"↻ ":"";
    return `<article class="task ${t.status}" data-id="${t.id}" data-date="${t.date}">
      <div class="task-time">${t.time}</div><div class="task-state">${symbol}</div>
      <div class="task-body"><div class="task-title">${esc(t.title)}</div>
      <div class="task-meta">${currentFilter!=="today"?esc(dateText(t.date))+" · ":""}${repeat}${t.reminder==="10"?"10 min antes":t.reminder==="none"?"sin aviso":t.reminder+" min antes"}</div></div></article>`;
  }).join("");
  document.querySelectorAll(".task").forEach(el=>el.onclick=()=>openTask(el.dataset.id,el.dataset.date));
}

function renderCalendar(){
  const c=$("calendarPicker");if(!c)return;
  const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth();
  const first=new Date(y,m,1), start=(first.getDay()+6)%7, total=new Date(y,m+1,0).getDate(), prevTotal=new Date(y,m,0).getDate();
  let h=`<div class="calendar-head"><strong>${calendarMonth.toLocaleDateString("es-PE",{month:"long",year:"numeric"})}</strong><div class="calendar-nav"><button type="button" id="calPrev">‹</button><button type="button" id="calNext">›</button></div></div><div class="calendar-week">${["L","M","M","J","V","S","D"].map(x=>`<span>${x}</span>`).join("")}</div><div class="calendar-grid">`;
  for(let i=0;i<42;i++){
    const n=i-start+1;let dt;
    if(n<1)dt=new Date(y,m-1,prevTotal+n);
    else if(n>total)dt=new Date(y,m+1,n-total);
    else dt=new Date(y,m,n);
    const ds=formatDate(dt), selected=ds===$("taskDate").value, muted=dt.getMonth()!==m, isToday=ds===todayString();
    h+=`<button type="button" class="calendar-day ${muted?"muted":""} ${selected?"selected":""} ${isToday?"today":""}" data-date="${ds}">${dt.getDate()}</button>`;
  }
  c.innerHTML=h+"</div>";
  $("calPrev").onclick=()=>{calendarMonth=new Date(y,m-1,1);renderCalendar()};
  $("calNext").onclick=()=>{calendarMonth=new Date(y,m+1,1);renderCalendar()};
  c.querySelectorAll(".calendar-day").forEach(b=>b.onclick=()=>{$("taskDate").value=b.dataset.date;calendarMonth=new Date(dateFromString(b.dataset.date).getFullYear(),dateFromString(b.dataset.date).getMonth(),1);renderCalendar()});
}

function openTask(id,date){
  const t=expandTasks().find(x=>x.id===id&&x.date===date);if(!t)return;
  $("detailContent").innerHTML=`<div class="dialog-head"><div><div class="eyebrow">PENDIENTE</div><h2>${esc(t.title)}</h2></div><button class="close-btn" id="detailClose">×</button></div>
  <div style="padding:0 20px;color:var(--muted);font-size:12px">${dateText(t.date)} · ${t.time}${t.repeat!=="once"?" · ↻ repetitivo":""}</div>
  <div class="detail-actions"><button class="action-btn" data-status="done"><b>✓</b>Realizado</button><button class="action-btn" data-status="notdone"><b>×</b>No realizado</button><button class="action-btn" data-status="pending"><b>◷</b>Pendiente</button></div>
  <div class="quick-actions"><button class="action-btn" id="tomorrowBtn">Mañana · misma hora</button><button class="action-btn" id="editBtn">Cambiar fecha/hora</button><button class="action-btn" id="deleteBtn">Eliminar</button></div>`;
  $("taskDetailDialog").showModal();$("detailClose").onclick=()=>$("taskDetailDialog").close();
  document.querySelectorAll("[data-status]").forEach(b=>b.onclick=()=>{localStorage.setItem("status_"+t.occurrenceId,b.dataset.status);$("taskDetailDialog").close();render()});
  $("tomorrowBtn").onclick=()=>{
    const tomorrow=addDays(t.date,1);
    const all=load();
    const base=all.find(x=>x.id===t.id);

    if(base && base.repeat==="once"){
      base.date=tomorrow;
      base.status="pending";
      save(all);
    } else if(base){
      // For a repeating task, postpone only this occurrence.
      // Hide today's occurrence and create a one-time occurrence tomorrow.
      localStorage.setItem("status_"+t.occurrenceId,"notdone");
      const moved={
        id:crypto.randomUUID(),
        title:base.title,
        date:tomorrow,
        time:base.time,
        repeat:"once",
        reminder:base.reminder,
        status:"pending",
        series:null
      };
      all.push(moved);
      save(all);
    }

    $("taskDetailDialog").close();
    selectedDate=tomorrow;
    currentFilter="today";
    render();
  };
  $("editBtn").onclick=()=>{$("taskDetailDialog").close();openEdit(t)};
  $("deleteBtn").onclick=()=>{if(confirm("¿Eliminar este pendiente?")){save(load().filter(x=>x.id!==t.id));$("taskDetailDialog").close();render()}};
}

function openEdit(t){
  $("detailContent").innerHTML=`<div class="dialog-head"><div><div class="eyebrow">REPROGRAMAR</div><h2>Editar pendiente</h2></div><button class="close-btn" id="editClose">×</button></div>
  <form id="editForm"><label>Pendiente<input id="editTitle" required value="${esc(t.title)}"></label><label>Fecha<input id="editDate" type="date" required value="${t.date}"></label><label>Hora<input id="editTime" type="time" required value="${t.time}"></label><button class="primary-btn">Guardar cambios</button></form>`;
  $("taskDetailDialog").showModal();$("editClose").onclick=()=>$("taskDetailDialog").close();
  $("editForm").onsubmit=e=>{e.preventDefault();const a=load(),base=a.find(x=>x.id===t.id);Object.assign(base,{title:$("editTitle").value.trim(),date:$("editDate").value,time:$("editTime").value,status:"pending"});save(a);selectedDate=base.date;currentFilter="today";$("taskDetailDialog").close();render()};
}

$("prevDay").onclick=()=>{selectedDate=addDays(selectedDate,-1);currentFilter="today";render()};
$("nextDay").onclick=()=>{selectedDate=addDays(selectedDate,1);currentFilter="today";render()};
document.querySelectorAll(".filter[data-filter]").forEach(b=>b.onclick=()=>{currentFilter=b.dataset.filter;if(currentFilter==="today")selectedDate=todayString();render()});
$("datePickerBtn").onclick=()=>{const v=prompt("Fecha (AAAA-MM-DD):",selectedDate);if(v&&/^\d{4}-\d{2}-\d{2}$/.test(v)){selectedDate=v;currentFilter="today";render()}};

$("addBtn").onclick=()=>{ $("taskDate").value=selectedDate; calendarMonth=new Date(dateFromString(selectedDate).getFullYear(),dateFromString(selectedDate).getMonth(),1); renderCalendar(); $("taskForm").reset(); $("taskDate").value=selectedDate; renderCalendar(); $("taskDialog").showModal(); };
$("closeDialog").onclick=()=>$("taskDialog").close();
$("taskForm").onsubmit=e=>{
  e.preventDefault();
  const task={id:crypto.randomUUID(),title:$("title").value.trim(),date:$("taskDate").value,time:$("taskTime").value,repeat:$("repeat").value,reminder:$("reminder").value,status:"pending"};
  const a=load();a.push(task);save(a);selectedDate=task.date;currentFilter="today";$("taskForm").reset();$("taskDialog").close();render();
};
$("settingsBtn").onclick=()=>alert("Aquí añadiremos después las notificaciones y el calendario compartido.");

seed();render();
