/* KPOS Dashboard V2 - business-first overview for desktop + mobile */
(function(){
  state.dashboardPreset=state.dashboardPreset||'today';
  state.dashboardFrom=state.dashboardFrom||'';
  state.dashboardTo=state.dashboardTo||'';

  const startDay=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
  const endDay=d=>{const x=new Date(d);x.setHours(23,59,59,999);return x};
  const activeInvoices=()=> (db.invoices||[]).filter(x=>x.status!=='Đã hủy');
  const activeReturns=()=> (db.returns||[]).filter(x=>x.status!=='Đã hủy');
  const activePayments=()=> (db.payments||[]).filter(x=>x.status!=='Đã hủy');

  function bounds(){
    const now=new Date();
    if(state.dashboardPreset==='all')return {start:null,end:null,label:'Tất cả thời gian'};
    if(state.dashboardPreset==='custom'){
      const s=state.dashboardFrom?startDay(state.dashboardFrom):null;
      const e=state.dashboardTo?endDay(state.dashboardTo):null;
      return {start:s,end:e,label:'Từ ngày - đến ngày'};
    }
    const days=state.dashboardPreset==='7'?7:state.dashboardPreset==='30'?30:1;
    const s=startDay(now);s.setDate(s.getDate()-(days-1));
    return {start:s,end:now,label:days===1?'Hôm nay':`${days} ngày gần nhất`};
  }
  function inRange(date){
    const {start,end}=bounds(),d=new Date(date);
    return (!start||d>=start)&&(!end||d<=end);
  }
  window.setDashboardPreset=v=>{state.dashboardPreset=v;render()};
  window.applyDashboardRange=()=>{
    const f=$('#dashboardFrom')?.value||'',t=$('#dashboardTo')?.value||'';
    if(f&&t&&new Date(f)>new Date(t))return toast('Ngày bắt đầu phải trước ngày kết thúc');
    state.dashboardFrom=f;state.dashboardTo=t;state.dashboardPreset='custom';render();
  };

  function kpi(icon,label,value,sub,tone=''){
    return `<div class="dash2-kpi ${tone}"><div class="dash2-kpi-icon">${icon}</div><div class="dash2-kpi-body"><span>${label}</span><b>${value}</b><small>${sub||''}</small></div></div>`;
  }
  function filterBar(){
    const preset=state.dashboardPreset;
    return `<div class="dash2-filter"><div class="dash2-presets">${[['today','Hôm nay'],['7','7 ngày'],['30','30 ngày'],['all','Tất cả']].map(([v,l])=>`<button class="${preset===v?'active':''}" onclick="setDashboardPreset('${v}')">${l}</button>`).join('')}</div><div class="dash2-range"><input id="dashboardFrom" type="date" value="${esc(state.dashboardFrom||'')}"><span>đến</span><input id="dashboardTo" type="date" value="${esc(state.dashboardTo||'')}"><button class="btn ghost small ${preset==='custom'?'active':''}" onclick="applyDashboardRange()">Áp dụng</button></div></div>`;
  }

  function dailySeries(invs,returns){
    const {start,end}=bounds();
    const now=end?new Date(end):new Date();
    let days=state.dashboardPreset==='today'?7:state.dashboardPreset==='7'?7:14;
    if(state.dashboardPreset==='custom'&&start&&end){days=Math.min(21,Math.max(1,Math.ceil((end-start)/86400000)+1));}
    const first=start&&state.dashboardPreset==='custom'?new Date(start):(()=>{const d=startDay(now);d.setDate(d.getDate()-(days-1));return d})();
    const arr=[];
    for(let i=0;i<days;i++){
      const d=new Date(first);d.setDate(first.getDate()+i);const key=d.toISOString().slice(0,10);
      const revenue=invs.filter(x=>new Date(x.date).toISOString().slice(0,10)===key).reduce((a,b)=>a+(Number(b.total)||0),0);
      const returned=returns.filter(x=>new Date(x.date).toISOString().slice(0,10)===key).reduce((a,b)=>a+(Number(b.amount)||0),0);
      arr.push({date:d,value:Math.max(0,revenue-returned)});
    }
    return arr;
  }
  function chartHtml(series){
    const max=Math.max(1,...series.map(x=>x.value));
    return `<div class="dash2-chart">${series.map(x=>{const h=Math.max(4,Math.round((x.value/max)*100));return `<div class="dash2-bar-wrap" title="${fmtDate(x.date)} • ${money(x.value)}"><div class="dash2-bar-value">${x.value?money(x.value):''}</div><div class="dash2-bar" style="height:${h}%"></div><span>${new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit'}).format(x.date)}</span></div>`}).join('')}</div>`;
  }

  window.dashboard=dashboard=function(){
    const invs=activeInvoices().filter(x=>inRange(x.date));
    const returns=activeReturns().filter(x=>inRange(x.date));
    const pays=activePayments().filter(x=>inRange(x.date));
    const grossRevenue=invs.reduce((a,b)=>a+(Number(b.total)||0),0);
    const returned=returns.reduce((a,b)=>a+(Number(b.amount)||0),0);
    const revenue=Math.max(0,grossRevenue-returned);
    const grossProfit=invs.reduce((a,b)=>a+(Number(b.profit)||0),0);
    const returnedProfit=returns.reduce((a,b)=>a+(Number(b.profitImpact)||0),0);
    const profit=grossProfit-returnedProfit;
    const cash=pays.filter(p=>p.method==='Tiền mặt').reduce((a,b)=>a+(Number(b.amount)||0),0);
    const bank=pays.filter(p=>p.method==='Chuyển khoản').reduce((a,b)=>a+(Number(b.amount)||0),0);
    const card=pays.filter(p=>p.method==='Thẻ/POS').reduce((a,b)=>a+(Number(b.amount)||0),0);
    const debt=(db.customers||[]).reduce((a,b)=>a+(Number(b.debt)||0),0);
    const debtCustomers=(db.customers||[]).filter(c=>(Number(c.debt)||0)>0).length;
    const low=(db.products||[]).filter(p=>(Number(p.stock)||0)<=(Number(p.minStock)||0)).sort((a,b)=>(a.stock||0)-(b.stock||0));
    const today=new Date(), overdue=(db.customers||[]).filter(c=>c.nextCareAt&&new Date(c.nextCareAt)<today&&!['Đã mua hàng','Đã chốt','Không mua','Mất khách'].includes(c.status));
    const recent=[...invs].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);
    const series=dailySeries(activeInvoices(),activeReturns());
    const {label}=bounds();

    return `${topbar('Tổng quan','Doanh thu • lợi nhuận • đơn hàng • trả hàng • dòng tiền • công nợ')}
      <div class="content dash2-page">
        <div class="dash2-head"><div><div class="dash2-eyebrow">KPOS BUSINESS OVERVIEW</div><h2>Tình hình kinh doanh</h2><p>${label} • Không tính hóa đơn đã hủy</p></div>${filterBar()}</div>

        <div class="dash2-kpis">
          ${kpi('₫','Doanh thu',money(revenue),returned?`Gộp ${money(grossRevenue)} • Trừ trả ${money(returned)}`:`${invs.length} hóa đơn`,'orange')}
          ${kpi('↗','Lợi nhuận',money(profit),'Đã trừ ảnh hưởng trả hàng','green')}
          ${kpi('▣','Tổng đơn',String(invs.length),`${invs.filter(i=>i.debt>0).length} đơn còn nợ`)}
          ${kpi('↩','Trả hàng',money(returned),`${returns.length} phiếu trả / đổi`,'red')}
          ${kpi('●','Tiền mặt',money(cash),'Dòng tiền ròng trong kỳ')}
          ${kpi('⇄','Chuyển khoản',money(bank),'Dòng tiền ròng trong kỳ')}
          ${kpi('▰','Thẻ / POS',money(card),'Dòng tiền ròng trong kỳ')}
          ${kpi('!','Công nợ',money(debt),`${debtCustomers} khách đang nợ`,'red')}
        </div>

        <div class="dash2-grid-main">
          <section class="dash2-panel dash2-revenue-panel"><div class="dash2-panel-head"><div><b>Doanh thu ròng theo ngày</b><small>Đã trừ trả hàng / hoàn tiền</small></div><button class="btn ghost small" onclick="go('reports')">Báo cáo chi tiết</button></div>${chartHtml(series)}</section>
          <section class="dash2-panel"><div class="dash2-panel-head"><div><b>Cần xử lý</b><small>Kho • CRM • công nợ</small></div></div><div class="dash2-alerts">
            <button onclick="go('products')"><span>📦 <b>Hàng sắp hết</b><small>${low.slice(0,3).map(p=>`${p.name} (${p.stock})`).join(' • ')||'Tồn kho đang ổn'}</small></span><strong>${low.length}</strong></button>
            <button onclick="go('crmOverdue')"><span>⏰ <b>CRM quá hạn</b><small>${overdue.slice(0,2).map(c=>c.name).join(' • ')||'Không có lịch quá hạn'}</small></span><strong>${overdue.length}</strong></button>
            <button onclick="go('debts')"><span>💰 <b>Khách còn nợ</b><small>${debtCustomers?`${debtCustomers} khách cần theo dõi`:'Không có công nợ'}</small></span><strong>${money(debt)}</strong></button>
          </div></section>
        </div>

        <div class="dash2-grid-bottom">
          <section class="dash2-panel"><div class="dash2-panel-head"><div><b>Hóa đơn gần đây</b><small>Trong khoảng thời gian đang chọn</small></div><button class="btn ghost small" onclick="go('invoices')">Tất cả hóa đơn</button></div><div class="dash2-orders"><div class="dash2-order dash2-order-head"><span>Mã hóa đơn</span><span>Khách hàng</span><span>Thời gian</span><span class="right">Giá trị</span></div>${recent.map(inv=>{const c=customer(inv.customerId);return `<button class="dash2-order" onclick="openInvoiceDetail(${inv.id})"><span><b>${esc(inv.code)}</b><small>${esc(inv.status||'')}</small></span><span>${esc(c?.name||'Khách lẻ')}</span><span>${fmtDateTime(inv.date)}</span><span class="right"><b>${money(inv.total||0)}</b>${inv.debt?`<small class="danger-text">Nợ ${money(inv.debt)}</small>`:''}</span></button>`}).join('')||'<div class="empty">Chưa có hóa đơn trong kỳ.</div>'}</div></section>
          <section class="dash2-panel"><div class="dash2-panel-head"><div><b>Thao tác nhanh</b><small>Đi thẳng tới nghiệp vụ thường dùng</small></div></div><div class="dash2-actions"><button onclick="go('pos')">🛒<span><b>Bán hàng</b><small>Mở POS</small></span></button><button onclick="openStockReceipt()">📥<span><b>Nhập hàng</b><small>Barcode & IMEI</small></span></button><button onclick="go('customers')">👤<span><b>Khách hàng</b><small>Lịch sử & công nợ</small></span></button><button onclick="go('crmCustomers')">👥<span><b>CRM</b><small>Chăm sóc khách</small></span></button><button onclick="go('warranty')">🛡️<span><b>Bảo hành</b><small>Tra IMEI</small></span></button><button onclick="go('prints')">🖨️<span><b>Mẫu in</b><small>K80 & A4</small></span></button></div></section>
        </div>
      </div>${nav()}`;
  };
})();
