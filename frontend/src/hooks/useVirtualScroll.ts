'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseVirtualScrollOptions {
  totalItems: number;
  rowHeight: number;
  containerHeight?: number;
  bufferRows?: number;
}

export interface VirtualScrollResult<T = HTMLDivElement> {
  containerRef: React.RefObject<T>;
  virtualItems: {
    index: number;
    offsetTop: number;
  }[];
  totalHeight: number;
  startIndex: number;
  endIndex: number;
  handleScroll: (e: React.UIEvent<HTMLElement>) => void;
}

/**
 * A custom hook providing windowed virtualized rendering for large datasets.
 * Calculates visible row slices based on scroll position and fixed/estimated row height.
 */
export function useVirtualScroll<T extends HTMLElement = HTMLDivElement>({
  totalItems,
  rowHeight,
  containerHeight = 480,
  bufferRows = 10,
}: UseVirtualScrollOptions): VirtualScrollResult<T> {
  const containerRef = useRef<T>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(containerHeight);

  // Sync actual viewport height when container mounts or resizes
  useEffect(() => {
    if (containerRef.current) {
      const height = containerRef.current.clientHeight || containerHeight;
      if (height > 0) {
        setViewportHeight(height);
      }
    }
  }, [containerHeight]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalHeight = totalItems * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - bufferRows);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + 2 * bufferRows;
  const endIndex = Math.min(totalItems - 1, startIndex + visibleCount);

  const virtualItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    if (i >= 0 && i < totalItems) {
      virtualItems.push({
        index: i,
        offsetTop: i * rowHeight,
      });
    }
  }

  return {
    containerRef,
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    handleScroll,
  };
}
