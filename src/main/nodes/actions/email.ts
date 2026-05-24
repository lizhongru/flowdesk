import { nodeRegistry } from '../registry';
import { resolveConfig } from '../../engine/resolver';

nodeRegistry.set('email', async (data, _input, context) => {
  const config = resolveConfig(data as any, context);
  const { host, port, secure, user, password, from, to, cc, subject, body } = config as any;

  if (!host) throw new Error('未指定 SMTP 服务器');
  if (!user) throw new Error('未指定用户名');
  if (!password) throw new Error('未指定密码');
  if (!to) throw new Error('未指定收件人');

  const nodemailer = await import('nodemailer');

  const transporter = nodemailer.createTransport({
    host,
    port: Number(port) || 465,
    secure: secure !== false,
    auth: { user, pass: password },
  });

  const mailOptions: Record<string, unknown> = {
    from: from || user,
    to,
    subject: subject || '(无主题)',
    text: body || '',
  };
  if (cc) mailOptions.cc = cc;

  context.log('email', 'info', `发送邮件至 ${to}${cc ? `, 抄送 ${cc}` : ''}...`);

  // 带超时的发送：SMTP 连接可能发送成功但不 resolve
  const sendWithTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`SMTP 发送超时 (${ms / 1000}秒)`)), ms);
      promise.then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); }
      );
    });

  const info = await sendWithTimeout(transporter.sendMail(mailOptions), 30000);

  // 关闭 SMTP 连接，避免进程挂起
  transporter.close();

  context.log('email', 'info', `邮件发送成功: ${info.messageId}`);

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
});
