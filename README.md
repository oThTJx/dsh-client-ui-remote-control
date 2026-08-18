# @firefly0621/dsh-client-ui-remote-control

English | [中文](README.zh.md)

The **远程控制** tab in Web settings: shows the pairing QR code, the 6-digit pairing code with its expiry, and the bound-device removal and "reset device identity" actions. The browser plugin registers a localized `settings.plugins.tab` contribution with id `remote`; the component mounts only when the tab is selected for the first time, lazily calling `ctx.remote.remoteControl.*` through `api-remotes`.

## Model Experience

None: pure presentation of host pairing state; no prompt, tool, or provider request is registered.
