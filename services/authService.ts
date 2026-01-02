
import { User } from '../types';

/**
 * 将邮箱和密码转换为唯一的云端 ID
 * 使用 SHA-256 哈希确保安全性
 */
export const authenticate = async (email: string, pass: string): Promise<User> => {
  const msgUint8 = new TextEncoder().encode(email.toLowerCase().trim() + pass);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const cloudId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 24);
  
  return {
    email: email.toLowerCase().trim(),
    cloudId
  };
};
