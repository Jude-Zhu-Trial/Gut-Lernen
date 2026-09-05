import { NavLink, Outlet } from 'react-router-dom';
import { BookOpen, BarChart3, GraduationCap, Layers } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/study', label: '今日学习', icon: GraduationCap },
  { to: '/stats', label: '数据统计', icon: BarChart3 },
  { to: '/wordlists', label: '词表管理', icon: Layers },
];

const Layout = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              Gut lernen
            </span>
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">
              A1-B1
            </span>
          </div>
          <nav className="flex gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
