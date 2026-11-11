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
    showPanel(name, role);
  } catch (error) {
    message.textContent = error.message || 'Bağlantı veya giriş hatası oluştu.';
    console.error(error);
  } finally {
    button.disabled = false;
  }
}


const DEFAULT_TASKS = [
  'İçecek dolabı kontrolü', 'Sos kontrolü', 'Peçete ve pipet kontrolü',
  'Masa ve salon düzeni', 'Tepsi toplama', 'Tuvalet kontrolü',
  'Çöp kontrolü', 'Oyun alanı oyuncaklarını toplama',
  'Fiş ve içecek kontrolü', 'Sipariş zili kontrolü'
];
const DAYS = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
const PEOPLE = [
  {name:'Burak',hours:'12:00–21:00'},
  {name:'Can',hours:'18:00–00:00'},
  {name:'Gönül',hours:'18:00–00:00'}
];
let signedIn = null;
function readData() {
  try { return JSON.parse(localStorage.getItem('burger-mood-v1')) || {}; }
  catch { return {}; }
}
function writeData(data) { localStorage.setItem('burger-mood-v1', JSON.stringify(data)); }
function showPanel(name, role) {
  signedIn = {name, role};
  renderPanel();
}
function renderPanel() {
  const admin = signedIn.role === 'admin';
  const data = readData();
  const date = new Date().toLocaleDateString('sv-SE');
  const owner = admin ? 'Yönetici' : signedIn.name;
  const key = date + ':' + owner;
  const done = (data.done || {})[key] || {};
  const tasks = [...DEFAULT_TASKS, ...(data.extra || [])];
  const leave = data.leave || {};
  app.innerHTML = `
    <main class="login-page" style="padding:20px;display:block;max-width:850px;margin:auto">
      <header style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div><h1 style="text-align:left;font-size:24px">🍔 BURGER MOOD</h1>
        <p class="subtitle">${admin ? 'Yönetici' : 'Personel'} · ${escapeHtml(signedIn.name)}</p></div>
        <button id="logout" style="width:auto;padding:0 15px">Çıkış</button>
      </header>
      <section class="login-card" style="max-width:none;margin-top:20px">
        <h2>Günlük görevler · ${date}</h2>
        <p style="color:#9ca3af;font-size:13px">Her çalışan kendi hesabında işaretleme yapar.</p>
        ${tasks.map((task, i) => `<label style="display:flex;align-items:center;gap:12px;margin:0;padding:12px 0;border-bottom:1px solid #374151">
          <input type="checkbox" data-task="${i}" ${done[task] ? 'checked' : ''} style="width:22px;height:22px;flex:none">
          <span>${escapeHtml(task)}</span></label>`).join('')}
        <p>${tasks.filter(t => done[t]).length} / ${tasks.length} tamamlandı</p>
        <input id="new-task" maxlength="100" placeholder="Yeni görev tanımı">
        <button id="add-task">Görev ekle</button>
      </section>
      <section class="login-card" style="max-width:none;margin-top:20px">
        <h2>Haftalık vardiya ve izinler</h2>
        <p style="color:#9ca3af;font-size:13px">İzinleri yönetici düzenleyebilir. Çizelge taslaktır; personel yeterliliği otomatik denetlenmez.</p>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr><th style="text-align:left">Gün</th>${PEOPLE.map(p=>`<th>${p.name}</th>`).join('')}</tr></thead>
          <tbody>${DAYS.map(day=>`<tr><td style="padding:12px 3px;border-bottom:1px solid #374151">${day}</td>${PEOPLE.map(person=>`<td style="padding:12px 3px;border-bottom:1px solid #374151;text-align:center">${admin
            ? `<label style="display:flex;align-items:center;justify-content:center;gap:4px"><input type="checkbox" style="width:18px;height:18px" data-leave="${day}:${person.name}" ${leave[day+':'+person.name]?'checked':''}> İzin</label>`
            : leave[day+':'+person.name]?'İzin':person.hours}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
        <button id="print">Yazdır / PDF kaydet</button>
      </section>
      <p style="color:#9ca3af;font-size:12px">İlk sürüm: Kayıtlar yalnızca bu cihazın tarayıcısında saklanır. Cihazlar arası senkronizasyon henüz yoktur.</p>
    </main>`;
  document.querySelector('#logout').addEventListener('click', () => {signedIn = null;showLogin();});
  document.querySelectorAll('[data-task]').forEach(box => box.addEventListener('change', () => {
    const db=readData(); db.done ||= {}; db.done[key] ||= {};
    db.done[key][tasks[Number(box.dataset.task)]] = box.checked;
    writeData(db); renderPanel();
  }));
  document.querySelector('#add-task').addEventListener('click', () => {
    const value=document.querySelector('#new-task').value.trim();
    if(!value)return;
    const db=readData();db.extra ||= [];
    if(![...DEFAULT_TASKS,...db.extra].includes(value)){db.extra.push(value);writeData(db);}
    renderPanel();
  });
  document.querySelectorAll('[data-leave]').forEach(box=>box.addEventListener('change',()=>{
    if(!admin)return;
    const db=readData();db.leave ||= {};db.leave[box.dataset.leave]=box.checked;
    writeData(db);renderPanel();
  }));
  document.querySelector('#print').addEventListener('click',()=>window.print());
}

showLogin();
