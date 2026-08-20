// daily.js — one-off daily present/absent check.
// Deliberately NOT wired to dbPut/allWeeks: nothing here is saved to the app's
// storage. The only output is a downloadable file the user takes with them.
//
// Scope: this covers biometric-tracked staff only (Head Office + Plant Office).
// On-site staff (Region A Sites / Region B Sites) aren't clocked the same way
// day-to-day and are deliberately excluded from this quick daily check —
// they're covered by the weekly site-log upload instead.

let dailyFiles = {};    // { filename: { file, type } }  type: 'bio' | 'leave' | 'unknown'
let dailyResult = null; // { date, rows:[{name,loc,status,ci,co,leaveType}] }

// ── File intake ──────────────────────────────────────────────────────────

function handleDailyDrop(e){
  e.preventDefault();
  document.getElementById('daily-drop-zone').classList.remove('drag');
  handleDailyFiles(e.dataTransfer.files);
}

function handleDailyFiles(files){
  Array.from(files).forEach(f=>{
    if(!dailyFiles[f.name]) dailyFiles[f.name]={file:f, type:'detecting'};
  });
  Promise.all(Array.from(files).map(f=>detectDailyFileType(f))).then(renderDailyFileRows);
}

async function detectDailyFileType(f){
  const entry=dailyFiles[f.name];
  try{
    const buf=await f.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array',cellDates:false});
    const sheet=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true});
    const topText=rows.slice(0,5).flat().map(c=>String(c||'').toLowerCase()).join(' ');
    const fname=f.name.toLowerCase();
    if(topText.includes('employee')&&topText.includes('leave type')){
      entry.type='leave';
    } else if(topText.includes('clock in')&&(topText.includes('late')||topText.includes('work time')||topText.includes('absent'))){
      entry.type='bio';
    } else if(fname.includes('leave')||fname.includes('application')){
      entry.type='leave';
    } else {
      entry.type='unknown';
    }
  } catch(e){
    entry.type='unknown';
  }
}

function renderDailyFileRows(){
  const list=document.getElementById('daily-file-list');
  const entries=Object.entries(dailyFiles);
  const runBtn=document.getElementById('daily-run-btn');
  if(!entries.length){ list.style.display='none'; runBtn.style.display='none'; return; }
  list.style.display='block';

  const lbl={bio:'Biometric log',leave:'Leave applications',unknown:'Unrecognised',detecting:'Reading…'};
  const cls={bio:'type-badge',leave:'type-badge leave',unknown:'type-badge unknown',detecting:'type-badge warn'};

  list.innerHTML=entries.map(([fname,e])=>`
    <div class="file-row">
      <div class="file-row-name">${fname}</div>
      <div class="file-row-controls">
        <span class="${cls[e.type]||'type-badge'}">${lbl[e.type]||e.type}</span>
        <button class="file-row-rm" onclick="removeDailyFile('${fname.replace(/'/g,"\\'")}')" title="Remove">✕</button>
      </div>
    </div>`).join('');

  const hasBio=entries.some(([,e])=>e.type==='bio');
  runBtn.style.display=hasBio?'':'none';
}

function removeDailyFile(fname){
  delete dailyFiles[fname];
  renderDailyFileRows();
}

// ── Processing ───────────────────────────────────────────────────────────

// Leave date strings look like '2026/05/04 [07:00 am]' — same format the
// weekly upload's leave parser handles. Strips the time, returns 'YYYY-MM-DD'.
function parseLeaveDateStr(raw){
  if(!raw) return null;
  const s=String(raw).trim();
  const m=s.match(/(\d{4})[/\-](\d{2})[/\-](\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function processDailyFiles(){
  const dateEl=document.getElementById('daily-date');
  if(!dateEl.value){
    dateEl.style.borderColor='var(--da)';
    setTimeout(()=>dateEl.style.borderColor='',2500);
    alert('Please select the date being checked first.');
    return;
  }
  const chosenDate=dateEl.value; // YYYY-MM-DD from the native date input
  const chosenMonth=parseInt(chosenDate.slice(5,7),10);
  const range={start:chosenDate,end:chosenDate}; // single-day window anchors date disambiguation

  const bioFiles=Object.entries(dailyFiles).filter(([,e])=>e.type==='bio');
  const leaveFiles=Object.entries(dailyFiles).filter(([,e])=>e.type==='leave');
  if(!bioFiles.length){
    alert('Add at least one recognised biometric log file first.');
    return;
  }

  document.getElementById('daily-status').textContent='Processing…';

  Promise.all([...bioFiles,...leaveFiles].map(([,e])=>e.file.arrayBuffer().then(buf=>({type:e.type,buf}))))
    .then(loaded=>{
      const recordMap={}; // normalized name -> {name,loc,status,ci,co,leaveType}

      function upsert(cName, present, ciMins, coMins){
        const sl=staffList.find(s=>s[0]===cName);
        const loc=sl?sl[1]:'Unknown';
        const rec=recordMap[cName]||{name:cName,loc,status:'absent',ci:0,co:0,leaveType:''};
        if(present){
          rec.status='present';
          rec.ci=Math.max(rec.ci,ciMins||0);
          rec.co=Math.max(rec.co,coMins||0);
        }
        recordMap[cName]=rec;
      }

      // ── Biometric log(s) — Head Office + Plant Office only ──
      for(const {type,buf} of loaded){
        if(type!=='bio') continue;
        const wb=XLSX.read(buf,{type:'array',cellDates:false});
        const sheet=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true});

        const hdIdx=rows.findIndex(r=>r.some(c=>String(c).trim()==='Name'));
        if(hdIdx<0) continue;
        const hd=rows[hdIdx].map(c=>String(c).trim());
        const niCol =hd.findIndex(h=>h==='Name');
        const dtCol =hd.findIndex(h=>h==='Date');
        const ciCol =hd.findIndex(h=>h.toLowerCase().includes('clock')&&h.toLowerCase().includes('in'));
        const coCol =hd.findIndex(h=>h.toLowerCase().includes('clock')&&h.toLowerCase().includes('out'));
        const wtCol =hd.findIndex(h=>h.toLowerCase()==='work time'||h.toLowerCase()==='worktime');
        const absCol=hd.findIndex(h=>h.toLowerCase()==='absent');
        if(niCol<0) continue;

        for(let i=hdIdx+1;i<rows.length;i++){
          const row=rows[i]; if(!row) continue;
          const rawName=String(row[niCol]||'').trim();
          if(!rawName||rawName==='Name') continue;
          const dt = dtCol>=0 ? parseBioDate(row[dtCol],chosenMonth,range) : chosenDate;
          if(dt && dt!==chosenDate) continue; // a multi-day export — only keep the chosen day
          const cName=normName(rawName);

          // Skip anyone not part of the biometric-tracked population (e.g. an
          // on-site or Hybrid employee who happens to appear in the export).
          const sl=staffList.find(s=>s[0]===cName);
          const loc=sl?sl[1]:null;
          if(loc && loc!=='Head Office' && loc!=='Plant Office') continue;

          const ciMins=parseTimeToMins(row[ciCol]);
          const coMins=parseTimeToMins(row[coCol]);
          const wm=parseTimeToMins(row[wtCol]);
          const absFlag=absCol>=0 ? String(row[absCol]||'').trim().toLowerCase()==='true' : false;
          const present=(ciMins>0||wm>0)&&!absFlag;
          upsert(cName,present,ciMins,coMins);
        }
      }

      // Cross-reference the biometric roster so a complete no-show (no row at
      // all in the file) still shows up as absent rather than being skipped.
      staffList.forEach(([nm,loc])=>{
        if(loc!=='Head Office'&&loc!=='Plant Office') return;
        const cName=normName(nm);
        if(!recordMap[cName]) recordMap[cName]={name:cName,loc,status:'absent',ci:0,co:0,leaveType:''};
      });

      // ── Leave applications — reclassify anyone on approved/pending leave
      // that covers the chosen date, so they read as "On leave" rather than
      // an unexplained absence. Presence still wins if they clocked in anyway.
      for(const {type,buf} of loaded){
        if(type!=='leave') continue;
        const wb=XLSX.read(buf,{type:'array',cellDates:false});
        const sheet=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true});

        const hdIdx=rows.findIndex(r=>r&&r.some(c=>String(c||'').trim()==='Staff No.'||String(c||'').trim()==='Employee'));
        if(hdIdx<0) continue;
        const hd=rows[hdIdx].map(c=>String(c||'').trim());
        const empCol  =hd.findIndex(h=>h==='Employee');
        const typeCol =hd.findIndex(h=>h.toLowerCase().includes('leave type')||h.toLowerCase()==='type');
        const startCol=hd.findIndex(h=>h.toLowerCase().includes('start date')||h.toLowerCase()==='start');
        const endCol  =hd.findIndex(h=>h.toLowerCase().includes('end date')||h.toLowerCase()==='end');
        if(empCol<0) continue;

        for(let i=hdIdx+1;i<rows.length;i++){
          const row=rows[i]; if(!row) continue;
          const emp=String(row[empCol]||'').trim(); if(!emp||emp==='nan') continue;
          const cName=normName(emp);
          const sl=staffList.find(s=>s[0]===cName);
          const loc=sl?sl[1]:null;
          if(loc && loc!=='Head Office' && loc!=='Plant Office') continue; // out of scope for this check

          const startISO=parseLeaveDateStr(row[startCol]);
          const endISO  =parseLeaveDateStr(row[endCol]);
          if(!startISO||!endISO) continue;
          if(chosenDate<startISO||chosenDate>endISO) continue; // leave doesn't cover the chosen date

          const lt=String(row[typeCol]||'Leave').trim();
          const rec=recordMap[cName];
          if(rec && rec.status!=='present'){
            rec.status='leave';
            rec.leaveType=lt;
          } else if(!rec){
            recordMap[cName]={name:cName,loc:loc||'Unknown',status:'leave',ci:0,co:0,leaveType:lt};
          }
        }
      }

      const rowsArr=Object.values(recordMap).sort((a,b)=>a.name.localeCompare(b.name));
      dailyResult={date:chosenDate,rows:rowsArr};
      renderDailyResults();
      document.getElementById('daily-status').textContent='';
    })
    .catch(err=>{
      console.error(err);
      document.getElementById('daily-status').textContent='';
      alert('Could not read one of the files. Check it is a valid .xlsx/.xls export.');
    });
}

// ── Results + download (no save) ────────────────────────────────────────

function renderDailyResults(){
  if(!dailyResult) return;
  const {date,rows}=dailyResult;
  const present=rows.filter(r=>r.status==='present');
  const onLeave=rows.filter(r=>r.status==='leave');
  const absent=rows.filter(r=>r.status==='absent');

  document.getElementById('daily-results').style.display='block';
  document.getElementById('daily-results-title').textContent=`Results — ${date}`;
  document.getElementById('daily-present-count').textContent=present.length;
  document.getElementById('daily-leave-count').textContent=onLeave.length;
  document.getElementById('daily-absent-count').textContent=absent.length;

  const pct=rows.length?Math.round(present.length/rows.length*100):0;
  const sep='<span class="stat-sep">·</span>';
  document.getElementById('daily-kpis').innerHTML=[
    `<span class="stat-item"><b>${rows.length}</b> staff checked</span>`,
    `<span class="stat-item c-go"><b>${present.length}</b> present</span>`,
    `<span class="stat-item"><b>${onLeave.length}</b> on leave</span>`,
    `<span class="stat-item ${absent.length?'c-da':'c-go'}"><b>${absent.length}</b> absent</span>`,
    `<span class="stat-item"><b>${pct}%</b> attendance</span>`,
  ].join(sep);

  document.getElementById('daily-present-tbody').innerHTML = present.length
    ? present.map(r=>`<tr><td>${r.name}</td><td class="dim">${r.loc}</td><td class="nm">${r.ci?mt(r.ci):'—'}</td><td class="nm">${r.co?mt(r.co):'—'}</td></tr>`).join('')
    : `<tr><td colspan="4" style="color:var(--tx3);font-size:11px;padding:10px 0">None.</td></tr>`;

  document.getElementById('daily-leave-tbody').innerHTML = onLeave.length
    ? onLeave.map(r=>`<tr><td>${r.name}</td><td class="dim">${r.loc}</td><td class="dim">${r.leaveType||'—'}</td></tr>`).join('')
    : `<tr><td colspan="3" style="color:var(--tx3);font-size:11px;padding:10px 0">None.</td></tr>`;

  document.getElementById('daily-absent-tbody').innerHTML = absent.length
    ? absent.map(r=>`<tr><td>${r.name}</td><td class="dim">${r.loc}</td></tr>`).join('')
    : `<tr><td colspan="2" style="color:var(--tx3);font-size:11px;padding:10px 0">None.</td></tr>`;

  document.getElementById('daily-results').scrollIntoView({behavior:'smooth',block:'nearest'});
}

function downloadDailyReport(){
  if(!dailyResult){ alert('Run a check first.'); return; }
  const {date,rows}=dailyResult;
  const statusOrder={present:0,leave:1,absent:2};
  const statusLbl={present:'Present',leave:'On Leave',absent:'Absent'};
  const sheetRows=rows
    .sort((a,b)=> statusOrder[a.status]-statusOrder[b.status] || a.name.localeCompare(b.name))
    .map(r=>({
      Name:r.name,
      Location:r.loc,
      Status:statusLbl[r.status]||r.status,
      'Leave Type':r.status==='leave'?(r.leaveType||''):'',
      'Clock In':r.ci?mt(r.ci):'',
      'Clock Out':r.co?mt(r.co):''
    }));
  const ws=XLSX.utils.json_to_sheet(sheetRows);
  ws['!cols']=[{wch:22},{wch:18},{wch:10},{wch:14},{wch:10},{wch:10}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Attendance');
  // Client-side file generation only — this is never written to dbPut/allWeeks,
  // so nothing from this page persists in the app.
  XLSX.writeFile(wb, `Daily-Attendance-${date}.xlsx`);
}

// ── PDF export (print-to-PDF, no library, nothing saved) ────────────────

function formatPrintDate(iso){
  try{
    const d=new Date(iso+'T00:00:00Z');
    return d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  }catch(e){ return iso; }
}

function printDailyReport(){
  if(!dailyResult){ alert('Run a check first.'); return; }
  const {date,rows}=dailyResult;
  const present=rows.filter(r=>r.status==='present').sort((a,b)=>a.name.localeCompare(b.name));
  const onLeave=rows.filter(r=>r.status==='leave').sort((a,b)=>a.name.localeCompare(b.name));
  const absent=rows.filter(r=>r.status==='absent').sort((a,b)=>a.name.localeCompare(b.name));
  const pct=rows.length?Math.round(present.length/rows.length*100):0;

  document.getElementById('print-date').textContent=formatPrintDate(date);
  document.getElementById('print-generated').textContent=new Date().toLocaleString();
  document.getElementById('print-present-count').textContent=present.length;
  document.getElementById('print-leave-count').textContent=onLeave.length;
  document.getElementById('print-absent-count').textContent=absent.length;
  document.getElementById('print-summary').innerHTML=`
    <span><b>${rows.length}</b> staff checked</span>
    <span><b>${present.length}</b> present</span>
    <span><b>${onLeave.length}</b> on leave</span>
    <span><b>${absent.length}</b> absent</span>
    <span><b>${pct}%</b> attendance</span>
  `;

  document.querySelector('#print-present-table tbody').innerHTML = present.length
    ? present.map(r=>`<tr><td>${r.name}</td><td>${r.loc}</td><td>${r.ci?mt(r.ci):'—'}</td><td>${r.co?mt(r.co):'—'}</td></tr>`).join('')
    : `<tr><td colspan="4">None.</td></tr>`;

  document.querySelector('#print-leave-table tbody').innerHTML = onLeave.length
    ? onLeave.map(r=>`<tr><td>${r.name}</td><td>${r.loc}</td><td>${r.leaveType||'—'}</td></tr>`).join('')
    : `<tr><td colspan="3">None.</td></tr>`;

  document.querySelector('#print-absent-table tbody').innerHTML = absent.length
    ? absent.map(r=>`<tr><td>${r.name}</td><td>${r.loc}</td></tr>`).join('')
    : `<tr><td colspan="2">None.</td></tr>`;

  // Nothing is saved here — window.print() just opens the browser's own
  // print dialog, where "Save as PDF" produces the file locally.
  window.print();
}

// ── Reset when leaving/re-entering the page ─────────────────────────────

function resetDailyCheck(){
  dailyFiles={};
  dailyResult=null;
  document.getElementById('daily-file-input').value='';
  document.getElementById('daily-file-list').innerHTML='';
  document.getElementById('daily-file-list').style.display='none';
  document.getElementById('daily-run-btn').style.display='none';
  document.getElementById('daily-status').textContent='';
  document.getElementById('daily-results').style.display='none';
}
