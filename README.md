# @firefly0621/dsh-client-ui-remote-control

Web 设置中 **远程控制** 标签页：展示配对二维码 + 6 位配对码 + 有效期，以及已绑定设备的删除与"重置设备身份"。浏览器插件注册一个 id 为 `remote` 的本地化 `settings.plugins.tab` 贡献；首次选中该标签页才挂载组件，通过 [`api-remotes`](../../api/remotes/README.md) 懒调用 `ctx.remote.remoteControl.*`。

## Model Experience

None：纯展示 host 配对状态，不注册 prompt、tool 或 provider 请求。
