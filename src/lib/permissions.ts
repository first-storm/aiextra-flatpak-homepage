// Turns Flatpak finish-args into short, human-readable sandbox permissions.

export interface Permission {
  label: string;
  args: string[];
  notable?: boolean; // widens the sandbox beyond the usual desktop-app set
}

const TALK_NAMES: Record<string, string> = {
  'org.freedesktop.Notifications': 'Desktop notifications',
  'org.kde.StatusNotifierWatcher': 'Tray icon',
  'org.freedesktop.secrets': 'System keyring',
  'org.kde.kwalletd5': 'System keyring',
  'org.kde.kwalletd6': 'System keyring',
  'org.freedesktop.ScreenSaver': 'Keep the screen awake',
  'org.freedesktop.portal.Fcitx': 'Input methods',
};

const FILESYSTEMS: Record<string, string> = {
  'xdg-download': 'Downloads folder',
  'xdg-documents': 'Documents folder',
  'xdg-pictures': 'Pictures folder',
  'xdg-desktop': 'Desktop folder',
  'xdg-music': 'Music folder',
  'xdg-videos': 'Videos folder',
  home: 'Home folder',
  host: 'All files on the host',
};

function one(arg: string): Permission | null {
  const [flag, rawValue = ''] = arg.split('=', 2);
  const value = rawValue.trim();
  switch (flag) {
    case '--share':
      return value === 'network' ? { label: 'Network access', args: [arg] } : null; // ipc is an X11 detail
    case '--socket':
      if (value === 'wayland') return { label: 'Wayland display', args: [arg] };
      if (value === 'fallback-x11') return { label: 'X11 display (fallback)', args: [arg] };
      if (value === 'x11') return { label: 'X11 display', args: [arg] };
      if (value === 'pulseaudio') return { label: 'Sound and microphone', args: [arg] };
      if (value === 'ssh-auth') return { label: 'SSH agent', args: [arg], notable: true };
      return { label: `Socket: ${value}`, args: [arg] };
    case '--device':
      if (value === 'dri') return { label: 'GPU acceleration', args: [arg] };
      return { label: value === 'all' ? 'All devices (webcams, etc.)' : `Device: ${value}`, args: [arg], notable: value === 'all' };
    case '--talk-name':
      if (value === 'org.freedesktop.Flatpak')
        return { label: 'Run commands on the host (flatpak-spawn)', args: [arg], notable: true };
      return { label: TALK_NAMES[value] ?? `D-Bus: ${value}`, args: [arg] };
    case '--filesystem': {
      const [path, mode] = value.split(':');
      const label = FILESYSTEMS[path] ?? `Files: ${path}`;
      return {
        label: mode === 'ro' ? `${label} (read-only)` : label,
        args: [arg],
        notable: path === 'home' || path === 'host',
      };
    }
    case '--persist':
      return { label: `Keeps ~/${value} in the app's private data`, args: [arg] };
    case '--env':
    case '--own-name':
    case '--system-talk-name':
      return null;
    default:
      return { label: arg, args: [arg] };
  }
}

export function describePermissions(finishArgs: string[]): Permission[] {
  const out: Permission[] = [];
  for (const arg of finishArgs) {
    const p = one(String(arg));
    if (!p) continue;
    const same = out.find((o) => o.label === p.label);
    if (same) same.args.push(...p.args);
    else out.push(p);
  }
  return out;
}
