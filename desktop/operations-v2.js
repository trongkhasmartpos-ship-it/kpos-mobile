/* KPOS Operations V2 - stock receipt lifecycle, inventory reconciliation, advanced filters, document standards */
(function(){
  const desktopMQ=window.matchMedia('(min-width:980px)');
  const isDesktop=()=>desktopMQ.matches;
  const baseModalView=window.modalView;
  const baseRender=window.render;
  const baseStockView=window.stockView;
  const baseInvoicesView=window.invoicesView;
  const basePaymentsView=window.paymentsView;
  const baseFinishCheckout=window.finishCheckout;
  const baseSaveDebtPayment=window.saveDebtPayment;
  const baseFinishStockReceipt=window.finishStockReceipt;

  const VALID_INVOICE_STATUS=['Hoàn thành','Công nợ','Trả một phần','Đã trả hàng','Đã hủy'];
  const VALID_RECEIPT_STATUS=['Đã nhập kho','Đã hủy'];
  const VALID_PAYMENT_STATUS=['Hoàn thành','Hoàn tiền','Đã hủy'];
  const VALID_RETURN_STATUS=['Hoàn thành','Đã hủy'];
  const WARRANTY_STATUS=['Mới tiếp nhận','Đang kiểm tra','Đang sửa','Chờ linh kiện','Hoàn thành','Đã trả khách','Hủy'];

  function docCode(prefix,collection=[],dateValue=new Date()){
    const d=new Date(dateValue||new Date()),pad=n=>String(n).padStart(2,'0');
    const token=pad(d.getDate())+pad(d.getMonth()+1)+String(d.getFullYear()).slice(-2);
    const re=new RegExp('^'+String(prefix).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+token+'-(\\d+)$');
    let max=0;
    for(const row of collection||[]){const m=String(row?.code||'').match(re);if(m)max=Math.max(max,Number(m[1])||0)}
    return `${prefix}${token}-${String(max+1).padStart(3,'0')}`;
  }
  window.KPOS_DOC_CODE=docCode;
  try{window.code=code=function(prefix,collection=[]){return docCode(prefix,collection,new Date())}}catch(e){window.code=(prefix,collection=[])=>docCode(prefix,collection,new Date())}

  function ensureOps(save=false){
    let changed=false;
    if(!Array.isArray(db.stockReceipts)){db.stockReceipts=[];changed=true}
    if(!Array.isArray(db.inventoryMovements)){db.inventoryMovements=[];changed=true}
    if(!Array.isArray(db.payments)){db.payments=[];changed=true}
    if(!Array.isArray(db.returns)){db.returns=[];changed=true}
    for(const r of db.stockReceipts){
      if(!VALID_RECEIPT_STATUS.includes(r.status)){r.status=r.cancelledAt?'Đã hủy':'Đã nhập kho';changed=true}
      if(!Array.isArray(r.items)){r.items=[];changed=true}
      if(!('cancelledAt' in r)){r.cancelledAt=null;changed=true}
      if(!('cancelReason' in r)){r.cancelReason='';changed=true}
    }
    for(const inv of db.invoices||[]){
      if(!VALID_INVOICE_STATUS.includes(inv.status)){
        inv.status=inv.cancelledAt?'Đã hủy':(Number(inv.returnedAmount)>0?'Trả một phần':(Number(inv.debt)>0?'Công nợ':'Hoàn thành'));changed=true;
      }
    }
    for(const p of db.payments){if(!VALID_PAYMENT_STATUS.includes(p.status)){p.status=Number(p.amount)<0?'Hoàn tiền':'Hoàn thành';changed=true}}
    for(const r of db.returns){if(!VALID_RETURN_STATUS.includes(r.status)){r.status=r.cancelledAt?'Đã hủy':'Hoàn thành';changed=true}}
    for(const w of db.warranties||[]){if(!WARRANTY_STATUS.includes(w.status)){w.status='Mới tiếp nhận';changed=true}}
    if(changed&&save)saveDB();
    return changed;
  }
  ensureOps(true);

  function receipt(id){return (db.stockReceipts||[]).find(x=>String(x.id)===String(id))}
  function receiptImeis(r,it){
    const ids=new Set((it.imeis||[]).map(String));
    return (db.imeis||[]).filter(im=>String(im.stockReceiptId)===String(r.id)||(im.productId===it.productId&&ids.has(String(im.value))));
  }
  function movementLedger(productId){return (db.inventoryMovements||[]).filter(m=>String(m.productId)===String(productId)).reduce((s,m)=>s+(Number(m.qty)||0),0)}
  function receiptTotalQty(r){return (r.items||[]).reduce((s,it)=>s+(Number(it.qty)||0),0)}
  function receiptImeiCount(r){return (r.items||[]).reduce((s,it)=>s+(it.imeis?.length||0),0)}

  window.openStockReceiptDetail=id=>{ensureOps();const r=receipt(id);if(!r)return toast('Không tìm thấy phiếu nhập');state.modal={type:'stockReceiptDetail',receiptId:r.id};render()};
  window.openStockReceiptEdit=id=>{const r=receipt(id);if(!r||r.status==='Đã hủy')return toast('Phiếu nhập đã hủy không thể sửa');state.modal={type:'stockReceiptEdit',receiptId:r.id,draft:{date:r.date,supplier:r.supplier||'',note:r.note||'',items:(r.items||[]).map(it=>({productId:it.productId,qty:Number(it.qty)||0,originalQty:Number(it.qty)||0,imeis:[...(it.imeis||[])]}))}};render()};
  window.setReceiptEditQty=(productId,val)=>{const m=state.modal;if(m?.type!=='stockReceiptEdit')return;const it=m.draft.items.find(x=>String(x.productId)===String(productId)),p=product(productId);if(!it||p?.imeiEnabled)return;it.qty=Math.max(0,Math.floor(Number(val)||0))};

  window.saveStockReceiptEdit=()=>{
    const m=state.modal,r=receipt(m?.receiptId);if(m?.type!=='stockReceiptEdit'||!r)return;
    if(r.status==='Đã hủy')return toast('Phiếu đã hủy');
    const supplier=$('#sre_supplier')?.value.trim()||'',note=$('#sre_note')?.value.trim()||'',dateInput=$('#sre_date')?.value;
    let newDate=r.date;try{if(dateInput)newDate=new Date(dateInput).toISOString()}catch(e){}
    const changes=[];
    for(const d of m.draft.items){
      const p=product(d.productId);if(!p)continue;
      if(p.imeiEnabled){d.qty=d.originalQty;continue}
      const delta=(Number(d.qty)||0)-(Number(d.originalQty)||0);
      if(delta<0&&(Number(p.stock)||0)<Math.abs(delta))return toast(`Không thể giảm ${p.name}: tồn hiện tại không đủ để đảo ${Math.abs(delta)} sản phẩm.`);
      if(delta)changes.push({p,d,delta});
    }
    for(const x of changes){x.p.stock=(Number(x.p.stock)||0)+x.delta;addMovement(x.p.id,x.delta,'RECEIVE_ADJUST',r.code,`Điều chỉnh phiếu nhập ${r.code}`)}
    r.items=m.draft.items.filter(x=>(Number(x.qty)||0)>0).map(x=>({productId:x.productId,qty:Number(x.qty)||0,imeis:[...(x.imeis||[])]}));
    r.supplier=supplier;r.note=note;r.date=newDate;r.updatedAt=new Date().toISOString();
    (db.inventoryMovements||[]).filter(x=>x.code===r.code&&x.type==='RECEIVE').forEach(x=>x.date=newDate);
    (db.imeis||[]).filter(x=>String(x.stockReceiptId)===String(r.id)).forEach(x=>x.receivedDate=newDate);
    addActivity(`Đã sửa phiếu nhập ${r.code}`);saveDB();state.modal={type:'stockReceiptDetail',receiptId:r.id};render();toast('Đã lưu phiếu nhập');
  };

  window.cancelStockReceipt=id=>{
    const r=receipt(id);if(!r||r.status==='Đã hủy')return;
    for(const it of r.items||[]){
      const p=product(it.productId);if(!p)return toast('Phiếu có sản phẩm không còn tồn tại');
      const qty=Number(it.qty)||0;
      if((Number(p.stock)||0)<qty)return toast(`Không thể hủy: tồn ${p.name} chỉ còn ${p.stock}, thấp hơn số đã nhập ${qty}.`);
      if(p.imeiEnabled){
        const ims=receiptImeis(r,it);
        if(ims.length<qty)return toast(`Không thể hủy: thiếu dữ liệu IMEI của ${p.name}.`);
        const blocked=ims.find(im=>im.status!=='Trong kho'||im.invoiceId||im.customerId);
        if(blocked)return toast(`Không thể hủy: IMEI ${blocked.value} đã phát sinh bán hàng/bảo hành.`);
      }
    }
    const reason=prompt('Lý do hủy phiếu nhập:','Tạo nhầm / nhập nhầm')||'Hủy phiếu nhập';
    if(!confirm(`Xác nhận hủy ${r.code}? Tồn kho và IMEI của phiếu này sẽ được đảo lại.`))return;
    for(const it of r.items||[]){
      const p=product(it.productId),qty=Number(it.qty)||0;if(!p)continue;
      p.stock=Math.max(0,(Number(p.stock)||0)-qty);addMovement(p.id,-qty,'RECEIVE_CANCEL',r.code,`Hủy phiếu nhập: ${reason}`);
      if(p.imeiEnabled){const removeIds=new Set(receiptImeis(r,it).map(im=>String(im.id)));db.imeis=(db.imeis||[]).filter(im=>!removeIds.has(String(im.id)))}
    }
    r.status='Đã hủy';r.cancelledAt=new Date().toISOString();r.cancelReason=reason;addActivity(`Đã hủy phiếu nhập ${r.code} • ${reason}`);saveDB();state.modal={type:'stockReceiptDetail',receiptId:r.id};render();toast('Đã hủy phiếu nhập và hoàn nguyên tồn kho');
  };

  function stockReceiptDetailModal(m){
    const r=receipt(m.receiptId);if(!r)return sheet('Phiếu nhập','<div class="empty">Không tìm thấy phiếu nhập.</div>');
    const rows=(r.items||[]).map(it=>{const p=product(it.productId),ims=receiptImeis(r,it);return `<div class="ops-detail-row"><div><b>${esc(p?.name||'Sản phẩm đã xóa')}</b><small>${esc(p?.sku||'')} ${p?.imeiEnabled?`• ${ims.length} IMEI/Serial`:''}</small>${ims.length?`<div class="taglist">${ims.map(im=>`<span class="imei-tag mono">${esc(im.value)}</span>`).join('')}</div>`:''}</div><div class="right"><b>${Number(it.qty)||0}</b><small>sản phẩm</small></div></div>`}).join('');
    return sheet(`Phiếu nhập ${r.code}`,`<div class="ops-doc-kpis"><div><span>Trạng thái</span><b class="${r.status==='Đã hủy'?'danger-text':'success-text'}">${esc(r.status)}</b></div><div><span>Tổng số lượng</span><b>${receiptTotalQty(r)}</b></div><div><span>IMEI/Serial</span><b>${receiptImeiCount(r)}</b></div></div><div class="card ops-doc-info"><div><span>Ngày nhập</span><b>${fmtDateTime(r.date)}</b></div><div><span>Nhà cung cấp</span><b>${esc(r.supplier||'—')}</b></div><div><span>Ghi chú</span><b>${esc(r.note||'—')}</b></div>${r.cancelledAt?`<div><span>Đã hủy</span><b>${fmtDateTime(r.cancelledAt)} • ${esc(r.cancelReason||'')}</b></div>`:''}</div><div class="section-title">Hàng hóa nhập</div><div class="ops-detail-list">${rows||'<div class="empty">Không có sản phẩm.</div>'}</div><div class="ops-doc-actions"><button class="btn ghost" onclick="openStockReceiptEdit(${JSON.stringify(r.id)})" ${r.status==='Đã hủy'?'disabled':''}>Sửa phiếu</button><button class="btn danger" onclick="cancelStockReceipt(${JSON.stringify(r.id)})" ${r.status==='Đã hủy'?'disabled':''}>Hủy phiếu nhập</button></div><div class="notice" style="margin-top:10px">Sản phẩm quản lý IMEI/Serial được khóa số lượng sau khi nhập để bảo vệ vòng đời thiết bị. Muốn tăng thêm IMEI, hãy tạo phiếu nhập mới.</div>`);
  }

  function stockReceiptEditModal(m){
    const r=receipt(m.receiptId);if(!r)return sheet('Sửa phiếu nhập','<div class="empty">Không tìm thấy phiếu.</div>');
    const date=new Date(m.draft.date||r.date||new Date()).toISOString().slice(0,16);
    return sheet(`Sửa ${r.code}`,`<div class="form-row"><div class="field"><label>Ngày giờ nhập</label><input id="sre_date" type="datetime-local" value="${date}"></div><div class="field"><label>Nhà cung cấp</label><input id="sre_supplier" value="${esc(m.draft.supplier||'')}"></div></div><div class="field"><label>Ghi chú</label><input id="sre_note" value="${esc(m.draft.note||'')}"></div><div class="section-title">Số lượng</div><div class="ops-edit-items">${m.draft.items.map(it=>{const p=product(it.productId);return `<div><span><b>${esc(p?.name||'Sản phẩm')}</b><small>${p?.imeiEnabled?'Quản lý IMEI/Serial • khóa số lượng':'Có thể chỉnh số lượng an toàn'}</small></span><input type="number" min="0" value="${it.qty}" ${p?.imeiEnabled?'disabled':''} oninput="setReceiptEditQty(${JSON.stringify(it.productId)},this.value)"></div>`}).join('')}</div><div class="notice" style="margin:10px 0">Khi giảm số lượng, hệ thống chỉ cho phép nếu tồn hiện tại đủ để đảo phần chênh lệch.</div><button class="btn primary block" onclick="saveStockReceiptEdit()">LƯU THAY ĐỔI</button>`);
  }

  function stockRows(list){
    if(isDesktop())return `<div class="ops-table"><div class="ops-tr head"><div>Phiếu nhập</div><div>Nhà cung cấp</div><div>Số lượng</div><div>Trạng thái</div></div>${list.map(r=>`<button class="ops-tr" onclick="openStockReceiptDetail(${JSON.stringify(r.id)})"><div><b>${esc(r.code)}</b><small>${fmtDateTime(r.date)}</small></div><div><b>${esc(r.supplier||'—')}</b><small>${esc(r.note||'')}</small></div><div><b>${receiptTotalQty(r)} SP</b><small>${receiptImeiCount(r)} IMEI</small></div><div class="right"><span class="badge ${r.status==='Đã hủy'?'red':'green'}">${esc(r.status)}</span></div></button>`).join('')||'<div class="empty">Chưa có phiếu nhập.</div>'}</div>`;
    return `<div class="list">${list.map(r=>`<button class="item" onclick="openStockReceiptDetail(${JSON.stringify(r.id)})"><div class="thumb">📥</div><div class="item-main"><div class="item-title">${esc(r.code)}</div><div class="item-sub">${fmtDateTime(r.date)} • ${receiptTotalQty(r)} sản phẩm</div><div class="small muted">${esc(r.supplier||'')}</div></div><span class="badge ${r.status==='Đã hủy'?'red':'green'}">${esc(r.status)}</span></button>`).join('')||'<div class="empty">Chưa có phiếu nhập.</div>'}</div>`;
  }
  function getStockFiltered(){
    const q=String(state.opsStockQ||'').toLowerCase(),status=state.opsStockStatus||'all';
    return (db.stockReceipts||[]).filter(r=>status==='all'||r.status===status).filter(r=>{const productText=(r.items||[]).map(it=>product(it.productId)?.name||'').join(' ');return [r.code,r.supplier,r.note,productText].some(x=>String(x||'').toLowerCase().includes(q))});
  }
  window.opsStockSearch=v=>{state.opsStockQ=v;const el=$('#opsStockResults');if(el)el.innerHTML=stockRows(getStockFiltered())};
  window.opsStockStatus=v=>{state.opsStockStatus=v;render()};
  window.stockView=stockView=function(){ensureOps();const list=getStockFiltered();return `${topbar('Nhập hàng','Phiếu nhập • chỉnh sửa an toàn • hủy • đối soát kho')}<div class="content"><div class="ops-toolbar"><div class="searchrow"><input value="${esc(state.opsStockQ||'')}" placeholder="Mã phiếu, NCC, sản phẩm..." oninput="opsStockSearch(this.value)"></div><select onchange="opsStockStatus(this.value)"><option value="all" ${(state.opsStockStatus||'all')==='all'?'selected':''}>Tất cả trạng thái</option><option ${state.opsStockStatus==='Đã nhập kho'?'selected':''}>Đã nhập kho</option><option ${state.opsStockStatus==='Đã hủy'?'selected':''}>Đã hủy</option></select><button class="btn primary" onclick="openStockReceipt()">＋ Tạo phiếu nhập</button><button class="btn ghost" onclick="go('inventoryReconcile')">⚖ Đối soát kho</button></div><div id="opsStockResults">${stockRows(list)}</div></div>${nav()}`};

  function reconcileRows(){return (db.products||[]).map(p=>{const appStock=Number(p.stock)||0,ledger=movementLedger(p.id),imei=p.imeiEnabled?availableImeis(p.id).length:null,ok=p.imeiEnabled?(appStock===ledger&&ledger===imei):(appStock===ledger);return {p,appStock,ledger,imei,ok}})}
  function inventoryReconcileView(){const rows=reconcileRows(),bad=rows.filter(x=>!x.ok);return `${topbar('Đối soát tồn kho','So sánh tồn hiển thị • sổ kho • IMEI/Serial')}<div class="content"><div class="ops-reconcile-summary">${stat('Sản phẩm kiểm tra',rows.length)}${stat('Đang khớp',rows.length-bad.length)}${stat('Có sai lệch',bad.length)}</div><div class="ops-page-actions"><button class="btn ghost" onclick="go('stock')">← Phiếu nhập</button><button class="btn primary" onclick="safeReconcileInventory()" ${bad.length?'':'disabled'}>Sửa sai lệch an toàn</button></div><div class="ops-table reconcile"><div class="ops-tr head"><div>Sản phẩm</div><div>Tồn app</div><div>Sổ kho</div><div>IMEI trong kho</div><div>Đối soát</div></div>${rows.map(x=>`<div class="ops-tr"><div><b>${esc(x.p.name)}</b><small>${esc(x.p.sku||'')}${x.p.imeiEnabled?' • IMEI/Serial':''}</small></div><div><b>${x.appStock}</b></div><div><b>${x.ledger}</b></div><div><b>${x.p.imeiEnabled?x.imei:'—'}</b></div><div class="right"><span class="badge ${x.ok?'green':'red'}">${x.ok?'Khớp':'Sai lệch'}</span>${!x.ok&&x.p.imeiEnabled&&x.ledger!==x.imei?'<small>Cần kiểm tra thủ công IMEI ↔ sổ kho</small>':''}</div></div>`).join('')}</div><div class="notice" style="margin-top:12px">“Sửa sai lệch an toàn” chỉ đồng bộ tồn hiển thị theo sổ kho khi dữ liệu có thể xác định chắc chắn. Với hàng IMEI, chỉ sửa tự động khi số IMEI trong kho khớp sổ kho.</div></div>${nav()}`}
  window.safeReconcileInventory=()=>{const rows=reconcileRows();let fixed=0,blocked=0;for(const x of rows){if(x.ok)continue;if(!x.p.imeiEnabled){x.p.stock=x.ledger;fixed++;continue}if(x.ledger===x.imei){x.p.stock=x.ledger;fixed++}else blocked++}if(fixed){addActivity(`Đối soát kho: sửa an toàn ${fixed} sản phẩm`);saveDB()}render();toast(blocked?`Đã sửa ${fixed} sản phẩm; còn ${blocked} hàng IMEI cần kiểm tra thủ công.`:`Đã đối soát và sửa ${fixed} sản phẩm.`)};

  function invRangeOK(inv){const preset=state.opsInvPreset||'30',d=new Date(inv.date),now=new Date();if(preset==='all')return true;if(preset==='custom'){const from=state.opsInvFrom?new Date(state.opsInvFrom+'T00:00:00'):null,to=state.opsInvTo?new Date(state.opsInvTo+'T23:59:59.999'):null;return (!from||d>=from)&&(!to||d<=to)}const days=preset==='today'?1:Number(preset)||30,start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-(days-1));return d>=start&&d<=now}
  function getInvoicesFiltered(){const q=String(state.opsInvQ||'').toLowerCase(),status=state.opsInvStatus||'all';return (db.invoices||[]).filter(inv=>status==='all'||inv.status===status).filter(inv=>invRangeOK(inv)).filter(inv=>{const c=customer(inv.customerId),ims=(inv.items||[]).flatMap(x=>x.imeis||[]).map(id=>imeiObj(id)?.value||id).join(' ');return [inv.code,c?.name,c?.phone,ims,inv.voucherCode,inv.paymentMethod,inv.status].some(x=>String(x||'').toLowerCase().includes(q))})}
  function invoiceResults(){return `<div id="opsInvoiceResults" class="list">${invoiceCards(getInvoicesFiltered())}</div>`}
  window.opsInvoiceSearch=v=>{state.opsInvQ=v;const el=$('#opsInvoiceResults');if(el)el.outerHTML=invoiceResults()};
  window.opsInvoiceStatus=v=>{state.opsInvStatus=v;render()};
  window.opsInvoicePreset=v=>{state.opsInvPreset=v;render()};
  window.opsInvoiceCustom=()=>{state.opsInvFrom=$('#opsInvFrom')?.value||'';state.opsInvTo=$('#opsInvTo')?.value||'';state.opsInvPreset='custom';render()};
  window.invoicesView=invoicesView=function(){ensureOps();const preset=state.opsInvPreset||'30';return `${topbar('Hóa đơn','Tìm kiếm • lọc thời gian • trạng thái • IMEI/Serial')}<div class="content"><div class="ops-filterbar"><div class="searchrow"><input value="${esc(state.opsInvQ||'')}" placeholder="Mã HD, khách, SĐT, IMEI, voucher..." oninput="opsInvoiceSearch(this.value)"></div><select onchange="opsInvoiceStatus(this.value)"><option value="all">Tất cả trạng thái</option>${VALID_INVOICE_STATUS.map(x=>`<option ${state.opsInvStatus===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="ops-period"><div class="seg">${[['today','Hôm nay'],['7','7 ngày'],['30','30 ngày'],['all','Tất cả']].map(([v,l])=>`<button class="${preset===v?'active':''}" onclick="opsInvoicePreset('${v}')">${l}</button>`).join('')}</div><div class="ops-date-range"><input id="opsInvFrom" type="date" value="${esc(state.opsInvFrom||'')}"><span>đến</span><input id="opsInvTo" type="date" value="${esc(state.opsInvTo||'')}"><button class="btn ghost small" onclick="opsInvoiceCustom()">Áp dụng</button></div></div>${invoiceResults()}</div>${nav()}`};

  function payRangeOK(p){const preset=state.opsPayPreset||'30',d=new Date(p.date),now=new Date();if(preset==='all')return true;if(preset==='custom'){const from=state.opsPayFrom?new Date(state.opsPayFrom+'T00:00:00'):null,to=state.opsPayTo?new Date(state.opsPayTo+'T23:59:59.999'):null;return (!from||d>=from)&&(!to||d<=to)}const days=preset==='today'?1:Number(preset)||30,start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-(days-1));return d>=start&&d<=now}
  function getPaymentsFiltered(){const q=String(state.opsPayQ||'').toLowerCase(),method=state.opsPayMethod||'all',status=state.opsPayStatus||'all';return (db.payments||[]).filter(p=>method==='all'||p.method===method).filter(p=>status==='all'||p.status===status).filter(payRangeOK).filter(p=>{const c=customer(p.customerId),inv=invoice(p.invoiceId);return [p.code,p.method,p.note,p.status,c?.name,c?.phone,inv?.code].some(x=>String(x||'').toLowerCase().includes(q))})}
  function paymentRows(){const list=getPaymentsFiltered();if(isDesktop())return `<div id="opsPaymentResults" class="ops-table"><div class="ops-tr head"><div>Phiếu / thời gian</div><div>Khách / hóa đơn</div><div>Phương thức</div><div>Số tiền</div></div>${list.map(p=>{const c=customer(p.customerId),inv=invoice(p.invoiceId),neg=Number(p.amount)<0;return `<div class="ops-tr ${p.status==='Đã hủy'?'is-cancelled':''}"><div><b>${esc(p.code)}</b><small>${fmtDateTime(p.date)} • ${esc(p.status||'')}</small></div><div><b>${esc(c?.name||'Khách lẻ')}</b><small>${esc(inv?.code||'Không gắn hóa đơn')}</small></div><div><span class="badge ${p.status==='Đã hủy'?'red':neg?'orange':'green'}">${esc(p.method||'')}</span><small>${esc(p.note||'')}</small></div><div class="right"><b class="${neg?'danger-text':''}">${money(p.amount)}</b></div></div>`}).join('')||'<div class="empty">Không có giao dịch phù hợp.</div>'}</div>`;return `<div id="opsPaymentResults" class="list">${list.map(p=>{const c=customer(p.customerId),inv=invoice(p.invoiceId);return `<div class="item ${p.status==='Đã hủy'?'is-cancelled':''}"><div class="thumb">💵</div><div class="item-main"><b>${esc(p.code)}</b><div class="small muted">${fmtDateTime(p.date)} • ${esc(p.method||'')} • ${esc(p.status||'')}</div><div class="small muted">${esc(c?.name||'Khách lẻ')}${inv?` • ${esc(inv.code)}`:''}</div></div><b class="${Number(p.amount)<0?'danger-text':''}">${money(p.amount)}</b></div>`}).join('')||'<div class="empty">Không có giao dịch phù hợp.</div>'}</div>`}
  window.opsPaySearch=v=>{state.opsPayQ=v;const el=$('#opsPaymentResults');if(el)el.outerHTML=paymentRows()};
  window.opsPayMethod=v=>{state.opsPayMethod=v;render()};
  window.opsPayStatus=v=>{state.opsPayStatus=v;render()};
  window.opsPayPreset=v=>{state.opsPayPreset=v;render()};
  window.opsPayCustom=()=>{state.opsPayFrom=$('#opsPayFrom')?.value||'';state.opsPayTo=$('#opsPayTo')?.value||'';state.opsPayPreset='custom';render()};
  window.paymentsView=paymentsView=function(){ensureOps();const preset=state.opsPayPreset||'30';return `${topbar('Thu tiền & giao dịch','Thanh toán • công nợ • hoàn tiền')}<div class="content"><div class="ops-filterbar three"><div class="searchrow"><input value="${esc(state.opsPayQ||'')}" placeholder="Mã phiếu, khách, hóa đơn, ghi chú..." oninput="opsPaySearch(this.value)"></div><select onchange="opsPayMethod(this.value)"><option value="all">Tất cả phương thức</option>${['Tiền mặt','Chuyển khoản','Thẻ/POS'].map(x=>`<option ${state.opsPayMethod===x?'selected':''}>${x}</option>`).join('')}</select><select onchange="opsPayStatus(this.value)"><option value="all">Tất cả trạng thái</option>${VALID_PAYMENT_STATUS.map(x=>`<option ${state.opsPayStatus===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="ops-period"><div class="seg">${[['today','Hôm nay'],['7','7 ngày'],['30','30 ngày'],['all','Tất cả']].map(([v,l])=>`<button class="${preset===v?'active':''}" onclick="opsPayPreset('${v}')">${l}</button>`).join('')}</div><div class="ops-date-range"><input id="opsPayFrom" type="date" value="${esc(state.opsPayFrom||'')}"><span>đến</span><input id="opsPayTo" type="date" value="${esc(state.opsPayTo||'')}"><button class="btn ghost small" onclick="opsPayCustom()">Áp dụng</button></div></div>${paymentRows()}</div>${nav()}`};

  function renumberNewPayments(beforeIds,prefix='PT'){
    const now=new Date();for(const p of db.payments||[]){if(beforeIds.has(String(p.id)))continue;if(p.status==='Hoàn tiền'||Number(p.amount)<0){if(!String(p.code||'').startsWith('HT'))p.code=docCode('HT',db.payments,p.date||now)}else p.code=docCode(prefix,db.payments.filter(x=>String(x.id)!==String(p.id)),p.date||now)}
  }
  if(typeof baseFinishCheckout==='function')window.finishCheckout=function(){const before=new Set((db.payments||[]).map(x=>String(x.id))),beforeInv=(db.invoices||[]).length;const result=baseFinishCheckout.apply(this,arguments);if((db.invoices||[]).length>beforeInv){renumberNewPayments(before,'PT');saveDB();render()}return result};
  if(typeof baseSaveDebtPayment==='function')window.saveDebtPayment=function(){const before=new Set((db.payments||[]).map(x=>String(x.id)));const result=baseSaveDebtPayment.apply(this,arguments);renumberNewPayments(before,'PT');saveDB();render();return result};
  if(typeof baseFinishStockReceipt==='function')window.finishStockReceipt=function(){const before=new Set((db.stockReceipts||[]).map(x=>String(x.id)));const result=baseFinishStockReceipt.apply(this,arguments);const fresh=(db.stockReceipts||[]).filter(x=>!before.has(String(x.id)));for(const r of fresh){r.status='Đã nhập kho';r.cancelledAt=null;r.cancelReason=''}if(fresh.length){saveDB();render()}return result};

  function injectDocumentStandards(){if(state.screen!=='settings'||document.querySelector('#ops-doc-standard-card'))return;const content=document.querySelector('.content');if(!content)return;const card=document.createElement('div');card.id='ops-doc-standard-card';card.className='card';card.style.marginTop='12px';card.innerHTML=`<b>Quy ước mã chứng từ</b><div class="ops-code-grid"><div><span>HD</span><b>Hóa đơn bán hàng</b></div><div><span>NH</span><b>Phiếu nhập hàng</b></div><div><span>PT</span><b>Phiếu thu / thanh toán</b></div><div><span>HT</span><b>Hoàn tiền</b></div><div><span>TH</span><b>Trả hàng / đổi hàng</b></div><div><span>BH</span><b>Phiếu bảo hành</b></div></div><div class="small muted" style="margin-top:9px">Định dạng: XXDDMMYY-001. Số thứ tự lấy số lớn nhất trong ngày + 1 để tránh trùng khi chứng từ bị hủy.</div>`;content.appendChild(card)}

  window.modalView=modalView=function(){if(state.modal?.type==='stockReceiptDetail')return stockReceiptDetailModal(state.modal);if(state.modal?.type==='stockReceiptEdit')return stockReceiptEditModal(state.modal);return baseModalView()};
  window.render=render=function(){ensureOps();if(state.screen==='inventoryReconcile'){app.innerHTML=inventoryReconcileView()+modalView();return}baseRender();setTimeout(injectDocumentStandards,0)};
})();
