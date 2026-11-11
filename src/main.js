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
  let staff = fallbackStaff;
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/staff?select=id,full_name,role,is_active&is_active=eq.true`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!response.ok) throw new Error('Personel listesi alınamadı');
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Geçersiz yanıt');
    const unique = new Map(fallbackStaff.map(person => [person.id, person]));
    for (const person of data) {
      if (person.id && person.full_name) unique.set(person.id, person);
    }
    staff = [...unique.values()];
  } catch (error) {
    console.warn('Canlı personel listesi okunamadı:', error);
    document.querySelector('#message').textContent = 'Canlı liste alınamadı; kayıtlı personel gösteriliyor.';
  }
  if (!select.isConnected) return;
  select.innerHTML = '<option value="">Personel seçiniz</option>' +
    staff.map(person => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.full_name)}${person.role === 'admin' ? ' (Yönetici)' : ''}</option>`).join('');
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
    const result = await response.json();
    if (!response.ok || result.success !== true) {
      throw new Error(result.error || 'PIN doğrulanamadı.');
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
