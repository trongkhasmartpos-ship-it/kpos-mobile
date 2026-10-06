/* KPOS branding scope fix: keep the original sidebar, show the approved logo only inside desktop POS. */
(function(){
  const desktopMQ=window.matchMedia('(min-width:980px)');
  const baseNav=window.nav;
  const basePosView=window.posView;

  window.nav=nav=function(){
    let html=baseNav();
    if(!desktopMQ.matches||!html)return html;
    const originalBrand=`<div class="desktop-brand"><div class="desktop-brand-mark">KP</div><div><div class="desktop-brand-name">KPOS</div><div class="desktop-brand-sub">Web App • Mobile • Realtime</div></div></div>`;
    html=html.replace(/<div class="desktop-brand"[\s\S]*?<div class="desktop-nav-scroll">/,`${originalBrand}<div class="desktop-nav-scroll">`);
    return html;
  };

  window.posView=posView=function(){
    let html=basePosView();
    if(!desktopMQ.matches||!html||!html.includes('pos4-top'))return html;
    if(!html.includes('pos4-screen-logo')){
      html=html.replace('<header class="pos4-top">','<header class="pos4-top"><div class="pos4-screen-logo"><img src="icons/kpos-logo.png" alt="KPOS"></div>');
    }
    return html;
  };
})();
