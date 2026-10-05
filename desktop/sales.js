/* KPOS Sales Pro - multiple orders + split payment */
(function(){
  const desktopMQ=window.matchMedia('(min-width: 980px)');
  const isDesktop=()=>desktopMQ.matches;
  const basePosView=window.posView;
  const baseModalView=window.modalView;
  const baseRender=window.render;
  const rawSaveDB=window.saveDB;

  function orderName(n){return `Đơn hàng ${n}`}
  function ensureOrderDrafts(){
    if(!Array.isArray(db.orderDrafts))db.orderDrafts=[];
    if(!db.orderDrafts.length)db.orderDrafts.push({id:'order-'+Date.now(),name:orderName(1),cart:clone(db.cart||[]),customerId:state.activeCustomer?.id||null,createdAt:new Date().toISOString()});
    if(!state.activeOrderId||!db.orderDrafts.some(o=>o.id===state.activeOrderId))state.activeOrderId=db.orderDrafts[0].id;
    const active=db.orderDrafts.find(o=>o.id===state.activeOrderId);
    if(active&&state.__orderLoaded!==active.id){db.cart=clone(active.cart||[]);state.activeCustomer=active.customerId?customer(active.customerId):null;state.__orderLoaded=active.id}
  }
  function syncActiveOrder(){
    if(!Array.isArray(db.orderDrafts)||!state.activeOrderId)return;
    const o=db.orderDrafts.find(x=>x.id===state.activeOrderId);if(!o)return;
    o.cart=clone(db.cart||[]);o.customerId=state.activeCustomer?.id||null;o.updatedAt=new Date().toISOString();
  }
  window.KPOS_ORDER_SYNC=syncActiveOrder;
  window.saveDB=saveDB=function(){syncActiveOrder();rawSaveDB()};

  window.addOrderTab=()=>{
    ensureOrderDrafts();syncActiveOrder();
    const o={id:'order-'+Date.now(),name:orderName(db.orderDrafts.length+1),cart:[],customerId:null,createdAt:new Date().toISOString()};
    db.orderDrafts.push(o);state.activeOrderId=o.id;state.__orderLoaded=null;ensureOrderDrafts();saveDB();render();
  };
  window.switchOrderTab=id=>{ensureOrderDrafts();syncActiveOrder();rawSaveDB();state.activeOrderId=id;state.__orderLoaded=null;ensureOrderDrafts();render()};
  window.closeOrderTab=id=>{
    ensureOrderDrafts();const o=db.orderDrafts.find(x=>x.id===id);if(!o)return;
    if((o.cart||[]).length&&!confirm(`Đóng ${o.name}? Sản phẩm đang chọn trong đơn này sẽ bị bỏ.`))return;
    const idx=db.orderDrafts.findIndex(x=>x.id===id);db.orderDrafts.splice(idx,1);
    if(!db.orderDrafts.length)db.orderDrafts.push({id:'order-'+Date.now(),name:orderName(1),cart:[],customerId:null,createdAt:new Date().toISOString()});
    if(state.activeOrderId===id)state.activeOrderId=db.orderDrafts[Math.max(0,idx-1)]?.id||db.orderDrafts[0].id;
    state.__orderLoaded=null;ensureOrderDrafts();saveDB();render();
  };
  function orderTabs(){
    ensureOrderDrafts();
    return `<div class="biz-order-tabs">${db.orderDrafts.map(o=>{const qty=(o.id===state.activeOrderId?db.cart:(o.cart||[])).reduce((a,b)=>a+(b.qty||0),0);return `<button class="biz-order-tab ${o.id===state.activeOrderId?'active':''}" onclick="switchOrderTab('${o.id}')"><span>${esc(o.name)}</span><small>${qty} SP</small>${db.orderDrafts.length>1?`<i onclick="event.stopPropagation();closeOrderTab('${o.id}')">×</i>`:''}</button>`}).join('')}<button class="biz-order-add" onclick="addOrderTab()">＋ Đơn mới</button></div>`;
  }

  function adjustment(base,type,value){const v=Math.max(0,Number(value)||0);return type==='percent'?Math.min(base,Math.round(base*Math.min(v,100)/100)):v}
  function checkoutTotalsFromDom(){
    const subtotal=cartTotal(),discountType=$('#co_discount_type')?.value||'fixed',discountValue=Number($('#co_discount_value')?.value)||0,discount=adjustment(subtotal,discountType,discountValue),after=Math.max(0,subtotal-discount),surchargeType=$('#co_surcharge_type')?.value||'fixed',surchargeValue=Number($('#co_surcharge_value')?.value)||0,surcharge=adjustment(after,surchargeType,surchargeValue),shipping=Math.max(0,Number($('#co_shipping')?.value)||0),total=Math.max(0,subtotal-discount+surcharge+shipping),cash=Math.max(0,Number($('#co_cash')?.value)||0),bank=Math.max(0,Number($('#co_bank')?.value)||0),card=Math.max(0,Number($('#co_card')?.value)||0),debt=Math.max(0,Number($('#co_debt')?.value)||0);
    return {subtotal,discountType,discountValue,discount,surchargeType,surchargeValue,surcharge,shipping,total,cash,bank,card,debt,sum:cash+bank+card+debt};
  }
  window.recalcBusinessCheckout=()=>{
    const x=checkoutTotalsFromDom(),set=(id,v)=>{const el=$(id);if(el)el.textContent=money(v)};
    set('#co_subtotal_text',x.subtotal);set('#co_discount_text',x.discount);set('#co_surcharge_text',x.surcharge);set('#co_shipping_text',x.shipping);set('#co_total_text',x.total);set('#co_payment_sum',x.sum);
    const diff=x.total-x.sum,el=$('#co_payment_diff');if(el){el.textContent=diff===0?'Đã khớp tổng tiền':diff>0?`Còn thiếu ${money(diff)}`:`Đang dư ${money(Math.abs(diff))}`;el.className=diff===0?'success-text':'danger-text'}
  };
  window.fillCheckoutRemainder=method=>{const x=checkoutTotalsFromDom(),ids={cash:'#co_cash',bank:'#co_bank',card:'#co_card',debt:'#co_debt'},target=$(ids[method]);if(!target)return;const other=x.sum-(Number(target.value)||0);target.value=Math.max(0,x.total-other);recalcBusinessCheckout()};

  window.openCheckout=()=>{
    ensureOrderDrafts();for(const c of db.cart){const p=product(c.productId);if(p?.imeiEnabled&&(c.selectedImeis||[]).length!==c.qty)return toast(`Chọn đủ IMEI cho ${p.name}`)}
    state.modal={type:'businessCheckout',saleDate:new Date().toISOString()};render();
  };
  window.finishCheckout=()=>{
    if(!db.cart.length)return;const x=checkoutTotalsFromDom();
    if(Math.abs(x.sum-x.total)>0.5)return toast('Tổng các phương thức thanh toán phải bằng tổng đơn hàng');
    if(x.debt>0&&!state.activeCustomer)return toast('Đơn có công nợ phải chọn khách hàng');
    const selected=$('#co_date')?.value;let now=new Date().toISOString();try{if(selected)now=new Date(selected).toISOString()}catch(e){}
    const items=db.cart.map(c=>({productId:c.productId,qty:c.qty,price:product(c.productId)?.price||0,imeis:[...(c.selectedImeis||[])]}));
    const baseMargin=items.reduce((s,it)=>{const p=product(it.productId);return s+((p?.price||0)-(p?.cost||0))*it.qty},0),profit=baseMargin-x.discount+x.surcharge+x.shipping;
    const methods=[['Tiền mặt',x.cash],['Chuyển khoản',x.bank],['Thẻ/POS',x.card],['Ghi nợ',x.debt]].filter(([,a])=>a>0),paymentMethod=methods.map(([m,a])=>`${m} ${money(a)}`).join(' + ');
    const inv={id:Date.now(),code:code('HD',db.invoices),date:now,customerId:state.activeCustomer?.id||null,subtotal:x.subtotal,discount:x.discount,discountType:x.discountType,discountValue:x.discountValue,surcharge:x.surcharge,surchargeType:x.surchargeType,surchargeValue:x.surchargeValue,shipping:x.shipping,total:x.total,paid:x.total-x.debt,debt:x.debt,paymentMethod,payments:methods.map(([method,amount])=>({method,amount})),profit,items,status:x.debt>0?'Công nợ':'Hoàn thành',cancelledAt:null,cancelReason:''};
    db.invoices.unshift(inv);
    items.forEach(it=>{const p=product(it.productId);if(!p)return;p.stock-=it.qty;addMovement(p.id,-it.qty,'SALE',inv.code,'Bán hàng');(it.imeis||[]).forEach(iid=>{const im=imeiObj(iid);if(im){im.status='Đã bán';im.customerId=inv.customerId;im.invoiceId=inv.id;im.soldDate=now;im.warrantyStart=now;im.warrantyEnd=addMonths(now,p.warranty||0)}})});
    if(state.activeCustomer){state.activeCustomer.total=(state.activeCustomer.total||0)+x.total;state.activeCustomer.debt=(state.activeCustomer.debt||0)+x.debt;state.activeCustomer.status='Đã mua hàng'}
    [['Tiền mặt',x.cash],['Chuyển khoản',x.bank],['Thẻ/POS',x.card]].forEach(([method,amount],idx)=>{if(amount>0)db.payments.unshift({id:Date.now()+idx+1,code:code('TH',db.payments),date:now,customerId:inv.customerId,invoiceId:inv.id,amount,method,status:'Hoàn thành',note:`Thanh toán ${inv.code}`})});
    addActivity(`${inv.code} • ${money(x.total)}${x.debt?` • Nợ ${money(x.debt)}`:''}`);db.cart=[];state.activeCustomer=null;syncActiveOrder();saveDB();state.modal={type:'success',invoice:inv};render();
  };

  function checkoutModal(m){
    const total=cartTotal(),date=new Date(m.saleDate||new Date()).toISOString().slice(0,16),c=state.activeCustomer;
    return sheet('Thanh toán đơn hàng',`<div class="biz-checkout-grid"><section><div class="notice"><b>${c?esc(c.name):'Khách lẻ'}</b>${c?.phone?` • ${esc(c.phone)}`:''}${c?.debt?`<br>Công nợ hiện tại: <b>${money(c.debt)}</b>`:''}</div><div class="field" style="margin-top:12px"><label>Ngày giờ bán</label><input id="co_date" type="datetime-local" value="${date}"></div><div class="biz-adjust-row"><div class="field"><label>Giảm giá</label><input id="co_discount_value" type="number" value="0" oninput="recalcBusinessCheckout()"></div><div class="field"><label>Loại</label><select id="co_discount_type" onchange="recalcBusinessCheckout()"><option value="fixed">Số tiền</option><option value="percent">%</option></select></div></div><div class="biz-adjust-row"><div class="field"><label>Phụ thu</label><input id="co_surcharge_value" type="number" value="0" oninput="recalcBusinessCheckout()"></div><div class="field"><label>Loại</label><select id="co_surcharge_type" onchange="recalcBusinessCheckout()"><option value="fixed">Số tiền</option><option value="percent">%</option></select></div></div><div class="field"><label>Phí giao hàng</label><input id="co_shipping" type="number" value="0" oninput="recalcBusinessCheckout()"></div><div class="biz-total-box"><div><span>Tạm tính</span><b id="co_subtotal_text">${money(total)}</b></div><div><span>Giảm giá</span><b id="co_discount_text">0đ</b></div><div><span>Phụ thu</span><b id="co_surcharge_text">0đ</b></div><div><span>Giao hàng</span><b id="co_shipping_text">0đ</b></div><div class="grand"><span>PHẢI THANH TOÁN</span><b id="co_total_text">${money(total)}</b></div></div></section><section><div class="section-title" style="margin-top:0">Chia phương thức thanh toán</div>${[['cash','Tiền mặt','💵',total],['bank','Chuyển khoản','⇄',0],['card','Thẻ / POS','💳',0],['debt','Ghi nợ','🧾',0]].map(([k,l,i,v])=>`<div class="biz-pay-row"><div class="biz-pay-name"><span>${i}</span><b>${l}</b></div><input id="co_${k}" type="number" value="${v}" oninput="recalcBusinessCheckout()"><button class="btn ghost small" onclick="fillCheckoutRemainder('${k}')">Còn lại</button></div>`).join('')}<div class="biz-payment-check"><div><span>Tổng đã phân bổ</span><b id="co_payment_sum">${money(total)}</b></div><div id="co_payment_diff" class="success-text">Đã khớp tổng tiền</div></div><div class="notice" style="margin-top:12px">Có thể chia cùng một đơn qua <b>Tiền mặt + Chuyển khoản + Thẻ/POS + Ghi nợ</b>. Ghi nợ bắt buộc phải chọn khách hàng.</div><button class="btn success block" style="margin-top:14px" onclick="finishCheckout()">HOÀN TẤT THANH TOÁN</button></section></div>`);
  }

  window.posView=function(){
    if(!isDesktop())return basePosView();ensureOrderDrafts();
    const count=db.cart.reduce((a,b)=>a+b.qty,0),c=state.activeCustomer,total=cartTotal(),active=db.orderDrafts.find(o=>o.id===state.activeOrderId);
    return `${topbar('Bán hàng / POS','Nhiều đơn song song • Barcode • IMEI/Serial • thanh toán kết hợp')}<main class="pro-pos biz-pos"><section class="pro-pos-left">${orderTabs()}<div class="pro-pos-search"><div class="searchrow"><input id="posSearch" autofocus placeholder="Tên sản phẩm / SKU / barcode / IMEI / Serial" oninput="renderPosProducts()"><button class="btn accent" onclick="openScanner('pos')">📷 Quét mã</button></div><button class="btn ghost" onclick="openProductForm()">＋ Sản phẩm</button><button class="btn ghost" onclick="openStockReceipt()">📥 Nhập hàng</button></div><div class="pro-pos-info"><span><b>${db.products.length}</b> sản phẩm</span><span><b>${db.products.reduce((a,p)=>a+(p.stock||0),0)}</b> tồn kho</span><span><b>${db.imeis.filter(i=>i.status==='Trong kho').length}</b> IMEI trong kho</span></div><div id="posProducts" class="desktop-product-grid pro-product-grid">${posProductCards(db.products.slice(0,80))}</div></section><aside class="pro-pos-cart"><div class="pro-cart-title"><div><b>${esc(active?.name||'Đơn hàng')}</b><div class="small muted">${count} sản phẩm • giữ nhiều đơn song song</div></div>${db.cart.length?`<button class="btn ghost small" onclick="clearDesktopCart()">Xóa giỏ</button>`:''}</div><button class="pro-customer-select" onclick="openCustomerPicker()"><div><span>Khách hàng</span><b>${c?esc(c.name):'Khách lẻ'}</b>${c?.phone?`<small>${esc(c.phone)}</small>`:''}</div><div class="right">${c?.debt?`<span class="badge red">Nợ ${money(c.debt)}</span>`:'<span class="badge">Chọn khách ›</span>'}</div></button><div class="pro-cart-items">${db.cart.length?cartCards():'<div class="desktop-cart-empty"><div><div style="font-size:38px">🛒</div><b>Chưa có sản phẩm</b><div class="small muted" style="margin-top:5px">Chọn hàng bên trái hoặc quét barcode.</div></div></div>'}</div><div class="pro-cart-summary"><div><span>Tạm tính</span><b>${money(total)}</b></div><div><span>Số lượng</span><b>${count} sản phẩm</b></div>${c?.debt?`<div class="danger-text"><span>Công nợ cũ</span><b>${money(c.debt)}</b></div>`:''}<div class="grand"><span>TỔNG CỘNG</span><b>${money(total)}</b></div><button class="btn success block" onclick="openCheckout()" ${db.cart.length?'':'disabled'}>THANH TOÁN <span class="pro-key">F4</span></button></div></aside></main>${nav()}`;
  };

  window.modalView=modalView=function(){if(state.modal?.type==='businessCheckout')return checkoutModal(state.modal);return baseModalView()};
  window.render=render=function(){ensureOrderDrafts();baseRender();setTimeout(()=>{if(state.modal?.type==='businessCheckout')recalcBusinessCheckout()},0)};
})();
