import React from 'react';

export interface SideNavBarProps {
  activeTab?: 'import' | 'history';
  onTabChange?: (tab: 'import' | 'history') => void;
  onNewImport?: () => void;
  isMobileOpen?: boolean;
  onClose?: () => void;
}

export function SideNavBar({
  activeTab = 'import',
  onTabChange,
  onNewImport,
  isMobileOpen = false,
  onClose,
}: SideNavBarProps) {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs lg:hidden animate-fadeIn"
        />
      )}

      {/* Side Navigation Drawer */}
      <aside
        className={`fixed left-0 top-0 h-full w-[260px] bg-surface border-r border-outline-variant flex flex-col py-lg px-md z-50 transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="mb-xl px-sm flex items-center justify-between">
          <div
            className="cursor-pointer flex items-center gap-sm"
            onClick={() => {
              onTabChange?.('import');
              onClose?.();
            }}
          >
            <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center text-on-primary-container shadow-sm">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                dataset
              </span>
            </div>
            <div>
              <h1 className="font-headline-lg text-headline-lg font-bold text-primary">GrowEasy</h1>
              <p className="font-label-md text-[10px] uppercase tracking-wider text-secondary opacity-80">
                AI CRM Importer
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
            aria-label="Close menu"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-base">
          <button
            onClick={() => {
              onNewImport?.();
              onTabChange?.('import');
              onClose?.();
            }}
            className="w-full mb-md flex items-center justify-center gap-sm bg-primary text-on-primary py-2.5 rounded-xl font-semibold text-sm shadow-md transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            New Import
          </button>

          {/* Tab: Import CSV */}
          <button
            onClick={() => {
              onTabChange?.('import');
              onClose?.();
            }}
            className={`w-full flex items-center gap-md px-3 py-2.5 rounded-xl transition-all font-medium text-sm ${
              activeTab === 'import'
                ? 'text-primary font-bold border-l-4 border-primary bg-primary-container/15 shadow-sm'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined">upload_file</span>
            <span>Import CSV</span>
          </button>

          {/* Tab: Import History */}
          <button
            onClick={() => {
              onTabChange?.('history');
              onClose?.();
            }}
            className={`w-full flex items-center gap-md px-3 py-2.5 rounded-xl transition-all font-medium text-sm ${
              activeTab === 'history'
                ? 'text-primary font-bold border-l-4 border-primary bg-primary-container/15 shadow-sm'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined">history</span>
            <span>Import History</span>
          </button>
        </nav>
      </aside>
    </>
  );
}
