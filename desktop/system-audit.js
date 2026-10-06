/* KPOS System Audit Pack - end-to-end consistency checks and safe repairs */
(function(){
  const finalRender=window.render;
  let lastReport=null;

  const arr=name=>Array.isArray(db[name])?db[name]:[];
  const n=v=>Number(v)||0;
  function add(list,severity,title,detail,ref=''){list.push({severity,title,detail,ref})}

  function audit(){
    const issues=[];
    const products=arr('products'),imeis=arr('imeis'),invoices=arr('invoices'),returns=arr('returns'),payments=arr('payments'),customers=arr('customers'),warranties=arr('warranties');
    const productIds=new Set(products.map(x=>String(x.id))),invoiceIds=new Set(invoices.map(x=>String(x.id))),customerIds=new Set(customers.map(x=>String(x.id)));

    const barcodes=new Map();
    products.forEach(p=>{
      if(n(p.stock)<0)add(issues,'critical','Tồn kho âm',`${p.name||p.sku||p.id}: ${p.stock}`,String(p.id));
      const bc=String(p.barcode||'').trim();if(bc){if(barcodes.has(bc))add(issues,'critical','Trùng barcode',`${bc} đang thuộc nhiều sản phẩm`,bc);else barcodes.set(bc,p.id)}
      if(p.imeiEnabled){const available=imeis.filter(i=>String(i.productId)===String(p.id)&&i.status==='Trong kho').length;if(available!==n(p.stock))add(issues,'warning','Tồn kho khác số IMEI trong kho',`${p.name}: tồn ${p.stock}, IMEI trong kho ${available}`,String(p.id))}
    });

    const imeiValues=new Map();
    imeis.forEach(i=>{
      const v=String(i.value||'').trim();if(!v)add(issues,'critical','IMEI/Serial rỗng','Có bản ghi IMEI không có mã',String(i.id));
      else if(imeiValues.has(v))add(issues,'critical','Trùng IMEI/Serial',v,v);else imeiValues.set(v,i.id);
      if(!productIds.has(String(i.productId)))add(issues,'critical','IMEI mất liên kết sản phẩm',v||String(i.id),String(i.id));
      if(i.customerId!=null&&!customerIds.has(String(i.customerId)))add(issues,'warning','IMEI mất liên kết khách hàng',v,String(i.id));
      if(i.invoiceId!=null&&!invoiceIds.has(String(i.invoiceId)))add(issues,'warning','IMEI mất liên kết hóa đơn',v,String(i.id));
    });

    invoices.forEach(inv=>{
      if(n(inv.total)<0||n(inv.debt)<0||n(inv.returnedAmount)<0)add(issues,'critical','Giá trị hóa đơn không hợp lệ',`${inv.code}: tổng ${inv.total}, nợ ${inv.debt}, đã trả ${inv.returnedAmount}`,String(inv.id));
      if(n(inv.returnedAmount)>n(inv.total)+1)add(issues,'critical','Trả hàng vượt tổng hóa đơn',`${inv.code}: ${inv.returnedAmount} > ${inv.total}`,String(inv.id));
      (inv.items||[]).forEach((it,idx)=>{
        if(!productIds.has(String(it.productId)))add(issues,'critical','Hóa đơn có sản phẩm đã mất',`${inv.code} • dòng ${idx+1}`,String(inv.id));
        if(n(it.qty)<=0)add(issues,'warning','Số lượng hóa đơn không hợp lệ',`${inv.code} • dòng ${idx+1}: ${it.qty}`,String(inv.id));
        (it.imeis||[]).forEach(iid=>{if(!imeis.some(x=>String(x.id)===String(iid)))add(issues,'warning','Hóa đơn tham chiếu IMEI không tồn tại',`${inv.code} • IMEI id ${iid}`,String(inv.id))});
      });
    });

    returns.forEach(r=>{
      if(!invoiceIds.has(String(r.invoiceId)))add(issues,'critical','Phiếu trả/đổi mất hóa đơn gốc',`${r.code||r.id}`,String(r.id));
      if(r.status!=='Đã hủy'&&n(r.amount)<=0)add(issues,'warning','Phiếu trả/đổi có giá trị không hợp lệ',`${r.code||r.id}: ${r.amount}`,String(r.id));
      if(r.customerId!=null&&!customerIds.has(String(r.customerId)))add(issues,'warning','Phiếu trả/đổi mất khách hàng',`${r.code||r.id}`,String(r.id));
    });

    payments.forEach(p=>{
      if(p.invoiceId!=null&&!invoiceIds.has(String(p.invoiceId)))add(issues,'warning','Thanh toán mất hóa đơn liên kết',`${p.code||p.id}`,String(p.id));
      if(p.customerId!=null&&!customerIds.has(String(p.customerId)))add(issues,'warning','Thanh toán mất khách hàng liên kết',`${p.code||p.id}`,String(p.id));
    });

    customers.forEach(c=>{
      if(n(c.debt)<0)add(issues,'critical','Công nợ khách âm',`${c.name}: ${c.debt}`,String(c.id));
      if(n(c.points)<0)add(issues,'warning','Điểm khách âm',`${c.name}: ${c.points}`,String(c.id));
    });

    warranties.forEach(w=>{
      if(w.imei&&!imeiValues.has(String(w.imei)))add(issues,'warning','Phiếu bảo hành chưa liên kết IMEI trong kho dữ liệu',`${w.code||w.id} • ${w.imei}`,String(w.id));
    });

    const activeReturns=returns.filter(r=>r.status!=='Đã hủy');
    invoices.forEach(inv=>{
      const sum=activeReturns.filter(r=>String(r.invoiceId)===String(inv.id)).reduce((s,r)=>s+n(r.amount),0);
      if(Math.abs(sum-n(inv.returnedAmount))>1)add(issues,'warning','returnedAmount lệch lịch sử trả/đổi',`${inv.code}: hóa đơn ${n(inv.returnedAmount)}, phiếu ${sum}`,String(inv.id));
    });

    const summary={products:products.length,imeis:imeis.length,invoices:invoices.length,returns:returns.length,customers:customers.length,payments:payments.length,warranties:warranties.length};
    const counts={critical:issues.filter(x=>x.severity==='critical').length,warning:issues.filter(x=>x.severity==='warning').length};
    lastReport={time:new Date().toISOString(),summary,counts,issues,cloud:{configured:!!window.KPOS_CLOUD?.configured,status:window.KPOS_CLOUD?.status||'Offline',revision:window.KPOS_CLOUD?.revision||0}};
    return lastReport;
  }

  window.runKposSystemAudit=()=>{audit();renderAuditCard();toast(lastReport.issues.length?`Kiểm tra xong: ${lastReport.counts.critical} lỗi, ${lastReport.counts.warning} cảnh báo`:'Kiểm tra xong: dữ liệu ổn')};

  window.safeRepairKposData=()=>{
    if(!confirm('Chạy sửa an toàn? Hệ thống chỉ chuẩn hóa dữ liệu có thể suy ra chắc chắn, không tự sửa tồn kho/IMEI đang lệch.'))return;
    ['products','customers','invoices','payments','imeis','warranties','returns','vouchers','inventoryMovements','stockReceipts','activities','cart'].forEach(k=>{if(!Array.isArray(db[k]))db[k]=[]});
    db.customers.forEach(c=>{c.points=Math.max(0,n(c.points));c.debt=Math.max(0,n(c.debt));c.total=Math.max(0,n(c.total))});
    db.invoices.forEach(inv=>{const active=db.returns.filter(r=>r.status!=='Đã hủy'&&String(r.invoiceId)===String(inv.id));inv.returnedAmount=Math.max(0,active.reduce((s,r)=>s+n(r.amount),0));inv.debt=Math.max(0,n(inv.debt));if(!inv.status)inv.status=inv.debt>0?'Công nợ':'Hoàn thành'});
    db.cart=db.cart.filter(c=>product(c.productId)).map(c=>({...c,qty:Math.max(1,n(c.qty)),selectedImeis:[...new Set(c.selectedImeis||[])]}));
    db.payments.forEach(p=>{if(!p.status)p.status='Hoàn thành'});
    saveDB();audit();render();toast('Đã sửa an toàn và kiểm tra lại dữ liệu');
  };

  window.exportKposAudit=()=>{
    const report=lastReport||audit();const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`kpos-audit-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
  };

  function cardHtml(){
    const r=lastReport||audit(),ok=!r.issues.length;
    const rows=r.issues.slice(0,12).map(x=>`<div class="audit-issue ${x.severity}"><div><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></div><span>${x.severity==='critical'?'LỖI':'CẢNH BÁO'}</span></div>`).join('');
    return `<div class="card kpos-audit-card" id="kpos-system-audit"><div class="row-between"><div><b>🧪 Kiểm tra toàn hệ thống</b><div class="small muted">Sản phẩm → kho → IMEI → POS → hóa đơn → công nợ → trả/đổi → bảo hành</div></div><span class="badge ${ok?'green':r.counts.critical?'red':'orange'}">${ok?'Ổn':`${r.counts.critical} lỗi • ${r.counts.warning} cảnh báo`}</span></div><div class="audit-summary">${Object.entries(r.summary).map(([k,v])=>`<div><span>${({products:'SP',imeis:'IMEI',invoices:'HĐ',returns:'Trả/đổi',customers:'Khách',payments:'Thanh toán',warranties:'BH'})[k]||k}</span><b>${v}</b></div>`).join('')}</div><div class="audit-actions"><button class="btn primary" onclick="runKposSystemAudit()">CHẠY KIỂM TRA</button><button class="btn ghost" onclick="safeRepairKposData()">SỬA AN TOÀN</button><button class="btn ghost" onclick="exportKposAudit()">XUẤT BÁO CÁO</button></div>${rows?`<div class="audit-list">${rows}${r.issues.length>12?`<div class="small muted">Còn ${r.issues.length-12} mục khác trong file báo cáo.</div>`:''}</div>`:'<div class="notice success" style="margin-top:10px">Không phát hiện lỗi liên kết dữ liệu.</div>'}<div class="small muted" style="margin-top:9px">Cloud: ${esc(r.cloud.status)} • revision ${r.cloud.revision} • kiểm tra ${fmtDateTime(r.time)}</div></div>`;
  }

  function renderAuditCard(){if(state.screen!=='settings')return;const content=document.querySelector('.content');if(!content)return;document.querySelector('#kpos-system-audit')?.remove();content.insertAdjacentHTML('beforeend',cardHtml())}

  window.render=render=function(){finalRender();setTimeout(renderAuditCard,0)};
})();