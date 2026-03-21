// NEVER use window.fetch = ... 
// Always use the http() wrapper defined in utils.ts
import React, { useState } from 'react';
import { supabase } from './supabase';
import { motion } from 'motion/react';
import { Sun, Moon, User } from 'lucide-react';

export default function Auth({ darkMode, setDarkMode }: { darkMode: boolean, setDarkMode: (v: boolean) => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateUsername = (name: string) => {
    if (name.length < 3) return 'Username must be at least 3 characters';
    if (name.length > 20) return 'Username must be at most 20 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(name)) return 'Only letters, numbers, and underscores allowed';
    return null;
  };

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (isSignUp) {
        // Validate username first
        const validationError = validateUsername(username);
        if (validationError) {
          setError(validationError);
          setLoading(false);
          return;
        }

        // Check if username taken
        const { data: existing } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username)
          .single();
        
        if (existing) {
          setError('Username already taken');
          setLoading(false);
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        
        if (data.user) {
          // Success - Create profile
          const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            username: username,
            email: email
          });
          if (profileError) throw profileError;
        }
      } else {
        let loginEmail = emailOrUsername;
        if (!emailOrUsername.includes('@')) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', emailOrUsername)
            .single();
          
          if (profileError || !profile) {
            throw new Error('Username not found');
          }
          loginEmail = profile.email;
        }

        const { error } = await supabase.auth.signInWithPassword({ 
          email: loginEmail, 
          password 
        });
        if (error) throw error;
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
          {isSignUp && (
            <div>
              <input
                type="text"
                placeholder="Username"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition-all"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
          )}
          
          <div>
            <input
              type={isSignUp ? "email" : "text"}
              placeholder={isSignUp ? "Email" : "Email or Username"}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition-all"
              value={isSignUp ? email : emailOrUsername}
              onChange={e => isSignUp ? setEmail(e.target.value) : setEmailOrUsername(e.target.value)}
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
