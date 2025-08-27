(function(){
  "use strict";

  // ===== Utilities =====
  function $(id){ return document.getElementById(id); }
  function fmt(n){ return (n||0).toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0}); }
  function uid(){ return Math.random().toString(36).slice(2,9); }
  function showToast(msg){
    var t=$('toast'); if(!t) return;
    t.textContent = msg || 'Saved';
    t.style.opacity='1';
    setTimeout(function(){ t.style.opacity='0'; }, 1400);
  }
  var yr = $('year'); if (yr) { yr.textContent = new Date().getFullYear(); }

  // ===== Storage keys =====
  var STORAGE_ITEMS_V2='lf_nw_items_v2';
  var STORAGE_ITEMS_V1='lf_nw_items_v1';
  var STORAGE_HISTORY='lf_nw_history_v1';
  var NEWS_KEY='lf_news_ok';

  function migrateIfNeeded(){
    var v2 = localStorage.getItem(STORAGE_ITEMS_V2);
    if (v2) { try { return JSON.parse(v2) || []; } catch(e){ return []; } }
    var v1 = localStorage.getItem(STORAGE_ITEMS_V1);
    if (!v1) return [];
    var items=[];
    try { items = JSON.parse(v1) || []; } catch(e){ items=[]; }
    var upgraded = [];
    for (var i=0;i<items.length;i++){
      var it = items[i] || {};
      upgraded.push({
        id: it.id || uid(),
        type: it.type || 'asset',
        name: it.name || 'Item',
        amount: +it.amount || 0,
        category: 'Other',
        countsFi: true
      });
    }
    localStorage.setItem(STORAGE_ITEMS_V2, JSON.stringify(upgraded));
    return upgraded;
  }
  function loadItems(){ return migrateIfNeeded(); }
  function saveItems(items){ localStorage.setItem(STORAGE_ITEMS_V2, JSON.stringify(items)); }
  function loadHistory(){ try { return JSON.parse(localStorage.getItem(STORAGE_HISTORY)) || []; } catch(e){ return []; } }
  function saveHistory(history){ localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history)); }

  // ===== State =====
  var items = loadItems();
  var history = loadHistory();

  if (items.length) {
    var normalized = [];
    for (var i=0;i<items.length;i++){
      var it = items[i] || {};
      normalized.push({
        id: it.id || uid(),
        type: it.type || 'asset',
        name: it.name || 'Item',
        amount: +it.amount || 0,
        category: it.category || 'Other',
        countsFi: (it.category==='Home Equity' || it.category==='Car') ? false :
                  (typeof it.countsFi === 'boolean' ? it.countsFi : true)
      });
    }
    items = normalized;
    saveItems(items);
  }
  if (items.length === 0){
    items = [
      { id: uid(), type:'asset', name:'Checking', category:'Checking', amount:3000, countsFi:true },
      { id: uid(), type:'asset', name:'Brokerage', category:'Brokerage', amount:15000, countsFi:true },
      { id: uid(), type:'asset', name:'Home Equity', category:'Home Equity', amount:80000, countsFi:false },
      { id: uid(), type:'liability', name:'Credit Card', category:'Other', amount:500, countsFi:false }
    ];
    saveItems(items);
  }

  // ===== DOM refs =====
  var assetsBody=$('assetsBody'), liabilitiesBody=$('liabilitiesBody'), historyBody=$('historyBody');
  var totalAssetsEl=$('totalAssets'), totalLiabilitiesEl=$('totalLiabilities'), netWorthEl=$('netWorth'), fiEligibleTotalEl=$('fiEligibleTotal');

  // Quick add refs
  var qType=$('qType'), qCategory=$('qCategory'), qName=$('qName'), qAmount=$('qAmount'), qFi=$('qFi'), qAdd=$('qAdd');

  // Modal refs
  var backdrop=$('backdrop'), itemForm=$('itemForm');
  var editId=$('editId'), itemType=$('itemType'), itemCategory=$('itemCategory'), itemCountsFi=$('itemCountsFi'), itemName=$('itemName'), itemAmount=$('itemAmount'), saveBtn=$('saveBtn'), cancelBtn=$('cancelBtn');

  // Tabs
  (function(){
    var tabBtns = document.querySelectorAll ? document.querySelectorAll('.tabs button') : [];
    for (var i=0;i<tabBtns.length;i++){
      tabBtns[i].addEventListener('click', function(){
        for (var j=0;j<tabBtns.length;j++) tabBtns[j].classList.remove('active');
        this.classList.add('active');
        var tab = this.getAttribute('data-tab');
        var itemsTab = $('tab-items'), historyTab = $('tab-history');
        if (itemsTab) itemsTab.hidden = (tab !== 'items');
        if (historyTab) historyTab.hidden = (tab !== 'history');
      });
    }
  })();

  // ===== Charts =====
  var mixCanvas = $('mixChart');
  var ctxMix = mixCanvas ? mixCanvas.getContext('2d') : null;
  var nwCanvas = $('nwChart');
  var ctxNW = nwCanvas ? nwCanvas.getContext('2d') : null;
  var chartMix = null, chartNW = null;

  function computeTotals(){
    var a=0, l=0, f=0;
    for (var i=0;i<items.length;i++){
      var it=items[i];
      var amt=+it.amount || 0;
      if (it.type==='asset'){
        a += amt;
        if (it.countsFi) f += amt;
      } else {
        l += amt;
      }
    }
    return { assets:a, liabs:l, net:a-l, fiElig:f };
  }

  function renderSummary(){
    if (!totalAssetsEl) return;
    var t = computeTotals();
    totalAssetsEl.textContent = fmt(t.assets);
    totalLiabilitiesEl.textContent = fmt(t.liabs);
    netWorthEl.textContent = fmt(t.net);
    fiEligibleTotalEl.textContent = fmt(t.fiElig);
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
  }

  function addRow(tbody, isAsset){
    return function(i){
      var tr = document.createElement('tr');
      var fiCell = isAsset ? '<td style="text-align:center">'+(i.countsFi ? '✅' : '—')+'</td>' : '<td style="text-align:center">—</td>';
      tr.innerHTML =
        '<td>'+escapeHtml(i.name)+'</td>'+
        '<td>'+escapeHtml(i.category||'Other')+'</td>'+
        fiCell+
        '<td style="text-align:right">'+fmt(+i.amount||0)+'</td>'+
        '<td style="text-align:right" class="actions">'+
          '<button data-act="edit" data-id="'+i.id+'">Edit</button> '+
          '<button data-act="del" data-id="'+i.id+'">Delete</button>'+
        '</td>';
      tbody.appendChild(tr);
    };
  }

  function renderMixPie(){
    if (!ctxMix) return;
    var map = {}; // "category|fi"
    for (var i=0;i<items.length;i++){
      var it=items[i];
      if (it.type!=='asset') continue;
      var key=(it.category||'Other')+'|'+(it.countsFi?'fi':'nfi');
      map[key]=(map[key]||0)+(+it.amount||0);
    }
    var labels=[], data=[], bg=[];
    for (var key in map){
      if (!map.hasOwnProperty(key)) continue;
      var parts = key.split('|');
      var cat = parts[0], flag = parts[1];
      labels.push(cat+' '+(flag==='fi'?'(FI)':'(non-FI)'));
      data.push(map[key]);
      bg.push(flag==='fi' ? 'rgba(26,115,232,.35)' : 'rgba(203,213,225,.7)');
    }
    if (chartMix) { try { chartMix.destroy(); } catch(e){} }
    chartMix = new Chart(ctxMix, {
      type:'pie',
      data:{ labels:labels, datasets:[{ data:data, backgroundColor:bg }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }
    });
  }

  function renderLists(){
    if (!assetsBody || !liabilitiesBody) return;
    assetsBody.innerHTML = '';
    liabilitiesBody.innerHTML = '';
    for (var i=0;i<items.length;i++){
      var it = items[i];
      if (it.type==='asset') addRow(assetsBody, true)(it);
      else addRow(liabilitiesBody, false)(it);
    }
    renderSummary();
    renderMixPie();
  }

  function renderHistory(){
    if (!ctxNW || !historyBody) return;
    historyBody.innerHTML = '';
    for (var i=0;i<history.length;i++){
      var h = history[i];
      var tr = document.createElement('tr');
      var d = new Date(h.dateISO);
      tr.innerHTML = '<td>'+d.toLocaleDateString(undefined,{year:'numeric',month:'short'})+'</td><td style="text-align:right">'+fmt(h.netWorthNumber)+'</td>';
      historyBody.appendChild(tr);
    }
    if (chartNW) { try { chartNW.destroy(); } catch(e){} }
    var labels = [], data = [];
    for (var j=0;j<history.length;j++){
      labels.push(new Date(history[j].dateISO).toLocaleDateString(undefined,{year:'2-digit',month:'short'}));
      data.push(history[j].netWorthNumber);
    }
    chartNW = new Chart(ctxNW, {
      type:'line',
      data:{ labels:labels, datasets:[{ label:'Net worth', data:data, borderWidth:2, fill:false, tension:.15, pointRadius:2 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ ticks:{ callback:function(v){return fmt(v);} } } } }
    });
  }

  // ===== Quick add =====
  function addQuick(){
    if (!qType || !qCategory || !qName || !qAmount || !qFi) return;
    var entry = {
      id: uid(),
      type: qType.value,
      category: qCategory.value || 'Other',
      name: (qName.value || '').trim() || (qType.value==='asset' ? 'Asset' : 'Liability'),
      amount: parseFloat(qAmount.value || '0') || 0,
      countsFi: (qType.value==='asset') ? (qFi.value==='yes') : false
    };
    items.push(entry);
    saveItems(items);
    renderLists();
    showToast('Item added');
    qName.value=''; qAmount.value='0';
    try { qName.focus(); } catch(e){}
  }
  if (qAdd) qAdd.addEventListener('click', function(){ addQuick(); });
  if (qName) qName.addEventListener('keydown', function(e){ if (e.key==='Enter'){ e.preventDefault(); addQuick(); }});
  if (qAmount) qAmount.addEventListener('keydown', function(e){ if (e.key==='Enter'){ e.preventDefault(); addQuick(); }});

  // ===== Modal edit =====
  function openModal(editItem){
    if (!backdrop || !editItem) return;
    backdrop.style.display='flex'; backdrop.setAttribute('aria-hidden','false');
    var title = $('modalTitle'); if (title) title.textContent='Edit Item';
    if (editId) editId.value = editItem.id;
    if (itemType) itemType.value = editItem.type;
    if (itemCategory) itemCategory.value = editItem.category || 'Other';
    if (itemCountsFi) itemCountsFi.value = editItem.countsFi ? 'yes' : 'no';
    if (itemName) itemName.value = editItem.name || '';
    if (itemAmount) itemAmount.value = (editItem.amount != null ? editItem.amount : 0);
    if (saveBtn) saveBtn.textContent='Update item';
    setTimeout(function(){ try{ itemName && itemName.focus(); }catch(e){} }, 50);
  }
  function closeModal(){ if (!backdrop) return; backdrop.style.display='none'; backdrop.setAttribute('aria-hidden','true'); }
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', function(e){ if (e.target===backdrop) closeModal(); });
  document.addEventListener('keydown', function(e){ if (e.key==='Escape') closeModal(); });

  function onTableClick(e){
    e = e || window.event;
    var target = e.target || e.srcElement;
    while (target && target !== document && !(target.tagName==='BUTTON' && target.getAttribute('data-act'))) {
      target = target.parentNode;
    }
    if (!target || target===document) return;
    var id = target.getAttribute('data-id');
    var act = target.getAttribute('data-act');
    var it = null;
    for (var i=0;i<items.length;i++){ if (items[i].id===id){ it=items[i]; break; } }
    if (!it) return;
    if (act==='edit'){ openModal(it); }
    if (act==='del'){
      var next=[]; for (var j=0;j<items.length;j++){ if (items[j].id!==id) next.push(items[j]); }
      items = next; saveItems(items); renderLists();
    }
  }
  if (assetsBody) assetsBody.addEventListener('click', onTableClick);
  if (liabilitiesBody) liabilitiesBody.addEventListener('click', onTableClick);

  if (itemForm) itemForm.addEventListener('submit', function(e){
    e.preventDefault();
    if (!editId) return;
    var id = (editId.value||'').trim();
    var entry = {
      id: id,
      type: itemType ? itemType.value : 'asset',
      category: itemCategory ? (itemCategory.value || 'Other') : 'Other',
      name: (itemName && itemName.value ? itemName.value.trim() : '') || ((itemType && itemType.value)==='asset' ? 'Asset' : 'Liability'),
      amount: parseFloat(itemAmount && itemAmount.value || '0') || 0,
      countsFi: (itemType && itemType.value)==='asset' ? ((itemCountsFi && itemCountsFi.value)==='yes') : false
    };
    var updated=[];
    for (var i=0;i<items.length;i++){ updated.push(items[i].id===id ? entry : items[i]); }
    items = updated; saveItems(items); renderLists(); showToast('Updated'); closeModal();
  });

  // ===== History & CSV (soft-gated) =====
  var snapshotBtn = $('snapshotBtn'), exportCsvBtn = $('exportCsvBtn');

  if (snapshotBtn) snapshotBtn.addEventListener('click', function(){
    var t = computeTotals();
    var now = new Date();
    var monthKey = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    var idx = -1;
    for (var i=0;i<history.length;i++){ if (history[i].dateISO===monthKey){ idx=i; break; } }
    var entry = { dateISO: monthKey, netWorthNumber: t.net };
    if (idx>=0) history[idx]=entry; else history.push(entry);
    history.sort(function(a,b){ return new Date(a.dateISO) - new Date(b.dateISO); });
    saveHistory(history); renderHistory();
  });

  function doExportCsv(){
    var rows=[['Date','Net Worth']];
    for (var i=0;i<history.length;i++){
      rows.push([ new Date(history[i].dateISO).toISOString().slice(0,10), history[i].netWorthNumber ]);
    }
    var csv='';
    for (var r=0;r<rows.length;r++){ csv += rows[r].join(',') + (r<rows.length-1 ? '\n' : ''); }
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a'); a.href=url; a.download='net-worth-history.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function openNl(){
    var el = $('nlBackdrop');
    if (el){ el.style.display='flex'; }
  }
  function closeNl(){
    var el = $('nlBackdrop');
    if (el){ el.style.display='none'; }
  }

  (function(){
    var form = $('nlForm');
    var skip = $('nlSkip');
    var already = $('nlAlready');
    if (form){
      form.addEventListener('submit', function(){
        try { localStorage.setItem(NEWS_KEY, '1'); } catch(e){}
        setTimeout(function(){ closeNl(); doExportCsv(); }, 150);
      });
    }
    if (skip){
      skip.addEventListener('click', function(){
        closeNl(); doExportCsv();
      });
    }
    if (already){
      already.addEventListener('change', function(){
        if (already.checked){
          try { localStorage.setItem(NEWS_KEY, '1'); } catch(e){}
        }
      });
    }
    var nlBackdrop = $('nlBackdrop');
    if (nlBackdrop){
      nlBackdrop.addEventListener('click', function(e){ if (e.target===nlBackdrop) closeNl(); });
    }
  })();

  if (exportCsvBtn) exportCsvBtn.addEventListener('click', function(){
    var ok = false;
    try { ok = localStorage.getItem(NEWS_KEY)==='1'; } catch(e){}
    if (ok){ doExportCsv(); }
    else { openNl(); }
  });

  // ===== Initial paint =====
  renderLists();
  renderHistory();
})();
