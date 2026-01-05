
/**
 * 自动同步服务 - 深度兼容多方案版
 * 集成了多套同步后端，防止单一域名被拦截
 */

// 方案 A: Pantry Cloud (稳定、支持跨域)
const PANTRY_ID = '08b4998e-4903-455b-9d66-5089e8236683';
const PANTRY_BASE = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket`;

// 方案 B: KeyValue.xyz (备用，极简)
const KV_BASE = `https://api.keyvalue.xyz`;

const fetchWithTimeout = async (url: string, options: any, timeout = 7000) => {
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
    ver: '4.0'
  });

  // 尝试 Pantry (主方案)
  try {
    const res = await fetchWithTimeout(`${PANTRY_BASE}/${cloudId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    if (res.ok) return true;
  } catch (e) {
    console.warn("Pantry failed, trying fallback...");
  }

  // 尝试 KeyValue.xyz (备选方案)
  try {
    const res = await fetchWithTimeout(`${KV_BASE}/${cloudId}/hens_app`, {
      method: 'POST',
      body: payload,
    });
    return res.ok;
  } catch (e) {
    throw new Error('网络连接受限');
  }
};

export const pullFromCloud = async (cloudId: string) => {
  // 尝试从 Pantry 读取
  try {
    const res = await fetchWithTimeout(`${PANTRY_BASE}/${cloudId}`, { method: 'GET' });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Pantry pull failed, trying fallback...");
  }

  // 尝试从 KeyValue.xyz 读取
  try {
    const res = await fetchWithTimeout(`${KV_BASE}/${cloudId}/hens_app`, { method: 'GET' });
    if (res.ok) {
      const text = await res.text();
      return text ? JSON.parse(text) : { isNewUser: true };
    }
  } catch (e) {}

  return { isNewUser: true };
};

export const encodeData = (data: any) => {
  try { return btoa(encodeURIComponent(JSON.stringify(data))); }
  catch (e) { return ""; }
};

export const decodeData = (code: string) => {
  try { return JSON.parse(decodeURIComponent(atob(code))); }
  catch (e) { return null; }
};
