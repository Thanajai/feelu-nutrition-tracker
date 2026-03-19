import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const db = new Database('feelu.db');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS foods (
    food_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    calories_per_100g REAL NOT NULL,
    protein_per_100g REAL NOT NULL,
    carbs_per_100g REAL NOT NULL,
    fats_per_100g REAL NOT NULL,
    fiber_per_100g REAL NOT NULL,
    serving_unit TEXT DEFAULT 'grams',
    grams_per_unit REAL DEFAULT 1,
    source TEXT DEFAULT 'local'
  );

  CREATE TABLE IF NOT EXISTS logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL, -- breakfast, lunch, dinner, snack
    food_name TEXT NOT NULL,
    quantity_grams REAL NOT NULL,
    calories REAL NOT NULL,
    protein REAL NOT NULL,
    carbs REAL NOT NULL,
    fats REAL NOT NULL,
    fiber REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS daily_goals (
    date TEXT PRIMARY KEY,
    calorie_goal REAL DEFAULT 2000,
    protein_goal REAL DEFAULT 150,
    carb_goal REAL DEFAULT 200,
    fat_goal REAL DEFAULT 65,
    fiber_goal REAL DEFAULT 30
  );
`);

// Seed initial foods if empty or incomplete
const count = db.prepare('SELECT COUNT(*) as count FROM foods').get() as { count: number };
if (count.count < 1014) {
  console.log(`Current food count is ${count.count}. Re-seeding from foods.json...`);
  const foodsPath = path.join(process.cwd(), 'foods.json');
  if (fs.existsSync(foodsPath)) {
    const foodsData = JSON.parse(fs.readFileSync(foodsPath, 'utf-8'));
    
    // Clear existing foods to avoid duplicates or stale data
    db.prepare('DELETE FROM foods').run();
    
    const insert = db.prepare(`
      INSERT INTO foods (name, calories_per_100g, protein_per_100g, carbs_per_100g, fats_per_100g, fiber_per_100g, serving_unit, grams_per_unit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((foods) => {
      for (const food of foods) {
        insert.run(
          food.name,
          food.calories,
          food.protein,
          food.carbs,
          food.fats,
          food.fiber,
          food.serving_unit,
          food.grams_per_unit
        );
      }
    });
    transaction(foodsData);
    console.log(`Successfully seeded ${foodsData.length} foods.`);
  }
}

export default db;
