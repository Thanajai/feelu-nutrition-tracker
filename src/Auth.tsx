import React, { useState } from 'react';
import { supabase } from './supabase';
import { motion } from 'motion/react';

export default function Auth() {
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
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-[14px] shadow-lg w-full max-w-[375px] flex flex-col items-center"
      >
        <div className="mb-8">
          <span className="text-4xl font-black bg-linear-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent tracking-tight">FeelU</span>
        </div>
        
        <h2 className="text-2xl font-semibold text-gray-900 mb-8">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        
        <form onSubmit={handle} className="w-full space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition-all"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <input
              type="password"
              placeholder="Password"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition-all"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          
          {error && (
            <p className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg">
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
          className="mt-6 text-sm text-gray-500 cursor-pointer hover:text-gray-700 transition-colors"
        >
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </p>
      </motion.div>
    </div>
  );
}
