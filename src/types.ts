export interface Food {
  food_id?: number;
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fats_per_100g: number;
  fiber_per_100g: number;
  serving_unit: string;
  grams_per_unit: number;
  source?: string;
}

export interface LogEntry {
  log_id: number;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_name: string;
  quantity_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  created_at: string;
}

export interface DailyGoals {
  goal_id?: number;
  date: string;
  calorie_goal: number;
  protein_goal: number;
  carb_goal: number;
  fat_goal: number;
  fiber_goal: number;
}

export interface WeeklyStat {
  date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  total_fiber: number;
}
