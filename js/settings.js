// settings.js — settings, backup/restore, export

async function saveSettings(){
  const toMins=id=>Math.round(+document.getElementById(id).value*60);
  settings={
    full: +document.getElementById('s-full').value,
    good: +document.getElementById('s-good').value,
    mod:  +document.getElementById('s-mod').value,
    schedMins:{
      'Head Office':          toMins('s-sm-headoffice'),
      'Plant Office': toMins('s-sm-plant'),
      'Region A Sites':   toMins('s-sm-regiona'),
      'Region B Sites':   toMins('s-sm-regionb'),
      'Overseas Site': toMins('s-sm-headoffice'), // same as Head Office by default
      'Hybrid':          toMins('s-sm-headoffice'),
      '_default':        600
    }
  };
  await dbPut('settings',{key:'thresholds',value:settings});
  alert('Settings saved — re-process weeks to apply new scheduled hours');
}

async function uploadStaffRegister(input){
  const f=input.files[0];if(!f)return;
  const buf=await f.arrayBuffer();
  const wb=XLSX.read(buf,{type:'array'});
  const sheet=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true});
  const hdIdx=rows.findIndex(r=>r.some(c=>String(c).trim()==='Name'||String(c).trim()==='Employee'));
  if(hdIdx<0){alert('Could not find Name column');return;}
  const hd=rows[hdIdx].map(c=>String(c).trim());
  const niCol=hd.findIndex(h=>h==='Name'||h==='Employee');
  const locCol=hd.findIndex(h=>h.toLowerCase().includes('location')||h.toLowerCase().includes('station'));
  const newStaff=[];
  for(let i=hdIdx+1;i<rows.length;i++){
    const n=String(rows[i][niCol]||'').trim();if(!n||n==='Name')continue;
    const loc=locCol>=0?String(rows[i][locCol]||'').trim():'Unknown';
    newStaff.push([n,loc,true,'']);
  }
  staffList=newStaff;
  await dbPut('staff_register',{key:'list',value:staffList});
  updateStaffRegCount();
  const el=document.getElementById('staff-reg-status');
  el.style.display='block';el.textContent=`Loaded ${staffList.length} employees from ${f.name}`;
}

function updateStaffRegCount(){
  document.getElementById('staff-reg-count').textContent=`Current register: ${staffList.length} employees`;
}

async function exportBackup(){
  const backup={version:1,exportedAt:new Date().toISOString(),weeks:allWeeks,settings,staffList};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`workforce_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

async function restoreBackup(input){
  const f=input.files[0];if(!f)return;
  const text=await f.text();
  const backup=JSON.parse(text);
  if(backup.weeks){
    for(const wk of backup.weeks) await dbPut('weeks',wk);
    await loadWeeks();
  }
  if(backup.settings){
    settings=backup.settings;
    await dbPut('settings',{key:'thresholds',value:settings});
    // Reload settings UI so displayed values match restored data
    document.getElementById('s-full').value=settings.full||100;
    document.getElementById('s-good').value=settings.good||80;
    document.getElementById('s-mod').value=settings.mod||60;
    const sm=settings.schedMins||{};
    document.getElementById('s-sm-headoffice').value=(sm['Head Office']||600)/60;
    document.getElementById('s-sm-plant').value=(sm['Plant Office']||570)/60;
    document.getElementById('s-sm-regiona').value=(sm['Region A Sites']||540)/60;
    document.getElementById('s-sm-regionb').value=(sm['Region B Sites']||540)/60;
  }
  if(backup.staffList){staffList=backup.staffList;await dbPut('staff_register',{key:'list',value:staffList});updateStaffRegCount();}
  renderHome();renderCmpChips();
  alert(`Restored ${backup.weeks?.length||0} weeks`+(backup.settings?' · settings updated':''));
}

async function clearAllData(){
  if(!confirm('This will delete ALL weeks from browser storage. Are you sure?')) return;
  await dbClear('weeks');await loadWeeks();activeWeekId=null;
  renderHome();renderCmpChips();
}

function exportWeekExcel(){
  const wk=allWeeks.find(w=>w.id===activeWeekId);if(!wk)return;
  const rows=Object.entries(wk.data).sort((a,b)=>a[0].localeCompare(b[0])).map(([name,v])=>{
    const g=getSG(v); const es=effectiveStatus(v);
    return{Name:name,Location:v.loc,'Site/Note':v.note||'',Present:v.p,'Sched days':v.td,
      Absent:es==='HYBRID'||es==='LEAVE'?'':v.a,'Leave days':v.lv%1===0?v.lv:v.lv.toFixed(1),'Leave type':v.lt||'',
      'Work hrs':v.wm?Math.round(v.wm/60):'','Deficit hrs':v.wm&&v.hrs?Math.max(0,Math.round((v.p*(v.sm||schedMinsFor(v.loc||'_default'))-(v.wm||0))/60)):'',
      'Late days':v.ld||0,'Late time (min)':v.lm||0,'Early-out days':v.ed||0,'Early-out (min)':v.em||0,
      'OT days':v.od||0,'OT time (min)':v.om||0,'Incomplete CI/CO':v.incomplete?'Yes':'',Status:getBadgeLbl(g)};
  });
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,wk.label||'Data');
  XLSX.writeFile(wb,`Attendance_${(wk.label||'Week').replace(/\s+/g,'_')}.xlsx`);
}
