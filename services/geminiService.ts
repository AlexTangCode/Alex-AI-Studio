
import { GoogleGenAI } from "@google/genai";
import { EggRecord, Hen } from "../types";

export const getHenAdvice = async (records: EggRecord[], hens: Hen[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  // Prepare a more detailed summary for AI
  const recentRecords = records.slice(-30);
  const summary = hens.map(hen => {
    const henRecords = recentRecords.filter(r => r.henId === hen.id);
    const avgWeight = henRecords.length > 0 
      ? (henRecords.reduce((s, r) => s + (r.weight || 0), 0) / henRecords.filter(r => r.weight).length || 0).toFixed(1)
      : '未知';
    return `${hen.name}: 最近记录${henRecords.length}枚, 平均重${avgWeight}g`;
  }).join('; ');

  const prompt = `
    我管理着一个小型鸡群：${hens.map(h => h.name).join(', ')}。
    最近的生产数据摘要：${summary || '暂无详细记录'}。
    
    请根据这些数据，给我提供 3 条实用的专业养鸡建议：
    1. 分析产蛋频率和蛋重是否正常（通常鸡蛋在50-70g之间）。
    2. 如果蛋重过轻或过重，给出饲料调整建议。
    3. 针对目前的鸡群规模给出一条环境管理小贴士。
    
    语气要像一个经验丰富的老农夫，亲切且专业。中文回复，格式简练。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 专家正在鸡舍忙碌，请稍后再试。记得检查水槽是否干净哦！";
  }
};
