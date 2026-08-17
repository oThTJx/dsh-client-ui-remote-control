/** Copy dictionaries for the remote-control pairing Settings section. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  tab: '远程控制',
  loading: '正在读取配对状态…',
  error: '暂时无法读取配对状态。',
  retry: '重试',
  refresh: '刷新',
  connecting: '正在连接中继…',
  pairing: '等待配对',
  pairingError: '连接出错',
  codeLabel: '配对码',
  codeExpires: '有效期至',
  phoneUrlLabel: '手机连接地址',
  qrAlt: '配对二维码',
  addressLabel: '中继地址',
  addressPlaceholder: '留空使用本地内嵌中继',
  save: '保存',
  testConnection: '测试连接',
  testing: '测试中…',
  testOk: '连接正常',
  testFail: '连接失败',
  devices: '已配对设备',
  devicesEmpty: '暂无已配对设备。',
  deviceSince: '配对于',
  revoke: '删除',
  revokeConfirm: '删除后该手机需重新扫码配对，确定删除？',
  reset: '重置设备身份',
  resetConfirm: '将重新生成设备身份并断开所有已配对手机，确定重置？',
} satisfies Record<string, string>

/** Remote-control pairing tab locale key union. */
export type RemoteControlLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  tab: 'Remote control',
  loading: 'Reading pairing status…',
  error: 'Pairing status is temporarily unavailable.',
  retry: 'Retry',
  refresh: 'Refresh',
  connecting: 'Connecting to the relay…',
  pairing: 'Waiting to pair',
  pairingError: 'Connection error',
  codeLabel: 'Pairing code',
  codeExpires: 'Expires at',
  phoneUrlLabel: 'Phone connection address',
  qrAlt: 'Pairing QR code',
  addressLabel: 'Relay address',
  addressPlaceholder: 'Leave empty for the embedded local relay',
  save: 'Save',
  testConnection: 'Test connection',
  testing: 'Testing…',
  testOk: 'Connected',
  testFail: 'Connection failed',
  devices: 'Paired devices',
  devicesEmpty: 'No paired devices.',
  deviceSince: 'Paired at',
  revoke: 'Remove',
  revokeConfirm: 'The phone must scan and pair again after removal. Remove it?',
  reset: 'Reset device identity',
  resetConfirm: 'A new identity will be generated and every paired phone disconnected. Reset?',
} satisfies Record<RemoteControlLocaleKey, string>
