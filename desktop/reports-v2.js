/* KPOS Reports V2 - unified business reports */
(function(){
  state.r2Period=state.r2Period||'30';
  state.r2From=state.r2From||'';
  state.r2To=state.r2To||'';
  state.r2Tab=state.r2Tab||'overview';

  const n=v=>Number(v)||0;
  const startDay=v=>{const d=new Date(v);d.setHours(0,0,0,0);return d};
  const endDay=v=>{const d=new Date(v);d.setHours(23,59,59,999);return d};
  const ymd=v=>{const d=new Date(v),p=x=>String(x).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
  const validDate=v=>{const d=new Date(v);return !Number.isNaN(d.getTime())};

  function bounds(){
    const now=new Date(),mode=state.r2Period||'30';
    if(mode==='all')return {from:null,to:null,label:'Tất cả thời gian'};
    if(mode==='custom'){
      const from=state.r2From&&validDate(state.r2From)?startDay(state.r2From):null;
      const to=state.r2To&&validDate(state.r2To)?endDay(state.r2To):null;
      return {from,to,label:`${from?from.toLocaleDateString('vi-VN'):'...'} → ${to?to.toLocaleDateString('vi-VN'):'...'}`};
    }
    const days=mode==='today'?1:Math.max(1,n(mode)||30),from=startDay(now),to=endDay(now);
    if(days>1)from.setDate(from.getDate()-(days-1));
    return {from,to,label:days===1?'Hôm nay':`${days} ngày gần nhất`};
  }
  function inRange(date){if(!date)return false;const d=new Date(date),b=bounds();if(Number.isNaN(d.getTime()))return false;return (!b.from||d>=b.from)&&(!b.to||d<=b.to)}
  function active(arr){return (arr||[]).filter(x=>x.status!=='Đã hủy'&&x.status!=='Hủy')}
  function activeInvoices(){return active(db.invoices)}
  function activeReturns(){return active(db.returns)}
  function activePayments(){return active(db.payments)}
  function selectedInvoices(){return activeInvoices().filter(x=>inRange(x.date))}
  function selectedReturns(){return activeReturns().filter(x=>inRange(x.date))}
  function selectedPayments(){return activePayments().filter(x=>inRange(x.date))}
  function selectedReceipts(){return active(db.stockReceipts).filter(x=>inRange(x.date))}
  function selectedAdjustments(){return active(db.adjustmentReceipts).filter(x=>inRange(x.date))}
  function selectedWarranties(){return active(db.warranties).filter(x=>inRange(x.receivedAt||x.date))}

  window.setR2Period=v=>{state.r2Period=v;render()};
  window.setR2Custom=(k,v)=>{state[k]=v;state.r2Period='custom'};
  window.applyR2Custom=()=>{state.r2Period='custom';render()};
  window.setR2Tab=v=>{state.r2Tab=v;render()};

  function metric(label,value,sub='',tone=''){
    return `<div class="r2-kpi ${tone}"><span>${esc(label)}</span><b>${value}</b>${sub?`<small>${sub}</small>`:''}</div>`;
  }
  function section(title,sub,body,action=''){
    return `<section class="r2-panel"><div class="r2-panel-head"><div><b>${title}</b>${sub?`<small>${sub}</small>`:''}</div>${action}</div>${body}</section>`;
  }
  function filters(){
    const b=bounds();
    return `<div class="r2-filterbar"><div class="r2-periods">${[['today','Hôm nay'],['7','7 ngày'],['30','30 ngày'],['all','Tất cả']].map(([v,l])=>`<button class="${state.r2Period===v?'active':''}" onclick="setR2Period('${v}')">${l}</button>`).join('')}<button class="${state.r2Period==='custom'?'active':''}" onclick="setR2Period('custom')">Từ–Đến</button></div><div class="r2-custom"><input type="date" value="${esc(state.r2From||'')}" onchange="setR2Custom('r2From',this.value)"><span>→</span><input type="date" value="${esc(state.r2To||'')}" onchange="setR2Custom('r2To',this.value)"><button class="btn ghost small" onclick="applyR2Custom()">Áp dụng</button></div><div class="r2-range-label">${esc(b.label)}</div><button class="btn ghost" onclick="exportReportsV2()">⬇ Xuất Excel</button></div>`;
  }

  function salesData(){
    const invs=selectedInvoices(),rets=selectedReturns(),pays=selectedPayments();
    const gross=invs.reduce((s,x)=>s+n(x.total),0),returns=rets.reduce((s,x)=>s+n(x.amount),0),net=Math.max(0,gross-returns);
    const grossProfit=invs.reduce((s,x)=>s+n(x.profit),0),returnProfit=rets.reduce((s,x)=>s+n(x.profitImpact),0),profit=grossProfit-returnProfit;
    const cash=pays.filter(x=>x.method==='Tiền mặt').reduce((s,x)=>s+n(x.amount),0);
    const bank=pays.filter(x=>x.method==='Chuyển khoản').reduce((s,x)=>s+n(x.amount),0);
    const card=pays.filter(x=>['Thẻ/POS','Thẻ','POS'].includes(x.method)).reduce((s,x)=>s+n(x.amount),0);
    const debtGenerated=invs.reduce((s,x)=>s+n(x.debt),0),currentDebt=(db.customers||[]).reduce((s,x)=>s+n(x.debt),0);
    return {invs,rets,pays,gross,returns,net,grossProfit,returnProfit,profit,cash,bank,card,debtGenerated,currentDebt,avg:invs.length?net/invs.length:0};
  }

  function productRows(){
    const invs=selectedInvoices(),rets=selectedReturns(),map=new Map();
    const get=id=>{if(!map.has(String(id)))map.set(String(id),{productId:id,sold:0,returned:0,revenue:0,cost:0});return map.get(String(id))};
    invs.forEach(inv=>(inv.items||[]).forEach(it=>{const r=get(it.productId);r.sold+=n(it.qty);r.revenue+=n(it.qty)*n(it.price);const p=product(it.productId);r.cost+=n(it.qty)*n(p?.cost)}));
    rets.forEach(ret=>(ret.items||[]).forEach(it=>{const r=get(it.productId);r.returned+=n(it.qty)}));
    return [...map.values()].map(r=>({...r,netQty:r.sold-r.returned})).sort((a,b)=>b.revenue-a.revenue).slice(0,20);
  }

  function dailyChart(){
    const invs=selectedInvoices(),rets=selectedReturns(),map=new Map();
    invs.forEach(x=>{const k=ymd(x.date),v=map.get(k)||{gross:0,returns:0};v.gross+=n(x.total);map.set(k,v)});
    rets.forEach(x=>{const k=ymd(x.date),v=map.get(k)||{gross:0,returns:0};v.returns+=n(x.amount);map.set(k,v)});
    const rows=[...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-31).map(([date,v])=>({date,gross:v.gross,returns:v.returns,net:v.gross-v.returns}));
    const max=Math.max(1,...rows.map(x=>Math.max(0,x.net)));
    return `<div class="r2-chart">${rows.length?rows.map(x=>`<div class="r2-bar-col" title="${x.date} • ${money(x.net)}"><div class="r2-bar-wrap"><i style="height:${Math.max(3,Math.round(Math.max(0,x.net)/max*100))}%"></i></div><small>${x.date.slice(5)}</small><b>${money(x.net)}</b></div>`).join(''):'<div class="empty">Chưa có dữ liệu trong kỳ.</div>'}</div>`;
  }

  function paymentBreakdown(s){
    const total=Math.abs(s.cash)+Math.abs(s.bank)+Math.abs(s.card)||1;
    const row=(label,val)=>`<div class="r2-payrow"><span>${label}</span><div><i style="width:${Math.min(100,Math.abs(val)/total*100)}%"></i></div><b>${money(val)}</b></div>`;
    return `<div class="r2-payments">${row('Tiền mặt',s.cash)}${row('Chuyển khoản',s.bank)}${row('Thẻ/POS',s.card)}</div>`;
  }

  function inventoryData(){
    const receipts=selectedReceipts(),adjustments=selectedAdjustments();
    const receivedQty=receipts.reduce((s,r)=>s+(r.items||[]).reduce((a,it)=>a+n(it.qty),0),0);
    const receivedValue=receipts.reduce((s,r)=>s+(r.items||[]).reduce((a,it)=>a+n(it.qty)*(n(it.buyPrice)||n(product(it.productId)?.cost)),0),0);
    const soldQty=selectedInvoices().reduce((s,inv)=>s+(inv.items||[]).reduce((a,it)=>a+n(it.qty),0),0);
    const returnedQty=selectedReturns().reduce((s,r)=>s+(r.items||[]).reduce((a,it)=>a+n(it.qty),0),0);
    const adjustmentQty=adjustments.reduce((s,a)=>s+(a.items||[]).reduce((x,it)=>x+n(it.delta),0),0);
    const activeProducts=(db.products||[]).filter(p=>p.active!==false);
    const stockQty=activeProducts.reduce((s,p)=>s+n(p.stock),0),stockValue=activeProducts.reduce((s,p)=>s+n(p.stock)*n(p.cost),0),low=activeProducts.filter(p=>n(p.stock)<=n(p.minStock));
    const imeiStock=(db.imeis||[]).filter(i=>i.status==='Trong kho').length;
    const imeiSold=(db.imeis||[]).filter(i=>i.soldDate&&inRange(i.soldDate)).length;
    const imeiWarranty=(db.imeis||[]).filter(i=>i.status==='Bảo hành').length;
    const returnedImeis=selectedReturns().reduce((s,r)=>s+(r.items||[]).reduce((a,it)=>a+(it.imeis?.length||0),0),0);
    return {receipts,adjustments,receivedQty,receivedValue,soldQty,returnedQty,adjustmentQty,stockQty,stockValue,low,imeiStock,imeiSold,imeiWarranty,returnedImeis};
  }

  function crmData(){
    const customers=db.customers||[],now=new Date(),today=startDay(now),tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
    const closed=new Set(['Đã mua hàng','Không mua','Mất khách']);
    const careToday=customers.filter(c=>c.nextCareAt&&new Date(c.nextCareAt)>=today&&new Date(c.nextCareAt)<tomorrow&&!closed.has(c.status));
    const overdue=customers.filter(c=>c.nextCareAt&&new Date(c.nextCareAt)<now&&!closed.has(c.status));
    const upcoming=customers.filter(c=>c.nextCareAt&&new Date(c.nextCareAt)>=tomorrow&&!closed.has(c.status));
    const won=customers.filter(c=>c.status==='Đã mua hàng').length;
    const statuses=(window.KPOS_CRM_STATUSES||[['Khách mới','Khách mới'],['Chưa liên hệ','Chưa liên hệ'],['Đã liên hệ','Đã liên hệ'],['Đang tư vấn','Đang tư vấn'],['Khách quan tâm','Khách quan tâm'],['Chờ khách phản hồi','Chờ phản hồi'],['Hẹn gọi lại','Hẹn gọi lại'],['Hẹn gặp/demo','Hẹn gặp/demo'],['Đang báo giá','Đang báo giá'],['Đang cân nhắc','Đang cân nhắc'],['Đã mua hàng','Đã mua'],['Không mua','Không mua'],['Mất khách','Mất khách']]);
    return {customers,careToday,overdue,upcoming,won,conversion:customers.length?won/customers.length*100:0,statuses};
  }

  function warrantyData(){
    const rows=selectedWarranties(),all=db.warranties||[],now=new Date();
    const processing=all.filter(w=>!['Đã trả khách','Hủy'].includes(w.status)&&w.status!=='Hoàn thành');
    const overdue=processing.filter(w=>w.promisedAt&&new Date(w.promisedAt)<now);
    const completed=all.filter(w=>w.completedAt&&inRange(w.completedAt)).length;
    const returned=all.filter(w=>w.returnedAt&&inRange(w.returnedAt)).length;
    return {rows,processing,overdue,completed,returned};
  }

  function overview(){
    const s=salesData(),i=inventoryData(),c=crmData(),w=warrantyData();
    return `<div class="r2-kpis main">${metric('Doanh thu ròng',money(s.net),`Gộp ${money(s.gross)} • Trả ${money(s.returns)}`,'orange')}${metric('Lợi nhuận ròng',money(s.profit),`Lợi nhuận gộp ${money(s.grossProfit)}`,'green')}${metric('Tổng đơn',s.invs.length,`TB ${money(s.avg)}`)}${metric('Công nợ hiện tại',money(s.currentDebt),`${(db.customers||[]).filter(x=>n(x.debt)>0).length} khách`,'red')}${metric('Giá trị tồn kho',money(i.stockValue),`${i.stockQty} sản phẩm tồn`)}${metric('CRM quá hạn',c.overdue.length,`${c.careToday.length} care hôm nay`,c.overdue.length?'red':'')}${metric('BH đang xử lý',w.processing.length,`${w.overdue.length} quá hẹn`,w.overdue.length?'red':'')}${metric('IMEI trong kho',i.imeiStock,`${i.imeiWarranty} đang bảo hành`)}</div>
      <div class="r2-grid two">${section('Doanh thu ròng theo ngày','Đã trừ trả hàng / hoàn tiền',dailyChart())}${section('Dòng tiền theo phương thức','Giá trị thu/hoàn trong kỳ',paymentBreakdown(s))}</div>
      <div class="r2-grid two">${section('Kho & IMEI','Biến động chính trong kỳ',`<div class="r2-mini-grid">${metric('Nhập kho',i.receivedQty,money(i.receivedValue))}${metric('Bán ra',i.soldQty)}${metric('Trả về',i.returnedQty)}${metric('Điều chỉnh',i.adjustmentQty>0?'+'+i.adjustmentQty:String(i.adjustmentQty))}${metric('IMEI bán',i.imeiSold)}${metric('IMEI trả về',i.returnedImeis)}</div>`)}${section('CRM & Bảo hành','Tình trạng hiện tại',`<div class="r2-mini-grid">${metric('Tổng khách',c.customers.length)}${metric('Đã chốt',c.won,`${c.conversion.toFixed(1)}%`,'green')}${metric('Care quá hạn',c.overdue.length,'','red')}${metric('BH tiếp nhận',w.rows.length)}${metric('BH hoàn thành',w.completed,'','green')}${metric('BH quá hẹn',w.overdue.length,'','red')}</div>`)}</div>`;
  }

  function salesTab(){
    const s=salesData(),rows=productRows();
    const body=`<div class="r2-table"><div class="r2-tr head"><div>Sản phẩm</div><div class="right">Bán</div><div class="right">Trả</div><div class="right">SL ròng</div><div class="right">Doanh thu gộp</div></div>${rows.map(r=>{const p=product(r.productId);return `<div class="r2-tr"><div><b>${esc(p?.name||'Sản phẩm đã xóa')}</b><small>${esc(p?.sku||'')}</small></div><div class="right"><b>${r.sold}</b></div><div class="right"><b class="danger-text">${r.returned}</b></div><div class="right"><b>${r.netQty}</b></div><div class="right"><b>${money(r.revenue)}</b></div></div>`}).join('')||'<div class="empty">Chưa có dữ liệu sản phẩm.</div>'}</div>`;
    return `<div class="r2-kpis">${metric('Doanh thu gộp',money(s.gross))}${metric('Trả/hoàn',money(s.returns),'','red')}${metric('Doanh thu ròng',money(s.net),'','orange')}${metric('Lợi nhuận ròng',money(s.profit),'','green')}${metric('Tổng đơn',s.invs.length)}${metric('Giá trị đơn TB',money(s.avg))}${metric('Nợ phát sinh',money(s.debtGenerated))}${metric('Công nợ hiện tại',money(s.currentDebt),'','red')}</div><div class="r2-grid two">${section('Doanh thu theo ngày','Đã trừ trả hàng',dailyChart())}${section('Thanh toán','Tiền mặt • chuyển khoản • thẻ/POS',paymentBreakdown(s))}</div>${section('Sản phẩm bán trong kỳ','Top 20 theo doanh thu gộp',body)}`;
  }

  function stockTab(){
    const i=inventoryData();
    const lowRows=i.low.sort((a,b)=>n(a.stock)-n(b.stock)).slice(0,20).map(p=>`<div class="r2-tr"><div><b>${esc(p.name)}</b><small>${esc(p.sku||'')} ${p.imeiEnabled?'• IMEI/Serial':''}</small></div><div class="right"><b>${n(p.stock)}</b></div><div class="right"><b>${n(p.minStock)}</b></div><div class="right"><b>${money(n(p.stock)*n(p.cost))}</b></div></div>`).join('');
    return `<div class="r2-kpis">${metric('Nhập trong kỳ',i.receivedQty,money(i.receivedValue))}${metric('Bán ra',i.soldQty)}${metric('Trả về kho',i.returnedQty)}${metric('Điều chỉnh',i.adjustmentQty>0?'+'+i.adjustmentQty:String(i.adjustmentQty))}${metric('Tồn hiện tại',i.stockQty,money(i.stockValue))}${metric('Sắp hết/hết',i.low.length,'','red')}${metric('IMEI trong kho',i.imeiStock)}${metric('IMEI đang BH',i.imeiWarranty)}</div>${section('Sản phẩm sắp hết / hết hàng','Theo tồn tối thiểu hiện tại',`<div class="r2-table"><div class="r2-tr head"><div>Sản phẩm</div><div class="right">Tồn</div><div class="right">Tối thiểu</div><div class="right">Giá trị tồn</div></div>${lowRows||'<div class="empty">Không có sản phẩm dưới tồn tối thiểu.</div>'}</div>`)}`;
  }

  function crmWarrantyTab(){
    const c=crmData(),w=warrantyData();
    const statusRows=c.statuses.map(([v,l])=>{const count=c.customers.filter(x=>(x.status||'Khách mới')===v).length;return `<div class="r2-status-row"><span>${esc(l)}</span><div><i style="width:${c.customers.length?Math.max(2,count/c.customers.length*100):0}%"></i></div><b>${count}</b></div>`}).join('');
    const warrantyStatuses=['Mới tiếp nhận','Đang kiểm tra','Đang sửa','Chờ linh kiện','Hoàn thành','Đã trả khách','Hủy'];
    const wRows=warrantyStatuses.map(s=>{const count=(db.warranties||[]).filter(x=>x.status===s).length;return `<div class="r2-status-row"><span>${esc(s)}</span><div><i style="width:${(db.warranties||[]).length?Math.max(2,count/(db.warranties||[]).length*100):0}%"></i></div><b>${count}</b></div>`}).join('');
    return `<div class="r2-kpis">${metric('Tổng khách',c.customers.length)}${metric('Đã chốt',c.won,`${c.conversion.toFixed(1)}%`,'green')}${metric('Care hôm nay',c.careToday.length)}${metric('Care sắp tới',c.upcoming.length)}${metric('Care quá hạn',c.overdue.length,'','red')}${metric('BH tiếp nhận kỳ này',w.rows.length)}${metric('BH đang xử lý',w.processing.length)}${metric('BH quá hẹn',w.overdue.length,'','red')}</div><div class="r2-grid two">${section('Pipeline CRM hiện tại','13 trạng thái khách hàng',`<div class="r2-status-list">${statusRows}</div>`)}${section('Bảo hành hiện tại','Phân bố trạng thái phiếu',`<div class="r2-status-list">${wRows}</div>`)}</div>`;
  }

  window.reportsView=reportsView=function(){
    const tab=state.r2Tab||'overview';
    const content=tab==='sales'?salesTab():tab==='stock'?stockTab():tab==='crm'?crmWarrantyTab():overview();
    return `${topbar('Báo cáo tổng hợp','Bán hàng • lợi nhuận • trả hàng • thanh toán • công nợ • kho • IMEI • CRM • bảo hành')}<div class="content r2-page">${filters()}<div class="r2-tabs">${[['overview','Tổng hợp'],['sales','Bán hàng & tài chính'],['stock','Kho & IMEI'],['crm','CRM & Bảo hành']].map(([v,l])=>`<button class="${tab===v?'active':''}" onclick="setR2Tab('${v}')">${l}</button>`).join('')}</div>${content}</div>${nav()}`;
  };

  window.exportReportsV2=()=>{
    if(typeof XLSX==='undefined')return toast('Chưa tải được thư viện Excel');
    const s=salesData(),i=inventoryData(),c=crmData(),w=warrantyData(),rows=productRows();
    const wb=XLSX.utils.book_new();
    const summary=[
      ['BÁO CÁO KPOS',bounds().label],['Chỉ số','Giá trị'],['Doanh thu gộp',s.gross],['Trả/hoàn',s.returns],['Doanh thu ròng',s.net],['Lợi nhuận ròng',s.profit],['Tổng đơn',s.invs.length],['Tiền mặt',s.cash],['Chuyển khoản',s.bank],['Thẻ/POS',s.card],['Công nợ hiện tại',s.currentDebt],['Tồn hiện tại',i.stockQty],['Giá trị tồn',i.stockValue],['IMEI trong kho',i.imeiStock],['Tổng khách',c.customers.length],['Đã chốt',c.won],['Care quá hạn',c.overdue.length],['BH tiếp nhận trong kỳ',w.rows.length],['BH quá hẹn',w.overdue.length]
    ];
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(summary),'Tong hop');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.map(r=>{const p=product(r.productId);return {SKU:p?.sku||'',SanPham:p?.name||'',Ban:r.sold,Tra:r.returned,SoLuongRong:r.netQty,DoanhThuGop:r.revenue}})),'San pham');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(c.statuses.map(([v,l])=>({TrangThai:l,SoKhach:c.customers.filter(x=>(x.status||'Khách mới')===v).length}))),'CRM');
    XLSX.writeFile(wb,`KPOS-Bao-Cao-${ymd(new Date())}.xlsx`);
  };
})();
