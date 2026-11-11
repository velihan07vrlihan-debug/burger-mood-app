
import './style.css';

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
        <option value="can">Can</option>
        <option value="burak">Burak</option>
        <option value="gonul">Gönül</option>
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

document.querySelector('#login').addEventListener('click', () => {
  const staff = document.querySelector('#staff').value;
  const pin = document.querySelector('#pin').value;
  const message = document.querySelector('#message');

  if (!staff || !/^[0-9]{6}$/.test(pin)) {
    message.textContent = 'Personel ve 6 haneli PIN gerekli.';
    return;
  }

  message.textContent = 'Giriş bağlantısı hazırlanıyor.';
});
