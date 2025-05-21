const inputGroup     = document.getElementById('input-group');
const changeCityBtn  = document.getElementById('change-city');
const getWeatherBtn  = document.getElementById('get-weather');
const cityInput      = document.getElementById('city');

const weatherCodes = {
  0: 'Ясно',1:'Преимущественно ясно',2:'Переменная облачность',3:'Пасмурно',
  45:'Туман',48:'Переохлаждённый туман',51:'Слабо моросит',53:'Умеренно моросит',
  55:'Сильно моросит',56:'Лёгкая морось (ледяная)',57:'Сильная морось (ледяная)',
  61:'Небольшой дождь',63:'Умеренный дождь',65:'Сильный дождь',66:'Лёд',67:'Сильный лёд',
  71:'Слабый снег',73:'Умеренный снег',75:'Сильный снег',77:'Снежные зерна',
  80:'Небольшие ливни',81:'Умеренные ливни',82:'Сильные ливни',85:'Слабый снегопад',
  86:'Сильный снегопад',95:'Гроза',96:'Гроза с небольшим градом',99:'Гроза с сильным градом'
};

window.addEventListener('load', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => fetchByCoords(pos.coords.latitude, pos.coords.longitude),
      () => showCityInput()
    );
  } else showCityInput();
});

getWeatherBtn.addEventListener('click', () => {
  const city = cityInput.value.trim();
  if (city) geocodeCity(city);
});

changeCityBtn.addEventListener('click', () => {
  inputGroup.style.display = 'flex';
  changeCityBtn.style.display = 'none';
});

function showCityInput() {
  inputGroup.style.display = 'flex';
  changeCityBtn.style.display = 'none';
}

function geocodeCity(name) {
  inputGroup.style.display = 'none';
  fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=ru`)
    .then(r => r.json())
    .then(json => {
      if (json.results?.length) {
        const { latitude, longitude, name: placeName } = json.results[0];
        fetchWeather(latitude, longitude, placeName);
      } else {
        alert('Город не найден'); showCityInput();
      }
    })
    .catch(err => { console.error(err); alert('Ошибка геокодирования'); showCityInput(); });
}

function fetchByCoords(lat, lon) {
  fetchWeather(lat, lon, 'Ваша локация');
}

function fetchWeather(lat, lon, place) {
  changeCityBtn.style.display = 'block';
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current_weather=true&hourly=temperature_2m,weathercode` +
        `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
        `&timezone=${encodeURIComponent(tz)}`)
    .then(r => r.json())
    .then(data => renderWeather(data, place))
    .catch(err => { console.error(err); document.querySelector('#current .content').innerText = 'Ошибка загрузки'; });
}

function renderWeather(data, place) {
  const cur = data.current_weather;
  const todayHours = data.hourly.time.map((t,i) => ({ time:t, temp:data.hourly.temperature_2m[i], code:data.hourly.weathercode[i] }))
    .filter(h => h.time.startsWith(data.daily.time[0])).slice(0,8);
  const week = data.daily.time.map((d,i) => ({ date:d, code:data.daily.weathercode[i], tmax:data.daily.temperature_2m_max[i], tmin:data.daily.temperature_2m_min[i] }));

  document.querySelector('#current .icon').innerText = cur.weathercode in weatherCodes ? '🌡️' : '';
  document.querySelector('#current .details').innerHTML = `
    <div class="temp">${cur.temperature}°C</div>
    <div class="desc">${weatherCodes[cur.weathercode]}</div>
    <div class="place">${place}</div>
  `;

  const hourlyC = document.querySelector('.forecast-hourly'); hourlyC.innerHTML = '';
  todayHours.forEach(h => {
    const hour = new Date(h.time).getHours();
    const el = document.createElement('div'); el.className='hour';
    el.innerHTML = `<span>${hour}:00</span><span class="temp">${h.temp}°</span><span>${weatherCodes[h.code]}</span>`;
    hourlyC.append(el);
  });

  const weeklyC = document.querySelector('.forecast-weekly'); weeklyC.innerHTML = '';
  week.forEach(d => {
    const el = document.createElement('div'); el.className='day';
    el.innerHTML = `<span>${d.date.slice(5)}</span><span class="temp">↑${d.tmax}° ↓${d.tmin}°</span><span>${weatherCodes[d.code]}</span>`;
    weeklyC.append(el);
  });
}
