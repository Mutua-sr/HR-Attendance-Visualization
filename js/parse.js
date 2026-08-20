// parse.js — all date/time parsing and utility functions

// ── Week-range aware date disambiguation ────────────────────────────────────
// Bio/site export dates are DD/MM/YYYY (Kenya standard). When both day and
// month are ≤ 12, Excel/the exporter can silently transpose them, producing
// an ambiguous serial. The most reliable way to resolve this isn't a single
// "target month" number — it's the actual calendar window the week covers.
// If we know the week runs, say, 27 Apr – 2 May 2026, then for any ambiguous
// date we can compute BOTH candidate readings and keep whichever one actually
// falls inside that window. This also correctly handles weeks that straddle
// a month (or year) boundary, which a single target-month check cannot.

const MONTH_ABBR={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};

// Parses week date-range strings like:
//   "11–16 May 2026"         (single month)
//   "27 Jan–1 Feb 2026"      (cross-month, one year)
//   "29 Dec–3 Jan 2027"      (cross-year)
// Returns {start:'YYYY-MM-DD', end:'YYYY-MM-DD'} or null if unparseable
// (e.g. no year present anywhere in the string).
function parseWeekRange(str){
  if(!str) return null;
  const s=String(str).trim().replace(/[\u2012\u2013\u2014\u2015-]/g,'–');
  const parts=s.split('–').map(p=>p.trim()).filter(Boolean);
  if(parts.length<2) return null;
  const left=parts[0], right=parts.slice(1).join('–').trim();

  function tokenize(frag){
    const dayM=frag.match(/\b(\d{1,2})\b/);
    const day=dayM?parseInt(dayM[1]):null;
    let month=0;
    const low=frag.toLowerCase();
    for(const [abbr,num] of Object.entries(MONTH_ABBR)){ if(low.includes(abbr)){ month=num; break; } }
    const yearM=frag.match(/\b(20\d{2})\b/);
    const year=yearM?parseInt(yearM[1]):null;
    return {day,month,year};
  }

  const L=tokenize(left), R=tokenize(right);
  if(!R.day||!R.month) return null;
  const year=R.year||L.year;
  if(!year) return null;
  const leftMonth=L.month||R.month;
  if(!leftMonth||!L.day) return null;

  // Dec→Jan style wraparound: left month numerically after right month means
  // the range crosses a year boundary, so the left side is the prior year.
  const leftYear = leftMonth>R.month ? year-1 : year;

  const pad=n=>String(n).padStart(2,'0');
  return {
    start:`${leftYear}-${pad(leftMonth)}-${pad(L.day)}`,
    end:`${year}-${pad(R.month)}-${pad(R.day)}`
  };
}

function addDaysISO(iso,n){
  const d=new Date(iso+'T00:00:00Z');
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
}

// Resolves a day/month pair that may have been transposed. Prefers the
// week-range window (if known) over the older single-month heuristic, and
// falls back to the month heuristic only when the range can't decide
// (e.g. no wk-dates set, or — rarely — both readings fall inside the window).
function resolveAmbiguousDMY(y,m,d,targetMonth,weekRange){
  const pad=n=>String(n).padStart(2,'0');
  if(d<=12&&m<=12){
    const straight=`${y}-${pad(m)}-${pad(d)}`;
    const swapped =`${y}-${pad(d)}-${pad(m)}`;
    if(weekRange){
      const lo=addDaysISO(weekRange.start,-1), hi=addDaysISO(weekRange.end,1);
      const inRange=ds=>ds>=lo&&ds<=hi;
      const straightOk=inRange(straight), swappedOk=inRange(swapped);
      if(straightOk&&!swappedOk) return straight;
      if(swappedOk&&!straightOk) return swapped;
      // neither or both fit — fall through to the month heuristic below
    }
    if(targetMonth&&m!==targetMonth){
      const nxt=(targetMonth%12)+1;
      if(d===targetMonth||d===nxt) return swapped;
    }
    return straight;
  }
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseBioDate(raw, targetMonth, weekRange){
  if(raw===null||raw===undefined) return null;
  if(typeof raw==='number'&&raw>1000){
    const dt=new Date(Math.round((raw-25569)*86400*1000));
    const y=dt.getUTCFullYear(), m=dt.getUTCMonth()+1, d=dt.getUTCDate();
    if(y<2000||y>2100) return null;
    return resolveAmbiguousDMY(y,m,d,targetMonth,weekRange);
  }
  // String date (e.g. "24/04/2026") — bio exports use D/M/YYYY (Kenya standard).
  // Day > 12 makes it unambiguous; day ≤ 12 needs the same range/month-aware
  // resolution as the numeric-serial path above (single-day daily exports are
  // especially prone to this, since every row shares one date).
  const s=String(raw).trim();
  if(!s) return null;
  if(s.includes('/')){
    const p=s.split('/');
    if(p.length===3){
      const a=parseInt(p[0]), b=parseInt(p[1]), y=parseInt(p[2]);
      if(isNaN(a)||isNaN(b)||isNaN(y)||y<2000) return null;
      if(a>12) return `${y}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`; // D/M/Y, day unambiguous
      if(b>12) return `${y}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`; // month slot can't be >12 — a is day
      // Both ≤ 12 — resolve against the week window / target month, defaulting
      // to D/M (a=day, b=month) since that's the bio system's own convention.
      return resolveAmbiguousDMY(y,b,a,targetMonth,weekRange);
    }
  }
  return parseDate(raw);
}

function parseDate(raw){
  if(!raw&&raw!==0)return null;
  // Excel date serial (number > 1000 is definitely a date serial, not a time fraction)
  if(typeof raw==='number'&&raw>1000){
    const d=new Date(Math.round((raw-25569)*86400*1000));
    return d.toISOString().slice(0,10);
  }
  // datetime.datetime or Date object
  if(raw instanceof Date)return raw.toISOString().slice(0,10);
  const s=String(raw).trim();
  if(!s||s==='0')return null;
  // M/D/YYYY strings (site file format: '4/27/2026')
  const parts=s.split('/');
  if(parts.length===3){
    const y=parts[2];const d1=parseInt(parts[0]),d2=parseInt(parts[1]);
    if(isNaN(d1)||isNaN(d2)||isNaN(parseInt(y)))return null;
    // if first part > 12, it's day-first (D/M/YYYY)
    if(d1>12)return `${y}-${String(d2).padStart(2,'0')}-${String(d1).padStart(2,'0')}`;
    // default M/D/YYYY
    return `${y}-${String(d1).padStart(2,'0')}-${String(d2).padStart(2,'0')}`;
  }
  // ISO or other string
  try{const d=new Date(s);if(!isNaN(d)&&d.getFullYear()>2000)return d.toISOString().slice(0,10);}catch(e){}
  return null;
}

function parseTimeToMins(val){
  if(val===null||val===undefined||val==='')return 0;
  if(typeof val==='number'){
    // Could be: decimal fraction of day (0.333 = 08:00) OR minutes directly
    // Excel time fractions are always 0 < x < 1
    if(val>0&&val<1) return Math.round(val*24*60);  // fraction of day → minutes
    if(val>=1&&val<1440) return Math.round(val);     // already minutes
    return 0;
  }
  const s=String(val).trim();
  if(!s||s==='0'||s.toLowerCase().includes('labour')||s.toLowerCase().includes('leave')) return 0;
  if(s.includes(':')){
    const p=s.split(':');
    const h=parseInt(p[0])||0, m=parseInt(p[1])||0;
    if(h>24||m>59)return 0;  // sanity check
    return h*60+m;
  }
  // Bare 4-digit number like '1800' = 18:00
  if(/^\d{3,4}$/.test(s)){
    const n=parseInt(s);
    return Math.floor(n/100)*60+(n%100);
  }
  return 0;
}

function parseSiteDate(raw, targetMonth, weekRange){
  if(raw===null||raw===undefined) return null;

  // ── Numeric serial (primary path with raw:true) ──
  if(typeof raw==='number'){
    if(raw<1||raw>100000) return null;
    const dt=new Date(Math.round((raw-25569)*86400*1000));
    const y=dt.getUTCFullYear(), m=dt.getUTCMonth()+1, d=dt.getUTCDate();
    if(y<2000||y>2100) return null;
    return resolveAmbiguousDMY(y,m,d,targetMonth,weekRange);
  }

  // ── String cells (text typed directly, not a proper date cell) ──
  const s=String(raw).trim();
  if(!s||s==='null'||s==='undefined'||s==='nan') return null;

  if(s.includes('/')&&!s.includes('-')){
    const p=s.split('/');
    if(p.length===3){
      const a=parseInt(p[0]), b=parseInt(p[1]), y=parseInt(p[2]);
      if(isNaN(a)||isNaN(b)||isNaN(y)||y<2000) return null;
      if(a>12) return `${y}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`; // D/M/Y
      if(b>12) return `${y}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`; // M/D/Y
      // Both ≤ 12: resolve with the week window first, month heuristic second
      return resolveAmbiguousDMY(y,a,b,targetMonth,weekRange);
    }
  }

  // ISO fallback (defensive — shouldn't occur with raw:true)
  if(s.length>=10&&s[4]==='-'){
    const y=parseInt(s.slice(0,4)), m=parseInt(s.slice(5,7)), d=parseInt(s.slice(8,10));
    if(isNaN(y)||isNaN(m)||isNaN(d)||y<2000) return null;
    return resolveAmbiguousDMY(y,m,d,targetMonth,weekRange);
  }
  return null;
}

function parseSiteTime(val){
  if(val===null||val===undefined) return 0;

  // SheetJS decimal fraction for datetime.time (always 0 < fraction < 1)
  if(typeof val==='number'){
    if(val>0 && val<1) return Math.round(val*24*60);
    return 0;
  }

  let s=String(val).trim();
  if(!s||s==='null'||s==='nan') return 0;

  // Replace letter O with digit 0 (OCR artefact: "O7:45")
  s=s.replace(/^O/i,'0');

  // Strip trailing text suffixes: hrs, am, pm, Hrs, HRS, :00 after seconds
  s=s.replace(/\s*(hrs?|am|pm)$/i,'').trim();

  // Non-time text: any value containing letters after stripping suffixes → skip
  // Catches: Annual Leave, Sick Leave, Labour Day, Eid, OFF, off, -, Annual leave, sick off
  if(/[a-df-np-wyz]/i.test(s)) return 0;  // letters other than H,M,S,A,P still present
  if(s==='-'||s==='') return 0;

  // "HH:MM" or "HH:MM:SS" (standard, also "7:30Hrs" after suffix strip)
  if(s.includes(':')){
    const p=s.split(':');
    const h=parseInt(p[0])||0, m=parseInt(p[1])||0;
    if(h>24||m>59) return 0;
    return h*60+m;
  }

  // "HH;MM" semicolon typo
  if(s.includes(';')){
    const p=s.split(';');
    const h=parseInt(p[0])||0, m=parseInt(p[1])||0;
    if(h>24||m>59) return 0;
    return h*60+m;
  }

  // "HH.MM" decimal dot notation (8.00, 18.15, 17.3)
  if(s.includes('.')){
    const p=s.split('.');
    const h=parseInt(p[0])||0;
    // Right side: "00"→0min, "3"→30min, "15"→15min, "30"→30min
    let mRaw=p[1]||'0';
    const m=mRaw.length===1 ? parseInt(mRaw)*10 : parseInt(mRaw.slice(0,2))||0;
    if(h>24||m>59) return 0;
    return h*60+m;
  }

  // Bare digits: "HHMM" (4-digit) or "HH" (1-2 digit hour only)
  if(/^\d+$/.test(s)){
    const n=parseInt(s);
    if(s.length>=3){
      // e.g. "1800" → 18:00, "600" → 06:00
      const h=Math.floor(n/100), m=n%100;
      if(h<=24&&m<=59) return h*60+m;
    } else {
      // bare hour "8" → 08:00, "17" → 17:00
      if(n<=24) return n*60;
    }
  }

  return 0;
}

function normName(n){return NAME_MAP[n.trim()]||n.trim();}

function hm(mins){if(!mins)return '—';const m=Math.abs(Math.round(mins));return Math.floor(m/60)+'h '+(m%60)+'m';}

function mt(mins){if(!mins)return '—';const m=Math.abs(Math.round(mins));return Math.floor(m/60)+':'+(m%60+'').padStart(2,'0');}

function v(id){return document.getElementById(id)?.value||'';}

function kpi(lbl,val,sub,cls){return `<div class="kpi ${cls}"><div class="kpi-lbl">${lbl}</div><div class="kpi-val">${val}</div><div class="kpi-sub">${sub}</div></div>`;}

function sortTbl(tblId,col,th,numeric){
  const key=tblId+'-'+col;const asc=sortStates[key]!=='asc';sortStates[key]=asc?'asc':'desc';
  document.querySelectorAll('#'+tblId+' th').forEach(h=>h.classList.remove('sa','sd'));
  th.classList.add(asc?'sa':'sd');
  sortTblEl(tblId.replace('-table','-tbody'),col,asc,numeric);
}

function sortTblEl(tbodyId,col,asc,numeric){
  const tb=document.getElementById(tbodyId);if(!tb)return;
  const rows=[...tb.querySelectorAll('tr')];
  rows.sort((a,b)=>{
    const av=a.cells[col]?.innerText.trim()||'';
    const bv=b.cells[col]?.innerText.trim()||'';
    if(numeric){const an=parseFloat(av.replace(/[^0-9.-]/g,''))||0,bn=parseFloat(bv.replace(/[^0-9.-]/g,''))||0;return asc?an-bn:bn-an;}
    return asc?av.localeCompare(bv):bv.localeCompare(av);
  });
  rows.forEach(r=>tb.appendChild(r));
}

function monthFromDateStr(str){
    const s=str.toLowerCase();
    // "11–16 May 2026" or "4 May 2026" or "2026-05-11"
    for(const [abbr,num] of Object.entries(MONTHS_MAP)){if(s.includes(abbr))return num;}
    const iso=s.match(/(\d{4})-(\d{2})/); if(iso) return parseInt(iso[2]);
    const mdy=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(mdy) return parseInt(mdy[1]);
    return 0;
  }
