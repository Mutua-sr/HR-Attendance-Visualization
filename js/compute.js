// compute.js — KPI aggregation, status classification, chip filters

// Some staff have no fixed schedule (v.hrs===false) without being Hybrid
// location — e.g. Overseas Site. Older imports mistakenly tagged ANY
// no-hours staff as status 'HYBRID' regardless of location, which conflates
// them with genuinely Hybrid employees everywhere status is filtered or
// counted (dashboards, the Hybrid chip, staff lookup). effectiveStatus()
// recomputes the true status from the stored presence figures whenever a
// non-Hybrid record was mis-tagged this way, so both new and historical
// weeks report correctly without needing a data migration.
function effectiveStatus(v){
  if(v.s==='HYBRID'&&v.loc!=='Hybrid') return getStatus(v.p,v.td,v.lv||0,false);
  return v.s;
}

function computeKPIs(data){
  const c={FULL:0,GOOD:0,MOD:0,POOR:0,ABS:0,LEAVE:0,HYBRID:0};
  let tot_p=0,tot_a=0,tot_ld=0,tot_lm=0,tot_ed=0,tot_em=0,tot_od=0,tot_om=0,tot_wm=0,tot_req=0;
  let late_emp=0,ot_emp=0,early_emp=0,ll_emp=0;
  Object.entries(data).forEach(([n,v])=>{
    const es=effectiveStatus(v);
    c[es]=(c[es]||0)+1;
    if(v.hrs){
      tot_p+=v.p; if(es!=='LEAVE'&&es!=='HYBRID') tot_a+=v.a;
      tot_ld+=v.ld||0; tot_lm+=v.lm||0; tot_ed+=v.ed||0; tot_em+=v.em||0;
      tot_od+=v.od||0; tot_om+=v.om||0;
      // Work hours and required hours — now computed for ALL staff with hours
      // (site staff work hours derived from CO-CI; bio staff from biometric Work Time)
      if(v.hrs){ tot_wm+=v.wm||0; tot_req+=v.p*(v.sm||schedMinsFor(v.loc||'_default')); }  // req based on present days × location scheduled hours
    }
    if((v.ld||0)>0) late_emp++;
    if((v.od||0)>0) ot_emp++;
    if((v.ed||0)>0) early_emp++;
    if((v.ld||0)>0&&(v.ed||0)>0) ll_emp++;
  });
  const att=Math.round(tot_p/(tot_p+tot_a)*100*10)/10||0;
  const punc=tot_p?Math.round((tot_p-tot_ld)/tot_p*100*10)/10:0;
  return{...c,tot_p,tot_a,tot_ld,tot_lm,tot_ed,tot_em,tot_od,tot_om,tot_wm,tot_req,
    deficit:tot_req-tot_wm,att,punc,late_emp,ot_emp,early_emp,ll_emp,
    total:Object.keys(data).length,n_full:c.FULL,n_good:c.GOOD,n_mod:c.MOD,
    n_poor:c.POOR,n_abs:c.ABS,n_lv:c.LEAVE,n_hy:c.HYBRID};
}

function schedMinsFor(loc){
  if(!settings.schedMins) return 600;
  return settings.schedMins[loc] ?? settings.schedMins['_default'] ?? 600;
}

function getStatus(p,td,lv,isHybrid){
  if(isHybrid) return 'HYBRID';
  if(p===0&&lv>0) return 'LEAVE';
  if(p===0) return 'ABS';
  const pct=p/td;
  if(pct>=settings.full/100) return 'FULL';
  if(pct>=settings.good/100) return 'GOOD';
  if(pct>=settings.mod/100) return 'MOD';
  return 'POOR';
}

function getSG(v){
  const s=effectiveStatus(v);
  // Hybrid loc always overrides — only genuine Hybrid-location staff belong
  // to the hybrid group. Lacking fixed hours (e.g. Overseas Site) is NOT enough
  // on its own — see effectiveStatus() above.
  if(s==='HYBRID'||v.loc==='Hybrid') return 'hybrid';
  if(s==='LEAVE') return 'leave';
  if(s==='ABS') return 'abs';
  if((v.ld||0)>0&&(v.ed||0)>0) return 'll';
  if((v.ld||0)>0) return 'late';
  if((v.ed||0)>0) return 'early';
  if((v.od||0)>0) return 'ot';
  if(s==='FULL') return 'full';
  if(s==='GOOD') return 'good';
  if(s==='MOD') return 'mod';
  return 'poor';
}

function getBadgeCls(g){return BADGE_CLS[g]||'b-po';}

function getBadgeLbl(g){return BADGE_LBL[g]||g;}

function chipClearAll(btn){
  // Reset every chip and every hidden filter select
  document.querySelectorAll('#chip-bar .chip').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');
  ['f-status','f-inc','f-present'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  filterReg();
}

function chipSet(btn){
  const fId=btn.dataset.f, val=btn.dataset.v;
  // Deactivate All chip and chips targeting same field
  document.querySelectorAll('#chip-bar .chip[data-action="all"]').forEach(c=>c.classList.remove('active'));
  document.querySelectorAll(`#chip-bar .chip[data-f="${fId}"]`).forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');
  const sel=document.getElementById(fId);
  if(sel) sel.value=val;
  filterReg();
}
