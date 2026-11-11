import './style.css';

const SUPABASE_URL = 'https://vbqzpjxhvxdeehrfmtob.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ECikWQJCyolMCAuJkJevJg_ey-lACfJ';

const fallbackStaff = [
  { id: 'adad1e2d-ef85-4464-ab93-6ba50e2fb3e0', full_name: 'Burak', role: 'staff' },
  { id: 'f71f7f9d-d006-4ef6-a143-e3f033e0304c', full_name: 'Gönül', role: 'staff' },
  { id: 'd631e606-6241-4b65-9714-c63951aa3c59', full_name: 'Can', role: 'staff' },
  { id: 'c090813c-ec5b-4c78-8e3c-0c73b699da2e', full_name: 'Burger Mood Yöneticisi', role: 'admin' }
];

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
  for (const table of ['pin_staff', 'staff']) {
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
    // Yalnızca arayüzde seçim yapabilmek için; doğrulama her zaman sunucuda yapılır.
    staff = fallbackStaff;
    message.textContent = 'Canlı personel listesi alınamadı. Giriş için sunucudaki kayıtların eşleşmesi gerekir.';
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
      throw new Error(detail || `PIN doğrulanamadı (HTTP ${response.status}).`);
    }
    // Yetkiyi yalnızca doğrulama servisinin cevabından al.
    const role = result.staff?.role || result.user?.role || result.role || 'staff';
    const name = result.staff?.full_name || result.user?.full_name ||
      select.options[select.selectedIndex].text.replace(' (Yönetici)', '');
    showPanel(name, role);
  } catch (error) {
    message.textContent = error.message || 'Bağlantı veya giriş hatası oluştu.';
    console.error(error);
  } finally {
    button.disabled = false;
  }
}

function showPanel(name, role) {
  const isAdmin = role === 'admin';
  app.innerHTML = `
    <main class="login-page">
      <div class="logo">🍔</div>
      <h1>BURGER MOOD</h1>
      <p class="subtitle">${isAdmin ? 'Yönetici Paneli' : 'Personel Paneli'}</p>
      <section class="login-card">
        <h2>Hoş geldin, ${escapeHtml(name)}</h2>
        <p>Giriş doğrulandı.</p>
        <p>${isAdmin ? 'Personel, izin, görev, PDF ve rapor modülleri henüz bağlı değil.' : 'Kişisel görev çetelesi henüz bağlı değil.'}</p>
        <button id="logout">Çıkış Yap</button>
      </section>
      <footer>Burger Mood © 2026</footer>
    </main>`;
  document.querySelector('#logout').addEventListener('click', showLogin);
}

showLogin();
