
/**
 * 自动同步服务 - 增强稳定版
 */

// 更换一个全新的、高度随机的 20 位 16 进制 Bucket ID
const BUCKET_ID = 'a1b2c3d4e5f6a7b8c9d0'; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

/**
 * 带有超时控制的 fetch
 */
const fetchWithTimeout = async (url: string, options: any, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

export const pushToCloud = async (cloudId: string, data: any) => {
  const payload = JSON.stringify({ ...data, lastUpdated: Date.now() });
  
  try {
    const response = await fetchWithTimeout(`${API_BASE}/${cloudId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain', 
      },
      body: payload,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return true;
  } catch (err: any) {
    console.error("Upload error:", err);
    throw new Error(err.name === 'AbortError' ? '连接超时' : '网络被拦截');
  }
};

export const pullFromCloud = async (cloudId: string) => {
  const url = `${API_BASE}/${cloudId}?cache_bust=${Date.now()}`;
  
  try {
    const response = await fetchWithTimeout(url, { method: 'GET' });
    
    if (response.status === 404) return { isNewUser: true };
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const text = await response.text();
    return JSON.parse(text);
  } catch (err: any) {
    console.error("Download error:", err);
    throw new Error('云端无法访问');
  }
};

/**
 * 手动同步：将数据转换为 Base64 字符串
 */
export const encodeData = (data: any) => {
  try {
    const str = JSON.stringify(data);
    return btoa(encodeURIComponent(str));
  } catch (e) {
    return "";
  }
};

/**
 * 手动同步：从 Base64 字符串解析数据
 */
export const decodeData = (code: string) => {
  try {
    const str = decodeURIComponent(atob(code));
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
};
