/* POS inline checkout V1 small integration fix */
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
})();
