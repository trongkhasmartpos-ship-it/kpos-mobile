/* KPOS POS V2 - professional one-screen desktop POS + responsive mobile */
(function(){
  state.posV2Filter=state.posV2Filter||'all';
  state.posV2Query=state.posV2Query||'';

  function ensureOrders(){
    if(!Array.isArray(db.orderDrafts))db.orderDrafts=[];
    if(!db.orderDrafts.length){
      db.orderDrafts.push({id:'order-'+Date.now(),name:'Đơn hàng 1',cart:clone(db.cart||[]),customerId:state.activeCustomer?.id||null,createdAt:new Date().toISOString()});
    }
    if(!state.activeOrderId||!db.orderDrafts.some(o=>o.id===state.activeOrderId))state.activeOrderId=db.orderDrafts[0].id;
    const active=db.orderDrafts.find(o=>o.id===state.activeOrderId);
    if(active&&state.__posV2Loaded!==active.id){
      db.cart=clone(active.cart||[]);
      state.activeCustomer=active.customerId?customer(active.customerId):null;
      state.__posV2Loaded=active.id;
    }
    return active;
  }
  function activeOrder(){return ensureOrders()}

  window.renamePosOrder=()=>{
    const o=activeOrder();if(!o)return;
    const name=prompt('Tên đơn hàng:',o.name||'Đơn hàng');
    if(!name||!name.trim())return;
    o.name=name.trim();saveDB();render();
  };
  window.savePosDraft=()=>{
    if(window.KPOS_ORDER_SYNC)window.KPOS_ORDER_SYNC();
    saveDB();toast('Đã lưu đơn tạm');
  };

  function orderTabs(){
    ensureOrders();
    return `<div class="pos2-order-tabs">${db.orderDrafts.map(o=>{const isActive=o.id===state.activeOrderId;const cart=isActive?db.cart:(o.cart||[]),qty=cart.reduce((a,b)=>a+(Number(b.qty)||0),0),sum=cart.reduce((a,b)=>a+(Number(b.qty)||0)*(Number(product(b.productId)?.price)||0),0);return `<button class="pos2-order-tab ${isActive?'active':''}" onclick="switchOrderTab('${o.id}')"><span><b>${esc(o.name||'Đơn hàng')}</b><small>${qty} SP • ${money(sum)}</small></span>${db.orderDrafts.length>1?`<i onclick="event.stopPropagation();closeOrderTab('${o.id}')">×</i>`:''}</button>`}).join('')}<button class="pos2-new-order" onclick="addOrderTab()">＋ Đơn mới</button></div>`;
  }

  function categoryOf(p){return String(p.category||p.group||'').trim()}
  function filterOptions(){
    const cats=[...new Set((db.products||[]).map(categoryOf).filter(Boolean))].slice(0,8);
    return [['all','Tất cả'],['stock','Còn hàng'],['imei','IMEI/Serial'],['low','Sắp hết'],...cats.map(c=>['cat:'+c,c])];
  }
  window.setPosV2Filter=v=>{state.posV2Filter=v;renderPosV2Products();document.querySelectorAll('.pos2-filter').forEach(b=>b.classList.toggle('active',b.dataset.filter===v))};

  function productMatches(p,q){
    if(!q)return true;
    const text=[p.name,p.short,p.keywords,p.sku,p.barcode,p.category,p.brand,p.unit].join(' ').toLowerCase();
    if(text.includes(q))return true;
    return (db.imeis||[]).some(i=>i.productId===p.id&&String(i.value||'').toLowerCase().includes(q));
  }
  function filteredProducts(){
    const q=String(state.posV2Query||'').trim().toLowerCase(),f=state.posV2Filter||'all';
    return (db.products||[]).filter(p=>{
      if(!productMatches(p,q))return false;
      if(f==='stock'&&(Number(p.stock)||0)<=0)return false;
      if(f==='imei'&&!p.imeiEnabled)return false;
      if(f==='low'&&(Number(p.stock)||0)>(Number(p.minStock)||0))return false;
      if(f.startsWith('cat:')&&categoryOf(p)!==f.slice(4))return false;
      return true;
    }).slice(0,100);
  }
  function productCard(p){
    const stock=Number(p.stock)||0,low=stock<=(Number(p.minStock)||0),ims=p.imeiEnabled?availableImeis(p.id).length:0;
    return `<div class="pos2-product ${stock<=0?'soldout':''}" onclick="${stock>0?`addCart(${p.id})`:`toast('Sản phẩm đã hết hàng')`}">
      <div class="pos2-product-photo">${p.images?.[0]?`<img src="${p.images[0]}" alt="">`:`<span>📦</span>`}${p.imeiEnabled?'<em>IMEI</em>':''}</div>
      <div class="pos2-product-body"><b title="${esc(p.name)}">${esc(p.name)}</b><small>${esc(p.sku||p.barcode||'Chưa có mã')}</small><div class="pos2-price">${money(p.price||0)}</div><div class="pos2-stock ${low?'low':''}">${stock<=0?'Hết hàng':`Tồn ${stock}`}${p.imeiEnabled?` • ${ims} IMEI`:''}</div></div>
      <button class="pos2-add" ${stock<=0?'disabled':''} onclick="event.stopPropagation();${stock>0?`addCart(${p.id})`:''}">＋</button>
    </div>`;
  }
  function productsHtml(){const list=filteredProducts();return list.map(productCard).join('')||'<div class="pos2-empty-products"><span>⌕</span><b>Không tìm thấy sản phẩm</b><small>Thử tên, SKU, barcode hoặc IMEI/Serial khác.</small></div>'}
  window.renderPosV2Products=()=>{
    state.posV2Query=$('#posV2Search')?.value||'';
    const el=$('#posV2Products');if(el)el.innerHTML=productsHtml();
    const n=$('#posV2Found');if(n)n.textContent=`${filteredProducts().length} sản phẩm`;
  };

  function addImeiByValue(raw){
    const im=(db.imeis||[]).find(i=>String(i.value||'').toLowerCase()===String(raw||'').trim().toLowerCase());
    if(!im)return false;
    if(im.status!=='Trong kho'){toast(`IMEI/Serial đang ở trạng thái: ${im.status||'Không khả dụng'}`);return true}
    const p=product(im.productId);if(!p)return true;
    let c=db.cart.find(x=>x.productId===p.id);
    if(c&&(c.selectedImeis||[]).includes(im.id)){toast('IMEI/Serial này đã có trong đơn');return true}
    addCart(p.id);
    c=db.cart.find(x=>x.productId===p.id);
    if(c){c.selectedImeis=c.selectedImeis||[];if(!c.selectedImeis.includes(im.id))c.selectedImeis.push(im.id);if(c.qty<c.selectedImeis.length)c.qty=c.selectedImeis.length;saveDB();}
    toast(`Đã thêm ${p.name} • ${im.value}`);return true;
  }
  window.posV2SearchKey=e=>{
    if(e.key!=='Enter')return;
    const raw=$('#posV2Search')?.value.trim()||'';if(!raw)return;
    if(addImeiByValue(raw)){state.posV2Query='';render();return}
    const p=findProductByCode(raw);
    if(p){addCart(p.id);state.posV2Query='';render();return}
  };

  function cartSummary(){
    const count=(db.cart||[]).reduce((a,b)=>a+(Number(b.qty)||0),0),subtotal=cartTotal(),c=state.activeCustomer;
    return `<div class="pos2-cart-head"><div><span>Đơn đang bán</span><b>${esc(activeOrder()?.name||'Đơn hàng')}</b><small>${count} sản phẩm</small></div><div class="pos2-cart-head-actions"><button onclick="renamePosOrder()" title="Đổi tên đơn">✎</button>${db.cart.length?'<button onclick="clearDesktopCart()" title="Xóa giỏ">🗑</button>':''}</div></div>
      <button class="pos2-customer" onclick="openCustomerPicker()"><span class="pos2-avatar">${c?'👤':'＋'}</span><span><small>Khách hàng</small><b>${c?esc(c.name):'Khách lẻ'}</b>${c?.phone?`<em>${esc(c.phone)}</em>`:''}</span><span class="pos2-customer-right">${c?.debt?`<strong>Nợ ${money(c.debt)}</strong>`:'Chọn ›'}</span></button>
      <div class="pos2-cart-list">${db.cart.length?cartCards():'<div class="pos2-empty-cart"><span>🛒</span><b>Chưa có sản phẩm</b><small>Chọn sản phẩm bên trái hoặc quét mã để bắt đầu đơn hàng.</small></div>'}</div>
      <div class="pos2-cart-footer"><div class="pos2-total-row"><span>Tạm tính <small>${count} sản phẩm</small></span><b>${money(subtotal)}</b></div><div class="pos2-note">Giảm giá • Voucher • Điểm • Phụ thu • Giao hàng được nhập ở bước thanh toán</div><div class="pos2-footer-buttons"><button class="btn ghost" onclick="savePosDraft()">LƯU ĐƠN</button><button class="btn success" onclick="openCheckout()" ${db.cart.length?'':'disabled'}>THANH TOÁN <b>${money(subtotal)}</b></button></div></div>`;
  }

  window.posView=posView=function(){
    ensureOrders();
    const all=db.products||[],inStock=all.filter(p=>(Number(p.stock)||0)>0).length,imei=(db.imeis||[]).filter(i=>i.status==='Trong kho').length,low=all.filter(p=>(Number(p.stock)||0)<=(Number(p.minStock)||0)).length;
    return `${topbar('Bán hàng / POS','Một màn hình • nhiều đơn • barcode • IMEI/Serial • thanh toán chia tiền')}
      <div class="pos2-shell">
        <section class="pos2-left">
          ${orderTabs()}
          <div class="pos2-searchbar"><div class="pos2-search"><span>⌕</span><input id="posV2Search" autofocus value="${esc(state.posV2Query||'')}" placeholder="Tìm tên sản phẩm / SKU / Barcode / IMEI / Serial" oninput="renderPosV2Products()" onkeydown="posV2SearchKey(event)"></div><button class="btn accent" onclick="openScanner('pos')">📷 Quét mã</button><button class="btn ghost" onclick="openScanner('posContinuous',null,true)">⚡ Quét liên tục</button></div>
          <div class="pos2-meta"><span><b>${all.length}</b> sản phẩm</span><span><b>${inStock}</b> còn hàng</span><span><b>${imei}</b> IMEI trong kho</span><span class="${low?'warn':''}"><b>${low}</b> sắp hết</span><em id="posV2Found">${filteredProducts().length} sản phẩm</em></div>
          <div class="pos2-filters">${filterOptions().map(([v,l])=>`<button data-filter="${esc(v)}" class="pos2-filter ${state.posV2Filter===v?'active':''}" onclick="setPosV2Filter('${String(v).replace(/'/g,"\\'")}')">${esc(l)}</button>`).join('')}</div>
          <div id="posV2Products" class="pos2-products">${productsHtml()}</div>
        </section>
        <aside class="pos2-right">${cartSummary()}</aside>
      </div>${nav()}`;
  };
})();
