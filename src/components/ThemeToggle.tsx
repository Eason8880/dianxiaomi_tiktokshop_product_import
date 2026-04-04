'use client';

import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import {
  getBrowserThemeSnapshot,
  getServerThemeSnapshot,
  parseThemeSnapshot,
  setThemePreference,
  subscribeThemeChange,
  THEME_OPTIONS,
  ThemePreference,
} from '@/lib/theme';

export function ThemeToggle() {
  const themeSnapshot = useSyncExternalStore(
    subscribeThemeChange,
    getBrowserThemeSnapshot,
    getServerThemeSnapshot
  );
  const themeState = parseThemeSnapshot(themeSnapshot);
  const { preference, resolvedTheme } = themeState;

  function handleThemeChange(nextPreference: ThemePreference) {
    setThemePreference(nextPreference);
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <span suppressHydrationWarning className="hidden text-xs text-muted-foreground md:inline">
        当前：{resolvedTheme === 'dark' ? '深色' : '浅色'}
      </span>
      <div className="inline-flex items-center rounded-lg border border-border bg-card/80 p-1 shadow-sm">
        {THEME_OPTIONS.map((option) => {
          const isActive = preference === option.value;

          return (
            <Button
              key={option.value}
              type="button"
              variant="ghost"
              size="sm"
              className={[
                'h-7 px-2.5 text-xs',
                isActive ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : 'text-muted-foreground',
              ].join(' ')}
              onClick={() => handleThemeChange(option.value)}
              aria-pressed={isActive}
              title={`切换到${option.label}模式`}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
