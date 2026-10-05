/* Small normalization patch for Desktop Pro print controls */
(function(){
  window.updateDesktopTplStyle=(key,val)=>{
    if(!state.modal?.tpl)return;
    if(key==='scale'||key==='lineHeight')val=Number(val);
    state.modal.tpl.style=state.modal.tpl.style||{};
    state.modal.tpl.style[key]=val;
    const p=$('#proPrintLivePreview');
    if(p){
      const doc=state.modal.tpl.docType==='sale'?sampleSaleDoc():sampleWarrantyDoc();
      p.innerHTML=renderPrintContent(state.modal.tpl,doc);
    }
  };
})();
