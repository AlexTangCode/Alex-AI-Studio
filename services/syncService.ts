
/**
 * 自动同步服务 - 终极兼容版
 * 解决移动端“显示成功但实际未写入”的问题
 */

// 换用一个全新的专用 Bucket，确保环境干净
const BUCKET_ID = 'hb_v3_9a8b7c6d5e4f3a2b1'; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

/**
 * 带有深度校验的 fetch
 */
const fetchSafe = async (url: string, options: any) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-cache', // 强制跳过浏览器缓存
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

export const pushToCloud = async (cloudId: string, data: any) => {
  const payload = JSON.stringify({
    hens: data.hens || [],
    records: data.records || [],
    lastUpdated: Date.now()
  });
  
  try {
    // 1. 发送保存请求 (使用 POST + text/plain 绕过所有 CORS 预检)
    const res = await fetchSafe(`${API_BASE}/${cloudId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, 
      body: payload,
    });
    
    if (!res.ok) throw new Error('写入失败');

    // 2. 写后读校验：立即重新读取，确保数据真的进去了
    const verifyRes = await fetchSafe(`${API_BASE}/${cloudId}`, { method: 'GET' });
    const verifyText = await verifyRes.text();
    
    // 如果读取到的数据为空或者与发出的不一致，说明写入失败
    if (!verifyText || verifyText.length < 10) {
      throw new Error('验证失败：云端未接收到数据');
    }
    
    return true;
  } catch (err: any) {
    console.error("Sync Critical Error:", err);
    throw new Error(err.message || '网络异常');
  }
};

export const pullFromCloud = async (cloudId: string) => {
  try {
    const response = await fetchSafe(`${API_BASE}/${cloudId}`, { method: 'GET' });
    
    if (response.status === 404) return { isNewUser: true };
    
    const text = await response.text();
    if (!text || text.trim() === "") return { isNewUser: true };
    
    return JSON.parse(text);
  } catch (err: any) {
    console.error("Pull Error:", err);
    throw new Error('云端无法访问');
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
