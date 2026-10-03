# GitHub Pages（获许可的 PHB 分发）

本站发布源是 `main`，产物来自 `.github/workflows/pages.yml`。工作流只上传 `apps/web/dist`，不上传源码、生成缓存、配置文件或 source maps。

## 许可与公开范围

公开发布 PHB 文本之前，发布者必须获得适用的分发许可。上游版权及署名保留；本部署设置不授予其他人任何 PHB 内容许可。没有分发许可时，仍应遵循原有私有部署限制。

仓库公开会使源码、历史提交和 Releases 可见。网站中的 JavaScript 和 PHB 数据也可下载。生成的 `phb.json` 与下载缓存继续被 Git 忽略，工作流在构建时从固定的上游 commit 生成。

## 一次性设置

1. 仓库 Settings → Pages → Source 选择 GitHub Actions
2. `main` 推送或手动运行 Pages 工作流
3. 只有 PHB 完整性检查、类型检查、单元测试及 Pages 端到端测试成功后，才会发布

当前项目路径为 `/ttrpg-forge/`。Pages 使用 hash 路由，例如 `/ttrpg-forge/#/settings`；分享或刷新角色、构筑页面不会请求一个不存在的服务器路径。

## 本地验证

```bash
pnpm install --frozen-lockfile
python3 packs/phb-2024/scripts/build_phb.py --commit 63995fe26649fa49ac2cfa196e912f57a2693396
pnpm check:phb
pnpm typecheck
pnpm test
pnpm build:pages
pnpm e2e:pages
```

测试默认使用已安装的 Chrome。其他 Chromium 可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/absolute/path/to/chromium` 指定。

`build:pages` 在 PHB 缺失或不完整时直接失败，不能静默变成 SRD-only。原 `pnpm build` 保留根路径/browser-history 模式，供原有服务器和 Android 构建使用。若为其他项目路径构建，设置 `VITE_BASE_PATH=/other-project/`；它会统一资源地址、PWA 入口/作用域和图片缓存路径。

## 离线与数据

主程序、PHB 和懒加载页面被预缓存；插画及中文字体按需缓存，未看过的图片或字体不保证离线可用。AI 生图仍需要联网与接口的 HTTPS/CORS 支持，网站构建不嵌入 API 密钥。

角色数据、设置和 API 密钥位于使用者设备的浏览器存储。GitHub Pages 的不同项目路径共享 `ump45nose.github.io` origin，路径不能提供存储隔离；不要在这个 origin 托管不可信应用。以后切换独立域名前，先导出角色并在新域名导入，浏览器不会自动迁移旧数据。

## 更新

推送 `main` 后工作流重新生成、测试并发布。上游 PHB 输入固定在工作流的 `PHB_SOURCE_COMMIT`；要更新内容，显式更改该值并重新验证。构建产物不包含玩家角色、玩家设置或个人密钥。
