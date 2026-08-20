// render-compare.js — Comparison — chips, charts, tables

function renderCmpChips(){
  const el=document.getElementById('cmp-chips');
  el.innerHTML='';
  allWeeks.forEach(wk=>{
    const sel=cmpSelectedWeeks.includes(wk.id);
    const chip=document.createElement('div');
    chip.className='cmp-chip'+(sel?' sel':'');
    chip.textContent=(wk.label||wk.id)+(sel?' ×':'');
    chip.onclick=()=>{
      if(sel) cmpSelectedWeeks=cmpSelectedWeeks.filter(x=>x!==wk.id);
      else cmpSelectedWeeks.push(wk.id);
      renderCmpChips();
      renderCompare();
    };
    el.appendChild(chip);
  });
}

function renderCompare(){
  const weeks=allWeeks.filter(w=>cmpSelectedWeeks.includes(w.id));
  const empty=document.getElementById('cmp-empty');
  const content=document.getElementById('cmp-content');
  if(weeks.length<2){empty.style.display='block';content.style.display='none';return;}
  empty.style.display='none';content.style.display='block';

  const ks=weeks.map(w=>({...computeKPIs(w.data),label:w.label||w.id,id:w.id,data:w.data}));

  // KPIs: show best/worst
  const best=ks.reduce((a,b)=>a.att>b.att?a:b);
  const worst=ks.reduce((a,b)=>a.att<b.att?a:b);
  document.getElementById('cmp-kpis').innerHTML=[
    kpi('Weeks selected',weeks.length,'',''),
    kpi('Best attendance',best.att+'%',best.label,'kp-go'),
    kpi('Worst attendance',worst.att+'%',worst.label,'kp-da'),
    kpi('Avg attendance',Math.round(ks.reduce((s,k)=>s+k.att,0)/ks.length*10)/10+'%','across selected weeks','kp-hi'),
    kpi('Total late time',hm(ks.reduce((s,k)=>s+k.tot_lm,0)),'combined','kp-wa'),
    kpi('Total OT time',hm(ks.reduce((s,k)=>s+k.tot_om,0)),'combined','kp-te'),
    kpi('Chronic absent',chronicCount(weeks),'absent in all selected weeks','kp-da'),
    kpi('Most improved',improvedCount(weeks),'absent→present','kp-go'),
  ].join('');

  // Charts
  if(cmpBarChart) cmpBarChart.destroy();
  cmpBarChart=new Chart(document.getElementById('cmp-bar'),{
    type:'bar',
    data:{labels:ks.map(k=>k.label),datasets:[{label:'Att %',data:ks.map(k=>k.att),backgroundColor:'#b5d4f480',borderColor:'#185fa5',borderWidth:1}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%',font:{size:9}}},x:{ticks:{font:{size:9}}}}}
  });
  if(cmpLateOtChart) cmpLateOtChart.destroy();
  cmpLateOtChart=new Chart(document.getElementById('cmp-late-ot'),{
    type:'bar',
    data:{labels:ks.map(k=>k.label),datasets:[
      {label:'Late hrs',data:ks.map(k=>Math.round(k.tot_lm/60)),backgroundColor:'#fac77580',borderColor:'#ba7517',borderWidth:1},
      {label:'OT hrs',data:ks.map(k=>Math.round(k.tot_om/60)),backgroundColor:'#9fe1cb80',borderColor:'#0f6e56',borderWidth:1}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:9}}}},scales:{x:{ticks:{font:{size:9}}},y:{ticks:{font:{size:9}}}}}
  });

  // Table
  const cols=['Metric',...ks.map(k=>k.label)];
  document.getElementById('cmp-thead').innerHTML=cols.map(c=>`<th>${c}</th>`).join('');
  const metrics=[
    ['Attendance rate',...ks.map(k=>k.att+'%')],
    ['Work hours',...ks.map(k=>hm(k.tot_wm))],
    ['Hours deficit',...ks.map(k=>hm(k.deficit))],
    ['Full attendance',...ks.map(k=>k.n_full)],
    ['Good attendance',...ks.map(k=>k.n_good)],
    ['Moderate',...ks.map(k=>k.n_mod)],
    ['Poor',...ks.map(k=>k.n_poor)],
    ['Absent',...ks.map(k=>k.n_abs)],
    ['On leave',...ks.map(k=>k.n_lv)],
    ['Total late time',...ks.map(k=>hm(k.tot_lm))],
    ['Late employees',...ks.map(k=>k.late_emp)],
    ['Total OT time',...ks.map(k=>hm(k.tot_om))],
    ['OT employees',...ks.map(k=>k.ot_emp)],
    ['Early-out employees',...ks.map(k=>k.early_emp)],
    ['Punctuality %',...ks.map(k=>k.punc+'%')],
  ];
  document.getElementById('cmp-tbody').innerHTML=metrics.map(row=>
    `<tr>${row.map((c,i)=>`<td${i>0?' class="nm"':''}>${c}</td>`).join('')}</tr>`
  ).join('');

  // Chronic & improved
  document.getElementById('chronic-list').innerHTML=buildChronicList(weeks);
  document.getElementById('improved-list').innerHTML=buildImprovedList(weeks);
}

function chronicCount(weeks){
  if(weeks.length<2) return 0;
  const sets=weeks.map(w=>new Set(Object.keys(w.data).filter(n=>effectiveStatus(w.data[n])==='ABS')));
  return [...sets[0]].filter(n=>sets.every(s=>s.has(n))).length;
}

function improvedCount(weeks){
  if(weeks.length<2) return 0;
  const first=weeks[0];const last=weeks[weeks.length-1];
  return Object.keys(first.data).filter(n=>effectiveStatus(first.data[n])==='ABS'&&last.data[n]&&effectiveStatus(last.data[n])!=='ABS').length;
}

function buildChronicList(weeks){
  if(weeks.length<2) return '<div style="color:var(--tx3);font-size:11px">Need 2+ weeks</div>';
  const sets=weeks.map(w=>new Set(Object.keys(w.data).filter(n=>effectiveStatus(w.data[n])==='ABS')));
  const both=[...sets[0]].filter(n=>sets.every(s=>s.has(n))).sort();
  if(!both.length) return '<div style="color:var(--tx3);font-size:11px">None.</div>';
  return both.map(n=>{
    const v=weeks[0].data[n];
    return `<div class="loc-row" style="padding:5px 0"><div><div style="font-size:11px;font-weight:500">${n}</div><div style="font-size:9px;color:var(--tx3)">${v.loc}</div></div><span class="badge b-ab">All weeks</span></div>`;
  }).join('');
}

function buildImprovedList(weeks){
  if(weeks.length<2) return '<div style="color:var(--tx3);font-size:11px">Need 2+ weeks</div>';
  const first=weeks[0];const last=weeks[weeks.length-1];
  const imp=Object.keys(first.data).filter(n=>effectiveStatus(first.data[n])==='ABS'&&last.data[n]&&effectiveStatus(last.data[n])!=='ABS').sort();
  if(!imp.length) return '<div style="color:var(--tx3);font-size:11px">None.</div>';
  return imp.map(n=>{
    const s=last.data[n].s;
    const cls=getBadgeCls(getSG(last.data[n]));
    return `<div class="loc-row" style="padding:5px 0"><div><div style="font-size:11px;font-weight:500">${n}</div><div style="font-size:9px;color:var(--tx3)">${first.data[n].loc}</div></div><div style="display:flex;gap:4px;align-items:center"><span class="badge b-ab">Abs</span><span style="font-size:9px">→</span><span class="badge ${cls}">${s}</span></div></div>`;
  }).join('');
}
