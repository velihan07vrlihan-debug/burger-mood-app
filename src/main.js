import './style.css';

const SUPABASE_URL = 'https://vbqzpjxhvxdeehrfmtob.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ECikWQJCyolMCAuJkJevJg_ey-lACfJ';

const app = document.querySelector('#app');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function showLogin() {
  app.innerHTML = `
    <main class="login-page">
      <div class="logo">🍔</div>
      <h1>BURGER MOOD</h1>
      <p class="subtitle">Personel ve Yönetim Sistemi</p>
      <section class="login-card">
        <h2>Giriş Yap</h2>
        <label for="staff">Kullanıcı</label>
        <select id="staff"><option value="">Personel yükleniyor...</option></select>
        <label for="pin">6 Haneli PIN</label>
        <input id="pin" type="password" inputmode="numeric" maxlength="6" placeholder="••••••" autocomplete="off" />
        <button id="login">Giriş Yap</button>
        <p id="message" role="status"></p>
      </section>
      <footer>Burger Mood © 2026</footer>
    </main>`;
  document.querySelector('#login').addEventListener('click', login);
  document.querySelector('#pin').addEventListener('keydown', event => {
    if (event.key === 'Enter') login();
  });
  loadStaff();
}

async function loadStaff() {
  const select = document.querySelector('#staff');
  const message = document.querySelector('#message');
  const previous = select.value;
  let staff = [];
  const errors = [];

  // PIN doğrulama sisteminin kullandığı tabloyu önce dene.
  for (const table of ['pin_staff']) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(`${response.status}: ${details.message || details.code || 'Tablo okunamadı'}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Beklenmeyen personel listesi');
      staff = data.filter(p => p.is_active !== false && p.active !== false)
        .map(p => ({
          id: p.id || p.staff_id,
          full_name: p.full_name || p.name || p.display_name || p.staff_name,
          role: p.role || 'staff'
        })).filter(p => p.id && p.full_name);
      if (staff.length) break;
      errors.push(`${table}: aktif personel bulunamadı`);
    } catch (error) {
      errors.push(`${table}: ${error.message}`);
    }
  }
  if (!select.isConnected) return;
  if (!staff.length) {
    message.textContent = 'Personel listesi alınamadı. Bağlantıyı kontrol edip sayfayı yenileyin.';
    console.warn('Personel listesi hataları:', errors);
  } else {
    message.textContent = '';
  }
  const unique = [...new Map(staff.map(p => [p.id, p])).values()];
  select.innerHTML = '<option value="">Personel seçiniz</option>' +
    unique.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.full_name)}${p.role === 'admin' ? ' (Yönetici)' : ''}</option>`).join('');
  if (unique.some(p => p.id === previous)) select.value = previous;
}

async function login() {
  const select = document.querySelector('#staff');
  const staffId = select.value;
  const pin = document.querySelector('#pin').value;
  const message = document.querySelector('#message');
  const button = document.querySelector('#login');
  if (!staffId || !/^\d{6}$/.test(pin)) {
    message.textContent = 'Personel seç ve 6 haneli PIN gir.';
    return;
  }
  button.disabled = true;
  message.textContent = 'Giriş kontrol ediliyor...';
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/staff-pin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ staff_id: staffId, pin })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) {
      const serverError = result.error || result.message || result.details;
      const detail = typeof serverError === 'string' ? serverError : serverError?.message;
      throw new Error(detail || `Giriş başarısız (HTTP ${response.status}).`);
    }
    // Yetkiyi yalnızca doğrulama servisinin cevabından al.
    const role = result.staff?.role || result.user?.role || result.role || 'staff';
    const name = result.staff?.full_name || result.user?.full_name ||
      select.options[select.selectedIndex].text.replace(' (Yönetici)', '');
    document.querySelector('#pin').value = '';
    const issued = await fetch(`${SUPABASE_URL}/functions/v1/bm-data`, {
      method:'POST', headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY},
      body:JSON.stringify({action:'start_session',staff_id:staffId,pin})
    });
    const auth = await issued.json();
    if(!issued.ok || !auth.token) throw new Error('Oturum oluşturulamadı');
    localStorage.setItem('bm_session',auth.token);
    showPanel(name, role, staffId, auth.token);
  } catch (error) {
    message.textContent = error.message || 'Bağlantı veya giriş hatası oluştu.';
    console.error(error);
  } finally {
    button.disabled = false;
  }
}



const API = `${SUPABASE_URL}/functions/v1/bm-data`;
const DAYS = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
const DEFAULT_TASKS = ['İçecek dolabı kontrolü','Sos kontrolü','Peçete ve pipet kontrolü','Masa ve salon düzeni','Tepsi toplama','Tuvalet kontrolü','Çöp kontrolü','Oyun alanı oyuncaklarını toplama','Fiş ve içecek kontrolü','Sipariş zili kontrolü'];
let session = null, panelData = null;
const today = () => new Date().toLocaleDateString('sv-SE');
const monday = () => { const d = new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return d; };
const dateOf = (day) => {const d=monday();d.setDate(d.getDate()+day);return d.toLocaleDateString('sv-SE');};
async function api(action, fields={}) {
 const response = await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY},body:JSON.stringify({token:session.token,action,...fields})});
 const result = await response.json().catch(()=>({}));
 if(!response.ok || result.error)throw new Error(result.error || `HTTP ${response.status}`);
 return result;
}
async function showPanel(name,role,id,token){
 session={name,role,id,token};
 app.innerHTML='<main class="login-page"><h2>Görevler yükleniyor...</h2></main>';
 await refresh();
}
async function refresh(){
 try{panelData=await api('list');renderPanel();}
 catch(e){app.innerHTML=`<main class="login-page"><h2>Veriler yüklenemedi</h2><p>${escapeHtml(e.message)}</p><button id="retry">Tekrar dene</button><button id="logout">Çıkış</button></main>`;
 document.querySelector('#retry').onclick=refresh;document.querySelector('#logout').onclick=logout;}
}
function logout(){
 if(session?.token) api('logout').catch(()=>{});
 localStorage.removeItem('bm_session');session=null;panelData=null;showLogin();
}
function renderPanel(){
 const admin=panelData.admin;
 const staff=panelData.staff.filter(s=>s.id!=='c090813c-ec5b-4c78-8e3c-0c73b699da2e');
 const tasks=[...DEFAULT_TASKS.map((title,i)=>({id:null,title,defaultIndex:i})),...panelData.tasks];
 const completed=new Set(panelData.completions.filter(x=>x.staff_id===session.id&&x.work_date===today()).map(x=>x.task_id));
 const realTasks=panelData.tasks;
 app.innerHTML=`
 <main class="login-page" style="padding:18px;display:block;max-width:900px;margin:auto">
 <header style="display:flex;justify-content:space-between;align-items:center;gap:12px">
 <div><h1 style="font-size:24px;text-align:left">🍔 BURGER MOOD</h1><p class="subtitle">${admin?'Yönetici':'Personel'} · ${escapeHtml(session.name)}</p></div>
 <button id="logout" style="width:auto;padding:0 16px">Çıkış</button></header>
 <section class="login-card" style="max-width:none;margin-top:22px"><h2>Günlük görevler · ${today()}</h2>
 <p class="subtitle">Tamamlanan görevler Supabase üzerinde personel adına kaydedilir.</p>
 ${realTasks.map(t=>`<label style="display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #374151;margin:0">
 <input type="checkbox" data-task="${t.id}" ${completed.has(t.id)?'checked':''} style="width:22px;height:22px;flex:none">
 ${escapeHtml(t.title)}</label>`).join('')}
 <p>${realTasks.filter(t=>completed.has(t.id)).length} / ${realTasks.length} tamamlandı</p>
 <input id="new-task" maxlength="120" placeholder="Yeni görev tanımı">
 <button id="add-task">Görev ekle</button><p id="status" role="status"></p></section>
 <section class="login-card" style="max-width:none;margin-top:20px"><h2>Haftalık izin çizelgesi</h2>
 <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
 <thead><tr><th>Gün</th>${staff.map(s=>`<th>${escapeHtml(s.full_name)}</th>`).join('')}</tr></thead>
 <tbody>${DAYS.map((day,i)=>`<tr><td style="padding:12px 2px;border-bottom:1px solid #374151">${day}</td>${staff.map(s=>{
 const on=panelData.leave.some(l=>l.staff_id===s.id&&l.leave_date===dateOf(i));
 return `<td style="padding:10px 2px;border-bottom:1px solid #374151;text-align:center">${admin?
 `<label style="display:flex;justify-content:center;align-items:center;gap:4px"><input type="checkbox" data-leave="${s.id}" data-date="${dateOf(i)}" ${on?'checked':''} style="width:18px;height:18px">İzin</label>`:(on?'İzin':'Çalışıyor')}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>
 <button id="print">Yazdır / PDF</button></section>
 ${admin?`<section class="login-card" style="max-width:none;margin-top:20px"><h2>Personel bazında son 7 gün</h2>
 ${staff.map(person=>`<p style="border-bottom:1px solid #374151;padding:12px 0"><strong>${escapeHtml(person.full_name)}</strong> — ${panelData.completions.filter(c=>c.staff_id===person.id).length} tamamlanan görev</p>`).join('')}
 <h2>Son 7 gün görev raporu</h2>
 <label for="report-person">Personel filtresi</label>
 <select id="report-person"><option value="">Tüm personel</option>${staff.map(person=>`<option value="${person.id}">${escapeHtml(person.full_name)}</option>`).join('')}</select>
 <button id="csv-report">Raporu CSV olarak indir</button>
 <div id="report-rows">
 ${panelData.completions.length?panelData.completions.map(c=>`<p style="border-bottom:1px solid #374151;padding:8px 0">${escapeHtml(panelData.staff.find(s=>s.id===c.staff_id)?.full_name||'Personel')} · ${escapeHtml(panelData.tasks.find(t=>t.id===c.task_id)?.title||'Görev')} · ${escapeHtml(c.work_date)}</p>`).join(''):'Henüz kayıt yok'}</div></section>`:''}
 </main>`;
 document.querySelector('#logout').onclick=logout;
 document.querySelector('#print').onclick=()=>window.print();
 if(admin){
   const rows=document.querySelector('#report-rows');
   const initial=rows.innerHTML;
   const reportLines=panelData.completions.map(c=>({
     personId:c.staff_id,
     person:panelData.staff.find(p=>p.id===c.staff_id)?.full_name||'Personel',
     title:panelData.tasks.find(t=>t.id===c.task_id)?.title||'Görev',
     date:c.work_date,
     time:c.completed_at
   }));
   const filter=document.querySelector('#report-person');
   filter.onchange=()=>{
     const matches=reportLines.filter(r=>!filter.value||r.personId===filter.value);
     rows.innerHTML=matches.length?matches.map(r=>`<p style="border-bottom:1px solid #374151;padding:8px 0">${escapeHtml(r.person)} · ${escapeHtml(r.title)} · ${escapeHtml(r.date)}</p>`).join(''):'Bu personel için kayıt yok';
   };
   document.querySelector('#csv-report').onclick=()=>{
     const selected=reportLines.filter(r=>!filter.value||r.personId===filter.value);
     const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
     const csv='\\uFEFF'+[['Personel','Görev','Tarih','Tamamlanma zamanı'],...selected.map(r=>[r.person,r.title,r.date,r.time])].map(line=>line.map(csvCell).join(';')).join('\\r\\n');
     const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
     const url=URL.createObjectURL(blob);
     const link=document.createElement('a');link.href=url;link.download='burger-mood-gorev-raporu.csv';link.click();
     setTimeout(()=>URL.revokeObjectURL(url),1000);
   };
 }

 document.querySelector('#add-task').onclick=async()=>{
 const title=document.querySelector('#new-task').value.trim();if(!title)return;
 try{await api('add_task',{title});await refresh();}catch(e){document.querySelector('#status').textContent=e.message;}
 };
 document.querySelectorAll('[data-task]').forEach(box=>box.onchange=async()=>{
 box.disabled=true;try{await api('complete',{task_id:Number(box.dataset.task),work_date:today(),completed:box.checked});await refresh();}
 catch(e){alert('Kaydedilemedi: '+e.message);await refresh();}
 });
 document.querySelectorAll('[data-leave]').forEach(box=>box.onchange=async()=>{
 box.disabled=true;try{await api('leave',{target_staff_id:box.dataset.leave,leave_date:box.dataset.date,on:box.checked});await refresh();}
 catch(e){alert('Kaydedilemedi: '+e.message);await refresh();}
 });
}

async function restoreSession(){
 const token=localStorage.getItem('bm_session');
 if(!token){showLogin();return;}
 session={token};
 app.innerHTML='<main class="login-page"><h2>Oturum kontrol ediliyor...</h2></main>';
 try{
  const data=await api('whoami');
  session={token,id:data.staff.id,name:data.staff.full_name,role:data.staff.role};
  await refresh();
 }catch(e){localStorage.removeItem('bm_session');session=null;showLogin();}
}
restoreSession();
