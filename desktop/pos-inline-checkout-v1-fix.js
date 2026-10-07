/* POS inline checkout V1 small integration fix + inline item controls */
(function(){
  const baseType=window.pos4InlineType;
  if(baseType){
    window.pos4InlineType=(group,type)=>{
      const r=baseType(group,type);
      const id=group==='discount'?'co_discount_type':group==='surcharge'?'co_surcharge_type':'';
      const el=id&&document.getElementById(id);if(el)el.value=type;
      return r;
    };
  }
  const baseCheckout=window.pos4InlineCheckout;
  if(baseCheckout){
    window.pos4InlineCheckout=print=>{
      const d=document.querySelector('[data-discount-type].active')?.dataset.discountType;
      const s=document.querySelector('[data-surcharge-type].active')?.dataset.surchargeType;
      const de=document.getElementById('co_discount_type'),se=document.getElementById('co_surcharge_type');
      if(de&&d)de.value=d;if(se&&s)se.value=s;
      return baseCheckout(print);
    };
  }

  const desktopMQ=window.matchMedia('(min-width:980px)');
  const baseRender=window.render;
  let noteTimer=null;
  const validCart=()=> (db.cart||[]).filter(c=>product(c.productId));
  const linePrice=c=>{const p=product(c.productId),v=Number(c.unitPrice);return Number.isFinite(v)&&v>=0?v:(Number(p?.price)||0)};
  const idArg=v=>JSON.stringify(v);

  window.pos4ItemPrice=(index,value)=>{
    const c=validCart()[Number(index)];if(!c)return;
    if(typeof window.updateCartUnitPrice==='function')return window.updateCartUnitPrice(c.productId,value);
    c.unitPrice=Math.max(0,Number(value)||0);saveDB();render();
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

  function ensureStyle(){
    if(document.getElementById('pos4-item-inline-style'))return;
    const st=document.createElement('style');st.id='pos4-item-inline-style';st.textContent=`
      @media (min-width:980px){
        .pos4-inline-price-editor{min-width:0;display:flex;flex-direction:column;gap:2px}.pos4-inline-price-editor>small{font-size:8px;color:#8b929c;font-weight:800;text-transform:uppercase}.pos4-inline-price-editor>div{display:flex;align-items:center;gap:4px}.pos4-inline-price-editor input{width:104px;height:28px!important;border:1px solid #e3e5e8!important;border-radius:7px!important;padding:0 8px!important;font-size:11px!important;font-weight:900!important;background:#fff!important}.pos4-inline-price-editor button{width:28px;height:28px;border:1px solid #ffd7bd;background:#fff7ed;color:#ea580c;border-radius:7px;font-weight:900}.pos4-inline-price-editor em{font-style:normal;font-size:8px;color:#9ca3af;white-space:nowrap}
        .pos4-inline-item-extra{display:flex;align-items:center;gap:7px;margin-top:7px;min-width:0}.pos4-inline-imei{display:flex;align-items:center;gap:5px;min-width:0;flex:0 1 auto}.pos4-inline-imei>button{height:28px;border:1px solid #bdebe2;background:#f1fbf8;color:#0f8e78;border-radius:7px;padding:0 8px;font-size:9px;font-weight:900;white-space:nowrap}.pos4-inline-imei-tags{display:flex;gap:4px;min-width:0;overflow:auto;max-width:190px;scrollbar-width:none}.pos4-inline-imei-tags::-webkit-scrollbar{display:none}.pos4-inline-imei-tags span{display:inline-flex;align-items:center;height:24px;padding:0 6px;background:#f3f4f6;border-radius:6px;color:#4b5563;font-size:8px;font-weight:800;white-space:nowrap}.pos4-inline-item-note{height:28px!important;min-width:120px;flex:1;border:1px solid #e5e7eb!important;border-radius:7px!important;padding:0 8px!important;font-size:9px!important;background:#fff!important;color:#374151!important}
      }
      @media (min-width:980px) and (max-width:1200px){.pos4-inline-item-extra{flex-wrap:wrap}.pos4-inline-item-note{width:100%;flex-basis:100%}.pos4-inline-imei-tags{max-width:140px}}
    `;document.head.appendChild(st);
  }

  function enhanceRows(){
    if(!desktopMQ.matches||state.screen!=='pos')return;ensureStyle();
    const rows=[...document.querySelectorAll('.pos4-cart-row')],items=validCart();
    rows.forEach((row,index)=>{
      const c=items[index],p=c&&product(c.productId);if(!c||!p)return;
      const price=linePrice(c),base=Number(p.price)||0,changed=Math.abs(price-base)>.001;
      const bottom=row.querySelector('.pos4-row-bottom');
      if(bottom&&!bottom.querySelector('.pos4-inline-price-editor')){
        const first=bottom.querySelector(':scope > strong:first-child');
        if(first){const wrap=document.createElement('div');wrap.className='pos4-inline-price-editor';wrap.innerHTML=`<small>Giá bán</small><div><input type="number" min="0" value="${price}" onchange="pos4ItemPrice(${index},this.value)">${changed?`<button type="button" onclick="pos4ItemResetPrice(${index})" title="Khôi phục giá gốc">↺</button>`:''}</div>${changed?`<em>Gốc ${money(base)}</em>`:''}`;first.replaceWith(wrap)}
      }
      if(!row.querySelector('.pos4-inline-item-extra')){
        const extra=document.createElement('div');extra.className='pos4-inline-item-extra';
        const selected=c.selectedImeis||[],tags=selected.map(id=>`<span>${esc(imeiObj(id)?.value||id)}</span>`).join('');
        extra.innerHTML=`${p.imeiEnabled?`<div class="pos4-inline-imei"><button type="button" onclick="openImeiSelector(${idArg(p.id)})">🔢 Chọn IMEI/Serial <b>${selected.length}/${Number(c.qty)||0}</b></button>${tags?`<div class="pos4-inline-imei-tags">${tags}</div>`:''}</div>`:''}<input class="pos4-inline-item-note" value="${esc(c.note||'')}" placeholder="Ghi chú riêng sản phẩm..." oninput="pos4ItemNote(${index},this.value)">`;
        const warranty=row.querySelector('.pos4-warranty');(warranty||row.querySelector('.pos4-row-top'))?.insertAdjacentElement('afterend',extra);
      }
    });
  }

  window.render=render=function(){const r=baseRender();setTimeout(enhanceRows,0);return r};
  setTimeout(enhanceRows,0);
})();
