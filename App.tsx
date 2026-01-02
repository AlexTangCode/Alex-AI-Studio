
import React, { useState, useEffect, useMemo } from 'react';
import { Hen, EggRecord, Tab, StatPeriod } from './types';
import { STORAGE_KEY, AVAILABLE_AVATARS, AVAILABLE_COLORS } from './constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { getHenAdvice } from './services/geminiService';
import WeightModal from './components/WeightModal';
import EditRecordModal from './components/EditRecordModal';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.TRACK);
  const [hens, setHens] = useState<Hen[]>([]);
  const [records, setRecords] = useState<EggRecord[]>([]);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [statPeriod, setStatPeriod] = useState<StatPeriod>(StatPeriod.WEEK);
  
  // Modal States
  const [recordingForHen, setRecordingForHen] = useState<Hen | null>(null);
  const [editingHen, setEditingHen] = useState<Hen | null>(null);
  const [editingRecord, setEditingRecord] = useState<EggRecord | null>(null);
  
  // Temporary edit states for Hens
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editColor, setEditColor] = useState('');

  // Initial Load with data preservation
  useEffect(() => {
    const oldHens = localStorage.getItem('happy_hens_data_hens');
    const oldRecords = localStorage.getItem('happy_hens_data_records');
    
    const savedHens = localStorage.getItem(STORAGE_KEY + '_hens') || oldHens;
    const savedRecords = localStorage.getItem(STORAGE_KEY + '_records') || oldRecords;
    
    if (savedHens) {
      setHens(JSON.parse(savedHens));
    } else {
      const initial = [
        { id: 'h1', name: '花花', color: 'bg-orange-400', avatar: '🐔' },
        { id: 'h2', name: '白白', color: 'bg-slate-200', avatar: '🐤' }
      ];
      setHens(initial);
    }
    
    if (savedRecords) {
      setRecords(JSON.parse(savedRecords));
    }
  }, []);

  // Persistence
  useEffect(() => {
    if (hens.length > 0) {
      localStorage.setItem(STORAGE_KEY + '_hens', JSON.stringify(hens));
    }
  }, [hens]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_records', JSON.stringify(records));
  }, [records]);

  const todayStr = new Date().toISOString().split('T')[0];

  // Records Logic
  const handleAddEgg = (hen: Hen) => setRecordingForHen(hen);

  const saveEggRecord = (date: string, weight?: number) => {
    if (recordingForHen) {
      const newRecord: EggRecord = {
        id: Math.random().toString(36).substr(2, 9),
        henId: recordingForHen.id,
        date: date,
        timestamp: date === todayStr ? Date.now() : new Date(date).getTime(),
        weight
      };
      setRecords([...records, newRecord]);
      setRecordingForHen(null);
    }
  };

  const updateEggRecord = (id: string, date: string, weight?: number) => {
    setRecords(records.map(r => r.id === id ? {
      ...r,
      date,
      weight,
      timestamp: date === r.date ? r.timestamp : new Date(date).getTime()
    } : r));
    setEditingRecord(null);
  };

  const deleteRecord = (id: string) => {
    if (confirm('确定要删除这条鸡蛋记录吗？')) {
      setRecords(records.filter(r => r.id !== id));
    }
  };

  // Hen Management Logic
  const addNewHen = () => {
    const newHen: Hen = {
      id: Math.random().toString(36).substr(2, 9),
      name: `母鸡 ${hens.length + 1}`,
      color: AVAILABLE_COLORS[hens.length % AVAILABLE_COLORS.length],
      avatar: AVAILABLE_AVATARS[hens.length % AVAILABLE_AVATARS.length]
    };
    setHens([...hens, newHen]);
    startEditHen(newHen);
  };

  const deleteHen = (id: string) => {
    if (confirm('确定要删除这只母鸡吗？之前的记录会保留，但它将不再出现在列表中。')) {
      setHens(hens.filter(h => h.id !== id));
    }
  };

  const startEditHen = (hen: Hen) => {
    setEditingHen(hen);
    setEditName(hen.name);
    setEditAvatar(hen.avatar);
    setEditColor(hen.color);
  };

  const saveHenEdit = () => {
    if (editingHen) {
      setHens(hens.map(h => h.id === editingHen.id ? { 
        ...h, 
        name: editName, 
        avatar: editAvatar, 
        color: editColor 
      } : h));
      setEditingHen(null);
    }
  };

  const getTodayStats = (henId: string) => {
    const henRecords = records.filter(r => r.henId === henId && r.date === todayStr);
    return {
      count: henRecords.length,
      avgWeight: henRecords.length > 0 ? (henRecords.reduce((s, r) => s + (r.weight || 0), 0) / henRecords.filter(r => r.weight).length || 0).toFixed(1) : '-'
    };
  };

  // Enhanced Stats Logic
  const statsData = useMemo(() => {
    if (statPeriod === StatPeriod.WEEK || statPeriod === StatPeriod.MONTH) {
      const days = statPeriod === StatPeriod.WEEK ? 7 : 30;
      const result: any[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayRecords = records.filter(r => r.date === dateStr);
        const data: any = { name: dateStr.slice(5) };
        hens.forEach(hen => {
          data[hen.name] = dayRecords.filter(r => r.henId === hen.id).length;
        });
        result.push(data);
      }
      return result;
    } else {
      // YEAR View - Monthly aggregate
      const currentYear = new Date().getFullYear();
      const result: any[] = [];
      for (let m = 0; m < 12; m++) {
        const monthName = `${m + 1}月`;
        const data: any = { name: monthName };
        const monthRecords = records.filter(r => {
          const rd = new Date(r.date);
          return rd.getFullYear() === currentYear && rd.getMonth() === m;
        });
        hens.forEach(hen => {
          data[hen.name] = monthRecords.filter(r => r.henId === hen.id).length;
        });
        result.push(data);
      }
      return result;
    }
  }, [records, hens, statPeriod]);

  const fetchAdvice = async () => {
    setIsLoadingAdvice(true);
    const advice = await getHenAdvice(records, hens);
    setAiAdvice(advice || '');
    setIsLoadingAdvice(false);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen pb-24 flex flex-col bg-amber-50/50">
      <header className="pt-8 px-6 pb-6 bg-white shadow-sm rounded-b-[40px] mb-6">
        <div className="flex justify-between items-center mb-1">
          <h1 className="text-2xl font-black text-amber-900">鸡舍管家 PRO</h1>
          <div className="bg-amber-100 px-3 py-1 rounded-full text-amber-700 text-xs font-black">
            共 {records.length} 枚 🥚
          </div>
        </div>
        <p className="text-slate-400 text-xs font-medium">精确记录每一份收获</p>
      </header>

      {/* Recording Weight Modal */}
      {recordingForHen && (
        <WeightModal 
          henName={recordingForHen.name}
          onSave={saveEggRecord}
          onCancel={() => setRecordingForHen(null)}
        />
      )}

      {/* Editing Record Modal */}
      {editingRecord && (
        <EditRecordModal 
          record={editingRecord}
          henName={hens.find(h => h.id === editingRecord.henId)?.name || '母鸡'}
          onSave={updateEggRecord}
          onCancel={() => setEditingRecord(null)}
        />
      )}

      {/* Hen Edit Modal */}
      {editingHen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 mb-6 text-center">编辑母鸡信息</h3>
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                <div className={`w-24 h-24 ${editColor} rounded-3xl flex items-center justify-center text-5xl shadow-inner mb-4 transition-colors duration-300`}>
                  {editAvatar}
                </div>
                <input 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="输入名称"
                  className="w-full bg-slate-100 rounded-2xl p-4 text-center font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">选择头像</label>
                <div className="grid grid-cols-5 gap-2">
                  {AVAILABLE_AVATARS.map(a => (
                    <button key={a} onClick={() => setEditAvatar(a)} className={`h-10 text-xl flex items-center justify-center rounded-xl transition-all ${editAvatar === a ? 'bg-amber-500 scale-110' : 'bg-slate-50 opacity-50'}`}>{a}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">选择底色</label>
                <div className="grid grid-cols-5 gap-2">
                  {AVAILABLE_COLORS.map(c => (
                    <button key={c} onClick={() => setEditColor(c)} className={`h-8 rounded-xl border-2 transition-all ${c} ${editColor === c ? 'border-amber-500 scale-110' : 'border-transparent opacity-60'}`} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={saveHenEdit} className="flex-1 bg-amber-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-amber-200 active:scale-95 transition-all">保存设置</button>
              <button onClick={() => setEditingHen(null)} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold">取消</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 px-4">
        {activeTab === Tab.TRACK && (
          <div className="space-y-4">
            {hens.map(hen => {
              const stats = getTodayStats(hen.id);
              return (
                <div key={hen.id} className="bg-white rounded-[32px] p-5 shadow-sm border border-white flex items-center">
                  <div 
                    onClick={() => startEditHen(hen)}
                    className={`w-14 h-14 ${hen.color} rounded-2xl flex items-center justify-center text-3xl shadow-inner cursor-pointer active:scale-90 transition-transform`}
                  >
                    {hen.avatar}
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="font-bold text-slate-800 flex items-center">
                      {hen.name}
                      <button onClick={() => startEditHen(hen)} className="ml-2 text-[10px] text-slate-300 hover:text-amber-500"><i className="fa-solid fa-pen"></i></button>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">今日: {stats.count}枚 {stats.avgWeight !== '-' && `(均重${stats.avgWeight}g)`}</p>
                  </div>
                  <button 
                    onClick={() => handleAddEgg(hen)}
                    className="bg-amber-100 hover:bg-amber-200 text-amber-700 w-12 h-12 rounded-2xl flex items-center justify-center transition-colors active:scale-95"
                  >
                    <i className="fa-solid fa-plus text-lg"></i>
                  </button>
                </div>
              )
            })}
            <button 
              onClick={addNewHen}
              className="w-full py-4 border-2 border-dashed border-amber-200 rounded-[32px] text-amber-500 font-bold flex items-center justify-center gap-2 hover:bg-amber-50 transition-colors"
            >
              <i className="fa-solid fa-plus-circle"></i> 新增母鸡
            </button>
          </div>
        )}

        {activeTab === Tab.MANAGE && (
          <div className="space-y-4">
             <h3 className="px-2 font-black text-slate-800 text-lg mb-2">管理我的鸡群 ({hens.length})</h3>
             {hens.map(hen => (
               <div key={hen.id} className="bg-white p-4 rounded-3xl flex items-center justify-between shadow-sm">
                 <div className="flex items-center">
                   <div className={`w-10 h-10 ${hen.color} rounded-xl flex items-center justify-center text-xl mr-3 shadow-inner`}>{hen.avatar}</div>
                   <div>
                     <div className="font-bold text-slate-800">{hen.name}</div>
                     <div className="text-[10px] text-slate-400">点击右侧按钮管理</div>
                   </div>
                 </div>
                 <div className="flex gap-2">
                   <button onClick={() => startEditHen(hen)} className="p-2 text-slate-400 hover:text-amber-500 transition-colors"><i className="fa-solid fa-gear"></i></button>
                   <button onClick={() => deleteHen(hen.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                 </div>
               </div>
             ))}
          </div>
        )}

        {activeTab === Tab.STATS && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[32px] shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-800 px-1">产量分布</h3>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {[
                    { id: StatPeriod.WEEK, label: '周' },
                    { id: StatPeriod.MONTH, label: '月' },
                    { id: StatPeriod.YEAR, label: '年' }
                  ].map(p => (
                    <button 
                      key={p.id}
                      onClick={() => setStatPeriod(p.id)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${statPeriod === p.id ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                    <YAxis axisLine={false} tickLine={false} hide />
                    <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)'}} />
                    <Legend iconType="circle" />
                    {hens.map((hen, idx) => (
                      <Bar key={hen.id} name={hen.name} dataKey={hen.name} fill={idx % 2 === 0 ? '#fb923c' : '#94a3b8'} radius={[4, 4, 0, 0]} stackId="a" />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] shadow-sm">
               <h3 className="font-black text-slate-800 mb-4 px-1">流水记录</h3>
               <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                 {records.length === 0 ? (
                   <div className="text-center py-12 text-slate-300">还没有记录呢</div>
                 ) : (
                   [...records].sort((a,b) => b.timestamp - a.timestamp).map(r => {
                     const hen = hens.find(h => h.id === r.henId) || { name: '已离场', avatar: '👻', color: 'bg-slate-100' };
                     return (
                       <div key={r.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-white group">
                         <div className="flex items-center">
                           <span className="text-xl mr-3">{hen.avatar}</span>
                           <div>
                             <div className="font-bold text-slate-700 text-sm">{hen.name}</div>
                             <div className="text-[10px] text-slate-400">{r.date}</div>
                           </div>
                         </div>
                         <div className="flex items-center gap-3">
                            <div className="text-amber-600 font-black italic text-right">
                              {r.weight ? `${r.weight}g` : '未记录'}
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => setEditingRecord(r)} className="p-2 text-slate-300 hover:text-amber-500 transition-colors"><i className="fa-solid fa-pen-to-square text-xs"></i></button>
                              <button onClick={() => deleteRecord(r.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can text-xs"></i></button>
                            </div>
                         </div>
                       </div>
                     )
                   })
                 )}
               </div>
            </div>
          </div>
        )}

        {activeTab === Tab.TIPS && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden">
               <div className="relative z-10">
                 <h2 className="text-2xl font-black mb-1">养殖专家</h2>
                 <p className="text-indigo-100 text-xs mb-8 opacity-80">分析产蛋规律与重量变化</p>
                 <button onClick={fetchAdvice} disabled={isLoadingAdvice} className="w-full bg-white text-indigo-600 font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-70">
                   {isLoadingAdvice ? <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> 分析中...</> : '获取专家诊断'}
                 </button>
               </div>
               <i className="fa-solid fa-microchip absolute -bottom-6 -right-6 text-white/10 text-[12rem]"></i>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 min-h-[300px]">
              {aiAdvice ? (
                <div className="prose prose-slate max-w-none">
                  <div className="flex items-center text-indigo-600 font-black mb-6"><i className="fa-solid fa-feather-pointed mr-2"></i> 专家报告：</div>
                  <div className="text-slate-600 text-sm leading-loose whitespace-pre-wrap">{aiAdvice}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300 text-center">
                   <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><i className="fa-solid fa-stethoscope text-2xl"></i></div>
                   <p className="text-xs font-medium px-4">根据您的真实数据进行深度分析</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-6 right-6 max-w-[calc(448px-3rem)] mx-auto bg-slate-900/90 backdrop-blur-xl rounded-[32px] px-6 py-4 flex justify-between items-center shadow-2xl z-50">
        {[
          { tab: Tab.TRACK, icon: 'fa-egg', label: '记录' },
          { tab: Tab.STATS, icon: 'fa-chart-simple', label: '统计' },
          { tab: Tab.MANAGE, icon: 'fa-users-gear', label: '管理' },
          { tab: Tab.TIPS, icon: 'fa-wand-magic-sparkles', label: 'AI专家' }
        ].map(item => (
          <button 
            key={item.tab}
            onClick={() => setActiveTab(item.tab)}
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${activeTab === item.tab ? 'text-amber-400 scale-110' : 'text-slate-500'}`}
          >
            <i className={`fa-solid ${item.icon} text-lg`}></i>
            <span className="text-[9px] font-black tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
