// app.js — global state, navigation, initialisation

// ── Global state (shared across all JS modules) ──────────────────

let settings={
  full:100, good:80, mod:60,
  // Scheduled minutes per day per location group.
  // Bio staff: work hours = CO − CI (actual span, includes early arrivals).
  // Deficit uses location contracted hours × present days.
  schedMins:{
    'Head Office':600,          // 07:00–17:00 = 10h
    'Plant Office':570, // 07:30–17:00 = 9h 30m
    'Region A Sites':540,   // 08:00–17:00 = 9h (site standard)
    'Region B Sites':540,   // 08:00–17:00 = 9h
    'Overseas Site':600,
    'Hybrid':600,
    '_default':600
  }
};
let allWeeks=[];
let activeWeekId=null;
let cmpSelectedWeeks=[];
let uploadedFiles={};
let processedData=null;
let trendChart=null,pieChart=null,cmpBarChart=null,cmpLateOtChart=null;
let regSortState={};

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════

// Chart instance handles (prevent memory leaks on re-render)
let curPieChart=null;

// Table sort state
let sortStates={};

// ── Navigation ───────────────────────────────────────────────────

function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  const tabs=document.querySelectorAll('.nav-tab');
  const map={home:0,analysis:1,compare:2,staff:3,daily:4,settings:5};
  if(map[id]!==undefined) tabs[map[id]].classList.add('active');
  if(id==='compare') renderCompare();
  if(id==='analysis' && activeWeekId) renderAnalysis(activeWeekId);
  if(id==='staff') renderStaffDir();
  if(id==='daily' && !document.getElementById('daily-date').value){
    document.getElementById('daily-date').valueAsDate = new Date();
  }
}

// ── Data loading ──────────────────────────────────────────────────

async function loadWeeks(){
  allWeeks=await dbGetAll('weeks');
  allWeeks.sort((a,b)=>a.id.localeCompare(b.id));
}

// ── Entry point ───────────────────────────────────────────────────

async function init(){
  await openDB();
  // Load settings
  const sv=await dbGet('settings','thresholds');
  if(sv) settings=sv.value;
  document.getElementById('s-full').value=settings.full;
  document.getElementById('s-good').value=settings.good;
  document.getElementById('s-mod').value=settings.mod;
  // Populate scheduled hours inputs
  const sm=settings.schedMins||{};
  document.getElementById('s-sm-headoffice').value  = (sm['Head Office']||600)/60;
  document.getElementById('s-sm-plant').value     = (sm['Plant Office']||570)/60;
  document.getElementById('s-sm-regiona').value = (sm['Region A Sites']||540)/60;
  document.getElementById('s-sm-regionb').value = (sm['Region B Sites']||540)/60;
  // Load custom staff register
  const sr=await dbGet('staff_register','list');
  if(sr) staffList=sr.value;
  updateStaffRegCount();
  // Load all weeks
  await loadWeeks();
  renderHome();
  renderCmpChips();
}

init();
