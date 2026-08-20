// upload.js — modal, file detection, processFiles, exclusions, saveWeek

function openUploadModal(){
  uploadedFiles={};processedData=null;
  document.getElementById('file-rows').innerHTML='';
  document.getElementById('file-list').style.display='none';
  document.getElementById('excl-rows').innerHTML='';
  document.getElementById('proc-progress').style.display='none';
  document.getElementById('proc-steps').style.display='none';
  document.getElementById('proc-preview').style.display='none';
  document.getElementById('proc-btn').style.display='';
  document.getElementById('save-btn').style.display='none';
  document.getElementById('file-input').value='';
  document.getElementById('wk-label').value='';
  document.getElementById('wk-dates').value='';
  document.getElementById('upload-modal').classList.add('show');
}
function closeUploadModal(){document.getElementById('upload-modal').classList.remove('show');}
function handleDragOver(e){e.preventDefault();document.getElementById('drop-zone').classList.add('drag');}
function handleDragLeave(e){document.getElementById('drop-zone').classList.remove('drag');}
function handleDrop(e){
  e.preventDefault();document.getElementById('drop-zone').classList.remove('drag');
  handleFiles(e.dataTransfer.files);
}
// uploadedFiles: { filename: { file, type, sheets[], selectedSheet } }
function handleFiles(files){
  Array.from(files).forEach(f=>{
    if(!uploadedFiles[f.name]){
      uploadedFiles[f.name]={ file:f, type:'unknown', sheets:[], selectedSheet:'' };
    }
  });
  // Read each new file to detect type from content and extract sheet names
  Promise.all(Array.from(files).map(f=>detectFileContent(f))).then(()=>{
    renderFileRows();
    autoFillWeekLabel();
  });
}

async function detectFileContent(f){
  const entry=uploadedFiles[f.name];
  try{
    const buf=await f.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array',cellDates:false});
    entry.sheets=wb.SheetNames;

    // ── Content-based type detection ─────────────────────────────────────
    // 1. Check filename hints first (fast, usually reliable)
    const n=f.name.toLowerCase();
    if(n.includes('headoffice'))                         { entry.type='Bio-Head Office'; return; }
    if(n.includes('plant')||n.includes('plantoffice'))   { entry.type='Bio-Plant';    return; }
    if(n.includes('application')||n.includes('leave')){ entry.type='Leave apps'; return; }
    if(n.includes('staff')||n.includes('register'))  { entry.type='Staff register'; return; }

    // 2. Scan first sheet's header row for signature columns
    const firstSheet=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(firstSheet,{header:1,defval:null,raw:true});
    // Read first 5 rows looking for column headers
    const topText=rows.slice(0,5).flat().map(c=>String(c||'').toLowerCase()).join(' ');

    if(topText.includes('clock in')&&topText.includes('clock out')&&
       (topText.includes('location')||topText.includes('site'))){
      // Site master: has Clock In + Clock Out + Location/Site
      entry.type='Site log';
      // If multi-sheet, prompt user to pick a sheet
      if(wb.SheetNames.length>1){
        // Auto-select: look for a sheet whose name matches "week" + number
        const wkLabel=(document.getElementById('wk-label').value||'').toLowerCase();
        const wkMatch=wb.SheetNames.find(s=>{
          const sl=s.toLowerCase();
          // Exact match first ("Week 20", "week20")
          if(wkLabel&&(sl.includes(wkLabel)||wkLabel.includes(sl.replace(/\s/g,'')))) return true;
          return false;
        })||'';
        entry.selectedSheet=wkMatch||wb.SheetNames[wb.SheetNames.length-1];
      } else {
        entry.selectedSheet=wb.SheetNames[0];
      }
      return;
    }

    if(topText.includes('clock in')&&(topText.includes('late')||topText.includes('work time'))){
      // Biometric file: has Clock In + Late or Work Time
      // Distinguish Head Office vs Plant by scanning name column for known names
      entry.type='Bio-Head Office'; // default; user can override
      entry.selectedSheet=wb.SheetNames[0];
      return;
    }

    if(topText.includes('employee')&&topText.includes('leave type')){
      entry.type='Leave apps';
      entry.selectedSheet=wb.SheetNames[0];
      return;
    }

    // Still unknown — mark so user can manually set
    entry.type='unknown';
    entry.selectedSheet=wb.SheetNames[0];
  } catch(e){
    entry.type='unknown';
  }
}

function renderFileRows(){
  const container=document.getElementById('file-rows');
  const listEl=document.getElementById('file-list');
  const entries=Object.entries(uploadedFiles);
  if(!entries.length){ listEl.style.display='none'; return; }
  listEl.style.display='block';

  const TYPE_OPTS=[
    {v:'Bio-Head Office', l:'Bio — Head Office'},
    {v:'Bio-Plant',    l:'Bio — Plant'},
    {v:'Site log',   l:'Site log'},
    {v:'Leave apps', l:'Leave applications'},
    {v:'Staff register', l:'Staff register'},
    {v:'skip',       l:'Skip this file'},
  ];

  const typeBadgeCls={
    'Bio-Head Office':'type-badge','Bio-Plant':'type-badge',
    'Site log':'type-badge site','Leave apps':'type-badge leave',
    'Staff register':'type-badge','unknown':'type-badge unknown','skip':'type-badge warn'
  };

  container.innerHTML=entries.map(([name,entry])=>{
    const typeOpts=TYPE_OPTS.map(o=>
      `<option value="${o.v}"${entry.type===o.v?' selected':''}>${o.l}</option>`
    ).join('');

    // Sheet picker: only show for multi-sheet site files
    const showSheetPicker=entry.sheets.length>1&&entry.type==='Site log';
    const sheetOpts=entry.sheets.map(s=>
      `<option value="${s}"${entry.selectedSheet===s?' selected':''}>${s}</option>`
    ).join('');
    const sheetPicker=showSheetPicker
      ? `<div class="file-row-sheet">
           <select onchange="setFileSheet('${name}',this.value)" title="Select which sheet to process">
             ${sheetOpts}
           </select>
         </div>`
      : (entry.sheets.length>1&&entry.type!=='Site log'
           ? `<span style="font-size:9px;color:var(--tx3)">${entry.sheets.length} sheets</span>`
           : '');

    return `<div class="file-row" id="frow-${CSS.escape(name)}">
      <div class="file-row-name" title="${name}">${name}</div>
      <div class="file-row-controls">
        <div class="file-row-type">
          <select onchange="setFileType('${name}',this.value)">${typeOpts}</select>
        </div>
        ${sheetPicker}
        <button class="file-row-rm" onclick="removeFile('${name}')" title="Remove">✕</button>
      </div>
    </div>`;
  }).join('');
}

function setFileType(name, type){
  if(uploadedFiles[name]){
    uploadedFiles[name].type=type;
    // If switching to Site log and multi-sheet, show picker
    renderFileRows();
  }
}
function setFileSheet(name, sheet){
  if(uploadedFiles[name]) uploadedFiles[name].selectedSheet=sheet;
}
function removeFile(name){ delete uploadedFiles[name]; renderFileRows(); }

// detectFileType removed — detection is content-based via detectFileContent()

// Week date lookup table — ISO week number → Monday start date (for 2026)
// Used when only a week number is available and wk-dates is blank
const WK_DATES_2026={
  1:'6–11 Jan 2026',2:'13–18 Jan 2026',3:'20–25 Jan 2026',4:'27 Jan–1 Feb 2026',
  5:'3–8 Feb 2026',6:'10–15 Feb 2026',7:'17–22 Feb 2026',8:'24 Feb–1 Mar 2026',
  9:'3–8 Mar 2026',10:'10–15 Mar 2026',11:'17–22 Mar 2026',12:'24–29 Mar 2026',
  13:'31 Mar–5 Apr 2026',14:'7–12 Apr 2026',15:'14–19 Apr 2026',16:'21–26 Apr 2026',
  17:'28 Apr–3 May 2026',18:'27 Apr–2 May 2026',19:'4–9 May 2026',20:'11–16 May 2026',
  21:'18–23 May 2026',22:'25–30 May 2026',23:'1–6 Jun 2026',24:'8–13 Jun 2026',
  25:'15–20 Jun 2026',26:'22–27 Jun 2026',27:'29 Jun–4 Jul 2026',28:'6–11 Jul 2026',
  29:'13–18 Jul 2026',30:'20–25 Jul 2026',31:'27 Jul–1 Aug 2026',32:'3–8 Aug 2026',
  33:'10–15 Aug 2026',34:'17–22 Aug 2026',35:'24–29 Aug 2026'
};

function autoFillWeekLabel(){
  const labelEl=document.getElementById('wk-label');
  const datesEl=document.getElementById('wk-dates');
  const names=Object.keys(uploadedFiles);
  let wkNum=null;

  // ── Try to get week number from filenames or sheet names ──
  if(!labelEl.value){
    const wkMatch=names.find(n=>/week\s*\d+/i.test(n));
    if(wkMatch){ const m=wkMatch.match(/week\s*(\d+)/i); if(m) wkNum=+m[1]; }
    if(!wkNum){
      for(const [,entry] of Object.entries(uploadedFiles)){
        if(entry.type==='Site log'&&entry.selectedSheet){
          const m=entry.selectedSheet.match(/week\s*(\d+)/i);
          if(m){ wkNum=+m[1]; break; }
        }
      }
    }
    if(wkNum) labelEl.value='Week '+wkNum;
  } else {
    // Extract week number from existing label
    const m=labelEl.value.match(/(\d+)/);
    if(m) wkNum=+m[1];
  }

  // ── Auto-fill date range from week number lookup ──
  if(!datesEl.value && wkNum && WK_DATES_2026[wkNum]){
    datesEl.value=WK_DATES_2026[wkNum];
    datesEl.style.borderColor='var(--go)'; // flash green to show auto-filled
    setTimeout(()=>datesEl.style.borderColor='',2000);
  }
}

async function processFiles(){
  collectExclusions(); // snapshot exclusions before anything else
  const entries=Object.entries(uploadedFiles).filter(([,e])=>e.type!=='skip'&&e.type!=='unknown');
  if(!entries.length){alert('Please add files and set their types');return;}

  // ── Require date range before processing ────────────────────────────
  // The date range (wk-dates) is essential for DD/MM→MM/DD date correction.
  // Without it, any week where days ≤ 12 will have wrong dates in the register.
  const datesEl=document.getElementById('wk-dates');
  if(!datesEl.value.trim()){
    datesEl.style.borderColor='var(--da)';
    datesEl.placeholder='Required — e.g. 4–9 May 2026';
    datesEl.focus();
    setTimeout(()=>{ datesEl.style.borderColor=''; datesEl.placeholder='11–16 May 2026'; }, 3000);
    alert('Please fill in the Date range before processing.\n\nExample: "4–9 May 2026"\n\nThis is needed to correctly identify dates where the day number is ≤ 12.');
    return;
  }
  // ────────────────────────────────────────────────────────────────────
  const label=document.getElementById('wk-label').value||'Week '+(allWeeks.length+18);
  document.getElementById('wk-label').value=label;

  document.getElementById('proc-progress').style.display='block';
  document.getElementById('proc-steps').style.display='block';
  document.getElementById('proc-btn').style.display='none';

  const steps=document.getElementById('proc-steps');
  function addStep(txt,status){
    const li=document.createElement('li');
    li.innerHTML=`<div class="step-icon ${status}">${status==='ok'?'✓':status==='warn'?'!':'?'}</div><span>${txt}</span>`;
    steps.appendChild(li);return li;
  }
  function setFill(pct){document.getElementById('proc-fill').style.width=pct+'%';}

  steps.innerHTML='';
  let s=addStep('Reading files…','spin');setFill(10);

  // Read all files — but for site files, ONLY read the selected sheet
  const fileData={};
  for(const [fname,entry] of entries){
    const buf=await entry.file.arrayBuffer();
    // For site files with a selected sheet, read only that sheet to avoid
    // processing the entire multi-week master file
    const opts={type:'array',cellDates:false};
    if(entry.type==='Site log'&&entry.selectedSheet){
      opts.sheets=entry.selectedSheet;
    }
    const wb=XLSX.read(buf,opts);
    fileData[fname]={wb,type:entry.type,selectedSheet:entry.selectedSheet||''};
  }
  s.querySelector('.step-icon').className='step-icon ok';
  s.querySelector('span').textContent='Files read: '+entries.length;
  setFill(30);

  s=addStep('Detecting dates…','spin');
  const bioFiles=Object.entries(fileData).filter(([,d])=>d.type.startsWith('Bio'));
  const siteFiles=Object.entries(fileData).filter(([,d])=>d.type==='Site log');
  const leaveFiles=Object.entries(fileData).filter(([,d])=>d.type==='Leave apps');

  // ── Derive authoritative targetMonth from the wk-dates field ──────────
  // Both bio and site files use DD/MM/YYYY entry convention (Kenya standard).
  // When day ≤ 12, Excel misreads DD/MM as MM/DD and stores the wrong serial.
  // We correct this by knowing which month the week is in — taken from the
  // user-supplied date range (most reliable source, avoids in-file detection
  // which fails for weeks where ALL days are ≤ 12, e.g. WK19: days 4–9 May).
  const MONTHS_MAP={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  function monthFromDateStr(str){
    const s=str.toLowerCase();
    // "11–16 May 2026" or "4 May 2026" or "2026-05-11"
    for(const [abbr,num] of Object.entries(MONTHS_MAP)){if(s.includes(abbr))return num;}
    const iso=s.match(/(\d{4})-(\d{2})/); if(iso) return parseInt(iso[2]);
    const mdy=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(mdy) return parseInt(mdy[1]);
    return 0;
  }
  // Try wk-dates first; fall back to the wk-label (in case user typed "4 May")
  const wkDatesRaw=document.getElementById('wk-dates').value||'';
  const wkLabelRaw=document.getElementById('wk-label').value||'';
  let globalTargetMonth=monthFromDateStr(wkDatesRaw)||monthFromDateStr(wkLabelRaw)||0;

  // Authoritative calendar window for this week (start/end ISO dates), used
  // ahead of the month-only heuristic to resolve transposed day/month dates —
  // see resolveAmbiguousDMY in parse.js.
  const globalWeekRange=parseWeekRange(wkDatesRaw)||parseWeekRange(wkLabelRaw)||null;

  // Last resort: scan file sheet names for a known week number and look it up
  if(!globalTargetMonth){
    for(const [,entry] of Object.entries(uploadedFiles)){
      if(entry.selectedSheet){
        const m=entry.selectedSheet.match(/week\s*(\d+)/i);
        if(m){
          const wkN=+m[1];
          const wkStr=WK_DATES_2026[wkN]||'';
          globalTargetMonth=monthFromDateStr(wkStr)||0;
          if(globalTargetMonth) break;
        }
      }
    }
  }

  // Warn if we still have no targetMonth — date correction won't fire
  if(!globalTargetMonth){
    addStep('⚠ No date range set — dates with day ≤ 12 may be wrong. Fill in "Date range" and re-process.','warn');
  }
  // ──────────────────────────────────────────────────────────────────────

  s.querySelector('.step-icon').className='step-icon ok';
  s.querySelector('span').textContent=`Bio: ${bioFiles.length} · Site: ${siteFiles.length} · Leave: ${leaveFiles.length}${globalTargetMonth?' · month correction: '+globalTargetMonth:' · ⚠ no date range'}`;
  setFill(50);

  s=addStep('Computing attendance…','spin');
  // ── Bio file processing ──────────────────────────────────────────────────
  // Two-pass per file:
  //   Pass 1: scan Date column for unambiguous serials (day > 12 when converted)
  //           to establish the target month for this file.
  //   Pass 2: convert all date serials, applying month-swap correction for
  //           dates where both day and month ≤ 12 (Excel may have stored
  //           DD/MM as MM/DD, e.g. 11/05/2026 → Nov 5 serial instead of May 11).
  //
  //   PRESENT  = any row has Clock In OR Work Time (no CI/WT = ghost row, skip)
  //   Clock In  = EARLIEST non-null Clock In across all present-rows for that day
  //   Clock Out = LATEST  non-null Clock Out across all present-rows for that day
  //   Work time = CO − CI (actual span); fallback to Work Time col if CO missing
  // ────────────────────────────────────────────────────────────────────────
  const bioRaw={};  // bioRaw[name][date] = array of raw day-row objects
  for(const [name,{wb}] of bioFiles){
    const sheet=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true});
    const hdIdx=rows.findIndex(r=>r.some(c=>String(c).trim()==='Name'));
    if(hdIdx<0) continue;
    const hd=rows[hdIdx].map(c=>String(c).trim());
    const niCol =hd.findIndex(h=>h==='Name');
    const dtCol =hd.findIndex(h=>h==='Date');
    const ciCol =hd.findIndex(h=>h.toLowerCase().includes('clock')&&h.toLowerCase().includes('in'));
    const coCol =hd.findIndex(h=>h.toLowerCase().includes('clock')&&h.toLowerCase().includes('out'));
    const lateCol=hd.findIndex(h=>h==='Late');
    const earlyCol=hd.findIndex(h=>h==='Early');
    const otCol =hd.findIndex(h=>h.toLowerCase()==='ot time'||h.toLowerCase()==='ot');
    const wtCol =hd.findIndex(h=>h.toLowerCase()==='work time'||h.toLowerCase()==='worktime');

    // ── Process rows — use globalTargetMonth for date correction ──
    // Bio files use DD/MM/YYYY (Kenya standard). When day ≤ 12, Excel stores the
    // wrong serial (misreads as MM/DD). globalTargetMonth (from wk-dates field)
    // is the authoritative correction — no per-file anchor detection needed.
    for(let i=hdIdx+1;i<rows.length;i++){
      const row=rows[i];
      const rawName=String(row[niCol]||'').trim();
      if(!rawName||rawName==='Name')continue;
      const cName=normName(rawName);
      const dt=parseBioDate(row[dtCol],globalTargetMonth,globalWeekRange);
      if(!dt)continue;
      const ciRaw=row[ciCol]; const coRaw=row[coCol]; const wtRaw=row[wtCol];
      const ciMins=parseTimeToMins(ciRaw);
      const coMins=parseTimeToMins(coRaw);
      const wm    =parseTimeToMins(wtRaw);
      // Only keep rows that have actual clock data — no CI and no Work Time = ghost row, skip
      if(!ciMins && !wm) continue;
      if(!bioRaw[cName])bioRaw[cName]={};
      if(!bioRaw[cName][dt])bioRaw[cName][dt]=[];
      bioRaw[cName][dt].push({
        ci:ciMins, co:coMins,
        late:parseTimeToMins(row[lateCol]),
        early:parseTimeToMins(row[earlyCol]),
        ot:parseTimeToMins(row[otCol]),
        wm
      });
    }
  }
  // Collapse each (name, date) array → single day record
  const bioResults={};
  for(const [cName,days] of Object.entries(bioRaw)){
    bioResults[cName]={};
    for(const [dt,recs] of Object.entries(days)){
      // Present if any record has CI or WM
      const presentRecs=recs.filter(r=>r.ci||r.wm);
      if(!presentRecs.length) continue;
      // Earliest clock-in, latest clock-out across all present records for this day
      const cis=presentRecs.map(r=>r.ci).filter(x=>x>0);
      const cos=presentRecs.map(r=>r.co).filter(x=>x>0);
      const earliestCI=cis.length?Math.min(...cis):0;
      const latestCO  =cos.length?Math.max(...cos):0;
      // Work time: use CO − CI directly (includes early arrivals before scheduled start).
      // The biometric Work Time column is capped to the scheduled window, so it
      // understates actual time worked for employees who arrive early.
      // Fall back to Work Time column only when CO is missing (incomplete record).
      let wm=0;
      if(earliestCI>0&&latestCO>0){
        if(latestCO>=earliestCI){
          wm=latestCO-earliestCI;                    // normal same-day span
        } else {
          wm=(1440-earliestCI)+latestCO;             // midnight-crossing shift
        }
        // Sanity cap: single span > 16h is likely a data error
        if(wm>960) wm=Math.max(...presentRecs.map(r=>r.wm||0));
      } else {
        // No CO available — use Work Time column as best estimate
        wm=Math.max(...presentRecs.map(r=>r.wm||0));
      }
      // Late/Early/OT: taken from biometric system (calculated against schedule).
      // Only valid when CI is recorded. If no CI, zero them — can't validate.
      // If no CO, zero early-out — can't know when they left.
      const late =earliestCI>0?(presentRecs.map(r=>r.late).find(x=>x>0)||0):0;
      const early=latestCO>0?(presentRecs.map(r=>r.early).find(x=>x>0)||0):0;
      const ot   =latestCO>0?(presentRecs.map(r=>r.ot).find(x=>x>0)||0):0;
      bioResults[cName][dt]={ci:earliestCI,co:latestCO,late,early,ot,wm};
    }
  }

  // ── Site file processing ────────────────────────────────────────────────
  // Layout: # | Location/Team | Name | Date | Start | End | Clock In | Clock Out | Site/Notes
  // (older layout: No. | Name | Date | Timetable | On duty | Off duty | Clock In | Clock Out | Location)
  // Both layouts detected by keyword. Name column uses merged cells → forward-fill.
  //
  // Metrics computed per day from the site file:
  //   Work time  = CO − CI (handles midnight-crossing: if CO < CI → (1440−CI) + CO)
  //   Late       = max(0, CI − Start)    — if CI > Start by > 1min
  //   Early-out  = max(0, End − CO)      — if CO < End by > 1min (excluding nights)
  //   OT         = max(0, CO − End)      — if CO > End by > 1min (excluding nights)
  //   Night shift flag: CI ≥ 17:00 (1020min) → skip late/early/OT calculations
  //
  // Multi-site: Site/Notes cells often contain "Client Site I/Client Site F" or "Client Site B/Thindigua"
  // We collect ALL site notes across the week and store as a deduplicated joined string.
  // ─────────────────────────────────────────────────────────────────────────
  const siteResults={};   // { name: { date: { ci, co, start, end, wm, lm, em, om, note } } }
  const siteNotes={};     // { name: Set of unique site labels across the week }

  for(const [fname,{wb,selectedSheet}] of siteFiles){
    const sheetsToProcess = selectedSheet
      ? wb.SheetNames.filter(n=>n===selectedSheet)
      : wb.SheetNames.slice(0,1);
    for(const shName of sheetsToProcess){
      const sheet=wb.Sheets[shName];
      const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true});
      let hdIdx=-1;
      for(let i=0;i<Math.min(rows.length,5);i++){
        if(rows[i]&&rows[i].some(c=>String(c||'').trim()==='Name'||String(c||'').trim()==='Location / Team')){
          hdIdx=i;break;
        }
      }
      if(hdIdx<0)continue;

      // Keyword-based column detection
      const hdr=rows[hdIdx].map(c=>String(c||'').trim());
      const findCol=(...kws)=>{for(let j=0;j<hdr.length;j++){const h=hdr[j].toLowerCase();if(kws.every(k=>h.includes(k)))return j;}return -1;};
      const niCol=findCol('name');
      const dtCol=findCol('date');
      const ciCol=findCol('clock','in');
      const coCol=findCol('clock','out');
      const stCol=findCol('start');   // scheduled start
      const enCol=findCol('end');     // scheduled end
      const ntCol=findCol('site')||findCol('note')||findCol('location')>niCol?findCol('location'):-1; // site/notes
      if(niCol<0||dtCol<0||ciCol<0)continue;

      // Use globalTargetMonth — site files also use DD/MM/YYYY (Kenya standard)
      // The per-sheet string-date tally is replaced by the authoritative month
      // from the wk-dates field, which handles weeks where all days ≤ 12.
      const targetMonth=globalTargetMonth;

      // Forward-fill name, compute metrics per day
      let lastName='';
      for(let i=hdIdx+1;i<rows.length;i++){
        const row=rows[i]; if(!row)continue;
        const rawName=String(row[niCol]??'').trim();
        if(rawName&&rawName!=='nan'&&rawName!=='null'&&rawName!=='Name'&&rawName!=='undefined') lastName=rawName;
        if(!lastName)continue;
        const cName=normName(lastName);
        const dt=parseSiteDate(row[dtCol],targetMonth,globalWeekRange); if(!dt)continue;

        // Clock In — skip non-time text
        const ciRaw=row[ciCol];
        const ciMins=parseSiteTime(ciRaw);
        if(!ciMins) continue;  // absent / leave / unparseable

        const coRaw=row[coCol];
        const coMins=parseSiteTime(coRaw); // 0 if missing/unparseable
        const stMins=stCol>=0?parseSiteTime(row[stCol]):480;  // default 08:00
        const enMins=enCol>=0?parseSiteTime(row[enCol]):1020; // default 17:00

        // ── Work time calculation ──────────────────────────────────────────
        // Night shift = CI ≥ 17:00. Only night shifts can legitimately have CO < CI
        // (e.g. CI=18:00, CO=06:00 next day = 12h valid midnight cross).
        // Day shifts with CO < CI = DATA ERROR (e.g. CI=07:50, CO=06:00 is impossible).
        // Data error: treat CO as missing → employee still present, work = 0, flag incomplete.
        const isNight=ciMins>=1020;
        let wm=0;
        let badCO=false; // true when CO looks like a data error
        if(coMins>0){
          if(coMins>=ciMins){
            // Normal: same day, CO after CI
            wm=coMins-ciMins;
          } else if(isNight){
            // Valid midnight-crossing night shift (e.g. 18:00→06:00)
            wm=(1440-ciMins)+coMins;
          } else {
            // Day shift with CO < CI → data entry error (e.g. 07:50→06:00)
            // Mark as bad, set work=0, flag as incomplete
            badCO=true;
            wm=0;
          }
        }
        // Sanity cap: no single shift should exceed 16h
        // (catches any remaining edge cases or extreme outliers)
        if(wm>960) wm=0, badCO=true;

        // ── Late / Early-out / OT ──────────────────────────────────────────
        // Skip for night shifts (different schedule) and data-error rows
        let lm=0,em=0,om=0;
        if(!isNight&&!badCO&&stMins>0&&enMins>0){
          const GRACE=1;
          if(ciMins-stMins>GRACE)  lm=ciMins-stMins;     // arrived late
          if(coMins>0&&coMins>=ciMins){
            if(enMins-coMins>GRACE) em=enMins-coMins;     // left early
            if(coMins-enMins>GRACE) om=coMins-enMins;     // overtime
          }
        }

        // Collect site note (employee may work multiple sites across days)
        const noteRaw=ntCol>=0?String(row[ntCol]||'').trim():'';
        if(noteRaw&&noteRaw!=='null'&&noteRaw!=='nan'){
          if(!siteNotes[cName]) siteNotes[cName]=new Set();
          // Split slash-delimited multi-site entries
          noteRaw.split('/').map(s=>s.trim()).filter(Boolean).forEach(s=>siteNotes[cName].add(s));
        }

        if(!siteResults[cName]) siteResults[cName]={};
        if(!siteResults[cName][dt]){
          siteResults[cName][dt]={ci:ciMins,co:badCO?0:coMins,late:lm,early:em,ot:om,wm,badCO};
        } else {
          // Multiple entries same day: earliest CI, latest CO, accumulate metrics
          if(ciMins<siteResults[cName][dt].ci) siteResults[cName][dt].ci=ciMins;
          if(!badCO&&coMins>siteResults[cName][dt].co){
            siteResults[cName][dt].co=coMins;
            siteResults[cName][dt].wm=wm;
          }
          siteResults[cName][dt].late=Math.max(lm,siteResults[cName][dt].late);
          siteResults[cName][dt].early=Math.min(em,siteResults[cName][dt].early);
          siteResults[cName][dt].ot=Math.max(om,siteResults[cName][dt].ot);
        }
      }
    }
  }

  // ── Leave processing ─────────────────────────────────────────────────────
  // For each leave record, parse Start Date and End Date to get the exact date range.
  // Date format: '2026/05/04 [07:00 am]' — strip the time part, parse YYYY/MM/DD.
  // Count the overlap of the leave date range with the week being processed.
  // Use Duration field only for partial-day leaves (decimal values like 0.6, 1.5).
  // All statuses valid (pending/approved — leave is leave).
  // ──────────────────────────────────────────────────────────────────────────
  const leaveData={};  // { name: { days: float, type: string, entries: [{start,end,type,dur}] } }

  // Parse a leave date string: '2026/05/04 [07:00 am]' → 'YYYY-MM-DD'
  function parseLeaveDate(raw){
    if(!raw) return null;
    const s=String(raw).trim();
    const m=s.match(/(\d{4})[/\-](\d{2})[/\-](\d{2})/);
    if(!m) return null;
    return m[1]+'-'+m[2]+'-'+m[3];
  }

  // Count working days (Mon-Fri) between two ISO dates inclusive, excluding excluded dates
  function workDaysBetween(startISO, endISO, excludedSet){
    if(!startISO||!endISO) return 0;
    const s=new Date(startISO+'T00:00:00Z'), e=new Date(endISO+'T00:00:00Z');
    if(s>e) return 0;
    let count=0, d=new Date(s);
    while(d<=e){
      const dow=d.getUTCDay(); // 0=Sun, 6=Sat
      const iso=d.toISOString().slice(0,10);
      if(dow>=1&&dow<=5&&!excludedSet.has(iso)) count++;
      d.setUTCDate(d.getUTCDate()+1);
    }
    return count;
  }

  // Build week date set from the exclusions (for holiday-aware counting)
  const wkExclSet=new Set((processedData?.exclusions||[]).map(x=>x.date));

  for(const [fname,{wb}] of leaveFiles){
    const sheet=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true});
    const hdIdx=rows.findIndex(r=>r&&r.some(c=>String(c||'').trim()==='Staff No.'||String(c||'').trim()==='Employee'));
    if(hdIdx<0)continue;
    const hd=rows[hdIdx].map(c=>String(c||'').trim());
    const empCol  =hd.findIndex(h=>h==='Employee');
    const typeCol =hd.findIndex(h=>h.toLowerCase().includes('leave type')||h.toLowerCase()==='type');
    const startCol=hd.findIndex(h=>h.toLowerCase().includes('start date')||h.toLowerCase()==='start');
    const endCol  =hd.findIndex(h=>h.toLowerCase().includes('end date')||h.toLowerCase()==='end');
    const durCol  =hd.findIndex(h=>h.toLowerCase().includes('duration'));

    for(let i=hdIdx+1;i<rows.length;i++){
      const row=rows[i]; if(!row) continue;
      const emp=String(row[empCol]||'').trim(); if(!emp||emp==='nan') continue;
      const cName=normName(emp);
      const lt=String(row[typeCol]||'').trim();
      const startISO=parseLeaveDate(row[startCol]);
      const endISO  =parseLeaveDate(row[endCol]);

      // Parse duration — handle decimals like '1.6 days', '9.5 days', '0.6 days'
      const durRaw=String(row[durCol]||'').trim();
      const durFloat=parseFloat(durRaw)||0;
      // For partial days (decimal), use the decimal value directly
      // For whole days, use workDaysBetween (more accurate than the file's duration field)
      let days;
      if(durFloat>0&&durFloat!==Math.round(durFloat)){
        // Decimal duration (e.g. 0.6, 1.5, 1.6, 9.5) — trust the system value
        days=durFloat;
      } else if(startISO&&endISO){
        // Whole number: recompute from date range for accuracy
        days=workDaysBetween(startISO,endISO,wkExclSet);
      } else {
        days=durFloat||1;
      }

      if(!leaveData[cName]) leaveData[cName]={days:0,type:lt,entries:[]};
      leaveData[cName].entries.push({start:startISO,end:endISO,type:lt,days});
      // Accumulate all leave entries for this employee
      leaveData[cName].days+=days;
      if(!leaveData[cName].type) leaveData[cName].type=lt;
    }
  }
  // ── Intersect leave with this week's date range ──────────────────────────
  // Only count leave days that actually fall within the week being processed.
  // Derive week start/end from the week dates field, or use the min/max dates
  // found in bio/site results as a fallback.
  function parseWeekDate(str){
    // Parse dates like "27 Apr 2026", "Apr 27", "2026-04-27" from the dates field
    const iso=str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if(iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    // "27 Apr 2026" or "4 May 2026"
    const MONTHS={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                  jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    const m=str.toLowerCase().match(/(\d{1,2})\s+([a-z]{3})\s+(\d{4})/);
    if(m) return `${m[3]}-${MONTHS[m[2]]||'01'}-${m[1].padStart(2,'0')}`;
    return null;
  }

  const wkDatesStr=document.getElementById('wk-dates').value||'';
  // Try to extract start and end from the dates field (e.g. "27 Apr – 2 May 2026")
  const dateParts=wkDatesStr.split(/[–\-—to]+/).map(s=>s.trim()).filter(Boolean);
  // Add year to first part if missing
  const addYear=s=>(/\d{4}/.test(s)?s:s+' '+(wkDatesStr.match(/\d{4}/)||['2026'])[0]);
  let wkStart=dateParts.length>=1?parseWeekDate(addYear(dateParts[0])):null;
  let wkEnd  =dateParts.length>=2?parseWeekDate(addYear(dateParts[1])):null;

  // Fallback: derive from dates found in processed bio/site data
  if(!wkStart||!wkEnd){
    const allDates=[
      ...Object.values(bioResults).flatMap(d=>Object.keys(d)),
      ...Object.values(siteResults).flatMap(d=>Object.keys(d)),
    ].sort();
    if(allDates.length){wkStart=allDates[0];wkEnd=allDates[allDates.length-1];}
  }

  // Now intersect each employee's leave entries with [wkStart, wkEnd]
  for(const [name,lv] of Object.entries(leaveData)){
    if(!lv.entries.length){leaveData[name].days=0;continue;}
    // Merge overlapping entries first (dedup across the two leave files)
    const entries=lv.entries.filter(e=>e.start&&e.end).sort((a,b)=>a.start.localeCompare(b.start));
    const merged=[];
    for(const e of entries){
      if(merged.length&&e.start<=merged[merged.length-1].end){
        if(e.end>merged[merged.length-1].end) merged[merged.length-1].end=e.end;
      } else {
        merged.push({...e});
      }
    }
    // For each merged range, count only the working days that intersect the week
    let totalDays=0;
    for(const e of merged){
      if(wkStart&&wkEnd&&(e.end<wkStart||e.start>wkEnd)) continue; // no overlap with week
      const whole=wkStart&&wkEnd
        ? workDaysBetween(
            e.start>wkStart?e.start:wkStart,  // max(leave_start, week_start)
            e.end<wkEnd?e.end:wkEnd,            // min(leave_end,   week_end)
            wkExclSet)
        : workDaysBetween(e.start,e.end,wkExclSet);
      // For decimal durations: cap at the stated fraction
      const orig=lv.entries.find(o=>o.start===e.start);
      const cap=orig&&orig.days!==Math.round(orig.days)?orig.days:Infinity;
      totalDays+=Math.min(whole,cap);
    }
    leaveData[name].days=Math.round(totalDays*10)/10;
  }

  s.querySelector('.step-icon').className='step-icon ok';
  s.querySelector('span').textContent='Attendance computed for '+Object.keys(bioResults).length+' bio employees';
  setFill(70);

  s=addStep('Building register…','spin');

  // ── Exclusion-aware schedule days ────────────────────────────────────────
  // Collect the user-declared exclusions (holidays, WFH days) from the modal.
  // Each exclusion has a date + type ('holiday'|'wfh') + applies_to ('all'|'bio'|'site').
  // For each employee, td = base_schedule_days - exclusions_that_apply_to_them.
  const exclusions = processedData ? (processedData.exclusions||[]) : [];
  // (exclusions are already built by collectExclusions() before processFiles runs)
  // Count how many exclusions apply per staff type
  function effectiveTd(isSite){
    const base = isSite ? 6 : 5;
    const excluded = exclusions.filter(ex=>{
      if(ex.applies==='all') return true;
      if(ex.applies==='site' && isSite) return true;
      if(ex.applies==='bio' && !isSite) return true;
      return false;
    }).length;
    return Math.max(1, base - excluded);
  }

  const data={};
  for(const [name,loc,hrs,note] of staffList){
    const isSite=SITE_LOCS.has(loc);
    const td=effectiveTd(isSite);
    const isHybrid=(loc==='Hybrid');
    const bio=bioResults[name]||{};
    const site=siteResults[name]||{};
    const daysMap={...site};
    for(const [dt,v] of Object.entries(bio)){
      if(v.ci||v.wm) daysMap[dt]=v;
      else if(!daysMap[dt]) daysMap[dt]=v;
    }
    // Count present days, excluding dates that are excluded for this employee type
    const excludedDates=new Set(exclusions
      .filter(ex=>ex.applies==='all'||(ex.applies==='site'&&isSite)||(ex.applies==='bio'&&!isSite))
      .map(ex=>ex.date));
    const pDays=Object.entries(daysMap)
      .filter(([dt,d])=>!excludedDates.has(dt)&&((d.ci||0)>0||d.wm>0)).length;
    const lm=Object.values(daysMap).reduce((s,d)=>s+(d.late||0),0);
    const em=Object.values(daysMap).reduce((s,d)=>s+(d.early||0),0);
    const om=Object.values(daysMap).reduce((s,d)=>s+(d.ot||0),0);
    const wm=Object.values(daysMap).reduce((s,d)=>s+(d.wm||0),0);
    const ld=Object.values(daysMap).filter(d=>(d.late||0)>0).length;
    const ed=Object.values(daysMap).filter(d=>(d.early||0)>0).length;
    const od=Object.values(daysMap).filter(d=>(d.ot||0)>0).length;
    const lv=leaveData[name]||{days:0,type:''};
    const st=getStatus(pDays,td,lv.days,isHybrid);
    const allCIs=Object.values(daysMap).map(d=>d.ci||0).filter(x=>x>0);
    const allCOs=Object.values(daysMap).map(d=>d.co||0).filter(x=>x>0);
    // Site employees: show actual sites worked this week (from siteNotes) instead of register default
    const weekNote = isSite && siteNotes[name]
      ? [...siteNotes[name]].slice(0,4).join(' · ')
      : (note||'');
    // Store per-day records for staff lookup daily view
    const days={};
    for(const [dt,d] of Object.entries(daysMap)){
      if((d.ci||0)>0||d.wm>0) days[dt]={ci:d.ci||0,co:d.co||0,wm:d.wm||0,late:d.late||0,early:d.early||0,ot:d.ot||0,badCO:d.badCO||false};
    }
    // Flag incomplete: CI without CO, CO without CI, or bad CO (data entry error)
    const incomplete=Object.values(daysMap).some(d=>
      ((d.ci||0)>0&&!(d.co||0)) || ((d.co||0)>0&&!(d.ci||0)) || d.badCO
    );
    const sm=schedMinsFor(loc); // scheduled minutes per day for this location
    data[name]={loc,hrs,note:weekNote,td,p:pDays,a:Math.max(0,td-pDays),ld,lm,ed,em,od,om,wm,sm,
      ciMin:allCIs.length?Math.min(...allCIs):0,
      coMax:allCOs.length?Math.max(...allCOs):0,
      lv:Math.round((lv.days||0)*10)/10,lt:lv.type||'',s:st,
      days,incomplete};
  }

  s.querySelector('.step-icon').className='step-icon ok';
  const absCount=Object.values(data).filter(v=>v.s==='ABS').length;
  s.querySelector('span').textContent=`Register built · ${Object.keys(data).length} staff · ${absCount} absent`;
  setFill(90);

  if(absCount>20){
    addStep(`High absent count (${absCount}) — check site sheet upload`,'warn');
  }
  if(exclusions.length){
    addStep(`${exclusions.length} excluded date(s) applied (holidays/WFH)`,'ok');
  }

  processedData={data,exclusions};
  setFill(100);

  document.getElementById('proc-preview').style.display='block';
  const kpis=computeKPIs(data);
  document.getElementById('preview-summary').textContent=
    `${Object.keys(data).length} employees · ${kpis.att}% attendance · ${kpis.n_full} full · ${absCount} absent · ${kpis.n_lv} on leave`
    +(exclusions.length?` · ${exclusions.length} excluded day(s)`:'');

  const tbody=document.getElementById('preview-tbody');
  tbody.innerHTML=Object.entries(data).sort((a,b)=>a[0].localeCompare(b[0])).slice(0,20).map(([name,v])=>{
    const g=getSG(v);
    return `<tr><td>${name}</td><td style="font-size:10px;color:var(--tx3)">${v.loc}</td><td class="nm">${v.td}d</td><td class="nm">${v.p}</td><td class="nm">${v.s!=='HYBRID'&&v.s!=='LEAVE'?v.a:'—'}</td><td><span class="badge ${getBadgeCls(g)}">${getBadgeLbl(g)}</span></td></tr>`;
  }).join('');

  document.getElementById('save-btn').style.display='';
}

// ── Exclusion helpers ─────────────────────────────────────────────────────
// Called before processFiles to snapshot current exclusions from the modal UI.
function collectExclusions(){
  const rows=document.querySelectorAll('#excl-rows .excl-row');
  const result=[];
  rows.forEach(row=>{
    const date=row.querySelector('.excl-date').value.trim();
    const label=row.querySelector('.excl-label').value.trim();
    const applies=row.querySelector('.excl-applies').value;
    if(date) result.push({date,label:label||'Holiday',applies});
  });
  // Store on processedData stub so processFiles can read it
  if(!processedData) processedData={};
  processedData.exclusions=result;
}

function addExclusionRow(date='',label='',applies='all'){
  const container=document.getElementById('excl-rows');
  const row=document.createElement('div');
  row.className='excl-row';
  row.style.cssText='display:flex;gap:6px;align-items:center;margin-bottom:5px;';
  row.innerHTML=`
    <input type="date" class="excl-date" value="${date}" style="font-size:11px;padding:4px 7px;border:.5px solid var(--bd);border-radius:var(--rs);background:var(--sf);color:var(--tx);outline:none;">
    <input type="text" class="excl-label" value="${label}" placeholder="e.g. Labour Day" style="flex:1;font-size:11px;padding:4px 7px;border:.5px solid var(--bd);border-radius:var(--rs);background:var(--sf);color:var(--tx);outline:none;">
    <select class="excl-applies" style="font-size:10px;padding:4px 6px;border:.5px solid var(--bd);border-radius:var(--rs);background:var(--sf);color:var(--tx);">
      <option value="all"${applies==='all'?' selected':''}>All staff</option>
      <option value="bio"${applies==='bio'?' selected':''}>Bio only</option>
      <option value="site"${applies==='site'?' selected':''}>Site only</option>
    </select>
    <button onclick="this.closest('.excl-row').remove()" style="background:none;border:none;cursor:pointer;color:var(--tx4);font-size:13px;padding:2px 5px;" title="Remove">✕</button>`;
  container.appendChild(row);
}

// determineTotalDays removed (legacy stub)


async function saveWeek(){
  if(!processedData) return;
  const id='week_'+Date.now();
  const label=document.getElementById('wk-label').value||id;
  const dates=document.getElementById('wk-dates').value||'';
  const week={id,label,dates,data:processedData.data,
    exclusions:processedData.exclusions||[],
    schedDays:5,createdAt:new Date().toISOString()};
  await dbPut('weeks',week);
  await loadWeeks();
  activeWeekId=id;
  closeUploadModal();
  renderHome();
  renderCmpChips();
  showPage('analysis');
  renderAnalysis(id);
}
