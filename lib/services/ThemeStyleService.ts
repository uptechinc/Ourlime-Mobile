import { processColor, StyleSheet, type ColorValue } from 'react-native';
import type { ResolvedSettingsTheme } from '@/lib/profile/settings/SettingsService';

type ColorMap = { [color: string]: string };

const DARK_BACKGROUND_COLORS: ColorMap = {
  '#fff': '#0f172a',
  '#ffffff': '#0f172a',
  white: '#0f172a',
  '#f8fafc': '#020617',
  '#f9fafb': '#020617',
  '#f1f5f9': '#1e293b',
  '#e2e8f0': '#1e293b',
  '#e5e7eb': '#334155',
  '#f3f4f6': '#1e293b',
  '#f5f5f5': '#111827',
  '#f5f7fa': '#111827',
  '#fafafa': '#0f172a',
  '#ecfdf5': '#064e3b',
  '#d1fae5': '#065f46',
  '#f0fdf4': '#052e2b',
  '#eff6ff': '#172554',
  '#ede9fe': '#2e1065',
  '#fee2e2': '#450a0a',
  '#fef2f2': '#450a0a',
  '#fff7f7': '#2b1013',
};

const DARK_TEXT_COLORS: ColorMap = {
  '#0f172a': '#f8fafc',
  '#111827': '#f8fafc',
  '#1f2937': '#f1f5f9',
  '#334155': '#cbd5e1',
  '#374151': '#cbd5e1',
  '#475569': '#94a3b8',
  '#4b5563': '#94a3b8',
  '#64748b': '#94a3b8',
  '#6b7280': '#9ca3af',
  '#111': '#f8fafc',
  '#000': '#ffffff',
  '#000000': '#ffffff',
  black: '#ffffff',
  '#047857': '#34d399',
  '#059669': '#34d399',
  '#991b1b': '#fca5a5',
  '#7f1d1d': '#fecaca',
};

const DARK_BORDER_COLORS: ColorMap = {
  '#f8fafc': '#1e293b',
  '#f1f5f9': '#1e293b',
  '#f3f4f6': '#1f2937',
  '#e2e8f0': '#334155',
  '#e5e7eb': '#374151',
  '#d1d5db': '#475569',
  '#cbd5e1': '#475569',
  '#fff': '#334155',
  '#ffffff': '#334155',
};

export class ThemeStyleService {
  private static instance: ThemeStyleService;
  private theme: ResolvedSettingsTheme = 'light';
  private installed = false;

  private constructor() {}

  public static getInstance(): ThemeStyleService {
    if (!ThemeStyleService.instance) ThemeStyleService.instance = new ThemeStyleService();
    return ThemeStyleService.instance;
  }

  public install(): void {
    if (this.installed) return;
    this.installed = true;
    StyleSheet.setStyleAttributePreprocessor('backgroundColor', (value: unknown) => this.process(value, DARK_BACKGROUND_COLORS));
    StyleSheet.setStyleAttributePreprocessor('color', (value: unknown) => this.process(value, DARK_TEXT_COLORS));
    StyleSheet.setStyleAttributePreprocessor('borderColor', (value: unknown) => this.process(value, DARK_BORDER_COLORS));
    StyleSheet.setStyleAttributePreprocessor('borderTopColor', (value: unknown) => this.process(value, DARK_BORDER_COLORS));
    StyleSheet.setStyleAttributePreprocessor('borderBottomColor', (value: unknown) => this.process(value, DARK_BORDER_COLORS));
    StyleSheet.setStyleAttributePreprocessor('borderLeftColor', (value: unknown) => this.process(value, DARK_BORDER_COLORS));
    StyleSheet.setStyleAttributePreprocessor('borderRightColor', (value: unknown) => this.process(value, DARK_BORDER_COLORS));
  }

  public setTheme(theme: ResolvedSettingsTheme): void {
    this.theme = theme;
  }

  private process(value: unknown, colors: ColorMap): ReturnType<typeof processColor> {
    if (this.theme !== 'dark' || typeof value !== 'string') return processColor(value as ColorValue);
    return processColor(colors[value.trim().toLowerCase()] ?? value);
  }
}

export const themeStyleService = ThemeStyleService.getInstance();
