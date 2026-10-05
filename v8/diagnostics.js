/* KPOS Mobile V8 - Cloud diagnostics: Auth + RLS + read/write + Realtime loopback */
(function(){
  function cloud(){ return window.KPOS_CLOUD; }
  function escHtml(v=''){ return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  function showResults(rows){
    const old=document.querySelector('#kpos-cloud-test-modal'); if(old) old.remove();
    const ok=rows.every(x=>x.ok);
    const wrap=document.createElement('div');
    wrap.id='kpos-cloud-test-modal';
    wrap.style='position:fixed;inset:0;background:#11182788;z-index:99999;display:flex;align-items:flex-end;justify-content:center';
    wrap.innerHTML=`<div style="width:min(520px,100%);max-height:86vh;overflow:auto;background:white;border-radius:24px 24px 0 0;padding:18px;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><b style="font-size:19px">Kiểm tra KPOS Online</b><div style="font-size:12px;color:#6b7280;margin-top:3px">Auth • RLS • Database • Realtime</div></div><button onclick="document.querySelector('#kpos-cloud-test-modal')?.remove()" style="border:0;background:#f3f4f6;border-radius:10px;width:36px;height:36px">✕</button></div>
      <div style="margin-top:14px;padding:12px;border-radius:14px;background:${ok?'#ecfdf5':'#fff7ed'};color:${ok?'#047857':'#9a3412'};font-weight:800">${ok?'✅ Backend sẵn sàng đồng bộ nhiều điện thoại':'⚠️ Còn bước chưa đạt'}</div>
      <div style="display:flex;flex-direction:column;gap:9px;margin-top:12px">${rows.map(r=>`<div style="border:1px solid #e5e7eb;border-radius:13px;padding:11px"><div style="display:flex;justify-content:space-between;gap:12px"><b>${escHtml(r.name)}</b><b style="color:${r.ok?'#059669':'#dc2626'}">${r.ok?'OK':'LỖI'}</b></div><div style="font-size:12px;color:#6b7280;margin-top:4px;word-break:break-word">${escHtml(r.detail||'')}</div></div>`).join('')}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:14px">Khi tất cả đều OK, đăng nhập cùng tài khoản trên điện thoại thứ hai. Thay đổi khách hàng/hóa đơn/IMEI/công nợ ở một máy sẽ được Realtime đẩy sang máy còn lại.</div>
    </div>`;
    wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove()}); document.body.appendChild(wrap);
  }

  async function realtimeLoopback(c){
    const cfg=window.KPOS_SUPABASE_CONFIG||{};
    if(!window.supabase?.createClient) throw new Error('Supabase JS chưa tải');
    const {data:{session}}=await c.client.auth.getSession();
    if(!session) throw new Error('Không có session');
    const second=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const {error:setErr}=await second.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
    if(setErr) throw setErr;
    return new Promise(async(resolve,reject)=>{
      let done=false;
      const timeout=setTimeout(async()=>{if(done)return;done=true;try{await second.removeAllChannels()}catch(e){}reject(new Error('Realtime timeout sau 6 giây'));},6000);
      const ch=second.channel(`kpos-v8-test-${Date.now()}`)
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'kpos_state',filter:`workspace_id=eq.${c.workspaceId}`},async()=>{
          if(done)return; done=true; clearTimeout(timeout); try{await second.removeChannel(ch)}catch(e){} resolve(true);
        })
        .subscribe(async status=>{
          if(status==='SUBSCRIBED'){
            const {error}=await c.client.from('kpos_state').update({updated_by:c.user.id}).eq('workspace_id',c.workspaceId);
            if(error&&!done){done=true;clearTimeout(timeout);try{await second.removeChannel(ch)}catch(e){}reject(error);}
          }
          if((status==='CHANNEL_ERROR'||status==='TIMED_OUT')&&!done){done=true;clearTimeout(timeout);try{await second.removeChannel(ch)}catch(e){}reject(new Error(`Realtime ${status}`));}
        });
    });
  }

  window.kposCloudSelfTest=async()=>{
    const c=cloud(); const rows=[];
    if(!c?.configured){showResults([{name:'Cấu hình Supabase',ok:false,detail:'Chưa có Project URL + anon/public key trong supabase/config.js'}]);return;}
    if(!c.client||!c.user||!c.workspaceId){showResults([{name:'Đăng nhập Auth',ok:false,detail:'Hãy đăng nhập tài khoản online trước khi kiểm tra.'}]);return;}
    rows.push({name:'Supabase Auth',ok:true,detail:c.user.email||c.user.id});
    try{
      const {data,error}=await c.client.from('kpos_members').select('workspace_id,role').eq('workspace_id',c.workspaceId).eq('user_id',c.user.id).single();
      if(error)throw error; rows.push({name:'RLS / quyền workspace',ok:true,detail:`${data.role} • ${data.workspace_id}`});
    }catch(e){rows.push({name:'RLS / quyền workspace',ok:false,detail:e.message||String(e)});}
    try{
      const {data,error}=await c.client.from('kpos_state').select('revision,updated_at').eq('workspace_id',c.workspaceId).single();
      if(error)throw error; rows.push({name:'Đọc database',ok:true,detail:`revision ${data.revision} • ${data.updated_at}`});
    }catch(e){rows.push({name:'Đọc database',ok:false,detail:e.message||String(e)});}
    try{
      const {data,error}=await c.client.from('kpos_state').update({updated_by:c.user.id}).eq('workspace_id',c.workspaceId).select('revision,updated_at').single();
      if(error)throw error; c.revision=Number(data.revision||c.revision);c.updatedAt=data.updated_at||c.updatedAt;rows.push({name:'Ghi database',ok:true,detail:`revision mới ${data.revision}`});
    }catch(e){rows.push({name:'Ghi database',ok:false,detail:e.message||String(e)});}
    try{await realtimeLoopback(c);rows.push({name:'Realtime 2 client',ok:true,detail:'Client thứ hai đã nhận sự kiện UPDATE theo thời gian thực.'});}
    catch(e){rows.push({name:'Realtime 2 client',ok:false,detail:e.message||String(e)});}
    showResults(rows);
  };

  const baseRender=window.render;
  if(typeof baseRender==='function'){
    window.render=function(){
      baseRender();
      setTimeout(()=>{
        if(typeof state==='undefined'||state.screen!=='settings'||document.querySelector('#v8-diagnostics-card'))return;
        const content=document.querySelector('.content'); if(!content)return;
        const card=document.createElement('div');card.id='v8-diagnostics-card';card.className='card';card.style.marginTop='12px';
        card.innerHTML='<b>🧪 Kiểm tra backend</b><p class="small muted">Tự kiểm tra đăng nhập, RLS, đọc/ghi database và Realtime bằng 2 Supabase client.</p><button class="btn primary block" onclick="kposCloudSelfTest()">CHẠY KIỂM TRA ONLINE</button>';
        content.appendChild(card);
      },0);
    };
  }
})();
