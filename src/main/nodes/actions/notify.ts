import { Notification } from 'electron';
import path from 'node:path';
import { nodeRegistry } from '../registry';
import { resolveConfig } from '../../engine/resolver';

nodeRegistry.set('notify', async (data, _input, context) => {
  const config = resolveConfig(data as any, context);
  const { title, body } = config as any;

  if (!title) throw new Error('未指定通知标题');

  const notification = new Notification({
    title,
    body: body || '',
    icon: path.join(__dirname, '../../resources/icon.png'),
  });

  notification.show();

  return { sent: true };
});
