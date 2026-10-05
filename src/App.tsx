import { MetaPerformancePage } from './features/meta-performance';
import { StudioPage } from './features/studio';
import { BusinessProfilePage, BusinessGate } from './features/business-profile';
import { PasswordResetPage } from './features/password-reset';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  Sparkles,
  LayoutDashboard,
  Palette,
  Tag,
  Megaphone,
  Users,
  ChartNoAxesCombined,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { api, clearCsrf, type Profile } from './lib/api';
import { WorkspaceContext } from './lib/workspace';
import { Loading, Notice } from './components/ui';
import { AuthPage, Onboarding } from './features/auth';
import { Dashboard } from './features/dashboard';
import { OffersPage } from './features/brand';
import { CampaignsPage, CampaignPage } from './features/campaigns';
import { LeadsPage } from './features/leads';
import { ReportsPage } from './features/reports';
import { SettingsPage } from './features/settings';
const navigation = [
  ['/', 'Overview', LayoutDashboard],
  ['/assistant', 'Creative studio', Sparkles],
  ['/brand', 'Brand & assets', Palette],
  ['/offers', 'Offers', Tag],
  ['/campaigns', 'Campaigns', Megaphone],
  ['/leads', 'Leads & outcomes', Users],
  ['/meta', 'Meta performance', ChartNoAxesCombined],
  ['/reports', 'Business outcomes', ChartNoAxesCombined],
  ['/settings', 'Settings & team', Settings],
] as const;
export default function App() {
  const query = useQueryClient();
  const location = useLocation();
  const [selected, setSelected] = useState(localStorage.getItem('adreadygo.business') || '');
  const [mobile, setMobile] = useState(false);
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: () => api<Profile>('/auth/me'),
    retry: false,
  });
  if (location.pathname === '/reset') return <PasswordResetPage />;
  if (location.pathname === '/invite') return <AuthPage />;
  if (profile.isLoading) return <Loading />;
  if (profile.error) {
    if ('status' in profile.error && profile.error.status === 401) return <AuthPage />;
    return (
      <div className="onboarding">
        <Notice error>{profile.error.message}</Notice>
        <button className="button" onClick={() => profile.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (!profile.data?.businesses.length) return <Onboarding />;
  const business =
    profile.data.businesses.find((b) => b.id === selected) || profile.data.businesses[0];
  return (
    <WorkspaceContext.Provider value={business}>
      <div className="app-shell">
        <aside className={'sidebar ' + (mobile ? 'open' : '')}>
          <div className="sidebar-top">
            <NavLink to="/" className="logo">
              <span>
                <Sparkles size={20} />
              </span>
              AdReadyGo<span className="logo-dot">.</span>
            </NavLink>
            <button
              className="icon-button mobile-close"
              onClick={() => setMobile(false)}
              aria-label="Close menu"
            >
              <X />
            </button>
          </div>
          <div className="workspace-picker">
            <span className="workspace-avatar">{business.name.slice(0, 1)}</span>
            <select
              aria-label="Business workspace"
              value={business.id}
              onChange={(e) => {
                setSelected(e.target.value);
                localStorage.setItem('adreadygo.business', e.target.value);
              }}
            >
              {profile.data.businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
          <span className="nav-caption">WORKSPACE</span>
          <nav>
            {navigation.map(([to, label, Icon]) => (
              <NavLink end={to === '/'} to={to} key={to} onClick={() => setMobile(false)}>
                <Icon size={18} />
                {label}
                {to === '/assistant' && <span className="ai-tag">AI</span>}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="pilot-card">
              <span className="green-dot" />
              <strong>Your marketing workspace</strong>
              <p>
                Create, review and track.
                <br />
                Live activation is an owner action.
              </p>
            </div>
            <div className="user-card">
              <span className="user-avatar">{profile.data.user.display_name.slice(0, 1)}</span>
              <div>
                <strong>{profile.data.user.display_name}</strong>
                <small>
                  {business.role === 'OWNER' ? 'Workspace owner' : 'Marketer / Designer'}
                </small>
              </div>
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={async () => {
                  await api('/auth/logout', 'POST');
                  clearCsrf();
                  query.clear();
                  window.location.assign('/');
                }}
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMobile(true)}
              aria-label="Open menu"
            >
              <Menu />
            </button>
            <span>
              Workspace{' '}
              <span className="breadcrumb">
                / {navigation.find((n) => n[0] === location.pathname)?.[1] || 'Campaign editor'}
              </span>
            </span>
            <span className="environment">
              <span className="green-dot" />
              Local preview <span className="environment-divider">|</span> Invite-only
            </span>
          </div>
          <div className="page" key={business.id}>
            <BusinessGate>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/assistant" element={<StudioPage />} />
                <Route path="/assistant/:id" element={<StudioPage />} />
                <Route path="/brand" element={<BusinessProfilePage />} />
                <Route path="/offers" element={<OffersPage />} />
                <Route path="/campaigns" element={<CampaignsPage />} />
                <Route path="/campaigns/:id" element={<CampaignPage />} />
                <Route path="/leads" element={<LeadsPage />} />
                <Route path="/meta" element={<MetaPerformancePage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BusinessGate>
          </div>
          <footer className="main-footer">
            AdReadyGo · Make your next move a good one.<span>Local pilot / v0.1</span>
          </footer>
        </main>
      </div>
    </WorkspaceContext.Provider>
  );
}
