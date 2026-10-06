/* KPOS CRM V2 - 360 customer profile, 13-stage pipeline, care schedule */
(function(){
  const STATUSES=[
    ['Khách mới','Khách mới'],['Chưa liên hệ','Chưa liên hệ'],['Đã liên hệ','Đã liên hệ'],['Đang tư vấn','Đang tư vấn'],
    ['Khách quan tâm','Khách quan tâm'],['Chờ khách phản hồi','Chờ khách phản hồi'],['Hẹn gọi lại','Hẹn gọi lại'],
    ['Hẹn gặp/demo','Hẹn gặp / demo'],['Đang báo giá','Đang báo giá'],['Đang cân nhắc','Đang cân nhắc'],
    ['Đã mua hàng','Đã mua hàng / Đã chốt'],['Không mua','Không mua'],['Mất khách','Mất khách']
  ];
  const TERMINAL=['Đã mua hàng','Không mua','Mất khách'];
  const CHANNELS=['Gọi điện','Zalo','Facebook','Email','Gặp trực tiếp','Khác'];
  const baseModalView=window.modalView;

  function ensureCustomer(c){
    const defaults={phone2:'',email:'',address:'',source:'',status:'Khách mới',need:'',interestedProducts:'',budget:'',expectedQty:'',expectedPurchaseDate:'',owner:'',careChannel:'Gọi điện',careResult:'',nextCareAt:'',lastCareAt:'',note:'',careHistory:[]};
    Object.keys(defaults).forEach(k=>{if(c[k]==null)c[k]=clone(defaults[k])});
    if(!Array.isArray(c.careHistory))c.careHistory=[];
    return c;
  }
  function ensureAll(){(db.customers||[]).forEach(ensureCustomer)}
  ensureAll();

  state.crm2Q=state.crm2Q||'';
  state.crm2Status=state.crm2Status||'all';
  state.crm2Source=state.crm2Source||'all';
  state.crm2Owner=state.crm2Owner||'all';

  const cust=id=>{const c=customer(id);return c?ensureCustomer(c):null};
  const parseDate=v=>v?new Date(v):null;
  const startToday=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
  const endToday=()=>{const d=startToday();d.setDate(d.getDate()+1);return d};
  const careKind=c=>{
    const d=parseDate(c.nextCareAt);if(!d||TERMINAL.includes(c.status))return 'none';
    const now=new Date(),s=startToday(),e=endToday();
    if(d<now)return 'overdue';
    if(d>=s&&d<e)return 'today';
    return 'upcoming';
  };
  const uniq=key=>[...new Set((db.customers||[]).map(c=>String(c[key]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
  const statusLabel=v=>STATUSES.find(x=>x[0]===v)?.[1]||v||'Khách mới';
  const statusOptions=v=>STATUSES.map(([x,l])=>`<option value="${esc(x)}" ${x===v?'selected':''}>${esc(l)}</option>`).join('');

  window.crmTabs=active=>`<div class="crm2-tabs">${[['crmDashboard','Pipeline'],['crmCustomers','Khách hàng'],['crmToday','Hôm nay / Sắp tới'],['crmOverdue','Quá hạn'],['crmReports','Báo cáo']].map(([s,l])=>`<button class="${active===s?'active':''}" onclick="go('${s}')">${l}</button>`).join('')}</div>`;

  function metrics(){
    ensureAll();const all=db.customers||[],today=all.filter(c=>careKind(c)==='today').length,upcoming=all.filter(c=>careKind(c)==='upcoming').length,overdue=all.filter(c=>careKind(c)==='overdue').length,won=all.filter(c=>c.status==='Đã mua hàng').length;
    return {total:all.length,today,upcoming,overdue,won,rate:all.length?Math.round(won/all.length*100):0};
  }
  function filteredCustomers(){
    ensureAll();const q=String(state.crm2Q||'').trim().toLowerCase();
    return (db.customers||[]).filter(c=>{
      if(q&&!([c.name,c.phone,c.phone2,c.email,c.source,c.status,c.need,c.interestedProducts,c.budget,c.owner,c.note].join(' ').toLowerCase().includes(q)))return false;
      if(state.crm2Status!=='all'&&c.status!==state.crm2Status)return false;
      if(state.crm2Source!=='all'&&c.source!==state.crm2Source)return false;
      if(state.crm2Owner!=='all'&&c.owner!==state.crm2Owner)return false;
      return true;
    });
  }

  function crmCard(c){
    const k=careKind(c),care=c.nextCareAt?fmtDateTime(c.nextCareAt):'Chưa có lịch';
    return `<button class="crm2-card" onclick="openCrm2Detail(${JSON.stringify(c.id)})"><div class="crm2-card-top"><b>${esc(c.name||'Chưa đặt tên')}</b><span>${esc(statusLabel(c.status))}</span></div><small>${esc(c.phone||'Chưa có SĐT')}${c.source?` • ${esc(c.source)}`:''}</small><p>${esc(c.need||c.interestedProducts||'Chưa ghi nhu cầu')}</p><div class="crm2-card-foot"><em class="${k}">${care}</em>${c.budget?`<strong>${esc(c.budget)}</strong>`:''}</div></button>`;
  }

  window.crmDashboard=crmDashboard=function(){
    const m=metrics();
    return `${topbar('Khách hàng / CRM','Pipeline 13 trạng thái • lịch chăm sóc • hồ sơ 360°')}<div class="content crm2-page">${crmTabs('crmDashboard')}<div class="crm2-kpis"><div><span>Tổng khách</span><b>${m.total}</b></div><div><span>Care hôm nay</span><b>${m.today}</b></div><div><span>Sắp tới</span><b>${m.upcoming}</b></div><div class="warn"><span>Quá hạn</span><b>${m.overdue}</b></div><div><span>Đã chốt</span><b>${m.won}</b></div><div><span>Tỷ lệ chốt</span><b>${m.rate}%</b></div></div><div class="crm2-pagehead"><div><b>Pipeline khách hàng</b><small>Kéo ngang để xem đủ 13 trạng thái</small></div><button class="btn primary" onclick="openCrmCustomerForm()">＋ Thêm khách CRM</button></div><div class="crm2-pipeline">${STATUSES.map(([v,l])=>{const rows=(db.customers||[]).filter(c=>(c.status||'Khách mới')===v);return `<section><header><span>${esc(l)}</span><b>${rows.length}</b></header><div>${rows.slice(0,40).map(crmCard).join('')||'<div class="crm2-empty">Trống</div>'}</div></section>`}).join('')}</div></div>${nav()}`;
  };

  window.crmCustomersView=crmCustomersView=function(){
    const list=filteredCustomers(),sources=uniq('source'),owners=uniq('owner');
    return `${topbar('Danh sách khách hàng','Tìm kiếm • lọc trạng thái • nhu cầu • lịch chăm sóc')}<div class="content crm2-page">${crmTabs('crmCustomers')}<div class="crm2-toolbar"><div class="crm2-search"><span>⌕</span><input id="crm2q" value="${esc(state.crm2Q||'')}" placeholder="Tên / SĐT / nhu cầu / sản phẩm / ghi chú" oninput="state.crm2Q=this.value;render()"></div><button class="btn primary" onclick="openCrmCustomerForm()">＋ Khách hàng</button></div><div class="crm2-filters"><select onchange="state.crm2Status=this.value;render()"><option value="all">Tất cả trạng thái</option>${STATUSES.map(([v,l])=>`<option value="${esc(v)}" ${state.crm2Status===v?'selected':''}>${esc(l)}</option>`).join('')}</select><select onchange="state.crm2Source=this.value;render()"><option value="all">Tất cả nguồn</option>${sources.map(v=>`<option value="${esc(v)}" ${state.crm2Source===v?'selected':''}>${esc(v)}</option>`).join('')}</select><select onchange="state.crm2Owner=this.value;render()"><option value="all">Tất cả phụ trách</option>${owners.map(v=>`<option value="${esc(v)}" ${state.crm2Owner===v?'selected':''}>${esc(v)}</option>`).join('')}</select><em>${list.length} khách</em></div><div class="crm2-table"><div class="crm2-tr head"><div>Khách hàng</div><div>Trạng thái / nhu cầu</div><div>Ngân sách / dự kiến</div><div>Lịch chăm sóc</div><div>Phụ trách</div><div></div></div>${list.map(c=>`<div class="crm2-tr"><div><b>${esc(c.name||'')}</b><small>${esc(c.phone||'')}${c.phone2?` • ${esc(c.phone2)}`:''}</small></div><div><span class="crm2-status">${esc(statusLabel(c.status))}</span><small>${esc(c.need||c.interestedProducts||'Chưa ghi nhu cầu')}</small></div><div><b>${esc(c.budget||'—')}</b><small>${c.expectedPurchaseDate?`Dự kiến ${fmtDate(c.expectedPurchaseDate)}`:'Chưa có ngày dự kiến'}${c.expectedQty?` • SL ${esc(c.expectedQty)}`:''}</small></div><div><b class="crm2-care-${careKind(c)}">${c.nextCareAt?fmtDateTime(c.nextCareAt):'Chưa đặt lịch'}</b><small>${esc(c.careChannel||'')}</small></div><div><b>${esc(c.owner||'—')}</b><small>${esc(c.source||'')}</small></div><div class="right"><button class="btn ghost small" onclick="openCrm2Detail(${JSON.stringify(c.id)})">Xem</button></div></div>`).join('')||'<div class="empty">Không có khách phù hợp.</div>'}</div></div>${nav()}`;
  };

  function careList(kind){
    ensureAll();return (db.customers||[]).filter(c=>careKind(c)===kind).sort((a,b)=>new Date(a.nextCareAt)-new Date(b.nextCareAt));
  }
  function careRows(list){return `<div class="crm2-carelist">${list.map(c=>`<button onclick="openCrm2Care(${JSON.stringify(c.id)})"><span><b>${esc(c.name)}</b><small>${esc(c.phone||'')} • ${esc(statusLabel(c.status))}</small><em>${esc(c.need||'Chưa ghi nhu cầu')}</em></span><span class="right"><b>${fmtDateTime(c.nextCareAt)}</b><small>${esc(c.careChannel||'')} • ${esc(c.owner||'Chưa phân công')}</small></span></button>`).join('')||'<div class="empty">Không có lịch chăm sóc.</div>'}</div>`}
  window.crmTodayView=crmTodayView=function(){const today=careList('today'),up=careList('upcoming');return `${topbar('Lịch chăm sóc','Hôm nay • sắp tới • thao tác nhanh')}<div class="content crm2-page">${crmTabs('crmToday')}<div class="crm2-schedule-grid"><section><div class="crm2-section-title"><b>Hôm nay</b><span>${today.length}</span></div>${careRows(today)}</section><section><div class="crm2-section-title"><b>Sắp tới</b><span>${up.length}</span></div>${careRows(up.slice(0,100))}</section></div></div>${nav()}`};
  window.crmOverdueView=crmOverdueView=function(){const list=careList('overdue');return `${topbar('CRM quá hạn','Các khách cần chăm sóc ngay')}<div class="content crm2-page">${crmTabs('crmOverdue')}<div class="crm2-overdue-head"><div><b>${list.length} lịch quá hạn</b><small>Không tính khách Đã chốt / Không mua / Mất khách</small></div></div>${careRows(list)}</div>${nav()}`};
  window.crmReportsView=crmReportsView=function(){const m=metrics(),total=Math.max(1,m.total);return `${topbar('Báo cáo CRM','Pipeline • chuyển đổi • nguồn khách')}<div class="content crm2-page">${crmTabs('crmReports')}<div class="crm2-kpis"><div><span>Tổng khách</span><b>${m.total}</b></div><div><span>Đã chốt</span><b>${m.won}</b></div><div><span>Tỷ lệ chốt</span><b>${m.rate}%</b></div><div class="warn"><span>Quá hạn</span><b>${m.overdue}</b></div></div><div class="crm2-report-grid"><section class="card"><div class="crm2-section-title"><b>Pipeline 13 trạng thái</b></div>${STATUSES.map(([v,l])=>{const n=(db.customers||[]).filter(c=>c.status===v).length;return `<div class="crm2-bar"><span>${esc(l)}</span><div><i style="width:${Math.round(n/total*100)}%"></i></div><b>${n}</b></div>`}).join('')}</section><section class="card"><div class="crm2-section-title"><b>Nguồn khách</b></div>${uniq('source').map(s=>{const n=(db.customers||[]).filter(c=>c.source===s).length;return `<div class="crm2-source-row"><span>${esc(s)}</span><b>${n}</b></div>`}).join('')||'<div class="empty">Chưa có dữ liệu nguồn khách.</div>'}</section></div></div>${nav()}`};

  window.openCrmCustomerForm=(id=null)=>{
    const c=id?cust(id):ensureCustomer({id:null,name:'',phone:'',phone2:'',email:'',address:'',source:'',status:'Khách mới',total:0,debt:0,points:0});
    state.modal={type:'crm2Form',c:clone(c),editing:!!id};render();
  };
  window.openDesktopCrmDetail=id=>window.openCrm2Detail(id);
  window.openCrm2Detail=id=>{const c=cust(id);if(!c)return;state.modal={type:'crm2Detail',customerId:c.id};render()};
  window.openCrm2Care=id=>{const c=cust(id);if(!c)return;state.modal={type:'crm2Care',customerId:c.id};render()};
  window.crm2SetStatus=(id,v)=>{const c=cust(id);if(!c)return;const old=c.status;c.status=v;if(old!==v)c.careHistory.unshift({id:Date.now(),date:new Date().toISOString(),channel:'Hệ thống',result:`Chuyển trạng thái: ${statusLabel(old)} → ${statusLabel(v)}`,note:'',nextCareAt:c.nextCareAt||''});saveDB();render();};

  window.saveCrm2Customer=()=>{
    const m=state.modal;if(m?.type!=='crm2Form')return;const c=m.c;
    const val=id=>$(id)?.value.trim()||'';
    c.name=val('#crm2_name');c.phone=val('#crm2_phone');c.phone2=val('#crm2_phone2');c.email=val('#crm2_email');c.address=val('#crm2_address');c.source=val('#crm2_source');c.owner=val('#crm2_owner');c.status=$('#crm2_status')?.value||'Khách mới';c.need=val('#crm2_need');c.interestedProducts=val('#crm2_products');c.budget=val('#crm2_budget');c.expectedQty=val('#crm2_qty');c.expectedPurchaseDate=$('#crm2_expected')?.value||'';c.careChannel=$('#crm2_channel')?.value||'Gọi điện';c.careResult=val('#crm2_result');c.note=val('#crm2_note');const next=$('#crm2_next')?.value;c.nextCareAt=next?new Date(next).toISOString():'';
    if(!c.name)return toast('Nhập tên khách hàng');
    if(c.phone&&(db.customers||[]).some(x=>String(x.id)!==String(c.id)&&String(x.phone||'').replace(/\s/g,'')===c.phone.replace(/\s/g,'')))return toast('Số điện thoại đã thuộc khách hàng khác');
    if(m.editing){db.customers[db.customers.findIndex(x=>String(x.id)===String(c.id))]=ensureCustomer(c)}else{c.id=Date.now();c.createdAt=new Date().toISOString();c.careHistory=[];db.customers.unshift(ensureCustomer(c))}
    addActivity(`CRM • ${c.name} • ${statusLabel(c.status)}`);saveDB();state.modal=null;state.screen='crmCustomers';render();toast('Đã lưu khách CRM');
  };

  window.saveCrm2Care=()=>{
    const m=state.modal,c=cust(m?.customerId);if(!c)return;const channel=$('#crm2c_channel')?.value||'Gọi điện',result=$('#crm2c_result')?.value.trim()||'',note=$('#crm2c_note')?.value.trim()||'',status=$('#crm2c_status')?.value||c.status,next=$('#crm2c_next')?.value;
    if(!result&&!note)return toast('Nhập kết quả hoặc ghi chú chăm sóc');
    const now=new Date().toISOString(),nextIso=next?new Date(next).toISOString():'';
    c.careHistory.unshift({id:Date.now(),date:now,channel,result,note,nextCareAt:nextIso,status});c.lastCareAt=now;c.careChannel=channel;c.careResult=result;c.status=status;c.nextCareAt=nextIso;saveDB();state.modal={type:'crm2Detail',customerId:c.id};render();toast('Đã lưu lịch sử chăm sóc');
  };

  function formModal(m){const c=m.c;return sheet(m.editing?'Sửa khách CRM':'Thêm khách CRM',`<div class="crm2-form"><div class="field"><label>Họ tên *</label><input id="crm2_name" value="${esc(c.name||'')}"></div><div class="field"><label>SĐT chính</label><input id="crm2_phone" value="${esc(c.phone||'')}"></div><div class="field"><label>SĐT 2</label><input id="crm2_phone2" value="${esc(c.phone2||'')}"></div><div class="field"><label>Email</label><input id="crm2_email" value="${esc(c.email||'')}"></div><div class="field full"><label>Địa chỉ</label><input id="crm2_address" value="${esc(c.address||'')}"></div><div class="field"><label>Trạng thái</label><select id="crm2_status">${statusOptions(c.status||'Khách mới')}</select></div><div class="field"><label>Nguồn khách</label><input id="crm2_source" value="${esc(c.source||'')}"></div><div class="field"><label>Phụ trách</label><input id="crm2_owner" value="${esc(c.owner||'')}"></div><div class="field"><label>Kênh chăm sóc</label><select id="crm2_channel">${CHANNELS.map(x=>`<option ${x===c.careChannel?'selected':''}>${x}</option>`).join('')}</select></div><div class="field full"><label>Nhu cầu</label><textarea id="crm2_need" rows="2">${esc(c.need||'')}</textarea></div><div class="field full"><label>Sản phẩm quan tâm</label><input id="crm2_products" value="${esc(c.interestedProducts||'')}" placeholder="VD: SUNMI D2, HPRT TP80N-M"></div><div class="field"><label>Ngân sách</label><input id="crm2_budget" value="${esc(c.budget||'')}"></div><div class="field"><label>Số lượng dự kiến</label><input id="crm2_qty" value="${esc(c.expectedQty||'')}"></div><div class="field"><label>Ngày dự kiến mua</label><input id="crm2_expected" type="date" value="${esc(c.expectedPurchaseDate||'')}"></div><div class="field"><label>Chăm sóc tiếp theo</label><input id="crm2_next" type="datetime-local" value="${c.nextCareAt?new Date(c.nextCareAt).toISOString().slice(0,16):''}"></div><div class="field full"><label>Kết quả gần nhất</label><input id="crm2_result" value="${esc(c.careResult||'')}"></div><div class="field full"><label>Ghi chú</label><textarea id="crm2_note" rows="3">${esc(c.note||'')}</textarea></div></div><button class="btn primary block" onclick="saveCrm2Customer()">LƯU KHÁCH CRM</button>`)}

  function detailModal(m){const c=cust(m.customerId);if(!c)return sheet('CRM','<div class="empty">Không tìm thấy khách.</div>');const invs=(db.invoices||[]).filter(i=>String(i.customerId)===String(c.id)&&i.status!=='Đã hủy'),ims=(db.imeis||[]).filter(i=>String(i.customerId)===String(c.id)),ws=(db.warranties||[]).filter(w=>w.phone===c.phone||ims.some(i=>i.value===w.imei)),rs=(db.returns||[]).filter(r=>String(r.customerId)===String(c.id)&&r.status!=='Đã hủy'),spend=Math.max(0,invs.reduce((s,i)=>s+(+i.total||0),0)-rs.reduce((s,r)=>s+(+r.amount||0),0));return sheet(c.name,`<div class="crm2-profile-head"><div><span>Trạng thái</span><select onchange="crm2SetStatus(${JSON.stringify(c.id)},this.value)">${statusOptions(c.status)}</select></div><button class="btn primary" onclick="openCrm2Care(${JSON.stringify(c.id)})">＋ Ghi nhận chăm sóc</button></div><div class="crm2-profile-kpis"><div><span>Mua ròng</span><b>${money(spend)}</b></div><div><span>Đơn hàng</span><b>${invs.length}</b></div><div><span>Công nợ</span><b class="${c.debt?'danger-text':''}">${money(c.debt||0)}</b></div><div><span>Điểm</span><b>${+c.points||0}</b></div><div><span>IMEI đã mua</span><b>${ims.length}</b></div><div><span>Bảo hành</span><b>${ws.length}</b></div></div><div class="crm2-profile-grid"><section class="card"><h4>Thông tin liên hệ</h4><div><span>SĐT</span><b>${esc(c.phone||'—')}</b></div><div><span>SĐT 2</span><b>${esc(c.phone2||'—')}</b></div><div><span>Email</span><b>${esc(c.email||'—')}</b></div><div><span>Địa chỉ</span><b>${esc(c.address||'—')}</b></div><div><span>Nguồn</span><b>${esc(c.source||'—')}</b></div><div><span>Phụ trách</span><b>${esc(c.owner||'—')}</b></div></section><section class="card"><h4>Nhu cầu & cơ hội</h4><div><span>Nhu cầu</span><b>${esc(c.need||'—')}</b></div><div><span>Sản phẩm quan tâm</span><b>${esc(c.interestedProducts||'—')}</b></div><div><span>Ngân sách</span><b>${esc(c.budget||'—')}</b></div><div><span>Số lượng</span><b>${esc(c.expectedQty||'—')}</b></div><div><span>Dự kiến mua</span><b>${c.expectedPurchaseDate?fmtDate(c.expectedPurchaseDate):'—'}</b></div><div><span>Care tiếp</span><b class="crm2-care-${careKind(c)}">${c.nextCareAt?fmtDateTime(c.nextCareAt):'Chưa đặt lịch'}</b></div></section></div><div class="crm2-detail-actions"><button class="btn ghost" onclick="openCrmCustomerForm(${JSON.stringify(c.id)})">Sửa hồ sơ</button>${c.phone?`<a class="btn ghost" href="tel:${esc(c.phone)}">Gọi điện</a>`:''}</div><div class="section-title">Lịch sử chăm sóc</div><div class="crm2-history">${(c.careHistory||[]).map(h=>`<div><span><b>${esc(h.channel||'Cập nhật')}</b><small>${fmtDateTime(h.date)}${h.status?` • ${esc(statusLabel(h.status))}`:''}</small></span><p>${esc(h.result||h.note||'')}</p>${h.note&&h.result?`<small>${esc(h.note)}</small>`:''}${h.nextCareAt?`<em>Hẹn tiếp: ${fmtDateTime(h.nextCareAt)}</em>`:''}</div>`).join('')||'<div class="empty">Chưa có lịch sử chăm sóc.</div>'}</div><div class="section-title">Giao dịch gần đây</div><div class="crm2-mini-list">${invs.slice(0,8).map(i=>`<button onclick="openInvoiceDetail(${i.id})"><span><b>${esc(i.code)}</b><small>${fmtDateTime(i.date)}</small></span><b>${money(i.total||0)}</b></button>`).join('')||'<div class="empty">Chưa có hóa đơn.</div>'}</div>`)}

  function careModal(m){const c=cust(m.customerId);if(!c)return '';return sheet('Chăm sóc • '+c.name,`<div class="notice">${esc(c.phone||'Chưa có SĐT')} • ${esc(statusLabel(c.status))}${c.need?`<br>${esc(c.need)}`:''}</div><div class="form-row" style="margin-top:12px"><div class="field"><label>Kênh</label><select id="crm2c_channel">${CHANNELS.map(x=>`<option ${x===c.careChannel?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Trạng thái sau chăm sóc</label><select id="crm2c_status">${statusOptions(c.status)}</select></div></div><div class="field"><label>Kết quả *</label><input id="crm2c_result" placeholder="VD: Khách quan tâm, gửi báo giá..."></div><div class="field"><label>Ghi chú chi tiết</label><textarea id="crm2c_note" rows="3"></textarea></div><div class="field"><label>Lịch chăm sóc tiếp theo</label><input id="crm2c_next" type="datetime-local" value="${c.nextCareAt?new Date(c.nextCareAt).toISOString().slice(0,16):''}"></div><button class="btn primary block" onclick="saveCrm2Care()">LƯU CHĂM SÓC</button>`)}

  window.modalView=modalView=function(){if(state.modal?.type==='crm2Form')return formModal(state.modal);if(state.modal?.type==='crm2Detail')return detailModal(state.modal);if(state.modal?.type==='crm2Care')return careModal(state.modal);return baseModalView()};
})();
