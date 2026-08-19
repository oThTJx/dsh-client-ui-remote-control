import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type {
  ConnectionActionSnapshot,
  PairingSnapshot,
  ResetIdentitySnapshot,
  RevokeSnapshot,
  SessionsSnapshot,
  SetRelayUrlSnapshot,
} from '@firefly0621/dsh-remote-control/types'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
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
  /** Persist and apply a new relay address; '' selects the local relay at 127.0.0.1:8787. */
  setRelayUrl: (url: string) => Promise<SetRelayUrlSnapshot>
}

/** Full component props assembled by the Settings slot renderer. */
export type RemoteControlSettingsTabProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.remoteControl'>
  & InjectFace<RemoteControlSettingsTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly actionFailed: boolean }
  | { readonly status: 'ready'; readonly pairing: PairingSnapshot; readonly sessions: SessionsSnapshot }

/** One page tab projected from the component-local tab list. */
interface PageTab {
  readonly id: 'pairing' | 'devices'
  readonly label: string
}

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

/** Format an epoch ms as a locale-aware date-time string. */
function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString()
}

/** Render the remote-control pairing page: pairing tab + paired-devices tab. */
export function RemoteControlSettingsTab({
  pairing,
  connect,
  disconnect,
  sessions,
  revoke,
  resetIdentity,
  setRelayUrl,
  t,
}: RemoteControlSettingsTabProps): ReactNode {
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const [addressDraft, setAddressDraft] = useState('')
  const [activeTab, setActiveTab] = useState<PageTab['id']>('pairing')
  const tabsId = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  /** Monotonic reload id: stale async reads must not overwrite newer state. */
  const reloadSeq = useRef(0)
  const tabs: readonly PageTab[] = [
    { id: 'pairing', label: t('pairingTab') },
    { id: 'devices', label: t('devicesTab') },
  ]

  const reload = (): void => {
    const seq = ++reloadSeq.current
    setState({ status: 'loading' })
    // A failing sessions read (e.g. the relay is unreachable) must not hide the
    // pairing status and address config; the device list degrades to empty.
    void Promise.allSettled([pairing(), sessions()]).then(([pairingResult, sessionsResult]) => {
      if (seq !== reloadSeq.current) return
      if (pairingResult.status === 'rejected') {
        console.error('remoteControl.pairing failed', pairingResult.reason)
        setState({ status: 'error', actionFailed: false })
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

  // The host dials out asynchronously and never pushes the outcome; keep
  // re-reading while 'connecting' so the minted code (or the failure) appears.
  const pairingStatus = state.status === 'ready' ? state.pairing.status : null
  useEffect(() => {
    if (pairingStatus !== 'connecting') return
    const timer = setInterval(reload, 1_000)
    return () => { clearInterval(timer) }
  }, [pairingStatus])

  /** Write actions share one failure path: log the reason, show an action error. */
  const failAction = (reason: unknown): void => {
    console.error('remoteControl action failed', reason)
    setState({ status: 'error', actionFailed: true })
  }

  // The one connection control: persisting the draft address first (the host
  // reconnects automatically when already active), then dialing out.
  const onConnect = (): void => {
    void setRelayUrl(addressDraft.trim()).then(connect).then(reload, failAction)
  }

  const onDisconnect = (): void => {
    void disconnect().then(reload, failAction)
  }

  const onRevoke = (sessionId: string): void => {
    if (!globalThis.confirm(t('revokeConfirm'))) return
    void revoke(sessionId).then(reload, failAction)
  }

  const onReset = (): void => {
    if (!globalThis.confirm(t('resetConfirm'))) return
    void resetIdentity().then(reload, failAction)
  }

  const onTabKeyDown = (index: number) => (event: KeyboardEvent<HTMLButtonElement>): void => {
    let nextIndex: number
    switch (event.key) {
      case 'ArrowRight': nextIndex = (index + 1) % tabs.length; break
      case 'ArrowLeft': nextIndex = (index - 1 + tabs.length) % tabs.length; break
      case 'Home': nextIndex = 0; break
      case 'End': nextIndex = tabs.length - 1; break
      default: return
    }
    event.preventDefault()
    const nextTab = tabs[nextIndex] as PageTab
    const nextTabButton = tabRefs.current[nextIndex] as HTMLButtonElement
    setActiveTab(nextTab.id)
    nextTabButton.focus()
  }

  return (
    <div className={css.section} aria-busy={state.status === 'loading'}>
      <h2 className={css.title}>{t('title')}</h2>
      {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure}>
          <p role="alert">{state.actionFailed ? t('actionError') : t('error')}</p>
          <button type="button" onClick={reload}>{t('retry')}</button>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <div className={css.tabs} role="tablist" aria-label={t('title')}>
            {tabs.map((tab, index) => {
              const selected = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  ref={(element) => { tabRefs.current[index] = element }}
                  id={`${tabsId}-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  className={css.tab}
                  aria-selected={selected}
                  aria-controls={`${tabsId}-panel-${tab.id}`}
                  data-active={selected ? 'true' : undefined}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => { setActiveTab(tab.id) }}
                  onKeyDown={onTabKeyDown(index)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
          {/* Both panels stay mounted so the relay-address draft and the
              connection-test result survive tab switches. */}
          <div
            id={`${tabsId}-panel-pairing`}
            className={css.panel}
            role="tabpanel"
            aria-labelledby={`${tabsId}-tab-pairing`}
            hidden={activeTab !== 'pairing'}
          >
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
              {state.pairing.status === 'disconnected' || state.pairing.status === 'error' ? (
                <Button variant="primary" className={css.connectButton} onClick={onConnect}>{t('connect')}</Button>
              ) : (
                <Button variant="outline" className={css.connectButton} onClick={onDisconnect}>{t('disconnect')}</Button>
              )}
            </div>
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
                <p className={css.code} aria-label={`${t('codeLabel')}: ${state.pairing.code}`} data-remote-code>{state.pairing.code}</p>
              ) : null}
              {state.pairing.expiresAt !== undefined ? (
                <p className={css.meta}>{t('codeExpires')} {formatTime(state.pairing.expiresAt)}</p>
              ) : null}
              {state.pairing.status === 'pairing' ? (
                <button type="button" onClick={reload}>{t('refresh')}</button>
              ) : null}
            </div>
          </div>
          <div
            id={`${tabsId}-panel-devices`}
            className={css.panel}
            role="tabpanel"
            aria-labelledby={`${tabsId}-tab-devices`}
            hidden={activeTab !== 'devices'}
          >
            <div className={css.devices}>
              <button type="button" className={css.reset} onClick={onReset}>{t('reset')}</button>
              {state.sessions.sessions.length === 0 ? <p className={css.status}>{t('devicesEmpty')}</p> : null}
              {state.sessions.sessions.length > 0 ? (
                <ul className={css.deviceList} aria-label={t('devices')}>
                  {state.sessions.sessions.map(session => (
                    <li className={css.deviceRow} key={session.sessionId}>
                      <span data-device-name>{session.deviceName}</span>
                      <span className={css.meta}>
                        {t('deviceSince')} {formatTime(session.createdAt)}
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
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
