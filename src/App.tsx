import { useEffect, useState } from 'react';
import type { LeagueDatabase } from './types.ts';
import { TopBar, MobileBottomBar, type AppTab } from './components/TopBar.tsx';
import { LeagueDirectory } from './components/LeagueDirectory.tsx';
import { LiveLeagueHub } from './components/LiveLeagueHub.tsx';
import { TransferMarket } from './components/TransferMarket.tsx';
import { Clubhouse } from './components/Clubhouse.tsx';
import { AdminRefDashboard, type AdminSection } from './components/AdminRefDashboard.tsx';
import { RegistrationModal } from './components/RegistrationModal.tsx';

function getRouteState(): {
  tab: AppTab;
  leagueType: 'All' | 'League' | 'Tournament';
  adminSection: AdminSection;
} {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const adminSection = pathname.split('/')[2] as AdminSection | undefined;
  const validAdminSections: AdminSection[] = [
    'referee',
    'leagues',
    'supercup',
    'customizer',
    'staff',
    'ops',
    'venues',
    'payments',
  ];

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return {
      tab: 'admin',
      leagueType: 'All',
      adminSection:
        adminSection && validAdminSections.includes(adminSection) ? adminSection : 'leagues',
    };
  }
  if (pathname === '/schedule') return { tab: 'hub', leagueType: 'All', adminSection: 'leagues' };
  if (pathname === '/teams') return { tab: 'clubhouse', leagueType: 'All', adminSection: 'leagues' };
  if (pathname === '/market') return { tab: 'market', leagueType: 'All', adminSection: 'leagues' };
  return {
    tab: 'leagues',
    leagueType:
      pathname === '/tournaments' ? 'Tournament' : pathname === '/leagues' ? 'League' : 'All',
    adminSection: 'leagues',
  };
}

export default function App() {
  const initialRoute = getRouteState();
  const [db, setDb] = useState<LeagueDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [activeTab, setActiveTab] = useState<AppTab>(initialRoute.tab);
  const [selectedLeagueType, setSelectedLeagueType] = useState(initialRoute.leagueType);
  const [activeAdminSection, setActiveAdminSection] = useState<AdminSection>(initialRoute.adminSection);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [marketSubTab, setMarketSubTab] = useState<'board' | 'requests' | 'subs' | 'deals'>('board');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [activePlayerId, setActivePlayerId] = useState<string>('');

  const [regModalOpen, setRegModalOpen] = useState(false);
  const [regLeagueId, setRegLeagueId] = useState<string>('');
  const [regMode, setRegMode] = useState<'team' | 'split' | 'solo' | 'waitlist'>('team');
  const [regSplitCode, setRegSplitCode] = useState<string>('');

  const navigateToTab = (tab: AppTab) => {
    const routes: Record<AppTab, string> = {
      leagues:
        selectedLeagueType === 'Tournament'
          ? '/tournaments'
          : selectedLeagueType === 'League'
            ? '/leagues'
            : '/programs',
      hub: '/schedule',
      market: '/market',
      clubhouse: '/teams',
      admin: '/admin',
    };
    const nextPath = routes[tab];
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
    setCurrentPath(nextPath);
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  };

  const navigateToLeagueType = (type: 'All' | 'League' | 'Tournament') => {
    const nextPath =
      type === 'Tournament' ? '/tournaments' : type === 'League' ? '/leagues' : '/programs';
    setSelectedLeagueType(type);
    setActiveTab('leagues');
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
    setCurrentPath(nextPath);
    window.scrollTo({ top: 0 });
  };

  const navigateToAdminSection = (section: AdminSection) => {
    const nextPath = section === 'leagues' ? '/admin' : `/admin/${section}`;
    setActiveAdminSection(section);
    setActiveTab('admin');
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
    setCurrentPath(nextPath);
    window.scrollTo({ top: 0 });
  };

  const navigateToPartnerships = () => {
    setActiveTab('leagues');
    setSelectedLeagueType('All');
    if (window.location.pathname !== '/partnerships') {
      window.history.pushState({}, '', '/partnerships');
    }
    setCurrentPath('/partnerships');
    window.setTimeout(
      () => document.getElementById('partnerships')?.scrollIntoView({ behavior: 'smooth' }),
      0
    );
  };

  const syncSelections = (data: LeagueDatabase) => {
    setSelectedLeagueId((prev) =>
      prev && data.leagues.some((l) => l.id === prev) ? prev : data.leagues[0]?.id || ''
    );
    setSelectedTeamId((prev) =>
      prev && data.teams.some((t) => t.id === prev) ? prev : data.teams[0]?.id || ''
    );
    setActivePlayerId((prev) =>
      prev && data.players.some((p) => p.id === prev) ? prev : data.players[0]?.id || ''
    );
  };

  const handleDatabaseUpdate = (nextDb: LeagueDatabase) => {
    setDb(nextDb);
    syncSelections(nextDb);
  };

  const fetchState = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/state');
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        const message =
          errorBody && typeof errorBody.error === 'string'
            ? errorBody.error
            : `Failed to load league platform data (${res.status})`;
        throw new Error(message);
      }
      const data: LeagueDatabase = await res.json();
      setDb(data);
      syncSelections(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
      setRegMode('split');
      setRegSplitCode(joinCode.toUpperCase());
      setRegModalOpen(true);
    }

    const handlePopState = () => {
      const route = getRouteState();
      setActiveTab(route.tab);
      setSelectedLeagueType(route.leagueType);
      setActiveAdminSection(route.adminSection);
      setCurrentPath(window.location.pathname);
      if (window.location.pathname === '/partnerships') {
        window.setTimeout(
          () => document.getElementById('partnerships')?.scrollIntoView({ behavior: 'smooth' }),
          0
        );
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!loading && window.location.pathname === '/partnerships') {
      document.getElementById('partnerships')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentPath, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090D12] text-slate-100">
        <div className="h-16 border-b border-white/10 bg-[#090D12]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 h-80 rounded-2xl bg-[#111821] animate-pulse" />
            <div className="lg:col-span-6 h-80 rounded-2xl bg-[#111821] animate-pulse" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-[#111821] animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !db) {
    return (
      <div className="min-h-screen bg-[#090D12] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#111821] p-6 text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-white">
            Unable to Connect to League Server
          </h1>
          <p className="text-sm text-slate-400">{loadError || 'Unexpected server response.'}</p>
          <button
            type="button"
            onClick={fetchState}
            className="min-h-[42px] rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D12] text-slate-100 flex flex-col">
      {activeTab !== 'admin' && (
        <TopBar
          brand={db.brand}
          activeTab={activeTab}
          activePath={currentPath}
          selectedLeagueType={selectedLeagueType}
          onSelectTab={navigateToTab}
          onSelectLeagueType={navigateToLeagueType}
          onNavigateToPartnerships={navigateToPartnerships}
          onOpenRegister={() => {
            setRegLeagueId(selectedLeagueId || db.leagues[0]?.id || '');
            setRegMode('team');
            setRegSplitCode('');
            setRegModalOpen(true);
          }}
        />
      )}

      <main className="flex-1">
        {activeTab === 'leagues' && (
          <LeagueDirectory
            db={db}
            selectedLeagueType={selectedLeagueType}
            onSelectLeagueType={navigateToLeagueType}
            onRegisterLeague={(leagueId, mode = 'team') => {
              setRegLeagueId(leagueId);
              setRegMode(mode);
              setRegSplitCode('');
              setRegModalOpen(true);
            }}
            onOpenHub={(leagueId) => {
              setSelectedLeagueId(leagueId);
              navigateToTab('hub');
            }}
            onDatabaseUpdate={handleDatabaseUpdate}
          />
        )}

        {activeTab === 'hub' && (
          <LiveLeagueHub
            db={db}
            selectedLeagueId={selectedLeagueId}
            onSelectLeague={setSelectedLeagueId}
            onOpenMarket={() => {
              setMarketSubTab('board');
              navigateToTab('market');
            }}
            onOpenAdmin={() => navigateToTab('admin')}
            onOpenClubhouse={(teamId, playerId) => {
              setSelectedTeamId(teamId);
              if (playerId) setActivePlayerId(playerId);
              navigateToTab('clubhouse');
            }}
            onOpenRegister={(leagueId, mode = 'team', splitCode = '') => {
              setRegLeagueId(leagueId);
              setRegMode(mode);
              setRegSplitCode(splitCode);
              setRegModalOpen(true);
            }}
            onDatabaseUpdate={handleDatabaseUpdate}
          />
        )}

        {activeTab === 'market' && (
          <TransferMarket
            db={db}
            selectedLeagueId={selectedLeagueId}
            onSelectLeague={setSelectedLeagueId}
            activePlayerId={activePlayerId}
            onSelectActivePlayer={setActivePlayerId}
            initialSubTab={marketSubTab}
            onOpenAdmin={() => navigateToTab('admin')}
            onDatabaseUpdate={handleDatabaseUpdate}
          />
        )}

        {activeTab === 'clubhouse' && (
          <Clubhouse
            db={db}
            selectedTeamId={selectedTeamId}
            onSelectTeam={setSelectedTeamId}
            activePlayerId={activePlayerId}
            onSelectActivePlayer={setActivePlayerId}
            onOpenSplitJoin={(code) => {
              setRegMode('split');
              setRegSplitCode(code);
              setRegModalOpen(true);
            }}
            onOpenRegister={(leagueId, mode = 'team', splitCode = '') => {
              setRegLeagueId(leagueId);
              setRegMode(mode);
              setRegSplitCode(splitCode);
              setRegModalOpen(true);
            }}
            onGoToMarket={(tab = 'board', leagueId, playerId) => {
              if (leagueId) setSelectedLeagueId(leagueId);
              if (playerId) setActivePlayerId(playerId);
              setMarketSubTab(tab);
              navigateToTab('market');
            }}
            onOpenAdmin={() => navigateToTab('admin')}
            onDatabaseUpdate={handleDatabaseUpdate}
          />
        )}

        {activeTab === 'admin' && (
          <AdminRefDashboard
            db={db}
            initialSection={activeAdminSection}
            onNavigateSection={navigateToAdminSection}
            onDatabaseUpdate={handleDatabaseUpdate}
          />
        )}
      </main>

      {activeTab !== 'admin' && (
        <footer className="border-t border-white/10 bg-[#090D12] py-6 pb-20 lg:pb-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>{db.brand.siteName} · Leagues, tournaments & player community</div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => navigateToTab('leagues')}
                className="hover:text-slate-300 cursor-pointer"
              >
                Leagues
              </button>
              <button
                type="button"
                onClick={() => navigateToTab('clubhouse')}
                className="hover:text-slate-300 cursor-pointer"
              >
                Clubhouse & Ride Hub
              </button>
              <button
                type="button"
                onClick={() => {
                  setMarketSubTab('board');
                  navigateToTab('market');
                }}
                className="hover:text-slate-300 cursor-pointer"
              >
                Market & Subs
              </button>
            </div>
          </div>
        </footer>
      )}

      {activeTab !== 'admin' && (
        <MobileBottomBar
          brand={db.brand}
          activeTab={activeTab}
          onSelectTab={navigateToTab}
          onSelectLeagueType={navigateToLeagueType}
        />
      )}

      <RegistrationModal
        isOpen={regModalOpen}
        onClose={() => setRegModalOpen(false)}
        db={db}
        initialLeagueId={regLeagueId}
        initialMode={regMode}
        initialSplitCode={regSplitCode}
        onOpenAdmin={() => {
          setRegModalOpen(false);
          navigateToTab('admin');
        }}
        onDatabaseUpdate={handleDatabaseUpdate}
        onGoToClubhouse={(teamId) => {
          setSelectedTeamId(teamId);
          navigateToTab('clubhouse');
        }}
      />
    </div>
  );
}
