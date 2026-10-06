/* KPOS Warranty V2 - intake, service workflow, timeline, print enrichment */
(function(){
  const STATUS=['Mới tiếp nhận','Đang kiểm tra','Đang sửa','Chờ linh kiện','Hoàn thành','Đã trả khách','Hủy'];
  const CLOSED=new Set(['Đã trả khách','Hủy']);
  const baseModalView=window.modalView;
  const baseRenderPrintContent=window.renderPrintContent;

  function normalize(){
    db.warranties=db.warranties||[];
    for(const w of db.warranties){
      if(!w.status)w.status='Mới tiếp nhận';
      if(!Array.isArray(w.timeline))w.timeline=[];
      if(w.condition==null)w.condition='';
      if(w.accessories==null)w.accessories='';
      if(w.technician==null)w.technician='';
      if(w.diagnosis==null)w.diagnosis='';
      if(w.handling==null)w.handling='';
      if(w.note==null)w.note='';
      if(w.promisedAt==null)w.promisedAt='';
      if(w.receivedAt==null)w.receivedAt=w.date||'';
      if(w.completedAt==null)w.completedAt='';
      if(w.returnedAt==null)w.returnedAt='';
    }
  }
  normalize();

  state.w2Query=state.w2Query||'';
  state.w2Status=state.w2Status||'all';
  state.w2Time=state.w2Time||'all';

  const warranty=id=>(db.warranties||[]).find(w=>String(w.id)===String(id));
  const isOverdue=w=>!!w.promisedAt&&!CLOSED.has(w.status)&&w.status!=='Hoàn thành'&&new Date(w.promisedAt)<new Date();
  const statusTone=s=>s==='Đã trả khách'?'green':s==='Hoàn thành'?'green':s==='Hủy'?'red':s==='Chờ linh kiện'?'orange':'orange';
  const fmtLocal=v=>{if(!v)return '';const d=new Date(v),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`};
  const safeDate=v=>{try{return v?new Date(v).toISOString():''}catch(e){return ''}};

  function hydratePreserve(d,imeiValue){
    const keep={customerName:d.customerName,phone:d.phone,issue:d.issue,condition:d.condition,accessories:d.accessories,technician:d.technician,diagnosis:d.diagnosis,handling:d.handling,note:d.note,promisedAt:d.promisedAt,status:d.status};
    if(typeof hydrateWarrantyDraft==='function')hydrateWarrantyDraft(d,imeiValue);
    for(const [k,v] of Object.entries(keep))if(v)d[k]=v;
    const im=(db.imeis||[]).find(i=>String(i.value||'').toLowerCase()===String(imeiValue||'').toLowerCase());
    if(im){
      d.customerId=im.customerId||d.customerId||null;
      d.invoiceId=im.invoiceId||d.invoiceId||null;
      const p=product(im.productId),c=customer(im.customerId),inv=invoice(im.invoiceId);
      d.productName=p?.name||d.productName||'';d.invoiceCode=inv?.code||d.invoiceCode||'';
      if(!d.customerName)d.customerName=c?.name||'';if(!d.phone)d.phone=c?.phone||'';
      d.warrantyText=im.warrantyEnd?`Bảo hành đến ${fmtDate(im.warrantyEnd)}`:(d.warrantyText||'Chưa có thời hạn bảo hành');
    }
  }

  function filterList(){
    normalize();const q=String(state.w2Query||'').trim().toLowerCase(),now=new Date();
    return [...db.warranties].filter(w=>{
      const hay=[w.code,w.imei,w.customerName,w.phone,w.productName,w.invoiceCode,w.issue,w.condition,w.accessories,w.technician,w.diagnosis,w.handling,w.note,w.status].join(' ').toLowerCase();
      if(q&&!hay.includes(q))return false;
      if(state.w2Status==='overdue'&&!isOverdue(w))return false;
      if(state.w2Status!=='all'&&state.w2Status!=='overdue'&&w.status!==state.w2Status)return false;
      if(state.w2Time!=='all'){
        const d=new Date(w.receivedAt||w.date||0),start=new Date(now);start.setHours(0,0,0,0);
        if(state.w2Time==='today'&&d<start)return false;
        if(state.w2Time==='7'){start.setDate(start.getDate()-6);if(d<start)return false}
        if(state.w2Time==='30'){start.setDate(start.getDate()-29);if(d<start)return false}
      }
      return true;
    }).sort((a,b)=>new Date(b.receivedAt||b.date||0)-new Date(a.receivedAt||a.date||0));
  }

  function summary(){
    const all=db.warranties||[];
    return {total:all.length,new:all.filter(w=>w.status==='Mới tiếp nhận').length,working:all.filter(w=>['Đang kiểm tra','Đang sửa','Chờ linh kiện'].includes(w.status)).length,overdue:all.filter(isOverdue).length,done:all.filter(w=>w.status==='Hoàn thành').length,returned:all.filter(w=>w.status==='Đã trả khách').length};
  }

  function desktopRows(list){
    return `<div class="w2-table"><div class="w2-tr head"><div>Phiếu / IMEI</div><div>Khách hàng / sản phẩm</div><div>Lỗi & xử lý</div><div>Hẹn trả / kỹ thuật</div><div>Trạng thái</div><div></div></div>${list.map(w=>`<div class="w2-tr ${isOverdue(w)?'is-overdue':''}"><div><b>${esc(w.code||'')}</b><small class="mono">${esc(w.imei||'')}</small><small>${fmtDateTime(w.receivedAt||w.date)}</small></div><div><b>${esc(w.customerName||'Khách lẻ')}</b><small>${esc(w.phone||'')}</small><small>${esc(w.productName||'')}</small></div><div><b>${esc(w.issue||'Chưa ghi lỗi')}</b><small>${esc(w.diagnosis||w.handling||'Chưa cập nhật kỹ thuật')}</small></div><div><b class="${isOverdue(w)?'danger-text':''}">${w.promisedAt?fmtDateTime(w.promisedAt):'Chưa hẹn'}</b><small>${esc(w.technician||'Chưa phân công')}</small></div><div><span class="badge ${statusTone(w.status)}">${esc(w.status)}</span>${isOverdue(w)?'<small class="danger-text">Quá hẹn</small>':''}</div><div class="right"><button class="btn ghost small" onclick="openWarrantyDetail(${JSON.stringify(w.id)})">Xem</button></div></div>`).join('')||'<div class="empty">Không có phiếu bảo hành phù hợp.</div>'}</div>`;
  }
  function mobileRows(list){
    return `<div class="w2-mobile-list">${list.map(w=>`<button onclick="openWarrantyDetail(${JSON.stringify(w.id)})" class="${isOverdue(w)?'is-overdue':''}"><span><b>${esc(w.code||'')}</b><small class="mono">${esc(w.imei||'')}</small><small>${esc(w.customerName||'Khách lẻ')} • ${esc(w.productName||'')}</small><em>${esc(w.issue||'Chưa ghi lỗi')}</em></span><span class="right"><span class="badge ${statusTone(w.status)}">${esc(w.status)}</span><small class="${isOverdue(w)?'danger-text':''}">${w.promisedAt?fmtDate(w.promisedAt):'Chưa hẹn'}</small></span></button>`).join('')||'<div class="empty">Không có phiếu bảo hành phù hợp.</div>'}</div>`;
  }

  window.setWarrantyV2Status=v=>{state.w2Status=v;render()};
  window.setWarrantyV2Time=v=>{state.w2Time=v;render()};
  window.filterWarrantyV2=()=>{state.w2Query=$('#w2Search')?.value||'';const el=$('#w2List');if(el)el.innerHTML=matchMedia('(min-width:980px)').matches?desktopRows(filterList()):mobileRows(filterList())};
  window.openWarrantyBySearch=()=>{
    const q=String($('#w2Search')?.value||state.w2Query||'').trim();if(!q)return;
    const exact=(db.warranties||[]).find(w=>String(w.code||'').toLowerCase()===q.toLowerCase()||String(w.imei||'').toLowerCase()===q.toLowerCase());
    if(exact)return openWarrantyDetail(exact.id);
    const im=(db.imeis||[]).find(i=>String(i.value||'').toLowerCase()===q.toLowerCase());
    if(im)return openWarrantyForm(im.value);
    toast('Không tìm thấy phiếu hoặc IMEI/Serial');
  };

  window.warrantyView=warrantyView=function(){
    normalize();const s=summary(),list=filterList();
    const filters=[['all','Tất cả'],['Mới tiếp nhận','Mới tiếp nhận'],['Đang kiểm tra','Đang kiểm tra'],['Đang sửa','Đang sửa'],['Chờ linh kiện','Chờ linh kiện'],['Hoàn thành','Hoàn thành'],['Đã trả khách','Đã trả khách'],['overdue','Quá hẹn'],['Hủy','Hủy']];
    return `${topbar('Bảo hành','Tra IMEI • tiếp nhận • kỹ thuật xử lý • hẹn trả • timeline')}<div class="content w2-page">
      <div class="w2-kpis"><div><span>Tổng phiếu</span><b>${s.total}</b></div><div><span>Mới tiếp nhận</span><b>${s.new}</b></div><div><span>Đang xử lý</span><b>${s.working}</b></div><div class="${s.overdue?'warn':''}"><span>Quá hẹn</span><b>${s.overdue}</b></div><div><span>Hoàn thành</span><b>${s.done}</b></div><div><span>Đã trả khách</span><b>${s.returned}</b></div></div>
      <div class="w2-toolbar"><div class="w2-search"><input id="w2Search" value="${esc(state.w2Query||'')}" placeholder="Mã phiếu / IMEI / SĐT / khách / sản phẩm / lỗi..." oninput="filterWarrantyV2()" onkeydown="if(event.key==='Enter')openWarrantyBySearch()"><button class="btn accent" onclick="openScanner('warrantySearch')">📷 Quét IMEI</button><button class="btn ghost" onclick="openWarrantyBySearch()">Tra</button></div><button class="btn primary" onclick="openWarrantyForm()">＋ Tiếp nhận bảo hành</button></div>
      <div class="w2-filterbar"><div class="w2-statuses">${filters.map(([v,l])=>`<button class="${state.w2Status===v?'active':''}" onclick="setWarrantyV2Status('${v}')">${l}</button>`).join('')}</div><select onchange="setWarrantyV2Time(this.value)"><option value="all" ${state.w2Time==='all'?'selected':''}>Tất cả thời gian</option><option value="today" ${state.w2Time==='today'?'selected':''}>Hôm nay</option><option value="7" ${state.w2Time==='7'?'selected':''}>7 ngày</option><option value="30" ${state.w2Time==='30'?'selected':''}>30 ngày</option></select><em>${list.length} phiếu</em></div>
      <div id="w2List">${matchMedia('(min-width:980px)').matches?desktopRows(list):mobileRows(list)}</div>
    </div>${nav()}`;
  };

  window.openWarrantyForm=(imeiValue='')=>{
    const draft={imei:imeiValue,customerId:null,invoiceId:null,customerName:'',phone:'',issue:'',condition:'',accessories:'',technician:'',diagnosis:'',handling:'',promisedAt:'',note:'',status:'Mới tiếp nhận',productName:'',invoiceCode:'',warrantyText:''};
    if(imeiValue)hydratePreserve(draft,imeiValue);
    state.modal={type:'w2Form',draft};render();
  };
  window.lookupWarrantyV2Imei=()=>{
    const d=state.modal?.draft;if(!d)return;d.imei=$('#w2f_imei')?.value.trim()||'';hydratePreserve(d,d.imei);render();
  };
  window.saveWarrantyV2=()=>{
    const d=state.modal?.draft;if(!d)return;
    d.imei=$('#w2f_imei')?.value.trim()||'';d.customerName=$('#w2f_customer')?.value.trim()||'';d.phone=$('#w2f_phone')?.value.trim()||'';d.issue=$('#w2f_issue')?.value.trim()||'';d.condition=$('#w2f_condition')?.value.trim()||'';d.accessories=$('#w2f_accessories')?.value.trim()||'';d.technician=$('#w2f_technician')?.value.trim()||'';d.promisedAt=safeDate($('#w2f_promised')?.value);d.note=$('#w2f_note')?.value.trim()||'';
    if(!d.imei)return toast('Nhập hoặc quét IMEI / Serial');if(!d.issue)return toast('Nhập lỗi khách báo');
    const im=(db.imeis||[]).find(i=>String(i.value||'').toLowerCase()===d.imei.toLowerCase());if(!im)return toast('IMEI / Serial chưa có trong hệ thống');
    const active=(db.warranties||[]).find(w=>String(w.imei||'').toLowerCase()===d.imei.toLowerCase()&&!CLOSED.has(w.status));if(active)return toast(`IMEI đang có phiếu ${active.code} chưa kết thúc`);
    hydratePreserve(d,d.imei);
    const now=new Date().toISOString(),w={...d,id:Date.now(),code:code('BH',db.warranties),date:now,receivedAt:now,completedAt:'',returnedAt:'',timeline:[{date:now,status:'Mới tiếp nhận',title:'Tiếp nhận bảo hành',note:d.issue,technician:d.technician||''}]};
    db.warranties.unshift(w);im.status='Bảo hành';addActivity(`Tiếp nhận bảo hành ${w.code}`);saveDB();state.modal=null;state.screen='warranty';render();toast('Đã tạo phiếu bảo hành');
  };

  window.openWarrantyDetail=id=>{const w=warranty(id);if(!w)return toast('Không tìm thấy phiếu bảo hành');state.modal={type:'w2Detail',warrantyId:w.id};render()};
  window.saveWarrantyWork=id=>{
    const w=warranty(id);if(!w)return;
    const old={status:w.status,technician:w.technician,diagnosis:w.diagnosis,handling:w.handling,promisedAt:w.promisedAt,note:w.note};
    w.technician=$('#w2d_technician')?.value.trim()||'';w.diagnosis=$('#w2d_diagnosis')?.value.trim()||'';w.handling=$('#w2d_handling')?.value.trim()||'';w.promisedAt=safeDate($('#w2d_promised')?.value);w.note=$('#w2d_note')?.value.trim()||'';w.status=$('#w2d_status')?.value||w.status;
    const progress=$('#w2d_progress')?.value.trim()||'';
    const changed=old.status!==w.status||old.technician!==w.technician||old.diagnosis!==w.diagnosis||old.handling!==w.handling||old.promisedAt!==w.promisedAt||old.note!==w.note||progress;
    if(!changed)return toast('Chưa có thay đổi');
    const now=new Date().toISOString();w.timeline=w.timeline||[];w.timeline.unshift({date:now,status:w.status,title:old.status!==w.status?`Chuyển trạng thái: ${old.status} → ${w.status}`:'Cập nhật xử lý',note:progress||w.handling||w.diagnosis||w.note||'Đã cập nhật phiếu',technician:w.technician||''});
    if(w.status==='Hoàn thành'&&!w.completedAt)w.completedAt=now;if(w.status==='Đã trả khách'&&!w.returnedAt)w.returnedAt=now;
    const im=(db.imeis||[]).find(i=>String(i.value||'')===String(w.imei||''));if(im)im.status=['Hoàn thành','Đã trả khách','Hủy'].includes(w.status)?'Đã bán':'Bảo hành';
    addActivity(`Bảo hành ${w.code} • ${w.status}`);saveDB();state.modal={type:'w2Detail',warrantyId:w.id};render();toast('Đã lưu cập nhật bảo hành');
  };
  window.quickWarrantyStatus=(id,status)=>{const w=warranty(id);if(!w)return;const el=$('#w2d_status');if(el)el.value=status;saveWarrantyWork(id)};

  function intakeForm(m){const d=m.draft;return sheet('Tiếp nhận bảo hành',`<div class="w2-form">
    <div class="field full"><label>IMEI / Serial *</label><div class="searchrow" style="margin:0"><input id="w2f_imei" class="mono" value="${esc(d.imei||'')}" onchange="lookupWarrantyV2Imei()"><button class="btn accent" onclick="openScanner('warrantyForm')">📷</button><button class="btn ghost" onclick="lookupWarrantyV2Imei()">Tra</button></div></div>
    ${d.productName?`<div class="w2-device full"><div><span>Sản phẩm</span><b>${esc(d.productName)}</b></div><div><span>Hóa đơn</span><b>${esc(d.invoiceCode||'Không có')}</b></div><div><span>Bảo hành</span><b>${esc(d.warrantyText||'')}</b></div></div>`:''}
    <div class="field"><label>Khách hàng</label><input id="w2f_customer" value="${esc(d.customerName||'')}"></div><div class="field"><label>Số điện thoại</label><input id="w2f_phone" value="${esc(d.phone||'')}"></div>
    <div class="field full"><label>Lỗi khách báo *</label><textarea id="w2f_issue" rows="3" placeholder="Mô tả lỗi khách phản ánh...">${esc(d.issue||'')}</textarea></div>
    <div class="field"><label>Tình trạng máy khi nhận</label><textarea id="w2f_condition" rows="3" placeholder="Ngoại hình, nguồn, màn hình...">${esc(d.condition||'')}</textarea></div><div class="field"><label>Phụ kiện kèm theo</label><textarea id="w2f_accessories" rows="3" placeholder="Sạc, cáp, hộp, adapter...">${esc(d.accessories||'')}</textarea></div>
    <div class="field"><label>Kỹ thuật phụ trách</label><input id="w2f_technician" value="${esc(d.technician||'')}" placeholder="Tên kỹ thuật viên"></div><div class="field"><label>Hẹn trả dự kiến</label><input id="w2f_promised" type="datetime-local" value="${fmtLocal(d.promisedAt)}"></div>
    <div class="field full"><label>Ghi chú nội bộ</label><textarea id="w2f_note" rows="2">${esc(d.note||'')}</textarea></div>
  </div><div class="w2-form-actions"><button class="btn ghost" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveWarrantyV2()">TẠO PHIẾU BẢO HÀNH</button></div>`)}

  function detailModal(m){
    const w=warranty(m.warrantyId);if(!w)return sheet('Phiếu bảo hành','<div class="empty">Không tìm thấy phiếu.</div>');
    const im=(db.imeis||[]).find(i=>String(i.value||'')===String(w.imei||'')),inv=im?invoice(im.invoiceId):null,c=im?customer(im.customerId):null;
    return sheet(w.code||'Phiếu bảo hành',`<div class="w2-detail-head"><div><span>IMEI / SERIAL</span><b class="mono">${esc(w.imei||'')}</b><small>${esc(w.productName||product(im?.productId)?.name||'')}</small></div><div class="right"><span class="badge ${statusTone(w.status)}">${esc(w.status)}</span>${isOverdue(w)?'<small class="danger-text">Quá hẹn trả khách</small>':''}</div></div>
      <div class="w2-detail-kpis"><div><span>Tiếp nhận</span><b>${fmtDateTime(w.receivedAt||w.date)}</b></div><div><span>Hẹn trả</span><b class="${isOverdue(w)?'danger-text':''}">${w.promisedAt?fmtDateTime(w.promisedAt):'Chưa hẹn'}</b></div><div><span>Khách hàng</span><b>${esc(w.customerName||c?.name||'Khách lẻ')}</b><small>${esc(w.phone||c?.phone||'')}</small></div><div><span>Hóa đơn</span><b>${esc(w.invoiceCode||inv?.code||'—')}</b></div></div>
      <div class="w2-intake"><div><span>Lỗi khách báo</span><b>${esc(w.issue||'—')}</b></div><div><span>Tình trạng khi nhận</span><b>${esc(w.condition||'—')}</b></div><div><span>Phụ kiện kèm theo</span><b>${esc(w.accessories||'—')}</b></div><div><span>Ghi chú nội bộ</span><b>${esc(w.note||'—')}</b></div></div>
      <div class="section-title">Kỹ thuật xử lý</div><div class="w2-work-grid"><div class="field"><label>Kỹ thuật phụ trách</label><input id="w2d_technician" value="${esc(w.technician||'')}"></div><div class="field"><label>Hẹn trả</label><input id="w2d_promised" type="datetime-local" value="${fmtLocal(w.promisedAt)}"></div><div class="field full"><label>Chẩn đoán / nguyên nhân</label><textarea id="w2d_diagnosis" rows="2">${esc(w.diagnosis||'')}</textarea></div><div class="field full"><label>Cách xử lý / linh kiện thay thế</label><textarea id="w2d_handling" rows="3">${esc(w.handling||'')}</textarea></div><div class="field"><label>Trạng thái</label><select id="w2d_status">${STATUS.map(s=>`<option ${s===w.status?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label>Ghi chú nội bộ</label><input id="w2d_note" value="${esc(w.note||'')}"></div><div class="field full"><label>Nội dung cập nhật timeline</label><input id="w2d_progress" placeholder="VD: Đã kiểm tra nguồn, chờ linh kiện..."></div></div>
      <div class="w2-detail-actions"><button class="btn primary" onclick="saveWarrantyWork(${JSON.stringify(w.id)})">LƯU CẬP NHẬT</button>${w.status!=='Hoàn thành'&&!CLOSED.has(w.status)?`<button class="btn success" onclick="quickWarrantyStatus(${JSON.stringify(w.id)},'Hoàn thành')">✓ Hoàn thành</button>`:''}${w.status==='Hoàn thành'?`<button class="btn success" onclick="quickWarrantyStatus(${JSON.stringify(w.id)},'Đã trả khách')">✓ Đã trả khách</button>`:''}<button class="btn ghost" onclick="previewTemplate('warranty_k80','warranty',${JSON.stringify(w.id)})">K80</button><button class="btn ghost" onclick="previewTemplate('warranty_a4','warranty',${JSON.stringify(w.id)})">A4</button></div>
      <div class="section-title">Timeline xử lý</div><div class="w2-timeline">${(w.timeline||[]).map(t=>`<div><i></i><span><b>${esc(t.title||t.status||'Cập nhật')}</b><small>${fmtDateTime(t.date)}${t.technician?` • ${esc(t.technician)}`:''}</small><em>${esc(t.note||'')}</em></span></div>`).join('')||'<div class="empty">Chưa có cập nhật.</div>'}</div>`);
  }

  window.modalView=modalView=function(){
    if(state.modal?.type==='w2Form')return intakeForm(state.modal);
    if(state.modal?.type==='w2Detail')return detailModal(state.modal);
    return baseModalView();
  };

  window.renderPrintContent=renderPrintContent=function(tpl,doc){
    const html=baseRenderPrintContent?baseRenderPrintContent(tpl,doc):'';
    if(tpl?.docType!=='warranty'||!doc)return html;
    const extras=[['Tình trạng khi nhận',doc.condition],['Phụ kiện kèm theo',doc.accessories],['Kỹ thuật phụ trách',doc.technician],['Chẩn đoán',doc.diagnosis],['Xử lý kỹ thuật',doc.handling],['Hẹn trả',doc.promisedAt?fmtDateTime(doc.promisedAt):''],['Trạng thái',doc.status],['Ghi chú',doc.note]].filter(x=>x[1]);
    if(!extras.length)return html;
    return `${html}<div class="w2-print-extra" style="margin-top:10px;border-top:1px dashed #999;padding-top:8px">${extras.map(([k,v])=>`<div style="display:flex;justify-content:space-between;gap:12px;margin:4px 0"><span>${esc(k)}</span><b style="text-align:right">${esc(String(v))}</b></div>`).join('')}</div>`;
  };
})();
