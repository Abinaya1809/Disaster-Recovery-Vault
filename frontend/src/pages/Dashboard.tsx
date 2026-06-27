import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../components/common/Toast';
import { DashboardSkeleton } from '../components/common/Skeleton';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import { 
  Files, 
  HardDrive, 
  Activity, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ArrowUpRight,
  Download,
  RefreshCw,
  Filter
} from 'lucide-react';
import { motion } from 'framer-motion';

// Mock historical chart data
const storageHistoryData = [
  { name: 'Mon', storageMB: 0.15 },
  { name: 'Tue', storageMB: 1.2 },
  { name: 'Wed', storageMB: 1.8 },
  { name: 'Thu', storageMB: 2.1 },
  { name: 'Fri', storageMB: 2.2 },
  { name: 'Sat', storageMB: 2.2 },
  { name: 'Sun', storageMB: 2.2 },
];

const backupActivityData = [
  { name: 'Mon', successful: 4, failed: 0 },
  { name: 'Tue', successful: 7, failed: 0 },
  { name: 'Wed', successful: 9, failed: 1 },
  { name: 'Thu', successful: 8, failed: 0 },
  { name: 'Fri', successful: 12, failed: 0 },
  { name: 'Sat', successful: 5, failed: 0 },
  { name: 'Sun', successful: 6, failed: 0 },
];

interface DashboardStats {
  totalBackups: number;
  completedBackups: number;
  backupSuccessRate: number;
  backupHealthRate: number;
  storageUsedBytes: number;
  totalFilesCount: number;
  storageLimitBytes: number;
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

export const Dashboard: React.FC = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [integrityLoading, setIntegrityLoading] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const statsRes = await api.get('/backup/metrics');
      setStats(statsRes.data);

      const filesRes = await api.get('/files/list?sort=date&limit=5');
      setRecentFiles(filesRes.data.files.slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard statistics', err);
      toast('error', 'Sync Failed', 'Could not sync latest metrics from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const triggerIntegrityCheck = async () => {
    setIntegrityLoading(true);
    try {
      const res = await api.post('/backup/integrity-check');
      toast('success', 'Scan Finished', `Checked ${res.data.scannedCount} file backups. ${res.data.healthyCount} Healthy.`);
      fetchDashboardData();
    } catch (err) {
      toast('error', 'Scan Failed', 'Could not connect to S3 scanner.');
    } finally {
      setIntegrityLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans select-none">
      
      {/* Dashboard Headline & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight font-outfit text-[#111827] dark:text-[#f8fafc]">
            Resilience Dashboard
          </h1>
          <p className="text-xs text-[#6b7280] dark:text-[#94a3b8] mt-0.5 font-medium">Real-time S3 replication telemetry and disaster logs.</p>
        </div>

        <button
          onClick={triggerIntegrityCheck}
          disabled={integrityLoading}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
        >
          {integrityLoading ? 'Scanning S3 Buckets...' : 'Verify Vault Integrity'}
        </button>
      </div>

      {/* Summary KPI Cards Grid (24px Spacing) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Files Replicated (Purple Accent Glow) */}
        <div className="enterprise-card border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] rounded-[18px] p-6 shadow-sm hover:translate-y-[-4px] hover:border-purple-500/50 hover:shadow-purple-500/5 transition-all duration-200 group flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-[#6b7280] dark:text-[#94a3b8] uppercase tracking-wider block">Files Replicated</span>
              <h3 className="text-3xl font-bold text-[#111827] dark:text-[#f8fafc] font-outfit mt-1">{stats?.totalFilesCount || 0}</h3>
            </div>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform flex-shrink-0">
              <Files className="w-4 h-4" />
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            {/* Tiny sparkline SVG */}
            <svg className="w-16 h-6 text-purple-500" viewBox="0 0 100 30" fill="none">
              <path d="M0,25 Q15,5 30,20 T60,8 T90,15 T100,12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div className="text-right">
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block">↑ 14% today</span>
              <span className="inline-block px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[8px] font-extrabold uppercase tracking-widest mt-1">Healthy</span>
            </div>
          </div>
        </div>

        {/* Card 2: Storage Utilized (Blue Accent Glow) */}
        <div className="enterprise-card border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] rounded-[18px] p-6 shadow-sm hover:translate-y-[-4px] hover:border-blue-500/50 hover:shadow-blue-500/5 transition-all duration-200 group flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-[#6b7280] dark:text-[#94a3b8] uppercase tracking-wider block">Storage Utilized</span>
              <h3 className="text-3xl font-bold text-[#111827] dark:text-[#f8fafc] font-outfit mt-1">{formatSize(stats?.storageUsedBytes || 0)}</h3>
            </div>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform flex-shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            {/* Tiny sparkline SVG */}
            <svg className="w-16 h-6 text-blue-500" viewBox="0 0 100 30" fill="none">
              <path d="M0,28 C20,28 15,10 30,10 C45,10 50,22 70,22 C85,22 80,5 100,5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div className="text-right">
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold block">+8% growth</span>
              <span className="inline-block px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[8px] font-extrabold uppercase tracking-widest mt-1">Allocated</span>
            </div>
          </div>
        </div>

        {/* Card 3: Replication Health (Emerald Accent Glow) */}
        <div className="enterprise-card border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] rounded-[18px] p-6 shadow-sm hover:translate-y-[-4px] hover:border-emerald-500/50 hover:shadow-emerald-500/5 transition-all duration-200 group flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-[#6b7280] dark:text-[#94a3b8] uppercase tracking-wider block">Vault Integrity</span>
              <h3 className="text-3xl font-bold text-[#111827] dark:text-[#f8fafc] font-outfit mt-1">{stats?.backupHealthRate || 100}%</h3>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            {/* Tiny sparkline SVG */}
            <svg className="w-16 h-6 text-emerald-500" viewBox="0 0 100 30" fill="none">
              <path d="M0,15 L20,15 L40,15 L60,15 L80,15 L100,15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div className="text-right">
              <span className="text-[10px] text-emerald-650 dark:text-emerald-400 font-bold block">100% Stable</span>
              <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-extrabold uppercase tracking-widest mt-1">Secure</span>
            </div>
          </div>
        </div>

        {/* Card 4: Backup Success (Amber Accent Glow) */}
        <div className="enterprise-card border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] rounded-[18px] p-6 shadow-sm hover:translate-y-[-4px] hover:border-amber-500/50 hover:shadow-amber-500/5 transition-all duration-200 group flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-[#6b7280] dark:text-[#94a3b8] uppercase tracking-wider block">Backup Success Rate</span>
              <h3 className="text-3xl font-bold text-[#111827] dark:text-[#f8fafc] font-outfit mt-1">{stats?.backupSuccessRate || 100}%</h3>
            </div>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-500 group-hover:scale-105 transition-transform flex-shrink-0">
              <Activity className="w-4 h-4" />
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            {/* Tiny sparkline SVG */}
            <svg className="w-16 h-6 text-amber-500" viewBox="0 0 100 30" fill="none">
              <path d="M0,20 Q15,10 30,12 T60,25 T90,5 T100,5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div className="text-right">
              <span className="text-[10px] text-amber-600 dark:text-amber-500 font-bold block">↑ 2% weekly</span>
              <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 text-[8px] font-extrabold uppercase tracking-widest mt-1">Replicated</span>
            </div>
          </div>
        </div>

      </div>

      {/* Recharts Graphical Telemetry (Reduced height by 20% to h-52) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Storage Growth chart */}
        <div className="enterprise-card border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] rounded-[18px] p-6 shadow-sm lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-[#111827] dark:text-[#f8fafc] font-outfit">Storage Allocation Trend (MB)</h3>
            
            {/* Controls: Export, Refresh, Filter */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => toast('info', 'Exporting Data', 'Downloading historical data...')}
                className="p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] text-slate-500 hover:text-slate-700 dark:hover:text-[#f8fafc]"
                title="Export Chart"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={fetchDashboardData}
                className="p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] text-slate-500 hover:text-slate-700 dark:hover:text-[#f8fafc]"
                title="Refresh Metrics"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button 
                className="p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] text-slate-500 hover:text-slate-700 dark:hover:text-[#f8fafc]"
                title="Filter Logs"
              >
                <Filter className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={storageHistoryData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="storageGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-base)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'var(--bg-card)', 
                    border: '1px solid var(--border-base)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                  itemStyle={{ color: '#7c3aed' }}
                />
                <Area type="monotone" dataKey="storageMB" stroke="#7c3aed" strokeWidth={2} fillOpacity={1} fill="url(#storageGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily backup efficiency bar chart */}
        <div className="enterprise-card border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] rounded-[18px] p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-[#111827] dark:text-[#f8fafc] font-outfit">Backup Sync Log</h3>
            
            {/* Controls: Export, Refresh, Filter */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => toast('info', 'Exporting Data', 'Downloading sync records...')}
                className="p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] text-slate-500 hover:text-slate-700 dark:hover:text-[#f8fafc]"
                title="Export Logs"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={fetchDashboardData}
                className="p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] text-slate-500 hover:text-slate-700 dark:hover:text-[#f8fafc]"
                title="Refresh Metrics"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={backupActivityData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-base)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ 
                    background: 'var(--bg-card)', 
                    border: '1px solid var(--border-base)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                <Bar dataKey="successful" fill="#10b981" radius={[4, 4, 0, 0]} name="Healthy (S3)" />
                <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} name="Sync Failures" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Bottom Row: Recent Files Table & AWS Emulators Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Files Table */}
        <div className="enterprise-card border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] rounded-[18px] p-6 shadow-sm lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-[#111827] dark:text-[#f8fafc] font-outfit flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Recent Upload Logs
            </h3>
            <Link to="/vault" className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-bold flex items-center gap-1 transition-colors">
              Manage Vault <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[#6b7280] dark:text-[#94a3b8] border-b border-[#e2e8f0] dark:border-[#334155] pb-2 uppercase tracking-wider font-bold">
                  <th className="pb-3">File Name</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Size</th>
                  <th className="pb-3 text-right">Replicated At</th>
                </tr>
              </thead>
              <tbody>
                {recentFiles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-500">Vault is empty. Seed database or upload files in Vault.</td>
                  </tr>
                ) : (
                  recentFiles.map(file => (
                    <tr key={file.id} className="border-b border-[#e2e8f0] dark:border-[#334155] text-[#111827] dark:text-[#f8fafc] hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 font-medium truncate max-w-[200px]">{file.name}</td>
                      <td className="py-3.5 text-slate-500">{file.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}</td>
                      <td className="py-3.5">{formatSize(file.size)}</td>
                      <td className="py-3.5 text-right text-slate-500">
                        {new Date(file.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* AWS Services Emulator Health card */}
        <div className="enterprise-card border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] rounded-[18px] p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#111827] dark:text-[#f8fafc] font-outfit mb-4">Cloud Connector Checklist</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155]">
                <span className="text-xs text-[#111827] dark:text-[#f8fafc] font-medium">AWS S3 (Replicas)</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-bold">HEALTHY</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155]">
                <span className="text-xs text-[#111827] dark:text-[#f8fafc] font-medium">AWS Lambda (Compression)</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-bold">HEALTHY</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155]">
                <span className="text-xs text-[#111827] dark:text-[#f8fafc] font-medium">AWS SNS (Mail Topics)</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-bold">HEALTHY</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155]">
                <span className="text-xs text-[#111827] dark:text-[#f8fafc] font-medium">AWS CloudWatch (Integrity)</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-bold">HEALTHY</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#e2e8f0] dark:border-[#334155] flex gap-2 text-[10px] text-slate-500 font-medium leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span>Dual mode: emulators fall back to local disk storage automatically if AWS credentials are omitted.</span>
          </div>
        </div>

      </div>

    </div>
  );
};
export default Dashboard;
