
import { User } from '../types';

/**
 * 将用户输入的简单同步码转换为唯一的云端 ID
 * 增加容错处理：即使 crypto 模块不可用也能正常运行
 */
export const authenticate = async (code: string): Promise<User> => {
  const sanitizedCode = code.trim().toLowerCase();
  let cloudId = '';

  try {
    if (window.crypto && window.crypto.subtle) {
      const msgUint8 = new TextEncoder().encode("hens_v2_" + sanitizedCode);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      cloudId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 24);
    } else {
      // 降级方案：基础 Base64 转换
      cloudId = btoa("hens_fallback_" + sanitizedCode).replace(/[^a-zA-Z0-9]/g, '').substring(0, 24);
    }
  } catch (e) {
    cloudId = sanitizedCode.padEnd(24, '0');
  }
  
  return {
    email: sanitizedCode,
    cloudId
  };
};
