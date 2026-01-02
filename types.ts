
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

export interface DailySummary {
  date: string;
  totalCount: number;
  avgWeight: number;
}
