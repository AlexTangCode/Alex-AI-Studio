
import React from 'react';
import { Hen } from '../types';

interface HenCardProps {
  hen: Hen;
  todayCount: number;
  onAdd: (count: number) => void;
}

const HenCard: React.FC<HenCardProps> = ({ hen, todayCount, onAdd }) => {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-100 flex flex-col items-center">
      <div className={`w-20 h-20 ${hen.color} rounded-full flex items-center justify-center text-4xl mb-4 shadow-inner`}>
        {hen.avatar}
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-1">{hen.name}</h3>
      <div className="text-amber-600 font-medium mb-4">今日已下蛋: {todayCount}</div>
      
      <div className="flex gap-3 w-full">
        <button 
          onClick={() => onAdd(1)}
          className="flex-1 bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-white font-bold py-3 rounded-2xl shadow-md"
        >
          +1 个蛋
        </button>
        <button 
          onClick={() => onAdd(-1)}
          disabled={todayCount <= 0}
          className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 px-4 py-3 rounded-2xl transition-all"
        >
          <i className="fa-solid fa-minus"></i>
        </button>
      </div>
    </div>
  );
};

export default HenCard;
