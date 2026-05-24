import { nodeRegistry } from '../registry';
import { resolveConfig } from '../../engine/resolver';

nodeRegistry.set('http-request', async (data, _input, context) => {
  const config = resolveConfig(data as any, context);
  const { method, url, headers, body, timeout } = config as any;

  if (!url) throw new Error('未指定 URL');

  let parsedHeaders: Record<string, string> = {};
  if (headers && typeof headers === 'string') {
    try { parsedHeaders = JSON.parse(headers); } catch {}
  } else if (headers && typeof headers === 'object') {
    parsedHeaders = headers;
  }

  let parsedBody: string | undefined;
  if (body && method !== 'GET') {
    if (typeof body === 'string') {
      parsedBody = body;
    } else {
      parsedBody = JSON.stringify(body);
    }
  }

  const reqMethod = method || 'GET';
  context.log('http-request', 'info',
    `→ ${reqMethod} ${url}\n` +
    (Object.keys(parsedHeaders).length ? `Headers: ${JSON.stringify(parsedHeaders)}\n` : '') +
    (parsedBody ? `Body: ${parsedBody}` : '')
  );

  const timeoutMs = (timeout || 30) * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: reqMethod,
      headers: parsedHeaders,
      body: parsedBody,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`HTTP 请求超时 (${timeout || 30}s): ${url}`);
    }
    throw err;
  }
  clearTimeout(timer);

  const MAX_BODY = 1024 * 1024; // 1MB
  const rawText = await response.text();

  let responseData: unknown;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      responseData = JSON.parse(rawText.length > MAX_BODY ? rawText.slice(0, MAX_BODY) : rawText);
    } catch {
      responseData = rawText.length > MAX_BODY ? rawText.slice(0, MAX_BODY) + '\n... [响应已截断]' : rawText;
    }
  } else {
    responseData = rawText.length > MAX_BODY ? rawText.slice(0, MAX_BODY) + '\n... [响应已截断]' : rawText;
  }

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  if (!response.ok) {
    const bodyPreview = typeof responseData === 'string'
      ? responseData.slice(0, 500)
      : JSON.stringify(responseData, null, 2).slice(0, 500);
    context.log('http-request', 'error',
      `← ${response.status} ${response.statusText}\n${bodyPreview}`
    );
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${bodyPreview}`);
  }

  context.log('http-request', 'info',
    `← ${response.status} ${response.statusText}\n` +
    (typeof responseData === 'string'
      ? responseData.slice(0, 500)
      : JSON.stringify(responseData, null, 2).slice(0, 500))
  );

  return {
    status: response.status,
    headers: responseHeaders,
    data: responseData,
  };
});
