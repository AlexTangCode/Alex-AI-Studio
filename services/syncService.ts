
/**
 * 自动同步服务 - Pantry Cloud 稳定版
 * 使用标准 POST 请求，解决移动端 PUT 请求被拦截的问题
 */

// 这是为本应用分配的独立 Pantry ID
const PANTRY_ID = '08b4998e-4903-455b-9d66-5089e8236683';
const API_BASE = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket`;

/**
 * 带有超时控制的 fetch
 */
const fetchWithTimeout = async (url: string, options: any, timeout = 8000) => {
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
  const payload = JSON.stringify({
    hens: data.hens || [],
    records: data.records || [],
    lastUpdated: Date.now(),
    client: 'mobile_hen_helper'
  });
  
  try {
    // Pantry 使用 POST 创建或更新 Basket，这是移动端最稳定的请求方式
    const response = await fetchWithTimeout(`${API_BASE}/${cloudId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return true;
  } catch (err: any) {
    console.error("Cloud Save Error:", err);
    throw new Error(err.name === 'AbortError' ? '同步超时' : '云端拒绝连接');
  }
};

export const pullFromCloud = async (cloudId: string) => {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/${cloudId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    // Pantry 如果找不到 Basket 会返回 400 或 404
    if (response.status === 400 || response.status === 404) {
      return { isNewUser: true };
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (err: any) {
    console.error("Cloud Load Error:", err);
    throw new Error('无法读取云端');
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
