// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RemoteControlSettingsTab, type RemoteControlSettingsTabProps } from '../src/client/RemoteControlSettingsTab.tsx'
import type {
  ConnectionActionSnapshot,
  PairingSnapshot,
  ResetIdentitySnapshot,
  RevokeSnapshot,
  SessionsSnapshot,
  SetRelayUrlSnapshot,
} from '@firefly0621/dsh-remote-control/types'

afterEach(cleanup)

function props(overrides?: {
  pairing?: PairingSnapshot
  sessions?: SessionsSnapshot
  confirm?: () => boolean
  setRelayUrl?: (url: string) => Promise<SetRelayUrlSnapshot>
  connect?: () => Promise<ConnectionActionSnapshot>
  disconnect?: () => Promise<ConnectionActionSnapshot>
}): RemoteControlSettingsTabProps {
  const pairing = vi.fn<() => Promise<PairingSnapshot>>()
    .mockResolvedValue(overrides?.pairing ?? {
      status: 'pairing',
      code: '654321',
      expiresAt: 2_000_000,
      relayUrl: 'ws://relay.example.com',
      qrDataUrl: 'data:image/png;base64,qr',
    })
  const sessions = vi.fn<() => Promise<SessionsSnapshot>>()
    .mockResolvedValue(overrides?.sessions ?? {
      sessions: [{ sessionId: 'token-1', deviceName: 'my-phone', createdAt: 1_000_000 }],
    })
  const revoke = vi.fn<(sessionId: string) => Promise<RevokeSnapshot>>().mockResolvedValue({ revoked: true })
  const resetIdentity = vi.fn<() => Promise<ResetIdentitySnapshot>>().mockResolvedValue({ deviceId: 'fresh-id' })
  const setRelayUrl = vi.fn<(url: string) => Promise<SetRelayUrlSnapshot>>(overrides?.setRelayUrl ?? (async () => ({ ok: true })))
  const connect = vi.fn<() => Promise<ConnectionActionSnapshot>>(overrides?.connect ?? (async () => ({ ok: true })))
  const disconnect = vi.fn<() => Promise<ConnectionActionSnapshot>>(overrides?.disconnect ?? (async () => ({ ok: true })))
  if (overrides?.confirm !== undefined) {
    vi.spyOn(globalThis, 'confirm').mockImplementation(overrides.confirm)
  } else {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true)
  }
  return {
    pairing,
    connect,
    disconnect,
    sessions,
    revoke,
    resetIdentity,
    setRelayUrl,
    t: (key: string) => key,
  } as unknown as RemoteControlSettingsTabProps
}

describe('RemoteControlSettingsTab', () => {
  it('renders the pairing code, QR, and bound devices across the two tabs', async () => {
    render(<RemoteControlSettingsTab {...props()} />)
    expect(await screen.findByText('654321')).toBeTruthy()
    expect(screen.getByAltText('qrAlt')).toBeTruthy()
    expect((screen.getByPlaceholderText('addressPlaceholder') as HTMLInputElement).value).toBe('ws://relay.example.com')
    fireEvent.click(screen.getByText('devicesTab'))
    expect(await screen.findByText('my-phone')).toBeTruthy()
  })

  it('shows an error state when the Remote read fails and recovers via retry', async () => {
    const p = props()
    ;(p.pairing as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    render(<RemoteControlSettingsTab {...p} />)
    expect(await screen.findByRole('alert')).toBeTruthy()
    ;(p.pairing as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'pairing',
      code: '654321',
      phoneRelayUrl: 'ws://relay.example.com',
    })
    fireEvent.click(screen.getByText('retry'))
    expect(await screen.findByText('654321')).toBeTruthy()
  })

  it('revokes a session through the injected face', async () => {
    const p = props()
    render(<RemoteControlSettingsTab {...p} />)
    await screen.findByText('654321')
    fireEvent.click(screen.getByText('devicesTab'))
    fireEvent.click(await screen.findByLabelText('revoke'))
    expect(p.revoke).toHaveBeenCalledWith('token-1')
  })

  it('resets the device identity through the injected face', async () => {
    const p = props()
    render(<RemoteControlSettingsTab {...p} />)
    await screen.findByText('654321')
    fireEvent.click(screen.getByText('devicesTab'))
    fireEvent.click(await screen.findByText('reset'))
    expect(p.resetIdentity).toHaveBeenCalledOnce()
  })

  it('persists the draft relay address and then connects', async () => {
    const p = props({ pairing: { status: 'disconnected', relayUrl: 'ws://relay.example.com' } })
    render(<RemoteControlSettingsTab {...p} />)
    await screen.findByText('disconnected')
    const input = screen.getByPlaceholderText('addressPlaceholder') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'wss://other.example.com' } })
    fireEvent.click(screen.getByText('connect'))
    expect(p.setRelayUrl).toHaveBeenCalledWith('wss://other.example.com')
    await vi.waitFor(() => { expect(p.connect).toHaveBeenCalledOnce() })
  })

  it('still shows pairing status when the device list read fails', async () => {
    const p = props()
    ;(p.sessions as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('relay not connected'))
    render(<RemoteControlSettingsTab {...p} />)
    expect(await screen.findByText('654321')).toBeTruthy()
    fireEvent.click(screen.getByText('devicesTab'))
    expect(screen.getByText('devicesEmpty')).toBeTruthy()
  })

  it('shows a connect button when disconnected and connects through the face', async () => {
    const p = props({ pairing: { status: 'disconnected', relayUrl: 'ws://relay.example.com' } })
    render(<RemoteControlSettingsTab {...p} />)
    fireEvent.click(await screen.findByText('connect'))
    expect(p.setRelayUrl).toHaveBeenCalledWith('ws://relay.example.com')
    await vi.waitFor(() => { expect(p.connect).toHaveBeenCalledOnce() })
    expect(screen.queryByText('654321')).toBeNull()
  })

  it('polls while connecting until the minted pairing code appears', async () => {
    const p = props({ pairing: { status: 'connecting', relayUrl: 'ws://relay.example.com' } })
    ;(p.pairing as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ status: 'connecting', relayUrl: 'ws://relay.example.com' })
      .mockResolvedValue({ status: 'pairing', relayUrl: 'ws://relay.example.com', code: '654321', expiresAt: 1_000_000 })
    render(<RemoteControlSettingsTab {...p} />)
    expect(await screen.findByText('connecting')).toBeTruthy()
    // The host dials out asynchronously; the panel must re-read until the code lands.
    await vi.waitFor(() => { expect(screen.getByText('654321')).toBeTruthy() }, { timeout: 3_000 })
  })

  it('disconnects through the face when paired', async () => {
    const p = props()
    render(<RemoteControlSettingsTab {...p} />)
    fireEvent.click(await screen.findByText('disconnect'))
    expect(p.disconnect).toHaveBeenCalledOnce()
  })
})
