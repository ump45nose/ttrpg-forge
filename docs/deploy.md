# 部署说明（私有分发）

Forge 是纯静态的 PWA：构建产物是一个 `apps/web/dist/` 目录，没有后端。
角色数据只存在每台设备的浏览器里（IndexedDB），服务器只负责第一次安装和后续更新。

> ⚠️ `dist/` 含本地生成的 PHB 文本（DND5eChm 社区译本），**只能私有部署**：
> 不要放到公网可直接访问的地址，不要提交进仓库。

## 1. 构建

```bash
pnpm install
# 可选：生成 PHB 包（需要本机的 DND5eChm 数据，见 packs/phb-2024/README.md）；不生成则只有 SRD 内容
pnpm --filter @forge/pack-phb2024 generate
pnpm build            # 产物在 apps/web/dist/
```

## 2. 必须满足的条件

| 要求 | 原因 |
|---|---|
| **有效的 HTTPS 证书**（不能是自签名） | 手机只有在 HTTPS 下才能「添加到主屏幕」安装 PWA、启用离线缓存 |
| 部署在**根路径** `/` | 路由和 Service Worker 作用域都按根路径构建；如必须用子路径，告诉开发者把 Vite `base` 改成构建参数 |
| 未知路径回退到 `/index.html` | 单页应用：`/c/<id>`、`/settings` 这些地址刷新时也要能打开 |
| 正确的缓存头（见下） | 否则用户可能一直卡在旧版本，或每次都重新下载 |

缓存规则：

| 路径 | Cache-Control |
|---|---|
| `/index.html`、`/sw.js`、`/registerSW.js`、`/manifest.webmanifest`、`/workbox-*.js` | `no-cache` |
| `/assets/*`（文件名带哈希） | `public, max-age=31536000, immutable` |
| `/art/*`（美术包 WebP，约 13 MB；请求带 `?v=` 内容哈希） | `public, max-age=2592000` |
| 其余静态文件（图标等） | `public, max-age=86400` |

## 3. nginx 示例

```nginx
server {
    listen 443 ssl http2;
    server_name forge.example.lan;          # 换成你的域名

    ssl_certificate     /etc/ssl/forge/fullchain.pem;
    ssl_certificate_key /etc/ssl/forge/privkey.pem;

    root /srv/forge/dist;                   # apps/web/dist 的拷贝
    index index.html;

    # 体积较大的规则包分块，开压缩
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml application/manifest+json;

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # 美术包：不进预缓存，客户端首次显示时缓存。缺图必须 404，不能回退到 index.html，
    # 否则 service worker 会把 HTML 当图片缓存下来
    location /art/ {
        add_header Cache-Control "public, max-age=2592000";
        try_files $uri =404;
    }

    location ~ ^/(sw\.js|registerSW\.js|workbox-[^/]+\.js|manifest\.webmanifest)$ {
        add_header Cache-Control "no-cache";
        try_files $uri =404;
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri /index.html;
    }

    # 私有访问：按你的方案选一种（IP 白名单 / basic auth / 只在内网或 VPN 暴露）
    # allow 192.168.31.0/24;
    # deny all;
}
```

`.webmanifest` 需要正确的 MIME 类型；如果 nginx 的 `mime.types` 里没有，加上：

```nginx
types { application/manifest+json webmanifest; }
```

## 4. 更新

重新 `pnpm build`，把新的 `dist/` 整体替换过去即可。
已安装的用户下次联网打开时会自动拿到新版本（Service Worker 后台更新，刷新后生效）。
用户数据在各自设备上，更新不会影响。

## 5. 部署后自检

1. 手机浏览器打开 HTTPS 地址，能看到角色库。
2. iPhone：Safari → 分享 → 添加到主屏幕；安卓：Chrome 菜单 → 安装应用。
3. 从主屏打开一次，然后开飞行模式再打开：应能正常使用。
4. 打开 `https://<域名>/c/随便什么` 并刷新：应进入应用（找不到角色时回到角色库），而不是 nginx 404。

## 美术包

- 图片在 `dist/art/`，WebP 格式。较老的 nginx 若 `mime.types` 里没有 `image/webp`，请补上 `image/webp webp;`。
- 不进安装包的预缓存，所以首次安装很快。每张图在第一次显示时下载并缓存（最多 400 张），之后离线可用。
- 设置 → 主题里可以关掉「显示插画」，关掉后不再下载任何图片。

