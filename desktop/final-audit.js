/* KPOS Final Business Audit - end-to-end data integrity review */
(function(){
  const baseRender=window.render;
  const baseModalView=window.modalView;

  function audit(){
    const errors=[],warnings=[],info=[];
    const add=(arr,area,msg,ref='')=>arr.push({area,msg,ref});
    const dup=(arr,key,label,area)=>{const map=new Map();for(const x of arr||[]){const v=String(x?.[key]||'').trim();if(!v)continue;(map.get(v)||map.set(v,[]).get(v)).push(x)}for(const [v,rows] of map)if(rows.length>1)add(errors,area,`${label} bị trùng: ${v}`,String(rows.length))};

    dup(db.products,'barcode','Barcode','Sản phẩm');
    dup(db.products,'sku','SKU','Sản phẩm');
    dup(db.imeis,'value','IMEI/Serial','IMEI');
    dup(db.suppliers||[],'code','Mã nhà cung cấp','Nhà cung cấp');

    const docs=[['Hóa đơn',db.invoices],['Phiếu nhập',db.stockReceipts],['Thanh toán',db.payments],['Trả/đổi',db.returns],['Bảo hành',db.warranties],['Kiểm kho',db.inventoryCounts||[]],['Điều chỉnh kho',db.adjustmentReceipts||[]]];
    const codeMap=new Map();
    for(const [type,rows] of docs)for(const r of rows||[]){const c=String(r.code||'').trim();if(!c)continue;if(!codeMap.has(c))codeMap.set(c,[]);codeMap.get(c).push(type)}
    for(const [c,types] of codeMap)if(types.length>1)add(errors,'Chứng từ',`Mã chứng từ trùng ${c}`,types.join(', '));

    for(const p of db.products||[]){
      if((Number(p.stock)||0)<0)add(errors,'Kho',`${p.name}: tồn kho âm`,String(p.stock));
      const moves=(db.inventoryMovements||[]).filter(m=>m.productId===p.id);
      const ledger=moves.reduce((a,m)=>a+(Number(m.qty)||0),0);
      if(Math.round(ledger)!==Math.round(Number(p.stock)||0))add(warnings,'Kho',`${p.name}: sổ kho ${ledger} khác tồn ${p.stock}`,'Đối soát kho');
      if(p.imeiEnabled){const count=(db.imeis||[]).filter(i=>i.productId===p.id&&i.status==='Trong kho').length;if(count!==Number(p.stock||0))add(errors,'IMEI',`${p.name}: tồn ${p.stock} nhưng có ${count} IMEI trong kho`,'Cần xử lý IMEI cụ thể')}
      if((Number(p.stock)||0)<=(Number(p.minStock)||0))add(info,'Cảnh báo tồn',`${p.name}: tồn ${p.stock} / tối thiểu ${p.minStock}`,'Sắp hết hàng');
    }

    for(const im of db.imeis||[]){
      if(!product(im.productId))add(errors,'IMEI',`${im.value}: mất liên kết sản phẩm`,'');
      if(im.customerId&&!customer(im.customerId))add(errors,'IMEI',`${im.value}: mất liên kết khách hàng`,'');
      if(im.invoiceId&&!invoice(im.invoiceId))add(errors,'IMEI',`${im.value}: mất liên kết hóa đơn`,'');
      if(im.status==='Trong kho'&&(im.customerId||im.invoiceId))add(warnings,'IMEI',`${im.value}: Trong kho nhưng còn liên kết bán hàng`,'');
    }

    for(const inv of db.invoices||[]){
      if(inv.customerId&&!customer(inv.customerId))add(errors,'Hóa đơn',`${inv.code}: không tìm thấy khách hàng`,'');
      for(const it of inv.items||[])if(!product(it.productId))add(errors,'Hóa đơn',`${inv.code}: có sản phẩm không còn tồn tại`,String(it.productId));
      const activeReturns=(db.returns||[]).filter(r=>r.invoiceId===inv.id&&r.status!=='Đã hủy');
      const ret=activeReturns.reduce((a,r)=>a+(Number(r.amount)||0),0);
      if(Math.abs(ret-(Number(inv.returnedAmount)||0))>.5)add(warnings,'Trả hàng',`${inv.code}: returnedAmount ${money(inv.returnedAmount||0)} khác phiếu trả ${money(ret)}`,'Có thể sửa an toàn');
      if((Number(inv.debt)||0)<0)add(errors,'Công nợ',`${inv.code}: công nợ âm`,money(inv.debt));
    }

    for(const r of db.stockReceipts||[]){
      if(r.supplierId&&!(db.suppliers||[]).some(s=>String(s.id)===String(r.supplierId)))add(warnings,'Nhập hàng',`${r.code}: nhà cung cấp không còn tồn tại`,String(r.supplierId));
      for(const it of r.items||[]){const p=product(it.productId);if(!p)add(errors,'Nhập hàng',`${r.code}: sản phẩm không còn tồn tại`,String(it.productId));if(Number(it.buyPrice)<0)add(errors,'Giá nhập',`${r.code}: giá nhập âm`,String(it.buyPrice))}
    }
    for(const h of db.costHistory||[]){if(!product(h.productId))add(warnings,'Giá vốn','Lịch sử giá vốn mất liên kết sản phẩm',String(h.receiptCode||''));if((Number(h.buyPrice)||0)<0)add(errors,'Giá vốn','Giá nhập âm trong lịch sử',String(h.receiptCode||''))}
    for(const a of db.adjustmentReceipts||[])for(const it of a.items||[])if(!product(it.productId))add(errors,'Điều chỉnh kho',`${a.code}: mất sản phẩm`,String(it.productId));
    for(const k of db.inventoryCounts||[])for(const it of k.items||[])if(!product(it.productId))add(warnings,'Kiểm kho',`${k.code}: mất sản phẩm`,String(it.productId));
    for(const c of db.customers||[])if((Number(c.debt)||0)<0)add(errors,'Khách hàng',`${c.name}: công nợ âm`,money(c.debt));

    if(window.KPOS_CLOUD){const c=window.KPOS_CLOUD;if(c.configured&&!c.user)add(warnings,'Đồng bộ','Supabase đã cấu hình nhưng chưa đăng nhập','');if(c.user&&c.status==='Lỗi đồng bộ')add(errors,'Đồng bộ','Đang có lỗi đồng bộ Supabase',c.lastError||'');if(c.user&&c.status==='Đã đồng bộ')add(info,'Đồng bộ','Supabase đang đồng bộ bình thường',`revision ${c.revision||0}`)}
    return {time:new Date().toISOString(),errors,warnings,info,summary:{errors:errors.length,warnings:warnings.length,info:info.length,products:(db.products||[]).length,invoices:(db.invoices||[]).length,imeis:(db.imeis||[]).length,suppliers:(db.suppliers||[]).length}};
  }
  window.KPOS_FINAL_AUDIT=audit;
  window.runFinalBusinessAudit=()=>{state.modal={type:'finalBusinessAudit',report:audit()};render()};
  window.fixFinalAuditSafe=()=>{let changed=0;(db.customers||[]).forEach(c=>{const v=Math.max(0,Number(c.debt)||0);if(v!==c.debt){c.debt=v;changed++}});(db.invoices||[]).forEach(inv=>{const ret=(db.returns||[]).filter(r=>r.invoiceId===inv.id&&r.status!=='Đã hủy').reduce((a,r)=>a+(Number(r.amount)||0),0);if(Math.abs((Number(inv.returnedAmount)||0)-ret)>.5){inv.returnedAmount=ret;changed++}});(db.products||[]).forEach(p=>{if(p.imeiEnabled){const count=(db.imeis||[]).filter(i=>i.productId===p.id&&i.status==='Trong kho').length;if(Number(p.stock)!==count){/* deliberately not auto-fixing IMEI stock */}}});if(changed)saveDB();state.modal={type:'finalBusinessAudit',report:audit()};render();toast(changed?`Đã sửa an toàn ${changed} mục`:'Không có mục an toàn cần sửa')};
  window.exportFinalAudit=()=>{const report=state.modal?.report||audit(),blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`KPOS-Final-Audit-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)};

  function auditModal(m){const r=m.report,group=(title,rows,cls)=>`<div class="section-title">${title} (${rows.length})</div><div class="list">${rows.map(x=>`<div class="item"><div class="item-main"><b>${esc(x.area)}</b><div>${esc(x.msg)}</div>${x.ref?`<div class="small muted">${esc(x.ref)}</div>`:''}</div><span class="badge ${cls}">${title}</span></div>`).join('')||'<div class="empty">Không có.</div>'}</div>`;return sheet('Rà soát nghiệp vụ lần cuối',`<div class="info-grid"><div class="info-box"><div class="k">LỖI</div><div class="v danger-text">${r.errors.length}</div></div><div class="info-box"><div class="k">CẢNH BÁO</div><div class="v">${r.warnings.length}</div></div><div class="info-box"><div class="k">THÔNG TIN</div><div class="v">${r.info.length}</div></div><div class="info-box"><div class="k">THỜI ĐIỂM</div><div class="v">${fmtDateTime(r.time)}</div></div></div>${group('Lỗi',r.errors,'red')}${group('Cảnh báo',r.warnings,'orange')}${group('Thông tin',r.info,'green')}<div class="split-buttons" style="margin-top:12px"><button class="btn ghost" onclick="exportFinalAudit()">Xuất JSON</button><button class="btn primary" onclick="fixFinalAuditSafe()">Sửa an toàn</button></div>`)}
  window.modalView=modalView=function(){if(state.modal?.type==='finalBusinessAudit')return auditModal(state.modal);return baseModalView()};

  function injectSettings(){if(state.screen!=='settings'||document.querySelector('#final-business-audit-card'))return;const content=document.querySelector('.content');if(!content)return;const card=document.createElement('div');card.id='final-business-audit-card';card.className='card';card.style.marginTop='12px';card.innerHTML=`<div class="row-between"><div><b>✅ Rà soát nghiệp vụ lần cuối</b><div class="small muted">Kiểm tra chứng từ • kho • IMEI • giá vốn • trả hàng • công nợ • đồng bộ</div></div><button class="btn primary small" onclick="runFinalBusinessAudit()">CHẠY KIỂM TRA</button></div>`;content.appendChild(card)}
  window.render=render=function(){baseRender();setTimeout(injectSettings,0)};
})();
