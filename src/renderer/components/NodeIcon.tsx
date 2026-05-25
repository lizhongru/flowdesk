import {
  Play, Clock, Eye, Keyboard,
  FolderSync, Terminal, Globe, Clipboard, Bell, Timer,
  GitBranch, Repeat, Variable, ShieldAlert, Workflow,
  RotateCcw, Shuffle, Mail, Database, Power, Wifi,
} from 'lucide-react';
import type { ComponentType } from 'react';

const iconMap: Record<string, ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  Play, Clock, Eye, Keyboard,
  FolderSync, Terminal, Globe, Clipboard, Bell, Timer,
  GitBranch, Repeat, Variable, ShieldAlert, Workflow,
  RotateCcw, Shuffle, Mail, Database, Power, Wifi,
};

interface NodeIconProps {
  name: string;
  size?: number;
  style?: React.CSSProperties;
}

export default function NodeIcon({ name, size = 14, style }: NodeIconProps) {
  const Icon = iconMap[name];
  if (Icon) return <Icon size={size} style={style} />;
  // 兼容旧数据：icon 是 emoji 时直接显示
  return <span style={{ fontSize: size, ...style }}>{name}</span>;
}
