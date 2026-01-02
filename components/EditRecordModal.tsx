
import React, { useState } from 'react';
import { EggRecord } from '../types';

interface EditRecordModalProps {
  record: EggRecord;
  henName: string;
  onSave: (id: string, date: string, weight?: number) => void;
  onCancel: () => void;
}

const EditRecordModal: React.FC<EditRecordModalProps> = ({ record, henName, onSave, onCancel }) => {
  const [weight, setWeight] = useState<string>(record.weight?.toString() || '');
  const [date, setDate] = useState<string>(record.date);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-xl font-black text-slate-800 mb-2 text-center">修改记录 ✏️</h3>
        <p className="text-slate-500 text-sm mb-6 text-center">修改 <span className="text-amber-600 font-bold">{henName}</span> 的产蛋信息</p>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">修改日期</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-2xl p-4 text-slate-700 font-bold focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">修改重量 (克)</label>
            <input 
              type="number" 
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="例如: 55"
              className="w-full bg-slate-100 border-none rounded-2xl p-4 text-center text-2xl font-bold text-amber-600 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => onSave(record.id, date, weight ? parseFloat(weight) : undefined)}
            className="w-full bg-amber-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-amber-200 active:scale-95 transition-all"
          >
            保存修改
          </button>
          <button 
            onClick={onCancel}
            className="w-full text-slate-400 text-sm py-2 font-medium"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditRecordModal;
