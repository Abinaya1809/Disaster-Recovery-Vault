import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../components/common/Toast';
import { TableSkeleton } from '../components/common/Skeleton';
import { 
  Users, 
  History, 
  Activity, 
  FileSpreadsheet, 
  UserX, 
  UserCheck, 
  Server, 
  Search,
  Shield,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SystemStats {
  userCount: number;
  activeUserCount: number;
  fileCount: number;
  deletedFileCount: number;
  backupsCount: number;
  backupSuccessRate: number;
  recoveryCount: number;
  recoverySuccessRate: number;
  health: {
    s3Connection: string;
    snsConnection: string;
    lambdaStatus: string;
    lambdaAvgDurationMs: number;
    cloudWatchStatus: string;
    storageLimitBytes: number;
    currentStorageBytes: number;
  };
}

interface UserItem {
  id: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  isActive: boolean;
  createdAt: string;
}

interface AuditItem {
  id: string;
  action: 'LOGIN' | 'LOGOUT' | 'UPLOAD' | 'DOWNLOAD' | 'DELETE' | 'RESTORE' | 'SHARE' | 'ADMIN_ACTION';
  details: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { email: string } | null;
}

const listContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03
    }
  }
};

const rowVariants = {
  hidden: { opacity: 0, y: 5 },
  show: { opacity: 1, y: 0, transition: { duration: 0.15 } }
};

export const AdminPanel: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'users' | 'audits'>('users');
  
  // Dashboard states
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [auditsList, setAuditsList] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search/Filters
  const [auditSearch, setAuditSearch] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchAdminData = async () => {
    try {
      const statsRes = await api.get('/admin/stats');
      setStats(statsRes.data);

      const usersRes = await api.get('/admin/users');
      setUsersList(usersRes.data);

      const auditsRes = await api.get('/admin/audits');
      setAuditsList(auditsRes.data);
    } catch (err) {
      toast('error', 'Sync Failed', 'Could not sync administrative records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const toggleStatus = async (id: string, currentStatus: boolean, email: string) => {
    if (actionLoadingId) return;
    if (!confirm(`Are you sure you want to ${currentStatus ? 'SUSPEND' : 'REACTIVATE'} employee: "${email}"?`)) return;

    setActionLoadingId(id);
    try {
      await api.put(`/admin/users/${id}/status`, { isActive: !currentStatus });
      toast('success', 'Status Changed', `Successfully updated employee profile status.`);
      fetchAdminData();
    } catch (err: any) {
      toast('error', 'Status Toggle Failed', err.response?.data?.error || 'Failed to update user.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Helper to format bytes
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Triggers browser download links
  const triggerCSVDownload = (endpoint: string, fileName: string) => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    toast('info', 'Generating Report', 'Compiling database and generating CSV files...');
    
    fetch(`/api/${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast('success', 'Download Complete', 'CSV report saved successfully.');
    })
    .catch(() => {
      toast('error', 'Export Failed', 'Failed to generate report.');
    });
  };

  const filteredAudits = auditsList.filter(log => {
    const searchLower = auditSearch.toLowerCase();
    const email = log.user?.email.toLowerCase() || 'system';
    const details = log.details.toLowerCase();
    const action = log.action.toLowerCase();
    return email.includes(searchLower) || details.includes(searchLower) || action.includes(searchLower);
  });

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse p-4">
        <div className="h-7 w-48 bg-[#e2e8f0] dark:bg-[#334155] rounded-md" />
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans p-4 select-none">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-outfit text-[#111827] dark:text-[#f8fafc] flex items-center gap-2">
            <Shield className="w-7 h-7 text-purple-600 dark:text-purple-450" /> Admin Command Center
          </h1>
          <p className="text-sm text-[#6b7280] dark:text-[#94a3b8] mt-1 font-medium">Corporate control panel, employee privileges, CSV exports, and audit trails.</p>
        </div>

        {/* Export Reports Buttons */}
        <div className="flex gap-2.5">
          <button
            onClick={() => triggerCSVDownload('admin/export/audits', 'dr-vault-audit-logs.csv')}
            className="px-4 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] text-xs font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Export Audit CSV
          </button>
          <button
            onClick={() => triggerCSVDownload('admin/export/storage', 'dr-vault-storage-report.csv')}
            className="px-4 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] text-xs font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center gap-2"
          >
            <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Export Storage CSV
          </button>
        </div>
      </div>

      {/* Admin KPI stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI 1 */}
        <div className="enterprise-card flex items-center gap-4 elevated-card-hover">
          <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#6b7280] dark:text-[#94a3b8] uppercase tracking-wider block">Staff Accounts</span>
            <h4 className="text-2xl font-bold font-outfit text-[#111827] dark:text-[#f8fafc]">{stats?.activeUserCount} / {stats?.userCount}</h4>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="enterprise-card flex items-center gap-4 elevated-card-hover">
          <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#6b7280] dark:text-[#94a3b8] uppercase tracking-wider block">S3 Allocated Space</span>
            <h4 className="text-2xl font-bold font-outfit text-[#111827] dark:text-[#f8fafc]">{formatSize(stats?.health.currentStorageBytes || 0)}</h4>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="enterprise-card flex items-center gap-4 elevated-card-hover">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#6b7280] dark:text-[#94a3b8] uppercase tracking-wider block">S3 Sync Rate</span>
            <h4 className="text-2xl font-bold font-outfit text-[#111827] dark:text-[#f8fafc]">{stats?.backupSuccessRate}%</h4>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="enterprise-card flex items-center gap-4 elevated-card-hover">
          <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-450 rounded-xl">
            <History className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#6b7280] dark:text-[#94a3b8] uppercase tracking-wider block">Total Recovery Requests</span>
            <h4 className="text-2xl font-bold font-outfit text-[#111827] dark:text-[#f8fafc]">{stats?.recoveryCount}</h4>
          </div>
        </div>

      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#e2e8f0] dark:border-[#334155] pb-px">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'users' 
              ? 'border-purple-600 text-purple-600 dark:border-purple-500 dark:text-purple-400 font-bold' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          <Users className="w-4 h-4" /> Manage Staff Accounts ({usersList.length})
        </button>
        <button
          onClick={() => setActiveTab('audits')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'audits' 
              ? 'border-purple-600 text-purple-600 dark:border-purple-500 dark:text-purple-400 font-bold' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          <History className="w-4 h-4" /> Company Audit Logs ({auditsList.length})
        </button>
      </div>

      {/* Listings Grid */}
      <div className="enterprise-card p-0 overflow-hidden">
        
        <AnimatePresence mode="wait">
          {/* USERS TAB */}
          {activeTab === 'users' && (
            <motion.div 
              key="users-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-x-auto"
            >
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[#6b7280] dark:text-[#94a3b8] border-b border-[#e2e8f0] dark:border-[#334155] uppercase tracking-wider font-bold bg-[#f8fafc] dark:bg-[#0f172a]">
                    <th className="py-4 px-6">Staff Profile</th>
                    <th className="py-4 px-6">Role</th>
                    <th className="py-4 px-6 hidden sm:table-cell">Created At</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Controls</th>
                  </tr>
                </thead>
                <motion.tbody 
                  variants={listContainerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {usersList.map((user) => (
                    <motion.tr 
                      variants={rowVariants}
                      key={user.id} 
                      className="border-b border-[#e2e8f0] dark:border-[#334155] text-[#111827] dark:text-[#f8fafc] hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-4 px-6 font-bold">{user.email}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          user.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-6 hidden sm:table-cell text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          user.isActive 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' 
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/25'
                        }`}>
                          {user.isActive ? 'ACTIVE' : 'SUSPENDED'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => toggleStatus(user.id, user.isActive, user.email)}
                          disabled={actionLoadingId === user.id}
                          className={`px-2.5 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#334155] text-[10px] font-bold transition-all inline-flex items-center gap-1 ${
                            user.isActive 
                              ? 'hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400' 
                              : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {user.isActive ? (
                            <>
                              <UserX className="w-3.5 h-3.5" /> Suspend
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" /> Activate
                            </>
                          )}
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </motion.div>
          )}

          {/* AUDITS TAB */}
          {activeTab === 'audits' && (
            <motion.div 
              key="audits-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              
              {/* Search Input for audits */}
              <div className="p-4 bg-[#f8fafc] dark:bg-[#0f172a] border-b border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between gap-4">
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filter logs by details/email/action..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="w-full enterprise-input rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none"
                  />
                </div>
                <span className="text-xs text-[#6b7280] dark:text-[#94a3b8] font-bold">Showing {filteredAudits.length} entries</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[#6b7280] dark:text-[#94a3b8] border-b border-[#e2e8f0] dark:border-[#334155] uppercase tracking-wider font-bold bg-[#f8fafc] dark:bg-[#0f172a]">
                      <th className="py-4 px-6">Timestamp</th>
                      <th className="py-4 px-6">User Email</th>
                      <th className="py-4 px-6">Action</th>
                      <th className="py-4 px-6 hidden sm:table-cell">Details</th>
                      <th className="py-4 px-6 text-right">IP Address</th>
                    </tr>
                  </thead>
                  <motion.tbody 
                    variants={listContainerVariants}
                    initial="hidden"
                    animate="show"
                  >
                    {filteredAudits.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-16 text-slate-500">No matching audit logs found.</td>
                      </tr>
                    ) : (
                      filteredAudits.map((log) => (
                        <motion.tr 
                          variants={rowVariants}
                          key={log.id} 
                          className="border-b border-[#e2e8f0] dark:border-[#334155] text-[#111827] dark:text-[#f8fafc] hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-4 px-6 font-medium text-[#6b7280] dark:text-[#94a3b8]">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="py-4 px-6 font-bold">{log.user?.email || 'SYSTEM'}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider border ${
                              log.action === 'LOGIN' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' :
                              log.action === 'DELETE' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/25' :
                              log.action === 'RESTORE' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-405 border-blue-500/25' :
                              log.action === 'SHARE' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25' :
                              log.action === 'ADMIN_ACTION' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="py-4 px-6 hidden sm:table-cell text-[#6b7280] dark:text-[#94a3b8] max-w-[280px] truncate leading-relaxed font-normal">
                            {log.details}
                          </td>
                          <td className="py-4 px-6 text-right font-mono text-slate-500">
                            {log.ipAddress || '127.0.0.1'}
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </motion.tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

    </div>
  );
};
export default AdminPanel;
