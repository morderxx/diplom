const content = document.getElementById('finance-content');
const buttons = document.querySelectorAll('.finance-nav button');

buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const tab = btn.dataset.tab;
    content.classList.add('active'); // делаем контент видимым
    if (tab === 'exchange') {
      showExchange();
    } else if (tab === 'wallet') {
      content.innerHTML = `
        <h3>Кошелёк</h3>
        <div class="wallet-info">
          <div class="balance">₽ 152,340.00</div>
          <ul class="transactions">
            <li><span>Покупка BTC</span><span>-₽ 15,000</span></li>
            <li><span>Продажа ETH</span><span>+₽ 8,500</span></li>
            <li><span>Пополнение</span><span>+₽ 20,000</span></li>
          </ul>
        </div>`;
    } else if (tab === 'stats') {
      content.innerHTML = `
        <h3>Статистика</h3>
        <div class="stats-chart">📈 Здесь будет график</div>`;
    }
  });
});

async function showExchange() {
  content.innerHTML = `
    <h3>Обменник валют и крипты</h3>
    <form class="exchange-form" id="exchange-form">
      <label>
        Из валюты
        <select id="from-currency"></select>
      </label>
      <label>
        В валюту
        <select id="to-currency"></select>
      </label>
      <label style="grid-column: span 2;">
        Сумма
        <input type="number" id="amount" value="1" min="0" step="any" required>
      </label>
      <button type="submit">Конвертировать</button>
    </form>
    <div class="exchange-result" id="exchange-result">Введите сумму и выберите валюты</div>
  `;

  const currencies = {
    usd: 'US Dollar',
    eur: 'Euro',
    rub: 'Russian Ruble',
    gbp: 'British Pound',
    jpy: 'Japanese Yen',
    cny: 'Chinese Yuan',
    btc: 'Bitcoin',
    eth: 'Ethereum',
    ltc: 'Litecoin',
    doge: 'Dogecoin',
    bnb: 'Binance Coin',
    usdt: 'Tether',
    xrp: 'Ripple',
    sol: 'Solana',
    ada: 'Cardano',
    dot: 'Polkadot',
    avax: 'Avalanche',
    ton: 'Toncoin'
  };

  const from = document.getElementById('from-currency');
  const to = document.getElementById('to-currency');

  for (const code in currencies) {
    const option1 = document.createElement('option');
    option1.value = code;
    option1.textContent = `${code.toUpperCase()} - ${currencies[code]}`;
    const option2 = option1.cloneNode(true);
    from.appendChild(option1);
    to.appendChild(option2);
  }

  from.value = 'usd';
  to.value = 'btc';

  const form = document.getElementById('exchange-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fromValue = from.value;
    const toValue = to.value;
    const amount = parseFloat(document.getElementById('amount').value);
    const resultDiv = document.getElementById('exchange-result');

    if (isNaN(amount) || amount <= 0) {
      resultDiv.textContent = 'Введите корректную сумму';
      return;
    }

    resultDiv.textContent = 'Загрузка...';

    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${fromValue}&vs_currencies=${toValue}`);
      const data = await res.json();

      if (!data[fromValue] || !data[fromValue][toValue]) {
        resultDiv.textContent = 'Ошибка конвертации.';
        return;
      }

      const rate = data[fromValue][toValue];
      const converted = amount * rate;

      resultDiv.innerHTML = `
        <strong>${amount} ${fromValue.toUpperCase()}</strong> = 
        <strong>${converted.toFixed(6)} ${toValue.toUpperCase()}</strong>
      `;
    } catch (err) {
      resultDiv.textContent = 'Ошибка подключения к API.';
    }
  });
}


showExchange(); // загрузка по умолчанию
