/* KPOS Mobile V7 incremental production patch for V6 */
(function(){
  const V7_STORE_DEFAULT={name:"CÔNG TY TNHH PHẦN MỀM KPOS",short:"KPOS",address:"Hồ Chí Minh",phone:"",website:"",defaultSalePaper:"K80",defaultWarrantyPaper:"K80"};
  db.storeProfile={...V7_STORE_DEFAULT,...(db.storeProfile||{})};
  db.payments=(db.payments||[]).map(p=>({status:"Hoàn thành",...p}));
  db.invoices=(db.invoices||[]).map(i=>({cancelledAt:null,cancelReason:"",...i,status:i.status||"Hoàn thành"}));
  if(typeof storeProfile!=="undefined") Object.assign(storeProfile,db.storeProfile);
  saveDB();

  window.activeInvoices=()=>db.invoices.filter(i=>i.status!=="Đã hủy");
  window.activePayments=()=>db.payments.filter(p=>p.status!=="Đã hủy");

  window.dashboard=function(){
    const invs=activeInvoices(),pays=activePayments();
    const revenue=invs.reduce((a,b)=>a+(b.total||0),0),profit=invs.reduce((a,b)=>a+(b.profit||0),0);
    const cash=pays.filter(p=>p.method==="Tiền mặt").reduce((a,b)=>a+(b.amount||0),0),bank=pays.filter(p=>p.method==="Chuyển khoản").reduce((a,b)=>a+(b.amount||0),0);
    const debt=db.customers.reduce((a,b)=>a+(b.debt||0),0),low=db.products.filter(p=>p.stock<=p.minStock).length;
    return `${topbar("Tổng quan","KPOS • Bán hàng • CRM • IMEI • Bảo hành")}<div class="content"><div class="grid two">${stat("Doanh thu",money(revenue))}${stat("Lợi nhuận",money(profit))}${stat("Tổng đơn",invs.length)}${stat("Công nợ",money(debt))}${stat("Tiền mặt",money(cash))}${stat("Chuyển khoản",money(bank))}${stat("IMEI trong kho",db.imeis.filter(i=>i.status==="Trong kho").length)}${stat("Hàng sắp hết",low)}</div><div class="section-title">Thao tác nhanh</div><div class="actions">${action("🛒","Bán hàng","go('pos')")}${action("👥","CRM","go('crmDashboard')")}${action("📥","Nhập hàng","openStockReceipt()")}${action("🔢","Tra IMEI","go('imei')")}</div><div class="section-title">Hoạt động gần đây</div><div class="card"><div class="timeline">${db.activities.slice(0,10).map(a=>`<div class="tl"><b>${esc(a.text)}</b><div class="small muted">${esc(a.time)}</div></div>`).join("")||'<div class="empty">Chưa có hoạt động</div>'}</div></div></div>${nav()}`;
  };

  window.reportsView=function(){
    const invs=activeInvoices(),pays=activePayments();
    const revenue=invs.reduce((a,b)=>a+(b.total||0),0),profit=invs.reduce((a,b)=>a+(b.profit||0),0),debt=db.customers.reduce((a,b)=>a+(b.debt||0),0);
    const cash=pays.filter(p=>p.method==="Tiền mặt").reduce((a,b)=>a+(b.amount||0),0),bank=pays.filter(p=>p.method==="Chuyển khoản").reduce((a,b)=>a+(b.amount||0),0);
    const soldImeis=db.imeis.filter(i=>i.status==="Đã bán"||i.status==="Bảo hành").length;
    return `${topbar("Báo cáo","Bán hàng • kho • CRM • bảo hành")}<div class="content"><div class="grid two">${stat("Doanh thu",money(revenue))}${stat("Lợi nhuận",money(profit))}${stat("Công nợ",money(debt))}${stat("Tổng đơn",invs.length)}${stat("Tiền mặt",money(cash))}${stat("Chuyển khoản",money(bank))}${stat("IMEI đã bán",soldImeis)}${stat("Bảo hành",db.warranties.length)}</div><div class="section-title">Sản phẩm bán</div><div class="card table-like"><div class="table-row table-head"><div>Sản phẩm</div><div class="center">SL</div><div class="right">Doanh thu</div></div>${db.products.map(p=>{const rows=invs.flatMap(i=>i.items||[]).filter(x=>x.productId===p.id),qty=rows.reduce((a,b)=>a+b.qty,0),rev=rows.reduce((a,b)=>a+b.qty*b.price,0);return `<div class="table-row"><div>${esc(p.name)}</div><div class="center">${qty}</div><div class="right">${money(rev)}</div></div>`}).join("")}</div></div>${nav()}`;
  };

  window.settingsView=function(){
    const s=db.storeProfile;
    return `${topbar("Cài đặt","KPOS Mobile V7")}<div class="content"><div class="card"><b>Thông tin cửa hàng & mẫu in</b><div class="field" style="margin-top:12px"><label>Tên cửa hàng / công ty</label><input id="set_name" value="${esc(s.name||"")}"></div><div class="form-row"><div class="field"><label>Tên ngắn</label><input id="set_short" value="${esc(s.short||"KPOS")}"></div><div class="field"><label>Hotline</label><input id="set_phone" value="${esc(s.phone||"")}"></div></div><div class="field"><label>Địa chỉ</label><input id="set_address" value="${esc(s.address||"")}"></div><div class="field"><label>Website</label><input id="set_website" value="${esc(s.website||"")}"></div><div class="form-row"><div class="field"><label>Mặc định hóa đơn</label><select id="set_sale_paper"><option ${s.defaultSalePaper==="K80"?"selected":""}>K80</option><option ${s.defaultSalePaper==="A4"?"selected":""}>A4</option></select></div><div class="field"><label>Mặc định bảo hành</label><select id="set_warranty_paper"><option ${s.defaultWarrantyPaper==="K80"?"selected":""}>K80</option><option ${s.defaultWarrantyPaper==="A4"?"selected":""}>A4</option></select></div></div><button class="btn primary block" onclick="saveStoreSettings()">LƯU CÀI ĐẶT</button></div><div class="card" style="margin-top:12px"><b>Dữ liệu</b><p class="muted small">Xuất file backup trước khi xóa dữ liệu hoặc đổi thiết bị.</p><button class="btn ghost block" onclick="exportData()">Xuất dữ liệu JSON</button><button class="btn ghost block" style="margin-top:9px" onclick="importData()">Khôi phục từ JSON</button><button class="btn danger block" style="margin-top:9px" onclick="resetData()">Xóa dữ liệu test & khôi phục mẫu</button></div></div>${nav()}`;
  };
  window.saveStoreSettings=()=>{
    db.storeProfile={...db.storeProfile,name:$("#set_name").value.trim(),short:$("#set_short").value.trim()||"KPOS",phone:$("#set_phone").value.trim(),address:$("#set_address").value.trim(),website:$("#set_website").value.trim(),defaultSalePaper:$("#set_sale_paper").value,defaultWarrantyPaper:$("#set_warranty_paper").value};
    if(typeof storeProfile!=="undefined") Object.assign(storeProfile,db.storeProfile);
    saveDB();toast("Đã lưu thông tin cửa hàng");render();
  };

  window.openCheckout=()=>{
    for(const c of db.cart){const p=product(c.productId);if(p.imeiEnabled&&(c.selectedImeis||[]).length!==c.qty)return toast(`Chọn đủ IMEI cho ${p.name}`)}
    state.modal={type:"checkout",method:"Tiền mặt",paid:cartTotal(),discount:0,surcharge:0,saleDate:new Date().toISOString()};render();
  };

  window.finishCheckout=()=>{
    if(!db.cart.length)return;
    const subtotal=cartTotal(),discount=Math.max(0,Number($("#co_discount")?.value)||0),surcharge=Math.max(0,Number($("#co_surcharge")?.value)||0),total=Math.max(0,subtotal-discount+surcharge),method=$("#co_method").value;
    let paid=Math.max(0,Math.min(total,Number($("#co_paid").value)||0));const debt=total-paid;if(debt>0&&!state.activeCustomer)return toast("Đơn ghi nợ phải chọn khách hàng");
    const invCode=code("HD",db.invoices),selected=$("#co_date")?.value,now=selected?new Date(selected).toISOString():new Date().toISOString();
    const items=db.cart.map(c=>({productId:c.productId,qty:c.qty,price:product(c.productId).price,imeis:[...(c.selectedImeis||[])]})),profit=items.reduce((s,it)=>{const p=product(it.productId);return s+(p.price-p.cost)*it.qty},0);
    const inv={id:Date.now(),code:invCode,date:now,customerId:state.activeCustomer?.id||null,subtotal,discount,surcharge,total,paid,debt,paymentMethod:method,profit,items,status:debt>0?"Công nợ":"Hoàn thành",cancelledAt:null,cancelReason:""};db.invoices.unshift(inv);
    items.forEach(it=>{const p=product(it.productId);p.stock-=it.qty;addMovement(p.id,-it.qty,"SALE",inv.code,"Bán hàng");it.imeis.forEach(iid=>{const im=imeiObj(iid);if(im){im.status="Đã bán";im.customerId=inv.customerId;im.invoiceId=inv.id;im.soldDate=now;im.warrantyStart=now;im.warrantyEnd=addMonths(now,p.warranty||0)}})});
    if(state.activeCustomer){state.activeCustomer.total=(state.activeCustomer.total||0)+total;state.activeCustomer.debt=(state.activeCustomer.debt||0)+debt;state.activeCustomer.status="Đã mua hàng"}
    if(paid>0)db.payments.unshift({id:Date.now()+1,code:code("TH",db.payments),date:now,customerId:inv.customerId,invoiceId:inv.id,amount:paid,method,status:"Hoàn thành",note:`Thanh toán ${inv.code}`});
    addActivity(`${inv.code} • ${money(total)}${debt?` • Nợ ${money(debt)}`:""}`);db.cart=[];saveDB();state.modal={type:"success",invoice:inv};render();
  };

  window.deleteProduct=id=>{
    const p=product(id);if(!p)return;const used=db.invoices.some(inv=>(inv.items||[]).some(it=>it.productId===id));if(used)return toast("Sản phẩm đã có lịch sử hóa đơn nên không thể xóa.");if(!confirm(`Xóa sản phẩm \"${p.name}\"?`))return;
    db.products=db.products.filter(x=>x.id!==id);db.imeis=db.imeis.filter(i=>i.productId!==id);db.inventoryMovements=db.inventoryMovements.filter(m=>m.productId!==id);db.cart=db.cart.filter(c=>c.productId!==id);addActivity(`Đã xóa sản phẩm: ${p.name}`);saveDB();state.modal=null;state.screen="products";render();
  };

  window.cancelInvoice=id=>{
    const inv=invoice(id);if(!inv||inv.status==="Đã hủy")return;const reason=prompt("Lý do hủy hóa đơn:","Khách đổi ý / tạo nhầm")||"Hủy hóa đơn";if(!confirm(`Xác nhận hủy ${inv.code}? Tồn kho và IMEI sẽ được hoàn lại.`))return;
    (inv.items||[]).forEach(it=>{const p=product(it.productId);if(p){p.stock+=it.qty;addMovement(p.id,it.qty,"CANCEL",inv.code,`Hủy hóa đơn: ${reason}`)}(it.imeis||[]).forEach(iid=>{const im=imeiObj(iid);if(im){im.status="Trong kho";im.customerId=null;im.invoiceId=null;im.soldDate=null;im.warrantyStart=null;im.warrantyEnd=null}})});
    const c=customer(inv.customerId);if(c){c.total=Math.max(0,(c.total||0)-(inv.total||0));c.debt=Math.max(0,(c.debt||0)-(inv.debt||0))}db.payments.filter(p=>p.invoiceId===inv.id).forEach(p=>p.status="Đã hủy");inv.cancelledAt=new Date().toISOString();inv.cancelReason=reason;inv.status="Đã hủy";addActivity(`Đã hủy ${inv.code} • ${reason}`);saveDB();state.modal={type:"invoiceDetail",inv};render();
  };

  window.invoiceCards=function(list){return list.map(inv=>{const c=customer(inv.customerId);return `<div class="item" onclick="openInvoiceDetail(${inv.id})"><div class="thumb">🧾</div><div class="item-main"><div class="item-title">${inv.code}</div><div class="item-sub">${fmtDateTime(inv.date)}${c?` • ${esc(c.name)}`:" • Khách lẻ"}</div><div class="price">${money(inv.total)}</div></div><span class="badge ${inv.status==="Đã hủy"?"red":inv.debt?"red":"green"}">${inv.status==="Đã hủy"?"Đã hủy":inv.debt?`Nợ ${money(inv.debt)}`:"Đã trả"}</span></div>`}).join("")||'<div class="empty">Chưa có hóa đơn.</div>'};

  window.paymentsView=function(){return `${topbar("Thu tiền","Lịch sử thanh toán")}<div class="content"><div class="list">${db.payments.map(p=>{const c=customer(p.customerId),inv=invoice(p.invoiceId);return `<div class="item" style="${p.status==="Đã hủy"?"opacity:.55":""}"><div class="thumb">💵</div><div class="item-main"><div class="item-title">${esc(p.code)} ${p.status==="Đã hủy"?'<span class="badge red">Đã hủy</span>':""}</div><div class="item-sub">${fmtDateTime(p.date)} • ${esc(p.method)}</div><div class="small muted">${c?esc(c.name):"Khách lẻ"}${inv?` • ${inv.code}`:""}</div></div><b>${money(p.amount)}</b></div>`}).join("")||'<div class="empty">Chưa có giao dịch.</div>'}</div></div>${nav()}`};

  const baseRender=render;
  window.render=function(){
    if(typeof storeProfile!=="undefined") Object.assign(storeProfile,db.storeProfile||V7_STORE_DEFAULT);
    baseRender();
    setTimeout(()=>{
      if(state.modal?.type==="checkout"){
        const fields=[...document.querySelectorAll('.sheet .field')],f=fields.find(x=>x.querySelector('label')?.textContent.includes('Ngày bán'));
        if(f){const inp=f.querySelector('input');if(inp&&!inp.id){inp.disabled=false;inp.type='datetime-local';inp.id='co_date';inp.value=new Date(state.modal.saleDate||new Date()).toISOString().slice(0,16);inp.onchange=()=>state.modal.saleDate=new Date(inp.value).toISOString();f.querySelector('label').textContent='Ngày giờ bán';}}
      }
      if(state.modal?.type==="productDetail"&&!document.querySelector('#v7-delete-product')){
        const sheet=document.querySelector('.sheet');if(sheet){const b=document.createElement('button');b.id='v7-delete-product';b.className='btn danger block';b.style.marginTop='10px';b.textContent='XÓA SẢN PHẨM';b.onclick=()=>deleteProduct(state.modal.p.id);sheet.appendChild(b);}
      }
      if(state.modal?.type==="invoiceDetail"){
        const inv=state.modal.inv,sheet=document.querySelector('.sheet');if(inv?.status==="Đã hủy"&&!document.querySelector('#v7-cancel-note')){const n=document.createElement('div');n.id='v7-cancel-note';n.className='notice';n.style.marginTop='10px';n.innerHTML=`<b>Đã hủy:</b> ${esc(inv.cancelReason||'')} • ${fmtDateTime(inv.cancelledAt)}`;sheet?.appendChild(n)}
        if(inv?.status!=="Đã hủy"&&!document.querySelector('#v7-cancel-invoice')){const b=document.createElement('button');b.id='v7-cancel-invoice';b.className='btn danger block';b.style.marginTop='10px';b.textContent='HỦY HÓA ĐƠN & HOÀN KHO';b.onclick=()=>cancelInvoice(inv.id);sheet?.appendChild(b)}
      }
      if(state.modal?.type==="success"&&!document.querySelector('#v7-default-print')){const sheet=document.querySelector('.sheet');if(sheet){const b=document.createElement('button');b.id='v7-default-print';b.className='btn ghost block';b.style.marginTop='10px';b.textContent='IN THEO MẪU MẶC ĐỊNH';b.onclick=()=>previewTemplate((db.storeProfile.defaultSalePaper==='A4'?'sale_a4':'sale_k80'),'invoice',state.modal.invoice.id);sheet.appendChild(b)}}
    },0);
  };
  render();
})();
