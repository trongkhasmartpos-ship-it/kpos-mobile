/* KPOS Invoice V2 - professional invoice list + detail for desktop/mobile */
(function(){
  state.invoiceV2Query=state.invoiceV2Query||'';
  state.invoiceV2Status=state.invoiceV2Status||'all';
  state.invoiceV2Payment=state.invoiceV2Payment||'all';
  state.invoiceV2Preset=state.invoiceV2Preset||'30';
  state.invoiceV2From=state.invoiceV2From||'';
  state.invoiceV2To=state.invoiceV2To||'';

  const baseModalView=window.modalView;

  function activeReturns(invId){
    return (db.returns||[]).filter(r=>String(r.invoiceId)===String(invId)&&r.status!=='Đã hủy');
  }
  function returnedAmount(inv){
    const saved=Math.max(0,Number(inv.returnedAmount)||0);
    if(saved)return saved;
    return activeReturns(inv.id).reduce((a,b)=>a+(Number(b.amount)||0),0);
  }
  function returnedQty(invId,sourceIndex){
    return activeReturns(invId).reduce((sum,r)=>sum+(r.items||[]).filter(x=>Number(x.sourceIndex)===Number(sourceIndex)).reduce((a,b)=>a+(Number(b.qty)||0),0),0);
  }
  function netValue(inv){return Math.max(0,(Number(inv.total)||0)-returnedAmount(inv))}
  function isFullReturn(inv){
    return (inv.items||[]).length>0&&(inv.items||[]).every((it,idx)=>returnedQty(inv.id,idx)>=(Number(it.qty)||0));
  }
  function statusInfo(inv){
    if(inv.status==='Đã hủy')return {key:'cancelled',label:'Đã hủy',tone:'muted'};
    if(isFullReturn(inv))return {key:'returned',label:'Đã trả hết',tone:'red'};
    if(returnedAmount(inv)>0)return {key:'partial-return',label:'Trả một phần',tone:'orange'};
    if((Number(inv.debt)||0)>0)return {key:'debt',label:'Công nợ',tone:'red'};
    return {key:'paid',label:'Hoàn thành',tone:'green'};
  }
  function paymentKey(inv){
    const ps=(inv.payments||[]).filter(x=>(Number(x.amount)||0)>0).map(x=>x.method);
    if((Number(inv.debt)||0)>0&&ps.length===0)return 'debt';
    if(ps.length>1||String(inv.paymentMethod||'').includes('+'))return 'mixed';
    const text=(ps[0]||inv.paymentMethod||'').toLowerCase();
    if(text.includes('tiền mặt'))return 'cash';
    if(text.includes('chuyển khoản'))return 'bank';
    if(text.includes('thẻ')||text.includes('pos'))return 'card';
    if(text.includes('nợ'))return 'debt';
    return 'other';
  }
  function bounds(){
    const now=new Date();
    if(state.invoiceV2Preset==='all')return {start:null,end:null};
    if(state.invoiceV2Preset==='custom'){
      const start=state.invoiceV2From?new Date(state.invoiceV2From+'T00:00:00'):null;
      const end=state.invoiceV2To?new Date(state.invoiceV2To+'T23:59:59.999'):null;
      return {start,end};
    }
    const days=state.invoiceV2Preset==='today'?1:Math.max(1,Number(state.invoiceV2Preset)||30);
    const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-(days-1));
    return {start,end:now};
  }
  function inRange(date){
    const {start,end}=bounds(),d=new Date(date);
    return (!start||d>=start)&&(!end||d<=end);
  }
  function searchable(inv){
    const c=customer(inv.customerId);
    const productText=(inv.items||[]).map(it=>{
      const p=product(it.productId);
      const ims=(it.imeis||[]).map(id=>imeiObj(id)?.value||id).join(' ');
      return [p?.name,p?.sku,p?.barcode,it.note,ims].join(' ');
    }).join(' ');
    return [inv.code,c?.name,c?.phone,c?.phone2,inv.paymentMethod,inv.voucherCode,inv.invoiceNote,inv.note,productText].join(' ').toLowerCase();
  }
  function filteredInvoices(){
    const q=String(state.invoiceV2Query||'').trim().toLowerCase();
    return (db.invoices||[]).filter(inv=>{
      if(!inRange(inv.date))return false;
      if(q&&!searchable(inv).includes(q))return false;
      const s=statusInfo(inv);
      if(state.invoiceV2Status!=='all'){
        if(state.invoiceV2Status==='returned'&&!['returned','partial-return'].includes(s.key))return false;
        else if(state.invoiceV2Status!=='returned'&&s.key!==state.invoiceV2Status)return false;
      }
      if(state.invoiceV2Payment!=='all'&&paymentKey(inv)!==state.invoiceV2Payment)return false;
      return true;
    }).sort((a,b)=>new Date(b.date)-new Date(a.date));
  }

  window.setInvoiceV2Preset=v=>{state.invoiceV2Preset=v;render()};
  window.setInvoiceV2Status=v=>{state.invoiceV2Status=v;renderInvoiceV2List()};
  window.setInvoiceV2Payment=v=>{state.invoiceV2Payment=v;renderInvoiceV2List()};
  window.applyInvoiceV2Range=()=>{
    const f=$('#inv2From')?.value||'',t=$('#inv2To')?.value||'';
    if(f&&t&&new Date(f)>new Date(t))return toast('Ngày bắt đầu phải trước ngày kết thúc');
    state.invoiceV2From=f;state.invoiceV2To=t;state.invoiceV2Preset='custom';render();
  };
  window.onInvoiceV2Search=()=>{
    state.invoiceV2Query=$('#inv2Search')?.value||'';
    renderInvoiceV2List();
  };

  function summary(list){
    const valid=list.filter(i=>i.status!=='Đã hủy');
    const gross=valid.reduce((a,b)=>a+(Number(b.total)||0),0);
    const returns=valid.reduce((a,b)=>a+returnedAmount(b),0);
    const net=gross-returns;
    const debt=valid.reduce((a,b)=>a+(Number(b.debt)||0),0);
    return {count:list.length,gross,returns,net,debt};
  }
  function invoiceTable(list){
    if(!list.length)return '<div class="inv2-empty">Không có hóa đơn phù hợp bộ lọc.</div>';
    return `<div class="inv2-table">
      <div class="inv2-row inv2-head"><div>Mã hóa đơn</div><div>Khách hàng</div><div>Thanh toán</div><div class="right">Tổng tiền</div><div class="right">Còn lại</div><div>Trạng thái</div><div></div></div>
      ${list.map(inv=>{
        const c=customer(inv.customerId),s=statusInfo(inv),ret=returnedAmount(inv),net=netValue(inv);
        return `<div class="inv2-row" onclick="openInvoiceDetail(${inv.id})">
          <div><b>${esc(inv.code||'')}</b><small>${fmtDateTime(inv.date)}</small></div>
          <div><b>${esc(c?.name||'Khách lẻ')}</b><small>${esc(c?.phone||((inv.items||[]).length+' sản phẩm'))}</small></div>
          <div><b>${esc(inv.paymentMethod||'—')}</b>${inv.voucherCode?`<small>Voucher ${esc(inv.voucherCode)}</small>`:''}</div>
          <div class="right"><b>${money(inv.total||0)}</b>${ret?`<small class="danger-text">Trả ${money(ret)}</small>`:''}</div>
          <div class="right"><b>${money(net)}</b>${inv.debt?`<small class="danger-text">Nợ ${money(inv.debt)}</small>`:''}</div>
          <div><span class="inv2-status ${s.tone}">${s.label}</span></div>
          <div class="inv2-actions" onclick="event.stopPropagation()"><button onclick="previewTemplate('sale_k80','invoice',${inv.id})" title="In K80">K80</button><button onclick="previewTemplate('sale_a4','invoice',${inv.id})" title="In A4">A4</button><button onclick="openInvoiceDetail(${inv.id})" title="Chi tiết">›</button></div>
        </div>`;
      }).join('')}
    </div>`;
  }
  function invoiceCardsMobile(list){
    if(!list.length)return '<div class="inv2-empty">Không có hóa đơn phù hợp bộ lọc.</div>';
    return `<div class="inv2-mobile-list">${list.map(inv=>{
      const c=customer(inv.customerId),s=statusInfo(inv),ret=returnedAmount(inv);
      return `<button class="inv2-mobile-card" onclick="openInvoiceDetail(${inv.id})"><span class="inv2-mobile-top"><span><b>${esc(inv.code||'')}</b><small>${fmtDateTime(inv.date)}</small></span><span class="inv2-status ${s.tone}">${s.label}</span></span><span class="inv2-mobile-customer"><b>${esc(c?.name||'Khách lẻ')}</b><small>${esc(c?.phone||inv.paymentMethod||'')}</small></span><span class="inv2-mobile-money"><span><small>Tổng hóa đơn</small><b>${money(inv.total||0)}</b></span><span><small>Còn lại</small><b>${money(netValue(inv))}</b></span>${ret?`<span><small>Đã trả/đổi</small><b class="danger-text">${money(ret)}</b></span>`:''}${inv.debt?`<span><small>Công nợ</small><b class="danger-text">${money(inv.debt)}</b></span>`:''}</span></button>`;
    }).join('')}</div>`;
  }
  function listHtml(){
    const list=filteredInvoices();
    return `<div class="inv2-list-count">${list.length} hóa đơn</div>${invoiceTable(list)}${invoiceCardsMobile(list)}`;
  }
  window.renderInvoiceV2List=()=>{
    const host=$('#inv2List');if(host)host.innerHTML=listHtml();
    const list=filteredInvoices(),s=summary(list);
    [['inv2Count',s.count],['inv2Gross',money(s.gross)],['inv2Returns',money(s.returns)],['inv2Net',money(s.net)],['inv2Debt',money(s.debt)]].forEach(([id,val])=>{const el=$('#'+id);if(el)el.textContent=val});
  };

  window.invoicesView=invoicesView=function(){
    const list=filteredInvoices(),s=summary(list),preset=state.invoiceV2Preset;
    return `${topbar('Hóa đơn','Tìm kiếm • lọc trạng thái • thanh toán • trả/đổi • in K80/A4')}
      <div class="content inv2-page">
        <div class="inv2-kpis">
          <div><span>Hóa đơn</span><b id="inv2Count">${s.count}</b></div>
          <div><span>Doanh thu gộp</span><b id="inv2Gross">${money(s.gross)}</b></div>
          <div><span>Trả / hoàn</span><b id="inv2Returns" class="danger-text">${money(s.returns)}</b></div>
          <div><span>Doanh thu ròng</span><b id="inv2Net">${money(s.net)}</b></div>
          <div><span>Công nợ</span><b id="inv2Debt" class="${s.debt?'danger-text':''}">${money(s.debt)}</b></div>
        </div>
        <div class="inv2-toolbar">
          <div class="inv2-search"><span>⌕</span><input id="inv2Search" value="${esc(state.invoiceV2Query||'')}" placeholder="Mã hóa đơn / khách / SĐT / sản phẩm / IMEI / voucher..." oninput="onInvoiceV2Search()"></div>
          <select onchange="setInvoiceV2Status(this.value)">
            ${[['all','Tất cả trạng thái'],['paid','Hoàn thành'],['debt','Công nợ'],['returned','Có trả/đổi'],['cancelled','Đã hủy']].map(([v,l])=>`<option value="${v}" ${state.invoiceV2Status===v?'selected':''}>${l}</option>`).join('')}
          </select>
          <select onchange="setInvoiceV2Payment(this.value)">
            ${[['all','Tất cả thanh toán'],['cash','Tiền mặt'],['bank','Chuyển khoản'],['card','Thẻ/POS'],['mixed','Kết hợp'],['debt','Ghi nợ']].map(([v,l])=>`<option value="${v}" ${state.invoiceV2Payment===v?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="inv2-datebar">
          <div class="inv2-presets">${[['today','Hôm nay'],['7','7 ngày'],['30','30 ngày'],['all','Tất cả']].map(([v,l])=>`<button class="${preset===v?'active':''}" onclick="setInvoiceV2Preset('${v}')">${l}</button>`).join('')}</div>
          <div class="inv2-range"><input id="inv2From" type="date" value="${esc(state.invoiceV2From||'')}"><span>đến</span><input id="inv2To" type="date" value="${esc(state.invoiceV2To||'')}"><button class="btn ghost small ${preset==='custom'?'active':''}" onclick="applyInvoiceV2Range()">Áp dụng</button></div>
        </div>
        <div id="inv2List">${listHtml()}</div>
      </div>${nav()}`;
  };

  function paymentBreakdown(inv){
    const ps=(inv.payments||[]).filter(p=>(Number(p.amount)||0)>0);
    if(ps.length)return ps.map(p=>`<div><span>${esc(p.method||'Thanh toán')}</span><b>${money(p.amount||0)}</b></div>`).join('');
    return `<div><span>Phương thức</span><b>${esc(inv.paymentMethod||'—')}</b></div>`;
  }
  function invoiceDetailV2(inv){
    const c=customer(inv.customerId),rs=activeReturns(inv.id),s=statusInfo(inv),ret=returnedAmount(inv),net=netValue(inv);
    const paid=Math.max(0,(Number(inv.total)||0)-(Number(inv.debt)||0));
    return sheet(inv.code||'Chi tiết hóa đơn',`
      <div class="inv2-detail-head">
        <div><span class="inv2-status ${s.tone}">${s.label}</span><h3>${esc(inv.code||'')}</h3><small>${fmtDateTime(inv.date)}</small></div>
        <div class="inv2-detail-total"><span>Giá trị còn lại</span><b>${money(net)}</b></div>
      </div>
      <div class="inv2-detail-kpis">
        <div><span>Tổng hóa đơn</span><b>${money(inv.total||0)}</b></div>
        <div><span>Đã thanh toán</span><b>${money(paid)}</b></div>
        <div><span>Đã trả / đổi</span><b class="${ret?'danger-text':''}">${money(ret)}</b></div>
        <div><span>Công nợ</span><b class="${inv.debt?'danger-text':''}">${money(inv.debt||0)}</b></div>
      </div>
      <div class="inv2-detail-grid">
        <section class="inv2-panel">
          <div class="inv2-panel-title">Khách hàng & đơn hàng</div>
          <div class="inv2-info-lines">
            <div><span>Khách hàng</span><b>${esc(c?.name||'Khách lẻ')}</b></div>
            ${c?.phone?`<div><span>Số điện thoại</span><b>${esc(c.phone)}</b></div>`:''}
            <div><span>Ngày bán</span><b>${fmtDateTime(inv.date)}</b></div>
            <div><span>Trạng thái</span><b>${s.label}</b></div>
            ${inv.invoiceNote||inv.note?`<div class="full"><span>Ghi chú hóa đơn</span><b>${esc(inv.invoiceNote||inv.note)}</b></div>`:''}
          </div>
        </section>
        <section class="inv2-panel">
          <div class="inv2-panel-title">Thanh toán & điều chỉnh</div>
          <div class="inv2-info-lines">
            <div><span>Tạm tính</span><b>${money(inv.subtotal||inv.total||0)}</b></div>
            ${inv.discount?`<div><span>Giảm giá</span><b>-${money(inv.discount)}</b></div>`:''}
            ${inv.voucherDiscount?`<div><span>Voucher ${esc(inv.voucherCode||'')}</span><b>-${money(inv.voucherDiscount)}</b></div>`:''}
            ${inv.pointsDiscount?`<div><span>Dùng ${Number(inv.pointsUsed)||0} điểm</span><b>-${money(inv.pointsDiscount)}</b></div>`:''}
            ${inv.surcharge?`<div><span>${esc(inv.surchargeName||'Phụ thu')}</span><b>+${money(inv.surcharge)}</b></div>`:''}
            ${inv.shipping?`<div><span>Phí giao hàng</span><b>+${money(inv.shipping)}</b></div>`:''}
            ${inv.pointsEarned?`<div><span>Điểm được cộng</span><b class="success-text">+${inv.pointsEarned}</b></div>`:''}
          </div>
          <div class="inv2-payment-lines">${paymentBreakdown(inv)}</div>
        </section>
      </div>
      <div class="inv2-panel inv2-items-panel">
        <div class="inv2-panel-title">Sản phẩm</div>
        <div class="inv2-items">${(inv.items||[]).map((it,idx)=>{
          const p=product(it.productId),rq=returnedQty(inv.id,idx),price=Number(it.price)||0;
          return `<div class="inv2-item"><div class="inv2-item-main"><b>${esc(p?.name||'Sản phẩm')}</b><small>${Number(it.qty)||0} × ${money(price)}${rq?` • <span class="danger-text">đã trả ${rq}</span>`:''}</small>${it.note?`<em>📝 ${esc(it.note)}</em>`:''}${it.imeis?.length?`<div class="taglist">${it.imeis.map(id=>`<span class="imei-tag mono">${esc(imeiObj(id)?.value||id)}</span>`).join('')}</div>`:''}</div><strong>${money((Number(it.qty)||0)*price)}</strong></div>`;
        }).join('')||'<div class="empty">Không có sản phẩm.</div>'}</div>
      </div>
      ${rs.length?`<div class="inv2-panel"><div class="inv2-panel-title">Lịch sử trả / đổi</div><div class="inv2-return-list">${rs.map(r=>`<div><span><b>${esc(r.code||'')}</b><small>${fmtDateTime(r.date)} • ${r.type==='exchange'?'Đổi hàng':'Trả hàng'}</small></span><span><b class="danger-text">${money(r.amount||0)}</b><small>${esc(r.refundMethod||'')}</small></span><span class="inv2-return-buttons"><button onclick="openReturnPrint(${r.id},'K80')">K80</button><button onclick="openReturnPrint(${r.id},'A4')">A4</button></span></div>`).join('')}</div></div>`:''}
      <div class="inv2-detail-actions">
        <button class="btn ghost" onclick="previewTemplate('sale_k80','invoice',${inv.id})">🖨 In K80</button>
        <button class="btn ghost" onclick="previewTemplate('sale_a4','invoice',${inv.id})">🖨 In A4</button>
        ${c&&Number(inv.debt)>0?`<button class="btn success" onclick="closeModal();openDebtPayment(${c.id})">💰 Thu công nợ</button>`:''}
        <button class="btn danger" onclick="openReturnForm(${inv.id})" ${isFullReturn(inv)||inv.status==='Đã hủy'?'disabled':''}>↩ Trả / đổi</button>
        <button class="btn danger" onclick="cancelInvoice(${inv.id})" ${inv.status==='Đã hủy'||rs.length?'disabled':''}>Hủy hóa đơn</button>
      </div>
      ${rs.length?'<div class="notice inv2-notice">Hóa đơn đã phát sinh trả/đổi nên không thể hủy trực tiếp.</div>':''}
    `);
  }
  window.modalView=modalView=function(){
    if(state.modal?.type==='invoiceDetail'&&state.modal.inv)return invoiceDetailV2(state.modal.inv);
    return baseModalView();
  };
})();