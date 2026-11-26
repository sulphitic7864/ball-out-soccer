import React from 'react';
import { Trophy, Calendar, ArrowLeftRight, MessageSquare } from 'lucide-react';
import type { BrandConfig } from '../types.ts';

export type AppTab = 'leagues' | 'hub' | 'market' | 'clubhouse' | 'admin';

interface TopBarProps {
  brand: BrandConfig;
  activeTab: AppTab;
  activePath: string;
  selectedLeagueType: 'All' | 'League' | 'Tournament';
  onSelectTab: (tab: AppTab) => void;
  onSelectLeagueType: (type: 'All' | 'League' | 'Tournament') => void;
  onNavigateToPartnerships: () => void;
  onOpenRegister: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  brand,
  activeTab,
  activePath,
  selectedLeagueType,
  onSelectTab,
  onSelectLeagueType,
  onNavigateToPartnerships,
  onOpenRegister,
}) => {
  const navItems: {
    label: string;
    href: string;
    isActive: boolean;
    onClick: () => void;
  }[] = [
    {
      label: 'Programs',
      href: '/programs',
      isActive:
        activeTab === 'leagues' &&
        selectedLeagueType !== 'Tournament' &&
        activePath !== '/partnerships',
      onClick: () => onSelectLeagueType('All'),
    },
    {
      label: 'Tournaments',
      href: '/tournaments',
      isActive: activeTab === 'leagues' && selectedLeagueType === 'Tournament',
      onClick: () => onSelectLeagueType('Tournament'),
    },
    {
      label: 'Schedule',
      href: '/schedule',
      isActive: activeTab === 'hub',
      onClick: () => onSelectTab('hub'),
    },
    {
      label: 'Teams',
      href: '/teams',
      isActive: activeTab === 'clubhouse',
      onClick: () => onSelectTab('clubhouse'),
    },
    {
      label: 'Player Market',
      href: '/market',
      isActive: activeTab === 'market',
      onClick: () => onSelectTab('market'),
    },
    {
      label: 'Partnerships',
      href: '/partnerships',
      isActive: activePath === '/partnerships',
      onClick: onNavigateToPartnerships,
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090D12]/95 backdrop-blur-md">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-5 px-4 sm:px-6">
        <a
          href="/programs"
          onClick={(event) => {
            event.preventDefault();
            onSelectLeagueType('All');
          }}
          className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>{brand.siteName}</span>
          <span
            className="ml-1 inline-block h-2.5 w-2.5 rounded-sm align-middle"
            style={{ backgroundColor: brand.primaryColor }}
          />
        </a>

        <nav className="hidden lg:flex flex-1 items-center justify-center gap-3" aria-label="Primary Navigation">
          {navItems.map((item) => {
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={(event) => {
                  event.preventDefault();
                  item.onClick();
                }}
                className={`relative py-3 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  item.isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {item.isActive && (
                  <span
                    className="absolute inset-x-0 -bottom-[21px] h-1"
                    style={{ backgroundColor: brand.primaryColor }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenRegister}
            style={{ backgroundColor: brand.primaryColor }}
            className="min-h-[40px] rounded-lg px-4 py-2 text-sm font-semibold text-slate-950 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            Register
          </button>
        </div>
      </div>
    </header>
  );
};

export const MobileBottomBar: React.FC<{
  brand: BrandConfig;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onSelectLeagueType: (type: 'All' | 'League' | 'Tournament') => void;
}> = ({ brand, activeTab, onSelectTab, onSelectLeagueType }) => {
  const items: { id: AppTab; label: string; icon: React.ReactNode; href: string }[] = [
    { id: 'leagues', label: 'Leagues', icon: <Trophy className="h-5 w-5" />, href: '/programs' },
    { id: 'hub', label: 'Hub', icon: <Calendar className="h-5 w-5" />, href: '/schedule' },
    { id: 'market', label: 'Market', icon: <ArrowLeftRight className="h-5 w-5" />, href: '/market' },
    { id: 'clubhouse', label: 'Clubhouse', icon: <MessageSquare className="h-5 w-5" />, href: '/teams' },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#090D12]/95 backdrop-blur-md"
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-4 h-14">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <a
              key={item.id}
              href={item.href}
              onClick={(event) => {
                event.preventDefault();
                if (item.id === 'leagues') onSelectLeagueType('All');
                else onSelectTab(item.id);
              }}
              style={isActive ? { color: brand.primaryColor } : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors ${
                isActive ? '' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium tracking-tight whitespace-nowrap">
                {item.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
};
