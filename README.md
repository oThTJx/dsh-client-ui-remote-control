# @firefly0621/dsh-client-ui-remote-control

English | [中文](README.zh.md)

The **远程控制** section in Web settings: a 配对 tab whose relay-address field's **连接** button persists the address and dials out (toggling to **断开连接** while active), showing the pairing QR code and 6-digit pairing code with its expiry once paired (with a 刷新 re-read), plus a 设备 tab for bound-device removal and "reset device identity". The browser plugin registers a localized `settings.section` contribution with id `remote`; the component mounts only when the section is opened, lazily calling `ctx.remote.remoteControl.*` through `api-remotes`.

## Model Experience

None: pure presentation of host pairing state; no prompt, tool, or provider request is registered.

## Known Limitations and Deferred Work

- **The pairing code is relay-minted** — the page displays a code the relay issues during connect; it cannot rotate the code itself (reconnect forces a fresh one).
- **Requires the host plugin and a reachable relay** — without `@firefly0621/dsh-remote-control` mounted, or with an unreachable relay, the page shows an error state; bound-device management needs a live connection.
- **Nav icon is the shell's gear fallback** — the settings nav glyph map is owned by the core `ui-settings-general` shell; a custom icon requires an upstream contract change.
