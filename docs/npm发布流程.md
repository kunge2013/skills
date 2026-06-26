# npm 发布流程

## 前置条件

1. 在 https://www.npmjs.com 注册账号
2. 项目根目录已有 `package.json`，配置了 `name`、`version`、`bin`、`files` 等字段

## 发布步骤

### 1. 处理 2FA 问题

如果 npm 账号开启了双重验证（2FA），必须生成带 bypass 权限的 token：

1. 打开 https://www.npmjs.com/settings/kunge2013/tokens
2. 点击 **Generate New Token**
3. 选择 **Granular Token**
4. 勾选：
   - **Read and publish**
   - **Bypass 2FA for publishing**（必须勾选）
5. 复制生成的 token（格式：`npm_xxxx...`）

### 2. 配置 auth token

在项目根目录创建或更新 `.npmrc`：

```bash
echo "//registry.npmjs.org/:_authToken=你的token" > .npmrc
```

### 3. 确认 registry 是官方源

```bash
npm config get registry
# 必须输出: https://registry.npmjs.org/
```

如果是镜像源（华为/淘宝等），切换回官方源：

```bash
npm config set registry https://registry.npmjs.org/
```

### 4. 验证登录

```bash
npm whoami
# 输出用户名即成功
```

### 5. 发布

```bash
npm publish --access public
```

成功后输出类似：

```
+ kungeskill@0.1.0
```

### 6. 验证

```bash
npm info kungeskill
# 或在浏览器打开 https://www.npmjs.com/package/kungeskill
```

## 更新版本

```bash
# 修改版本号
npm version patch   # 0.1.0 -> 0.1.1
npm version minor   # 0.1.0 -> 0.2.0
npm version major   # 0.1.0 -> 1.0.0

# 重新发布
npm publish --access public
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `401 Unauthorized` | token 过期或无效 | 重新生成 Granular Token |
| `403 Forbidden` | Automation token 不能发布 | 用 Publish 类型 token |
| `403` 需要 2FA | 开了 2FA 但 token 不带 bypass | 生成带 bypass 2FA 的 Granular Token |
| `404 Not found` | registry 配置的是镜像源 | `npm config set registry https://registry.npmjs.org/` |
| `npm publish` 无输出 | shell 环境问题 | 用 `node /path/to/npm-cli.js publish` 直接调用 |
| 跨驱动器 Windows | junction 不能跨盘 | `kungeskill add` 会自动 fallback 到复制模式 |
