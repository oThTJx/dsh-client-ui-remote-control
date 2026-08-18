import { useEffect, useState, type ReactNode } from 'react'
import type {
  ConnectionActionSnapshot,
  PairingSnapshot,
  ResetIdentitySnapshot,
  RevokeSnapshot,
  SessionsSnapshot,
  SetRelayUrlSnapshot,
  TestConnectionSnapshot,
} from '@firefly0621/dsh-remote-control/types'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteControlLocaleKey } from './locales.ts'
import css from './RemoteControlSettingsTab.module.css'

/** Registration-side Remote face used by the section. */
export interface RemoteControlSettingsTabInjected {
  /** Current pairing snapshot (QR data URL included when a code is live). */
  pairing: () => Promise<PairingSnapshot>
  /** Explicitly connect to the configured relay. */
  connect: () => Promise<ConnectionActionSnapshot>
  /** Explicitly disconnect and clear the pairing code. */
  disconnect: () => Promise<ConnectionActionSnapshot>
  /** Bound app sessions of this device. */
  sessions: () => Promise<SessionsSnapshot>
  /** Ask the relay to drop one app session. */
  revoke: (sessionId: string) => Promise<RevokeSnapshot>
  /** Regenerate the device identity and drop every bound session. */
  resetIdentity: () => Promise<ResetIdentitySnapshot>
  /** One explicit wire round-trip against the relay. */
  testConnection: () => Promise<TestConnectionSnapshot>
  /** Persist and apply a new relay address; '' selects the embedded local relay. */
  setRelayUrl: (url: string) => Promise<SetRelayUrlSnapshot>
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

type TestState =
  | { readonly status: 'idle' }
  | { readonly status: 'testing' }
  | { readonly status: 'done'; readonly result: TestConnectionSnapshot }

const STATUS_KEYS = {
  disconnected: 'disconnected',
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
  connect,
  disconnect,
  sessions,
  revoke,
  resetIdentity,
  testConnection,
  setRelayUrl,
  t,
}: RemoteControlSettingsTabProps): ReactNode {
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const [test, setTest] = useState<TestState>({ status: 'idle' })
  const [addressDraft, setAddressDraft] = useState('')

  const reload = (): void => {
    setState({ status: 'loading' })
    // A failing sessions read (e.g. the relay is unreachable) must not hide the
    // pairing status and address config; the device list degrades to empty.
    void Promise.allSettled([pairing(), sessions()]).then(([pairingResult, sessionsResult]) => {
      if (pairingResult.status === 'rejected') {
        setState({ status: 'error' })
        return
      }
      setState({
        status: 'ready',
        pairing: pairingResult.value,
        sessions: sessionsResult.status === 'fulfilled' ? sessionsResult.value : { sessions: [] },
      })
      setAddressDraft(pairingResult.value.relayUrl ?? '')
    })
  }

  useEffect(reload, [pairing, sessions])

  const onSaveAddress = (): void => {
    void setRelayUrl(addressDraft.trim()).then(reload, () => { setState({ status: 'error' }) })
  }

  const onConnect = (): void => {
    void connect().then(reload, () => { setState({ status: 'error' }) })
  }

  const onDisconnect = (): void => {
    void disconnect().then(reload, () => { setState({ status: 'error' }) })
  }

  const onTestConnection = (): void => {
    setTest({ status: 'testing' })
    void testConnection().then(
      (result) => { setTest({ status: 'done', result }) },
      () => { setTest({ status: 'done', result: { ok: false, message: t('error') } }) },
    )
  }

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
          <div className={css.addressRow}>
            <label className={css.addressField}>
              <span>{t('addressLabel')}</span>
              <input
                type="text"
                value={addressDraft}
                placeholder={t('addressPlaceholder')}
                onChange={(event) => { setAddressDraft(event.currentTarget.value) }}
              />
            </label>
            <button type="button" onClick={onSaveAddress}>{t('save')}</button>
          </div>
          <div className={css.pairingCard} data-status={state.pairing.status}>
            <p className={css.status}>{statusLabel(state.pairing.status, t)}</p>
            {state.pairing.error !== undefined ? <p className={css.errorText}>{state.pairing.error}</p> : null}
            <div className={css.connectionRow}>
              {state.pairing.status === 'disconnected' || state.pairing.status === 'error' ? (
                <button type="button" onClick={onConnect}>{t('connect')}</button>
              ) : (
                <button type="button" onClick={onDisconnect}>{t('disconnect')}</button>
              )}
            </div>
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
            {state.pairing.relayUrl !== undefined ? (
              <p className={css.meta} data-remote-url>{t('phoneUrlLabel')}: {state.pairing.relayUrl}</p>
            ) : null}
            <div className={css.testRow}>
              <button type="button" onClick={onTestConnection} disabled={test.status === 'testing'}>
                {test.status === 'testing' ? t('testing') : t('testConnection')}
              </button>
              {test.status === 'done' ? (
                <span className={test.result.ok ? css.testOk : css.testFail} data-test-result={test.result.ok ? 'ok' : 'fail'}>
                  {test.result.ok ? t('testOk') : t('testFail')}: {test.result.message}
                </span>
              ) : null}
            </div>
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
