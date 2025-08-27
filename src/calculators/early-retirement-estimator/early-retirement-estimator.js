// Early Retirement Estimator – main script
(() => {
  const $ = (id)=>document.getElementById(id);
  const fmt = (n)=> n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0});
  const mRate = (a)=> Math.pow(1 + (a/100), 1/12) - 1;

  function simulate({startBal,contribMonthly,contribBump,bumpYear,retPct,inflPct,useReal,spend,wrPct,maxYears}){
    const months = Math.max(12, Math.min(70*12, Math.floor(maxYears*12)));
    const rNom = mRate(retPct), rInfl = mRate(inflPct);
    const rReal = ((1+rNom)/(1+rInfl))-1;
    const r = (useReal==='real') ? rReal : rNom;

    const bal = Array(months+1).fill(0);
    const totalContrib = Array(months+1).fill(0);
    bal[0]=startBal;

    const FI = spend/(wrPct/100);
    const bumpMonth = Math.max(0, Math.floor(bumpYear*12));

    for(let m=1;m<=months;m++){
      const add = contribMonthly + (m>=bumpMonth ? contribBump : 0);
      totalContrib[m]=totalContrib[m-1]+add;
      bal[m]=bal[m-1]*(1+r)+add;
    }

    const halfFI = FI/2;
    const cross = (target)=>{ for(let m=0;m<=months;m++){ if(bal[m]>=target) return m; } return null; };
    const fiMonth = cross(FI), halfFiMonth = cross(halfFI);

    // Coast-FI (simple)
    let coastMonth=null;
    for(let m=0;m<=months;m++){
      const remain=months-m;
      const future=bal[m]*Math.pow(1+r,remain);
      if(future>=FI){coastMonth=m;break;}
    }

    return {bal,totalContrib,months,FI,fiMonth,halfFiMonth,coastMonth};
  }

  // inputs
  const inputs={
    currentBalance:$('currentBalance'),
    contributionMonthly:$('contributionMonthly'),
    contributionBump:$('contributionBump'),
    bumpYear:$('bumpYear'),
    returnPct:$('returnPct'),
    inflationPct:$('inflationPct'),
    useReal:$('useReal'),
    annualSpend:$('annualSpend'),
    withdrawalRate:$('withdrawalRate'),
    maxYears:$('maxYears'),
    currentAge:$('currentAge'),
    compare200:$('compare200'),
  };

  // outputs
  const fiNumberEl=$('fiNumber'), fiDateEl=$('fiDate'), fiYearsEl=$('fiYears'), fiAgeNoteEl=$('fiAgeNote');
  const halfFiDateEl=$('halfFiDate'), coastFiDateEl=$('coastFiDate'), tableBody=document.querySelector('#fiTable tbody');
  const insightBox=$('insightBox'), insightText=$('insightText');

  // chart
  const ctx=$('fiChart').getContext('2d'); let chart;
  function renderChart(labels, base, FI, comp=null){
    const datasets=[
      {label:'Portfolio balance', data:base, borderWidth:2, fill:false, tension:.15, pointRadius:0},
      {label:'FI target', data:base.map(()=>FI), borderWidth:1, borderDash:[6,6], fill:false, pointRadius:0}
    ];
    if (Array.isArray(comp)){ datasets.push({label:'Balance (+$200/mo)', data:comp, borderWidth:2, fill:false, tension:.15, pointRadius:0}); }
    if (chart) chart.destroy();
    chart=new Chart(ctx,{type:'line',data:{labels,datasets},options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      plugins:{legend:{display:true}, tooltip:{callbacks:{label:(c)=>`${c.dataset.label}: ${fmt(c.raw)}`}}},
      scales:{x:{title:{display:true,text:'Year'}}, y:{title:{display:true,text:'Balance'}, ticks:{callback:v=>fmt(v)}}}
    }});
  }

  function ymdPlusMonths(d,m){const dt=new Date(d.getTime()); dt.setMonth(dt.getMonth()+m); return dt;}

  function run(){
    const now=new Date();

    const startBal=+inputs.currentBalance.value||0;
    const contribMonthly=+inputs.contributionMonthly.value||0;
    const contribBump=+inputs.contributionBump.value||0;
    const bumpYear=+inputs.bumpYear.value||0;
    const retPct=+inputs.returnPct.value||0;
    const inflPct=+inputs.inflationPct.value||0;
    const useReal=inputs.useReal.value;
    const spend=+inputs.annualSpend.value||0;
    const wrPct=+inputs.withdrawalRate.value||4.0;
    const maxYears=+inputs.maxYears.value||50;
    const currentAge=+inputs.currentAge.value||null;

    const base=simulate({startBal,contribMonthly,contribBump,bumpYear,retPct,inflPct,useReal,spend,wrPct,maxYears});
    const doComp=inputs.compare200.checked;
    const comp= doComp ? simulate({startBal,contribMonthly:contribMonthly+200,contribBump,bumpYear,retPct,inflPct,useReal,spend,wrPct,maxYears}) : null;

    // outputs
    fiNumberEl.textContent=fmt(base.FI);
    let fiText='Not reached in horizon', fiYears='—', ageNote='';
    if (base.fiMonth!==null){
      const d=ymdPlusMonths(now, base.fiMonth);
      fiText=d.toLocaleDateString(undefined,{year:'numeric',month:'short'});
      fiYears=(base.fiMonth/12).toFixed(1);
      if (!Number.isNaN(currentAge)) ageNote=`Age at FI ≈ ${(currentAge + base.fiMonth/12).toFixed(1)}`;
    }
    fiDateEl.textContent=fiText; fiYearsEl.textContent=fiYears; fiAgeNoteEl.textContent=ageNote;
    const fmtMil=(m)=> m===null?'—': ymdPlusMonths(now,m).toLocaleDateString(undefined,{year:'numeric',month:'short'});
    halfFiDateEl.textContent=fmtMil(base.halfFiMonth); coastFiDateEl.textContent=fmtMil(base.coastMonth);

    // table & labels
    tableBody.innerHTML=''; const labels=[], yearEnd=[], yearEndComp=[];
    for(let y=1;y<=Math.ceil(base.months/12);y++){
      const idx=Math.min(y*12, base.months);
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${now.getFullYear()+y}</td><td style="text-align:right">${fmt(base.bal[idx])}</td><td style="text-align:right">${fmt(base.totalContrib[idx])}</td>`;
      tableBody.appendChild(tr);
      labels.push(now.getFullYear()+y);
      yearEnd.push(base.bal[idx]);
      if (comp) yearEndComp.push(comp.bal[idx]);
    }

    renderChart(labels, yearEnd, base.FI, comp?yearEndComp:null);

    // insight
    if (comp && base.fiMonth!==null && comp.fiMonth!==null){
      const delta=base.fiMonth-comp.fiMonth;
      if (delta>0){
        insightBox.style.display='block';
        const yrs=(delta/12).toFixed(1);
        insightText.textContent=`Adding $200/month could bring FI forward by about ${yrs} years (from ${fiDateEl.textContent} to ${ymdPlusMonths(now, comp.fiMonth).toLocaleDateString(undefined,{year:'numeric',month:'short'})}).`;
      } else { insightBox.style.display='none'; }
    } else { insightBox.style.display='none'; }
  }

  // bind
  document.querySelectorAll('#ere-form input, #ere-form select').forEach(el=>{
    el.addEventListener('input', run); el.addEventListener('change', run);
  });
  $('runBtn').addEventListener('click', run);

  // CSV (soft-gate)
  const subscribed = ()=> localStorage.getItem('lf_subscribed')==='true';
  const openNL = ()=> { const b=$('nlBackdrop'); b.style.display='flex'; b.setAttribute('aria-hidden','false'); };
  const closeNL = ()=> { const b=$('nlBackdrop'); b.style.display='none'; b.setAttribute('aria-hidden','true'); };

  $('downloadCsvBtn').addEventListener('click', ()=>{
    if (!subscribed()) { openNL(); return; }
    downloadCsv();
  });

  $('nlCloseBtn').addEventListener('click', closeNL);

  // Replace with your Mailchimp form integration if desired:
  $('nlForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const email=$('nlEmail').value.trim();
    if (!email) return;
    // TODO: wire to your provider; for now, store flag and proceed
    localStorage.setItem('lf_subscribed','true');
    closeNL();
    setTimeout(downloadCsv, 250);
  });

  function downloadCsv(){
    const rows=[['Year','End Balance','Total Contributions']];
    document.querySelectorAll('#fiTable tbody tr').forEach(tr=>{
      const tds=tr.querySelectorAll('td'); const clean=s=>s.replace(/[^0-9\.-]/g,'');
      rows.push([tds[0].textContent, clean(tds[1].textContent), clean(tds[2].textContent)]);
    });
    const csv=rows.map(r=>r.join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='early-retirement-estimator.csv'; a.click(); URL.revokeObjectURL(url);
  }

  // first render
  run();
})();