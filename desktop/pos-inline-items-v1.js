/* KPOS POS V4 inline item controls - edit price, note and IMEI directly on sales screen */
(function(){
  const desktopMQ=window.matchMedia('(min-width:980px)');
  const baseRender=window.render;
  let noteTimer=null;
  const isDesktop=()=>desktopMQ.matches;

  function validCart(){return (db.cart||[]).filter(c=>product(c.productId))}
  function linePrice(c){
    const p=product(c.productId),custom=Number(c.unitPrice);
    return Number.isFinite(custom)&&custom>=0?custom:(Number(p?.price)||0);
  }
  function idArg(v){return JSON.stringify(v)}

  window.pos4ItemPrice=(index,value)=>{
    const c=validCart()[Number(index)];if(!c)return;
    if(typeof window.updateCartUnitPrice==='function')return window.updateCartUnitPrice(c.productId,value);
    const n=Math.max(0,Number(value)||0);c.unitPrice=n;saveDB();render();
  };
  window.pos4ItemResetPrice=index=>{
    const c=validCart()[Number(index)];if(!c)return;
    if(typeof window.resetCartUnitPrice==='function')return window.resetCartUnitPrice(c.productId);
    delete c.unitPrice;saveDB();render();
  };
  window.pos4ItemNote=(index,value)=>{
    const c=validCart()[Number(index)];if(!c)return;
    c.note=String(value||'').slice(0,500);
    clearTimeout(noteTimer);noteTimer=setTimeout(()=>{try{saveDB()}catch(e){}},350);
  };

  function enhanceRows(){
    if(!isDesktop()||state.screen!=='pos')return;
    const rows=[...document.querySelectorAll('.pos4-cart-row')],items=validCart();
    rows.forEach((row,index)=>{
      const c=items[index],p=c&&product(c.productId);if(!c||!p)return;
      const price=linePrice(c),base=Number(p.price)||0,changed=Math.abs(price-base)>.001;
      const bottom=row.querySelector('.pos4-row-bottom');
      if(bottom){
        const first=bottom.querySelector(':scope > strong:first-child');
        if(first&&!bottom.querySelector('.pos4-inline-price-editor')){
          const wrap=document.createElement('div');wrap.className='pos4-inline-price-editor';
          wrap.innerHTML=`<small>Giá bán</small><div><input type="number" min="0" value="${price}" onchange="pos4ItemPrice(${index},this.value)">${changed?`<button type="button" onclick="pos4ItemResetPrice(${index})" title="Khôi phục giá gốc">↺</button>`:''}</div>${changed?`<em>Gốc ${money(base)}</em>`:''}`;
          first.replaceWith(wrap);
        }
      }
      if(!row.querySelector('.pos4-inline-item-extra')){
        const warranty=row.querySelector('.pos4-warranty');
        const extra=document.createElement('div');extra.className='pos4-inline-item-extra';
        const selected=(c.selectedImeis||[]),tags=selected.map(id=>`<span>${esc(imeiObj(id)?.value||id)}</span>`).join('');
        extra.innerHTML=`${p.imeiEnabled?`<div class="pos4-inline-imei"><button type="button" onclick="openImeiSelector(${idArg(p.id)})">🔢 Chọn IMEI/Serial <b>${selected.length}/${Number(c.qty)||0}</b></button>${tags?`<div class="pos4-inline-imei-tags">${tags}</div>`:''}</div>`:''}<input class="pos4-inline-item-note" value="${esc(c.note||'')}" placeholder="Ghi chú riêng sản phẩm..." oninput="pos4ItemNote(${index},this.value)">`;
        (warranty||row.querySelector('.pos4-row-top'))?.insertAdjacentElement('afterend',extra);
      }
    });
  }

  window.render=render=function(){const r=baseRender();setTimeout(enhanceRows,0);return r};
  setTimeout(enhanceRows,0);
})();
