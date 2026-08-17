import { useEffect, useState, type ReactNode } from 'react'
import type {
  PairingSnapshot,
  ResetIdentitySnapshot,
  RevokeSnapshot,
  SessionsSnapshot,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteControlLocaleKey } from './locales.ts'
import css from './RemoteControlSettingsTab.module.css'

/** Registration-side Remote face used by the section. */
export interface RemoteControlSettingsTabInjected {
  /** Current pairing snapshot (QR data URL included when a code is live). */
  pairing: () => Promise<PairingSnapshot>
  /** Bound app sessions of this device. */
  sessions: () => Promise<SessionsSnapshot>
  /** Ask the relay to drop one app session. */
  revoke: (sessionId: string) => Promise<RevokeSnapshot>
  /** Regenerate the device identity and drop every bound session. */
  resetIdentity: () => Promise<ResetIdentitySnapshot>
}

/** Full component props assembled by the Settings slot renderer. */
export type RemoteControlSettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.remoteControl'>
  & InjectFace<RemoteControlSettingsTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly pairing: PairingSnapshot; readonly sessions: SessionsSnapshot }

const STATUS_KEYS = {
  connecting: 'connecting',
  pairing: 'pairing',
  error: 'pairingError',
} satisfies Record<Exclude<PairingSnapshot['status'], never>, RemoteControlLocaleKey>

/** Localized short status line for the pairing snapshot. */
function statusLabel(status: PairingSnapshot['status'], t: RemoteControlSettingsTabProps['t']): string {
  return t(STATUS_KEYS[status])
}

/** Format an epoch ms as a localized date-time string. */
function formatTime(epochMs: number, locale: string): string {
  return new Date(epochMs).toLocaleString(locale)
}

/** Render the remote-control pairing section: QR, code, and bound devices. */
export function RemoteControlSettingsTab({
  pairing,
  sessions,
  revoke,
  resetIdentity,
  t,
}: RemoteControlSettingsTabProps): ReactNode {
  const [state, setState] = useState<ViewState>({ status: 'loading' })

  const reload = (): void => {
    setState({ status: 'loading' })
    void Promise.all([pairing(), sessions()]).then(
      ([pairingSnapshot, sessionsSnapshot]) => {
        setState({ status: 'ready', pairing: pairingSnapshot, sessions: sessionsSnapshot })
      },
      () => { setState({ status: 'error' }) },
    )
  }

  useEffect(reload, [pairing, sessions])

  const onRevoke = (sessionId: string): void => {
    if (!globalThis.confirm(t('revokeConfirm'))) return
    void revoke(sessionId).then(reload, () => { setState({ status: 'error' }) })
  }

  const onReset = (): void => {
    if (!globalThis.confirm(t('resetConfirm'))) return
    void resetIdentity().then(reload, () => { setState({ status: 'error' }) })
  }

  return (
    <div className={css.section} aria-busy={state.status === 'loading'}>
      {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure}>
          <p role="alert">{t('error')}</p>
          <button type="button" onClick={reload}>{t('retry')}</button>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <div className={css.pairingCard} data-status={state.pairing.status}>
            <p className={css.status}>{statusLabel(state.pairing.status, t)}</p>
            {state.pairing.error !== undefined ? <p className={css.errorText}>{state.pairing.error}</p> : null}
            {state.pairing.qrDataUrl !== undefined ? (
              <img
                className={css.qr}
                src={state.pairing.qrDataUrl}
                alt={t('qrAlt')}
                width={180}
                height={180}
                data-remote-qr
              />
            ) : null}
            {state.pairing.code !== undefined ? (
              <p className={css.code} data-remote-code>{state.pairing.code}</p>
            ) : null}
            {state.pairing.expiresAt !== undefined ? (
              <p className={css.meta}>{t('codeExpires')} {formatTime(state.pairing.expiresAt, 'zh-CN')}</p>
            ) : null}
            {state.pairing.phoneRelayUrl !== undefined ? (
              <p className={css.meta} data-remote-url>{t('phoneUrlLabel')}: {state.pairing.phoneRelayUrl}</p>
            ) : null}
            <button type="button" onClick={reload}>{t('refresh')}</button>
          </div>
          <div className={css.devices}>
            <h3>{t('devices')}</h3>
            {state.sessions.sessions.length === 0 ? <p className={css.status}>{t('devicesEmpty')}</p> : null}
            {state.sessions.sessions.length > 0 ? (
              <ul className={css.deviceList}>
                {state.sessions.sessions.map(session => (
                  <li className={css.deviceRow} key={session.sessionId}>
                    <span data-device-name>{session.deviceName}</span>
                    <span className={css.meta}>
                      {t('deviceSince')} {formatTime(session.createdAt, 'zh-CN')}
                    </span>
                    <button
                      type="button"
                      onClick={() => { onRevoke(session.sessionId) }}
                      aria-label={t('revoke')}
                    >
                      {t('revoke')}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <button type="button" className={css.reset} onClick={onReset}>{t('reset')}</button>
          </div>
        </>
      ) : null}
    </div>
  )
}
