import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/Toast';
import { ShieldAlert, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast('error', 'Authentication Failed', 'Please specify both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      toast('success', 'Access Granted', 'Welcome back to the Disaster Recovery Vault.');
      navigate('/');
    } catch (err: any) {
      toast('error', 'Authentication Error', err.message || 'Incorrect email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#0f172a] font-sans relative overflow-hidden px-4 select-none">
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md relative z-20"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center shadow-sm overflow-hidden border border-purple-500/20">
            <img src="/logo.png" alt="DR Vault Logo" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight font-outfit text-white">DR Vault</h2>
          <p className="text-xs text-slate-400 mt-1 font-bold tracking-widest uppercase">Enterprise Document Resilience & Sync</p>
        </div>

        {/* Form Panel (Solid Dark layout matching register styles) */}
        <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-8 shadow-2xl">
          <h3 className="text-lg font-bold text-white font-outfit mb-6">Account Verification</h3>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-widest text-slate-350 uppercase">EMAIL ADDRESS</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0f172a]/55 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold tracking-widest text-slate-350 uppercase">PASSWORD</label>
                <Link to="/forgot-password" className="text-xs text-purple-400 hover:text-purple-300 font-bold transition-colors">
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0f172a]/55 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-3 text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-55 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying Credentials...
                </>
              ) : (
                <>
                  Access Vault <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-500 mt-6 font-semibold">
          New employee? Contact your system administrator to provision your credentials.
        </p>
      </motion.div>
    </div>
  );
};
export default Login;
