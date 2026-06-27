import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../components/common/Toast';
import { Modal } from '../components/common/Modal';
import { TableSkeleton } from '../components/common/Skeleton';
import { 
  Users, 
  UserCheck, 
  UserX, 
  ShieldAlert, 
  Database, 
  Clock, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Plus, 
  MoreVertical, 
  Key, 
  Trash2, 
  Edit, 
  Shield, 
  Eye, 
  Check, 
  X,
  Copy,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface User {
  id: string;
  employeeId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  department: string | null;
  designation: string | null;
  role: 'ADMIN' | 'EMPLOYEE';
  status: string;
  storageLimit: number;
  profileImage: string | null;
  lastLogin: string | null;
  createdAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  details: string;
  createdAt: string;
}

interface UserDetailsStats {
  filesCount: number;
  recoveryCount: number;
  storageUsedBytes: number;
  recentLogs: AuditLog[];
  filesList: Array<{ id: string; name: string; size: number; mimeType: string; createdAt: string }>;
  recoveryList: Array<{ id: string; restorePath: string; status: string; createdAt: string }>;
}

export const UserManagement: React.FC = () => {
  const { toast } = useToast();

  // State Management
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering & Pagination
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsersCount, setTotalUsersCount] = useState(0);

  // Summary Metrics
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    admins: 0,
    storageUsedBytes: 0,
    lastCreatedEmail: 'N/A'
  });

  // Action Menu Popups
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);

  // Modals & Forms
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [tempPasswordShow, setTempPasswordShow] = useState('');

  // Form State
  const [formUser, setFormUser] = useState({
    id: '',
    firstName: '',
    lastName: '',
    employeeId: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    storageLimit: 5120, // 5GB
    password: '',
    generatePassword: true,
    sendWelcomeEmail: false
  });

  // User details Side Drawer
  const [drawerUser, setDrawerUser] = useState<User | null>(null);
  const [drawerStats, setDrawerStats] = useState<UserDetailsStats | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Load Users List & Metrics
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users', {
        params: {
          search,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
          department: deptFilter || undefined,
          sortBy,
          sortOrder,
          page,
          limit: 10
        }
      });
      setUsers(res.data.users);
      setTotalPages(res.data.pagination.totalPages);
      setTotalUsersCount(res.data.pagination.total);

      // Fetch admin stats to calculate summary
      const statsRes = await api.get('/admin/stats');
      const allUsers = await api.get('/users?limit=100'); // helper to calculate
      const list: User[] = allUsers.data.users;

      const total = list.length;
      const active = list.filter(u => u.status === 'ACTIVE').length;
      const inactive = list.filter(u => u.status !== 'ACTIVE').length;
      const admins = list.filter(u => u.role === 'ADMIN').length;
      const latest = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      setSummary({
        total,
        active,
        inactive,
        admins,
        storageUsedBytes: statsRes.data.health.currentStorageBytes || 0,
        lastCreatedEmail: latest ? latest.email : 'N/A'
      });
    } catch (err) {
      toast('error', 'Fetch Failure', 'Failed to retrieve corporate employees directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, statusFilter, deptFilter, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  // Create User Action
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUser.email) return;

    try {
      const res = await api.post('/users', {
        ...formUser,
        storageLimit: parseInt(formUser.storageLimit as any, 10)
      });

      toast('success', 'User Created', `Employee ${formUser.email} has been provisioned successfully.`);
      setCreateModalOpen(false);
      
      if (res.data.temporaryPassword) {
        setTempPasswordShow(res.data.temporaryPassword);
        setResetModalOpen(true);
      }
      
      fetchUsers();
    } catch (err: any) {
      toast('error', 'Provisioning Failed', err.response?.data?.error || 'Failed to create user.');
    }
  };

  // Edit User Action
  const triggerEdit = (user: User) => {
    setFormUser({
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      employeeId: user.employeeId,
      email: user.email,
      phone: user.phone || '',
      department: user.department || '',
      designation: user.designation || '',
      role: user.role,
      status: user.status,
      storageLimit: user.storageLimit,
      password: '',
      generatePassword: false,
      sendWelcomeEmail: false
    });
    setEditModalOpen(true);
    setActiveMenuUserId(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/users/${formUser.id}`, {
        ...formUser,
        storageLimit: parseInt(formUser.storageLimit as any, 10)
      });
      toast('success', 'Profile Updated', 'Employee details modified successfully.');
      setEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast('error', 'Update Failed', err.response?.data?.error || 'Failed to update employee details.');
    }
  };

  // Delete User Action
  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to permanently delete user "${email}"? This will drop their folder tree and active sync configurations.`)) return;
    try {
      await api.delete(`/users/${id}`);
      toast('warning', 'User Purged', `Corporate account "${email}" has been purged.`);
      fetchUsers();
    } catch (err: any) {
      toast('error', 'Deletion Failed', err.response?.data?.error || 'Failed to delete user.');
    } finally {
      setActiveMenuUserId(null);
    }
  };

  // Toggle Active Status Action
  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.patch('/users/status', { userId: id, status: nextStatus });
      toast('success', 'Status Toggled', `Employee status shifted to ${nextStatus}.`);
      fetchUsers();
    } catch (err: any) {
      toast('error', 'Status Toggle Failed', err.response?.data?.error || 'Failed to change status.');
    } finally {
      setActiveMenuUserId(null);
    }
  };

  // Promote / Demote Role Action
  const handleRoleChange = async (id: string, currentRole: 'ADMIN' | 'EMPLOYEE') => {
    const nextRole = currentRole === 'ADMIN' ? 'EMPLOYEE' : 'ADMIN';
    if (!confirm(`Shift privileges of this account to ${nextRole}?`)) return;
    try {
      await api.put(`/users/${id}`, { role: nextRole });
      toast('success', 'Privileges Shifted', `Account upgraded to ${nextRole} privileges.`);
      fetchUsers();
    } catch (err: any) {
      toast('error', 'Upgrade Failed', err.response?.data?.error || 'Failed to update role.');
    } finally {
      setActiveMenuUserId(null);
    }
  };

  // Reset Password Action
  const handlePasswordReset = async (id: string) => {
    if (!confirm('Are you sure you want to generate a new temporary password for this user?')) return;
    try {
      const res = await api.patch('/users/reset-password', { userId: id });
      setTempPasswordShow(res.data.temporaryPassword);
      setResetModalOpen(true);
      toast('success', 'Password Generated', 'New temporary password created successfully.');
    } catch (err: any) {
      toast('error', 'Reset Failed', 'Failed to generate temporary password.');
    } finally {
      setActiveMenuUserId(null);
    }
  };

  // Open Detailed User side drawer
  const openUserDrawer = async (user: User) => {
    setDrawerUser(user);
    setDrawerLoading(true);
    try {
      const res = await api.get(`/users/${user.id}`);
      setDrawerStats(res.data.stats);
    } catch (err) {
      toast('error', 'Stats Load Failed', 'Could not sync S3 details for user drawer.');
    } finally {
      setDrawerLoading(false);
    }
  };

  // Export visible list to CSV
  const handleCSVExport = () => {
    try {
      const headers = ['Employee ID', 'Full Name', 'Email', 'Phone', 'Department', 'Designation', 'Role', 'Status', 'Storage Limit (MB)', 'Created At'];
      const rows = users.map(u => [
        u.employeeId,
        `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        u.email,
        u.phone || '',
        u.department || '',
        u.designation || '',
        u.role,
        u.status,
        u.storageLimit,
        new Date(u.createdAt).toLocaleDateString()
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `dr-vault-employees-list.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast('success', 'Report Generated', 'CSV export saved to downloads.');
    } catch (err) {
      toast('error', 'CSV Export Failed', 'Could not export employee data.');
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(tempPasswordShow);
    toast('success', 'Copied to Clipboard', 'Password copied. Forward securely to employee.');
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 font-sans relative select-none">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight font-outfit text-[#111827] dark:text-[#f8fafc]">👥 User Management</h1>
          <p className="text-xs text-[#6b7280] dark:text-[#94a3b8] mt-0.5 font-medium">Provision employee accounts, manage departmental permissions, and run storage limits audits.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCSVExport}
            className="px-4 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] text-xs font-bold text-slate-600 dark:text-slate-350 transition-all flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          
          <button
            onClick={() => {
              setFormUser({
                id: '',
                firstName: '',
                lastName: '',
                employeeId: '',
                email: '',
                phone: '',
                department: '',
                designation: '',
                role: 'EMPLOYEE',
                status: 'ACTIVE',
                storageLimit: 5120,
                password: '',
                generatePassword: true,
                sendWelcomeEmail: false
              });
              setCreateModalOpen(true);
            }}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Create User
          </button>
        </div>
      </div>

      {/* Corporate Summary Metrics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        
        <div className="enterprise-card border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] p-4 rounded-[18px]">
          <span className="text-[9px] font-bold text-[#6b7280] dark:text-[#94a3b8] uppercase tracking-wider block">Total Staff</span>
          <h4 className="text-2xl font-bold font-outfit text-[#111827] dark:text-[#f8fafc] mt-1">{summary.total}</h4>
        </div>

        <div className="enterprise-card border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] p-4 rounded-[18px]">
          <span className="text-[9px] font-bold text-[#6b7280] dark:text-[#94a3b8] uppercase tracking-wider block">Active Users</span>
          <h4 className="text-2xl font-bold font-outfit text-emerald-600 dark:text-emerald-450 mt-1">{summary.active}</h4>
        </div>

        <div className="enterprise-card border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] p-4 rounded-[18px]">
          <span className="text-[9px] font-bold text-[#6b7280] dark:text-[#94a3b8] uppercase tracking-wider block">Suspended</span>
          <h4 className="text-2xl font-bold font-outfit text-rose-600 dark:text-rose-450 mt-1">{summary.inactive}</h4>
        </div>

        <div className="enterprise-card border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] p-4 rounded-[18px]">
          <span className="text-[9px] font-bold text-[#6b7280] dark:text-[#94a3b8] uppercase tracking-wider block">System Admins</span>
          <h4 className="text-2xl font-bold font-outfit text-purple-600 dark:text-purple-400 mt-1">{summary.admins}</h4>
        </div>

        <div className="enterprise-card border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] p-4 rounded-[18px]">
          <span className="text-[9px] font-bold text-[#6b7280] dark:text-[#94a3b8] uppercase tracking-wider block">Total Vault space</span>
          <h4 className="text-2xl font-bold font-outfit text-blue-600 dark:text-blue-400 mt-1">{formatSize(summary.storageUsedBytes)}</h4>
        </div>

        <div className="enterprise-card border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] p-4 rounded-[18px] overflow-hidden">
          <span className="text-[9px] font-bold text-[#6b7280] dark:text-[#94a3b8] uppercase tracking-wider block">Latest Account</span>
          <h4 className="text-[11px] font-bold font-mono text-[#111827] dark:text-[#f8fafc] truncate mt-2">{summary.lastCreatedEmail}</h4>
        </div>

      </div>

      {/* Filters HUD */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-3.5 px-5 bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-[18px]">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search name, email, employee ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full enterprise-input rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#6b7280] dark:text-[#94a3b8] font-bold">Role</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155] rounded-lg px-2.5 py-1 text-xs text-[#111827] dark:text-[#f8fafc] focus:outline-none font-bold"
            >
              <option value="">All Roles</option>
              <option value="ADMIN">Admins</option>
              <option value="EMPLOYEE">Employees</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#6b7280] dark:text-[#94a3b8] font-bold">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155] rounded-lg px-2.5 py-1 text-xs text-[#111827] dark:text-[#f8fafc] focus:outline-none font-bold"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#6b7280] dark:text-[#94a3b8] font-bold">Dept</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155] rounded-lg px-2.5 py-1 text-xs text-[#111827] dark:text-[#f8fafc] focus:outline-none font-bold"
            >
              <option value="">All Depts</option>
              <option value="IT">IT</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
              <option value="Support">Support</option>
            </select>
          </div>

          <button 
            onClick={fetchUsers}
            className="p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-[#f8fafc] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Table (Clean, Solid styles, sticky table header) */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="enterprise-card p-0 overflow-hidden border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] rounded-[18px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[#6b7280] dark:text-[#94a3b8] border-b border-[#e2e8f0] dark:border-[#334155] uppercase tracking-wider font-bold bg-[#f8fafc] dark:bg-[#0f172a] sticky top-0 z-10">
                  <th className="py-3.5 px-6">Employee ID</th>
                  <th className="py-3.5 px-6">Name</th>
                  <th className="py-3.5 px-6">Email</th>
                  <th className="py-3.5 px-6">Department</th>
                  <th className="py-3.5 px-6">Role</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 hidden md:table-cell">Last Login</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-550">No employees match this filter criteria.</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-[#e2e8f0] dark:border-[#334155] text-[#111827] dark:text-[#f8fafc] hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-slate-500">{user.employeeId}</td>
                      <td className="py-4 px-6 font-bold flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-600/10 text-purple-600 dark:text-purple-400 font-outfit text-xs font-semibold flex items-center justify-center border border-purple-500/20">
                          {user.firstName ? user.firstName[0].toUpperCase() : user.email[0].toUpperCase()}
                        </div>
                        <span>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Pending Name'}</span>
                      </td>
                      <td className="py-4 px-6 text-slate-500">{user.email}</td>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-xs">{user.department || 'Unassigned'}</span>
                        <span className="text-[10px] text-slate-400 block font-normal">{user.designation || 'Staff'}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                          user.role === 'ADMIN' 
                            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          user.status === 'ACTIVE' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' 
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/25'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 hidden md:table-cell text-slate-500">
                        {user.lastLogin 
                          ? new Date(user.lastLogin).toLocaleDateString([], { dateStyle: 'short', timeStyle: 'short' }) 
                          : 'Never'}
                      </td>
                      <td className="py-4 px-6 text-right relative">
                        <button 
                          onClick={() => setActiveMenuUserId(activeMenuUserId === user.id ? null : user.id)}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {activeMenuUserId === user.id && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setActiveMenuUserId(null)} />
                            <div className="absolute right-6 mt-1 w-44 bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl shadow-xl z-40 p-1 flex flex-col">
                              <button 
                                onClick={() => openUserDrawer(user)}
                                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2 font-medium"
                              >
                                <Eye className="w-3.5 h-3.5" /> View Details
                              </button>
                              <button 
                                onClick={() => triggerEdit(user)}
                                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2 font-medium"
                              >
                                <Edit className="w-3.5 h-3.5" /> Edit Profile
                              </button>
                              <button 
                                onClick={() => handlePasswordReset(user.id)}
                                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2 font-medium"
                              >
                                <Key className="w-3.5 h-3.5" /> Reset Password
                              </button>
                              <button 
                                onClick={() => handleToggleStatus(user.id, user.status)}
                                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2 font-medium"
                              >
                                {user.status === 'ACTIVE' ? <UserX className="w-3.5 h-3.5 text-rose-500" /> : <UserCheck className="w-3.5 h-3.5 text-emerald-500" />}
                                {user.status === 'ACTIVE' ? 'Disable account' : 'Re-enable'}
                              </button>
                              <button 
                                onClick={() => handleRoleChange(user.id, user.role)}
                                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2 font-medium"
                              >
                                <Shield className="w-3.5 h-3.5 text-purple-500" />
                                {user.role === 'ADMIN' ? 'Demote to Staff' : 'Promote Admin'}
                              </button>
                              <div className="h-px bg-[#e2e8f0] dark:bg-[#334155] my-1" />
                              <button 
                                onClick={() => handleDelete(user.id, user.email)}
                                className="w-full text-left px-2.5 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-rose-600 dark:text-rose-455 transition-colors flex items-center gap-2 font-medium"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Purge Account
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-[#e2e8f0] dark:border-[#334155] flex justify-between items-center bg-[#f8fafc] dark:bg-[#0f172a]/20">
              <span className="text-xs text-slate-500">Page {page} of {totalPages} ({totalUsersCount} employees)</span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(prev => prev - 1)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-slate-850 hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] disabled:opacity-40 disabled:cursor-not-allowed transition-all text-[#6b7280] dark:text-[#94a3b8] flex items-center gap-1 font-bold text-xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(prev => prev + 1)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-slate-850 hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] disabled:opacity-40 disabled:cursor-not-allowed transition-all text-[#6b7280] dark:text-[#94a3b8] flex items-center gap-1 font-bold text-xs"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE USER MODAL */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Provision Employee Profile">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">FIRST NAME</label>
              <input
                type="text"
                placeholder="Jane"
                value={formUser.firstName}
                onChange={(e) => setFormUser({...formUser, firstName: e.target.value})}
                className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">LAST NAME</label>
              <input
                type="text"
                placeholder="Doe"
                value={formUser.lastName}
                onChange={(e) => setFormUser({...formUser, lastName: e.target.value})}
                className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc]"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400">EMPLOYEE ID (OPTIONAL - AUTO GENERATED IF EMPTY)</label>
            <input
              type="text"
              placeholder="e.g. EMP-10452"
              value={formUser.employeeId}
              onChange={(e) => setFormUser({...formUser, employeeId: e.target.value})}
              className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc] font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400">EMAIL ADDRESS</label>
            <input
              type="email"
              placeholder="jane.doe@company.com"
              value={formUser.email}
              onChange={(e) => setFormUser({...formUser, email: e.target.value})}
              className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc]"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400">PHONE NUMBER</label>
            <input
              type="text"
              placeholder="+1 555-0199"
              value={formUser.phone}
              onChange={(e) => setFormUser({...formUser, phone: e.target.value})}
              className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">DEPARTMENT</label>
              <select
                value={formUser.department}
                onChange={(e) => setFormUser({...formUser, department: e.target.value})}
                className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc] bg-[#f8fafc] dark:bg-[#0f172a] focus:outline-none"
                required
              >
                <option value="">Select Department</option>
                <option value="IT">IT</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
                <option value="Support">Support</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">DESIGNATION</label>
              <input
                type="text"
                placeholder="Senior Engineer"
                value={formUser.designation}
                onChange={(e) => setFormUser({...formUser, designation: e.target.value})}
                className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">ASSIGNED ROLE</label>
              <select
                value={formUser.role}
                onChange={(e) => setFormUser({...formUser, role: e.target.value})}
                className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc] bg-[#f8fafc] dark:bg-[#0f172a]"
              >
                <option value="EMPLOYEE">Employee (Standard)</option>
                <option value="ADMIN">Administrator (Full Access)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">S3 SPACE LIMIT (MB)</label>
              <input
                type="number"
                placeholder="5120"
                value={formUser.storageLimit}
                onChange={(e) => setFormUser({...formUser, storageLimit: parseInt(e.target.value, 10)})}
                className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc]"
                required
              />
            </div>
          </div>

          <div className="space-y-2 border-t border-[#e2e8f0] dark:border-[#334155] pt-4">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="generatePassword"
                checked={formUser.generatePassword}
                onChange={(e) => setFormUser({...formUser, generatePassword: e.target.checked})}
                className="rounded border-[#e2e8f0] dark:border-[#334155] bg-transparent text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
              />
              <label htmlFor="generatePassword" className="text-xs text-[#111827] dark:text-[#f8fafc] font-semibold">Generate Strong Temp Password</label>
            </div>

            {!formUser.generatePassword && (
              <div className="space-y-1.5 mt-2">
                <label className="text-[10px] font-bold text-slate-400">EXPLICIT PASSWORD</label>
                <input
                  type="password"
                  placeholder="At least 8 characters"
                  value={formUser.password}
                  onChange={(e) => setFormUser({...formUser, password: e.target.value})}
                  className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc]"
                  required={!formUser.generatePassword}
                />
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="sendWelcomeEmail"
                checked={formUser.sendWelcomeEmail}
                onChange={(e) => setFormUser({...formUser, sendWelcomeEmail: e.target.checked})}
                className="rounded border-[#e2e8f0] dark:border-[#334155] bg-transparent text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
              />
              <label htmlFor="sendWelcomeEmail" className="text-xs text-[#111827] dark:text-[#f8fafc] font-semibold">Send Welcome Notification (SNS)</label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2.5 text-xs font-bold transition-all mt-4"
          >
            Provision Account
          </button>
        </form>
      </Modal>

      {/* EDIT USER MODAL */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit Profile: ${formUser.email}`}>
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">FIRST NAME</label>
              <input
                type="text"
                value={formUser.firstName}
                onChange={(e) => setFormUser({...formUser, firstName: e.target.value})}
                className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">LAST NAME</label>
              <input
                type="text"
                value={formUser.lastName}
                onChange={(e) => setFormUser({...formUser, lastName: e.target.value})}
                className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc]"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400">EMPLOYEE ID</label>
            <input
              type="text"
              value={formUser.employeeId}
              onChange={(e) => setFormUser({...formUser, employeeId: e.target.value})}
              className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc] font-mono"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400">PHONE NUMBER</label>
            <input
              type="text"
              value={formUser.phone}
              onChange={(e) => setFormUser({...formUser, phone: e.target.value})}
              className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">DEPARTMENT</label>
              <select
                value={formUser.department}
                onChange={(e) => setFormUser({...formUser, department: e.target.value})}
                className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc] bg-[#f8fafc] dark:bg-[#0f172a] focus:outline-none"
                required
              >
                <option value="IT">IT</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
                <option value="Support">Support</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">DESIGNATION</label>
              <input
                type="text"
                value={formUser.designation}
                onChange={(e) => setFormUser({...formUser, designation: e.target.value})}
                className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">STATUS</label>
              <select
                value={formUser.status}
                onChange={(e) => setFormUser({...formUser, status: e.target.value})}
                className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc] bg-[#f8fafc] dark:bg-[#0f172a]"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">SUSPENDED</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">STORAGE LIMIT (MB)</label>
              <input
                type="number"
                value={formUser.storageLimit}
                onChange={(e) => setFormUser({...formUser, storageLimit: parseInt(e.target.value, 10)})}
                className="w-full enterprise-input rounded-xl px-4 py-2.5 text-xs text-[#111827] dark:text-[#f8fafc]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2.5 text-xs font-bold transition-all mt-4"
          >
            Save Profile Details
          </button>
        </form>
      </Modal>

      {/* CONFIRMATION / RESET PASSWORD MODAL */}
      <Modal isOpen={resetModalOpen} onClose={() => setResetModalOpen(false)} title="Temporary Password Generated">
        <div className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Account successfully provisioned. Copy this random temporary password. It will not be shown again.
          </p>
          
          <div className="p-3.5 bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/10 dark:border-purple-900 rounded-xl flex items-center justify-between gap-3">
            <span className="font-mono text-sm text-[#111827] dark:text-[#f8fafc] font-bold select-text">{tempPasswordShow}</span>
            <button 
              onClick={copyPassword}
              className="p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#0f172a] hover:bg-slate-50 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setResetModalOpen(false)}
            className="w-full bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white rounded-xl py-2.5 text-xs font-bold"
          >
            Acknowledge & Close
          </button>
        </div>
      </Modal>

      {/* DETAILED USER DRAWER (Slide Panel) */}
      <AnimatePresence>
        {drawerUser && (
          <>
            {/* Drawer Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setDrawerUser(null)} />
            
            {/* Drawer Container */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-[#1e293b] border-l border-[#e2e8f0] dark:border-[#334155] z-50 p-6 overflow-y-auto flex flex-col justify-between"
            >
              <div className="space-y-6">
                
                {/* Header info */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-purple-600/10 text-purple-600 dark:text-purple-400 font-outfit text-lg font-bold flex items-center justify-center border border-purple-500/20">
                      {drawerUser.firstName ? drawerUser.firstName[0].toUpperCase() : drawerUser.email[0].toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-[#111827] dark:text-[#f8fafc] font-outfit">
                        {`${drawerUser.firstName || ''} ${drawerUser.lastName || ''}`.trim() || 'Provisioned User'}
                      </h2>
                      <span className="text-[10px] text-slate-500 font-bold font-mono block mt-0.5">{drawerUser.employeeId}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setDrawerUser(null)}
                    className="p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b]"
                  >
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>

                <div className="h-px bg-[#e2e8f0] dark:bg-[#334155]" />

                {/* Profile Details List */}
                <div className="space-y-3.5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Employee Profile</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wide">Email</span>
                      <span className="font-semibold text-[#111827] dark:text-[#f8fafc] mt-0.5 block truncate">{drawerUser.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wide">Phone</span>
                      <span className="font-semibold text-[#111827] dark:text-[#f8fafc] mt-0.5 block truncate">{drawerUser.phone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wide">Department</span>
                      <span className="font-semibold text-[#111827] dark:text-[#f8fafc] mt-0.5 block truncate">{drawerUser.department || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wide">Designation</span>
                      <span className="font-semibold text-[#111827] dark:text-[#f8fafc] mt-0.5 block truncate">{drawerUser.designation || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wide">Role privileges</span>
                      <span className="font-bold text-[#111827] dark:text-[#f8fafc] mt-0.5 block">{drawerUser.role}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wide">Status</span>
                      <span className={`font-bold mt-0.5 block text-xs ${drawerUser.status === 'ACTIVE' ? 'text-emerald-500' : 'text-rose-500'}`}>{drawerUser.status}</span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-[#e2e8f0] dark:bg-[#334155]" />

                {/* Storage S3 usage */}
                {drawerLoading ? (
                  <div className="flex justify-center items-center py-6">
                    <RefreshCw className="w-5 h-5 text-purple-600 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">S3 Space Allocation</h3>
                      <div className="flex justify-between text-xs font-semibold text-[#6b7280] dark:text-[#94a3b8]">
                        <span className="flex items-center gap-1"><Database className="w-3.5 h-3.5 text-slate-500" /> Space Used</span>
                        <span>
                          {drawerStats ? formatSize(drawerStats.storageUsedBytes) : '0 B'} / {drawerUser.storageLimit} MB
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      {drawerStats && (
                        <div className="w-full h-2 bg-[#e2e8f0] dark:bg-[#334155] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-600 dark:bg-purple-500 transition-all" 
                            style={{ 
                              width: `${Math.min(100, Math.max(1, Math.round((drawerStats.storageUsedBytes / (drawerUser.storageLimit * 1024 * 1024)) * 100)))}%` 
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="h-px bg-[#e2e8f0] dark:bg-[#334155]" />

                    {/* Files Uploaded List */}
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Uploaded Files ({drawerStats?.filesCount || 0})</h3>
                      <div className="space-y-2">
                        {drawerStats?.filesList.length === 0 ? (
                          <p className="text-xs text-slate-500">No active files uploaded.</p>
                        ) : (
                          drawerStats?.filesList.map(f => (
                            <div key={f.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-[#e2e8f0] dark:border-[#334155]">
                              <span className="font-semibold truncate max-w-[200px] text-[#111827] dark:text-[#f8fafc]">{f.name}</span>
                              <span className="text-[#6b7280] dark:text-[#94a3b8] flex-shrink-0 ml-2">{formatSize(f.size)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="h-px bg-[#e2e8f0] dark:bg-[#334155]" />

                    {/* Recovery requests */}
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recovery requests ({drawerStats?.recoveryCount || 0})</h3>
                      <div className="space-y-2">
                        {drawerStats?.recoveryList.length === 0 ? (
                          <p className="text-xs text-slate-500">No disaster recovery restoration requests logged.</p>
                        ) : (
                          drawerStats?.recoveryList.map(rec => (
                            <div key={rec.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-[#e2e8f0] dark:border-[#334155]">
                              <span className="font-semibold truncate max-w-[220px] text-[#111827] dark:text-[#f8fafc]">{rec.restorePath}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold border ${
                                rec.status === 'COMPLETED' 
                                  ? 'bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 border-emerald-500/20' 
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/20'
                              }`}>{rec.status}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}

              </div>
              
              <div className="mt-8 pt-4 border-t border-[#e2e8f0] dark:border-[#334155]">
                <button
                  onClick={() => setDrawerUser(null)}
                  className="w-full py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-bold transition-all text-slate-500"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
};
export default UserManagement;
