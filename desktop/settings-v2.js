/* KPOS Settings V2 - unified configuration hub */
(function(){
  const baseRender=window.render;
  const baseOpenCrmCustomerForm=window.openCrmCustomerForm;
  const baseOpenWarrantyForm=window.openWarrantyForm;
  const baseUpdateCartUnitPrice=window.updateCartUnitPrice;

  const CRM_STATUSES=(window.KPOS_CRM_STATUSES||[['Khách mới','Khách mới'],['Chưa liên hệ','Chưa liên hệ'],['Đã liên hệ','Đã liên hệ'],['Đang tư vấn','Đang tư vấn'],['Khách quan tâm','Khách quan tâm'],['Chờ khách phản hồi','Chờ phản hồi'],['Hẹn gọi lại','Hẹn gọi lại'],['Hẹn gặp/demo','Hẹn gặp/demo'],['Đang báo giá','Đang báo giá'],['Đang cân nhắc','Đang cân nhắc'],['Đã mua hàng','Đã mua'],['Không mua','Không mua'],['Mất khách','Mất khách']]);
  const n=v=>Number(v)||0;

  function ensure(){
    db.storeProfile={name:'CÔNG TY TNHH PHẦN MỀM KPOS',short:'KPOS',address:'Hồ Chí Minh',phone:'',logo:'',footer:'Cảm ơn Quý khách đã tin tưởng KPOS.',...(db.storeProfile||{})};
    db.appSettings=db.appSettings||{};
    db.appSettings.sales={allowPriceEdit:true,allowBackdate:true,defaultSurchargeName:'Phụ thu',...(db.appSettings.sales||{})};
    db.appSettings.crm={defaultStatus:'Khách mới',defaultCareDays:0,defaultOwner:'',...(db.appSettings.crm||{})};
    db.appSettings.warranty={defaultPromiseDays:3,defaultTechnician:'',...(db.appSettings.warranty||{})};
    db.appSettings.inventory={showLowStock:true,...(db.appSettings.inventory||{})};
    db.printDefaults=db.printDefaults||{};
    if(!db.loyaltySettings)db.loyaltySettings={enabled:true,earnRate:100000,pointValue:1000};
  }
  ensure();

  function cloud(){return window.KPOS_CLOUD||{configured:false,status:'Offline'}}
  function roleLabel(r){return r==='owner'?'Chủ cửa hàng':r==='manager'?'Quản lý':r==='staff'?'Nhân viên':'—'}
  function section(id,icon,title,sub,body){return `<section id="sv2-${id}" class="sv2-card"><div class="sv2-card-head"><div class="sv2-icon">${icon}</div><div><h3>${title}</h3><p>${sub}</p></div></div><div class="sv2-card-body">${body}</div></section>`}
  function kv(label,value,tone=''){return `<div class="sv2-kv"><span>${label}</span><b class="${tone}">${value}</b></div>`}
  function action(icon,title,sub,onclick,badge=''){return `<button class="sv2-action" onclick="${onclick}"><span class="sv2-action-icon">${icon}</span><span><b>${title}</b><small>${sub}</small></span>${badge?`<em>${badge}</em>`:''}<strong>›</strong></button>`}
  function checked(v){return v?'checked':''}
  function templateSelect(type,paper){const rows=(db.printTemplates||[]).filter(t=>t.docType===type&&t.paper===paper);const current=db.printDefaults?.[type]?.[paper]||'';return `<select onchange="setDefaultPrintTemplate(this.value)">${rows.map(t=>`<option value="${t.id}" ${t.id===current?'selected':''}>${esc(t.name)}</option>`).join('')}</select>`}

  window.settingsJump=id=>document.querySelector(`#sv2-${id}`)?.scrollIntoView({behavior:'smooth',block:'start'});

  window.saveSettingsStore=()=>{
    ensure();
    db.storeProfile.name=$('#sv2_store_name')?.value.trim()||'CÔNG TY TNHH PHẦN MỀM KPOS';
    db.storeProfile.short=$('#sv2_store_short')?.value.trim()||'KPOS';
    db.storeProfile.address=$('#sv2_store_address')?.value.trim()||'';
    db.storeProfile.phone=$('#sv2_store_phone')?.value.trim()||'';
    db.storeProfile.footer=$('#sv2_store_footer')?.value.trim()||'';
    try{if(typeof storeProfile!=='undefined')Object.assign(storeProfile,db.storeProfile)}catch(e){}
    saveDB();toast('Đã lưu thông tin cửa hàng');render();
  };
  window.saveSettingsSales=()=>{
    ensure();const s=db.appSettings.sales;
    s.allowPriceEdit=!!$('#sv2_sale_price')?.checked;s.allowBackdate=!!$('#sv2_sale_backdate')?.checked;s.defaultSurchargeName=$('#sv2_sale_surcharge')?.value.trim()||'Phụ thu';saveDB();toast('Đã lưu cấu hình bán hàng');render();
  };
  window.saveSettingsCrm=()=>{
    ensure();const s=db.appSettings.crm;s.defaultStatus=$('#sv2_crm_status')?.value||'Khách mới';s.defaultCareDays=Math.max(0,n($('#sv2_crm_days')?.value));s.defaultOwner=$('#sv2_crm_owner')?.value.trim()||'';saveDB();toast('Đã lưu cấu hình CRM');render();
  };
  window.saveSettingsWarranty=()=>{
    ensure();const s=db.appSettings.warranty;s.defaultPromiseDays=Math.max(0,n($('#sv2_warranty_days')?.value));s.defaultTechnician=$('#sv2_warranty_tech')?.value.trim()||'';saveDB();toast('Đã lưu cấu hình bảo hành');render();
  };
  window.saveSettingsLoyalty=()=>{
    const s=db.loyaltySettings;s.enabled=!!$('#sv2_loyal_enabled')?.checked;s.earnRate=Math.max(1,n($('#sv2_loyal_rate')?.value)||100000);s.pointValue=Math.max(0,n($('#sv2_loyal_value')?.value));saveDB();toast('Đã lưu tích điểm');render();
  };
  window.toggleLowStockSetting=v=>{ensure();db.appSettings.inventory.showLowStock=!!v;saveDB();toast('Đã lưu cấu hình kho')};

  /* Apply selected settings to existing business flows. */
  if(baseUpdateCartUnitPrice){
    window.updateCartUnitPrice=(productId,value)=>{ensure();if(db.appSettings.sales.allowPriceEdit===false)return toast('Cài đặt hiện không cho phép sửa giá trực tiếp tại POS');return baseUpdateCartUnitPrice(productId,value)};
  }
  if(baseOpenCrmCustomerForm){
    window.openCrmCustomerForm=(id=null)=>{
      baseOpenCrmCustomerForm(id);
      if(!id&&state.modal?.type==='crm2Form'){
        ensure();const s=db.appSettings.crm,c=state.modal.c;c.status=s.defaultStatus||'Khách mới';if(s.defaultOwner)c.owner=s.defaultOwner;if(n(s.defaultCareDays)>0&&!c.nextCareAt){const d=new Date();d.setDate(d.getDate()+n(s.defaultCareDays));c.nextCareAt=d.toISOString()}render();
      }
    };
  }
  if(baseOpenWarrantyForm){
    window.openWarrantyForm=(imeiValue='')=>{
      baseOpenWarrantyForm(imeiValue);
      if(state.modal?.type==='warrantyForm'){
        ensure();const s=db.appSettings.warranty,d=state.modal.draft;if(s.defaultTechnician&&!d.technician)d.technician=s.defaultTechnician;if(n(s.defaultPromiseDays)>0&&!d.promisedAt){const x=new Date();x.setDate(x.getDate()+n(s.defaultPromiseDays));d.promisedAt=x.toISOString()}render();
      }
    };
  }

  function storeBlock(){const p=db.storeProfile;return section('store','🏪','Thông tin cửa hàng','Dùng chung trên hóa đơn, bảo hành và phiếu trả/đổi',`<div class="sv2-form-grid"><label>Tên ngắn<input id="sv2_store_short" value="${esc(p.short||'')}"></label><label>Hotline<input id="sv2_store_phone" value="${esc(p.phone||'')}"></label><label class="wide">Tên công ty / cửa hàng<input id="sv2_store_name" value="${esc(p.name||'')}"></label><label class="wide">Địa chỉ<input id="sv2_store_address" value="${esc(p.address||'')}"></label><label class="wide">Lời cảm ơn<textarea id="sv2_store_footer" rows="2">${esc(p.footer||'')}</textarea></label></div><div class="sv2-row-actions"><button class="btn primary" onclick="saveSettingsStore()">LƯU THÔNG TIN</button><button class="btn ghost" onclick="go('prints')">Xem mẫu in</button></div>`)}

  function salesBlock(){const s=db.appSettings.sales;return section('sales','🛒','Bán hàng / POS','Thiết lập hành vi trực tiếp ở màn bán hàng',`<div class="sv2-switch-list"><label><span><b>Cho phép sửa giá bán tại POS</b><small>Tắt mục này sẽ chặn thay đổi giá trên dòng sản phẩm.</small></span><input id="sv2_sale_price" type="checkbox" ${checked(s.allowPriceEdit!==false)}></label><label><span><b>Cho phép chỉnh ngày giờ bán</b><small>Cho phép nhập ngày giờ khác thời điểm hiện tại.</small></span><input id="sv2_sale_backdate" type="checkbox" ${checked(s.allowBackdate!==false)}></label><label class="locked"><span><b>Đơn ghi nợ bắt buộc chọn khách</b><small>Quy tắc an toàn cố định để công nợ luôn có người chịu nợ.</small></span><em>Luôn bật</em></label></div><div class="sv2-form-grid one"><label>Tên phụ thu mặc định<input id="sv2_sale_surcharge" value="${esc(s.defaultSurchargeName||'Phụ thu')}" placeholder="Phụ thu"></label></div><div class="sv2-row-actions"><button class="btn primary" onclick="saveSettingsSales()">LƯU BÁN HÀNG</button><button class="btn ghost" onclick="go('pos')">Mở POS</button></div>`)}

  function inventoryBlock(){const low=(db.products||[]).filter(p=>n(p.stock)<=n(p.minStock)).length;return section('inventory','📦','Kho & hàng hóa','Tồn kho • IMEI/Serial • nhà cung cấp • kiểm kho • Excel',`<div class="sv2-metrics">${kv('Sản phẩm',(db.products||[]).length)}${kv('IMEI trong kho',(db.imeis||[]).filter(i=>i.status==='Trong kho').length)}${kv('Hàng sắp hết',low,low?'danger-text':'')}${kv('Nhà cung cấp',(db.suppliers||[]).length)}</div><div class="sv2-switch-list"><label><span><b>Hiển thị cảnh báo tồn thấp</b><small>Dựa trên Tồn tối thiểu của từng sản phẩm.</small></span><input type="checkbox" ${checked(db.appSettings.inventory.showLowStock!==false)} onchange="toggleLowStockSetting(this.checked)"></label></div><div class="sv2-actions-grid">${action('📥','Nhập hàng','Nhà cung cấp • giá nhập • IMEI',"go('stock')")}${action('✅','Kiểm kho','So tồn hệ thống với thực tế','openStocktake()')}${action('⇅','Điều chỉnh kho','Tăng/giảm tồn có chứng từ',"goInventoryPro('adjustments')")}${action('🏭','Nhà cung cấp','Lịch sử nhập và giá mua',"goInventoryPro('suppliers')")}</div>`)}

  function crmBlock(){const s=db.appSettings.crm;return section('crm','👤','Khách hàng / CRM','Mặc định khi tạo khách mới và lịch chăm sóc',`<div class="sv2-form-grid"><label>Trạng thái mặc định<select id="sv2_crm_status">${CRM_STATUSES.map(([v,l])=>`<option value="${esc(v)}" ${v===s.defaultStatus?'selected':''}>${esc(l)}</option>`).join('')}</select></label><label>Nhắc care sau số ngày<input id="sv2_crm_days" type="number" min="0" value="${n(s.defaultCareDays)}"></label><label class="wide">Người phụ trách mặc định<input id="sv2_crm_owner" value="${esc(s.defaultOwner||'')}" placeholder="Để trống nếu không cần"></label></div><div class="sv2-row-actions"><button class="btn primary" onclick="saveSettingsCrm()">LƯU CRM</button><button class="btn ghost" onclick="go('crmDashboard')">Mở CRM</button></div>`)}

  function warrantyBlock(){const s=db.appSettings.warranty;return section('warranty','🛠️','Bảo hành','Thiết lập mặc định khi tiếp nhận máy',`<div class="sv2-form-grid"><label>Hẹn trả mặc định sau<input id="sv2_warranty_days" type="number" min="0" value="${n(s.defaultPromiseDays)}"><small>ngày</small></label><label>Kỹ thuật phụ trách mặc định<input id="sv2_warranty_tech" value="${esc(s.defaultTechnician||'')}" placeholder="VD: Kỹ thuật KPOS"></label></div><div class="sv2-row-actions"><button class="btn primary" onclick="saveSettingsWarranty()">LƯU BẢO HÀNH</button><button class="btn ghost" onclick="go('warranty')">Mở Bảo hành</button></div>`)}

  function loyaltyBlock(){const s=db.loyaltySettings||{};return section('loyalty','🎁','Voucher & tích điểm','Cấu hình điểm khách hàng và quản lý mã ưu đãi',`<div class="sv2-switch-list"><label><span><b>Bật tích điểm khách hàng</b><small>Tự cộng điểm sau thanh toán và cho phép dùng điểm trên POS.</small></span><input id="sv2_loyal_enabled" type="checkbox" ${checked(s.enabled!==false)}></label></div><div class="sv2-form-grid"><label>Chi tiêu để được 1 điểm<input id="sv2_loyal_rate" type="number" min="1" value="${n(s.earnRate)||100000}"></label><label>Giá trị 1 điểm<input id="sv2_loyal_value" type="number" min="0" value="${n(s.pointValue)||1000}"></label></div><div class="sv2-row-actions"><button class="btn primary" onclick="saveSettingsLoyalty()">LƯU TÍCH ĐIỂM</button><button class="btn ghost" onclick="go('promos')">Quản lý Voucher</button></div>`)}

  function printBlock(){return section('print','🖨️','Máy in & mẫu in','K80 / A4 • mẫu mặc định • review trực tiếp',`<div class="sv2-print-grid"><div><b>Hóa đơn bán hàng</b><label>K80 ${templateSelect('sale','K80')}</label><label>A4 ${templateSelect('sale','A4')}</label></div><div><b>Phiếu bảo hành</b><label>K80 ${templateSelect('warranty','K80')}</label><label>A4 ${templateSelect('warranty','A4')}</label></div><div><b>Phiếu trả / đổi</b><label>K80 ${templateSelect('return','K80')}</label><label>A4 ${templateSelect('return','A4')}</label></div></div><div class="notice" style="margin-top:12px">Hiện KPOS dùng <b>hộp thoại in của trình duyệt</b> cho K80/A4. Kết nối ESC/POS/Bluetooth trực tiếp chưa được bật trong bản web.</div><div class="sv2-row-actions"><button class="btn primary" onclick="go('prints')">CHỈNH MẪU IN</button></div>`)}

  function dataBlock(){return section('data','💾','Dữ liệu & Excel','Sao lưu, khôi phục và nhập/xuất hàng hóa',`<div class="sv2-actions-grid">${action('⬇','Xuất dữ liệu JSON','Sao lưu toàn bộ dữ liệu KPOS','exportData()')}${action('⬆','Khôi phục JSON','Nạp lại bản sao lưu đã xuất','importData()')}${action('📊','Xuất Excel hàng hóa','Sản phẩm + nhà cung cấp','exportProductsExcel()')}${action('📥','Nhập Excel hàng hóa','Ghép theo SKU / Barcode','importProductsExcel()')}</div><div class="sv2-danger-zone"><div><b>Khôi phục dữ liệu mẫu</b><small>Xóa dữ liệu hiện tại trên app và đưa về dữ liệu mẫu. Hãy xuất JSON trước khi thực hiện.</small></div><button class="btn danger" onclick="resetData()">KHÔI PHỤC MẪU</button></div>`)}

  function cloudBlock(){const c=cloud(),status=c.configured?(c.status||'Đang kết nối'):'Offline',tone=status==='Đã đồng bộ'?'success-text':status==='Lỗi đồng bộ'?'danger-text':'';return section('cloud','☁️','Supabase & đồng bộ','Đăng nhập • Realtime • nhiều thiết bị',`<div id="v8-cloud-card" class="sv2-cloud"><div class="sv2-metrics">${kv('Trạng thái',esc(status),tone)}${kv('Vai trò',esc(roleLabel(c.role)))}${kv('Revision',n(c.revision))}${kv('Thiết bị',navigator.onLine?'Online':'Offline',navigator.onLine?'success-text':'danger-text')}</div><div class="sv2-account"><b>${c.user?esc(c.user.email||'Tài khoản online'):'Chưa đăng nhập'}</b><small>${c.workspaceId?`Workspace: ${esc(c.workspaceId)}`:'Chưa có workspace'}${c.updatedAt?` • Đồng bộ ${fmtDateTime(c.updatedAt)}`:''}</small></div>${c.lastError?`<div class="notice" style="margin-top:10px">${esc(c.lastError)}</div>`:''}<div class="sv2-row-actions"><button class="btn primary" onclick="syncNow()" ${c.user?'':'disabled'}>ĐỒNG BỘ NGAY</button>${c.user?'<button class="btn ghost" onclick="logout()">ĐĂNG XUẤT</button>':''}</div></div>`)}

  function staffBlock(){const c=cloud(),allowed=['owner','manager'].includes(c.role);return section('staff','👥','Nhân viên & phân quyền','Quản lý tài khoản dùng chung workspace',`<div class="sv2-account"><b>${esc(roleLabel(c.role))}</b><small>${allowed?'Có quyền quản lý nhân viên và phân quyền module.':'Tài khoản hiện tại không có quyền quản lý nhân viên.'}</small></div><div class="sv2-perm-tags">${['POS','Sản phẩm','Kho & IMEI','Khách hàng','CRM','Bảo hành','Công nợ','Báo cáo','Cài đặt'].map(x=>`<span>${x}</span>`).join('')}</div><div class="sv2-row-actions"><button class="btn primary" onclick="go('staff')" ${allowed?'':'disabled'}>QUẢN LÝ NHÂN VIÊN</button></div>`)}

  function auditBlock(){let r=null;try{r=window.KPOS_FINAL_AUDIT?.()}catch(e){}const err=r?.summary?.errors||0,warn=r?.summary?.warnings||0;return section('audit','🧪','Kiểm tra hệ thống','Đối soát chứng từ • kho • IMEI • công nợ • đồng bộ',`<div id="kpos-system-audit"><div id="final-business-audit-card" class="sv2-metrics">${kv('Lỗi',err,err?'danger-text':'success-text')}${kv('Cảnh báo',warn,warn?'':'success-text')}${kv('Hóa đơn',(db.invoices||[]).length)}${kv('IMEI',(db.imeis||[]).length)}</div><div class="notice" style="margin-top:12px">Hệ thống chỉ tự sửa các sai lệch có thể xác định chắc chắn. Tồn kho/IMEI lệch danh tính sẽ không bị tự sửa mù.</div><div class="sv2-row-actions"><button class="btn primary" onclick="runFinalBusinessAudit()">RÀ SOÁT NGHIỆP VỤ</button><button class="btn ghost" onclick="runKposSystemAudit()">KIỂM TRA LIÊN KẾT</button><button class="btn ghost" onclick="safeRepairKposData()">SỬA AN TOÀN</button></div></div>`)}

  window.settingsView=settingsView=function(){ensure();const navItems=[['store','🏪','Cửa hàng'],['sales','🛒','Bán hàng'],['inventory','📦','Kho'],['crm','👤','CRM'],['warranty','🛠️','Bảo hành'],['loyalty','🎁','Voucher / điểm'],['print','🖨️','In ấn'],['data','💾','Dữ liệu'],['cloud','☁️','Supabase'],['staff','👥','Nhân viên'],['audit','🧪','Kiểm tra']];return `${topbar('Cài đặt','Toàn bộ cấu hình KPOS trong một màn hình')}<div class="content sv2-page"><div class="sv2-layout"><aside class="sv2-nav"><div class="sv2-nav-title"><b>Cài đặt hệ thống</b><small>KPOS • Web & Mobile</small></div>${navItems.map(([id,ic,l])=>`<button onclick="settingsJump('${id}')"><span>${ic}</span>${l}</button>`).join('')}</aside><main class="sv2-main">${storeBlock()}${salesBlock()}${inventoryBlock()}${crmBlock()}${warrantyBlock()}${loyaltyBlock()}${printBlock()}${dataBlock()}${cloudBlock()}${staffBlock()}${auditBlock()}<div class="sv2-version">KPOS • build cấu hình V2 • dữ liệu được lưu cục bộ và đồng bộ Supabase khi tài khoản online hoạt động.</div></main></div></div>${nav()}`};

  function applyLiveSettings(){
    if(state.screen==='pos'){
      ensure();const s=db.appSettings.sales;
      if(s.allowPriceEdit===false)document.querySelectorAll('.pos3-line-meta input[type="number"]').forEach(x=>{x.disabled=true;x.title='Đã tắt sửa giá trong Cài đặt'});
    }
    if(state.modal?.type==='posV3Checkout'){
      ensure();const s=db.appSettings.sales,name=$('#co_surcharge_name'),date=$('#co_date');if(name&&(!name.value||name.value==='Phụ thu'))name.value=s.defaultSurchargeName||'Phụ thu';if(date&&s.allowBackdate===false)date.disabled=true;
    }
  }

  window.render=render=function(){ensure();baseRender();setTimeout(applyLiveSettings,0)};
})();