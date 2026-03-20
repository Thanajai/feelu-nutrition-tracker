import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number) {
  return Math.round(num * 10) / 10;
}

export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}
