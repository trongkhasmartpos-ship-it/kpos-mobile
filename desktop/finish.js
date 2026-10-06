/* KPOS Completion Pack - scanner/IMEI, warranty workflow, print manager, reports */
(function(){
  const desktopMQ=window.matchMedia('(min-width: 980px)');
  const isDesktop=()=>desktopMQ.matches;

  function ensureFinishData(){
    if(!db.printDefaults||typeof db.printDefaults!=='object'){
      db.printDefaults={sale:{K80:'sale_k80',A4:'sale_a4'},warranty:{K80:'warranty_k80',A4:'warranty_a4'}};
    }
    ['sale','warranty'].forEach(type=>{
      db.printDefaults[type]=db.printDefaults[type]||{};
      ['K80','A4'].forEach(paper=>{
        const list=getTemplates(type).filter(t=>t.paper===paper);
        if(!list.some(t=>t.id===db.printDefaults[type][paper])) db.printDefaults[type][paper]=list[0]?.id||'';
      });
    });
    db.warranties=(db.warranties||[]).map(w=>({condition:'',accessories:'',promisedAt:'',note:'',timeline:[],...w}));
  }
  ensureFinishData();

  /* ---------- POS: search/scan by barcode + IMEI/Serial ---------- */
  const baseFindProductByCode=window.findProductByCode;
  window.findProductByCode=findProductByCode=function(value){
    const v=String(value||'').trim();
    const direct=baseFindProductByCode(v);if(direct)return direct;
    const im=db.imeis.find(i=>String(i.value||'').toLowerCase()===v.toLowerCase());
    return im?product(im.productId):undefined;
  };
  function productsForPosQuery(q){
    q=String(q||'').trim().toLowerCase();if(!q)return db.products.slice(0,80);
    const ids=new Set(db.imeis.filter(i=>String(i.value||'').toLowerCase().includes(q)).map(i=>i.productId));
    return db.products.filter(p=>ids.has(p.id)||[p.name,p.short,p.keywords,p.sku,p.barcode].some(x=>String(x||'').toLowerCase().includes(q))).slice(0,80);
  }
  window.renderPosProducts=()=>{const el=$('#posProducts');if(!el)return;el.innerHTML=posProductCards(productsForPosQuery($('#posSearch')?.value||''))};

  function addScannedImeiToCart(im){
    const p=product(im.productId);if(!p)return {ok:false,label:'Không rõ sản phẩm'};
    if(im.status!=='Trong kho')return {ok:false,label:`IMEI ${im.status||'không khả dụng'}`};
    let c=db.cart.find(x=>x.productId===p.id);
    if(c&&(c.selectedImeis||[]).includes(im.id))return {ok:false,label:'IMEI đã có trong đơn'};
    if(!c){c={productId:p.id,qty:1,selectedImeis:[im.id]};db.cart.push(c)}
    else {
      c.selectedImeis=c.selectedImeis||[];
      if(c.selectedImeis.length<c.qty)c.selectedImeis.push(im.id);
      else {
        if(c.qty>=p.stock||c.qty>=availableImeis(p.id).length)return {ok:false,label:'Không đủ tồn kho'};
        c.qty++;c.selectedImeis.push(im.id);
      }
    }
    saveDB();return {ok:true,label:p.name};
  }
  function addScannedProductToCart(p){
    if(!p||p.stock<=0)return {ok:false,label:'Sản phẩm hết hàng'};
    let c=db.cart.find(x=>x.productId===p.id);
    if(!c){db.cart.push({productId:p.id,qty:1,selectedImeis:[]});saveDB();return {ok:true,label:p.imeiEnabled?`${p.name} • chờ IMEI`:p.name}}
    if(c.qty>=p.stock)return {ok:false,label:'Vượt tồn kho'};
    if(p.imeiEnabled&&c.qty>=availableImeis(p.id).length)return {ok:false,label:'Không đủ IMEI'};
    c.qty++;saveDB();return {ok:true,label:p.imeiEnabled?`${p.name} • chờ IMEI`:p.name};
  }

  const baseAcceptScan=window.acceptScan;
  window.acceptScan=acceptScan=function(value=null){
    const v=(value||$('#scannerManual')?.value||'').trim();
    if(state.scanTarget==='pos'&&v){
      const im=db.imeis.find(i=>String(i.value||'').toLowerCase()===v.toLowerCase());
      if(im){stopScanner();state.scanReturn=null;state.scanContext=null;state.modal=null;const r=addScannedImeiToCart(im);render();toast(r.ok?`Đã thêm ${r.label}`:r.label);return}
    }
    return baseAcceptScan(value);
  };

  const baseHandleContinuousScan=window.handleContinuousScan;
  window.handleContinuousScan=handleContinuousScan=function(v){
    if(state.scanTarget!=='posContinuous')return baseHandleContinuousScan(v);
    v=String(v||'').trim();if(!v)return;
    const im=db.imeis.find(i=>String(i.value||'').toLowerCase()===v.toLowerCase());
    const r=im?addScannedImeiToCart(im):addScannedProductToCart(baseFindProductByCode(v));
    state.scanFeed.unshift({code:v,status:r.ok?'Hoàn thành':'Không nhận',label:r.label||'',time:new Date().toISOString()});
    state.scanFeed=state.scanFeed.slice(0,30);renderScannerFeed();
  };

  const basePosView=window.posView;
  function withContinuousScanner(html){
    if(html.includes("openScanner('posContinuous'"))return html;
    const desktopNeedle='<button class="btn accent" onclick="openScanner(\'pos\')">📷 Quét mã</button>';
    const mobileNeedle='<button class="btn accent" onclick="openScanner(\'pos\')">📷 Quét</button>';
    const extra='<button class="btn ghost kpos-scan-cont" onclick="openScanner(\'posContinuous\',null,true)">⚡ Quét liên tục</button>';
    if(html.includes(desktopNeedle))return html.replace(desktopNeedle,desktopNeedle+extra);
    if(html.includes(mobileNeedle))return html.replace(mobileNeedle,mobileNeedle+extra);
    return html;
  }
  window.posView=posView=function(){return withContinuousScanner(basePosView())};

  /* ---------- Warranty: fuller intake + timeline ---------- */
  window.openWarrantyForm=(imeiValue='')=>{
    const draft={imei:imeiValue,customerName:'',phone:'',issue:'',condition:'',accessories:'',promisedAt:'',note:'',status:'Mới tiếp nhận',productName:'',invoiceCode:'',warrantyText:''};
    hydrateWarrantyDraft(draft,imeiValue);state.modal={type:'warrantyForm',draft};render();
  };
  window.saveWarranty=()=>{
    const d=state.modal?.draft;if(!d)return;
    d.imei=$('#wf_imei')?.value.trim()||'';d.customerName=$('#wf_customer')?.value.trim()||'';d.phone=$('#wf_phone')?.value.trim()||'';
    d.issue=$('#wf_issue')?.value.trim()||'';d.condition=$('#wf_condition')?.value.trim()||'';d.accessories=$('#wf_accessories')?.value.trim()||'';
    d.promisedAt=$('#wf_promised')?.value?new Date($('#wf_promised').value).toISOString():'';d.note=$('#wf_note')?.value.trim()||'';d.status=$('#wf_status')?.value||'Mới tiếp nhận';
    if(!d.imei)return toast('Nhập hoặc quét IMEI / Serial');hydrateWarrantyDraft(d,d.imei);
    const now=new Date().toISOString(),w={...d,id:Date.now(),code:code('BH',db.warranties),date:now,timeline:[{date:now,status:d.status,note:'Tiếp nhận bảo hành'}]};
    db.warranties.unshift(w);const im=db.imeis.find(i=>i.value===d.imei);if(im)im.status='Bảo hành';addActivity(`Tiếp nhận bảo hành ${w.code}`);saveDB();state.modal=null;state.screen='warranty';render();
  };
  window.updateWarrantyStatus=(id,status)=>{
    const w=db.warranties.find(x=>x.id===id);if(!w)return;const old=w.status;w.status=status;w.timeline=w.timeline||[];
    if(old!==status)w.timeline.unshift({date:new Date().toISOString(),status,note:`Chuyển từ ${old||'—'} → ${status}`});
    const im=db.imeis.find(i=>i.value===w.imei);if(im)im.status=(status==='Đã trả khách'||status==='Hoàn thành')?'Đã bán':'Bảo hành';
    saveDB();state.modal={type:'warrantyDetail',w};render();
  };

  const baseModalView=window.modalView;
  function warrantyFormModal(m){const d=m.draft;return sheet('Tiếp nhận bảo hành',`
    <div class="field"><label>IMEI / Serial *</label><div class="searchrow" style="margin:0"><input id="wf_imei" class="mono" value="${esc(d.imei||'')}" onchange="lookupWarrantyImei()"><button class="btn accent" onclick="openScanner('warrantyForm')">📷</button><button class="btn ghost" onclick="lookupWarrantyImei()">Tra</button></div></div>
    ${d.productName?`<div class="notice"><b>${esc(d.productName)}</b><br>${esc(d.invoiceCode||'Không có hóa đơn')} • ${esc(d.warrantyText||'')}</div>`:''}
    <div class="form-row" style="margin-top:12px"><div class="field"><label>Tên khách</label><input id="wf_customer" value="${esc(d.customerName||'')}"></div><div class="field"><label>SĐT</label><input id="wf_phone" value="${esc(d.phone||'')}"></div></div>
    <div class="field"><label>Lỗi khách báo *</label><textarea id="wf_issue" rows="3">${esc(d.issue||'')}</textarea></div>
    <div class="form-row"><div class="field"><label>Tình trạng máy khi nhận</label><textarea id="wf_condition" rows="2" placeholder="Trầy xước, móp, không lên nguồn...">${esc(d.condition||'')}</textarea></div><div class="field"><label>Phụ kiện kèm theo</label><textarea id="wf_accessories" rows="2" placeholder="Sạc, cáp, hộp...">${esc(d.accessories||'')}</textarea></div></div>
    <div class="form-row"><div class="field"><label>Hẹn trả dự kiến</label><input id="wf_promised" type="datetime-local" value="${d.promisedAt?new Date(d.promisedAt).toISOString().slice(0,16):''}"></div><div class="field"><label>Trạng thái</label><select id="wf_status">${['Mới tiếp nhận','Đang kiểm tra','Đang sửa','Chờ linh kiện','Hoàn thành','Đã trả khách','Hủy'].map(x=>`<option ${x===d.status?'selected':''}>${x}</option>`).join('')}</select></div></div>
    <div class="field"><label>Ghi chú nội bộ</label><textarea id="wf_note" rows="3">${esc(d.note||'')}</textarea></div>
    <button class="btn primary block" onclick="saveWarranty()">TẠO PHIẾU BẢO HÀNH</button>`)}
  function warrantyDetailModal(m){const w=m.w||{},timeline=w.timeline||[];return sheet(w.code||'Phiếu bảo hành',`
    <div class="card"><div class="small muted">IMEI / SERIAL</div><b class="mono">${esc(w.imei||'')}</b><hr><div class="small muted">Sản phẩm</div><b>${esc(w.productName||'')}</b><hr><div class="small muted">Khách hàng</div><b>${esc(w.customerName||'')} ${w.phone?`• ${esc(w.phone)}`:''}</b><hr><div class="small muted">Lỗi khách báo</div><b>${esc(w.issue||'')}</b></div>
    <div class="finish-warranty-grid"><div><span>Tình trạng khi nhận</span><b>${esc(w.condition||'Chưa ghi')}</b></div><div><span>Phụ kiện</span><b>${esc(w.accessories||'Không có')}</b></div><div><span>Hẹn trả</span><b>${w.promisedAt?fmtDateTime(w.promisedAt):'Chưa hẹn'}</b></div><div><span>Ghi chú</span><b>${esc(w.note||'—')}</b></div></div>
    <div class="field" style="margin-top:12px"><label>Cập nhật trạng thái</label><select onchange="updateWarrantyStatus(${w.id},this.value)">${['Mới tiếp nhận','Đang kiểm tra','Đang sửa','Chờ linh kiện','Hoàn thành','Đã trả khách','Hủy'].map(x=>`<option ${x===w.status?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="section-title">Tiến trình bảo hành</div><div class="timeline">${timeline.map(t=>`<div class="tl"><b>${esc(t.status||'Cập nhật')}</b><div>${esc(t.note||'')}</div><div class="small muted">${fmtDateTime(t.date)}</div></div>`).join('')||'<div class="empty">Chưa có lịch sử trạng thái.</div>'}</div>
    <div class="split-buttons" style="margin-top:12px"><button class="btn ghost" onclick="previewTemplate('warranty_k80','warranty',${w.id})">Xem K80</button><button class="btn primary" onclick="previewTemplate('warranty_a4','warranty',${w.id})">Xem A4</button></div>`)}
  window.modalView=modalView=function(){
    if(state.modal?.type==='warrantyForm')return warrantyFormModal(state.modal);
    if(state.modal?.type==='warrantyDetail')return warrantyDetailModal(state.modal);
    return baseModalView();
  };

  /* ---------- Print template management ---------- */
  function defaultTemplateId(type,paper){ensureFinishData();return db.printDefaults?.[type]?.[paper]||''}
  function templateManagerBar(type){
    const k80=getTemplates(type).filter(t=>t.paper==='K80'),a4=getTemplates(type).filter(t=>t.paper==='A4');
    const select=(paper,list)=>`<label><span>Mặc định ${paper}</span><select onchange="setDefaultPrintTemplate(this.value)">${list.map(t=>`<option value="${t.id}" ${t.id===defaultTemplateId(type,paper)?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>`;
    return `<div class="finish-print-manager"><div class="finish-print-defaults">${select('K80',k80)}${select('A4',a4)}</div><div class="finish-print-actions"><button class="btn ghost small" onclick="createPrintTemplate('${type}','K80')">＋ Mẫu K80</button><button class="btn ghost small" onclick="createPrintTemplate('${type}','A4')">＋ Mẫu A4</button>${isDesktop()&&state.desktopPrintId?`<button class="btn ghost small" onclick="duplicatePrintTemplate('${state.desktopPrintId}')">Nhân bản</button><button class="btn danger small" onclick="deletePrintTemplate('${state.desktopPrintId}')">Xóa mẫu</button>`:''}</div></div>`;
  }
  window.setDefaultPrintTemplate=id=>{const t=getTemplate(id);if(!t)return;ensureFinishData();db.printDefaults[t.docType][t.paper]=id;saveDB();toast(`Đã đặt ${t.name} làm mẫu mặc định`);render()};
  window.createPrintTemplate=(type,paper)=>{ensureFinishData();const src=getTemplates(type).find(t=>t.paper===paper)||defaultPrintTemplates().find(t=>t.docType===type&&t.paper===paper);if(!src)return;const t=clone(src);t.id=`tpl_${type}_${paper.toLowerCase()}_${Date.now()}`;t.name=`Mẫu mới ${paper}`;t.desc='Mẫu tùy chỉnh';db.printTemplates.push(t);state.desktopPrintId=t.id;saveDB();state.modal={type:'templateEditor',tpl:clone(t)};render()};
  window.duplicatePrintTemplate=id=>{const src=getTemplate(id);if(!src)return;const t=clone(src);t.id=`${src.id}_copy_${Date.now()}`;t.name=`${src.name} - Bản sao`;db.printTemplates.push(t);state.desktopPrintId=t.id;saveDB();render();toast('Đã nhân bản mẫu in')};
  window.deletePrintTemplate=id=>{const t=getTemplate(id);if(!t)return;const same=getTemplates(t.docType).filter(x=>x.paper===t.paper);if(same.length<=1)return toast(`Phải giữ ít nhất 1 mẫu ${t.paper}`);if(!confirm(`Xóa mẫu “${t.name}”?`))return;db.printTemplates=db.printTemplates.filter(x=>x.id!==id);if(defaultTemplateId(t.docType,t.paper)===id)db.printDefaults[t.docType][t.paper]=db.printTemplates.find(x=>x.docType===t.docType&&x.paper===t.paper)?.id||'';state.desktopPrintId=null;saveDB();render()};

  const basePrintsView=window.printsView;
  window.printsView=printsView=function(){ensureFinishData();let html=basePrintsView();const bar=templateManagerBar(state.printDocType||'sale');if(html.includes('<div class="pro-print-top">'))return html.replace('<div class="pro-print-top">',bar+'<div class="pro-print-top">');return html.replace('<div class="template-grid">',bar+'<div class="template-grid">')};
  const basePreviewTemplate=window.previewTemplate;
  window.previewTemplate=(id,sourceType='sample',sourceId=null)=>{
    if(sourceType==='invoice'){const t=getTemplate(id);if(t)id=defaultTemplateId('sale',t.paper)||id}
    if(sourceType==='warranty'){const t=getTemplate(id);if(t)id=defaultTemplateId('warranty',t.paper)||id}
    return basePreviewTemplate(id,sourceType,sourceId);
  };

  /* ---------- Reports: date filters and full payment breakdown ---------- */
  state.finishReportPreset=state.finishReportPreset||'30';state.finishReportFrom=state.finishReportFrom||'';state.finishReportTo=state.finishReportTo||'';
  function reportBounds(){
    const now=new Date(),end=new Date(now);end.setHours(23,59,59,999);let start=null;
    if(state.finishReportPreset==='all')return {start:null,end:null};
    if(state.finishReportPreset==='custom'){
      start=state.finishReportFrom?new Date(state.finishReportFrom+'T00:00:00'):null;const e=state.finishReportTo?new Date(state.finishReportTo+'T23:59:59'):null;return {start,end:e};
    }
    start=new Date(now);start.setHours(0,0,0,0);const days=Number(state.finishReportPreset||30);if(days>1)start.setDate(start.getDate()-(days-1));return {start,end};
  }
  function inReportRange(date){const {start,end}=reportBounds(),d=new Date(date);return (!start||d>=start)&&(!end||d<=end)}
  window.setFinishReportPreset=v=>{state.finishReportPreset=v;render()};
  window.applyFinishReportCustom=()=>{state.finishReportFrom=$('#finishReportFrom')?.value||'';state.finishReportTo=$('#finishReportTo')?.value||'';state.finishReportPreset='custom';render()};
  window.reportsView=reportsView=function(){
    const invs=db.invoices.filter(i=>i.status!=='Đã hủy'&&inReportRange(i.date)),cancelled=db.invoices.filter(i=>i.status==='Đã hủy'&&inReportRange(i.date)),pays=db.payments.filter(p=>p.status!=='Đã hủy'&&inReportRange(p.date));
    const revenue=invs.reduce((a,b)=>a+(b.total||0),0),profit=invs.reduce((a,b)=>a+(b.profit||0),0),cash=pays.filter(p=>p.method==='Tiền mặt').reduce((a,b)=>a+(b.amount||0),0),bank=pays.filter(p=>p.method==='Chuyển khoản').reduce((a,b)=>a+(b.amount||0),0),card=pays.filter(p=>p.method==='Thẻ/POS').reduce((a,b)=>a+(b.amount||0),0),newDebt=invs.reduce((a,b)=>a+(b.debt||0),0),currentDebt=db.customers.reduce((a,b)=>a+(b.debt||0),0);
    const sold=new Map();invs.forEach(inv=>(inv.items||[]).forEach(it=>{const p=product(it.productId),x=sold.get(it.productId)||{name:p?.name||'Sản phẩm',qty:0,revenue:0};x.qty+=it.qty||0;x.revenue+=(it.qty||0)*(it.price||0);sold.set(it.productId,x)}));
    const top=[...sold.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,15);
    const presets=[['1','Hôm nay'],['7','7 ngày'],['30','30 ngày'],['all','Tất cả']];
    return `${topbar('Báo cáo','Doanh thu • lợi nhuận • thanh toán • công nợ')}<div class="content finish-report-page"><div class="finish-report-toolbar"><div class="seg">${presets.map(([v,l])=>`<button class="${state.finishReportPreset===v?'active':''}" onclick="setFinishReportPreset('${v}')">${l}</button>`).join('')}</div><div class="finish-report-custom"><input id="finishReportFrom" type="date" value="${state.finishReportFrom}"><span>đến</span><input id="finishReportTo" type="date" value="${state.finishReportTo}"><button class="btn ghost small" onclick="applyFinishReportCustom()">Áp dụng</button></div></div>
      <div class="finish-report-kpis">${stat('Doanh thu',money(revenue))}${stat('Lợi nhuận',money(profit))}${stat('Tổng đơn',invs.length)}${stat('Hóa đơn hủy',cancelled.length)}${stat('Tiền mặt',money(cash))}${stat('Chuyển khoản',money(bank))}${stat('Thẻ / POS',money(card))}${stat('Ghi nợ phát sinh',money(newDebt))}${stat('Công nợ hiện tại',money(currentDebt))}</div>
      <div class="section-title">Sản phẩm bán trong kỳ</div><div class="card finish-report-table"><div class="finish-report-row head"><div>Sản phẩm</div><div class="center">SL</div><div class="right">Doanh thu</div></div>${top.map(x=>`<div class="finish-report-row"><div><b>${esc(x.name)}</b></div><div class="center">${x.qty}</div><div class="right"><b>${money(x.revenue)}</b></div></div>`).join('')||'<div class="empty">Chưa có dữ liệu trong khoảng thời gian này.</div>'}</div>
    </div>${nav()}`;
  };
})();
