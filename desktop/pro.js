/* KPOS Desktop Pro UI - dashboard, CRM table, POS PC, print editor */
(function(){
  const desktopMQ=window.matchMedia('(min-width: 980px)');
  const isDesktop=()=>desktopMQ.matches;
  const baseDashboard=window.dashboard;
  const baseCrmCustomersView=window.crmCustomersView;
  const basePosView=window.posView;
  const basePrintsView=window.printsView;
  const baseModalView=window.modalView;
  const baseRenderPrintContent=window.renderPrintContent;

  state.desktopPeriod=state.desktopPeriod||'30';
  state.desktopCrmStatus=state.desktopCrmStatus||'all';
  state.desktopCrmQuery=state.desktopCrmQuery||'';
  state.desktopPrintId=state.desktopPrintId||null;

  const safeInvoices=()=>typeof activeInvoices==='function'?activeInvoices():db.invoices.filter(i=>i.status!=='Đã hủy');
  const safePayments=()=>typeof activePayments==='function'?activePayments():db.payments.filter(p=>p.status!=='Đã hủy');
  const startOfDay=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
  function periodStart(){
    if(state.desktopPeriod==='all')return null;
    const days=Number(state.desktopPeriod||30),d=startOfDay(new Date());
    if(days<=1)return d;
    d.setDate(d.getDate()-(days-1));return d;
  }
  function withinPeriod(date){const s=periodStart();return !s||new Date(date)>=s}
  function kpi(icon,label,value,sub='',tone=''){
    return `<div class="pro-kpi ${tone}"><div class="pro-kpi-icon">${icon}</div><div><div class="pro-kpi-label">${label}</div><div class="pro-kpi-value">${value}</div>${sub?`<div class="pro-kpi-sub">${sub}</div>`:''}</div></div>`;
  }
  function periodBar(){
    return `<div class="pro-periods">${[['1','Hôm nay'],['7','7 ngày'],['30','30 ngày'],['all','Tất cả']].map(([v,l])=>`<button class="${state.desktopPeriod===v?'active':''}" onclick="setDesktopPeriod('${v}')">${l}</button>`).join('')}</div>`;
  }
  window.setDesktopPeriod=v=>{state.desktopPeriod=v;render()};

  window.dashboard=dashboard=function(){
    if(!isDesktop())return baseDashboard();
    const invs=safeInvoices().filter(i=>withinPeriod(i.date));
    const pays=safePayments().filter(p=>withinPeriod(p.date));
    const revenue=invs.reduce((a,b)=>a+(b.total||0),0);
    const profit=invs.reduce((a,b)=>a+(b.profit||0),0);
    const debt=db.customers.reduce((a,b)=>a+(b.debt||0),0);
    const cash=pays.filter(p=>p.method==='Tiền mặt').reduce((a,b)=>a+(b.amount||0),0);
    const bank=pays.filter(p=>p.method==='Chuyển khoản').reduce((a,b)=>a+(b.amount||0),0);
    const low=db.products.filter(p=>(p.stock||0)<=(p.minStock||0));
    const today=startOfDay(new Date());
    const careToday=db.customers.filter(c=>c.nextCareAt&&startOfDay(c.nextCareAt).getTime()===today.getTime());
    const overdue=db.customers.filter(c=>c.nextCareAt&&new Date(c.nextCareAt)<new Date()&&c.status!=='Đã mua hàng');
    const recent=[...invs].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,7);
    const recentCare=[...db.customers].filter(c=>c.nextCareAt).sort((a,b)=>new Date(a.nextCareAt)-new Date(b.nextCareAt)).slice(0,6);
    return `${topbar('Tổng quan','Điều hành bán hàng • CRM • kho • công nợ')}
      <div class="content pro-dashboard">
        <div class="pro-dashboard-head"><div><div class="pro-eyebrow">KPOS DESKTOP</div><h2>Tình hình kinh doanh</h2><div class="muted small">Dữ liệu đồng bộ chung với điện thoại qua Supabase.</div></div>${periodBar()}</div>
        <div class="pro-kpi-grid">
          ${kpi('₫','Doanh thu',money(revenue),`${invs.length} hóa đơn`,'orange')}
          ${kpi('↗','Lợi nhuận',money(profit),'Theo giá vốn hiện tại','green')}
          ${kpi('▣','Tổng đơn',invs.length,`${db.products.length} sản phẩm`)}
          ${kpi('!','Công nợ',money(debt),`${db.customers.filter(c=>c.debt>0).length} khách còn nợ`,'red')}
          ${kpi('●','Tiền mặt',money(cash),'Đã thu trong kỳ')}
          ${kpi('⇄','Chuyển khoản',money(bank),'Đã thu trong kỳ')}
          ${kpi('IMEI','IMEI trong kho',db.imeis.filter(i=>i.status==='Trong kho').length,`${db.imeis.length} IMEI/Serial tổng`)}
          ${kpi('↓','Hàng sắp hết',low.length,low.slice(0,2).map(p=>p.name).join(' • ')||'Tồn kho ổn')}
        </div>
        <div class="pro-dashboard-columns">
          <section class="pro-panel">
            <div class="pro-panel-head"><div><b>Hóa đơn gần đây</b><div class="small muted">Theo bộ lọc thời gian đang chọn</div></div><button class="btn ghost small" onclick="go('invoices')">Xem tất cả</button></div>
            <div class="pro-table pro-orders-table"><div class="pro-tr pro-th"><div>Mã hóa đơn</div><div>Khách hàng</div><div>Thời gian</div><div class="right">Giá trị</div></div>
            ${recent.map(inv=>{const c=customer(inv.customerId);return `<button class="pro-tr" onclick="openInvoiceDetail(${inv.id})"><div><b>${esc(inv.code)}</b><div class="small muted">${esc(inv.paymentMethod||'')}</div></div><div>${esc(c?.name||'Khách lẻ')}</div><div>${fmtDateTime(inv.date)}</div><div class="right"><b>${money(inv.total)}</b>${inv.debt?`<div class="small danger-text">Nợ ${money(inv.debt)}</div>`:''}</div></button>`}).join('')||'<div class="empty">Chưa có hóa đơn trong kỳ.</div>'}</div>
          </section>
          <section class="pro-panel">
            <div class="pro-panel-head"><div><b>CRM cần xử lý</b><div class="small muted">${careToday.length} hôm nay • ${overdue.length} quá hạn</div></div><button class="btn ghost small" onclick="go('crmToday')">Mở CRM</button></div>
            <div class="pro-care-list">${recentCare.map(c=>`<button class="pro-care-row" onclick="openDesktopCrmDetail(${c.id})"><div><b>${esc(c.name)}</b><div class="small muted">${esc(c.need||c.phone||'Chưa có nhu cầu')}</div></div><div class="right"><span class="badge ${new Date(c.nextCareAt)<new Date()?'red':'orange'}">${fmtDateTime(c.nextCareAt)}</span><div class="small muted" style="margin-top:4px">${esc(c.status||'')}</div></div></button>`).join('')||'<div class="empty">Chưa có lịch chăm sóc.</div>'}</div>
          </section>
        </div>
        <div class="pro-quickbar">
          <button onclick="go('pos')">🛒 <span><b>Bán hàng</b><small>Mở POS desktop</small></span></button>
          <button onclick="openStockReceipt()">📥 <span><b>Nhập hàng</b><small>Barcode & IMEI</small></span></button>
          <button onclick="go('crmCustomers')">👥 <span><b>CRM</b><small>Danh sách khách</small></span></button>
          <button onclick="go('prints')">🖨 <span><b>Mẫu in</b><small>K80 & A4</small></span></button>
        </div>
      </div>${nav()}`;
  };

  function crmRows(){
    const q=String(state.desktopCrmQuery||'').toLowerCase();
    return db.customers.filter(c=>{
      const statusOk=state.desktopCrmStatus==='all'||c.status===state.desktopCrmStatus;
      const text=[c.name,c.phone,c.phone2,c.status,c.need,c.budget,c.source,c.note].join(' ').toLowerCase();
      return statusOk&&(!q||text.includes(q));
    });
  }
  function crmTableHtml(){
    const rows=crmRows();
    return `<div class="pro-crm-table"><div class="pro-crm-row head"><div>Khách hàng</div><div>Trạng thái</div><div>Nhu cầu / ngân sách</div><div>Care tiếp theo</div><div class="right">Doanh số / nợ</div></div>${rows.map(c=>`<button class="pro-crm-row" onclick="openDesktopCrmDetail(${c.id})"><div><b>${esc(c.name)}</b><div class="small muted">${esc(c.phone||'Chưa có SĐT')}${c.source?` • ${esc(c.source)}`:''}</div></div><div><span class="badge">${esc(c.status||'Khách mới')}</span></div><div><b class="pro-one-line">${esc(c.need||'Chưa ghi nhu cầu')}</b><div class="small muted">${esc(c.budget||'Chưa có ngân sách')}</div></div><div>${c.nextCareAt?`<b>${fmtDateTime(c.nextCareAt)}</b><div class="small ${new Date(c.nextCareAt)<new Date()?'danger-text':'muted'}">${new Date(c.nextCareAt)<new Date()?'Quá hạn':esc(c.careChannel||'')}</div>`:'<span class="muted">Chưa đặt lịch</span>'}</div><div class="right"><b>${money(c.total||0)}</b>${c.debt?`<div class="small danger-text">Nợ ${money(c.debt)}</div>`:'<div class="small success-text">Đã thanh toán</div>'}</div></button>`).join('')||'<div class="empty">Không có khách phù hợp bộ lọc.</div>'}</div>`;
  }
  window.filterDesktopCrm=()=>{state.desktopCrmQuery=$('#desktopCrmSearch')?.value||'';const el=$('#desktopCrmTable');if(el)el.innerHTML=crmTableHtml()};
  window.setDesktopCrmStatus=v=>{state.desktopCrmStatus=v;const el=$('#desktopCrmTable');if(el)el.innerHTML=crmTableHtml()};
  window.openDesktopCrmDetail=id=>{const c=customer(id);if(!c)return;state.modal={type:'crmDetail',c};render()};

  window.crmCustomersView=function(){
    if(!isDesktop())return baseCrmCustomersView();
    const statuses=['all',...Array.from(new Set(db.customers.map(c=>c.status).filter(Boolean)))];
    const total=db.customers.length,active=db.customers.filter(c=>!['Đã mua hàng','Không mua'].includes(c.status)).length;
    const overdue=db.customers.filter(c=>c.nextCareAt&&new Date(c.nextCareAt)<new Date()&&c.status!=='Đã mua hàng').length;
    const closed=db.customers.filter(c=>c.status==='Đã mua hàng').length;
    return `${topbar('CRM • Khách hàng','Danh sách quản lý tập trung • chăm sóc • pipeline')}
      <div class="content pro-crm-page">${typeof crmTabs==='function'?crmTabs('crmCustomers'):''}
        <div class="pro-crm-kpis">${kpi('👤','Tổng khách',total)}${kpi('◉','Đang xử lý',active)}${kpi('!','Quá hạn care',overdue,'Cần xử lý sớm','red')}${kpi('✓','Đã mua hàng',closed,'Khách đã chốt','green')}</div>
        <div class="pro-list-toolbar"><div class="searchrow"><input id="desktopCrmSearch" value="${esc(state.desktopCrmQuery||'')}" placeholder="Tìm tên, SĐT, nhu cầu, nguồn khách..." oninput="filterDesktopCrm()"></div><select onchange="setDesktopCrmStatus(this.value)">${statuses.map(s=>`<option value="${esc(s)}" ${state.desktopCrmStatus===s?'selected':''}>${s==='all'?'Tất cả trạng thái':esc(s)}</option>`).join('')}</select><button class="btn primary" onclick="openCrmCustomerForm()">＋ Thêm khách CRM</button></div>
        <div id="desktopCrmTable">${crmTableHtml()}</div>
      </div>${nav()}`;
  };

  function posGrid(list){return posProductCards(list)}
  window.posView=function(){
    if(!isDesktop())return basePosView();
    const count=db.cart.reduce((a,b)=>a+b.qty,0),c=state.activeCustomer,total=cartTotal();
    return `${topbar('Bán hàng / POS','Bán hàng PC • Barcode • IMEI/Serial • không cuộn toàn màn hình')}
      <main class="pro-pos">
        <section class="pro-pos-left">
          <div class="pro-orderbar"><div class="pro-order-tab active"><b>Đơn hàng 1</b><span>${count} SP</span></div><div class="pro-order-actions"><span>F2: Tìm hàng</span><span>F4: Thanh toán</span></div></div>
          <div class="pro-pos-search"><div class="searchrow"><input id="posSearch" autofocus placeholder="Tên sản phẩm / SKU / barcode / IMEI / Serial" oninput="renderPosProducts()"><button class="btn accent" onclick="openScanner('pos')">📷 Quét mã</button></div><button class="btn ghost" onclick="openProductForm()">＋ Sản phẩm</button><button class="btn ghost" onclick="openStockReceipt()">📥 Nhập hàng</button></div>
          <div class="pro-pos-info"><span><b>${db.products.length}</b> sản phẩm</span><span><b>${db.products.reduce((a,p)=>a+(p.stock||0),0)}</b> tồn kho</span><span><b>${db.imeis.filter(i=>i.status==='Trong kho').length}</b> IMEI trong kho</span></div>
          <div id="posProducts" class="desktop-product-grid pro-product-grid">${posGrid(db.products.slice(0,80))}</div>
        </section>
        <aside class="pro-pos-cart">
          <div class="pro-cart-title"><div><b>Thông tin đơn hàng</b><div class="small muted">Đơn hàng 1 • ${count} sản phẩm</div></div>${db.cart.length?`<button class="btn ghost small" onclick="clearDesktopCart()">Xóa giỏ</button>`:''}</div>
          <button class="pro-customer-select" onclick="openCustomerPicker()"><div><span>Khách hàng</span><b>${c?esc(c.name):'Khách lẻ'}</b>${c?.phone?`<small>${esc(c.phone)}</small>`:''}</div><div class="right">${c?.debt?`<span class="badge red">Nợ ${money(c.debt)}</span>`:'<span class="badge">Chọn khách ›</span>'}</div></button>
          <div class="pro-cart-items">${db.cart.length?cartCards():'<div class="desktop-cart-empty"><div><div style="font-size:38px">🛒</div><b>Chưa có sản phẩm</b><div class="small muted" style="margin-top:5px">Chọn hàng bên trái hoặc quét barcode.</div></div></div>'}</div>
          <div class="pro-cart-summary"><div><span>Tạm tính</span><b>${money(total)}</b></div><div><span>Số lượng</span><b>${count} sản phẩm</b></div>${c?.debt?`<div class="danger-text"><span>Công nợ cũ</span><b>${money(c.debt)}</b></div>`:''}<div class="grand"><span>TỔNG CỘNG</span><b>${money(total)}</b></div><button class="btn success block" onclick="openCheckout()" ${db.cart.length?'':'disabled'}>THANH TOÁN <span class="pro-key">F4</span></button></div>
        </aside>
      </main>${nav()}`;
  };
  window.clearDesktopCart=()=>{if(!db.cart.length)return;if(confirm('Xóa toàn bộ sản phẩm khỏi giỏ hàng?')){db.cart=[];saveDB();render()}};

  function printStyle(tpl){tpl.style=tpl.style||{};return {scale:Number(tpl.style.scale||1),lineHeight:Number(tpl.style.lineHeight||1.45),density:tpl.style.density||'normal',font:tpl.style.font||'Arial',...tpl.style}}
  window.renderPrintContent=renderPrintContent=function(tpl,doc){
    const html=baseRenderPrintContent(tpl,doc),s=printStyle(tpl);
    return `<div class="kpos-print-styled density-${esc(s.density)}" style="zoom:${s.scale};line-height:${s.lineHeight};font-family:${esc(s.font)},sans-serif">${html}</div>`;
  };
  function fieldLabels(tpl){return tpl.docType==='sale'?{store:'Tên cửa hàng',address:'Địa chỉ',phone:'Hotline',code:'Mã hóa đơn',date:'Ngày bán',customer:'Khách hàng',items:'Danh sách sản phẩm',total:'Tổng thanh toán',payment:'Phương thức thanh toán',warranty:'Bảo hành',qr:'QR hỗ trợ',signature:'Chữ ký'}:{store:'Tên cửa hàng',address:'Địa chỉ',phone:'Hotline',code:'Mã phiếu',date:'Ngày tiếp nhận',customer:'Khách hàng',product:'Sản phẩm',imei:'IMEI / Serial',issue:'Lỗi tiếp nhận',warrantyTerm:'Thời hạn bảo hành',qr:'QR hỗ trợ',signature:'Chữ ký'}}
  function templateSample(tpl){return tpl.docType==='sale'?sampleSaleDoc():sampleWarrantyDoc()}
  window.updateDesktopTplStyle=(key,val)=>{if(!state.modal?.tpl)return;state.modal.tpl.style=state.modal.tpl.style||{};state.modal.tpl.style[key]=val;const p=$('#proPrintLivePreview');if(p)p.innerHTML=renderPrintContent(state.modal.tpl,templateSample(state.modal.tpl))};
  window.updateDesktopTplText=(key,val)=>{if(!state.modal?.tpl)return;state.modal.tpl[key]=val};
  window.selectDesktopPrint=id=>{state.desktopPrintId=id;render()};

  window.printsView=function(){
    if(!isDesktop())return basePrintsView();
    const type=state.printDocType||'sale',list=getTemplates(type);let tpl=getTemplate(state.desktopPrintId);if(!tpl||tpl.docType!==type)tpl=list[0];if(tpl)state.desktopPrintId=tpl.id;
    return `${topbar('Mẫu in','Thiết kế K80 / A4 • review trực quan trên màn hình rộng')}
      <div class="content pro-print-page"><div class="pro-print-top">${printTabs(type)}<div class="small muted">Chọn mẫu bên trái để xem nhanh; bấm <b>Chỉnh trực quan</b> để mở editor 2 cột.</div></div>
        <div class="pro-print-layout"><aside class="pro-template-list">${list.map(t=>`<button class="pro-template-item ${tpl?.id===t.id?'active':''}" onclick="selectDesktopPrint('${t.id}')"><div><span class="template-chip">${t.paper}</span><b>${esc(t.name)}</b><small>${esc(t.desc||'')}</small></div><span>›</span></button>`).join('')}</aside>
        <section class="pro-print-stage">${tpl?`<div class="pro-print-stage-head"><div><b>${esc(tpl.name)}</b><div class="small muted">${tpl.paper} • ${tpl.docType==='sale'?'Hóa đơn bán hàng':'Phiếu bảo hành'}</div></div><div><button class="btn ghost" onclick="previewTemplate('${tpl.id}')">Preview lớn</button> <button class="btn primary" onclick="openTemplateEditor('${tpl.id}')">Chỉnh trực quan</button></div></div><div class="pro-paper-canvas ${tpl.paper==='K80'?'k80':'a4'}"><div class="template-preview">${renderPrintContent(tpl,templateSample(tpl))}</div></div>`:'<div class="empty">Chưa có mẫu in.</div>'}</section></div>
      </div>${nav()}`;
  };

  function desktopTemplateEditor(m){
    const tpl=m.tpl,s=printStyle(tpl),labels=fieldLabels(tpl),sample=templateSample(tpl);
    return `<div class="modal-backdrop pro-print-modal" onclick="if(event.target===this)closeModal()"><div class="sheet pro-template-sheet"><div class="sheet-head"><div><div class="sheet-title">Chỉnh mẫu in</div><div class="small muted">${tpl.paper} • Review trực tiếp</div></div><button class="close" onclick="closeModal()">×</button></div><div class="pro-editor-grid"><aside class="pro-editor-controls"><div class="field"><label>Tên mẫu</label><input id="tpl_name" value="${esc(tpl.name)}" oninput="updateDesktopTplText('name',this.value)"></div><div class="field"><label>Mô tả</label><input id="tpl_desc" value="${esc(tpl.desc||'')}" oninput="updateDesktopTplText('desc',this.value)"></div><div class="pro-editor-section"><b>Kiểu hiển thị</b><div class="form-row" style="margin-top:9px"><div class="field"><label>Cỡ chữ</label><select onchange="updateDesktopTplStyle('scale',this.value)"><option value="0.9" ${s.scale===0.9?'selected':''}>Nhỏ</option><option value="1" ${s.scale===1?'selected':''}>Chuẩn</option><option value="1.1" ${s.scale===1.1?'selected':''}>Lớn</option><option value="1.2" ${s.scale===1.2?'selected':''}>Rất lớn</option></select></div><div class="field"><label>Mật độ</label><select onchange="updateDesktopTplStyle('density',this.value)"><option value="compact" ${s.density==='compact'?'selected':''}>Gọn</option><option value="normal" ${s.density==='normal'?'selected':''}>Chuẩn</option><option value="relaxed" ${s.density==='relaxed'?'selected':''}>Thoáng</option></select></div></div><div class="form-row"><div class="field"><label>Dòng chữ</label><select onchange="updateDesktopTplStyle('lineHeight',this.value)"><option value="1.25" ${s.lineHeight===1.25?'selected':''}>Gọn</option><option value="1.45" ${s.lineHeight===1.45?'selected':''}>Chuẩn</option><option value="1.65" ${s.lineHeight===1.65?'selected':''}>Thoáng</option></select></div><div class="field"><label>Font</label><select onchange="updateDesktopTplStyle('font',this.value)"><option ${s.font==='Arial'?'selected':''}>Arial</option><option ${s.font==='Tahoma'?'selected':''}>Tahoma</option><option ${s.font==='Verdana'?'selected':''}>Verdana</option></select></div></div></div><div class="pro-editor-section"><b>Thông tin hiển thị</b><div class="checklist pro-checklist">${Object.keys(labels).map(k=>`<label class="checkrow"><input type="checkbox" ${tpl.fields[k]?'checked':''} onchange="toggleTplField('${k}')"><div>${labels[k]}</div></label>`).join('')}</div></div><div class="pro-editor-actions"><button class="btn ghost" onclick="previewTemplate('${tpl.id}')">Preview lớn</button><button class="btn primary" onclick="saveTemplateEditor()">LƯU MẪU</button></div></aside><section class="pro-editor-preview"><div class="pro-editor-preview-head"><b>Review trực tiếp</b><span class="template-chip">${tpl.paper}</span></div><div class="pro-paper-canvas ${tpl.paper==='K80'?'k80':'a4'}"><div id="proPrintLivePreview" class="template-preview">${renderPrintContent(tpl,sample)}</div></div></section></div></div></div>`;
  }
  function desktopPrintPreview(m){return `<div class="modal-backdrop pro-print-modal" onclick="if(event.target===this)closeModal()"><div class="sheet pro-preview-sheet"><div class="sheet-head"><div><div class="sheet-title">Xem trước mẫu in</div><div class="small muted">${esc(m.tpl.name)} • ${m.tpl.paper}</div></div><button class="close" onclick="closeModal()">×</button></div><div class="pro-paper-canvas ${m.tpl.paper==='K80'?'k80':'a4'}"><div class="template-preview">${renderPrintContent(m.tpl,m.doc)}</div></div><div class="split-buttons" style="margin-top:14px"><button class="btn ghost" onclick="openTemplateEditor('${m.tpl.id}')">CHỈNH MẪU</button><button class="btn primary" onclick="printCurrentTemplate()">IN NGAY</button></div></div></div>`}
  window.modalView=modalView=function(){if(isDesktop()&&state.modal?.type==='templateEditor')return desktopTemplateEditor(state.modal);if(isDesktop()&&state.modal?.type==='printPreview')return desktopPrintPreview(state.modal);return baseModalView()};

  if(!window.__KPOS_PRO_KEYS__){window.__KPOS_PRO_KEYS__=true;window.addEventListener('keydown',e=>{if(!isDesktop()||state.screen!=='pos'||state.modal)return;if(e.key==='F2'){e.preventDefault();$('#posSearch')?.focus()}if(e.key==='F4'){e.preventDefault();if(db.cart.length)openCheckout()}if(e.key==='/'&&document.activeElement?.tagName!=='INPUT'){e.preventDefault();$('#posSearch')?.focus()}})}
})();