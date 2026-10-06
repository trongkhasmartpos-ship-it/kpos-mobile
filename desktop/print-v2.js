/* KPOS Print V2 - K80/A4 editor, store profile, reorder, sale/warranty/return */
(function(){
  const TYPES={sale:'Hóa đơn bán hàng',warranty:'Phiếu bảo hành',return:'Phiếu trả / đổi hàng'};
  const baseModalView=window.modalView;
  const baseRender=window.render;
  const n=v=>Number(v)||0;
  const defs={
    sale:[['logo','Logo'],['header','Thông tin cửa hàng'],['title','Tiêu đề chứng từ'],['code','Mã hóa đơn'],['date','Ngày bán'],['customer','Khách hàng'],['items','Danh sách sản phẩm'],['totals','Tổng tiền / giảm / phụ thu'],['payment','Thanh toán'],['note','Ghi chú hóa đơn'],['signature','Chữ ký'],['footer','Lời cảm ơn']],
    warranty:[['logo','Logo'],['header','Thông tin cửa hàng'],['title','Tiêu đề chứng từ'],['code','Mã phiếu'],['date','Ngày tiếp nhận'],['customer','Khách hàng'],['product','Sản phẩm'],['imei','IMEI / Serial'],['issue','Lỗi khách báo'],['condition','Tình trạng khi nhận'],['accessories','Phụ kiện'],['technician','Kỹ thuật phụ trách'],['diagnosis','Chẩn đoán'],['handling','Hướng xử lý'],['promised','Hẹn trả'],['status','Trạng thái'],['note','Ghi chú'],['signature','Chữ ký'],['footer','Lưu ý bảo hành']],
    return:[['logo','Logo'],['header','Thông tin cửa hàng'],['title','Tiêu đề chứng từ'],['code','Mã phiếu'],['date','Ngày trả / đổi'],['invoice','Hóa đơn gốc'],['customer','Khách hàng'],['items','Sản phẩm trả / đổi'],['totals','Số tiền xử lý'],['refund','Hoàn tiền / trừ công nợ'],['reason','Lý do'],['note','Ghi chú'],['signature','Chữ ký'],['footer','Xác nhận trả / đổi']]
  };
  const styleDefault={font:'Arial',fontSize:12,lineHeight:1.4,density:'normal',align:'center',spacing:8,padding:12};
  const profileDefault={name:'CÔNG TY TNHH PHẦN MỀM KPOS',short:'KPOS',address:'Hồ Chí Minh',phone:'',logo:'',footer:'Cảm ơn Quý khách đã tin tưởng KPOS.'};

  function newTemplate(type,paper,name){
    const fields=Object.fromEntries(defs[type].map(([k])=>[k,true]));
    if(type==='sale'&&paper==='K80')fields.signature=false;
    return {id:`pv2_${type}_${paper.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,docType:type,paper,name:name||`${TYPES[type]} ${paper}`,desc:`Mẫu ${paper} tùy chỉnh trực tiếp`,fields,order:defs[type].map(([k])=>k),style:{...styleDefault}};
  }
  function normalizeTpl(t){
    if(!t||!defs[t.docType])return t;
    t.fields=t.fields||{};
    defs[t.docType].forEach(([k])=>{if(t.fields[k]===undefined)t.fields[k]=true});
    if(t.docType==='sale'&&t.fields.header===undefined)t.fields.header=t.fields.store!==false;
    const all=defs[t.docType].map(([k])=>k),old=Array.isArray(t.order)?t.order:[];
    t.order=[...old.filter(k=>all.includes(k)),...all.filter(k=>!old.includes(k))];
    t.style={...styleDefault,...(t.style||{})};
    return t;
  }
  function ensure(){
    db.printTemplates=Array.isArray(db.printTemplates)?db.printTemplates:[];
    db.storeProfile={...profileDefault,...(db.storeProfile||{})};
    try{Object.assign(storeProfile,db.storeProfile)}catch(e){}
    db.printDefaults=db.printDefaults||{};
    ['sale','warranty','return'].forEach(type=>{
      db.printDefaults[type]=db.printDefaults[type]||{};
      ['K80','A4'].forEach(paper=>{
        let list=db.printTemplates.filter(t=>t.docType===type&&t.paper===paper);
        if(!list.length){const t=newTemplate(type,paper,`${TYPES[type]} ${paper} • Mẫu đẹp`);if(type!=='return'){const old=db.printTemplates.find(x=>x.docType===type&&x.paper===paper);if(old)return}else db.printTemplates.push(t);list=[t]}
        list.forEach(normalizeTpl);
        if(!list.some(x=>x.id===db.printDefaults[type][paper]))db.printDefaults[type][paper]=list[0]?.id||'';
      });
    });
    db.printTemplates.forEach(normalizeTpl);
  }
  ensure();
  state.printDocType=state.printDocType||'sale';state.pv2Selected=state.pv2Selected||null;

  const list=type=>db.printTemplates.filter(t=>t.docType===type);
  const tpl=id=>db.printTemplates.find(t=>t.id===id);
  const labels=type=>Object.fromEntries(defs[type]||[]);
  function selected(){let t=tpl(state.pv2Selected);if(!t||t.docType!==state.printDocType)t=list(state.printDocType)[0];if(t)state.pv2Selected=t.id;return t}
  function sample(type){
    if(type==='sale')return typeof sampleSaleDoc==='function'?{...sampleSaleDoc(),note:'Giao hàng nhanh • Hỗ trợ tận tình',surchargeLabel:'Phí dịch vụ'}:{code:'HD061026-001',date:new Date().toISOString(),customerName:'Nguyễn Văn A',customerPhone:'0901234567',subtotal:6650000,discount:100000,surcharge:50000,total:6600000,paid:6600000,debt:0,paymentMethod:'Chuyển khoản',items:[]};
    if(type==='warranty')return {code:'BH061026-001',date:new Date().toISOString(),customerName:'Nguyễn Văn A',customerPhone:'0901234567',productName:'Máy POS SUNMI D2',imei:'SUNMID2-0001',issue:'Không lên nguồn',condition:'Máy có trầy nhẹ mặt sau',accessories:'Sạc + cáp',technician:'Kỹ thuật KPOS',diagnosis:'Kiểm tra nguồn và bo mạch',handling:'Vệ sinh, kiểm tra, thay linh kiện nếu cần',promisedAt:new Date(Date.now()+86400000).toISOString(),status:'Đang kiểm tra',note:'Gọi khách trước khi thay linh kiện'};
    return {code:'TH061026-001',date:new Date().toISOString(),invoiceCode:'HD061026-001',customerName:'Nguyễn Văn A',customerPhone:'0901234567',type:'return',items:[{name:'Máy in HPRT TP80N-M',qty:1,price:850000,imeis:[]}],amount:850000,debtOffset:200000,refundPaid:650000,refundMethod:'Chuyển khoản',reason:'Đổi sang mẫu khác',note:'Hàng đủ phụ kiện'};
  }
  function actualDoc(type,kind,id){
    if(type==='sale'){
      const inv=kind==='invoice'?invoice(id):(db.invoices||[])[0];if(!inv)return sample(type);
      const d=typeof invoiceToPrintDoc==='function'?invoiceToPrintDoc(inv):sample(type);return {...d,note:inv.note||inv.invoiceNote||'',surchargeLabel:inv.surchargeLabel||'Phụ thu',voucherCode:inv.voucherCode||''};
    }
    if(type==='warranty'){
      const w=(db.warranties||[]).find(x=>String(x.id)===String(id))||(db.warranties||[])[0];if(!w)return sample(type);
      const d=typeof warrantyToPrintDoc==='function'?warrantyToPrintDoc(w):{};return {...d,...w,customerPhone:w.phone||d.customerPhone||'',date:w.receivedAt||w.date};
    }
    const r=(db.returns||[]).find(x=>String(x.id)===String(id))||(db.returns||[])[0];if(!r)return sample(type);
    const c=customer(r.customerId),inv=invoice(r.invoiceId);return {...r,invoiceCode:r.invoiceCode||inv?.code||'',customerName:c?.name||'Khách lẻ',customerPhone:c?.phone||'',items:(r.items||[]).map(x=>({name:product(x.productId)?.name||'Sản phẩm',qty:n(x.qty),price:n(x.price),imeis:(x.imeis||[]).map(v=>imeiObj(v)?.value||String(v)).filter(Boolean)}))};
  }
  function row(k,v){return `<div class="p-info"><span>${esc(k)}</span><b>${esc(v||'—')}</b></div>`}
  function itemTable(doc){return `<table><thead><tr><th>Sản phẩm</th><th class="right">SL</th><th class="right">Thành tiền</th></tr></thead><tbody>${(doc.items||[]).map(it=>`<tr><td><b>${esc(it.name||'')}</b>${it.imeis?.length?`<div class="p-item-note">IMEI/Serial: ${it.imeis.map(esc).join(', ')}</div>`:''}${it.note?`<div class="p-item-note">${esc(it.note)}</div>`:''}</td><td class="right">${n(it.qty)}</td><td class="right">${money(n(it.qty)*n(it.price))}</td></tr>`).join('')||'<tr><td colspan="3">Chưa có sản phẩm</td></tr>'}</tbody></table>`}
  function sectionHtml(type,key,doc,p){
    if(key==='logo')return p.logo?`<img class="p-logo" src="${p.logo}" alt="Logo">`:'';
    if(key==='header')return `<div class="p-store">${esc(p.short||p.name)}</div><div class="p-muted">${esc(p.name||'')}${p.address?`<br>${esc(p.address)}`:''}${p.phone?`<br>Hotline: ${esc(p.phone)}`:''}</div>`;
    if(key==='title')return `<div class="p-title">${type==='sale'?'HÓA ĐƠN BÁN HÀNG':type==='warranty'?'PHIẾU BẢO HÀNH':(doc.type==='exchange'?'PHIẾU ĐỔI HÀNG':'PHIẾU TRẢ HÀNG')}</div>`;
    if(key==='code')return row('Mã chứng từ',doc.code);
    if(key==='date')return row(type==='sale'?'Ngày bán':type==='warranty'?'Ngày tiếp nhận':'Ngày xử lý',fmtDateTime(doc.date));
    if(key==='customer')return row('Khách hàng',`${doc.customerName||'Khách lẻ'}${doc.customerPhone?` • ${doc.customerPhone}`:''}`);
    if(key==='items')return itemTable(doc);
    if(key==='totals'&&type==='sale')return `<div class="p-totals"><div class="p-total-row"><span>Tạm tính</span><b>${money(doc.subtotal||doc.total)}</b></div><div class="p-total-row"><span>Giảm giá</span><b>-${money(doc.discount||0)}</b></div>${doc.voucherDiscount?`<div class="p-total-row"><span>Voucher ${esc(doc.voucherCode||'')}</span><b>-${money(doc.voucherDiscount)}</b></div>`:''}${doc.pointsDiscount?`<div class="p-total-row"><span>Điểm</span><b>-${money(doc.pointsDiscount)}</b></div>`:''}<div class="p-total-row"><span>${esc(doc.surchargeLabel||'Phụ thu')}</span><b>${money(doc.surcharge||0)}</b></div><div class="p-total-row"><span>Giao hàng</span><b>${money(doc.shipping||0)}</b></div><div class="p-total-row p-grand"><span>PHẢI TRẢ</span><b>${money(doc.total)}</b></div></div>`;
    if(key==='payment'&&type==='sale')return `<div class="p-sep"></div>${row('Thanh toán',doc.paymentMethod||'Tiền mặt')}${row('Đã trả',money(doc.paid||0))}${n(doc.debt)?row('Công nợ',money(doc.debt)):''}`;
    if(key==='note')return doc.note?row('Ghi chú',doc.note):'';
    if(type==='warranty'){
      const map={product:['Sản phẩm',doc.productName],imei:['IMEI / Serial',doc.imei],issue:['Lỗi khách báo',doc.issue],condition:['Tình trạng khi nhận',doc.condition],accessories:['Phụ kiện',doc.accessories],technician:['Kỹ thuật phụ trách',doc.technician],diagnosis:['Chẩn đoán',doc.diagnosis],handling:['Hướng xử lý',doc.handling],promised:['Hẹn trả',doc.promisedAt?fmtDateTime(doc.promisedAt):''],status:['Trạng thái',doc.status]};if(map[key])return row(map[key][0],map[key][1]);
    }
    if(type==='return'){
      if(key==='invoice')return row('Hóa đơn gốc',doc.invoiceCode||'—');
      if(key==='totals')return `<div class="p-totals"><div class="p-total-row p-grand"><span>GIÁ TRỊ TRẢ/ĐỔI</span><b>${money(doc.amount)}</b></div></div>`;
      if(key==='refund')return `${row('Trừ công nợ',money(doc.debtOffset||0))}${row('Hoàn khách',money(doc.refundPaid||0))}${row('Phương thức hoàn',doc.refundMethod||'—')}`;
      if(key==='reason')return row('Lý do',doc.reason||'—');
    }
    if(key==='signature')return `<div class="p-sign"><div><b>Khách hàng</b><div class="p-muted">Ký, ghi rõ họ tên</div></div><div><b>${type==='warranty'?'Kỹ thuật / cửa hàng':'Cửa hàng'}</b><div class="p-muted">Ký, ghi rõ họ tên</div></div></div>`;
    if(key==='footer')return `<div class="p-footer">${esc(type==='warranty'?'Vui lòng giữ phiếu/IMEI để đối chiếu khi nhận máy.':type==='return'?'Hai bên xác nhận số lượng, tình trạng hàng và số tiền xử lý nêu trên.':p.footer||'Cảm ơn Quý khách.')}</div>`;
    return '';
  }
  window.renderPrintContent=renderPrintContent=function(t,doc){
    normalizeTpl(t);const p=state.modal?.type==='pv2Editor'?(state.modal.profile||db.storeProfile):db.storeProfile,s=t.style||styleDefault,align=s.align||'center';
    const body=t.order.filter(k=>t.fields?.[k]!==false).map(k=>sectionHtml(t.docType,k,doc,p)).filter(Boolean).join(`<div style="height:${Math.max(0,n(s.spacing))}px"></div>`);
    return `<div class="pv2-print ${t.paper==='K80'?'k80':'a4'} density-${esc(s.density||'normal')} align-${esc(align)}" style="font-family:${esc(s.font||'Arial')},sans-serif;font-size:${n(s.fontSize)||12}px;line-height:${n(s.lineHeight)||1.4};padding:${n(s.padding)||0}px;text-align:${esc(align)}">${body}</div>`;
  };

  window.setPrintDocType=type=>{if(!TYPES[type])return;state.printDocType=type;state.pv2Selected=null;render()};
  window.selectPrintV2=id=>{state.pv2Selected=id;render()};
  window.setDefaultPrintTemplate=id=>{const t=tpl(id);if(!t)return;db.printDefaults[t.docType]=db.printDefaults[t.docType]||{};db.printDefaults[t.docType][t.paper]=id;saveDB();toast(`Đã đặt ${t.name} làm mẫu mặc định`);render()};
  window.createPrintTemplate=(type,paper)=>{const t=newTemplate(type,paper,`${TYPES[type]} ${paper} • Mẫu mới`);db.printTemplates.push(t);state.printDocType=type;state.pv2Selected=t.id;saveDB();openTemplateEditor(t.id)};
  window.duplicatePrintTemplate=id=>{const src=tpl(id);if(!src)return;const t=clone(src);t.id=`pv2_copy_${Date.now()}_${Math.random().toString(36).slice(2,5)}`;t.name=`${src.name} • Bản sao`;db.printTemplates.push(t);state.pv2Selected=t.id;saveDB();render();toast('Đã nhân bản mẫu')};
  window.deletePrintTemplate=id=>{const t=tpl(id);if(!t)return;const same=list(t.docType).filter(x=>x.paper===t.paper);if(same.length<=1)return toast(`Phải giữ ít nhất 1 mẫu ${t.paper}`);if(!confirm(`Xóa mẫu "${t.name}"?`))return;db.printTemplates=db.printTemplates.filter(x=>x.id!==id);if(db.printDefaults?.[t.docType]?.[t.paper]===id)db.printDefaults[t.docType][t.paper]=db.printTemplates.find(x=>x.docType===t.docType&&x.paper===t.paper)?.id||'';state.pv2Selected=null;saveDB();render()};
  window.openTemplateEditor=id=>{const t=tpl(id);if(!t)return;normalizeTpl(t);state.modal={type:'pv2Editor',tpl:clone(t),profile:clone(db.storeProfile)};render()};
  function refreshPreview(){const m=state.modal;if(m?.type!=='pv2Editor')return;const el=$('#pv2Live');if(el)el.innerHTML=renderPrintContent(m.tpl,sample(m.tpl.docType))}
  window.pv2Text=(key,val)=>{const m=state.modal;if(m?.type!=='pv2Editor')return;if(key==='name'||key==='desc')m.tpl[key]=val;else m.profile[key]=val;refreshPreview()};
  window.pv2Style=(key,val)=>{const m=state.modal;if(m?.type!=='pv2Editor')return;m.tpl.style=m.tpl.style||{};m.tpl.style[key]=['fontSize','lineHeight','spacing','padding'].includes(key)?Number(val):val;refreshPreview()};
  window.pv2Toggle=(key,checked)=>{const m=state.modal;if(m?.type!=='pv2Editor')return;m.tpl.fields[key]=checked;refreshPreview()};
  window.pv2Move=(key,dir)=>{const m=state.modal;if(m?.type!=='pv2Editor')return;const a=m.tpl.order,i=a.indexOf(key),j=i+dir;if(i<0||j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];render()};
  window.pv2DragStart=(ev,key)=>{ev.dataTransfer.setData('text/plain',key);ev.currentTarget.classList.add('dragging')};
  window.pv2DragEnd=ev=>ev.currentTarget.classList.remove('dragging');
  window.pv2Drop=(ev,target)=>{ev.preventDefault();const m=state.modal;if(m?.type!=='pv2Editor')return;const src=ev.dataTransfer.getData('text/plain');if(!src||src===target)return;const a=m.tpl.order,si=a.indexOf(src),ti=a.indexOf(target);if(si<0||ti<0)return;a.splice(si,1);a.splice(ti,0,src);render()};
  window.pv2Logo=()=>{const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=()=>{const f=input.files?.[0];if(!f)return;if(f.size>700000)return toast('Logo nên nhỏ hơn 700KB');const r=new FileReader();r.onload=()=>{if(state.modal?.type==='pv2Editor'){state.modal.profile.logo=String(r.result||'');render()}};r.readAsDataURL(f)};input.click()};
  window.pv2RemoveLogo=()=>{if(state.modal?.type==='pv2Editor'){state.modal.profile.logo='';render()}};
  window.savePrintEditor=()=>{const m=state.modal;if(m?.type!=='pv2Editor')return;const idx=db.printTemplates.findIndex(x=>x.id===m.tpl.id);if(idx<0)return;db.printTemplates[idx]=clone(m.tpl);db.storeProfile=clone(m.profile);try{Object.assign(storeProfile,db.storeProfile)}catch(e){}saveDB();state.pv2Selected=m.tpl.id;state.modal=null;render();toast('Đã lưu mẫu in và thông tin cửa hàng')};

  function defaultBar(type){return `<div class="pv2-defaults">${['K80','A4'].map(paper=>{const rows=list(type).filter(x=>x.paper===paper);return `<label>${paper}<select onchange="setDefaultPrintTemplate(this.value)">${rows.map(t=>`<option value="${t.id}" ${db.printDefaults?.[type]?.[paper]===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>`}).join('')}</div>`}
  function tabs(){return `<div class="pv2-tabs">${Object.entries(TYPES).map(([k,v])=>`<button class="${state.printDocType===k?'active':''}" onclick="setPrintDocType('${k}')">${esc(v)}</button>`).join('')}</div>`}
  window.printsView=printsView=function(){ensure();const type=state.printDocType,t=selected(),rows=list(type);return `${topbar('Mẫu in','K80 • A4 • kéo thả trường • review trực tiếp')}<div class="content pv2-page"><div class="pv2-head">${tabs()}${defaultBar(type)}</div><div class="pv2-layout"><aside class="pv2-list">${rows.map(x=>`<button class="pv2-template ${t?.id===x.id?'active':''}" onclick="selectPrintV2('${x.id}')"><div><span class="template-chip">${x.paper}</span><b>${esc(x.name)}</b><small>${esc(x.desc||'')}</small></div><span>›</span></button>`).join('')}<div class="pv2-list-actions"><button class="btn ghost small" onclick="createPrintTemplate('${type}','K80')">＋ K80</button><button class="btn ghost small" onclick="createPrintTemplate('${type}','A4')">＋ A4</button></div></aside><section class="pv2-stage">${t?`<div class="pv2-stage-head"><div><b>${esc(t.name)}</b><div class="small muted">${t.paper} • ${esc(TYPES[t.docType])}</div></div><div class="pv2-stage-actions"><button class="btn ghost" onclick="duplicatePrintTemplate('${t.id}')">Nhân bản</button><button class="btn danger" onclick="deletePrintTemplate('${t.id}')">Xóa</button><button class="btn primary" onclick="openTemplateEditor('${t.id}')">Chỉnh trực quan</button></div></div><div class="pv2-canvas ${t.paper==='K80'?'k80':'a4'}"><div class="pv2-paper">${renderPrintContent(t,sample(type))}</div></div>`:'<div class="empty">Chưa có mẫu in.</div>'}</section></div></div>${nav()}`};

  function editor(m){const t=m.tpl,l=labels(t.docType),s=t.style||styleDefault,p=m.profile;return `<div class="modal-backdrop pv2-modal" onclick="if(event.target===this)closeModal()"><div class="sheet pv2-editor"><div class="sheet-head"><div><div class="sheet-title">Chỉnh mẫu in • ${t.paper}</div><div class="small muted">Kéo thả hoặc dùng ↑ ↓ để đổi thứ tự • preview trực tiếp</div></div><button class="close" onclick="closeModal()">×</button></div><div class="pv2-editor-grid"><aside class="pv2-controls"><div class="field"><label>Tên mẫu</label><input value="${esc(t.name)}" oninput="pv2Text('name',this.value)"></div><div class="field"><label>Mô tả</label><input value="${esc(t.desc||'')}" oninput="pv2Text('desc',this.value)"></div><div class="pv2-section"><div class="pv2-section-title"><b>Thông tin cửa hàng</b><span class="small muted">Dùng chung mọi mẫu</span></div><div class="pv2-store-grid"><div class="field"><label>Tên ngắn</label><input value="${esc(p.short||'')}" oninput="pv2Text('short',this.value)"></div><div class="field"><label>Hotline</label><input value="${esc(p.phone||'')}" oninput="pv2Text('phone',this.value)"></div><div class="field full"><label>Tên công ty / cửa hàng</label><input value="${esc(p.name||'')}" oninput="pv2Text('nameStore',this.value);state.modal.profile.name=this.value"></div><div class="field full"><label>Địa chỉ</label><input value="${esc(p.address||'')}" oninput="pv2Text('address',this.value)"></div><div class="field full"><label>Lời cảm ơn</label><input value="${esc(p.footer||'')}" oninput="pv2Text('footer',this.value)"></div></div><div class="pv2-logo-box">${p.logo?`<img src="${p.logo}">`:'<div style="width:64px;height:64px;display:grid;place-items:center;background:#f3f4f6;border-radius:9px">LOGO</div>'}<div><button class="btn ghost small" onclick="pv2Logo()">Chọn logo</button>${p.logo?` <button class="btn danger small" onclick="pv2RemoveLogo()">Xóa</button>`:''}<div class="small muted" style="margin-top:5px">PNG/JPG, nên dưới 700KB</div></div></div></div><div class="pv2-section"><div class="pv2-section-title"><b>Kiểu chữ & bố cục</b></div><div class="pv2-style-grid"><div class="field"><label>Font</label><select onchange="pv2Style('font',this.value)">${['Arial','Tahoma','Verdana','Georgia'].map(x=>`<option ${s.font===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Cỡ chữ</label><select onchange="pv2Style('fontSize',this.value)">${[10,11,12,13,14,15].map(x=>`<option value="${x}" ${n(s.fontSize)===x?'selected':''}>${x}px</option>`).join('')}</select></div><div class="field"><label>Căn nội dung</label><select onchange="pv2Style('align',this.value)"><option value="left" ${s.align==='left'?'selected':''}>Trái</option><option value="center" ${s.align==='center'?'selected':''}>Giữa</option><option value="right" ${s.align==='right'?'selected':''}>Phải</option></select></div><div class="field"><label>Giãn dòng</label><select onchange="pv2Style('lineHeight',this.value)">${[1.2,1.35,1.4,1.55,1.7].map(x=>`<option value="${x}" ${n(s.lineHeight)===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Khoảng cách khối</label><input type="number" min="0" max="30" value="${n(s.spacing)}" oninput="pv2Style('spacing',this.value)"></div><div class="field"><label>Lề trong</label><input type="number" min="0" max="40" value="${n(s.padding)}" oninput="pv2Style('padding',this.value)"></div></div></div><div class="pv2-section"><div class="pv2-section-title"><b>Trường hiển thị & thứ tự</b><span class="small muted">Kéo thả</span></div><div class="pv2-field-list">${t.order.map((k,i)=>`<div class="pv2-field-row" draggable="true" ondragstart="pv2DragStart(event,'${k}')" ondragend="pv2DragEnd(event)" ondragover="event.preventDefault()" ondrop="pv2Drop(event,'${k}')"><div class="pv2-drag">⋮⋮</div><label class="pv2-field-main"><input type="checkbox" ${t.fields[k]!==false?'checked':''} onchange="pv2Toggle('${k}',this.checked)"><span>${esc(l[k]||k)}</span></label><div class="pv2-field-actions"><button onclick="pv2Move('${k}',-1)" ${i===0?'disabled':''}>↑</button><button onclick="pv2Move('${k}',1)" ${i===t.order.length-1?'disabled':''}>↓</button></div></div>`).join('')}</div></div><div class="pv2-editor-actions"><button class="btn ghost" onclick="previewTemplate('${t.id}')">Preview lớn</button><button class="btn primary" onclick="savePrintEditor()">LƯU MẪU</button></div></aside><section class="pv2-preview"><div class="pv2-preview-head"><b>Review trực tiếp</b><span class="template-chip">${t.paper}</span></div><div class="pv2-canvas ${t.paper==='K80'?'k80':'a4'}"><div id="pv2Live" class="pv2-paper">${renderPrintContent(t,sample(t.docType))}</div></div></section></div></div></div>`}
  function preview(m){return `<div class="modal-backdrop pv2-modal" onclick="if(event.target===this)closeModal()"><div class="sheet pv2-preview-sheet"><div class="sheet-head"><div><div class="sheet-title">Xem trước • ${esc(m.tpl.name)}</div><div class="small muted">${m.tpl.paper} • ${esc(TYPES[m.tpl.docType])}</div></div><button class="close" onclick="closeModal()">×</button></div><div class="pv2-canvas ${m.tpl.paper==='K80'?'k80':'a4'}"><div class="pv2-paper">${renderPrintContent(m.tpl,m.doc)}</div></div><div class="split-buttons" style="margin:0 12px 14px"><button class="btn ghost" onclick="openTemplateEditor('${m.tpl.id}')">CHỈNH MẪU</button><button class="btn primary" onclick="printCurrentTemplate()">IN NGAY</button></div></div></div>`}
  window.previewTemplate=(id,kind=null,docId=null)=>{ensure();let t=tpl(id);if(!t)return toast('Không tìm thấy mẫu in');const def=db.printDefaults?.[t.docType]?.[t.paper],dt=tpl(def);if(dt&&kind)t=dt;state.modal={type:'pv2Preview',tpl:clone(t),doc:actualDoc(t.docType,kind,docId)};render()};
  window.printCurrentTemplate=()=>{const m=state.modal;if(m?.type!=='pv2Preview')return;const html=renderPrintContent(m.tpl,m.doc),w=window.open('','_blank','width=900,height=900');if(!w)return toast('Trình duyệt đang chặn cửa sổ in');const paper=m.tpl.paper==='K80'?'80mm auto':'A4';w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(m.tpl.name)}</title><style>@page{size:${paper};margin:${m.tpl.paper==='K80'?'3mm':'10mm'}}body{margin:0;font-family:Arial,sans-serif}.pv2-print{color:#111}.pv2-print *{box-sizing:border-box}.p-logo{max-width:90px;max-height:65px;object-fit:contain}.p-store{font-weight:900}.p-muted{color:#555}.p-title{font-weight:900;font-size:1.3em;margin:7px 0}.p-sep{border-top:1px dashed #888;margin:8px 0}.p-info{display:grid;grid-template-columns:120px 1fr;gap:4px 8px}.k80 .p-info{grid-template-columns:80px 1fr}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:6px 3px;text-align:left;vertical-align:top}.right{text-align:right!important}.p-item-note{font-size:.82em;color:#666}.p-totals{margin-left:auto;max-width:340px}.p-total-row{display:flex;justify-content:space-between;gap:12px;padding:3px 0}.p-grand{font-weight:900;border-top:1px solid #aaa;margin-top:4px;padding-top:6px}.p-sign{display:grid;grid-template-columns:1fr 1fr;gap:20px;text-align:center;margin-top:22px;min-height:70px}.p-footer{text-align:center;color:#666;font-size:.86em;margin-top:12px}</style></head><body>${html}</body></html>`);w.document.close();setTimeout(()=>{w.focus();w.print()},250)};
  window.modalView=modalView=function(){if(state.modal?.type==='pv2Editor')return editor(state.modal);if(state.modal?.type==='pv2Preview')return preview(state.modal);return baseModalView()};
  window.render=render=function(){ensure();baseRender()};
})();
