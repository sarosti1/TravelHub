import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import sqlite3
import httpx
import openai
import uvicorn
import ai

# Initialize FastAPI application
app = FastAPI()

# Resolve the absolute paths for static and template directories
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

# Verify that the `static` directory exists
if not STATIC_DIR.exists():
    raise RuntimeError(
        f"Static directory '{STATIC_DIR}' does not exist. Please create it and add your static files."
    )

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Set up Jinja2 templates
templates = Jinja2Templates(directory=TEMPLATES_DIR)

# OpenWeather API Key
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

# Database setup
DB_FILE = BASE_DIR / "weatherhub.db"


def setup_database():
    """Initialize the SQLite database."""
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS favorite_cities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                city_name TEXT UNIQUE
            )
        """
        )
        conn.commit()


setup_database()


class FavoriteCity(BaseModel):
    city: str


# In-memory question history
question_history = []


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Serve the home page."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/weather/{city}")
async def get_weather(city: str):
    """Fetch weather data and forecast from OpenWeather API."""
    weather_url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={OPENWEATHER_API_KEY}&units=metric"
    print(weather_url)
    forecast_url = f"https://api.openweathermap.org/data/2.5/forecast?q={city}&appid={OPENWEATHER_API_KEY}&units=metric"

    try:
        async with httpx.AsyncClient() as client:
            weather_response = await client.get(weather_url)
            forecast_response = await client.get(forecast_url)

        weather_response.raise_for_status()
        forecast_response.raise_for_status()

        weather_data = weather_response.json()
        forecast_data = forecast_response.json()

        return {"weather": weather_data, "forecast": forecast_data}
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=500, detail=f"Error while fetching weather data: {e}"
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=weather_response.status_code,
            detail=f"Error from weather API: {e.response.text}",
        )


@app.get("/api/favorites")
def get_favorites():
    """Retrieve favorite cities."""
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT city_name FROM favorite_cities")
        cities = [row[0] for row in cursor.fetchall()]
    return {"favorites": cities}


@app.post("/api/favorites")
async def add_favorite(favorite: FavoriteCity):
    """Add a city to favorites."""
    print(favorite)
    city = favorite.city.strip()

    if not city or not city.isalpha():
        raise HTTPException(status_code=400, detail="Invalid city name")

    try:
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO favorite_cities (city_name) VALUES (?)", (city,)
            )
            conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="City already exists in favorites")
    return {"message": f"{city} added to favorites"}


@app.post("/api/ask-question")
async def ask_question(payload: dict):
    """Handle user questions and return AI-generated responses."""
    question = payload.get("question")
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    try:
        answer = ai.get_openai_response(question)

        question_history.append({"question": question, "answer": answer})

        return {"answer": answer}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error generating AI response: {str(e)}"
        )


@app.get("/api/question-history")
def get_question_history():
    """Return the history of asked questions."""
    return {"history": question_history}


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
