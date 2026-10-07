/* KPOS POS inline checkout V1 - operate discount, surcharge and payments directly on POS */
(function(){
  const desktopMQ=window.matchMedia('(min-width:980px)');
  const baseRender=window.render;
  let persistTimer=null;

  const isDesktop=()=>desktopMQ.matches;
  const activeOrder=()=>Array.isArray(db.orderDrafts)?(db.orderDrafts.find(o=>o.id===state.activeOrderId)||db.orderDrafts[0]||null):null;
  const num=v=>Math.max(0,Number(v)||0);
  const pad=n=>String(n).padStart(2,'0');
  const localDateTime=v=>{const d=new Date(v||Date.now());return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`};

  function schedulePersist(){
    clearTimeout(persistTimer);
    persistTimer=setTimeout(()=>{try{saveDB()}catch(e){}},450);
  }

  function checkoutDraft(){
    const o=activeOrder();
    if(!o)return null;
    const subtotal=typeof cartTotal==='function'?cartTotal():0;
    o.pos4Checkout={
      discountType:'fixed',discountValue:0,voucherCode:'',pointsUsed:0,
      surchargeName:'Phụ thu',surchargeType:'fixed',surchargeValue:0,shipping:0,
      cash:subtotal,bank:0,card:0,debt:0,selectedMethod:'cash',autoFill:true,
      saleDate:new Date().toISOString(),invoiceNote:o.invoiceNote||'',
      ...(o.pos4Checkout||{})
    };
    if(!o.pos4Checkout.saleDate)o.pos4Checkout.saleDate=new Date().toISOString();
    if(o.pos4Checkout.invoiceNote==null)o.pos4Checkout.invoiceNote=o.invoiceNote||'';
    return o.pos4Checkout;
  }

  function loyaltySettings(){
    const s=db.loyaltySettings||{};
    return {enabled:s.enabled!==false,pointValue:Math.max(0,Number(s.pointValue)||1000)};
  }
  function adjustment(base,type,value){
    const n=num(value);
    return type==='percent'?Math.min(base,Math.round(base*Math.min(100,n)/100)):Math.min(base,n);
  }
  function findVoucher(code){
    const q=String(code||'').trim().toUpperCase();
    return (db.vouchers||[]).find(v=>String(v.code||'').toUpperCase()===q)||null;
  }
  function voucherState(code,base,c){
    if(!String(code||'').trim())return {v:null,error:''};
    const v=findVoucher(code);if(!v)return {v:null,error:'Mã voucher không tồn tại'};
    if(!v.active)return {v,error:'Voucher đã ngừng sử dụng'};
    const now=new Date();
    if(v.startsAt&&new Date(v.startsAt)>now)return {v,error:'Voucher chưa đến thời gian sử dụng'};
    if(v.endsAt&&new Date(v.endsAt)<now)return {v,error:'Voucher đã hết hạn'};
    if(Number(v.usageLimit)>0&&(Number(v.usedCount)||0)>=Number(v.usageLimit))return {v,error:'Voucher đã hết lượt sử dụng'};
    if((Number(v.minOrder)||0)>base)return {v,error:`Đơn tối thiểu ${money(v.minOrder)}`};
    if(v.customerId&&(!c||String(v.customerId)!==String(c.id)))return {v,error:'Voucher không áp dụng cho khách hàng này'};
    return {v,error:''};
  }

  function totals(){
    const d=checkoutDraft()||{},c=state.activeCustomer,subtotal=typeof cartTotal==='function'?cartTotal():0;
    const discount=adjustment(subtotal,d.discountType||'fixed',d.discountValue);
    const afterManual=Math.max(0,subtotal-discount);
    const vs=voucherState(d.voucherCode,afterManual,c);
    let voucherDiscount=0;
    if(vs.v&&!vs.error){
      voucherDiscount=adjustment(afterManual,vs.v.type||'fixed',vs.v.value||0);
      if(Number(vs.v.maxDiscount)>0)voucherDiscount=Math.min(voucherDiscount,Number(vs.v.maxDiscount));
    }
    const afterVoucher=Math.max(0,afterManual-voucherDiscount);
    const ls=loyaltySettings(),available=c?Math.max(0,Number(c.points)||0):0;
    const pointsUsed=Math.max(0,Math.min(available,num(d.pointsUsed)));
    const pointsDiscount=Math.min(afterVoucher,pointsUsed*ls.pointValue);
    const afterPoints=Math.max(0,afterVoucher-pointsDiscount);
    const surcharge=adjustment(afterPoints,d.surchargeType||'fixed',d.surchargeValue);
    const shipping=num(d.shipping);
    const total=Math.max(0,afterPoints+surcharge+shipping);

    if(d.autoFill!==false){
      d.cash=0;d.bank=0;d.card=0;d.debt=0;
      const key=['cash','bank','card','debt'].includes(d.selectedMethod)?d.selectedMethod:'cash';
      d[key]=total;
    }
    const cash=num(d.cash),bank=num(d.bank),card=num(d.card),debt=num(d.debt),sum=cash+bank+card+debt;
    return {subtotal,discount,voucher:vs.v,voucherError:vs.error,voucherDiscount,pointsUsed,pointsDiscount,surcharge,shipping,total,cash,bank,card,debt,sum};
  }

  function putText(id,text){const el=document.getElementById(id);if(el)el.textContent=text}
  function putValue(id,value){const el=document.getElementById(id);if(el&&document.activeElement!==el)el.value=value}

  function refreshInline(){
    if(!isDesktop()||state.screen!=='pos')return;
    const d=checkoutDraft(),x=totals();if(!d)return;
    putText('pos4_discount_total',`- ${money(x.discount+x.voucherDiscount+x.pointsDiscount)}`);
    putText('pos4_fee_total',`+ ${money(x.surcharge+x.shipping)}`);
    putText('co_total_text',money(x.total));
    putText('co_payment_sum',money(x.sum));
    const diff=x.total-x.sum,diffEl=document.getElementById('co_payment_diff');
    if(diffEl){diffEl.textContent=Math.abs(diff)<.5?'✓ Đã khớp tổng tiền':diff>0?`Còn thiếu ${money(diff)}`:`Đang dư ${money(Math.abs(diff))}`;diffEl.className=`pos4-inline-diff ${Math.abs(diff)<.5?'ok':'bad'}`}
    const vm=document.getElementById('co_voucher_msg');
    if(vm){vm.textContent=x.voucherError||(!d.voucherCode?'':`✓ ${x.voucher?.name||x.voucher?.code||'Đã áp dụng voucher'}`);vm.className=`pos4-inline-hint ${x.voucherError?'bad':'ok'}`}
    putValue('co_cash',x.cash);putValue('co_bank',x.bank);putValue('co_card',x.card);putValue('co_debt',x.debt);
    document.querySelectorAll('.pos4-inline-method').forEach(b=>b.classList.toggle('active',b.dataset.method===d.selectedMethod));
    document.querySelectorAll('[data-discount-type]').forEach(b=>b.classList.toggle('active',b.dataset.discountType===d.discountType));
    document.querySelectorAll('[data-surcharge-type]').forEach(b=>b.classList.toggle('active',b.dataset.surchargeType===d.surchargeType));
  }

  window.pos4InlineField=(key,value,kind='text')=>{
    const d=checkoutDraft();if(!d)return;
    if(kind==='number')d[key]=num(value);else d[key]=String(value??'');
    if(key==='invoiceNote'){const o=activeOrder();if(o)o.invoiceNote=d[key]}
    schedulePersist();refreshInline();
  };
  window.pos4InlineType=(group,type)=>{
    const d=checkoutDraft();if(!d)return;
    if(group==='discount')d.discountType=type==='percent'?'percent':'fixed';
    if(group==='surcharge')d.surchargeType=type==='percent'?'percent':'fixed';
    schedulePersist();refreshInline();
  };
  window.pos4InlinePayment=(method,value)=>{
    const d=checkoutDraft();if(!d||!['cash','bank','card','debt'].includes(method))return;
    d[method]=num(value);d.selectedMethod=method;d.autoFill=false;schedulePersist();refreshInline();
  };
  window.pos4InlineChoosePayment=method=>{
    const d=checkoutDraft();if(!d||!['cash','bank','card','debt'].includes(method))return;
    const x=totals();
    if(d.autoFill!==false){d.cash=0;d.bank=0;d.card=0;d.debt=0;d[method]=x.total;d.autoFill=true}
    else{
      const other=['cash','bank','card','debt'].filter(k=>k!==method).reduce((s,k)=>s+num(d[k]),0);
      d[method]=Math.max(0,x.total-other);d.autoFill=false;
    }
    d.selectedMethod=method;schedulePersist();refreshInline();
    setTimeout(()=>document.getElementById(`co_${method}`)?.focus(),0);
  };
  window.pos4InlineRemainder=method=>{
    const d=checkoutDraft();if(!d||!['cash','bank','card','debt'].includes(method))return;
    const x=totals(),other=['cash','bank','card','debt'].filter(k=>k!==method).reduce((s,k)=>s+num(d[k]),0);
    d[method]=Math.max(0,x.total-other);d.selectedMethod=method;d.autoFill=false;schedulePersist();refreshInline();
  };

  function fieldHtml(label,id,value,key,placeholder=''){
    return `<label class="pos4-inline-field"><small>${label}</small><input id="${id}" value="${esc(String(value??''))}" placeholder="${esc(placeholder)}" oninput="pos4InlineField('${key}',this.value)"></label>`;
  }
  function moneyFieldHtml(label,id,value,method){
    return `<label class="pos4-inline-payfield"><span><small>${label}</small><button type="button" onclick="event.stopPropagation();pos4InlineRemainder('${method}')">Còn lại</button></span><input id="${id}" type="number" min="0" value="${num(value)}" oninput="pos4InlinePayment('${method}',this.value)"></label>`;
  }

  function enhance(){
    if(!isDesktop()||state.screen!=='pos')return;
    const scroll=document.querySelector('.pos4-pay-scroll');if(!scroll)return;
    const d=checkoutDraft(),x=totals();if(!d)return;
    const summaries=scroll.querySelectorAll('.pos4-summary-line'),cards=scroll.querySelectorAll('.pos4-pay-card');
    if(summaries[0]){
      summaries[0].classList.add('pos4-inline-date');
      summaries[0].innerHTML=`<span>Ngày bán</span><input id="co_date" type="datetime-local" value="${localDateTime(d.saleDate)}" oninput="pos4InlineField('saleDate',this.value)">`;
    }
    if(cards[0]){
      cards[0].onclick=null;cards[0].removeAttribute('onclick');cards[0].classList.remove('pos4-clickable');
      cards[0].innerHTML=`<header><b>Chiết khấu & Giảm giá</b><strong id="pos4_discount_total">- ${money(x.discount+x.voucherDiscount+x.pointsDiscount)}</strong></header>
        <div class="pos4-inline-discount-grid">
          <div class="pos4-inline-money"><span>◇</span><input id="co_discount_value" type="number" min="0" value="${num(d.discountValue)}" placeholder="Chiết khấu" oninput="pos4InlineField('discountValue',this.value,'number')"><input id="co_discount_type" type="hidden" value="${esc(d.discountType||'fixed')}"><div class="pos4-inline-switch"><button type="button" data-discount-type="fixed" class="${d.discountType!=='percent'?'active':''}" onclick="pos4InlineType('discount','fixed')">₫</button><button type="button" data-discount-type="percent" class="${d.discountType==='percent'?'active':''}" onclick="pos4InlineType('discount','percent')">%</button></div></div>
          <label class="pos4-inline-field"><small>Voucher</small><input id="co_voucher" value="${esc(d.voucherCode||'')}" placeholder="Nhập mã voucher" oninput="pos4InlineField('voucherCode',this.value)"><em id="co_voucher_msg" class="pos4-inline-hint ${x.voucherError?'bad':'ok'}">${esc(x.voucherError||(!d.voucherCode?'':`✓ ${x.voucher?.name||x.voucher?.code||'Đã áp dụng voucher'}`))}</em></label>
          <label class="pos4-inline-field"><small>Điểm thưởng${state.activeCustomer?` • Có ${Number(state.activeCustomer.points)||0}`:''}</small><input id="co_points" type="number" min="0" max="${state.activeCustomer?Number(state.activeCustomer.points)||0:0}" value="${num(d.pointsUsed)}" placeholder="0" oninput="pos4InlineField('pointsUsed',this.value,'number')"></label>
        </div>`;
    }
    if(cards[1]){
      cards[1].onclick=null;cards[1].removeAttribute('onclick');cards[1].classList.remove('pos4-clickable');
      cards[1].innerHTML=`<header><b>Thuế & Phụ thu</b><strong id="pos4_fee_total">+ ${money(x.surcharge+x.shipping)}</strong></header>
        <div class="pos4-inline-fee-grid">
          ${fieldHtml('Nội dung phụ thu','co_surcharge_name',d.surchargeName,'surchargeName','VD: Phí đóng gói')}
          <label class="pos4-inline-field"><small>Giá trị phụ thu</small><div class="pos4-inline-value-switch"><input id="co_surcharge_value" type="number" min="0" value="${num(d.surchargeValue)}" oninput="pos4InlineField('surchargeValue',this.value,'number')"><input id="co_surcharge_type" type="hidden" value="${esc(d.surchargeType||'fixed')}"><div class="pos4-inline-switch"><button type="button" data-surcharge-type="fixed" class="${d.surchargeType!=='percent'?'active':''}" onclick="pos4InlineType('surcharge','fixed')">₫</button><button type="button" data-surcharge-type="percent" class="${d.surchargeType==='percent'?'active':''}" onclick="pos4InlineType('surcharge','percent')">%</button></div></div></label>
          <label class="pos4-inline-field"><small>Phí giao hàng</small><input id="co_shipping" type="number" min="0" value="${num(d.shipping)}" oninput="pos4InlineField('shipping',this.value,'number')"></label>
        </div>`;
    }
    if(summaries[2])summaries[2].innerHTML=`<span>Số tiền khách phải trả</span><b id="co_total_text">${money(x.total)}</b>`;
    if(cards[2]){
      cards[2].onclick=null;cards[2].removeAttribute('onclick');cards[2].classList.remove('pos4-clickable');
      cards[2].innerHTML=`<header><b>Thanh toán</b><strong id="co_payment_sum">${money(x.sum)}</strong></header>
        <div class="pos4-methods pos4-inline-methods">
          <button type="button" class="pos4-inline-method ${d.selectedMethod==='cash'?'active':''}" data-method="cash" onclick="pos4InlineChoosePayment('cash')">▣ Tiền mặt</button>
          <button type="button" class="pos4-inline-method ${d.selectedMethod==='bank'?'active':''}" data-method="bank" onclick="pos4InlineChoosePayment('bank')">▦ Chuyển khoản</button>
          <button type="button" class="pos4-inline-method ${d.selectedMethod==='card'?'active':''}" data-method="card" onclick="pos4InlineChoosePayment('card')">▤ Thẻ/POS</button>
          <button type="button" class="pos4-inline-method ${d.selectedMethod==='debt'?'active':''}" data-method="debt" onclick="pos4InlineChoosePayment('debt')">🧾 Ghi nợ</button>
        </div>
        <div class="pos4-inline-payment-grid">
          ${moneyFieldHtml('Tiền mặt','co_cash',x.cash,'cash')}
          ${moneyFieldHtml('Chuyển khoản','co_bank',x.bank,'bank')}
          ${moneyFieldHtml('Thẻ/POS','co_card',x.card,'card')}
          ${moneyFieldHtml('Ghi nợ','co_debt',x.debt,'debt')}
        </div>
        <div id="co_payment_diff" class="pos4-inline-diff ${Math.abs(x.total-x.sum)<.5?'ok':'bad'}">${Math.abs(x.total-x.sum)<.5?'✓ Đã khớp tổng tiền':x.total>x.sum?`Còn thiếu ${money(x.total-x.sum)}`:`Đang dư ${money(x.sum-x.total)}`}</div>
        <div class="pos4-inline-note"><label>Ghi chú hóa đơn<input id="co_invoice_note" value="${esc(d.invoiceNote||'')}" placeholder="Ghi chú chung..." oninput="pos4InlineField('invoiceNote',this.value)"></label></div>`;
    }
    const pay=document.querySelector('.pos4-footer .pos4-pay'),print=document.querySelector('.pos4-footer .pos4-print');
    if(pay){pay.onclick=()=>pos4InlineCheckout(false);pay.textContent='THANH TOÁN'}
    if(print){print.onclick=()=>pos4InlineCheckout(true);print.innerHTML='▣ &nbsp; Thanh toán & In'}
    refreshInline();
  }

  window.pos4InlineCheckout=print=>{
    if(!(db.cart||[]).length)return toast('Chưa có sản phẩm');
    for(const c of db.cart||[]){const p=product(c.productId);if(p?.imeiEnabled&&(c.selectedImeis||[]).length!==Number(c.qty))return toast(`Chọn đủ IMEI cho ${p.name}`)}
    const d=checkoutDraft();if(!d)return;
    const dateEl=document.getElementById('co_date'),noteEl=document.getElementById('co_invoice_note');
    if(dateEl?.value)d.saleDate=dateEl.value;
    if(noteEl)d.invoiceNote=noteEl.value;
    const x=totals();
    if(x.voucherError)return toast(x.voucherError);
    if(Math.abs(x.sum-x.total)>.5)return toast('Tổng các phương thức thanh toán phải bằng tổng đơn hàng');
    if(x.debt>0&&!state.activeCustomer)return toast('Đơn có công nợ phải chọn khách hàng');
    const o=activeOrder();if(o)o.invoiceNote=d.invoiceNote||'';
    schedulePersist();
    if(print&&typeof window.finishCheckoutAndPrint==='function')return window.finishCheckoutAndPrint();
    if(typeof window.finishCheckout==='function')return window.finishCheckout();
    toast('Chưa thể hoàn tất thanh toán');
  };

  window.render=render=function(){const r=baseRender();setTimeout(enhance,0);return r};
  setTimeout(enhance,0);
})();
