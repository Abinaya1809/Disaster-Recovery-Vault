import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  Sun, 
  Moon, 
  Database,
  Cloud,
  FileClock,
  AlertTriangle,
  Share2,
  Check
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'BACKUP' | 'RECOVERY' | 'STORAGE_WARNING' | 'SECURITY_ALERT' | 'SHARE';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [storageStats, setStorageStats] = useState({
    storageUsedBytes: 154200 + 2048500 + 4500,
    storageLimitBytes: 5 * 1024 * 1024 * 1024
  });

  // Load and apply theme from local storage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  // Fetch notifications & storage stats
  const fetchHeaderData = async () => {
    if (!user) return;
    try {
      const notifRes = await api.get('/auth/notifications');
      setNotifications(notifRes.data);

      const statsRes = await api.get('/backup/metrics');
      setStorageStats({
        storageUsedBytes: statsRes.data.storageUsedBytes,
        storageLimitBytes: statsRes.data.storageLimitBytes
      });
    } catch (err) {
      console.warn('Failed to load header data', err);
    }
  };

  useEffect(() => {
    fetchHeaderData();
    const interval = setInterval(fetchHeaderData, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const markAllRead = async () => {
    try {
      await api.post('/auth/notifications/read');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark notifications read', err);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'BACKUP': return <Cloud className="w-4 h-4 text-emerald-500" />;
      case 'RECOVERY': return <FileClock className="w-4 h-4 text-purple-500" />;
      case 'SECURITY_ALERT': return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'SHARE': return <Share2 className="w-4 h-4 text-sky-500" />;
      default: return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const storagePercentage = Math.min(
    100,
    Math.max(1, Math.round((storageStats.storageUsedBytes / storageStats.storageLimitBytes) * 100))
  );

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex h-screen w-screen bg-[#f8fafc] text-[#111827] dark:bg-[#0f172a] dark:text-[#f8fafc] overflow-hidden">
      
      {/* Solid Enterprise Sidebar (supports collapse) */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Main Workspace Frame */}
      <div className="flex-grow flex flex-col min-w-0 h-full relative">
        
        {/* Upper Header Navbar (Reduced height to 64px - h-16) */}
        <header className="h-16 navbar-panel flex items-center justify-between px-6 z-40 sticky top-0">
          <div>
            <h2 className="text-sm font-bold font-outfit text-[#111827] dark:text-[#f8fafc]">
              Resilience Command
            </h2>
            <p className="text-[10px] text-[#6b7280] dark:text-[#94a3b8] font-medium leading-none mt-0.5">DR Vault Online</p>
          </div>

          <div className="flex items-center gap-6">
            
            {/* Storage Progress Space Indicator */}
            <div className="hidden lg:flex flex-col gap-1 w-44 text-xs">
              <div className="flex justify-between text-[9px] font-bold text-[#6b7280] dark:text-[#94a3b8] tracking-wider uppercase">
                <span className="flex items-center gap-1"><Database className="w-3 h-3 text-[#6b7280] dark:text-[#94a3b8]" /> Space</span>
                <span>{formatSize(storageStats.storageUsedBytes)} / 5 GB</span>
              </div>
              <div className="w-full h-1.5 bg-[#e2e8f0] dark:bg-[#334155] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-600 dark:bg-purple-500 transition-all duration-300" 
                  style={{ width: `${storagePercentage}%` }}
                />
              </div>
            </div>

            {/* Dark / Light Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] transition-all text-[#6b7280] dark:text-[#94a3b8] hover:text-[#111827] dark:hover:text-[#f8fafc]"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* Notifications Bell Button */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] transition-all text-[#6b7280] dark:text-[#94a3b8] hover:text-[#111827] dark:hover:text-[#f8fafc] relative"
              >
                <Bell className="w-3.5 h-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500 ring-2 ring-[#ffffff] dark:ring-[#1e293b]" />
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-3 w-80 bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-2xl shadow-xl z-50 p-4 flex flex-col gap-3 max-h-96 overflow-hidden glass-modal"
                    >
                      <div className="flex justify-between items-center border-b border-[#e2e8f0] dark:border-[#334155] pb-2">
                        <h4 className="text-xs font-bold text-[#111827] dark:text-[#f8fafc] font-outfit">Security Alerts ({unreadCount})</h4>
                        {unreadCount > 0 && (
                          <button 
                            onClick={markAllRead} 
                            className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline transition-colors flex items-center gap-0.5 font-bold"
                          >
                            <Check className="w-3.5 h-3.5" /> Mark read
                          </button>
                        )}
                      </div>

                      <div className="overflow-y-auto flex flex-col gap-2.5 pr-1">
                        {notifications.length === 0 ? (
                          <div className="text-center py-6 text-xs text-[#6b7280] dark:text-[#94a3b8]">No active alerts recorded.</div>
                        ) : (
                          notifications.map(n => (
                            <div 
                              key={n.id} 
                              className={`p-2.5 rounded-xl border text-xs flex gap-2.5 transition-colors ${
                                n.isRead 
                                  ? 'bg-transparent border-transparent text-[#6b7280] dark:text-[#94a3b8]' 
                                  : 'bg-purple-500/5 border-purple-500/10 dark:bg-purple-500/10 dark:border-purple-500/20 text-[#111827] dark:text-[#f8fafc]'
                              }`}
                            >
                              <div className="mt-0.5">{getAlertIcon(n.type)}</div>
                              <div>
                                <h5 className="font-bold">{n.title}</h5>
                                <p className="text-[10px] text-[#6b7280] dark:text-[#94a3b8] mt-0.5 leading-relaxed font-normal">{n.message}</p>
                                <span className="text-[9px] text-[#6b7280] dark:text-[#94a3b8] block mt-1 font-normal">
                                  {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            {/* User Profile avatar */}
            <div className="w-8 h-8 rounded-full bg-purple-600/10 dark:bg-purple-500/10 border border-purple-600/20 dark:border-purple-500/25 flex items-center justify-center font-outfit text-xs font-bold text-purple-600 dark:text-purple-400">
              {user?.email[0].toUpperCase()}
            </div>

          </div>
        </header>

        {/* Scrollable Workspace (Reduced padding to px-6 py-6 to reduce whitespace) */}
        <main className="flex-grow overflow-y-auto px-6 py-6 bg-[#f8fafc] dark:bg-[#0f172a]">
          {children}
        </main>
      </div>
    </div>
  );
};
export default Layout;
