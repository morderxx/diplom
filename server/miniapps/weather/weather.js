document.getElementById("get-weather").addEventListener("click", () => {
  const city = document.getElementById("city").value.trim();
  if (!city) return;

  fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`)
    .then(res => res.json())
    .then(data => {
      const current = data.current_condition[0];
      const result = `
        <strong>${city}</strong><br>
        Температура: ${current.temp_C}°C<br>
        Чувствуется как: ${current.FeelsLikeC}°C<br>
        Погода: ${current.weatherDesc[0].value}<br>
        Влажность: ${current.humidity}%
      `;
      document.getElementById("result").innerHTML = result;
    })
    .catch(err => {
      document.getElementById("result").innerText = "Ошибка при получении погоды";
    });
});
