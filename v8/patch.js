/* KPOS Mobile V8 - Supabase Auth + online state sync + realtime multi-device */
(function(){
  const cfg=window.KPOS_SUPABASE_CONFIG||{};
  const configured=!!(cfg.url&&cfg.anonKey&&window.supabase?.createClient);
  const deviceId=localStorage.getItem('kpos_device_id')||(()=>{const x=(crypto.randomUUID?.()||('dev-'+Date.now()+'-'+Math.random()));localStorage.setItem('kpos_device_id',x);return x})();
  const cloud={configured,client:null,user:null,workspaceId:null,role:null,revision:0,updatedAt:null,status:configured?'Đang kết nối':'Offline',timer:null,channel:null,applying:false,saving:false,ready:false,lastError:''};
  window.KPOS_CLOUD=cloud;

  const localSaveDB=saveDB;
  const coreRender=render;
  const coreTopbar=topbar;
  const coreSettingsView=typeof settingsView==='function'?settingsView:null;

  function cloudLabel(){
    if(!cloud.configured)return 'Offline';
    if(!navigator.onLine)return 'Mất mạng • lưu máy';
    if(cloud.status==='Đã đồng bộ')return '☁️ Đã đồng bộ';
    if(cloud.status==='Đang đồng bộ')return '☁️ Đang đồng bộ';
    if(cloud.status==='Lỗi đồng bộ')return '⚠️ Lỗi đồng bộ';
    return `☁️ ${cloud.status}`;
  }

  window.topbar=topbar=function(title,subtitle=''){
    const extra=cloudLabel();
    return coreTopbar(title,subtitle?`${subtitle} • ${extra}`:extra);
  };

  function cleanStateForCloud(){
    const copy=clone(db);
    copy.cart=[];
    copy._cloud={schema:1,deviceId,lastSavedAt:new Date().toISOString()};
    return copy;
  }

  window.saveDB=saveDB=function(){
    localSaveDB();
    if(cloud.configured&&cloud.user&&cloud.workspaceId&&!cloud.applying) scheduleCloudSave();
  };

  function scheduleCloudSave(delay=550){
    clearTimeout(cloud.timer);
    cloud.timer=setTimeout(()=>pushCloudState(),delay);
  }

  async function pushCloudState(){
    if(!cloud.configured||!cloud.client||!cloud.user||!cloud.workspaceId||cloud.applying)return;
    if(!navigator.onLine){cloud.status='Mất mạng';return}
    cloud.saving=true;cloud.status='Đang đồng bộ';refreshCloudUi();
    try{
      const payload={data:cleanStateForCloud(),updated_by:cloud.user.id};
      const {data,error}=await cloud.client.from('kpos_state').update(payload).eq('workspace_id',cloud.workspaceId).select('revision,updated_at').single();
      if(error)throw error;
      cloud.revision=Number(data.revision||cloud.revision);
      cloud.updatedAt=data.updated_at||new Date().toISOString();
      cloud.status='Đã đồng bộ';cloud.lastError='';
    }catch(err){
      console.error('KPOS cloud save',err);cloud.status='Lỗi đồng bộ';cloud.lastError=err.message||String(err);
    }finally{cloud.saving=false;refreshCloudUi()}
  }

  async function pullCloudState(initial=false){
    if(!cloud.client||!cloud.workspaceId)return;
    cloud.status='Đang đồng bộ';refreshCloudUi();
    try{
      const {data:row,error}=await cloud.client.from('kpos_state').select('data,revision,updated_at').eq('workspace_id',cloud.workspaceId).single();
      if(error)throw error;
      cloud.revision=Number(row.revision||0);cloud.updatedAt=row.updated_at||null;
      const remote=row.data&&typeof row.data==='object'?row.data:{};
      const hasRemote=Object.keys(remote).filter(k=>k!=='_cloud').length>0;
      if(hasRemote){
        cloud.applying=true;
        db=normalizeDB(remote);
        if(remote.storeProfile)db.storeProfile=remote.storeProfile;
        localSaveDB();
        cloud.applying=false;
        cloud.status='Đã đồng bộ';
        if(!initial)toast('Đã nhận dữ liệu mới từ thiết bị khác');
        coreRender();
      }else{
        await pushCloudState();
      }
    }catch(err){console.error('KPOS cloud pull',err);cloud.status='Lỗi đồng bộ';cloud.lastError=err.message||String(err)}
    refreshCloudUi();
  }

  function subscribeRealtime(){
    try{if(cloud.channel)cloud.client.removeChannel(cloud.channel)}catch(e){}
    if(!cloud.client||!cloud.workspaceId)return;
    cloud.channel=cloud.client.channel(`kpos-state-${cloud.workspaceId}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'kpos_state',filter:`workspace_id=eq.${cloud.workspaceId}`},payload=>{
        const row=payload.new||{};const rev=Number(row.revision||0);
        if(rev<=cloud.revision)return;
        cloud.revision=rev;cloud.updatedAt=row.updated_at||cloud.updatedAt;
        const remote=row.data;
        if(!remote||typeof remote!=='object')return;
        cloud.applying=true;db=normalizeDB(remote);if(remote.storeProfile)db.storeProfile=remote.storeProfile;localSaveDB();cloud.applying=false;
        cloud.status='Đã đồng bộ';
        if(typeof storeProfile!=='undefined'&&db.storeProfile)Object.assign(storeProfile,db.storeProfile);
        coreRender();toast('☁️ Dữ liệu vừa đồng bộ từ thiết bị khác');
      }).subscribe(status=>{
        if(status==='SUBSCRIBED'){cloud.status='Đã đồng bộ';refreshCloudUi()}
      });
  }

  async function activateUser(user){
    cloud.user=user;localStorage.setItem(sessionKey,'cloud');
    const {data:member,error}=await cloud.client.from('kpos_members').select('workspace_id,role').eq('user_id',user.id).limit(1).single();
    if(error)throw error;
    cloud.workspaceId=member.workspace_id;cloud.role=member.role||'owner';
    await pullCloudState(true);subscribeRealtime();cloud.ready=true;coreRender();
  }

  function refreshCloudUi(){
    const el=document.querySelector('#kpos-cloud-status');if(el){el.textContent=cloudLabel();el.title=cloud.lastError||''}
  }

  function injectCloudSettings(){
    if(state.screen!=='settings')return;
    const content=document.querySelector('.content');if(!content||document.querySelector('#v8-cloud-card'))return;
    const card=document.createElement('div');card.id='v8-cloud-card';card.className='card';card.style.marginTop='12px';
    card.innerHTML=`<b>☁️ Database online & đồng bộ</b>
      <div class="row-between" style="margin-top:10px"><span>Trạng thái</span><b id="kpos-cloud-status">${cloudLabel()}</b></div>
      <hr><div class="small muted">${cloud.user?`Tài khoản: ${esc(cloud.user.email||'')}<br>Quyền: ${esc(cloud.role||'')}<br>Workspace: ${esc(cloud.workspaceId||'')}`:'Chưa đăng nhập Supabase.'}</div>
      ${cloud.updatedAt?`<div class="small muted" style="margin-top:6px">Đồng bộ gần nhất: ${fmtDateTime(cloud.updatedAt)} • revision ${cloud.revision}</div>`:''}
      <button class="btn primary block" style="margin-top:10px" onclick="syncNow()" ${cloud.user?'':'disabled'}>ĐỒNG BỘ NGAY</button>
      ${cloud.user?'<button class="btn ghost block" style="margin-top:8px" onclick="logout()">ĐĂNG XUẤT TÀI KHOẢN ONLINE</button>':''}
      ${cloud.lastError?`<div class="notice" style="margin-top:9px">${esc(cloud.lastError)}</div>`:''}`;
    content.appendChild(card);
  }

  window.render=render=function(){
    if(cloud.configured&&cloud.ready&&!cloud.user){loginView();return}
    coreRender();setTimeout(()=>{injectCloudSettings();refreshCloudUi()},0);
  };

  window.loginView=loginView=function(){
    if(!cloud.configured){
      app.innerHTML=`<div class="login"><div class="login-card"><div class="logo"><div class="logo-badge">KP</div><div>KPOS Mobile V8</div></div><div class="sub">Chưa cấu hình Supabase • đang dùng chế độ offline</div><div class="notice" style="margin:14px 0">Cần Project URL + anon key để bật đăng nhập thật và đồng bộ nhiều điện thoại.</div><div class="field"><label>Tài khoản demo</label><input id="loginUser" value="admin"></div><div class="field"><label>Mật khẩu</label><input id="loginPass" type="password" value="123456"></div><button class="btn primary block" onclick="doLogin()">VÀO BẢN OFFLINE</button></div></div>`;return;
    }
    app.innerHTML=`<div class="login"><div class="login-card"><div class="logo"><div class="logo-badge">KP</div><div>KPOS Mobile V8</div></div><div class="sub">Đăng nhập online • đồng bộ nhiều thiết bị</div>
      <div class="field"><label>Email</label><input id="loginEmail" type="email" autocomplete="username" placeholder="email@domain.com"></div>
      <div class="field"><label>Mật khẩu</label><input id="loginPass" type="password" autocomplete="current-password" placeholder="••••••••"></div>
      <button class="btn primary block" onclick="doLogin()">ĐĂNG NHẬP</button>
      <button class="btn ghost block" style="margin-top:9px" onclick="signUpKpos()">TẠO TÀI KHOẢN LẦN ĐẦU</button>
      <div class="notice" style="margin-top:12px">Dữ liệu được bảo vệ bằng Supabase Auth + Row Level Security. Cùng một tài khoản có thể dùng trên nhiều điện thoại.</div></div></div>`;
  };

  window.doLogin=async()=>{
    if(!cloud.configured){localStorage.setItem(sessionKey,'offline');coreRender();return}
    const email=$('#loginEmail')?.value.trim(),password=$('#loginPass')?.value||'';
    if(!email||!password)return toast('Nhập email và mật khẩu');
    try{cloud.status='Đang đăng nhập';const {data,error}=await cloud.client.auth.signInWithPassword({email,password});if(error)throw error;await activateUser(data.user);toast('Đăng nhập thành công')}catch(err){toast(err.message||'Đăng nhập thất bại')}
  };

  window.signUpKpos=async()=>{
    if(!cloud.configured)return;
    const email=$('#loginEmail')?.value.trim(),password=$('#loginPass')?.value||'';
    if(!email||password.length<6)return toast('Nhập email và mật khẩu từ 6 ký tự');
    try{const {data,error}=await cloud.client.auth.signUp({email,password,options:{data:{display_name:'KPOS Admin'}}});if(error)throw error;if(data.session&&data.user){await activateUser(data.user);toast('Đã tạo tài khoản KPOS')}else toast('Đã tạo tài khoản. Kiểm tra email xác nhận nếu Supabase yêu cầu.')}catch(err){toast(err.message||'Không tạo được tài khoản')}
  };

  window.logout=async()=>{
    try{if(cloud.client)await cloud.client.auth.signOut()}catch(e){}
    try{if(cloud.channel)await cloud.client.removeChannel(cloud.channel)}catch(e){}
    cloud.user=null;cloud.workspaceId=null;cloud.revision=0;cloud.status='Chưa đăng nhập';localStorage.removeItem(sessionKey);loginView();
  };

  window.syncNow=async()=>{if(!cloud.user)return toast('Chưa đăng nhập online');await pushCloudState();if(cloud.status==='Đã đồng bộ')toast('☁️ Đồng bộ hoàn tất')};

  window.addEventListener('online',()=>{if(cloud.user){cloud.status='Đang đồng bộ';scheduleCloudSave(100);refreshCloudUi()}});
  window.addEventListener('offline',()=>{cloud.status='Mất mạng';refreshCloudUi()});

  async function boot(){
    if(!cloud.configured){cloud.ready=true;coreRender();return}
    cloud.client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    cloud.client.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'){cloud.user=null;cloud.workspaceId=null;localStorage.removeItem(sessionKey);loginView()}
    });
    try{
      const {data:{session}}=await cloud.client.auth.getSession();
      if(session?.user){await activateUser(session.user)}else{cloud.ready=true;localStorage.removeItem(sessionKey);loginView()}
    }catch(err){cloud.ready=true;cloud.status='Lỗi kết nối';cloud.lastError=err.message||String(err);loginView()}
  }

  boot();
})();
