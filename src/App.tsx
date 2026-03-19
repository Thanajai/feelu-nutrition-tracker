import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, ChevronDown, ChevronUp, Trash2, Calendar, Settings, History, Home, ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Food, LogEntry, DailyGoals, WeeklyStat } from './types';
import { cn, formatNumber, getTodayDate, apiFetch } from './utils';

// --- Components ---

const ProgressBar = ({ label, current, goal, unit, color }: { label: string, current: number, goal: number, unit: string, color: string }) => {
  const percentage = Math.min((current / goal) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium text-zinc-500 uppercase tracking-wider">
        <span>{label}</span>
        <span>{formatNumber(current)} / {goal} {unit}</span>
      </div>
      <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
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
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-zinc-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-zinc-900">{title}</h3>
          <span className="text-xs font-medium px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full">
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
                mealLogs.map(log => (
                  <div key={log.log_id} className="flex items-center justify-between group">
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{log.food_name}</p>
                      <p className="text-xs text-zinc-500">
                        {log.quantity_grams}g • {formatNumber(log.calories)} kcal • P: {formatNumber(log.protein)}g
                      </p>
                    </div>
                    <button 
                      onClick={() => onDelete(log.log_id)}
                      className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
              <button 
                onClick={onAddClick}
                className="w-full mt-2 py-2 flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
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
  const [view, setView] = useState<'today' | 'history' | 'settings'>('today');
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeMealType, setActiveMealType] = useState<LogEntry['meal_type']>('breakfast');
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState<string>('100');
  const [unitType, setUnitType] = useState<'grams' | 'units'>('grams');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadAppData();
  }, [selectedDate]);

  const loadAppData = async () => {
    try {
      const [logsRes, goalsRes, statsRes] = await Promise.all([
        apiFetch(`/api/logs?date=${selectedDate}`),
        apiFetch(`/api/goals?date=${selectedDate}`),
        apiFetch('/api/stats/weekly')
      ]);
      
      setLogs(await logsRes.json());
      setGoals(await goalsRes.json());
      setWeeklyStats(await statsRes.json());
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
      // Local search
      const localRes = await apiFetch(`/api/foods/search?q=${encodeURIComponent(q)}`);
      const localData: Food[] = await localRes.json();

      setSearchResults(localData);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const logFood = async () => {
    if (!selectedFood) return;

    const qty = parseFloat(quantity);
    const grams = unitType === 'units' ? qty * selectedFood.grams_per_unit : qty;
    const factor = grams / 100;

    const entry = {
      date: selectedDate,
      meal_type: activeMealType,
      food_name: selectedFood.name,
      quantity_grams: grams,
      calories: selectedFood.calories_per_100g * factor,
      protein: selectedFood.protein_per_100g * factor,
      carbs: selectedFood.carbs_per_100g * factor,
      fats: selectedFood.fats_per_100g * factor,
      fiber: selectedFood.fiber_per_100g * factor
    };

    try {
      await apiFetch('/api/logs', {
        method: 'POST',
        body: JSON.stringify(entry)
      });
      setIsAddModalOpen(false);
      setSelectedFood(null);
      setSearchQuery('');
      loadAppData();
    } catch (err) {
      console.error("Failed to log food", err);
    }
  };

  const deleteLog = async (id: number) => {
    try {
      await apiFetch(`/api/logs/${id}`, { method: 'DELETE' });
      loadAppData();
    } catch (err) {
      console.error("Failed to delete log", err);
    }
  };

  const updateGoals = async (newGoals: DailyGoals) => {
    try {
      await apiFetch('/api/goals', {
        method: 'POST',
        body: JSON.stringify(newGoals)
      });
      setGoals(newGoals);
      setView('today');
    } catch (err) {
      console.error("Failed to update goals", err);
    }
  };

  const totals = logs.reduce((acc, l) => ({
    calories: acc.calories + l.calories,
    protein: acc.protein + l.protein,
    carbs: acc.carbs + l.carbs,
    fats: acc.fats + l.fats,
    fiber: acc.fiber + l.fiber
  }), { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 });

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/FU_Logo.png" alt="FeelU" style={{ height: '40px', width: 'auto' }} />
        </div>
        <div className="flex items-center gap-3 bg-zinc-100 p-1 rounded-xl">
          <button 
            onClick={() => changeDate(-1)}
            className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-sm font-semibold px-2">
            {selectedDate === getTodayDate() ? 'Today' : selectedDate}
          </span>
          <button 
            onClick={() => changeDate(1)}
            className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8 space-y-8">
        {view === 'today' && (
          <>
            {/* Dashboard */}
            <section className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-zinc-500 text-sm font-medium uppercase tracking-wider">Calories</p>
                  <h2 className="text-4xl font-bold text-zinc-900">
                    {formatNumber(totals.calories)} <span className="text-lg font-normal text-zinc-400">/ {goals?.calorie_goal} kcal</span>
                  </h2>
                  <p className="text-xs font-semibold text-emerald-600 mt-1">
                    {Math.max(0, (goals?.calorie_goal || 2000) - Math.round(totals.calories))} kcal remaining
                  </p>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-zinc-100 flex items-center justify-center relative">
                   <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                      <circle 
                        cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" 
                        className="text-emerald-500" 
                        strokeDasharray={`${Math.min((totals.calories / (goals?.calorie_goal || 2000)) * 283, 283)} 283`}
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
          </>
        )}

        {view === 'history' && (
          <section className="space-y-8">
            <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
              <h3 className="text-lg font-bold mb-6">Last 7 Days</h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={weeklyStats} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#888' }}
                      tickFormatter={(val) => val.split('-').slice(1).join('/')}
                    />
                    <YAxis 
                      yAxisId="left"
                      orientation="left"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#888' }} 
                      label={{ value: 'Macros (g)', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#888' } }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#888' }}
                      label={{ value: 'Calories (kcal)', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: '#888' } }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8f8f8' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                    <Bar yAxisId="left" dataKey="total_protein" name="Protein (g)" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar yAxisId="left" dataKey="total_carbs" name="Carbs (g)" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar yAxisId="left" dataKey="total_fats" name="Fats (g)" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} />
                    <Bar yAxisId="left" dataKey="total_fiber" name="Fiber (g)" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="total_calories" 
                      name="Calories (kcal)" 
                      stroke="#18181b" 
                      strokeWidth={3} 
                      dot={{ r: 6, fill: '#18181b', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 8, strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold">Daily Logs</h3>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              {logs.length > 0 ? (
                <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
                   {logs.map(log => (
                      <div key={log.log_id} className="flex justify-between items-center border-b border-zinc-50 pb-3 last:border-0 last:pb-0">
                        <div>
                          <p className="text-sm font-semibold">{log.food_name}</p>
                          <p className="text-xs text-zinc-400 uppercase">{log.meal_type}</p>
                        </div>
                        <p className="text-sm font-bold">{Math.round(log.calories)} kcal</p>
                      </div>
                   ))}
                   <div className="pt-4 flex justify-between items-center font-bold text-lg">
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
          <section className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm space-y-8">
            <h3 className="text-2xl font-bold">Daily Goals</h3>
            <div className="space-y-6">
              {[
                { label: 'Calories (kcal)', key: 'calorie_goal' },
                { label: 'Protein (g)', key: 'protein_goal' },
                { label: 'Carbs (g)', key: 'carb_goal' },
                { label: 'Fats (g)', key: 'fat_goal' },
                { label: 'Fiber (g)', key: 'fiber_goal' },
              ].map((field) => (
                <div key={field.key} className="space-y-2">
                  <label className="text-sm font-medium text-zinc-500 uppercase tracking-wider">{field.label}</label>
                  <input 
                    type="number"
                    value={goals?.[field.key as keyof DailyGoals] || ''}
                    onChange={(e) => setGoals(prev => prev ? { ...prev, [field.key]: parseFloat(e.target.value) } : null)}
                    className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-lg font-semibold"
                  />
                </div>
              ))}
              <button 
                onClick={() => goals && updateGoals(goals)}
                className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-200"
              >
                Save Goals
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-zinc-100 px-8 py-4 flex justify-around items-center z-40">
        <button 
          onClick={() => setView('today')}
          className={cn("flex flex-col items-center gap-1 transition-colors", view === 'today' ? "text-emerald-600" : "text-zinc-400 hover:text-zinc-600")}
        >
          <Home size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
        </button>
        <button 
          onClick={() => setView('history')}
          className={cn("flex flex-col items-center gap-1 transition-colors", view === 'history' ? "text-emerald-600" : "text-zinc-400 hover:text-zinc-600")}
        >
          <History size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">History</span>
        </button>
        <button 
          onClick={() => setView('settings')}
          className={cn("flex flex-col items-center gap-1 transition-colors", view === 'settings' ? "text-emerald-600" : "text-zinc-400 hover:text-zinc-600")}
        >
          <Settings size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Goals</span>
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
              className="relative w-full max-w-xl bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">Add to {activeMealType}</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                {!selectedFood ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                      <input 
                        autoFocus
                        type="text"
                        placeholder="Search food (e.g. Rice, Idli...)"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-lg"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      {isSearching && <div className="text-center py-4 text-zinc-400 text-sm">Searching...</div>}
                      {searchResults.map((food, idx) => (
                        <button 
                          key={idx}
                          onClick={() => {
                            setSelectedFood(food);
                            setQuantity('100');
                            setUnitType('grams');
                          }}
                          className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 rounded-2xl border border-transparent hover:border-zinc-100 transition-all text-left"
                        >
                          <div>
                            <p className="font-semibold text-zinc-800">{food.name}</p>
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
                      className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
                    >
                      <ArrowLeft size={14} /> Back to search
                    </button>

                    <div className="space-y-2">
                      <h4 className="text-2xl font-bold">{selectedFood.name}</h4>
                      <p className="text-zinc-400 uppercase text-xs font-bold tracking-widest">Nutrition per 100g</p>
                      <div className="flex gap-4 text-sm">
                        <span className="px-2 py-1 bg-zinc-100 rounded-md">P: {selectedFood.protein_per_100g}g</span>
                        <span className="px-2 py-1 bg-zinc-100 rounded-md">C: {selectedFood.carbs_per_100g}g</span>
                        <span className="px-2 py-1 bg-zinc-100 rounded-md">F: {selectedFood.fats_per_100g}g</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-zinc-500 uppercase">Quantity</label>
                        <div className="flex bg-zinc-100 p-1 rounded-xl">
                          <button 
                            onClick={() => setUnitType('grams')}
                            className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", unitType === 'grams' ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400")}
                          >
                            Grams
                          </button>
                          <button 
                            onClick={() => setUnitType('units')}
                            className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", unitType === 'units' ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400")}
                          >
                            Units
                          </button>
                        </div>
                      </div>
                      <input 
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full p-6 bg-zinc-50 border border-zinc-100 rounded-3xl text-3xl font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </div>

                    <div className="bg-emerald-50 p-6 rounded-3xl space-y-4">
                      <p className="text-emerald-800 font-bold uppercase text-xs tracking-widest">Total Macros</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-emerald-900">
                            {formatNumber(selectedFood.calories_per_100g * (unitType === 'units' ? parseFloat(quantity || '0') * selectedFood.grams_per_unit : parseFloat(quantity || '0')) / 100)}
                          </p>
                          <p className="text-[10px] uppercase font-bold text-emerald-600">Calories</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-emerald-900">
                            {formatNumber(selectedFood.protein_per_100g * (unitType === 'units' ? parseFloat(quantity || '0') * selectedFood.grams_per_unit : parseFloat(quantity || '0')) / 100)}g
                          </p>
                          <p className="text-[10px] uppercase font-bold text-emerald-600">Protein</p>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={logFood}
                      className="w-full py-5 bg-emerald-500 text-white font-bold text-lg rounded-3xl hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-200"
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
    </div>
  );
}
