import React from 'react';
import { Trophy, Calendar, ArrowLeftRight, MessageSquare, ShieldCheck } from 'lucide-react';
import type { BrandConfig } from '../types.ts';

export type AppTab = 'leagues' | 'hub' | 'market' | 'clubhouse' | 'admin';

interface TopBarProps {
  brand: BrandConfig;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onOpenRegister: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  brand,
  activeTab,
  onSelectTab,
  onOpenRegister,
}) => {
  const navItems: { id: AppTab; label: string }[] = [
    { id: 'leagues', label: 'Leagues' },
    { id: 'hub', label: 'League Hub' },
    { id: 'market', label: 'Market & Subs' },
    { id: 'clubhouse', label: 'Clubhouse' },
    { id: 'admin', label: 'Admin & Ref' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090D12]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('leagues')}
          className="font-display text-2xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>{brand.siteName}</span>
          <span
            className="ml-1 inline-block h-2 w-2 rounded-xs align-middle"
            style={{ backgroundColor: brand.primaryColor }}
          />
        </button>

        {/* Zone 2: 5 concise single-line text nav links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    className="absolute inset-x-0 -bottom-[17px] h-0.5"
                    style={{ backgroundColor: brand.primaryColor }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenRegister}
            style={{ backgroundColor: brand.primaryColor }}
            className="min-h-[40px] rounded-lg px-4 py-2 text-sm font-semibold text-slate-950 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            Register Team
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
}> = ({ brand, activeTab, onSelectTab }) => {
  const items: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    { id: 'leagues', label: 'Leagues', icon: <Trophy className="h-5 w-5" /> },
    { id: 'hub', label: 'Hub', icon: <Calendar className="h-5 w-5" /> },
    { id: 'market', label: 'Market', icon: <ArrowLeftRight className="h-5 w-5" /> },
    { id: 'clubhouse', label: 'Clubhouse', icon: <MessageSquare className="h-5 w-5" /> },
    { id: 'admin', label: 'Ref/Admin', icon: <ShieldCheck className="h-5 w-5" /> },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#090D12]/95 backdrop-blur-md"
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-5 h-14">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              style={isActive ? { color: brand.primaryColor } : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors ${
                isActive ? '' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium tracking-tight whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
