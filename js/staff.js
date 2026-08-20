// staff.js — staff lookup (redesigned): directory sidebar + rich profile panel

// ── Directory ──────────────────────────────────────────────────────────────

function renderStaffDir(){
  const loc = document.getElementById('staff-dir-loc').value;
  const q   = document.getElementById('staff-search').value.toLowerCase().trim();

  // Build name → latest week data map
  const nameMap = {};
  allWeeks.forEach(wk=>{
    Object.entries(wk.data).forEach(([name,v])=>{
      if(!nameMap[name]) nameMap[name]={v,wk};
      else nameMap[name]={v,wk}; // keep latest week
    });
  });

  // Merge with staffList (include staff not yet in any week)
  const allNames = new Set([
    ...Object.keys(nameMap),
    ...staffList.map(s=>s[0])
  ]);

  let items = Array.from(allNames).sort().map(name=>{
    const sl  = staffList.find(s=>s[0]===name);
    const slLoc = sl ? sl[1] : (nameMap[name]?.v.loc||'Unknown');
    const slHrs = sl ? sl[2] : true;
    const slNote= sl ? sl[3] : '';
    const latestV = nameMap[name]?.v;
    return {name, loc:slLoc, hrs:slHrs, note:slNote, latestV};
  });

  // Filter
  if(loc) items = items.filter(i=>i.loc===loc);
  if(q)   items = items.filter(i=>i.name.toLowerCase().includes(q));

  const listEl  = document.getElementById('staff-dir-list');
  const countEl = document.getElementById('staff-dir-count');
  countEl.textContent = items.length + ' staff' + (loc||q ? ' (filtered)':'');

  const curActive = document.querySelector('.staff-dir-item.active');
  const curName   = curActive ? curActive.dataset.name : null;

  listEl.innerHTML = items.map(({name,loc,latestV})=>{
    const initials = name.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();
    const isHybrid = loc==='Hybrid';
    const sg = latestV ? getSG(latestV) : null;
    const badgeHtml = sg ? `<span class="badge ${getBadgeCls(sg)} staff-dir-badge" style="font-size:8px">${getBadgeLbl(sg)}</span>` : '';
    const active = name===curName ? ' active':'';
    return `<div class="staff-dir-item${active}" data-name="${name}" onclick="selectStaff('${name.replace(/'/g,"\\'")}')">
      <div class="staff-dir-avatar">${initials}</div>
      <div style="flex:1;min-width:0">
        <div class="staff-dir-name">${name}</div>
        <div class="staff-dir-meta">${loc}</div>
      </div>
      ${badgeHtml}
    </div>`;
  }).join('');
}

// ── Search box (autocomplete → filters directory) ─────────────────────────

function staffSearch(){
  const q = document.getElementById('staff-search').value.toLowerCase().trim();
  renderStaffDir();
  // Also show quick-pick dropdown if there are matches
  const sugg = document.getElementById('staff-suggestions');
  if(!q){ sugg.style.display='none'; return; }
  const names=new Set();
  allWeeks.forEach(w=>Object.keys(w.data).forEach(n=>{if(n.toLowerCase().includes(q))names.add(n);}));
  staffList.forEach(([n])=>{if(n.toLowerCase().includes(q))names.add(n);});
  const arr=Array.from(names).sort().slice(0,8);
  if(!arr.length){ sugg.style.display='none'; return; }
  sugg.style.display='block';
  sugg.innerHTML=arr.map(n=>`<div style="padding:7px 10px;cursor:pointer;font-size:11px;border-bottom:.5px solid var(--bd)" onmousedown="selectStaff('${n.replace(/'/g,"\\'")}');document.getElementById('staff-suggestions').style.display='none'" onmouseover="this.style.background='var(--s2)'" onmouseout="this.style.background=''">${n}</div>`).join('');
}

// ── Profile rendering ──────────────────────────────────────────────────────

function selectStaff(name){
  // Update search box
  document.getElementById('staff-search').value = name;
  document.getElementById('staff-suggestions').style.display='none';

  // Highlight active in directory
  document.querySelectorAll('.staff-dir-item').forEach(el=>{
    el.classList.toggle('active', el.dataset.name===name);
  });

  document.getElementById('staff-empty').style.display='none';
  document.getElementById('staff-content').style.display='block';

  // Avatar + header
  const initials = name.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();
  document.getElementById('staff-avatar').textContent = initials;
  document.getElementById('staff-name-display').textContent = name;

  // Get register entry
  const sl = staffList.find(s=>s[0]===name);
  const loc = sl ? sl[1] : (allWeeks.find(w=>w.data[name])?.data[name]?.loc||'Unknown');
  const isHybrid = loc==='Hybrid';
  document.getElementById('staff-loc-display').textContent = loc;

  const roleBadgeEl = document.getElementById('staff-role-badge');
  if(isHybrid){
    roleBadgeEl.innerHTML = '<span class="badge b-hy" style="font-size:9px">Hybrid</span>';
  } else if(loc==='Overseas Site'){
    roleBadgeEl.innerHTML = '<span class="badge b-hy" style="font-size:9px">Overseas Site</span>';
  } else {
    roleBadgeEl.innerHTML = '';
  }

  // Weeks this staff appears in
  const entries = allWeeks.filter(w=>w.data[name]).map(w=>({wk:w,v:w.data[name]}));

  // ── KPI summary — condensed to a single stat line ──
  const totP   = entries.reduce((s,e)=>s+e.v.p,0);
  const totSch = entries.reduce((s,e)=>s+e.v.td,0);
  const totWm  = entries.reduce((s,e)=>s+(e.v.wm||0),0);
  const totLd  = entries.reduce((s,e)=>s+(e.v.ld||0),0);
  const avgAtt = totSch ? Math.round(totP/totSch*100) : 0;
  const weeksAbs = entries.filter(e=>effectiveStatus(e.v)==='ABS'||e.v.p===0).length;

  const kpisEl = document.getElementById('staff-kpis');
  if(!entries.length){
    kpisEl.innerHTML = '<span class="dim">No week data uploaded for this staff member yet.</span>';
  } else {
    const sep = '<span class="stat-sep">·</span>';
    kpisEl.innerHTML = [
      `<span class="stat-item"><b>${entries.length}</b> week${entries.length===1?'':'s'} on record</span>`,
      `<span class="stat-item ${avgAtt>=80?'c-go':'c-wa'}"><b>${avgAtt}%</b> avg attendance</span>`,
      `<span class="stat-item"><b>${totP}</b>/${totSch}d present</span>`,
      `<span class="stat-item ${weeksAbs>0?'c-da':'c-go'}"><b>${weeksAbs}</b> absent week${weeksAbs===1?'':'s'}</span>`,
      `<span class="stat-item ${totLd>0?'c-wa':'c-go'}"><b>${totLd}</b> late</span>`,
      `<span class="stat-item"><b>${Math.round(totWm/60)}h</b> worked</span>`,
    ].join(sep);
  }

  renderStaffTrend(entries);
  renderWeekExplorer(name, entries);
}

// ── Attendance trend strip ───────────────────────────────────────────────────

function renderStaffTrend(entries){
  const chartEl=document.getElementById('staff-trend-chart');
  const avgEl=document.getElementById('staff-trend-avg');
  if(!entries.length){
    chartEl.innerHTML='<div style="font-size:11px;color:var(--tx3);padding:8px 0">No weeks uploaded yet.</div>';
    avgEl.textContent='';
    return;
  }
  const pts=entries.map(({wk,v})=>({
    label:(wk.label||wk.id).replace(/week\s*/i,'W'),
    full:wk.label||wk.id, dates:wk.dates||'',
    pct: v.td ? Math.round(v.p/v.td*100) : 0,
    g: getSG(v)
  }));
  const avg=Math.round(pts.reduce((s,p)=>s+p.pct,0)/pts.length);
  avgEl.textContent=`${avg}% avg over ${pts.length} week${pts.length===1?'':'s'}`;
  chartEl.innerHTML=`<div class="trend-bars">`+pts.map(p=>{
    const h=Math.max(6,Math.min(100,p.pct));
    return `<div class="trend-bar-col" title="${p.full} (${p.dates}) — ${p.pct}%">
      <div class="trend-bar-track"><div class="trend-bar" data-cls="${getBadgeCls(p.g)}" style="height:${h}%"></div></div>
      <div class="trend-bar-lbl">${p.label}</div>
    </div>`;
  }).join('')+`</div>`;
}

// ── Week explorer — each row expands in place to the daily register ─────────

function renderWeekExplorer(name, entries){
  const wrap=document.getElementById('staff-week-explorer');
  if(!entries.length){
    wrap.innerHTML='<div style="font-size:11px;color:var(--tx3);padding:8px 0">No weeks uploaded yet.</div>';
    return;
  }
  const ordered=[...entries].reverse(); // newest first — most relevant status up top
  const escName=name.replace(/'/g,"\\'");
  wrap.innerHTML=ordered.map(({wk,v})=>{
    const g=getSG(v);
    const isH=!v.hrs||v.loc==='Hybrid';
    const def=(!isH&&v.p>0)
      ?(()=>{ const d=v.p*(v.sm||schedMinsFor(v.loc||'_default'))-(v.wm||0); return d>0?`<span class="c-da">${hm(d)}</span>`:'<span class="c-go">0h</span>'; })()
      :'—';
    const extras=[];
    if((v.ld||0)>0) extras.push(`<span class="tag-late">L${v.ld}</span>`);
    if((v.od||0)>0) extras.push(`<span class="tag-ot">OT${v.od}</span>`);
    if((v.ed||0)>0) extras.push(`<span class="tag-early">E${v.ed}</span>`);
    if(v.incomplete) extras.push('<span class="tag-inc">⚠CI/CO</span>');
    const grid=buildWeekDayGrid(wk,v);
    return `<div class="wk-row" data-wk-id="${wk.id}">
      <div class="wk-row-main" onclick="toggleWeekRow('${wk.id}','${escName}')" title="Click to see daily records">
        <div class="wk-row-label">
          <span class="wk-row-wk">${(wk.label||wk.id).replace(/week\s*/i,'W')}</span>
          <span class="wk-row-dates">${wk.dates||''}</span>
        </div>
        ${grid}
        <div class="wk-row-stats">
          <span class="wk-stat">${v.p}<span class="c-tx3">/${v.td}d</span></span>
          <span class="wk-stat">${v.wm?hm(v.wm):'—'}</span>
          <span class="wk-stat">${def}</span>
          ${extras.join('')}
          <span class="badge ${getBadgeCls(g)}">${getBadgeLbl(g)}</span>
        </div>
        <span class="wk-row-chevron">▾</span>
      </div>
      <div class="wk-row-detail"></div>
    </div>`;
  }).join('');
}

function toggleWeekRow(wkId, name){
  const row=document.querySelector(`.wk-row[data-wk-id="${wkId}"]`);
  if(!row) return;
  const detail=row.querySelector('.wk-row-detail');
  const wasOpen=row.classList.contains('open');

  // Only one week expanded at a time
  document.querySelectorAll('.wk-row.open').forEach(r=>{
    if(r!==row){ r.classList.remove('open'); r.querySelector('.wk-row-detail').innerHTML=''; }
  });

  if(wasOpen){
    row.classList.remove('open');
    detail.innerHTML='';
  } else {
    row.classList.add('open');
    detail.innerHTML=buildDailyRegisterHTML(wkId,name);
    row.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
}

// ── Daily register (rendered inline inside the expanded week row) ───────────

function buildDailyRegisterHTML(wkId, name){
  const wk=allWeeks.find(w=>w.id===wkId); if(!wk) return '';
  const v=wk.data[name]; if(!v) return '';
  const days=v.days||{};

  // Flag date keys that fall outside the week's actual calendar window —
  // same range-aware check used during import/fix (see parse.js).
  const range=parseWeekRange(wk.dates||'');
  const MMAP={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  function monthFromStr(s){ s=(s||'').toLowerCase(); for(const[k,mv] of Object.entries(MMAP)) if(s.includes(k)) return mv; return 0; }
  let wrongKeys;
  if(range){
    const lo=addDaysISO(range.start,-1), hi=addDaysISO(range.end,1);
    wrongKeys=Object.keys(days).filter(k=>k<lo||k>hi);
  } else {
    const wkTargetMonth=monthFromStr(wk.dates||'');
    wrongKeys=wkTargetMonth ? Object.keys(days).filter(k=>{
      const m=parseInt(k.slice(5,7)), d=parseInt(k.slice(8,10)), nxt=(wkTargetMonth%12)+1;
      return m!==wkTargetMonth && m!==nxt && d===wkTargetMonth;
    }) : [];
  }

  const fixBtn = wrongKeys.length
    ? ` <button onclick="event.stopPropagation();fixWeekDates('${wkId}','${wk.dates}')" class="btn sm" style="background:var(--da);color:#fff;border-color:var(--da)">⚠ Fix dates (${wrongKeys.length} wrong)</button>`
    : '';
  const header=`<div class="wk-detail-hdr">Daily register${fixBtn}</div>`;

  if(!Object.keys(days).length){
    return header+'<div style="color:var(--tx3);padding:8px 0;font-size:11px">No daily clock records for this week.</div>';
  }

  const sorted=Object.entries(days).sort((a,b)=>a[0].localeCompare(b[0]));
  const rows=sorted.map(([dt,d])=>{
    const ciStr=d.ci?mt(d.ci):'—';
    const coStr=d.badCO
      ?`<span style="color:var(--da)" title="CO before CI">err ✕</span>`
      :(d.co?mt(d.co):'<span style="color:var(--wa)">missing ⚠</span>');
    const ciWarn=!d.ci?'<span style="color:var(--wa)">—⚠</span>':ciStr;
    const lateStr=(d.late&&d.ci)?`<span style="color:var(--wa)">${mt(d.late)}</span>`:'—';
    const earlyStr=(d.early&&d.co&&!d.badCO)?`<span style="color:var(--co)">${mt(d.early)}</span>`:'—';
    const otStr=(d.ot&&d.co&&!d.badCO)?`<span style="color:var(--te)">${mt(d.ot)}</span>`:'—';
    const incomplete=(d.ci&&!d.co)||(d.co&&!d.ci);
    let dateLabel=dt;
    try{
      const dd=new Date(dt+'T00:00:00Z');
      const dn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      dateLabel=`${dn[dd.getUTCDay()]} ${dd.getUTCDate()} ${mn[dd.getUTCMonth()]}`;
    }catch(e){}
    return `<tr style="${incomplete?'background:var(--wbg)':''}">
      <td style="font-size:11px;font-weight:500">${dateLabel}</td>
      <td class="nm">${d.ci?ciStr:ciWarn}</td>
      <td class="nm">${d.badCO?coStr:(d.co?coStr:(d.ci?'<span style="color:var(--wa)">missing ⚠</span>':'—'))}</td>
      <td class="nm">${d.wm?hm(d.wm):'—'}</td>
      <td class="nm">${lateStr}</td>
      <td class="nm">${earlyStr}</td>
      <td class="nm">${otStr}</td>
    </tr>`;
  }).join('');

  return header+`<div class="tbl-wrap"><table>
    <thead><tr>
      <th>Date</th><th class="nm">Clock In</th><th class="nm">Clock Out</th>
      <th class="nm">Work hrs</th><th class="nm">Late</th><th class="nm">Early-out</th><th class="nm">OT</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// ── Date fix utility ───────────────────────────────────────────────────────

async function fixWeekDates(wkId, wkDates){
  const wk=allWeeks.find(w=>w.id===wkId); if(!wk){alert('Week not found');return;}
  const range=parseWeekRange(wkDates||'');
  const MMAP={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  function monthFromStr(s){ s=(s||'').toLowerCase(); for(const[k,v] of Object.entries(MMAP)) if(s.includes(k)) return v; return 0; }
  const targetMonth=monthFromStr(wkDates||'');
  if(!range&&!targetMonth){alert('Cannot determine target month from "'+wkDates+'". Edit the week dates field first.');return;}
  let fixed=0;
  for(const[empName,v] of Object.entries(wk.data)){
    if(!v.days) continue;
    const newDays={};
    for(const[dt,rec] of Object.entries(v.days)){
      const m=parseInt(dt.slice(5,7)),d=parseInt(dt.slice(8,10)),y=dt.slice(0,4);
      const resolved=resolveAmbiguousDMY(y,m,d,targetMonth,range);
      if(resolved!==dt){ newDays[resolved]=rec; fixed++; }
      else { newDays[dt]=rec; }
    }
    v.days=newDays;
    const cis=Object.values(newDays).map(d=>d.ci||0).filter(x=>x>0);
    const cos=Object.values(newDays).map(d=>d.co||0).filter(x=>x>0);
    if(cis.length) v.ciMin=Math.min(...cis);
    if(cos.length) v.coMax=Math.max(...cos);
  }
  await dbPut('weeks',wk);
  const idx=allWeeks.findIndex(w=>w.id===wkId);
  if(idx>=0) allWeeks[idx]=wk;
  alert(`Fixed ${fixed} date key(s) in ${wk.label||wkId}.`);
  renderHome();
  if(activeWeekId===wkId) renderAnalysis(wkId);
}

// ── Day colour grid ────────────────────────────────────────────────────────

function dayCell(dayRec){
  if(!dayRec) return {cls:'day-none',tip:'No data'};
  if(dayRec.badCO) return {cls:'day-err',tip:'CI/CO error'};
  if(!dayRec.ci&&!dayRec.co) return {cls:'day-abs',tip:'Absent'};
  const inc=(dayRec.ci&&!dayRec.co)||(dayRec.co&&!dayRec.ci);
  if(inc) return {cls:'day-inc',tip:'Incomplete CI/CO'};
  if((dayRec.late||0)>0&&(dayRec.early||0)>0) return {cls:'day-ll',tip:`Late ${mt(dayRec.late)} · Early-out ${mt(dayRec.early)}`};
  if((dayRec.late||0)>0)  return {cls:'day-late', tip:`Late ${mt(dayRec.late)}`};
  if((dayRec.ot||0)>0)    return {cls:'day-ot',   tip:`OT ${mt(dayRec.ot)}`};
  if((dayRec.early||0)>0) return {cls:'day-early', tip:`Early-out ${mt(dayRec.early)}`};
  return {cls:'day-ok',tip:`Present · ${dayRec.wm?hm(dayRec.wm):'?'}`};
}

function buildWeekDayGrid(wk, v){
  const days=v.days||{};
  const isSite=SITE_LOCS.has(v.loc);
  const dayKeys=Object.keys(days).sort();
  let monday=null;
  if(dayKeys.length){
    const first=new Date(dayKeys[0]+'T00:00:00Z');
    const dow=first.getUTCDay();
    const diffToMon=(dow===0)?-6:1-dow;
    monday=new Date(first);
    monday.setUTCDate(first.getUTCDate()+diffToMon);
  }
  const DAY_NAMES=['Mon','Tue','Wed','Thu','Fri','Sat'];
  return `<div class="week-day-grid">`+DAY_NAMES.map((label,i)=>{
    if(label==='Sat'&&!isSite) return `<div class="day-cell day-off" title="Non-working"><span class="day-label">${label}</span><span class="day-dot"></span></div>`;
    let dt=null,rec=null;
    if(monday){ const d=new Date(monday); d.setUTCDate(monday.getUTCDate()+i); dt=d.toISOString().slice(0,10); rec=days[dt]||null; }
    const{cls,tip}=dayCell(rec);
    const timeStr=rec&&rec.ci?`<span class="day-time">${mt(rec.ci)}</span>`:'';
    return `<div class="day-cell ${cls}" title="${dt?dt+' — ':''}${tip}"><span class="day-label">${label}</span><span class="day-dot"></span>${timeStr}</div>`;
  }).join('')+'</div>';
}

// ── Open from register ─────────────────────────────────────────────────────

function openStaffFromReg(el){
  const name=el.dataset.staff||el.textContent.trim();
  showPage('staff');
  document.getElementById('staff-dir-loc').value='';
  renderStaffDir();
  selectStaff(name);
  if(activeWeekId) setTimeout(()=>toggleWeekRow(activeWeekId,name),80);
}

// ── Export stub (can be wired to PDF later) ────────────────────────────────
function exportStaffPDF(){
  alert('PDF export coming soon.');
}
