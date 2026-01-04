
import { User } from '../types';

/**
 * 将用户输入的简单同步码转换为唯一的云端 ID
 */
export const authenticate = async (code: string): Promise<User> => {
  const sanitizedCode = code.trim().toLowerCase();
  // 使用 SHA-256 将简单的码转换为 24 位稳定的 API Key
  const msgUint8 = new TextEncoder().encode("hens_salt_" + sanitizedCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const cloudId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 24);
  
  return {
    email: sanitizedCode, // 这里的 email 字段现在存储同步码
    cloudId
  };
};
