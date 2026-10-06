/* KPOS POS V3 - quick customer, editable line price/notes, invoice note, named surcharge, compact checkout */
(function(){
  const basePosView=window.posView;
  const baseModalView=window.modalView;

  function activeDraft(){
    if(!Array.isArray(db.orderDrafts)||!db.orderDrafts.length)return null;
    return db.orderDrafts.find(o=>o.id===state.activeOrderId)||db.orderDrafts[0]||null;
  }
  function linePrice(c){
    const p=product(c.productId);
    const custom=Number(c.unitPrice);
    return Number.isFinite(custom)&&custom>=0?custom:(Number(p?.price)||0);
  }

  window.cartTotal=cartTotal=function(){
    return (db.cart||[]).reduce((s,c)=>s+linePrice(c)*(Number(c.qty)||0),0);
  };

  window.updateCartUnitPrice=(productId,value)=>{
    const c=(db.cart||[]).find(x=>String(x.productId)===String(productId));
    if(!c)return;
    const n=Math.max(0,Number(value)||0);
    c.unitPrice=n;
    saveDB();render();
  };
  window.resetCartUnitPrice=productId=>{
    const c=(db.cart||[]).find(x=>String(x.productId)===String(productId));
    if(!c)return;
    delete c.unitPrice;saveDB();render();
  };
  window.updateCartNote=(productId,value)=>{
    const c=(db.cart||[]).find(x=>String(x.productId)===String(productId));
    if(!c)return;
    c.note=String(value||'').slice(0,500);
    saveDB();
  };
  window.updatePosInvoiceNote=value=>{
    const o=activeDraft();if(!o)return;
    o.invoiceNote=String(value||'').slice(0,1000);
    saveDB();
  };

  window.cartCards=cartCards=function(){
    return (db.cart||[]).map(c=>{
      const p=product(c.productId);if(!p)return '';
      const need=!!p.imeiEnabled,count=(c.selectedImeis||[]).length,price=linePrice(c),base=Number(p.price)||0,changed=price!==base;
      return `<div class="item pos3-cart-item"><div class="item-main"><div class="item-title">${esc(p.name)}</div>
        <div class="pos3-line-meta"><label>Giá bán<input type="number" min="0" value="${price}" onchange="updateCartUnitPrice(${p.id},this.value)"></label>${changed?`<button class="pos3-reset-price" onclick="resetCartUnitPrice(${p.id})">Giá gốc ${money(base)}</button>`:''}<strong>${money(price*(Number(c.qty)||0))}</strong></div>
        ${need?`<button class="btn ${count===c.qty?'success':'ghost'} small" style="margin-top:7px" onclick="openImeiSelector(${p.id})">🔢 IMEI/Serial ${count}/${c.qty}</button>`:''}
        ${count?`<div class="taglist" style="margin-top:7px">${c.selectedImeis.map(id=>`<span class="imei-tag">${esc(imeiObj(id)?.value||'')}</span>`).join('')}</div>`:''}
        <input class="pos3-line-note" value="${esc(c.note||'')}" placeholder="Ghi chú riêng sản phẩm..." oninput="updateCartNote(${p.id},this.value)">
        <div class="small muted" style="margin-top:6px">Bảo hành: ${p.warranty||0} tháng</div>
      </div><div class="qty"><button onclick="changeQty(${p.id},-1)">−</button><b>${c.qty}</b><button onclick="changeQty(${p.id},1)">＋</button></div></div>`;
    }).join('');
  };

  window.openQuickCustomer=()=>{state.modal={type:'posQuickCustomer'};render()};
  window.saveQuickCustomer=()=>{
    const name=$('#pos3_qc_name')?.value.trim()||'',phone=$('#pos3_qc_phone')?.value.trim()||'';
    if(!name)return toast('Nhập tên khách hàng');
    if(phone){
      const existed=(db.customers||[]).find(c=>String(c.phone||'').replace(/\s/g,'')===phone.replace(/\s/g,''));
      if(existed){state.activeCustomer=existed;state.modal=null;saveDB();render();toast('Đã chọn khách hàng có sẵn');return}
    }
    const c={id:Date.now(),name,phone,phone2:'',email:'',address:'',source:'POS',status:'Khách mới',total:0,debt:0,points:0,note:'',need:'',budget:'',nextCareAt:'',lastCareAt:'',careChannel:'Gọi điện',careHistory:[]};
    db.customers.unshift(c);state.activeCustomer=c;state.modal=null;saveDB();render();toast('Đã thêm và chọn khách hàng');
  };

  function injectPosExtras(html){
    if(!html||html.includes('pos3-quick-customer'))return html;
    html=html.replace(/(<button class="pos2-customer"[\s\S]*?<\/button>)/,`$1<button class="pos3-quick-customer" onclick="openQuickCustomer()">＋ Khách mới</button>`);
    const o=activeDraft(),note=esc(o?.invoiceNote||'');
    html=html.replace('<div class="pos2-footer-buttons">',`<div class="pos3-invoice-note"><label>Ghi chú hóa đơn</label><textarea rows="2" placeholder="Ghi chú chung cho hóa đơn..." oninput="updatePosInvoiceNote(this.value)">${note}</textarea></div><div class="pos2-footer-buttons">`);
    return html;
  }
  window.posView=posView=function(){return injectPosExtras(basePosView())};

  function loyaltySettings(){
    const s=db.loyaltySettings||{};
    return {enabled:s.enabled!==false,earnRate:Math.max(1,Number(s.earnRate)||100000),pointValue:Math.max(0,Number(s.pointValue)||1000)};
  }
  function adjustment(base,type,value){
    const n=Math.max(0,Number(value)||0);
    return type==='percent'?Math.min(base,Math.round(base*Math.min(100,n)/100)):Math.min(base,n);
  }
  function findVoucher(codeValue){
    const q=String(codeValue||'').trim().toUpperCase();
    return (db.vouchers||[]).find(v=>String(v.code||'').toUpperCase()===q)||null;
  }
  function voucherState(codeValue,base,c){
    if(!codeValue)return {v:null,error:''};
    const v=findVoucher(codeValue);if(!v)return {v:null,error:'Mã voucher không tồn tại'};
    if(!v.active)return {v,error:'Voucher đã ngừng sử dụng'};
    const now=new Date();
    if(v.startsAt&&new Date(v.startsAt)>now)return {v,error:'Voucher chưa đến thời gian sử dụng'};
    if(v.endsAt&&new Date(v.endsAt)<now)return {v,error:'Voucher đã hết hạn'};
    if(Number(v.usageLimit)>0&&(Number(v.usedCount)||0)>=Number(v.usageLimit))return {v,error:'Voucher đã hết lượt sử dụng'};
    if((Number(v.minOrder)||0)>base)return {v,error:`Đơn tối thiểu ${money(v.minOrder)}`};
    if(v.customerId&&(!c||String(v.customerId)!==String(c.id)))return {v,error:'Voucher không áp dụng cho khách hàng này'};
    return {v,error:''};
  }
  function checkoutTotals(){
    const c=state.activeCustomer,subtotal=cartTotal();
    const discountType=$('#co_discount_type')?.value||'fixed',discountValue=Number($('#co_discount_value')?.value)||0,discount=adjustment(subtotal,discountType,discountValue);
    const afterManual=Math.max(0,subtotal-discount),voucherCode=($('#co_voucher')?.value||'').trim().toUpperCase(),vs=voucherState(voucherCode,afterManual,c);
    let voucherDiscount=0;if(vs.v&&!vs.error){voucherDiscount=adjustment(afterManual,vs.v.type||'fixed',vs.v.value||0);if(Number(vs.v.maxDiscount)>0)voucherDiscount=Math.min(voucherDiscount,Number(vs.v.maxDiscount))}
    const afterVoucher=Math.max(0,afterManual-voucherDiscount),ls=loyaltySettings(),available=c?Math.max(0,Number(c.points)||0):0;
    const pointsUsed=Math.max(0,Math.min(available,Number($('#co_points')?.value)||0)),pointsDiscount=Math.min(afterVoucher,pointsUsed*ls.pointValue),afterPoints=Math.max(0,afterVoucher-pointsDiscount);
    const surchargeName=($('#co_surcharge_name')?.value||'Phụ thu').trim()||'Phụ thu',surchargeType=$('#co_surcharge_type')?.value||'fixed',surchargeValue=Number($('#co_surcharge_value')?.value)||0,surcharge=adjustment(afterPoints,surchargeType,surchargeValue);
    const shipping=Math.max(0,Number($('#co_shipping')?.value)||0),total=Math.max(0,afterPoints+surcharge+shipping);
    const cash=Math.max(0,Number($('#co_cash')?.value)||0),bank=Math.max(0,Number($('#co_bank')?.value)||0),card=Math.max(0,Number($('#co_card')?.value)||0),debt=Math.max(0,Number($('#co_debt')?.value)||0);
    return {subtotal,discountType,discountValue,discount,voucherCode,voucher:vs.v,voucherError:vs.error,voucherDiscount,pointsUsed,pointsDiscount,surchargeName,surchargeType,surchargeValue,surcharge,shipping,total,cash,bank,card,debt,sum:cash+bank+card+debt};
  }
  window.recalcPos3Checkout=()=>{
    const x=checkoutTotals(),set=(id,v)=>{const el=$(id);if(el)el.textContent=money(v)};
    set('#co_subtotal_text',x.subtotal);set('#co_discount_text',x.discount);set('#co_voucher_text',x.voucherDiscount);set('#co_points_text',x.pointsDiscount);set('#co_surcharge_text',x.surcharge);set('#co_shipping_text',x.shipping);set('#co_total_text',x.total);set('#co_payment_sum',x.sum);
    const vm=$('#co_voucher_msg');if(vm){vm.textContent=x.voucherError||(!x.voucherCode?'':`Đã áp dụng ${x.voucher?.name||x.voucher?.code||''}`);vm.className=`pos3-field-hint ${x.voucherError?'danger-text':'success-text'}`}
    const diff=x.total-x.sum,d=$('#co_payment_diff');if(d){d.textContent=Math.abs(diff)<.5?'✓ Đã khớp tổng tiền':diff>0?`Còn thiếu ${money(diff)}`:`Đang dư ${money(Math.abs(diff))}`;d.className=`pos3-payment-diff ${Math.abs(diff)<.5?'ok':'bad'}`}
  };
  window.normalizePos3Payments=()=>{
    const x=checkoutTotals(),cash=$('#co_cash');if(!cash)return;
    cash.value=Math.max(0,x.total-x.bank-x.card-x.debt);recalcPos3Checkout();
  };
  window.fillPos3Remainder=method=>{
    const x=checkoutTotals(),map={cash:'#co_cash',bank:'#co_bank',card:'#co_card',debt:'#co_debt'},el=$(map[method]);if(!el)return;
    const current=Number(el.value)||0,other=x.sum-current;el.value=Math.max(0,x.total-other);recalcPos3Checkout();
  };

  window.openCheckout=()=>{
    for(const c of db.cart||[]){const p=product(c.productId);if(p?.imeiEnabled&&(c.selectedImeis||[]).length!==c.qty)return toast(`Chọn đủ IMEI cho ${p.name}`)}
    if(!(db.cart||[]).length)return toast('Chưa có sản phẩm');
    state.modal={type:'posV3Checkout',saleDate:new Date().toISOString()};render();
  };

  function localDateTimeValue(value){
    const d=new Date(value||Date.now()),pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function quickCustomerModal(){
    return `<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="pos3-quick-modal"><div class="pos3-modal-head"><div><b>Thêm nhanh khách hàng</b><small>Tạo khách và chọn ngay cho đơn đang bán</small></div><button onclick="closeModal()">×</button></div><div class="pos3-quick-body"><label>Tên khách hàng *<input id="pos3_qc_name" autofocus placeholder="Nhập tên khách"></label><label>Số điện thoại<input id="pos3_qc_phone" inputmode="tel" placeholder="Nhập SĐT"></label><button class="btn primary block" onclick="saveQuickCustomer()">THÊM & CHỌN KHÁCH</button></div></div></div>`;
  }
  function checkoutModal(m){
    const c=state.activeCustomer,total=cartTotal(),points=c?Number(c.points)||0:0,o=activeDraft(),note=o?.invoiceNote||'';
    return `<div class="modal-backdrop pos3-checkout-backdrop" onclick="if(event.target===this)closeModal()"><div class="pos3-checkout-modal"><div class="pos3-modal-head"><div><b>Thanh toán đơn hàng</b><small>${esc(o?.name||'Đơn hàng')} • ${money(total)}</small></div><button onclick="closeModal()">×</button></div><div class="pos3-checkout-body"><section class="pos3-checkout-left">
      <div class="pos3-customer-strip"><span><small>Khách hàng</small><b>${c?esc(c.name):'Khách lẻ'}</b>${c?.phone?`<em>${esc(c.phone)}</em>`:''}</span>${c?`<span><small>Điểm</small><b>${points}</b></span>`:''}${c?.debt?`<span><small>Công nợ</small><b class="danger-text">${money(c.debt)}</b></span>`:''}</div>
      <div class="pos3-compact-grid two"><label>Ngày giờ bán<input id="co_date" type="datetime-local" value="${localDateTimeValue(m.saleDate)}"></label><label>Ghi chú hóa đơn<input id="co_invoice_note" value="${esc(note)}" placeholder="Ghi chú chung..."></label></div>
      <div class="pos3-section-title">Giảm giá & ưu đãi</div>
      <div class="pos3-compact-grid discount"><label>Giảm giá<input id="co_discount_value" type="number" min="0" value="0" oninput="normalizePos3Payments()"></label><label>Loại<select id="co_discount_type" onchange="normalizePos3Payments()"><option value="fixed">Số tiền</option><option value="percent">%</option></select></label></div>
      <div class="pos3-compact-grid two"><label>Voucher<input id="co_voucher" placeholder="Nhập mã voucher" oninput="normalizePos3Payments()"><small id="co_voucher_msg" class="pos3-field-hint"></small></label><label>Dùng điểm (${money(loyaltySettings().pointValue)}/điểm)<input id="co_points" type="number" min="0" max="${points}" value="0" oninput="normalizePos3Payments()"></label></div>
      <div class="pos3-section-title">Phụ thu & giao hàng</div>
      <div class="pos3-compact-grid surcharge"><label>Tên phụ thu<input id="co_surcharge_name" value="Phụ thu" placeholder="VD: Phí đóng gói"></label><label>Số tiền<input id="co_surcharge_value" type="number" min="0" value="0" oninput="normalizePos3Payments()"></label><label>Loại<select id="co_surcharge_type" onchange="normalizePos3Payments()"><option value="fixed">Số tiền</option><option value="percent">%</option></select></label></div>
      <div class="pos3-compact-grid one"><label>Phí giao hàng<input id="co_shipping" type="number" min="0" value="0" oninput="normalizePos3Payments()"></label></div>
    </section><section class="pos3-checkout-right"><div class="pos3-section-title first">Chia phương thức thanh toán</div>
      ${[['cash','💵','Tiền mặt',total],['bank','⇄','Chuyển khoản',0],['card','💳','Thẻ / POS',0],['debt','🧾','Ghi nợ',0]].map(([k,i,l,v])=>`<div class="pos3-pay-row"><span>${i} <b>${l}</b></span><input id="co_${k}" type="number" min="0" value="${v}" oninput="recalcPos3Checkout()"><button onclick="fillPos3Remainder('${k}')">Còn lại</button></div>`).join('')}
      <div class="pos3-summary"><div><span>Tạm tính</span><b id="co_subtotal_text">${money(total)}</b></div><div><span>Giảm giá</span><b id="co_discount_text">0đ</b></div><div><span>Voucher</span><b id="co_voucher_text">0đ</b></div><div><span>Điểm</span><b id="co_points_text">0đ</b></div><div><span>Phụ thu</span><b id="co_surcharge_text">0đ</b></div><div><span>Giao hàng</span><b id="co_shipping_text">0đ</b></div><div class="grand"><span>PHẢI THANH TOÁN</span><b id="co_total_text">${money(total)}</b></div></div>
      <div class="pos3-payment-check"><span>Tổng đã phân bổ <b id="co_payment_sum">${money(total)}</b></span><div id="co_payment_diff" class="pos3-payment-diff ok">✓ Đã khớp tổng tiền</div></div>
      <button class="btn success pos3-complete" onclick="finishCheckout()">HOÀN TẤT THANH TOÁN</button>
    </section></div></div></div>`;
  }

  window.modalView=modalView=function(){
    if(state.modal?.type==='posQuickCustomer')return quickCustomerModal();
    if(state.modal?.type==='posV3Checkout')return checkoutModal(state.modal);
    return baseModalView();
  };

  window.finishCheckout=()=>{
    if(!(db.cart||[]).length)return;
    const x=checkoutTotals();
    if(x.voucherError)return toast(x.voucherError);
    if(Math.abs(x.sum-x.total)>.5)return toast('Tổng các phương thức thanh toán phải bằng tổng đơn hàng');
    if(x.debt>0&&!state.activeCustomer)return toast('Đơn có công nợ phải chọn khách hàng');
    if(x.pointsUsed>0&&!state.activeCustomer)return toast('Muốn dùng điểm phải chọn khách hàng');
    for(const c of db.cart){const p=product(c.productId);if(p?.imeiEnabled&&(c.selectedImeis||[]).length!==c.qty)return toast(`Chọn đủ IMEI cho ${p.name}`)}
    let now=new Date().toISOString();const selected=$('#co_date')?.value;try{if(selected)now=new Date(selected).toISOString()}catch(e){}
    const items=db.cart.map(c=>({productId:c.productId,qty:Number(c.qty)||0,price:linePrice(c),imeis:[...(c.selectedImeis||[])],note:String(c.note||'').trim()}));
    const baseMargin=items.reduce((s,it)=>{const p=product(it.productId);return s+((Number(it.price)||0)-(Number(p?.cost)||0))*it.qty},0);
    const profit=baseMargin-x.discount-x.voucherDiscount-x.pointsDiscount+x.surcharge+x.shipping;
    const methods=[['Tiền mặt',x.cash],['Chuyển khoản',x.bank],['Thẻ/POS',x.card],['Ghi nợ',x.debt]].filter(([,a])=>a>0);
    const ls=loyaltySettings(),earned=ls.enabled&&state.activeCustomer?Math.floor(x.total/ls.earnRate):0,note=($('#co_invoice_note')?.value||activeDraft()?.invoiceNote||'').trim();
    const inv={id:Date.now(),code:code('HD',db.invoices),date:now,customerId:state.activeCustomer?.id||null,subtotal:x.subtotal,discount:x.discount,discountType:x.discountType,discountValue:x.discountValue,voucherCode:x.voucherCode||'',voucherDiscount:x.voucherDiscount,pointsUsed:x.pointsUsed,pointsDiscount:x.pointsDiscount,pointsEarned:earned,surchargeName:x.surchargeName,surcharge:x.surcharge,surchargeType:x.surchargeType,surchargeValue:x.surchargeValue,shipping:x.shipping,total:x.total,paid:x.total-x.debt,debt:x.debt,originalDebt:x.debt,paymentMethod:methods.map(([n,a])=>`${n} ${money(a)}`).join(' + '),payments:methods.map(([method,amount])=>({method,amount})),profit,items,note,status:x.debt>0?'Công nợ':'Hoàn thành',cancelledAt:null,cancelReason:'',returnedAmount:0};
    db.invoices.unshift(inv);
    items.forEach(it=>{const p=product(it.productId);if(!p)return;p.stock-=it.qty;addMovement(p.id,-it.qty,'SALE',inv.code,'Bán hàng');(it.imeis||[]).forEach(iid=>{const im=imeiObj(iid);if(im){im.status='Đã bán';im.customerId=inv.customerId;im.invoiceId=inv.id;im.soldDate=now;im.warrantyStart=now;im.warrantyEnd=addMonths(now,p.warranty||0)}})});
    if(state.activeCustomer){state.activeCustomer.total=(Number(state.activeCustomer.total)||0)+x.total;state.activeCustomer.debt=(Number(state.activeCustomer.debt)||0)+x.debt;state.activeCustomer.points=Math.max(0,(Number(state.activeCustomer.points)||0)-x.pointsUsed+earned);state.activeCustomer.status='Đã mua hàng'}
    [['Tiền mặt',x.cash],['Chuyển khoản',x.bank],['Thẻ/POS',x.card]].forEach(([method,amount],idx)=>{if(amount>0)db.payments.unshift({id:Date.now()+idx+1,code:code('TH',db.payments),date:now,customerId:inv.customerId,invoiceId:inv.id,amount,method,status:'Hoàn thành',note:`Thanh toán ${inv.code}`})});
    if(x.voucher&&!x.voucherError){x.voucher.usedCount=(Number(x.voucher.usedCount)||0)+1;x.voucher.lastUsedAt=now;if(x.voucher.oneTime)x.voucher.active=false}
    addActivity(`${inv.code} • ${money(x.total)}${earned?` • +${earned} điểm`:''}`);
    db.cart=[];state.activeCustomer=null;const o=activeDraft();if(o){o.cart=[];o.customerId=null;o.invoiceNote=''}if(window.KPOS_ORDER_SYNC)window.KPOS_ORDER_SYNC();saveDB();state.modal={type:'success',invoice:inv};render();
  };
})();
