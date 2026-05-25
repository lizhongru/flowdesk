import { nodeRegistry } from '../registry';
import { resolveConfig } from '../../engine/resolver';

function rc4Encrypt(src: string, passwd: string): string {
  src = src.trim();
  const plen = passwd.length;
  const size = src.length;

  const key = new Array(256);
  const sbox = new Array(256);
  const output: string[] = [];

  for (let i = 0; i < 256; i++) {
    key[i] = passwd.charCodeAt(i % plen);
    sbox[i] = i;
  }

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + sbox[i] + key[i]) % 256;
    const temp = sbox[i];
    sbox[i] = sbox[j];
    sbox[j] = temp;
  }

  let a = 0, b = 0;
  for (let i = 0; i < size; i++) {
    a = (a + 1) % 256;
    b = (b + sbox[a]) % 256;
    const temp = sbox[a];
    sbox[a] = sbox[b];
    sbox[b] = temp;
    const c = (sbox[a] + sbox[b]) % 256;
    let hex = (src.charCodeAt(i) ^ sbox[c]).toString(16);
    if (hex.length === 1) hex = '0' + hex;
    else if (hex.length === 0) hex = '00';
    output.push(hex);
  }

  return output.join('');
}

async function checkNetwork(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('http://connect.rom.miui.com/generate_204', {
      signal: controller.signal,
      redirect: 'manual',
    });
    clearTimeout(timer);
    return res.status === 204;
  } catch {
    return false;
  }
}

nodeRegistry.set('wifi-login', async (data, _input, context) => {
  const config = resolveConfig(data as any, context);
  const { portalUrl, userName, password } = config as any;

  if (!portalUrl) throw new Error('未指定 Portal URL');
  if (!userName) throw new Error('未指定用户名');
  if (!password) throw new Error('未指定密码');

  context.log('wifi-login', 'info', '检测网络连通性...');
  const online = await checkNetwork();
  if (online) {
    context.log('wifi-login', 'info', '网络已连通，无需登录');
    return { success: true, message: '网络已连通', userName };
  }

  context.log('wifi-login', 'info', '网络未连通，开始 Portal 登录...');

  const authTag = Date.now().toString();
  const encryptedPwd = rc4Encrypt(password, authTag);

  const params = new URLSearchParams();
  params.append('opr', 'pwdLogin');
  params.append('userName', userName);
  params.append('pwd', encryptedPwd);
  params.append('auth_tag', authTag);
  params.append('rememberPwd', '0');

  const loginUrl = portalUrl.replace(/\/$/, '') + '/login.php';

  context.log('wifi-login', 'info', `→ POST ${loginUrl}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  let response: Response;
  try {
    response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Portal 登录请求超时: ${loginUrl}`);
    }
    throw new Error(`Portal 登录请求失败: ${err.message}`);
  }
  clearTimeout(timer);

  const rawText = await response.text();
  context.log('wifi-login', 'info', `← ${response.status}\n${rawText.slice(0, 500)}`);

  if (!response.ok) {
    throw new Error(`Portal 登录失败 (${response.status}): ${rawText.slice(0, 200)}`);
  }

  context.log('wifi-login', 'info', 'Portal 登录请求已发送，验证网络...');

  await new Promise(resolve => setTimeout(resolve, 2000));
  const verifyOnline = await checkNetwork();

  if (verifyOnline) {
    context.log('wifi-login', 'info', '✓ 网络已连通，登录成功');
    return { success: true, message: '登录成功', userName };
  }

  context.log('wifi-login', 'warn', '登录请求已发送，但网络仍未连通');
  return { success: false, message: '登录请求已发送，但网络未恢复', userName };
});
