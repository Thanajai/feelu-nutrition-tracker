# FeelU - Nutrition Tracker

A clean, modern nutrition tracking application built with React, Express, and SQLite.

## Features

- **Dashboard**: Real-time progress tracking for Calories, Protein, Carbs, Fats, and Fiber.
- **Meal Logging**: Log food items for Breakfast, Lunch, Dinner, and Snacks.
- **Smart Search**: Search from a local database of 100+ foods or fallback to the Open Food Facts API.
- **History**: View past logs and a 7-day calorie intake chart.
- **Custom Goals**: Set your own daily macro targets.
- **Persistence**: All data is stored locally in a SQLite database (`feelu.db`).

## Tech Stack

- **Frontend**: React, Tailwind CSS, Lucide React, Motion, Recharts.
- **Backend**: Node.js, Express.
- **Database**: SQLite (via `better-sqlite3`).

## Setup Instructions

1. **Prerequisites**: Node.js 18+ installed.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Run the App**:
   ```bash
   npm run dev
   ```
4. **Access**: Open [http://localhost:3000](http://localhost:3000) in your browser.

## Adding Custom Foods

You can add custom foods to the initial database by modifying `foods.json` before the first run, or by inserting them directly into the `foods` table in `feelu.db`.

```json
{
  "name": "My Custom Food",
  "calories": 200,
  "protein": 10,
  "carbs": 20,
  "fats": 5,
  "fiber": 2,
  "serving_unit": "piece",
  "grams_per_unit": 100
}
```
