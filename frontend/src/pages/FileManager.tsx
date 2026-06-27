import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useToast } from '../components/common/Toast';
import { Modal } from '../components/common/Modal';
import { TableSkeleton } from '../components/common/Skeleton';
import { 
  Folder, 
  File, 
  Upload, 
  Plus, 
  Search, 
  MoreVertical, 
  Download, 
  History, 
  Share2, 
  Trash2, 
  ChevronRight, 
  FolderPlus,
  RefreshCw,
  Key,
  Calendar,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

interface FileVersion {
  id: string;
  versionNumber: number;
  size: number;
  createdAt: string;
  createdBy: { email: string };
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  versions: Array<{ versionNumber: number; createdAt: string }>;
}

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
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

export const FileManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Directory Structure State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Search/Sort/Drag
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [dragActive, setDragActive] = useState(false);

  // Dropdowns/Actions Context
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modals States
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [newName, setNewName] = useState('');

  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string>('');

  const [versionsModalOpen, setVersionsModalOpen] = useState(false);
  const [versionsFile, setVersionsFile] = useState<FileItem | null>(null);
  const [versionsList, setVersionsList] = useState<FileVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [sharePassword, setSharePassword] = useState('');
  const [shareExpiry, setShareExpiry] = useState('1440'); // default 1 day (1440 mins)
  const [shareLink, setShareLink] = useState('');
  const [sharingLoading, setSharingLoading] = useState(false);

  // Load Directory Contents
  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const url = `/files/list?sort=${sort}${currentFolderId ? `&folderId=${currentFolderId}` : ''}${search ? `&search=${search}` : ''}`;
      const res = await api.get(url);
      setFolders(res.data.folders);
      setFiles(res.data.files);
      setBreadcrumbs(res.data.breadcrumbs || []);
    } catch (err) {
      toast('error', 'Fetch Error', 'Failed to retrieve directory listings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, [currentFolderId, sort]);

  // Execute Search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDirectory();
  };

  // Create Folder Action
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.post('/files/folder', {
        name: newFolderName,
        parentId: currentFolderId
      });
      toast('success', 'Folder Created', `Directory "${newFolderName}" created successfully.`);
      setNewFolderName('');
      setFolderModalOpen(false);
      fetchDirectory();
    } catch (err: any) {
      toast('error', 'Creation Failed', err.response?.data?.error || 'Failed to create folder.');
    }
  };

  // Upload file utility
  const uploadFiles = async (fileList: FileList) => {
    if (fileList.length === 0) return;
    
    toast('info', 'Backup Triggered', 'File upload initiated. Transferring replicas to AWS S3 vault...');
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const formData = new FormData();
      formData.append('file', file);
      if (currentFolderId) {
        formData.append('folderId', currentFolderId);
      }

      try {
        await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast('success', 'Backup Complete', `"${file.name}" synchronized to S3 storage bucket.`);
      } catch (err: any) {
        toast('error', 'Sync Failed', `Could not backup "${file.name}": ${err.response?.data?.error || 'Unknown error'}`);
      }
    }
    fetchDirectory();
  };

  // Download File securely (using token)
  const handleDownload = async (file: FileItem) => {
    try {
      toast('info', 'Downloading', `Fetching "${file.name}"...`);
      const response = await api.get(`/files/download/${file.id}`, {
        responseType: 'blob', // Important for downloading files
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      link.parentNode?.removeChild(link);
      
      toast('success', 'Download Complete', `"${file.name}" downloaded.`);
    } catch (err: any) {
      console.error(err);
      toast('error', 'Download Failed', 'Could not download the file.');
    }
  };

  // Drag and Drop Handling
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  // Rename Action
  const triggerRename = (id: string, name: string, type: 'file' | 'folder') => {
    setRenameTarget({ id, name, type });
    setNewName(name);
    setRenameModalOpen(true);
    setActiveMenuId(null);
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !newName.trim()) return;
    try {
      await api.put(`/files/rename/${renameTarget.id}`, {
        name: newName,
        type: renameTarget.type
      });
      toast('success', 'Item Renamed', `Successfully updated descriptor names.`);
      setRenameModalOpen(false);
      fetchDirectory();
    } catch (err) {
      toast('error', 'Rename Failed', 'Failed to save changes.');
    }
  };

  // Move Action
  const triggerMove = async (id: string, name: string, type: 'file' | 'folder') => {
    setMoveTarget({ id, name, type });
    setActiveMenuId(null);
    try {
      const res = await api.get('/files/list');
      const allDirs = res.data.folders.filter((f: FolderItem) => f.id !== id);
      setAllFolders(allDirs);
      setMoveModalOpen(true);
    } catch (err) {
      toast('error', 'Load Failed', 'Could not retrieve list of directories.');
    }
  };

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveTarget) return;
    try {
      await api.put(`/files/move/${moveTarget.id}`, {
        targetFolderId: targetFolderId || null,
        type: moveTarget.type
      });
      toast('success', 'Item Relocated', 'Successfully moved item across namespace.');
      setMoveModalOpen(false);
      setTargetFolderId('');
      fetchDirectory();
    } catch (err: any) {
      toast('error', 'Move Failed', err.response?.data?.error || 'Failed to complete movement.');
    }
  };

  // Soft Delete Action (Move to Trash)
  const handleDelete = async (id: string, type: 'file' | 'folder', name: string) => {
    if (!confirm(`Are you sure you want to move "${name}" to the Trash?`)) return;
    try {
      await api.post(`/files/delete/${id}`, { type });
      toast('warning', 'Moved to Trash', `"${name}" soft-deleted. Access from Disaster Recovery to restore.`);
      fetchDirectory();
    } catch (err) {
      toast('error', 'Deletion Failed', 'Failed to delete item.');
    }
  };

  // Load versions
  const triggerVersions = async (file: FileItem) => {
    setVersionsFile(file);
    setVersionsModalOpen(true);
    setVersionsLoading(true);
    setActiveMenuId(null);
    try {
      const res = await api.get(`/recovery/versions/${file.id}`);
      setVersionsList(res.data.versions);
    } catch (err) {
      toast('error', 'Failed to Load Versions', 'Could not connect to S3 database history.');
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleRestoreVersion = async (versionId: string, versionNumber: number) => {
    if (!versionsFile) return;
    if (!confirm(`Roll back file payload to Version ${versionNumber}?`)) return;
    try {
      await api.post(`/recovery/versions/${versionsFile.id}/rollback/${versionId}`);
      toast('success', 'Version Reclaimed', 'Reverted document version and synced new clone version.');
      setVersionsModalOpen(false);
      fetchDirectory();
    } catch (err) {
      toast('error', 'Rollback Failed', 'Failed to roll back S3 version.');
    }
  };

  // Share link generator
  const triggerShare = (file: FileItem) => {
    setShareFile(file);
    setShareLink('');
    setSharePassword('');
    setShareExpiry('1440');
    setShareModalOpen(true);
    setActiveMenuId(null);
  };

  const handleGenerateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareFile) return;
    setSharingLoading(true);
    try {
      const res = await api.post('/share', {
        fileId: shareFile.id,
        expiresInMinutes: shareExpiry ? parseInt(shareExpiry, 10) : null,
        password: sharePassword || null,
        allowDownload: true
      });
      const generatedLink = `${window.location.origin}/share/${res.data.token}`;
      setShareLink(generatedLink);
      toast('success', 'Shared Link Activated', 'Visitor portal token generated.');
    } catch (err) {
      toast('error', 'Sharing Failed', 'Could not publish file endpoint.');
    } finally {
      setSharingLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    toast('success', 'Copied to Clipboard', 'Link endpoint copied. Dispatch to colleagues.');
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 font-sans relative select-none" onDragEnter={handleDrag}>
      
      {/* Drag Overlay HUD */}
      <AnimatePresence>
        {dragActive && (
          <div 
            className="fixed inset-0 z-50 bg-[#0f172a]/80 border-4 border-dashed border-purple-500 m-4 rounded-3xl flex items-center justify-center pointer-events-auto"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Upload className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold font-outfit text-[#111827] dark:text-[#f8fafc]">Replicate to S3 Vault</h2>
              <p className="text-sm text-slate-500">Release mouse to sync documents immediately.</p>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Directory Headline */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-outfit text-[#111827] dark:text-[#f8fafc]">File Vault</h1>
          <p className="text-sm text-[#6b7280] dark:text-[#94a3b8] mt-1 font-medium">Upload documents and manage virtual file path hierarchies.</p>
        </div>

        {/* Directory Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFolderModalOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] transition-all text-xs font-bold flex items-center gap-2 text-slate-600 dark:text-slate-300"
          >
            <FolderPlus className="w-4 h-4 text-purple-600 dark:text-purple-400" /> New Folder
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-all text-xs font-bold flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Upload Document
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Filters & Sorting HUD */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-4 px-6 enterprise-card">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full enterprise-input rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none"
          />
        </form>

        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#6b7280] dark:text-[#94a3b8] font-bold">Sort by</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155] rounded-lg px-2.5 py-1 text-xs text-[#111827] dark:text-[#f8fafc] focus:outline-none"
            >
              <option value="name">Alpha Order</option>
              <option value="date">Date Uploaded</option>
              <option value="size">File Size</option>
            </select>
          </div>
          
          <button 
            onClick={fetchDirectory}
            className="p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-[#f8fafc] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Folders Breadcrumb Path HUD */}
      <div className="flex items-center gap-1.5 text-xs text-[#6b7280] dark:text-[#94a3b8] font-bold">
        <button 
          onClick={() => setCurrentFolderId(null)}
          className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          Root Vault
        </button>
        {breadcrumbs.map((crumb) => (
          <React.Fragment key={crumb.id}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <button
              onClick={() => setCurrentFolderId(crumb.id)}
              className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Directory Listings */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="enterprise-card p-0 overflow-visible">
          <div className="overflow-visible">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[#6b7280] dark:text-[#94a3b8] border-b border-[#e2e8f0] dark:border-[#334155] uppercase tracking-wider font-bold bg-[#f8fafc] dark:bg-[#0f172a]">
                  <th className="py-4 px-6">Name</th>
                  <th className="py-4 px-6 hidden sm:table-cell">Size</th>
                  <th className="py-4 px-6 hidden md:table-cell">Version</th>
                  <th className="py-4 px-6 hidden lg:table-cell">Modified At</th>
                  {user?.role === 'ADMIN' && (
                    <th className="py-4 px-6 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <motion.tbody 
                variants={listContainerVariants}
                initial="hidden"
                animate="show"
              >
                {folders.length === 0 && files.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'ADMIN' ? 5 : 4} className="text-center py-16 text-slate-500">
                      <div className="flex flex-col items-center gap-3">
                        <Upload className="w-8 h-8 text-slate-400" />
                        <p className="font-medium text-[#6b7280] dark:text-[#94a3b8]">No documents found in this directory.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Folders Loop */}
                    {folders.map((folder) => (
                      <motion.tr 
                        variants={rowVariants}
                        key={folder.id} 
                        className="border-b border-[#e2e8f0] dark:border-[#334155] text-[#111827] dark:text-[#f8fafc] hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
                      >
                        <td className="py-4 px-6 font-bold flex items-center gap-3">
                          <button 
                            onClick={() => setCurrentFolderId(folder.id)}
                            className="flex items-center gap-3 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                          >
                            <Folder className="w-5 h-5 text-amber-500 fill-amber-500/10" />
                            <span>{folder.name}</span>
                          </button>
                        </td>
                        <td className="py-4 px-6 hidden sm:table-cell text-slate-400">—</td>
                        <td className="py-4 px-6 hidden md:table-cell text-slate-400">—</td>
                        <td className="py-4 px-6 hidden lg:table-cell text-slate-400">
                          {new Date(folder.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6 text-right relative">
                          <button 
                            onClick={() => setActiveMenuId(activeMenuId === folder.id ? null : folder.id)}
                            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          
                          {activeMenuId === folder.id && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)} />
                              <div className="absolute right-6 mt-1 w-36 bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl shadow-xl z-40 p-1 flex flex-col">
                                <button 
                                  onClick={() => triggerRename(folder.id, folder.name, 'folder')}
                                  className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors font-medium"
                                >
                                  Rename
                                </button>
                                <button 
                                  onClick={() => triggerMove(folder.id, folder.name, 'folder')}
                                  className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors font-medium"
                                >
                                  Move folder
                                </button>
                                <button 
                                  onClick={() => handleDelete(folder.id, 'folder', folder.name)}
                                  className="w-full text-left px-2.5 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-rose-600 dark:text-rose-400 transition-colors font-medium"
                                >
                                  Move to Trash
                                </button>
                              </div>
                            </>
                          )}
                        </td>
                      </motion.tr>
                    ))}

                    {/* Files Loop */}
                    {files.map((file) => (
                      <motion.tr 
                        variants={rowVariants}
                        key={file.id} 
                        className="border-b border-[#e2e8f0] dark:border-[#334155] text-[#111827] dark:text-[#f8fafc] hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
                      >
                        <td className="py-4 px-6 font-bold flex items-center gap-3">
                          <File className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          <button 
                            onClick={() => handleDownload(file)}
                            className="truncate max-w-[200px] hover:text-purple-600 dark:hover:text-purple-400 hover:underline transition-colors cursor-pointer text-left"
                          >
                            {file.name}
                          </button>
                        </td>
                        <td className="py-4 px-6 hidden sm:table-cell text-[#6b7280] dark:text-[#94a3b8]">{formatSize(file.size)}</td>
                        <td className="py-4 px-6 hidden md:table-cell">
                          <span className="px-2 py-0.5 rounded-md bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155] font-bold text-[#6b7280] dark:text-[#94a3b8]">
                            v{file.versions[0]?.versionNumber || 1}
                          </span>
                        </td>
                        <td className="py-4 px-6 hidden lg:table-cell text-slate-500">
                          {new Date(file.updatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        {user?.role === 'ADMIN' && (
                          <td className="py-4 px-6 text-right relative">
                            <button 
                              onClick={() => setActiveMenuId(activeMenuId === file.id ? null : file.id)}
                              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeMenuId === file.id && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)} />
                                <div className="absolute right-6 mt-1 w-44 bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl shadow-xl z-40 p-1 flex flex-col">
                                  <button 
                                    onClick={() => handleDownload(file)}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2 font-medium"
                                  >
                                    <Download className="w-3.5 h-3.5" /> Download
                                  </button>
                                  <button 
                                    onClick={() => triggerVersions(file)}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2 font-medium"
                                  >
                                    <History className="w-3.5 h-3.5" /> Version History
                                  </button>
                                  <button 
                                    onClick={() => triggerShare(file)}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2 font-medium"
                                  >
                                    <Share2 className="w-3.5 h-3.5" /> Secure Share
                                  </button>
                                  <div className="h-px bg-[#e2e8f0] dark:bg-[#334155] my-1" />
                                  <button 
                                    onClick={() => triggerRename(file.id, file.name, 'file')}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors font-medium"
                                  >
                                    Rename file
                                  </button>
                                  <button 
                                    onClick={() => triggerMove(file.id, file.name, 'file')}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors font-medium"
                                  >
                                    Move file
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(file.id, 'file', file.name)}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-rose-600 dark:text-rose-400 transition-colors flex items-center gap-2 font-medium"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete File
                                  </button>
                                </div>
                              </>
                            )}
                          </td>
                        )}
                      </motion.tr>
                    ))}
                  </>
                )}
              </motion.tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE FOLDER MODAL */}
      <Modal isOpen={folderModalOpen} onClose={() => setFolderModalOpen(false)} title="Create Directory">
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400">FOLDER NAME</label>
            <input
              type="text"
              placeholder="e.g. Sales Invoices 2026"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full enterprise-input rounded-xl px-4 py-2.5 text-sm text-[#111827] dark:text-[#f8fafc]"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2.5 text-sm font-bold shadow-sm transition-all"
          >
            Create Folder
          </button>
        </form>
      </Modal>

      {/* RENAME MODAL */}
      <Modal isOpen={renameModalOpen} onClose={() => setRenameModalOpen(false)} title="Rename Item">
        <form onSubmit={handleRename} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400">NEW ASSIGNED NAME</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full enterprise-input rounded-xl px-4 py-2.5 text-sm text-[#111827] dark:text-[#f8fafc]"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2.5 text-sm font-bold shadow-sm transition-all"
          >
            Save Changes
          </button>
        </form>
      </Modal>

      {/* MOVE MODAL */}
      <Modal isOpen={moveModalOpen} onClose={() => setMoveModalOpen(false)} title={`Move "${moveTarget?.name}"`}>
        <form onSubmit={handleMove} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400">TARGET ROOT OR DIRECTORY</label>
            <select
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
              className="w-full enterprise-input rounded-xl px-4 py-2.5 text-sm text-[#111827] dark:text-[#f8fafc] bg-[#f8fafc] dark:bg-[#0f172a] focus:outline-none"
            >
              <option value="">/ (Root Vault)</option>
              {allFolders.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2.5 text-sm font-bold shadow-sm transition-all"
          >
            Relocate Item
          </button>
        </form>
      </Modal>

      {/* VERSION HISTORY MODAL */}
      <Modal isOpen={versionsModalOpen} onClose={() => setVersionsModalOpen(false)} title={`History: ${versionsFile?.name}`} size="lg">
        {versionsLoading ? (
          <div className="flex justify-center items-center py-10">
            <RefreshCw className="w-6 h-6 text-purple-600 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-[#6b7280] dark:text-[#94a3b8] font-medium">Roll back document payloads to historical points of S3 replications.</p>
            <div className="border border-[#e2e8f0] dark:border-[#334155] rounded-xl overflow-hidden bg-[#f8fafc] dark:bg-[#0f172a]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-[#e2e8f0] dark:border-[#334155] text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Version</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Uploaded By</th>
                    <th className="py-3 px-4">Date Replicated</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {versionsList.map((ver) => (
                    <tr key={ver.id} className="border-b border-[#e2e8f0] dark:border-[#334155] text-[#111827] dark:text-[#f8fafc] hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-bold">v{ver.versionNumber} {ver.versionNumber === versionsFile?.versions[0]?.versionNumber && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold ml-2">(Current)</span>}</td>
                      <td className="py-3 px-4">{formatSize(ver.size)}</td>
                      <td className="py-3 px-4 text-[#6b7280] dark:text-[#94a3b8]">{ver.createdBy?.email}</td>
                      <td className="py-3 px-4 text-[#6b7280] dark:text-[#94a3b8]">
                        {new Date(ver.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRestoreVersion(ver.id, ver.versionNumber)}
                          disabled={ver.versionNumber === versionsFile?.versions[0]?.versionNumber}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 hover:border-purple-500 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          Rollback
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* SECURE SHARING MODAL */}
      <Modal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} title="Generate Secure Shared Link">
        {shareLink ? (
          <div className="space-y-4">
            <div className="p-3 bg-purple-500/5 border border-purple-500/10 dark:bg-purple-950/20 dark:border-purple-800 rounded-xl flex items-center gap-3">
              <span className="text-xs text-[#111827] dark:text-[#f8fafc] truncate flex-grow font-mono">{shareLink}</span>
              <button 
                onClick={copyToClipboard}
                className="p-2 bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155] rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 italic">Dispatched logs register all incoming shared visits and downloads.</p>
            <button
              onClick={() => setShareModalOpen(false)}
              className="w-full bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white rounded-xl py-2.5 text-sm font-bold transition-all"
            >
              Close Panel
            </button>
          </div>
        ) : (
          <form onSubmit={handleGenerateShare} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400">OPTIONAL ACCESS PASSCODE</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Leave empty for public access"
                  value={sharePassword}
                  onChange={(e) => setSharePassword(e.target.value)}
                  className="w-full enterprise-input rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400">LINK RETENTION EXPIRY</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <select
                  value={shareExpiry}
                  onChange={(e) => setShareExpiry(e.target.value)}
                  className="w-full enterprise-input rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc] bg-[#f8fafc] dark:bg-[#0f172a] focus:outline-none"
                >
                  <option value="60">1 Hour</option>
                  <option value="1440">24 Hours (1 Day)</option>
                  <option value="10080">7 Days (1 Week)</option>
                  <option value="">Never Expire</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={sharingLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2.5 text-sm font-bold shadow-sm transition-all"
            >
              {sharingLoading ? 'Activating Token...' : 'Generate Shared Endpoint'}
            </button>
          </form>
        )}
      </Modal>

    </div>
  );
};
export default FileManager;
