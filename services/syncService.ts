
/**
 * 自动同步服务 - 深度兼容版
 * 采用“简单请求”策略，绕过移动端防火墙对 API 的拦截
 */

// 使用一个全新的、符合标准的 20 位 16 进制 Bucket ID
const BUCKET_ID = '7f9b8c2d1e0a4f5b6c7d'; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

/**
 * 带有超时和异常处理的 fetch
 */
const fetchWithRetry = async (url: string, options: any, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        // 关键：使用 no-cache 确保每次都从服务器获取最新数据
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
      if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (i === retries) throw err;
      // 等待 1 秒后重试
      await new Promise(resolve => setTimeout(resolve, 1000));
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
    // 关键修复：使用 text/plain 避免触发 OPTIONS 预检请求（Simple Request 模式）
    await fetchWithRetry(`${API_BASE}/${cloudId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', 
      },
      body: payload,
    });
    return true;
  } catch (err: any) {
    console.error("Cloud Push Failed:", err);
    throw new Error('云端写入失败，请检查联网');
  }
};

export const pullFromCloud = async (cloudId: string) => {
  try {
    const response = await fetchWithRetry(`${API_BASE}/${cloudId}`, {
      method: 'GET'
    });
    
    if (response.status === 404) {
      return { isNewUser: true };
    }
    
    const text = await response.text();
    if (!text) return { isNewUser: true };
    
    return JSON.parse(text);
  } catch (err: any) {
    console.error("Cloud Pull Failed:", err);
    throw new Error('云端无法访问');
  }
};

export const encodeData = (data: any) => {
  try {
    return btoa(encodeURIComponent(JSON.stringify(data)));
  } catch (e) {
    return "";
  }
};

export const decodeData = (code: string) => {
  try {
    return JSON.parse(decodeURIComponent(atob(code)));
  } catch (e) {
    return null;
  }
};
