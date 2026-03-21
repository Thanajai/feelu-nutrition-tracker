// NEVER use window.fetch = ... 
// Always use the http() wrapper defined in utils.ts
import React, { useState, useEffect } from 'react';
import { Search, Plus, X, ChevronDown, ChevronUp, Trash2, Home, ArrowLeft, ArrowRight, LogOut, Settings as SettingsIcon, History as HistoryIcon, Sun, Moon, User, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Food, LogEntry, DailyGoals, WeeklyStat } from './types';
import { cn, formatNumber, getTodayDate, formatDate, http } from './utils';
import { supabase } from './supabase';
import Auth from './Auth';
import { Session } from '@supabase/supabase-js';

// --- Components ---

const ProgressBar = ({ label, current, goal, unit, color }: { label: string, current: number, goal: number, unit: string, color: string }) => {
  const percentage = Math.min((current / goal) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
        <span>{label}</span>
        <span>{formatNumber(current)} / {goal} {unit}</span>
      </div>
      <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 50, damping: 15 }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
    </div>
  );
};

const MealSection = ({ 
  title, 
  type, 
  logs, 
  onAddClick, 
  onDelete 
}: { 
  title: string, 
  type: LogEntry['meal_type'], 
  logs: LogEntry[], 
  onAddClick: () => void,
  onDelete: (id: number) => void
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const mealLogs = logs.filter(l => l.meal_type === type);
  const totalCals = mealLogs.reduce((acc, l) => acc + l.calories, 0);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-zinc-900 dark:text-white">{title}</h3>
          <span className="text-xs font-medium px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-full">
            {formatNumber(totalCals)} kcal
          </span>
        </div>
        {isOpen ? <ChevronUp size={18} className="text-zinc-400" /> : <ChevronDown size={18} className="text-zinc-400" />}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-3">
              {mealLogs.length === 0 ? (
                <p className="text-sm text-zinc-400 italic py-2">No items logged yet.</p>
              ) : (
                <div className="space-y-3">
                  {mealLogs.map((log, index) => (
                    <motion.div 
                      key={log.log_id} 
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between group"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{log.food_name}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {log.quantity_grams}g • {formatNumber(log.calories)} kcal • P: {formatNumber(log.protein)}g
                        </p>
                      </div>
                      <button 
                        onClick={() => onDelete(log.log_id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
              <button 
                onClick={onAddClick}
                className="w-full mt-2 py-2 flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 rounded-xl transition-colors"
              >
                <Plus size={16} />
                Add Food
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [view, setView] = useState<'today' | 'history' | 'settings' | 'account'>('today');
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [activeMealType, setActiveMealType] = useState<LogEntry['meal_type']>('breakfast');
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat[]>([]);
  const [localFoods, setLocalFoods] = useState<Food[]>([]);
  const [profile, setProfile] = useState<{ username: string, created_at: string } | null>(null);
  const [logStats, setLogStats] = useState<{ totalDays: number, totalCalories: number }>({ totalDays: 0, totalCalories: 0 });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState<string>('100');
  const [unitType, setUnitType] = useState<'grams' | 'units'>('grams');
  const [isSearching, setIsSearching] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('0');
  const [customCarbs, setCustomCarbs] = useState('0');
  const [customFats, setCustomFats] = useState('0');
  const [customFiber, setCustomFiber] = useState('0');
  const [customServingSize, setCustomServingSize] = useState('100');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calcData, setCalcData] = useState({
    weight: '',
    height: '',
    age: '',
    gender: 'male',
    activity: '1.2'
  });

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    console.log('Theme changed:', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (session?.user) {
      const fetchProfileData = async () => {
        const { data: profileData, error: fetchError } = await supabase
          .from('profiles')
          .select('username, created_at')
          .eq('id', session.user.id)
          .single();
        
        if (profileData) {
          setProfile(profileData);
        } else if (fetchError?.code === 'PGRST116') {
          // Profile doesn't exist, create it lazily
          const defaultUsername = session.user.email?.split('@')[0] || `user_${session.user.id.slice(0, 5)}`;
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              username: defaultUsername,
              email: session.user.email
            })
            .select()
            .single();
          
          if (!insertError && newProfile) {
            setProfile(newProfile);
          }
        }

        const { data: logsData } = await supabase
          .from('logs')
          .select('date, calories')
          .eq('user_id', session.user.id);

        if (logsData) {
          const totalDays = [...new Set(logsData.map(l => l.date))].length;
          const totalCalories = logsData.reduce((sum, l) => sum + l.calories, 0);
          setLogStats({ totalDays, totalCalories });
        }
      };
      fetchProfileData();
    }
  }, [session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setView('today');
      } else {
        setIsSignOutModalOpen(false);
      }
    });

    // Load local foods for search fallback
    http('/foods.json')
      .then(res => res.json())
      .then(data => {
        const mapped = data.map((f: any) => ({
          name: f.name,
          calories_per_100g: f.calories,
          protein_per_100g: f.protein,
          carbs_per_100g: f.carbs,
          fats_per_100g: f.fats,
          fiber_per_100g: f.fiber,
          serving_unit: f.serving_unit,
          grams_per_unit: f.grams_per_unit
        }));
        setLocalFoods(mapped);
      })
      .catch(err => console.error("Failed to load local foods", err));

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      loadAppData();
    }
  }, [selectedDate, session]);

  const loadAppData = async () => {
    if (!session?.user) return;
    
    try {
      // Get logs
      const { data: logsData, error: logsError } = await supabase
        .from('logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', selectedDate)
        .order('created_at', { ascending: true });
      
      if (logsError) throw logsError;
      setLogs(logsData || []);

      // Get goals: fetch the most recent goal record to apply it "globally"
      const { data: goalsData, error: goalsError } = await supabase
        .from('daily_goals')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .limit(1);
      
      if (goalsError) throw goalsError;
      
      const latestGoal = (goalsData && goalsData.length > 0) ? goalsData[0] : null;
      
      if (latestGoal) {
        setGoals(latestGoal);
      } else {
        setGoals({
          date: selectedDate,
          calorie_goal: 2000,
          protein_goal: 150,
          carb_goal: 200,
          fat_goal: 65,
          fiber_goal: 30
        } as DailyGoals);
      }

      // Get weekly stats (simplified for frontend calculation from logs if needed, 
      // but let's try to replicate the server logic with Supabase)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = formatDate(sevenDaysAgo);

      const { data: statsData, error: statsError } = await supabase
        .from('logs')
        .select('date, calories, protein, carbs, fats, fiber')
        .eq('user_id', session.user.id)
        .gte('date', sevenDaysAgoStr);
      
      if (statsError) throw statsError;

      // Group by date
      const grouped = (statsData || []).reduce((acc: any, log) => {
        if (!acc[log.date]) {
          acc[log.date] = { 
            date: log.date, 
            total_calories: 0, 
            total_protein: 0, 
            total_carbs: 0, 
            total_fats: 0, 
            total_fiber: 0 
          };
        }
        acc[log.date].total_calories += log.calories;
        acc[log.date].total_protein += log.protein;
        acc[log.date].total_carbs += log.carbs;
        acc[log.date].total_fats += log.fats;
        acc[log.date].total_fiber += log.fiber;
        return acc;
      }, {});

      setWeeklyStats(Object.values(grouped).sort((a: any, b: any) => a.date.localeCompare(b.date)) as WeeklyStat[]);

    } catch (err) {
      console.error("Failed to load app data", err);
    }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // 1. Search local foods
      const localResults = localFoods
        .filter(f => f.name.toLowerCase().includes(q.toLowerCase()))
        .map(f => ({ ...f, source: 'Local' }))
        .slice(0, 10);

      // 2. Search custom foods in Supabase
      let customResults: Food[] = [];
      if (session?.user) {
        const { data, error } = await supabase
          .from('custom_foods')
          .select('*')
          .eq('user_id', session.user.id)
          .ilike('name', `%${q}%`);
        
        if (!error && data) {
          customResults = data.map(f => ({
            name: f.name,
            calories_per_100g: f.calories_per_100g,
            protein_per_100g: f.protein_per_100g,
            carbs_per_100g: f.carbs_per_100g,
            fats_per_100g: f.fats_per_100g,
            fiber_per_100g: f.fiber_per_100g,
            serving_unit: f.serving_unit,
            grams_per_unit: f.grams_per_unit,
            source: 'Custom'
          }));
        }
      }

      // Merge results: Custom foods first
      const merged = [...customResults, ...localResults].slice(0, 15);
      setSearchResults(merged);
    } catch (err) {
      console.error("Search failed", err);
      const filtered = localFoods
        .filter(f => f.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 10);
      setSearchResults(filtered);
    } finally {
      setIsSearching(false);
    }
  };

  const logFood = async () => {
    if (!session?.user || (!selectedFood && !isCustomMode)) return;

    setLoading(true);
    try {
      let foodToLog: Food;

      if (isCustomMode) {
        // Step 1: Save to custom_foods table
        const customFoodData = {
          user_id: session.user.id,
          name: customName,
          calories_per_100g: parseFloat(customCalories) || 0,
          protein_per_100g: parseFloat(customProtein) || 0,
          carbs_per_100g: parseFloat(customCarbs) || 0,
          fats_per_100g: parseFloat(customFats) || 0,
          fiber_per_100g: parseFloat(customFiber) || 0,
          serving_unit: 'g',
          grams_per_unit: parseFloat(customServingSize) || 100
        };

        const { data: newCustomFood, error: customError } = await supabase
          .from('custom_foods')
          .insert(customFoodData)
          .select()
          .single();

        if (customError) throw customError;

        foodToLog = {
          name: newCustomFood.name,
          calories_per_100g: newCustomFood.calories_per_100g,
          protein_per_100g: newCustomFood.protein_per_100g,
          carbs_per_100g: newCustomFood.carbs_per_100g,
          fats_per_100g: newCustomFood.fats_per_100g,
          fiber_per_100g: newCustomFood.fiber_per_100g,
          serving_unit: newCustomFood.serving_unit,
          grams_per_unit: newCustomFood.grams_per_unit,
          source: 'Custom'
        };
      } else {
        foodToLog = selectedFood!;
      }

      // Step 2: Log to logs table
      const qty = parseFloat(quantity);
      const grams = unitType === 'units' ? qty * (foodToLog.grams_per_unit || 100) : qty;
      const factor = grams / 100;

      const entry = {
        user_id: session.user.id,
        date: selectedDate,
        meal_type: activeMealType,
        food_name: foodToLog.name,
        quantity_grams: grams,
        calories: foodToLog.calories_per_100g * factor,
        protein: foodToLog.protein_per_100g * factor,
        carbs: foodToLog.carbs_per_100g * factor,
        fats: foodToLog.fats_per_100g * factor,
        fiber: foodToLog.fiber_per_100g * factor
      };

      const { error: logError } = await supabase.from('logs').insert(entry);
      if (logError) throw logError;
      
      setIsAddModalOpen(false);
      setSelectedFood(null);
      setSearchQuery('');
      setCustomName('');
      setCustomCalories('');
      setCustomProtein('0');
      setCustomCarbs('0');
      setCustomFats('0');
      setCustomFiber('0');
      setCustomServingSize('100');
      setIsCustomMode(false);
      loadAppData();
    } catch (err) {
      console.error("Failed to log food", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteLog = async (id: number) => {
    try {
      const { error } = await supabase.from('logs').delete().eq('log_id', id);
      if (error) throw error;
      loadAppData();
    } catch (err) {
      console.error("Failed to delete log", err);
    }
  };

  const updateGoals = async (newGoals: DailyGoals) => {
    if (!session?.user) return;
    setIsSavingGoals(true);
    try {
      const payload = {
        user_id: session.user.id,
        date: selectedDate,
        calorie_goal: newGoals.calorie_goal,
        protein_goal: newGoals.protein_goal,
        carb_goal: newGoals.carb_goal,
        fat_goal: newGoals.fat_goal,
        fiber_goal: newGoals.fiber_goal
      };

      // Use onConflict to target the unique constraint on user_id and date
      // This ensures that if a goal already exists for this date, it gets updated
      const { error } = await supabase
        .from('daily_goals')
        .upsert(payload, { onConflict: 'user_id,date' });
      
      if (error) throw error;
      
      // Refresh goals for the current date
      const { data: refreshedGoals } = await supabase
        .from('daily_goals')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', selectedDate)
        .limit(1);

      if (refreshedGoals && refreshedGoals.length > 0) {
        setGoals(refreshedGoals[0]);
      } else {
        // Fallback to the latest goal globally if the specific date fetch fails
        const { data: latestGoalData } = await supabase
          .from('daily_goals')
          .select('*')
          .eq('user_id', session.user.id)
          .order('date', { ascending: false })
          .limit(1);
        
        if (latestGoalData && latestGoalData.length > 0) {
          setGoals(latestGoalData[0]);
        }
      }

      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
    } catch (err) {
      console.error("Failed to update goals", err);
      alert("Failed to save goals. Please try again.");
    } finally {
      setIsSavingGoals(false);
    }
  };

  const calculateAndSetGoals = () => {
    const w = parseFloat(calcData.weight);
    const h = parseFloat(calcData.height);
    const a = parseFloat(calcData.age);
    const activity = parseFloat(calcData.activity);

    if (!w || !h || !a) {
      alert('Please fill in all fields');
      return;
    }

    // Mifflin-St Jeor Equation
    let bmr = (10 * w) + (6.25 * h) - (5 * a);
    if (calcData.gender === 'male') {
      bmr += 5;
    } else {
      bmr -= 161;
    }

    const tdee = Math.round(bmr * activity);
    
    // Macro distribution: Protein based on activity level (g/kg), 25% Fats, remaining Carbs
    let proteinPerKg = 1.0;
    if (activity <= 1.2) proteinPerKg = 1.0;
    else if (activity <= 1.375) proteinPerKg = 1.2; // User requested 1.2g/kg for light activity
    else if (activity <= 1.55) proteinPerKg = 1.5;
    else if (activity <= 1.725) proteinPerKg = 1.8;
    else proteinPerKg = 2.0;

    const protein = Math.round(w * proteinPerKg);
    const fats = Math.round((tdee * 0.25) / 9);
    const carbs = Math.round(Math.max(0, tdee - (protein * 4) - (fats * 9)) / 4);
    const fiber = Math.round((tdee / 1000) * 14);

    const newGoals: DailyGoals = {
      date: selectedDate,
      calorie_goal: tdee,
      protein_goal: protein,
      carb_goal: carbs,
      fat_goal: fats,
      fiber_goal: fiber
    };

    setGoals(newGoals);
    setIsCalculatorOpen(false);
  };

  if (!session) return <Auth darkMode={darkMode} setDarkMode={setDarkMode} />;

  const totals = logs.reduce((acc, l) => ({
    calories: acc.calories + l.calories,
    protein: acc.protein + l.protein,
    carbs: acc.carbs + l.carbs,
    fats: acc.fats + l.fats,
    fiber: acc.fiber + l.fiber
  }), { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 });

  const changeDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    setSelectedDate(formatDate(date));
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans pb-24 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-800 px-6 py-4 grid grid-cols-3 items-center">
        <div className="flex justify-start">
          <img 
            src="/pwa-icon.svg" 
            alt="FeelU Icon" 
            className="w-8 h-8"
            referrerPolicy="no-referrer"
          />
        </div>
        
        <div className="flex justify-center">
          <span className="text-3xl font-black bg-linear-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent tracking-tight">FeelU</span>
        </div>

        <div className="flex justify-end">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8 space-y-8">
        {/* Greeting */}
        {view === 'today' && profile?.username && (
          <div className="flex justify-start -ml-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Hi, {profile.username}</span>
          </div>
        )}

        {/* Date selector outside in the center */}
        {view === 'today' && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 transition-colors">
              <button 
                onClick={() => changeDate(-1)}
                className="p-2 hover:bg-white dark:hover:bg-zinc-700 hover:shadow-sm rounded-lg transition-all dark:text-zinc-300"
              >
                <ArrowLeft size={18} />
              </button>
              <span className="text-sm font-bold px-2 min-w-[80px] text-center dark:text-white">
                {selectedDate === getTodayDate() ? 'Today' : selectedDate.split('-').slice(1).join('/')}
              </span>
              <button 
                onClick={() => changeDate(1)}
                className="p-2 hover:bg-white dark:hover:bg-zinc-700 hover:shadow-sm rounded-lg transition-all dark:text-zinc-300"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {view === 'today' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Dashboard */}
            <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium uppercase tracking-wider">Calories</p>
                  <h2 className="text-4xl font-bold text-zinc-900 dark:text-white">
                    {formatNumber(totals.calories)} <span className="text-lg font-normal text-zinc-400">/ {goals?.calorie_goal} kcal</span>
                  </h2>
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                    {Math.max(0, (goals?.calorie_goal || 2000) - Math.round(totals.calories))} kcal remaining
                  </p>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-zinc-100 dark:border-zinc-800 flex items-center justify-center relative">
                   <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                      <motion.circle 
                        cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" 
                        className="text-emerald-500" 
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: Math.min(totals.calories / (goals?.calorie_goal || 2000), 1) }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        strokeDasharray="283"
                        strokeLinecap="round"
                      />
                   </svg>
                   <span className="text-xs font-bold">{Math.round((totals.calories / (goals?.calorie_goal || 2000)) * 100)}%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <ProgressBar label="Protein" current={totals.protein} goal={goals?.protein_goal || 150} unit="g" color="bg-blue-500" />
                <ProgressBar label="Carbs" current={totals.carbs} goal={goals?.carb_goal || 200} unit="g" color="bg-amber-500" />
                <ProgressBar label="Fats" current={totals.fats} goal={goals?.fat_goal || 65} unit="g" color="bg-rose-500" />
                <ProgressBar label="Fiber" current={totals.fiber} goal={goals?.fiber_goal || 30} unit="g" color="bg-emerald-500" />
              </div>
            </section>

            {/* Meals */}
            <div className="space-y-4">
              <MealSection 
                title="Breakfast" 
                type="breakfast" 
                logs={logs} 
                onAddClick={() => { setActiveMealType('breakfast'); setIsAddModalOpen(true); }}
                onDelete={deleteLog}
              />
              <MealSection 
                title="Lunch" 
                type="lunch" 
                logs={logs} 
                onAddClick={() => { setActiveMealType('lunch'); setIsAddModalOpen(true); }}
                onDelete={deleteLog}
              />
              <MealSection 
                title="Dinner" 
                type="dinner" 
                logs={logs} 
                onAddClick={() => { setActiveMealType('dinner'); setIsAddModalOpen(true); }}
                onDelete={deleteLog}
              />
              <MealSection 
                title="Snacks" 
                type="snack" 
                logs={logs} 
                onAddClick={() => { setActiveMealType('snack'); setIsAddModalOpen(true); }}
                onDelete={deleteLog}
              />
            </div>
          </motion.div>
        )}

        {view === 'history' && (
          <section className="space-y-8">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
              <h3 className="text-lg font-bold mb-6 dark:text-white">Last 7 Days</h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={weeklyStats} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#333" : "#f1f1f1"} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: darkMode ? '#666' : '#888' }}
                      tickFormatter={(val) => val.split('-').slice(1).join('/')}
                    />
                    <YAxis 
                      yAxisId="left"
                      orientation="left"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: darkMode ? '#666' : '#888' }} 
                      label={{ value: 'Macros (g)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: darkMode ? '#666' : '#888' } }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: darkMode ? '#666' : '#888' }}
                      label={{ value: 'Calories (kcal)', angle: 90, position: 'insideRight', style: { fontSize: 12, fill: darkMode ? '#666' : '#888' } }}
                    />
                    <Tooltip 
                      cursor={{ fill: darkMode ? '#222' : '#f8f8f8' }}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        backgroundColor: darkMode ? '#18181b' : '#fff',
                        color: darkMode ? '#fff' : '#000'
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px', color: darkMode ? '#888' : '#666' }} />
                    <Bar yAxisId="left" dataKey="total_protein" name="Protein (g)" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar yAxisId="left" dataKey="total_carbs" name="Carbs (g)" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar yAxisId="left" dataKey="total_fats" name="Fats (g)" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} />
                    <Bar yAxisId="left" dataKey="total_fiber" name="Fiber (g)" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="total_calories" 
                      name="Calories (kcal)" 
                      stroke={darkMode ? "#fff" : "#18181b"} 
                      strokeWidth={3} 
                      dot={{ r: 6, fill: darkMode ? '#fff' : '#18181b', strokeWidth: 2, stroke: darkMode ? '#18181b' : '#fff' }}
                      activeDot={{ r: 8, strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold dark:text-white">Daily Logs</h3>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
              />
              {logs.length > 0 ? (
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
                   {logs.map(log => (
                      <div key={log.log_id} className="flex justify-between items-center border-b border-zinc-50 dark:border-zinc-800 pb-3 last:border-0 last:pb-0">
                        <div>
                          <p className="text-sm font-semibold dark:text-zinc-200">{log.food_name}</p>
                          <p className="text-xs text-zinc-400 uppercase">{log.meal_type}</p>
                        </div>
                        <p className="text-sm font-bold dark:text-white">{Math.round(log.calories)} kcal</p>
                      </div>
                   ))}
                   <div className="pt-4 flex justify-between items-center font-bold text-lg dark:text-white">
                      <span>Total</span>
                      <span>{Math.round(totals.calories)} kcal</span>
                   </div>
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-400">No data for this date.</div>
              )}
            </div>
          </section>
        )}

        {view === 'settings' && (
          <section className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold dark:text-white">Daily Goals</h3>
              <button 
                onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
                className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
              >
                {isCalculatorOpen ? 'Close Calculator' : 'Calculate for Me'}
              </button>
            </div>

            {isCalculatorOpen && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-2xl space-y-4 border border-zinc-100 dark:border-zinc-800"
              >
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Enter your details to estimate your daily needs.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-400">Weight (kg)</label>
                    <input 
                      type="number" 
                      value={calcData.weight}
                      onChange={(e) => setCalcData({...calcData, weight: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                      placeholder="70"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-400">Height (cm)</label>
                    <input 
                      type="number" 
                      value={calcData.height}
                      onChange={(e) => setCalcData({...calcData, height: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                      placeholder="175"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-400">Age</label>
                    <input 
                      type="number" 
                      value={calcData.age}
                      onChange={(e) => setCalcData({...calcData, age: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                      placeholder="25"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-400">Gender</label>
                    <select 
                      value={calcData.gender}
                      onChange={(e) => setCalcData({...calcData, gender: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Activity Level</label>
                  <select 
                    value={calcData.activity}
                    onChange={(e) => setCalcData({...calcData, activity: e.target.value})}
                    className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                  >
                    <option value="1.2">Sedentary (Office job, little exercise)</option>
                    <option value="1.375">Lightly Active (1-3 days/week)</option>
                    <option value="1.55">Moderately Active (3-5 days/week)</option>
                    <option value="1.725">Very Active (6-7 days/week)</option>
                    <option value="1.9">Extra Active (Physical job + heavy training)</option>
                  </select>
                </div>
                <button 
                  onClick={calculateAndSetGoals}
                  className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-100 dark:shadow-none"
                >
                  Apply Calculated Goals
                </button>
              </motion.div>
            )}

            <div className="space-y-6">
              {[
                { label: 'Calories (kcal)', key: 'calorie_goal' },
                { label: 'Protein (g)', key: 'protein_goal' },
                { label: 'Carbs (g)', key: 'carb_goal' },
                { label: 'Fats (g)', key: 'fat_goal' },
                { label: 'Fiber (g)', key: 'fiber_goal' },
              ].map((field) => (
                <div key={field.key} className="space-y-2">
                  <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{field.label}</label>
                  <input 
                    type="number"
                    value={goals?.[field.key as keyof DailyGoals] || ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setGoals(prev => prev ? { ...prev, [field.key]: val } : null);
                    }}
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-lg font-semibold dark:text-white"
                  />
                </div>
              ))}
              <button 
                onClick={() => goals && updateGoals(goals)}
                disabled={isSavingGoals}
                className="w-full py-4 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-lg shadow-zinc-200 dark:shadow-none disabled:opacity-50"
              >
                {isSavingGoals ? 'Saving...' : 'Save All Goals'}
              </button>
            </div>
          </section>
        )}

        {view === 'account' && (
          <section className="space-y-8 pb-24">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                <User size={20} />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Profile</h2>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-white text-4xl font-black mb-6 shadow-xl shadow-emerald-100 dark:shadow-none">
                {profile?.username?.[0]?.toUpperCase() || session?.user?.email?.[0]?.toUpperCase()}
              </div>
              
              <h3 className="text-3xl font-black text-zinc-900 dark:text-white mb-1">
                {profile?.username || session?.user?.email?.split('@')[0] || 'User'}
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 font-medium">
                {session?.user?.email}
              </p>

              <div className="grid grid-cols-2 gap-4 w-full mb-8">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Days Logged</p>
                  <p className="text-2xl font-black text-zinc-900 dark:text-white">{logStats.totalDays}</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Calories</p>
                  <p className="text-2xl font-black text-zinc-900 dark:text-white">{Math.round(logStats.totalCalories)}</p>
                </div>
              </div>

              <div className="w-full space-y-4">
                <div className="flex items-center justify-between px-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  <span>Joined</span>
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {new Date(profile?.created_at || session?.user?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                
                <button 
                  onClick={() => setIsSignOutModalOpen(true)}
                  className="w-full py-4 bg-red-50 dark:bg-red-900/10 text-red-500 font-bold rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2 mt-4"
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-t border-zinc-100 dark:border-zinc-800 px-8 py-4 flex justify-around items-center z-40">
        <button 
          onClick={() => setView('today')}
          className={cn("flex flex-col items-center gap-1 transition-colors", view === 'today' ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200")}
        >
          <Home size={24} />
          <span className="text-[11px] font-bold uppercase tracking-widest">Home</span>
        </button>
        <button 
          onClick={() => setView('history')}
          className={cn("flex flex-col items-center gap-1 transition-colors", view === 'history' ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200")}
        >
          <HistoryIcon size={24} />
          <span className="text-[11px] font-bold uppercase tracking-widest">History</span>
        </button>
        <button 
          onClick={() => setView('settings')}
          className={cn("flex flex-col items-center gap-1 transition-colors", view === 'settings' ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200")}
        >
          <SettingsIcon size={24} />
          <span className="text-[11px] font-bold uppercase tracking-widest">Goals</span>
        </button>
        <button 
          onClick={() => setView('account')}
          className={cn("flex flex-col items-center gap-1 transition-colors", view === 'account' ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200")}
        >
          <User size={24} />
          <span className="text-[11px] font-bold uppercase tracking-widest">Account</span>
        </button>
      </nav>

      {/* Add Food Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-xl font-bold dark:text-white">Add to {activeMealType}</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors dark:text-zinc-400">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                {!selectedFood && !isCustomMode && (
                  <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl mb-2">
                    <button 
                      onClick={() => setIsCustomMode(false)}
                      className={cn("flex-1 py-2 text-sm font-bold rounded-xl transition-all", !isCustomMode ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400")}
                    >
                      Search
                    </button>
                    <button 
                      onClick={() => setIsCustomMode(true)}
                      className={cn("flex-1 py-2 text-sm font-bold rounded-xl transition-all", isCustomMode ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400")}
                    >
                      Custom
                    </button>
                  </div>
                )}

                {isCustomMode ? (
                  <div className="space-y-6">
                    <button 
                      onClick={() => setIsCustomMode(false)}
                      className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                    >
                      <ArrowLeft size={14} /> Back to search
                    </button>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Food Name</label>
                        <input 
                          type="text"
                          placeholder="e.g. Grandma's Special Cake"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-lg dark:text-white"
                        />
                        {customName.length > 0 && customName.length < 2 && (
                          <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Minimum 2 characters</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Calories (kcal per 100g)</label>
                        <input 
                          type="number"
                          placeholder="0"
                          value={customCalories}
                          onChange={(e) => setCustomCalories(e.target.value)}
                          className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-lg dark:text-white"
                        />
                        {customCalories.length > 0 && parseFloat(customCalories) <= 0 && (
                          <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Must be greater than 0</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Protein (g)</label>
                          <input 
                            type="number"
                            value={customProtein}
                            onChange={(e) => setCustomProtein(e.target.value)}
                            className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Carbs (g)</label>
                          <input 
                            type="number"
                            value={customCarbs}
                            onChange={(e) => setCustomCarbs(e.target.value)}
                            className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Fats (g)</label>
                          <input 
                            type="number"
                            value={customFats}
                            onChange={(e) => setCustomFats(e.target.value)}
                            className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Fiber (g)</label>
                          <input 
                            type="number"
                            value={customFiber}
                            onChange={(e) => setCustomFiber(e.target.value)}
                            className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Serving Size (g per unit)</label>
                        <input 
                          type="number"
                          value={customServingSize}
                          onChange={(e) => setCustomServingSize(e.target.value)}
                          className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={logFood}
                      disabled={loading || customName.length < 2 || !customCalories || parseFloat(customCalories) <= 0}
                      className="w-full py-5 bg-emerald-500 text-white font-bold text-lg rounded-3xl hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-200 dark:shadow-none disabled:opacity-50 disabled:shadow-none"
                    >
                      {loading ? 'Saving...' : 'Log Custom Food'}
                    </button>
                  </div>
                ) : !selectedFood ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                      <input 
                        autoFocus
                        type="text"
                        placeholder="Search food (e.g. Rice, Idli...)"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-lg dark:text-white"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      {isSearching && <div className="text-center py-4 text-zinc-400 text-sm">Searching...</div>}
                      {searchResults.map((food, idx) => (
                        <button 
                          key={idx}
                          onClick={() => {
                            setSelectedFood(food);
                            if (food.serving_unit && food.serving_unit !== 'g') {
                              setQuantity('1');
                              setUnitType('units');
                            } else {
                              setQuantity('100');
                              setUnitType('grams');
                            }
                          }}
                          className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-2xl border border-transparent hover:border-zinc-100 dark:hover:border-zinc-700 transition-all text-left"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-zinc-800 dark:text-zinc-200">{food.name}</p>
                              {food.source === 'Custom' && (
                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-200 dark:border-emerald-800">Custom</span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400">
                              {food.calories_per_100g} kcal / 100g • {food.source || 'Local'}
                            </p>
                          </div>
                          <Plus size={18} className="text-emerald-500" />
                        </button>
                      ))}
                      {searchQuery.length > 1 && searchResults.length === 0 && !isSearching && (
                        <div className="text-center py-8 text-zinc-400">No results found.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <button 
                      onClick={() => setSelectedFood(null)}
                      className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                    >
                      <ArrowLeft size={14} /> Back to search
                    </button>

                    <div className="space-y-2">
                      <h4 className="text-2xl font-bold dark:text-white">{selectedFood.name}</h4>
                      <p className="text-zinc-400 uppercase text-xs font-bold tracking-widest">Nutrition per 100g</p>
                      <div className="flex gap-4 text-sm">
                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 rounded-md">P: {selectedFood.protein_per_100g}g</span>
                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 rounded-md">C: {selectedFood.carbs_per_100g}g</span>
                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 rounded-md">F: {selectedFood.fats_per_100g}g</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-zinc-500 uppercase">Quantity</label>
                        {selectedFood.serving_unit && selectedFood.serving_unit !== 'g' && (
                          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                            <button 
                              onClick={() => setUnitType('units')}
                              className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", unitType === 'units' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-400")}
                            >
                              {selectedFood.serving_unit}
                            </button>
                            <button 
                              onClick={() => setUnitType('grams')}
                              className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", unitType === 'grams' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-400")}
                            >
                              grams
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <input 
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className="w-full p-6 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-3xl text-3xl font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/10 dark:text-white"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xl uppercase tracking-widest">
                          {unitType === 'units' ? selectedFood.serving_unit : 'g'}
                        </span>
                      </div>

                      {unitType === 'units' && selectedFood.grams_per_unit && (
                        <p className="text-center text-sm font-medium text-zinc-400">
                          {quantity} {selectedFood.serving_unit}{parseFloat(quantity) !== 1 ? 's' : ''} = {parseFloat(quantity) * selectedFood.grams_per_unit}g
                        </p>
                      )}
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-3xl space-y-4">
                      <p className="text-emerald-800 dark:text-emerald-400 font-bold uppercase text-xs tracking-widest">Total Macros</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200">
                            {formatNumber(selectedFood.calories_per_100g * (unitType === 'units' ? parseFloat(quantity || '0') * selectedFood.grams_per_unit : parseFloat(quantity || '0')) / 100)}
                          </p>
                          <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Calories</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200">
                            {formatNumber(selectedFood.protein_per_100g * (unitType === 'units' ? parseFloat(quantity || '0') * selectedFood.grams_per_unit : parseFloat(quantity || '0')) / 100)}g
                          </p>
                          <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Protein</p>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={logFood}
                      className="w-full py-5 bg-emerald-500 text-white font-bold text-lg rounded-3xl hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-200 dark:shadow-none"
                    >
                      Log to {activeMealType}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sign Out Confirmation Modal */}
      <AnimatePresence>
        {isSignOutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSignOutModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 p-8"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-500 mb-6">
                  <LogOut size={32} />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Sign Out?</h3>
                <p className="text-zinc-500 dark:text-zinc-400 mb-8">
                  Are you sure you want to exit? You'll need to sign in again to access your data.
                </p>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button 
                    onClick={() => setIsSignOutModalOpen(false)}
                    className="py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      supabase.auth.signOut();
                      setIsSignOutModalOpen(false);
                    }}
                    className="py-4 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 transition-colors shadow-lg shadow-red-200 dark:shadow-none"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Saved Toast Notification */}
      <AnimatePresence>
        {showSavedToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-4 rounded-3xl shadow-2xl z-[100] flex items-center gap-3 font-bold border border-zinc-100 dark:border-zinc-800"
          >
            <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
              <Check size={14} className="text-white" />
            </div>
            <span className="tracking-tight">Goals saved successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
