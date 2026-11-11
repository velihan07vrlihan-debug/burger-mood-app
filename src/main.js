
import './style.css';

const SUPABASE_URL =
  'https://vbqzpjxhvxdeehrfmtob.supabase.co';

// Buraya Supabase'in publishable/anon anahtarı eklenecek.
const SUPABASE_KEY = 'sb_publishable_ECikWQJCyolMCAuJkJevJg_ey-lACfJ';

const staffMembers = [
  {
    name: 'Burak',
    id: 'adad1e2d-ef85-4464-ab93-6ba50e2fb3e0'
  },
  {
    name: 'Gönül',
    id: 'f71f7f9d-d006-4ef6-a143-e3f033e0304c'
  },
  {
    name: 'Can',
    id: 'd631e606-6241-4b65-9714-c63951aa3c59'
  }
];

document.querySelector('#app').innerHTML = `
  <main class="login-page">
    <div class="logo">🍔</div>
    <h1>BURGER MOOD</h1>
    <p class="subtitle">Personel ve Yönetim Sistemi</p>

    <section class="login-card">
      <h2>Personel Girişi</h2>

      <label for="staff">Personel</label>
      <select id="staff">
        <option value="">Personel seçiniz</option>
        ${staffMembers.map(s =>
          `<option value="${s.id}">${s.name}</option>`
        ).join('')}
      </select>

      <label for="pin">6 Haneli PIN</label>
      <input
        id="pin"
        type="password"
        inputmode="numeric"
        maxlength="6"
        placeholder="••••••"
        autocomplete="off"
      />

      <button id="login">Giriş Yap</button>
      <p id="message" role="status"></p>
    </section>

    <footer>Burger Mood © 2026</footer>
  </main>
`;

document.querySelector('#login').addEventListener(
  'click',
  async () => {
    const staffId = document.querySelector('#staff').value;
    const pin = document.querySelector('#pin').value;
    const message = document.querySelector('#message');
    const button = document.querySelector('#login');

    if (!staffId || !/^[0-9]{6}$/.test(pin)) {
      message.textContent = 'Personel ve 6 haneli PIN gerekli.';
      return;
    }

    if (!SUPABASE_KEY) {
      message.textContent = 'Supabase bağlantı anahtarı eksik.';
      return;
    }

    button.disabled = true;
    message.textContent = 'Giriş kontrol ediliyor...';

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/staff-pin-login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY
          },
          body: JSON.stringify({
            staff_id: staffId,
            pin: pin
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Giriş başarısız.');
      }

      if (result.success === true) {
        message.textContent = 'Giriş başarılı!';
      } else {
        message.textContent = 'PIN doğrulanamadı.';
      }
    } catch (error) {
      message.textContent = 'Bağlantı veya giriş hatası oluştu.';
      console.error(error);
    } finally {
      button.disabled = false;
    }
  }
);
