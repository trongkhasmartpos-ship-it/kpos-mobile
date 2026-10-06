/* KPOS Web/Desktop UI - cùng app, cùng Supabase, tự đổi giao diện theo màn hình */
(function(){
  const desktopMQ=window.matchMedia('(min-width: 980px)');
  const isDesktop=()=>desktopMQ.matches;
  const mobileNav=nav;
  const mobileTopbar=topbar;
  const mobilePosView=posView;
  const previousRender=window.render;

  function cloudText(){
    const c=window.KPOS_CLOUD;
    if(!c?.configured)return 'Offline';
    if(!navigator.onLine)return 'Mất mạng • lưu cục bộ';
    if(c.status==='Đã đồng bộ')return 'Đã đồng bộ';
    return c.status||'Online';
  }
  function active(ids){return ids.includes(state.screen)?'active':''}
  function navButton(id,icon,label,ids=[id]){
    return `<button class="desktop-nav-btn ${active(ids)}" onclick="go('${id}')"><span class="ico">${icon}</span><span>${label}</span></button>`;
  }

  window.nav=nav=function(){
    if(!isDesktop())return mobileNav();
    const c=window.KPOS_CLOUD;
    return `<aside class="desktop-sidebar">
      <div class="desktop-brand" style="display:block;padding:8px 8px 16px"><img src="icons/kpos-logo.png" alt="KPOS" style="display:block;width:174px;max-width:100%;height:auto;object-fit:contain"><div class="desktop-brand-sub" style="margin-top:7px">Web App • Mobile • Realtime</div></div>
      <div class="desktop-nav-scroll">
        <div class="desktop-nav-group">Bán hàng</div>
        ${navButton('dashboard','⌂','Tổng quan')}
        ${navButton('pos','🛒','Bán hàng / POS')}
        ${navButton('invoices','🧾','Hóa đơn')}
        ${navButton('payments','💵','Thu tiền')}
        <div class="desktop-nav-group">Hàng hóa & kho</div>
        ${navButton('products','▦','Sản phẩm')}
        ${navButton('stock','📥','Nhập hàng')}
        ${navButton('inventory','↕','Lịch sử kho')}
        ${navButton('imei','🔢','IMEI / Serial')}
        <div class="desktop-nav-group">Khách hàng</div>
        ${navButton('customers','👤','Khách hàng')}
        ${navButton('crmDashboard','◉','CRM',['crmDashboard','crmCustomers','crmToday','crmOverdue','crmReports'])}
        ${navButton('debts','💰','Công nợ')}
        ${navButton('warranty','🛡','Bảo hành')}
        <div class="desktop-nav-group">Hệ thống</div>
        ${navButton('reports','📊','Báo cáo')}
        ${navButton('prints','🖨','Mẫu in K80 / A4')}
        ${navButton('settings','⚙','Cài đặt')}
      </div>
      <div class="desktop-sidebar-foot">
        <div class="desktop-cloud">☁ ${esc(c?.user?.email||cloudText())}</div>
        <button class="desktop-nav-btn" onclick="logout()"><span class="ico">⇥</span><span>Đăng xuất</span></button>
      </div>
    </aside>`;
  };

  window.topbar=topbar=function(title,subtitle=''){
    if(!isDesktop())return mobileTopbar(title,subtitle);
    const sync=cloudText();
    return `<header class="desktop-topbar"><div><h1>${esc(title)}</h1><div class="desktop-subtitle">${esc(subtitle||'KPOS')} • ☁ ${esc(sync)}</div></div><div class="desktop-top-actions">${window.KPOS_CLOUD?.user?`<button class="desktop-sync-pill" onclick="syncNow()">↻ Đồng bộ ngay</button>`:''}<div class="desktop-avatar">KP</div></div></header>`;
  };

  window.posView=posView=function(){
    if(!isDesktop())return mobilePosView();
    const count=db.cart.reduce((a,b)=>a+b.qty,0);
    const c=state.activeCustomer;
    return `${topbar('Bán hàng / POS','Màn hình bán hàng desktop • Barcode • IMEI/Serial')}
      <main class="desktop-pos-shell">
        <section class="desktop-pos-products">
          <div class="desktop-pos-toolbar">
            <div class="searchrow"><input id="posSearch" placeholder="Tìm tên, SKU, barcode, IMEI/Serial..." oninput="renderPosProducts()"><button class="btn accent" onclick="openScanner('pos')">📷 Quét mã</button></div>
            <button class="btn ghost" onclick="openProductForm()">＋ Sản phẩm</button>
          </div>
          <div class="small muted" style="margin:0 0 10px">${db.products.length} sản phẩm • Nhấn <b>＋</b> để đưa vào đơn hàng</div>
          <div id="posProducts" class="desktop-product-grid">${posProductCards(db.products.slice(0,60))}</div>
        </section>
        <aside class="desktop-cart-panel">
          <div class="desktop-cart-head"><div class="desktop-cart-title">Đơn hàng hiện tại</div><div class="desktop-cart-meta">${count} sản phẩm • ${db.cart.length} dòng hàng</div></div>
          <div class="desktop-customer-box"><div><div class="small muted">Khách hàng</div><b>${c?esc(c.name):'Khách lẻ'}</b>${c?.debt?`<div class="small danger-text">Công nợ: ${money(c.debt)}</div>`:''}</div><button class="btn ghost small" onclick="openCustomerPicker()">Chọn khách</button></div>
          <div class="desktop-cart-scroll">${db.cart.length?`<div class="list">${cartCards()}</div>`:`<div class="desktop-cart-empty"><div><div style="font-size:34px">🛒</div><b>Chưa có sản phẩm</b><div style="margin-top:5px">Chọn sản phẩm bên trái hoặc quét barcode.</div></div></div>`}</div>
          <div class="desktop-cart-total"><div class="desktop-total-row"><div><div class="qtysum">TỔNG CỘNG • ${count} SP</div><div class="amount">${money(cartTotal())}</div></div></div><button class="btn success block" onclick="openCheckout()" ${db.cart.length?'':'disabled'}>THANH TOÁN</button></div>
        </aside>
      </main>${nav()}`;
  };

  /* Tìm POS bằng tên / SKU / barcode và cả IMEI/Serial */
  window.renderPosProducts=()=>{
    const el=document.querySelector('#posProducts');if(!el)return;
    const q=(document.querySelector('#posSearch')?.value||'').trim().toLowerCase();
    const imeiProductIds=new Set();
    if(q)db.imeis.forEach(i=>{if(String(i.value||'').toLowerCase().includes(q))imeiProductIds.add(i.productId)});
    const list=db.products.filter(p=>!q||[p.name,p.short,p.keywords,p.sku,p.barcode].some(x=>String(x||'').toLowerCase().includes(q))||imeiProductIds.has(p.id)).slice(0,isDesktop()?80:30);
    el.innerHTML=posProductCards(list);
  };

  function addTableHead(selector,labels){
    const list=document.querySelector(selector);if(!list||list.dataset.desktopManaged==='1')return;
    list.dataset.desktopManaged='1';list.classList.add('desktop-managed-list');
    const head=document.createElement('div');head.className='desktop-table-head';head.innerHTML=labels.map(x=>`<div>${esc(x)}</div>`).join('');
    list.parentNode.insertBefore(head,list);
  }
  function enhanceDesktop(){
    const desk=isDesktop();document.body.classList.toggle('kpos-desktop',desk);if(!desk)return;
    switch(state.screen){
      case 'products':addTableHead('#productList',['Sản phẩm / SKU','Giá bán & tồn kho','Trạng thái']);break;
      case 'customers':addTableHead('#customerList',['Khách hàng / liên hệ','Doanh số & trạng thái','Công nợ']);break;
      case 'crmCustomers':addTableHead('.content .list',['Khách hàng CRM','Nhu cầu / trạng thái','Chăm sóc tiếp theo']);break;
      case 'invoices':addTableHead('#invoiceList',['Hóa đơn / khách hàng','Ngày & giá trị','Thanh toán']);break;
      case 'imei':addTableHead('#imeiList',['IMEI / Serial','Sản phẩm / khách hàng','Trạng thái']);break;
      case 'debts':addTableHead('.content .list',['Khách hàng','Thông tin công nợ','Còn phải thu']);break;
      case 'payments':addTableHead('.content .list',['Phiếu thu','Khách hàng / phương thức','Số tiền']);break;
      case 'stock':addTableHead('.content .list',['Phiếu nhập','Nhà cung cấp / thời gian','Số lượng']);break;
      case 'inventory':addTableHead('.content .list',['Sản phẩm','Chứng từ / thời gian','Biến động tồn']);break;
      case 'warranty':addTableHead('#warrantyList',['Phiếu / IMEI','Khách hàng / sản phẩm','Trạng thái']);break;
    }
    const content=document.querySelector('.content');if(content)content.dataset.screen=state.screen;
  }

  window.render=render=function(){previousRender();setTimeout(enhanceDesktop,0)};
  const onModeChange=()=>render();
  if(desktopMQ.addEventListener)desktopMQ.addEventListener('change',onModeChange);else desktopMQ.addListener(onModeChange);
  setTimeout(()=>{document.body.classList.toggle('kpos-desktop',isDesktop());render()},0);
})();
