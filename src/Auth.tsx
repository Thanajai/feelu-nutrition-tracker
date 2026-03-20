import React, { useState } from 'react';
import { supabase } from './supabase';
import { motion } from 'motion/react';
import { Sun, Moon } from 'lucide-react';

export default function Auth({ darkMode, setDarkMode }: { darkMode: boolean, setDarkMode: (v: boolean) => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const { error } = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        setError(error.message);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-zinc-950 flex items-center justify-center p-4 font-sans transition-colors duration-300 relative">
      <div className="absolute top-6 right-6">
        <button 
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-full bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-zinc-900 p-8 rounded-[14px] shadow-lg w-full max-w-[375px] flex flex-col items-center border border-transparent dark:border-zinc-800"
      >
        <div className="mb-8">
          <span className="text-4xl font-black bg-linear-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent tracking-tight">FeelU</span>
        </div>
        
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-8">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        
        <form onSubmit={handle} className="w-full space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition-all"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <input
              type="password"
              placeholder="Password"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition-all"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          
          {error && (
            <p className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 py-2 rounded-lg">
              {error}
            </p>
          )}
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#10B981] text-white font-semibold py-3 rounded-xl hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-[0.98]"
          >
            {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>
        
        <p 
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-6 text-sm text-gray-500 dark:text-zinc-400 cursor-pointer hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
        >
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </p>
      </motion.div>
    </div>
  );
}
