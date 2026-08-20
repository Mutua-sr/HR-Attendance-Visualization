// render-analysis.js — week analysis, register, inline edit

function renderAnalysis(id){
  const wk=allWeeks.find(w=>w.id===id);
  if(!wk){document.getElementById('analysis-empty').style.display='block';document.getElementById('analysis-content').style.display='none';return;}
  document.getElementById('analysis-empty').style.display='none';
  document.getElementById('analysis-content').style.display='block';
  document.getElementById('analysis-title').textContent=wk.label||wk.id;
  document.getElementById('analysis-sub').textContent=wk.dates||'';

  const data=wk.data;
  const k=computeKPIs(data);
  const prevWk=allWeeks[allWeeks.indexOf(wk)-1];
  const prevK=prevWk?computeKPIs(prevWk.data):null;

  renderKPIs(k,prevK);
  renderAlert(data,k,wk);
  renderPie(k);
  renderLocSummary(data);
  renderRegister(data);
}

function renderKPIs(k,prev){
  function dv(a,b){return prev!=null?Math.round((a-b)*10)/10:null;}
  function kp(lbl,val,sub,cls,delta,pct,col){
    let d='';
    if(delta!=null){const s=delta>0?'+':'';const c=delta<0?'var(--go)':delta>0?'var(--da)':'var(--tx3)';d=`<span class="kpi-delta" style="color:${c}">${s}${delta}</span>`;}
    let sp='';
    if(pct!=null&&col)sp=`<div class="kpi-spark"><div class="kpi-spark-fill" style="width:${Math.min(100,Math.max(0,pct))}%;background:${col}"></div></div>`;
    return `<div class="kpi ${cls}">${d}<div class="kpi-lbl">${lbl}</div><div class="kpi-val">${val}</div><div class="kpi-sub">${sub}</div>${sp}</div>`;
  }
  const r1=[
    kp('Attendance rate',k.att+'%','scheduled staff only','kp-hi',dv(k.att,prev?.att),k.att,'#185fa5'),
    kp('Work hours',hm(k.tot_wm),'CO − CI actual (all scheduled staff)','',null,null,null),
    kp('Required hours',Math.round(k.tot_req/60)+'h','present days × contracted hrs/day','kp-wa',null,null,null),
    kp('Hours deficit',hm(k.deficit),'req − worked','kp-da',null,k.tot_req?k.deficit/k.tot_req*100:0,'#a32d2d'),
    kp('Punctuality',k.punc+'%','non-late ÷ present',k.punc>=75?'kp-go':'kp-wa',null,null,null),
    kp('Full',k.n_full,'100% present','kp-go',dv(k.n_full,prev?.n_full),null,null),
    kp('Absent',k.n_abs,'zero days (excl. hybrid/leave)','kp-da',dv(k.n_abs,prev?.n_abs),null,null),
    kp('On leave',k.n_lv,'all — pending included','',null,null,null),
  ];
  const r2=[
    kp('Total late time',hm(k.tot_lm),k.tot_ld+' occurrences','kp-wa',dv(k.tot_lm,prev?.tot_lm),null,null),
    kp('Late employees',k.late_emp,'with ≥1 late arrival','kp-wa',null,null,null),
    kp('Total early-out',hm(k.tot_em),k.tot_ed+' occurrences','',null,null,null),
    kp('Early-out employees',k.early_emp,'left before shift end','',null,null,null),
    kp('OT hours',hm(k.tot_om),k.tot_od+' occurrences','kp-te',dv(k.tot_om,prev?.tot_om),null,null),
    kp('OT employees',k.ot_emp,'with ≥1 OT session','kp-te',null,null,null),
    kp('Late+Left Early',k.ll_emp,'both late & early-out','kp-mo',null,null,null),
    kp('Compliant',k.n_full+k.n_good+k.n_mod,'full+good+mod','kp-go',null,null,null),
  ];
  document.getElementById('kpi-r1').innerHTML=r1.join('');
  document.getElementById('kpi-r2').innerHTML=r2.join('');
}

function renderAlert(data,k,wk){
  const el=document.getElementById('analysis-alert');
  const msgs=[];
  // Show excluded days at the top so it's clear why td is reduced
  if(wk&&wk.exclusions&&wk.exclusions.length){
    const exList=wk.exclusions.map(ex=>{
      const who=ex.applies==='all'?'all staff':ex.applies==='site'?'site staff':'bio staff';
      return `<strong>${ex.date}</strong> ${ex.label||'Holiday'} <span style="color:var(--tx3)">(${who})</span>`;
    }).join(' · ');
    msgs.push(`<div class="alert alert-info">📅 ${wk.exclusions.length} excluded day(s) applied to schedule: ${exList}</div>`);
  }
  if(k.n_abs>10) msgs.push(`<div class="alert alert-warn">⚠ ${k.n_abs} employees with zero present days — check site sheet upload</div>`);
  if(k.tot_lm>3000) msgs.push(`<div class="alert alert-warn">⚠ High late time: ${hm(k.tot_lm)} total late arrivals</div>`);
  el.innerHTML=msgs.join('');
}

function renderPie(k){
  const counts=[k.n_full,k.n_good,k.n_mod,k.n_poor,k.n_abs,k.n_lv,k.n_hy];
  if(curPieChart) curPieChart.destroy();
  curPieChart=new Chart(document.getElementById('pie-chart'),{
    type:'doughnut',
    data:{labels:PIE_LBLS,datasets:[{data:counts,backgroundColor:PIE_COLORS,borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},cutout:'56%'}
  });
  document.getElementById('pie-legend').innerHTML=PIE_LBLS.map((l,i)=>
    `<span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:2px;background:${PIE_COLORS[i]};display:inline-block"></span>${l} ${counts[i]}</span>`
  ).join('');
}

function renderLocSummary(data){
  const locs={};
  Object.entries(data).forEach(([n,v])=>{
    const l=v.loc;
    if(!locs[l]) locs[l]={n:0,p:0,wm:0,lm:0,om:0};
    locs[l].n++; locs[l].p+=v.p; locs[l].wm+=v.wm||0; locs[l].lm+=v.lm||0; locs[l].om+=v.om||0;
  });
  const order=['Head Office','Plant Office','Region A Sites','Region B Sites','Overseas Site','Hybrid'];
  document.getElementById('loc-summary').innerHTML=order.filter(l=>locs[l]).map(l=>{
    const d=locs[l];
    const isSite=SITE_LOCS.has(l);
    return `<div class="loc-row">
      <div><div class="loc-name">${l}</div><div class="loc-sub">${d.n} staff · ${isSite?'6-day':'5-day'} schedule · ${d.p} present days</div></div>
      <div class="loc-stats-row">
        <div class="ls"><div class="ls-val" style="color:var(--ac)">${d.wm?Math.round(d.wm/60)+'h':'—'}</div><div class="ls-lbl">worked</div></div>
        <div class="ls"><div class="ls-val" style="color:${d.lm?'var(--wa)':'var(--go)'}">${d.lm?hm(d.lm):'—'}</div><div class="ls-lbl">late</div></div>
        <div class="ls"><div class="ls-val" style="color:var(--te)">${d.om?hm(d.om):'—'}</div><div class="ls-lbl">OT</div></div>
      </div></div>`;
  }).join('');
}

function renderRegister(data){
  const thead=document.getElementById('reg-thead');
  // Register columns: name links to daily register, Absent removed (shown as gap in fraction)
  const cols=['Name','Location','Site / Note','Present','Work hrs','Deficit','Leave','Status',''];
  const numCols=new Set([3,4,5,6]);
  thead.innerHTML=cols.map((c,i)=>{
    if(i===cols.length-1) return `<th style="width:28px${authIsAdmin()?'':';display:none'}"></th>`; // edit col
    return `<th${numCols.has(i)?' class="nm"':''} onclick="sortReg(${i},this${numCols.has(i)?',"n"':''})">${c}</th>`;
  }).join('');
  buildRegRows(data);
  filterReg();
}

function buildRegRows(data){
  const tbody=document.getElementById('reg-tbody');
  const rows=Object.entries(data).sort((a,b)=>a[0].localeCompare(b[0]));
  tbody.innerHTML=rows.map(([name,v])=>{
    const g=getSG(v);
    const isH=!v.hrs || v.loc==='Hybrid';
    const es=effectiveStatus(v);
    const hide=es==='ABS'||es==='LEAVE'||es==='HYBRID';

    // Deficit
    let def='—';
    if(!isH&&v.p>0){
      const dv=v.p*(v.sm||schedMinsFor(v.loc||'_default'))-(v.wm||0);
      def=dv>0?`<span class="c-da">${hm(dv)}</span>`:`<span class="c-go">0h</span>`;
    }

    // Present fraction — always show for all staff including hybrid
    const pDisp=`${v.p}<span style="color:var(--tx3);font-size:9px">/${v.td}d</span>`;

    // Leave: show days + type hint
    const lvDisp=v.lv
      ?`<span style="color:var(--ac)" title="${v.lt||''}">${v.lv%1===0?v.lv:v.lv.toFixed(1)}d${v.lt?' · '+v.lt.slice(0,8)+'…':''}</span>`
      :'—';

    // Work hours
    const wrk=v.wm&&!isH?hm(v.wm):'—';

    // Name links to Staff Lookup — no hazard beside name
    const eName=name.replace(/"/g,'&quot;'); // escape quotes for HTML attr
    const nameCell=`<span class="reg-name" onclick="openStaffFromReg(this)" data-staff="${eName}">${name}</span>`;
    // Status badge — also show late/OT/early as small inline tags if relevant
    let extras='';
    if(!hide){
      if((v.ld||0)>0) extras+=`<span class="tag-late">L${v.ld}</span>`;
      if((v.od||0)>0) extras+=`<span class="tag-ot">OT${v.od}</span>`;
      if((v.ed||0)>0) extras+=`<span class="tag-early">E${v.ed}</span>`;
    }

    // Note: truncate long site note
    const noteDisp=v.note
      ?`<span class="reg-note" title="${v.note}">${v.note.length>22?v.note.slice(0,20)+'…':v.note}</span>`
      :'<span style="color:var(--tx4)">—</span>';

    // If the employee has incomplete CI/CO, do not classify as early-out
    // (no CO means we can't know if they left early)
    // If hybrid, always keep hybrid display regardless of incomplete flag
    const gDisplay = (g==='hybrid') ? 'hybrid' : (v.incomplete && g==='early' ? getSG({...v,ed:0,em:0}) : g);
    return `<tr data-name="${name.toLowerCase()}" data-loc="${v.loc.toLowerCase()}"
      data-sg="${gDisplay}" data-hrs="${isH?'n':'y'}" data-p="${v.p||0}"
      data-late="${v.ld||0}" data-ot="${v.od||0}" data-early="${v.incomplete?0:(v.ed||0)}"
      data-leave="${v.lv||0}" data-incomplete="${v.incomplete?'y':'n'}">
      <td class="fw" style="min-width:140px">${nameCell}</td>
      <td class="dim" style="font-size:10px">${v.loc}</td>
      <td style="min-width:80px">${noteDisp}</td>
      <td class="nm">${pDisp}</td>
      <td class="nm">${wrk}</td>
      <td class="nm">${def}</td>
      <td class="nm">${lvDisp}</td>
      <td><span class="badge ${getBadgeCls(gDisplay)}">${getBadgeLbl(gDisplay)}</span>${extras}${v.incomplete?'<span class="tag-inc">⚠CI/CO</span>':''}</td>
      <td style="width:28px;text-align:center${authIsAdmin()?'':';display:none'}"><button class="edit-toggle" data-name="${name}" onclick="toggleRowEdit(this,'${name.replace(/'/g,"\\'")}');event.stopPropagation()" style="background:none;border:none;cursor:pointer;color:var(--tx4);font-size:12px;padding:2px 4px;border-radius:3px" title="Edit this row">✎</button></td>
    </tr>`;
  }).join('');
}

function filterReg(){
  const q   =v('f-name').toLowerCase();
  const loc =v('f-loc');
  const sg  =v('f-status');
  const inc =v('f-inc');
  const pres=v('f-present');  // 'y' = show only present (p > 0)
  let vis=0;
  document.querySelectorAll('#reg-tbody tr').forEach(tr=>{
    const ok=
      (!q    || (tr.dataset.name||'').includes(q))  &&
      (!loc  || (tr.dataset.loc||'').includes(loc)) &&
      (!sg   || tr.dataset.sg===sg)                 &&
      (!inc  || tr.dataset.incomplete===inc)         &&
      (!pres || +tr.dataset.p>0);
    tr.style.display=ok?'':'none';
    if(ok) vis++;
  });
  const all=document.querySelectorAll('#reg-tbody tr').length;
  document.getElementById('reg-count').textContent=vis+' of '+all+' employees';
}

function sortReg(col,th,type){
  const key='reg-'+col;const asc=regSortState[key]!=='asc';regSortState[key]=asc?'asc':'desc';
  document.querySelectorAll('#reg-thead th').forEach(h=>h.classList.remove('sa','sd'));
  th.classList.add(asc?'sa':'sd');
  sortTblEl('reg-tbody',col,asc,type==='n');
}

function toggleRowEdit(btn, name){
  const tr = btn.closest('tr');
  let editRow = tr.nextElementSibling;
  if(editRow && editRow.classList.contains('edit-row')){
    editRow.remove(); btn.textContent='✎'; return;
  }
  // Close any other open edit rows first
  document.querySelectorAll('.edit-row').forEach(r=>r.remove());
  document.querySelectorAll('.edit-toggle').forEach(b=>b.textContent='✎');

  const wk = allWeeks.find(w=>w.id===activeWeekId); if(!wk) return;
  const v = wk.data[name]; if(!v) return;

  const colSpan = 9; // matches the 9 columns in the register
  const er = document.createElement('tr');
  er.className = 'edit-row';
  er.innerHTML = `<td colspan="${colSpan}" style="background:var(--s2);padding:10px 12px;border-bottom:.5px solid var(--bd)">
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end">
      <div>
        <div style="font-size:10px;color:var(--tx3);margin-bottom:3px">Leave days</div>
        <input type="number" id="edit-lv-${name.replace(/\W/g,'_')}" value="${v.lv||0}" min="0" max="14" step="0.5"
          style="width:70px;padding:4px 7px;border:.5px solid var(--bd);border-radius:var(--rs);font-size:11px">
      </div>
      <div>
        <div style="font-size:10px;color:var(--tx3);margin-bottom:3px">Leave type</div>
        <input type="text" id="edit-lt-${name.replace(/\W/g,'_')}" value="${v.lt||''}" placeholder="e.g. Annual Leave"
          style="width:140px;padding:4px 7px;border:.5px solid var(--bd);border-radius:var(--rs);font-size:11px">
      </div>
      <div>
        <div style="font-size:10px;color:var(--tx3);margin-bottom:3px">Status override</div>
        <select id="edit-st-${name.replace(/\W/g,'_')}"
          style="padding:4px 7px;border:.5px solid var(--bd);border-radius:var(--rs);font-size:11px">
          <option value="">— auto —</option>
          <option value="FULL"${v._override==='FULL'?' selected':''}>Full</option>
          <option value="GOOD"${v._override==='GOOD'?' selected':''}>Good</option>
          <option value="MOD"${v._override==='MOD'?' selected':''}>Moderate</option>
          <option value="POOR"${v._override==='POOR'?' selected':''}>Poor</option>
          <option value="ABS"${v._override==='ABS'?' selected':''}>Absent</option>
          <option value="LEAVE"${v._override==='LEAVE'?' selected':''}>Leave</option>
          <option value="HYBRID"${v._override==='HYBRID'?' selected':''}>Hybrid</option>
        </select>
      </div>
      <div>
        <div style="font-size:10px;color:var(--tx3);margin-bottom:3px">Site / Note</div>
        <input type="text" id="edit-nt-${name.replace(/\W/g,'_')}" value="${v.note||''}" placeholder="e.g. Client Site C"
          style="width:150px;padding:4px 7px;border:.5px solid var(--bd);border-radius:var(--rs);font-size:11px">
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn primary sm" onclick="saveRegEdit('${name.replace(/'/g,"\\'")}')">Save</button>
        <button class="btn sm" onclick="this.closest('.edit-row').remove();document.querySelector('.edit-toggle[data-name=\\'${name.replace(/'/g,"\\'\\'")}\\']').textContent='✎'">Cancel</button>
      </div>
    </div>
  </td>`;
  tr.after(er);
  btn.textContent = '✕';
}

async function saveRegEdit(name){
  const wk = allWeeks.find(w=>w.id===activeWeekId); if(!wk) return;
  const v = wk.data[name]; if(!v) return;
  const key = name.replace(/\W/g,'_');

  const lv   = parseFloat(document.getElementById(`edit-lv-${key}`)?.value)||0;
  const lt   = document.getElementById(`edit-lt-${key}`)?.value.trim()||'';
  const over = document.getElementById(`edit-st-${key}`)?.value||'';
  const note = document.getElementById(`edit-nt-${key}`)?.value.trim()||'';

  // Apply edits to the data object
  v.lv = lv; v.lt = lt; v.note = note;
  // Status: if override set, use it; else recompute from attendance
  if(over){
    v._override = over;
    v.s = over;
  } else {
    delete v._override;
    v.s = getStatus(v.p, v.td, v.lv, v.loc==='Hybrid');
  }
  v.a = Math.max(0, v.td - v.p); // recompute absent

  // Persist to IndexedDB
  await dbPut('weeks', wk);
  // Update allWeeks in memory
  const idx = allWeeks.findIndex(w=>w.id===wk.id);
  if(idx>=0) allWeeks[idx] = wk;

  // Re-render register in place — close edit row first
  document.querySelectorAll('.edit-row').forEach(r=>r.remove());
  renderRegister(wk.data);
  // Also refresh home trend and comparison chips
  renderHome();
  renderCmpChips();
  // If staff lookup is showing this person, refresh their history
  const staffSearchVal = document.getElementById('staff-search').value.trim();
  if(staffSearchVal === name) selectStaff(name);

  // Flash the saved row
  setTimeout(()=>{
    const rows = document.querySelectorAll('#reg-tbody tr');
    rows.forEach(r=>{if((r.dataset.name||'')=== name.toLowerCase()){
      r.style.transition='background .3s';
      r.style.background='var(--gbg)';
      setTimeout(()=>{r.style.background='';},1200);
    }});
  },50);
}
