import React from 'react';

interface TopAppBarProps {
  title?: string;
}

export function TopAppBar({ title = 'Import CSV' }: TopAppBarProps) {
  return (
    <header className="fixed top-0 right-0 left-[260px] h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant flex justify-between items-center px-lg z-30">
      <div>
        <h2 className="font-headline-md text-headline-md font-extrabold text-on-surface">
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-md">
        <button className="p-2 text-secondary hover:text-primary transition-colors hover:scale-110 active:scale-95">
          <span className="material-symbols-outlined">dark_mode</span>
        </button>
        <button className="p-2 text-secondary hover:text-primary transition-colors hover:scale-110 active:scale-95 relative">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full" />
        </button>
        <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant ml-sm cursor-pointer hover:ring-2 ring-primary/20 transition-all bg-primary-container/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-sm text-primary">person</span>
        </div>
      </div>
    </header>
  );
}
