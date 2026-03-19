import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import db from "./db.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.static(path.resolve("public")));

  // Health check for deployment
  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });

  // API Routes
  
  // Get logo as base64
  app.get("/api/logo", (req, res) => {
    try {
      const logoPath = path.resolve("public", "FU_Logo.png");
      if (fs.existsSync(logoPath)) {
        const base64 = fs.readFileSync(logoPath, { encoding: "base64" });
        res.json({ data: `data:image/png;base64,${base64}` });
      } else {
        res.status(404).json({ error: "Logo not found" });
      }
    } catch (error) {
      console.error("Logo error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Search foods
  app.get("/api/foods/search", (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) return res.json([]);
      
      const results = db.prepare("SELECT * FROM foods WHERE name LIKE ? LIMIT 10")
        .all(`%${query}%`);
      res.json(results);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get logs for a specific date
  app.get("/api/logs", (req, res) => {
    try {
      const date = req.query.date as string; // YYYY-MM-DD
      if (!date) return res.status(400).json({ error: "Date is required" });
      
      const logs = db.prepare("SELECT * FROM logs WHERE date = ? ORDER BY created_at ASC")
        .all(date);
      res.json(logs);
    } catch (error) {
      console.error("Get logs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add a log entry
  app.post("/api/logs", (req, res) => {
    try {
      const { date, meal_type, food_name, quantity_grams, calories, protein, carbs, fats, fiber } = req.body;
      
      if (!date || !meal_type || !food_name) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = db.prepare(`
        INSERT INTO logs (date, meal_type, food_name, quantity_grams, calories, protein, carbs, fats, fiber)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(date, meal_type, food_name, quantity_grams, calories, protein, carbs, fats, fiber);
      
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
      console.error("Add log error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete a log entry
  app.delete("/api/logs/:id", (req, res) => {
    try {
      const id = req.params.id;
      const result = db.prepare("DELETE FROM logs WHERE log_id = ?").run(id);
      if (result.changes === 0) {
        return res.status(404).json({ error: "Log entry not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete log error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get weekly stats
  app.get("/api/stats/weekly", (req, res) => {
    try {
      const stats = db.prepare(`
        SELECT 
          date, 
          SUM(calories) as total_calories,
          SUM(protein) as total_protein,
          SUM(carbs) as total_carbs,
          SUM(fats) as total_fats,
          SUM(fiber) as total_fiber
        FROM logs
        WHERE date >= date('now', '-7 days')
        GROUP BY date
        ORDER BY date ASC
      `).all();
      res.json(stats);
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get/Set goals
  app.get("/api/goals", (req, res) => {
    try {
      const date = req.query.date as string || new Date().toISOString().split('T')[0];
      let goals = db.prepare("SELECT * FROM daily_goals WHERE date = ?").get(date);
      
      if (!goals) {
        // Return default goals if not set for this date
        goals = {
          date,
          calorie_goal: 2000,
          protein_goal: 150,
          carb_goal: 200,
          fat_goal: 65,
          fiber_goal: 30
        };
      }
      res.json(goals);
    } catch (error) {
      console.error("Get goals error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/goals", (req, res) => {
    try {
      const { date, calorie_goal, protein_goal, carb_goal, fat_goal, fiber_goal } = req.body;
      if (!date) return res.status(400).json({ error: "Date is required" });

      db.prepare(`
        INSERT INTO daily_goals (date, calorie_goal, protein_goal, carb_goal, fat_goal, fiber_goal)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          calorie_goal = excluded.calorie_goal,
          protein_goal = excluded.protein_goal,
          carb_goal = excluded.carb_goal,
          fat_goal = excluded.fat_goal,
          fiber_goal = excluded.fiber_goal
      `).run(date, calorie_goal, protein_goal, carb_goal, fat_goal, fiber_goal);
      res.json({ success: true });
    } catch (error) {
      console.error("Set goals error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is listening on 0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical server startup error:", err);
  process.exit(1);
});
