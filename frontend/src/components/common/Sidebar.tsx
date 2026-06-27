import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  FolderLock, 
  ShieldAlert, 
  LogOut, 
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Users
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const { user, logout } = useAuth();

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'File Vault', path: '/vault', icon: FolderLock },
    { name: 'Disaster Recovery', path: '/recovery', icon: ShieldAlert },
  ];

  const adminItems = [
    { name: 'Admin Portal', path: '/admin', icon: ShieldCheck },
    { name: 'User Management', path: '/admin/users', icon: Users },
  ];

  return (
    <div className={`sidebar-panel h-screen flex flex-col justify-between p-4 text-slate-350 font-sans select-none sticky top-0 flex-shrink-0 transition-all duration-200 ${collapsed ? 'collapsed' : ''}`}>
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#e2e8f0] dark:border-[#334155] mb-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <ShieldAlert className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <div className="transition-opacity duration-150">
                <h1 className="font-outfit font-bold text-sm text-[#111827] dark:text-[#f8fafc] tracking-tight">DR Vault</h1>
              </div>
            )}
          </div>
          
          {/* Collapse Toggle Button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] text-[#6b7280] dark:text-[#94a3b8]"
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* User Identity Info */}
        <div className="p-2 mb-4 rounded-xl border border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#0f172a] flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-purple-600/10 dark:bg-purple-500/10 flex items-center justify-center font-outfit text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/20 flex-shrink-0">
            {user?.email[0].toUpperCase()}
          </div>
          {!collapsed && (
            <div className="overflow-hidden transition-opacity duration-150">
              <h4 className="text-xs font-bold text-[#111827] dark:text-[#f8fafc] truncate leading-none">{user?.email}</h4>
              <span className="inline-block mt-0.5 text-[8px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                {user?.role}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {!collapsed && (
            <div className="text-[9px] px-3 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 transition-opacity duration-150">Workspace</div>
          )}
          {menuItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => 
                `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all relative ${
                  isActive 
                    ? 'bg-purple-50 dark:bg-purple-900/25 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] hover:text-[#111827] dark:hover:text-[#f8fafc]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 bg-purple-600 dark:bg-purple-500 rounded-r-md" />
                  )}
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span className="transition-opacity duration-150">{item.name}</span>}
                </>
              )}
            </NavLink>
          ))}

          {/* Admin Items */}
          {user?.role === 'ADMIN' && (
            <>
              {!collapsed && (
                <div className="text-[9px] px-3 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-4 mb-2 transition-opacity duration-150">System Control</div>
              )}
              {adminItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) => 
                    `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all relative ${
                      isActive 
                        ? 'bg-purple-50 dark:bg-purple-900/25 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] hover:text-[#111827] dark:hover:text-[#f8fafc]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 bg-purple-600 dark:bg-purple-500 rounded-r-md" />
                      )}
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && <span className="transition-opacity duration-150">{item.name}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </>
          )}
        </nav>
      </div>

      {/* Logout Action Footer */}
      <div>
        <button
          onClick={logout}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-[#e2e8f0] dark:border-[#334155] hover:border-rose-500/20 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-450 transition-all ${collapsed ? 'px-0' : 'px-4'}`}
          title={collapsed ? "Logout" : ""}
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          {!collapsed && <span className="transition-opacity duration-150">Logout</span>}
        </button>
      </div>
    </div>
  );
};
export default Sidebar;
