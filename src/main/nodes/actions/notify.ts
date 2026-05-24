import { Notification } from 'electron';
import { nodeRegistry } from '../registry';
import { resolveConfig } from '../../engine/resolver';

nodeRegistry.set('notify', async (data, _input, context) => {
  const config = resolveConfig(data as any, context);
  const { title, body } = config as any;

  if (!title) throw new Error('未指定通知标题');

  const notification = new Notification({
    title,
    body: body || '',
  });

  notification.show();

  return { sent: true };
});
