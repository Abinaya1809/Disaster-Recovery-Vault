import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../components/common/Toast';
import { TableSkeleton } from '../components/common/Skeleton';
import { 
  Trash2, 
  RotateCcw, 
  ShieldAlert, 
  FileClock, 
  Folder, 
  File, 
  Flame, 
  CheckCircle2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TrashFolders {
  id: string;
  name: string;
  createdAt: string;
}

interface TrashFiles {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  deletedAt: string;
}

interface RecoveryLog {
  id: string;
  type: 'FILE' | 'FOLDER';
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  restorePath: string;
  logSummary: string;
  createdAt: string;
  resolvedAt: string | null;
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

export const DisasterRecovery: React.FC = () => {
  const { toast } = useToast();
  
  // Navigation Tabs: 'trash' | 'logs'
  const [activeTab, setActiveTab] = useState<'trash' | 'logs'>('trash');
  
  // Trash Items state
  const [trashFolders, setTrashFolders] = useState<TrashFolders[]>([]);
  const [trashFiles, setTrashFiles] = useState<TrashFiles[]>([]);
  const [recoveryLogs, setRecoveryLogs] = useState<RecoveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchTrashAndLogs = async () => {
    setLoading(true);
    try {
      const trashRes = await api.get('/recovery/trash');
      setTrashFolders(trashRes.data.folders);
      setTrashFiles(trashRes.data.files);

      const logsRes = await api.get('/recovery/logs');
      setRecoveryLogs(logsRes.data);
    } catch (err) {
      toast('error', 'Fetch Failure', 'Could not load disaster recovery database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrashAndLogs();
  }, []);

  const handleRestore = async (id: string, type: 'file' | 'folder', name: string) => {
    setActionLoadingId(id);
    try {
      await api.post(`/recovery/restore/${id}`, { type });
      toast('success', 'Document Restored', `"${name}" has been successfully restored to the active workspace.`);
      fetchTrashAndLogs();
    } catch (err) {
      toast('error', 'Restoration Failed', 'Failed to recover file from S3 backups.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePurge = async (id: string, type: 'file' | 'folder', name: string) => {
    if (!confirm(`WARNING: This will permanently delete "${name}" from the database and physical S3 disks. This action CANNOT be undone. Proceed?`)) return;
    setActionLoadingId(id);
    try {
      await api.post(`/recovery/purge/${id}`, { type });
      toast('error', 'Item Purged', `"${name}" has been permanently purged from DR Vault.`);
      fetchTrashAndLogs();
    } catch (err) {
      toast('error', 'Purge Failed', 'Failed to purge item from S3 storage.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 font-sans p-4 select-none">
      
      {/* Page Headline */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight font-outfit text-[#111827] dark:text-[#f8fafc] flex items-center gap-2">
          <ShieldAlert className="w-7 h-7 text-purple-600 dark:text-purple-450" /> Disaster Recovery Center
        </h1>
        <p className="text-sm text-[#6b7280] dark:text-[#94a3b8] mt-1 font-medium">Manage soft-deleted items, roll back folder workspaces, and inspect restoration logs.</p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-2 border-b border-[#e2e8f0] dark:border-[#334155] pb-px">
        <button
          onClick={() => setActiveTab('trash')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'trash' 
              ? 'border-purple-600 text-purple-600 dark:border-purple-500 dark:text-purple-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          <Trash2 className="w-4 h-4" /> Recycler Trash ({trashFolders.length + trashFiles.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'logs' 
              ? 'border-purple-600 text-purple-600 dark:border-purple-500 dark:text-purple-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          <FileClock className="w-4 h-4" /> Restoration Audit Trails
        </button>
      </div>

      {/* Page Content */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="enterprise-card p-0 overflow-hidden">
          
          <AnimatePresence mode="wait">
            {/* TRASH TAB VIEW */}
            {activeTab === 'trash' && (
              <motion.div 
                key="trash-table"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-x-auto"
              >
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[#6b7280] dark:text-[#94a3b8] border-b border-[#e2e8f0] dark:border-[#334155] uppercase tracking-wider font-bold bg-[#f8fafc] dark:bg-[#0f172a]">
                      <th className="py-4 px-6">Deleted Element</th>
                      <th className="py-4 px-6 hidden sm:table-cell">Type</th>
                      <th className="py-4 px-6 hidden md:table-cell">Size</th>
                      <th className="py-4 px-6 hidden lg:table-cell">Deleted At</th>
                      <th className="py-4 px-6 text-right">Recovery Control</th>
                    </tr>
                  </thead>
                  <motion.tbody 
                    variants={listContainerVariants}
                    initial="hidden"
                    animate="show"
                  >
                    {trashFolders.length === 0 && trashFiles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-16 text-slate-500">
                          <div className="flex flex-col items-center gap-3">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            <p className="font-bold text-[#6b7280] dark:text-[#94a3b8]">Trash is empty. All active items secure.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {/* Trash folders */}
                        {trashFolders.map(folder => (
                          <motion.tr 
                            variants={rowVariants}
                            key={folder.id} 
                            className="border-b border-[#e2e8f0] dark:border-[#334155] text-[#111827] dark:text-[#f8fafc] hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-4 px-6 font-bold flex items-center gap-3">
                              <Folder className="w-5 h-5 text-slate-400 fill-slate-500/10" />
                              <span>{folder.name}</span>
                            </td>
                            <td className="py-4 px-6 hidden sm:table-cell text-slate-500">Directory</td>
                            <td className="py-4 px-6 hidden md:table-cell text-slate-500">—</td>
                            <td className="py-4 px-6 hidden lg:table-cell text-slate-500">—</td>
                            <td className="py-4 px-6 text-right space-x-2">
                              <button
                                onClick={() => handleRestore(folder.id, 'folder', folder.name)}
                                disabled={actionLoadingId !== null}
                                className="px-2.5 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#334155] hover:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-950/20 text-[#6b7280] dark:text-[#94a3b8] hover:text-purple-600 dark:hover:text-purple-400 transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Restore
                              </button>
                              <button
                                onClick={() => handlePurge(folder.id, 'folder', folder.name)}
                                disabled={actionLoadingId !== null}
                                className="px-2.5 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#334155] hover:border-rose-500/35 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[#6b7280] dark:text-[#94a3b8] hover:text-rose-600 dark:hover:text-rose-450 transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                              >
                                <Flame className="w-3.5 h-3.5" /> Purge
                              </button>
                            </td>
                          </motion.tr>
                        ))}

                        {/* Trash Files */}
                        {trashFiles.map(file => (
                          <motion.tr 
                            variants={rowVariants}
                            key={file.id} 
                            className="border-b border-[#e2e8f0] dark:border-[#334155] text-[#111827] dark:text-[#f8fafc] hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-4 px-6 font-bold flex items-center gap-3">
                              <File className="w-5 h-5 text-slate-400 fill-slate-500/10" />
                              <span className="truncate max-w-[200px]">{file.name}</span>
                            </td>
                            <td className="py-4 px-6 hidden sm:table-cell text-slate-500">
                              {file.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                            </td>
                            <td className="py-4 px-6 hidden md:table-cell text-[#6b7280] dark:text-[#94a3b8]">{formatSize(file.size)}</td>
                            <td className="py-4 px-6 hidden lg:table-cell text-slate-500">
                              {new Date(file.deletedAt).toLocaleDateString()}
                            </td>
                            <td className="py-4 px-6 text-right space-x-2">
                              <button
                                onClick={() => handleRestore(file.id, 'file', file.name)}
                                disabled={actionLoadingId !== null}
                                className="px-2.5 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#334155] hover:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-950/20 text-[#6b7280] dark:text-[#94a3b8] hover:text-purple-600 dark:hover:text-purple-400 transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Restore
                              </button>
                              <button
                                onClick={() => handlePurge(file.id, 'file', file.name)}
                                disabled={actionLoadingId !== null}
                                className="px-2.5 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#334155] hover:border-rose-500/35 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[#6b7280] dark:text-[#94a3b8] hover:text-rose-600 dark:hover:text-rose-450 transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                              >
                                <Flame className="w-3.5 h-3.5" /> Purge
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </>
                    )}
                  </motion.tbody>
                </table>
              </motion.div>
            )}

            {/* RESTORATION HISTORY TAB VIEW */}
            {activeTab === 'logs' && (
              <motion.div 
                key="logs-table"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-x-auto"
              >
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[#6b7280] dark:text-[#94a3b8] border-b border-[#e2e8f0] dark:border-[#334155] uppercase tracking-wider font-bold bg-[#f8fafc] dark:bg-[#0f172a]">
                      <th className="py-4 px-6">Timestamp</th>
                      <th className="py-4 px-6">Object Type</th>
                      <th className="py-4 px-6">Restore Path Target</th>
                      <th className="py-4 px-6 hidden md:table-cell">Restore Details</th>
                      <th className="py-4 px-6 text-right">AWS State</th>
                    </tr>
                  </thead>
                  <motion.tbody 
                    variants={listContainerVariants}
                    initial="hidden"
                    animate="show"
                  >
                    {recoveryLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-16 text-slate-500">No historical restorations logged.</td>
                      </tr>
                    ) : (
                      recoveryLogs.map(log => (
                        <motion.tr 
                          variants={rowVariants}
                          key={log.id} 
                          className="border-b border-[#e2e8f0] dark:border-[#334155] text-[#111827] dark:text-[#f8fafc] hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-4 px-6 font-medium text-slate-500">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="py-4 px-6 font-bold">
                            <span className={`px-2 py-0.5 rounded-md ${
                              log.type === 'FOLDER' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            }`}>
                              {log.type}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-mono font-medium truncate max-w-[200px]">{log.restorePath}</td>
                          <td className="py-4 px-6 hidden md:table-cell text-slate-500 leading-relaxed font-normal">{log.logSummary}</td>
                          <td className="py-4 px-6 text-right">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                              log.status === 'COMPLETED' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' 
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/25'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </motion.tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      )}

    </div>
  );
};
export default DisasterRecovery;
