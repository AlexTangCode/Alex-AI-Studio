
import { Hen } from './types';

export const DEFAULT_HENS: Hen[] = [
  {
    id: 'hen-1',
    name: '花花',
    color: 'bg-orange-400',
    avatar: '🐔'
  },
  {
    id: 'hen-2',
    name: '白白',
    color: 'bg-slate-200',
    avatar: '🐤'
  }
];

export const AVAILABLE_AVATARS = ['🐔', '🐤', '🐣', '🐥', '🦢', '🦃', '🦉', '🦜', '🦤', '🦚'];
export const AVAILABLE_COLORS = [
  'bg-orange-400', 
  'bg-slate-200', 
  'bg-yellow-300', 
  'bg-red-400', 
  'bg-amber-100', 
  'bg-zinc-300',
  'bg-emerald-200',
  'bg-sky-200',
  'bg-rose-200',
  'bg-indigo-200'
];

export const STORAGE_KEY = 'happy_hens_data_v2'; // Changed version key to ensure clean migrations if needed, though current logic preserves data.
