// NEVER use window.fetch = ... 
// Always use the http() wrapper defined in utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number) {
  return Math.round(num * 10) / 10;
}

export function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDate() {
  return formatDate(new Date());
}

export const http = (url: string, options: RequestInit = {}) => {
  return fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
};
