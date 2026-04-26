import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Icon, isValidIcon, getValidIconNames } from './Icon';

describe('Icon Component', () => {
  it('renders with valid icon name', () => {
    const { container } = render(<Icon name="dashboard" />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    expect(icon).toBeTruthy();
    expect(icon.textContent).toBe('dashboard');
  });

  it('applies default size of 24px', () => {
    const { container } = render(<Icon name="settings" />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    expect(icon.style.fontSize).toBe('24px');
  });

  it('applies custom size', () => {
    const { container } = render(<Icon name="settings" size={20} />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    expect(icon.style.fontSize).toBe('20px');
  });

  it('applies default weight of 400', () => {
    const { container } = render(<Icon name="settings" />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    expect(icon.style.fontVariationSettings).toContain("'wght' 400");
  });

  it('applies custom weight', () => {
    const { container } = render(<Icon name="settings" weight={600} />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    expect(icon.style.fontVariationSettings).toContain("'wght' 600");
  });

  it('applies default fill of 0 (outlined)', () => {
    const { container } = render(<Icon name="settings" />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    expect(icon.style.fontVariationSettings).toContain("'FILL' 0");
  });

  it('applies custom fill', () => {
    const { container } = render(<Icon name="settings" fill={1} />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    expect(icon.style.fontVariationSettings).toContain("'FILL' 1");
  });

  it('applies default grade of 0', () => {
    const { container } = render(<Icon name="settings" />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    expect(icon.style.fontVariationSettings).toContain("'GRAD' 0");
  });

  it('applies custom grade', () => {
    const { container } = render(<Icon name="settings" grade={200} />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    expect(icon.style.fontVariationSettings).toContain("'GRAD' 200");
  });

  it('applies custom className', () => {
    const { container } = render(<Icon name="dashboard" className="text-primary" />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    expect(icon.classList.contains('text-primary')).toBe(true);
  });

  it('applies custom style', () => {
    const { container } = render(<Icon name="dashboard" style={{ color: 'red' }} />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    expect(icon.style.color).toBe('red');
  });

  it('includes aria-label when provided', () => {
    render(<Icon name="search" ariaLabel="Search hosts" />);
    const icon = screen.getByLabelText('Search hosts');
    
    expect(icon).toBeTruthy();
  });

  it('sets aria-hidden when no aria-label provided', () => {
    const { container } = render(<Icon name="dashboard" />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    expect(icon.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses fallback icon for invalid name', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<Icon name="invalid_icon_name_xyz" />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    expect(icon.textContent).toBe('more_horiz');
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('uses fallback icon for empty name', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<Icon name="" />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    expect(icon.textContent).toBe('more_horiz');
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('sanitizes icon names with special characters', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<Icon name="dash<script>board" />);
    const icon = container.querySelector('.material-symbols-outlined');
    
    // Should sanitize to "dashscriptboard" which is NOT valid, so fallback to more_horiz
    expect(icon.textContent).toBe('more_horiz');
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('renders common PatchMaster icons correctly', () => {
    const icons = ['dashboard', 'dns', 'system_update', 'terminal', 'security', 'backup'];
    
    icons.forEach(iconName => {
      const { container } = render(<Icon name={iconName} />);
      const icon = container.querySelector('.material-symbols-outlined');
      expect(icon.textContent).toBe(iconName);
    });
  });
});

describe('isValidIcon', () => {
  it('returns true for valid icon names', () => {
    expect(isValidIcon('dashboard')).toBe(true);
    expect(isValidIcon('settings')).toBe(true);
    expect(isValidIcon('notifications')).toBe(true);
  });

  it('returns false for invalid icon names', () => {
    expect(isValidIcon('invalid_icon')).toBe(false);
    expect(isValidIcon('')).toBe(false);
    expect(isValidIcon(null)).toBe(false);
    expect(isValidIcon(undefined)).toBe(false);
  });

  it('handles case insensitivity', () => {
    expect(isValidIcon('DASHBOARD')).toBe(true);
    expect(isValidIcon('Dashboard')).toBe(true);
  });
});

describe('getValidIconNames', () => {
  it('returns an array of valid icon names', () => {
    const names = getValidIconNames();
    
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
  });

  it('returns sorted icon names', () => {
    const names = getValidIconNames();
    const sorted = [...names].sort();
    
    expect(names).toEqual(sorted);
  });

  it('includes common PatchMaster icons', () => {
    const names = getValidIconNames();
    
    expect(names).toContain('dashboard');
    expect(names).toContain('dns');
    expect(names).toContain('system_update');
    expect(names).toContain('security');
    expect(names).toContain('backup');
  });
});
