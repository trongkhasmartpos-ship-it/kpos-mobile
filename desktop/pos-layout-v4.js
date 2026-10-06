/* KPOS POS V4 - checkout-first desktop shell based on approved reference */
(function(){
  const desktopMQ=window.matchMedia('(min-width:980px)');
  const basePosView=window.posView;
  const baseRender=window.render;
  state.pos4Search=state.pos4Search||'';

  const isDesktop=()=>desktopMQ.matches;
  const activeOrder=()=>Array.isArray(db.orderDrafts)?(db.orderDrafts.find(o=>o.id===state.activeOrderId)||db.orderDrafts[0]||null):null;
  const linePrice=c=>{const p=product(c.productId),v=Number(c.unitPrice);return Number.isFinite(v)&&v>=0?v:(Number(p?.price)||0)};
  const orderCart=o=>o?.id===state.activeOrderId?(db.cart||[]):(o?.cart||[]);
  const orderTotal=o=>orderCart(o).reduce((s,c)=>s+linePrice(c)*(Number(c.qty)||0),0);
  const idArg=id=>JSON.stringify(id);

  function formatNow(){
    return new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date()).replace(',', ' -');
  }

  function orderTabs(){
    const rows=(db.orderDrafts||[]);
    if(!rows.length)return `<button class="pos4-order-tab active"><span>Đơn hàng 1</span><small>0đ</small></button>`;
    return rows.map(o=>`<button class="pos4-order-tab ${o.id===state.activeOrderId?'active':''}" onclick="switchOrderTab(${JSON.stringify(o.id)})"><span>${esc(o.name||'Đơn hàng')}</span><small>${money(orderTotal(o))}</small>${rows.length>1?`<i onclick="event.stopPropagation();closeOrderTab(${JSON.stringify(o.id)})">×</i>`:''}</button>`).join('');
  }

  function matchesProduct(p,q){
    if(!q)return false;
    const text=[p.name,p.short,p.keywords,p.sku,p.barcode,p.category,p.brand,p.unit].join(' ').toLowerCase();
    if(text.includes(q))return true;
    return (db.imeis||[]).some(i=>String(i.productId)===String(p.id)&&String(i.value||'').toLowerCase().includes(q));
  }
  function searchRows(){
    const q=String(state.pos4Search||'').trim().toLowerCase();
    if(!q)return [];
    return (db.products||[]).filter(p=>matchesProduct(p,q)).slice(0,8);
  }
  function searchResultsHtml(){
    const rows=searchRows();
    if(!String(state.pos4Search||'').trim())return '';
    if(!rows.length)return `<div class="pos4-search-empty">Không tìm thấy sản phẩm</div>`;
    return rows.map(p=>`<button class="pos4-search-result" onclick="pos4AddProduct(${idArg(p.id)})"><span class="pos4-search-thumb">${p.images?.[0]?`<img src="${p.images[0]}">`:'📦'}</span><span><b>${esc(p.name)}</b><small>${esc(p.sku||p.barcode||'Chưa có mã')} • Tồn ${Number(p.stock)||0}${p.imeiEnabled?' • Có IMEI/Serial':''}</small></span><strong>${money(p.price||0)}</strong></button>`).join('');
  }
  window.pos4SearchInput=value=>{state.pos4Search=value||'';const el=document.querySelector('#pos4SearchResults');if(el)el.innerHTML=searchResultsHtml()};
  window.pos4SearchKey=e=>{
    if(e.key!=='Enter')return;
    const raw=String(state.pos4Search||'').trim();if(!raw)return;
    const im=(db.imeis||[]).find(i=>String(i.value||'').toLowerCase()===raw.toLowerCase());
    if(im){pos4AddProduct(im.productId);return}
    const p=typeof findProductByCode==='function'?findProductByCode(raw):null;
    if(p){pos4AddProduct(p.id);return}
    const first=searchRows()[0];if(first)pos4AddProduct(first.id);
  };
  window.pos4AddProduct=id=>{const p=product(id);if(!p)return toast('Không tìm thấy sản phẩm');addCart(id);state.pos4Search='';render()};
  window.pos4ClearCart=()=>{if(!(db.cart||[]).length)return;if(!confirm('Xóa toàn bộ sản phẩm trong đơn hiện tại?'))return;db.cart=[];saveDB();render()};
  window.pos4More=()=>toast('Các thao tác bổ sung sẽ gắn ở bước chức năng tiếp theo');

  function cartRows(){
    if(!(db.cart||[]).length)return `<div class="pos4-empty"><div>🛒</div><b>Chưa có sản phẩm trong đơn</b><small>Tìm tên, SKU, barcode hoặc IMEI/Serial trên thanh phía trên để thêm hàng.</small></div>`;
    return db.cart.map(c=>{
      const p=product(c.productId);if(!p)return '';
      const price=linePrice(c),imeiCount=(c.selectedImeis||[]).length;
      return `<article class="pos4-cart-row">
        <div class="pos4-row-top"><div class="pos4-name"><span class="pos4-code">▣ ${esc(p.sku||p.barcode||'SP')}</span><b>${esc(p.name)}</b><em>(${esc(p.unit||'Máy')})</em></div><button class="pos4-remove" onclick="changeQty(${idArg(p.id)},-${Math.max(1,Number(c.qty)||1)})">×</button></div>
        <div class="pos4-warranty">🛡 BẢO HÀNH (${Number(p.warranty)||0} tháng)${p.imeiEnabled?` • IMEI/Serial ${imeiCount}/${Number(c.qty)||0}`:''}</div>
        <div class="pos4-row-bottom"><strong>${money(price)}</strong><div class="pos4-qty"><button onclick="changeQty(${idArg(p.id)},-1)">−</button><b>${Number(c.qty)||0}</b><button onclick="changeQty(${idArg(p.id)},1)">＋</button></div><strong class="pos4-line-total">${money(price*(Number(c.qty)||0))}</strong></div>
      </article>`;
    }).join('');
  }

  function customerHeader(){
    const c=state.activeCustomer;
    return `<div class="pos4-customer"><button onclick="openCustomerPicker()"><span>♙</span><b>${c?esc(c.name):'Khách lẻ'}</b>${c?.phone?`<small>${esc(c.phone)}</small>`:''}</button>${typeof openQuickCustomer==='function'?`<button class="pos4-add-customer" onclick="openQuickCustomer()">＋ Khách mới</button>`:''}</div>`;
  }

  function paymentPanel(){
    const qty=(db.cart||[]).reduce((s,c)=>s+(Number(c.qty)||0),0),subtotal=cartTotal();
    return `<div class="pos4-pay-scroll">
      <section class="pos4-summary-line"><span>Ngày bán</span><b>${formatNow()} <i>▣</i></b></section>
      <section class="pos4-summary-line"><span>Tổng thành tiền (${qty})</span><b>${money(subtotal)}</b></section>
      <section class="pos4-pay-card pos4-clickable" onclick="openCheckout()"><header><b>Chiết khấu & Giảm giá</b><strong>- 0</strong></header><div class="pos4-three"><div>◇ <span>Chiết khấu</span><em>₫ &nbsp; <b>%</b></em></div><div>🎟 <span>Voucher</span></div><div>★ <span>Điểm thưởng</span></div></div></section>
      <section class="pos4-pay-card pos4-clickable" onclick="openCheckout()"><header><b>Thuế & Phụ thu</b><strong>+ 0</strong></header><div class="pos4-surcharge"><div><small>Nội dung phụ thu</small><span>🛒 PHÍ SHIP HÀNG</span></div><div><small>Giá trị</small><span>0 <em>₫ &nbsp; %</em></span></div><button>×</button></div><div class="pos4-add-fee">＋ &nbsp; Thêm phụ thu khác</div></section>
      <section class="pos4-summary-line pos4-due"><span>Số tiền khách phải trả</span><b>${money(subtotal)}</b></section>
      <section class="pos4-pay-card pos4-payment pos4-clickable" onclick="openCheckout()"><header><b>Thanh toán</b></header><div class="pos4-methods"><span class="active">▣ Tiền mặt</span><span>▦ CHUYỂN KHOẢN</span><span>▤ Thẻ/POS</span><span>🧾 Ghi nợ</span></div><div class="pos4-pay-value"><small>TIỀN MẶT</small><b>${money(subtotal)}</b></div></section>
    </div>
    <footer class="pos4-footer"><button class="pos4-icon-btn" onclick="pos4ClearCart()" title="Xóa giỏ">🗑</button><button class="pos4-icon-btn" onclick="pos4More()" title="Thêm">⋮</button><button class="pos4-save" onclick="savePosDraft()">☁ &nbsp; LƯU ĐƠN</button><button class="pos4-pay" onclick="openCheckout()" ${db.cart.length?'':'disabled'}>THANH TOÁN</button><button class="pos4-print" onclick="openCheckout()" ${db.cart.length?'':'disabled'}>▣ &nbsp; Thanh toán & In</button></footer>`;
  }

  function top(){
    return `<header class="pos4-top"><div class="pos4-tabs">${orderTabs()}</div><div class="pos4-top-actions"><button class="pos4-create" onclick="addOrderTab()">＋ &nbsp; Tạo đơn</button><button onclick="openProductForm()" title="Thêm sản phẩm">＋</button><button onclick="openStockReceipt()" title="Nhập hàng">⇩</button><button onclick="openScanner('pos')" title="Quét mã">▣</button><div class="pos4-global-search"><span>⌕</span><input id="pos4Search" value="${esc(state.pos4Search||'')}" placeholder="Tìm tên, mã vạch..." oninput="pos4SearchInput(this.value)" onkeydown="pos4SearchKey(event)" autocomplete="off"><div id="pos4SearchResults" class="pos4-search-results">${searchResultsHtml()}</div></div></div></header>`;
  }

  window.posView=posView=function(){
    if(!isDesktop())return basePosView();
    return `${top()}<main class="pos4-shell"><section class="pos4-cart-pane">${customerHeader()}<div class="pos4-cart-scroll">${cartRows()}</div></section><section class="pos4-payment-pane">${paymentPanel()}</section></main>${nav()}`;
  };

  window.render=render=function(){const r=baseRender();document.body.classList.toggle('kpos-pos4',isDesktop()&&state.screen==='pos');return r};
})();
