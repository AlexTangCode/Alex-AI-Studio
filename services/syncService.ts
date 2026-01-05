
/**
 * 增强型同步服务 - 针对移动端优化
 */

const PANTRY_ID = '08b4998e-4903-455b-9d66-5089e8236683';
const PANTRY_BASE = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket`;

const fetchWithRetry = async (url: string, options: any, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok || response.status === 404) return response;
      if (i === retries) throw new Error(`HTTP Error ${response.status}`);
    } catch (err: any) {
      clearTimeout(timeout);
      if (i === retries) throw err;
      // 指数退避
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('网络请求失败');
};

export const pushToCloud = async (cloudId: string, data: any) => {
  const payload = JSON.stringify({
    hens: data.hens || [],
    records: data.records || [],
    lastUpdated: Date.now()
  });

  try {
    const res = await fetchWithRetry(`${PANTRY_BASE}/${cloudId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    return res.ok;
  } catch (e) {
    console.error("Sync Error:", e);
    throw new Error('同步失败，请稍后重试');
  }
};

export const pullFromCloud = async (cloudId: string) => {
  try {
    // 添加时间戳防止某些手机浏览器缓存 404
    const t = Date.now();
    const res = await fetchWithRetry(`${PANTRY_BASE}/${cloudId}?t=${t}`, { 
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (res.status === 404) return { isNewUser: true };
    
    return await res.json();
  } catch (e) {
    console.warn("Pulling cloud data failed:", e);
    // 网络错误不应标记为新用户，应让调用者知道是异常
    throw e;
  }
};

export const encodeData = (data: any) => {
  try { return btoa(encodeURIComponent(JSON.stringify(data))); }
  catch (e) { return ""; }
};

export const decodeData = (code: string) => {
  try { return JSON.parse(decodeURIComponent(atob(code))); }
  catch (e) { return null; }
};
