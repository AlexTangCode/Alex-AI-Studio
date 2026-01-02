
export interface Hen {
  id: string;
  name: string;
  color: string;
  avatar: string;
}

export interface EggRecord {
  id: string;
  henId: string;
  date: string; // ISO string YYYY-MM-DD
  timestamp: number;
  weight?: number; // In grams
}

export interface User {
  email: string;
  cloudId: string; // 经过哈希处理的唯一标识符
}

export enum Tab {
  TRACK = 'TRACK',
  STATS = 'STATS',
  MANAGE = 'MANAGE',
  TIPS = 'TIPS'
}

export enum StatPeriod {
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR'
}

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';
