
/**
 * 自动同步服务 - 终极稳定版
 * 修复了跨域预检(CORS Preflight)可能导致的失败
 */

// 严格 20 位标识符，确保唯一且稳定
const BUCKET_ID = 'stable_hens_2025_v99'; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

export const pushToCloud = async (cloudId: string, data: any) => {
  // 增加时间戳，确保服务器感知到更新
  const payload = JSON.stringify({ ...data, lastUpdated: Date.now() });
  
  const response = await fetch(`${API_BASE}/${cloudId}`, {
    method: 'PUT',
    // 简化请求头，避免复杂的预检请求
    body: payload,
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`写入失败(${response.status}): ${text.substring(0, 20)}`);
  }
  return true;
};

export const pullFromCloud = async (cloudId: string) => {
  // 添加随机数防止任何形式的 CDN 或浏览器缓存
  const url = `${API_BASE}/${cloudId}?t=${Date.now()}`;
  
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store'
  });
  
  if (response.status === 404) return { isNewUser: true };
  if (!response.ok) throw new Error(`读取失败(${response.status})`);
  
  const data = await response.json();
  return data;
};
