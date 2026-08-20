// render-home.js — home page: week cards, trend chart

function renderHome(){
  const grid=document.getElementById('week-grid');
  const empty=document.getElementById('home-empty');
  const trendWrap=document.getElementById('trend-wrap');
  empty.style.display=allWeeks.length?'none':'block';
  trendWrap.style.display=allWeeks.length>1?'block':'none';

  document.getElementById('home-sub').textContent=
    allWeeks.length?`${allWeeks.length} week${allWeeks.length>1?'s':''} stored · Click a week to analyse`:'No data yet';

  grid.innerHTML='';
  allWeeks.forEach(wk=>{
    const k=computeKPIs(wk.data);
    const attColor=k.att>=70?'var(--go)':k.att>=50?'var(--wa)':'var(--da)';
    const card=document.createElement('div');
    card.className='week-card'+(activeWeekId===wk.id?' selected':'');
    card.innerHTML=`
      <button class="wc-del" onclick="event.stopPropagation();deleteWeek('${wk.id}')" title="Delete week">✕</button>
      <div class="wc-label">${wk.label||wk.id}</div>
      <div class="wc-dates">${wk.dates||''}</div>
      <div class="wc-stats">
        <div class="wc-stat"><div class="wc-stat-val" style="color:${attColor}">${k.att}%</div><div class="wc-stat-lbl">Att rate</div></div>
        <div class="wc-stat"><div class="wc-stat-val">${k.n_full+k.n_good}</div><div class="wc-stat-lbl">Full+Good</div></div>
        <div class="wc-stat"><div class="wc-stat-val" style="color:var(--da)">${k.n_abs}</div><div class="wc-stat-lbl">Absent</div></div>
        <div class="wc-stat"><div class="wc-stat-val">${k.total}</div><div class="wc-stat-lbl">Staff</div></div>
      </div>`;
    card.onclick=()=>selectWeek(wk.id);
    grid.appendChild(card);
  });

  // Add week button — admin only
  if(authIsAdmin()){
    const add=document.createElement('div');
    add.className='add-week-card';
    add.innerHTML='<span style="font-size:22px">+</span><span>Upload new week</span>';
    add.onclick=openUploadModal;
    grid.appendChild(add);
  }

  // Hide delete buttons for viewers
  if(!authIsAdmin()){
    grid.querySelectorAll('.wc-del').forEach(b=>b.style.display='none');
  }

  renderTrendChart();
}

function renderTrendChart(){
  if(allWeeks.length<2) return;
  const labels=allWeeks.map(w=>w.label||w.id);
  const vals=allWeeks.map(w=>computeKPIs(w.data).att);
  if(trendChart) trendChart.destroy();
  trendChart=new Chart(document.getElementById('trend-chart'),{
    type:'line',
    data:{labels,datasets:[{
      data:vals,borderColor:'#185fa5',backgroundColor:'#e6f1fb80',
      tension:.3,fill:true,pointRadius:4,pointHoverRadius:6
    }]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%',font:{size:9}}},
              x:{ticks:{font:{size:9}}}}}
  });
}

function selectWeek(id){
  activeWeekId=id;
  document.querySelectorAll('.week-card').forEach(c=>c.classList.remove('selected'));
  showPage('analysis');
  renderAnalysis(id);
}

async function deleteWeek(id){
  if(!confirm('Delete this week\'s data?')) return;
  await dbDelete('weeks',id);
  await loadWeeks();
  if(activeWeekId===id) activeWeekId=null;
  renderHome();
  renderCmpChips();
}
