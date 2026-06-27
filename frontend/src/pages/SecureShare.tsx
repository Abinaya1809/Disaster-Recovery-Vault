import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  FileCheck, 
  Download, 
  Key, 
  Lock, 
  AlertTriangle,
  Loader2,
  HardDrive
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SharedFileDetails {
  name: string;
  size: number;
  mimeType?: string;
}

export const SecureShare: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  // Landing states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<SharedFileDetails | null>(null);
  
  // Password validation states
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [validatingPass, setValidatingPass] = useState(false);

  const validateLink = async (passStr?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`/api/share/validate/${token}`, {
        password: passStr || null
      });

      if (res.data.isPasswordRequired) {
        setPasswordRequired(true);
      } else {
        setPasswordRequired(false);
        setFileDetails(res.data.file);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'This shared link has expired or is invalid.');
    } finally {
      setLoading(false);
      setValidatingPass(false);
    }
  };

  useEffect(() => {
    if (token) {
      validateLink();
    }
  }, [token]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setValidatingPass(true);
    validateLink(password);
  };

  const handleDownload = () => {
    if (!token) return;
    window.location.href = `/api/share/download/${token}${password ? `?pass=${encodeURIComponent(password)}` : ''}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#0f172a] font-sans relative overflow-hidden px-4 select-none">
      
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md relative z-20"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center shadow-sm">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight font-outfit text-white">DR Vault</h2>
          <p className="text-xs text-slate-400 mt-1 font-bold tracking-widest uppercase">Secure Shared File Distribution</p>
        </div>

        {/* Loading Spinner */}
        {loading && !validatingPass ? (
          <div className="glass-modal rounded-3xl p-12 flex flex-col items-center justify-center gap-4 border border-white/10 shadow-2xl">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            <p className="text-xs text-slate-450 font-bold tracking-widest uppercase">Validating security signatures...</p>
          </div>
        ) : error ? (
          
          /* Error State Panel */
          <div className="glass-modal rounded-3xl p-8 text-center space-y-4 border border-white/10 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-200 font-outfit">Link Inaccessible</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">{error}</p>
            <div className="text-[10px] text-slate-500 italic border-t border-white/5 pt-3">
              Check if retention periods expired or S3 links purged.
            </div>
          </div>
        ) : passwordRequired ? (

          /* Passcode Protected Form */
          <div className="glass-modal rounded-3xl p-8 shadow-2xl border border-white/10">
            <div className="text-center mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20 mb-3">
                <Key className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 font-outfit">Passcode Required</h3>
              <p className="text-xs text-slate-400 mt-1">This shared endpoint requires password verification.</p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-widest text-slate-300 uppercase">ENTER PASSCODE</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0f172a]/55 border border-white/10 rounded-xl px-4 py-3 text-sm text-center text-white placeholder-slate-600 tracking-widest focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={validatingPass}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 border border-white/10"
              >
                {validatingPass ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  'Access File Vault'
                )}
              </button>
            </form>
          </div>
        ) : (

          /* File Download Action Panel */
          <div className="glass-modal rounded-3xl p-8 text-center space-y-6 border border-white/10 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <FileCheck className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold font-outfit text-white truncate max-w-sm px-4">
                {fileDetails?.name}
              </h3>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <HardDrive className="w-4 h-4 text-slate-500" />
                {fileDetails ? formatSize(fileDetails.size) : '0 KB'}
              </span>
            </div>

            <div className="h-px bg-white/10" />

            <button
              onClick={handleDownload}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download File Payload
            </button>

            <p className="text-[10px] text-slate-500 italic">
              Downloads route securely through S3 AES decryption.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
export default SecureShare;
