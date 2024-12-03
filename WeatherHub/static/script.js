let mapInstance = null;

async function fetchWeather() {
    const city = document.getElementById("city-input").value.trim();
    if (!city) {
        alert("Please enter a city name!");
        return;
    }

    const response = await fetch(`/api/weather/${city}`);
    if (response.ok) {
        const data = await response.json();
        const weather = data.weather;

        document.getElementById("weather-data").innerHTML = `
            <h3>Weather in ${weather.name}</h3>
            <p>Temperature: ${weather.main.temp} °C</p>
            <p>Condition: ${weather.weather[0].description}</p>
            <button id="save-favorite-btn" data-city="${weather.name}" onclick="addFavorite()">Save to Favorites</button>
        `;

        const { lat, lon } = weather.coord;
        renderMap(lat, lon);

        const forecast = data.forecast.list;
        renderForecast(forecast);
    } else {
        alert("City not found or there was an error fetching weather data.");
        document.getElementById("map").innerHTML = "";
        document.getElementById("weather-data").innerHTML = "";
        document.getElementById("forecast-data").innerHTML = "";
    }
}

function renderMap(lat, lon) {
    if (mapInstance) {
        mapInstance.remove();
    }

    mapInstance = L.map("map").setView([lat, lon], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstance);

    L.marker([lat, lon]).addTo(mapInstance).bindPopup("City Location").openPopup();
}

function renderForecast(forecast) {
    const forecastContainer = document.getElementById("forecast-data");
    forecastContainer.innerHTML = forecast
        .filter((item, index) => index % 8 === 0)
        .map(item => `
            <div class="forecast-item">
                <p><strong>${new Date(item.dt_txt).toLocaleDateString()}</strong></p>
                <p>Temp: ${item.main.temp} °C</p>
                <p>${item.weather[0].description}</p>
            </div>
        `)
        .join("");
}

async function addFavorite() {
    const city = document.getElementById("save-favorite-btn").getAttribute("data-city");
    console.log(city);
    console.log(JSON.stringify({ city }));
    const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city })
    });
    console.log(response);
    if (response.ok) {
        alert(`${city} added to favorites!`);
    } else {
        const error = await response.json();
        console.log(error);
        alert(error.detail || "Failed to add to favorites");
    }
}

async function loadFavorites() {
    const response = await fetch("/api/favorites");
    if (response.ok) {
        const data = await response.json();
        const favoritesList = document.getElementById("favorites-list");
        favoritesList.innerHTML = data.favorites.map(city => `
            <li>
                ${city} <button onclick="fetchFavoriteWeather('${city}')">View Weather</button>
            </li>
        `).join("");
    } else {
        console.error("Failed to load favorites");
    }
}

async function fetchFavoriteWeather(city) {
    document.getElementById("city-input").value = city;
    fetchWeather();
}

function startSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Your browser does not support Speech Recognition.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";

    recognition.onstart = () => {
        console.log("Voice recognition started...");
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById("question-input").value = transcript;
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        alert("Error during speech recognition. Please try again.");
    };

    recognition.start();
}

async function submitQuestion() {
    const question = document.getElementById("question-input").value.trim();
    if (!question) {
        alert("Please enter or speak a question!");
        return;
    }

    const response = await fetch("/api/ask-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
    });

    if (response.ok) {
        const data = await response.json();
        const answer = data.answer;

        document.getElementById("answer-output").innerText = answer;

        addToHistory(question, answer);
    } else {
        console.error("Failed to get AI response");
        document.getElementById("answer-output").innerText = "Failed to get a response. Please try again.";
    }
}

function addToHistory(question, answer) {
    const historyList = document.getElementById("history-list");

    const historyItem = document.createElement("li");
    historyItem.className = "history-item";

    const questionElement = document.createElement("div");
    questionElement.className = "history-question";
    questionElement.innerText = `Q: ${question}`;

    const answerElement = document.createElement("div");
    answerElement.className = "history-answer";
    answerElement.innerText = `A: ${answer}`;

    historyItem.appendChild(questionElement);
    historyItem.appendChild(answerElement);

    historyList.prepend(historyItem);
}
