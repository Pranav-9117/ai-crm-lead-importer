'use client';

import React, { useEffect, useState } from 'react';

interface TopAppBarProps {
  title?: string;
}

export function TopAppBar({ title = 'Import CSV' }: TopAppBarProps) {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    // Check initial dark mode state from localStorage or system preference
    const storedTheme = localStorage.getItem('groweasy_theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDark = storedTheme === 'dark' || (!storedTheme && systemPrefersDark);

    setIsDarkMode(initialDark);
    if (initialDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('groweasy_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('groweasy_theme', 'light');
    }
  };

  return (
    <header className="fixed top-0 right-0 left-[260px] h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant flex justify-between items-center px-lg z-30 transition-colors">
      <div>
        <h2 className="font-headline-md text-headline-md font-extrabold text-on-surface">
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-md">
        <button
          onClick={toggleDarkMode}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2.5 rounded-xl bg-surface-container border border-outline-variant text-secondary hover:text-primary transition-all hover:scale-105 active:scale-95 shadow-sm"
        >
          <span className="material-symbols-outlined text-[20px]">
            {isDarkMode ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
      </div>
    </header>
  );
}
