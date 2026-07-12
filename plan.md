# timeFri Web 应用实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐项实现。所有步骤使用复选框追踪。

**目标：** 构建一个极简时间记录 Web 应用：用户输入事件后开始计时，结束时填写总结，确认后将事件名称、开始时间、结束时间、持续时间和总结以 Markdown 写入 Flomo，成功后恢复为简洁时钟界面。

**架构：** 使用 Next.js App Router + TypeScript 构建单体应用。浏览器负责时钟、计时状态、表单和本地恢复；服务端 Route Handler 负责读取环境变量中的 Flomo Webhook 并代理提交，防止 Webhook 凭据暴露在浏览器代码中。应用不使用数据库，运行中的会话仅保存在浏览器 `localStorage`。

**技术栈：** Next.js App Router、React、TypeScript、CSS Modules 或全局 CSS、Vitest、React Testing Library、Playwright。

## 全局约束

- 应用目录固定为 `timeFri/`。
- 首屏保持极简：页面中央显示大号数字时钟，下面只显示“启动”和“结束”两个主要按钮。
- 空闲状态下“结束”按钮禁用；运行状态下“启动”按钮禁用。
- 点击“启动”后必须先输入事件名称并确认，确认时间即为开始时间。
- 点击“结束”后必须先输入事件总结并确认，确认时间即为结束时间。
- Flomo 提交成功后，清除当前会话并回到初始时钟界面。
- Flomo 提交失败时不得清除当前会话，必须允许用户修改总结并重试。
- Flomo Webhook 只能保存在 `.env.local`，不得写入源码、测试、日志或版本控制。
- 用户已经提供的真实 Webhook 视为敏感凭据；实现时写入本机 `.env.local`，本计划文件只使用变量名，不重复保存真实 URL。
- 所有时间计算使用 Unix 毫秒时间戳，显示时使用用户浏览器本地时区。
- 持续时间由 `endAt - startAt` 计算，不依赖计时器累计值，避免后台标签页节流导致误差。
- MVP 不做账号、数据库、历史列表、标签编辑、暂停计时和多任务并行。

---

## 1. 产品范围

### 1.1 核心使用场景

1. 用户打开页面，看到当前本地时间。
2. 用户点击“启动”。
3. 页面弹出事件输入框，例如“准备课程 PPT”。
4. 用户点击确认，系统记录开始时间并进入运行状态。
5. 页面继续显示简洁时钟，同时展示当前事件名称和实时持续时间。
6. 用户点击“结束”。
7. 页面弹出总结输入框，例如“完成第 1—20 页，需补充案例”。
8. 用户点击确认，系统记录结束时间并向服务端提交。
9. 服务端将格式化后的 Markdown 发送到 Flomo。
10. 提交成功后显示短暂成功提示，并恢复初始界面。

### 1.2 非目标

- 不展示过去的时间记录。
- 不从 Flomo 读取数据。
- 不允许同时运行多个事件。
- 不提供暂停与继续。
- 不提供用户登录和云同步。
- 不自动推断事件名称或总结。

---

## 2. 方案比较与技术决策

### 方案 A：浏览器直接调用 Flomo Webhook

**优点：** 文件少，开发最快。

**缺点：** Webhook 会进入浏览器包或网络请求中，任何访问页面的人都能获取；还可能受到 CORS 限制。

**结论：** 不采用。

### 方案 B：Next.js 页面 + 服务端 Route Handler

**优点：** 单项目、部署简单；Webhook 只在服务端环境变量中；前后端类型和格式可统一维护。

**缺点：** 需要运行 Node.js 服务，不能作为纯静态站点部署。

**结论：** 推荐并采用。

### 方案 C：Vite 前端 + 独立 Express/FastAPI 后端

**优点：** 前后端边界明确，未来扩展数据库更灵活。

**缺点：** 对当前单功能应用过重，开发和部署需要维护两个进程。

**结论：** MVP 不采用。

---

## 3. 页面与交互设计

### 3.1 空闲状态 `idle`

页面从上到下：

- 应用名称：`timeFri`，字号小、弱化显示。
- 当前日期：例如 `2026年7月13日 · 星期一`。
- 中央大时钟：例如 `12:08:43`，使用等宽数字字体或 `font-variant-numeric: tabular-nums` 防止跳动。
- 操作区：
  - “启动”：主按钮，可点击。
  - “结束”：次按钮，禁用。

空闲页不显示多余说明、菜单、历史记录和卡片列表。

### 3.2 启动输入层 `startDialog`

点击“启动”后显示居中对话框：

- 标题：`开始记录`
- 单行输入框：`事件名称`
- 占位文字：`例如：准备课程 PPT`
- “取消”按钮
- “确认启动”按钮

校验规则：

- 去除首尾空格后不能为空。
- 最大长度 100 个字符。
- 按 Enter 可确认；按 Escape 可取消。
- 连续点击确认只能产生一次开始事件。

确认动作顺序：

1. 读取一次 `Date.now()` 作为 `startAt`。
2. 构造会话对象。
3. 写入 React 状态。
4. 写入 `localStorage`。
5. 关闭输入层并进入运行状态。

### 3.3 运行状态 `running`

中央区域显示：

- 当前本地时间，保持页面的“时钟”主视觉。
- 当前事件名称。
- 已持续时间，例如 `01:27:36`。

操作区：

- “启动”：禁用。
- “结束”：主按钮，可点击。

为保持简洁，事件名称最长显示两行，超长时省略；完整名称通过 `title` 或无障碍文本保留。

### 3.4 结束输入层 `endDialog`

点击“结束”后显示：

- 标题：`结束记录`
- 当前事件名称，只读展示。
- 当前预计持续时间，只读展示。
- 多行输入框：`总结`
- 占位文字：`记录完成情况、结果或下一步`
- “取消”按钮
- “确认并写入 Flomo”按钮

校验规则：

- 去除首尾空格后不能为空。
- 最大长度 2000 个字符。
- 支持换行。
- `Ctrl+Enter` 或 `Cmd+Enter` 提交，普通 Enter 只换行。

确认动作顺序：

1. 读取一次 `Date.now()` 作为 `endAt`。
2. 冻结本次提交数据，避免请求期间显示时间变化影响记录。
3. 进入 `saving` 状态并禁用所有提交按钮。
4. 调用 `/api/flomo`。
5. 成功：清除 `localStorage` 和运行状态，关闭对话框，显示 1.5 秒成功提示，返回 `idle`。
6. 失败：保留事件、开始时间和总结，进入 `saveError`，显示错误并允许重试。

### 3.5 错误状态 `saveError`

错误信息使用用户可理解的文字，不显示原始堆栈或 Webhook 地址：

- 网络不可用：`无法连接服务器，请检查网络后重试。`
- Flomo 非成功响应：`Flomo 暂时未接受这条记录，请稍后重试。`
- 服务端未配置 Webhook：`服务端尚未配置 Flomo Webhook。`
- 未知错误：`写入失败，当前记录已保留。`

不得自动重试，避免在响应不确定时产生重复 memo。

---

## 4. 状态机

```text
idle
  └─ 点击启动 → startDialog
       ├─ 取消 → idle
       └─ 确认 → running

running
  └─ 点击结束 → endDialog
       ├─ 取消 → running
       └─ 确认 → saving
            ├─ 成功 → idle
            └─ 失败 → saveError
                 ├─ 返回修改 → endDialog
                 └─ 重试 → saving
```

建议使用明确的联合类型，避免多个布尔值组合出非法状态：

```ts
export type AppPhase =
  | "idle"
  | "startDialog"
  | "running"
  | "endDialog"
  | "saving"
  | "saveError";
```

---

## 5. 数据模型

### 5.1 浏览器运行会话

```ts
export interface ActiveSession {
  id: string;
  eventName: string;
  startAt: number;
}
```

字段说明：

- `id`：使用 `crypto.randomUUID()` 生成，仅用于前端区分本次会话和防止同一页面重复操作。
- `eventName`：去除首尾空格后的事件名称。
- `startAt`：确认启动时的 Unix 毫秒时间戳。

### 5.2 提交请求

```ts
export interface CreateFlomoMemoRequest {
  sessionId: string;
  eventName: string;
  summary: string;
  startAt: number;
  endAt: number;
  timezone: string;
}
```

`timezone` 使用：

```ts
Intl.DateTimeFormat().resolvedOptions().timeZone
```

示例：`America/New_York`、`Asia/Shanghai`。

### 5.3 服务端响应

```ts
export type CreateFlomoMemoResponse =
  | { ok: true }
  | {
      ok: false;
      code:
        | "INVALID_INPUT"
        | "NOT_CONFIGURED"
        | "UPSTREAM_ERROR"
        | "NETWORK_ERROR";
      message: string;
    };
```

### 5.4 本地存储

固定键名：

```text
timeFri.activeSession.v1
```

只保存 `ActiveSession`，不保存未提交总结，避免用户在结束对话框中输入敏感内容后长期留在浏览器中。

页面初始化时：

1. 读取该键。
2. JSON 解析失败则删除损坏数据并进入 `idle`。
3. 数据字段合法则恢复为 `running`。
4. 不设置最长运行时限；持续时间根据当前时间动态计算。

---

## 6. 时间格式规则

### 6.1 当前时钟

```text
HH:mm:ss
```

例如：`09:05:08`。

### 6.2 Flomo 中的开始与结束时间

```text
YYYY-MM-DD HH:mm:ss (时区名称)
```

例如：

```text
2026-07-13 09:05:08 (America/New_York)
```

### 6.3 持续时间

- 小于 1 小时：`27分36秒`
- 大于等于 1 小时：`1小时27分36秒`
- 大于等于 24 小时：`1天3小时27分36秒`
- 始终向下取整到秒。
- 若 `endAt < startAt`，服务端拒绝请求，不生成负持续时间。

---

## 7. Flomo 内容格式

服务端将请求格式化为以下 Markdown：

```markdown
**事件：准备课程 PPT** #timeFri

- 开始：2026-07-13 09:05:08 (America/New_York)
- 结束：2026-07-13 10:32:44 (America/New_York)
- 持续：1小时27分36秒

**总结**
完成第 1—20 页，需补充两个教学案例。
```

提交给 Flomo 的 JSON：

```json
{
  "content": "<上面的 Markdown 字符串>",
  "content_type": "markdown"
}
```

服务端请求要求：

- 方法：`POST`
- 请求头：`Content-Type: application/json`
- Webhook 来源：`process.env.FLOMO_WEBHOOK_URL`
- 超时：10 秒
- 只将上游 HTTP 2xx 视为成功。
- 日志中只记录状态码和内部请求 ID，不记录完整内容、总结或 Webhook URL。

---

## 8. 安全设计

### 8.1 环境变量

创建 `.env.example`：

```dotenv
FLOMO_WEBHOOK_URL=https://flomoapp.com/iwh/REPLACE_WITH_YOUR_WEBHOOK
```

开发者在本机创建 `.env.local`，填入用户已经提供的真实 Webhook。

`.gitignore` 必须包含：

```gitignore
.env.local
.env*.local
```

### 8.2 服务端输入校验

服务端不能信任浏览器数据，必须重新校验：

- `sessionId`：非空字符串，最大 100 字符。
- `eventName`：非空字符串，最大 100 字符。
- `summary`：非空字符串，最大 2000 字符。
- `startAt`、`endAt`：有限数字、整数、正数。
- `endAt >= startAt`。
- `timezone`：非空字符串，最大 100 字符；使用 `Intl.DateTimeFormat` 尝试验证，失败时拒绝。

### 8.3 Webhook 轮换建议

真实 Webhook 已经出现在聊天内容中，应视为可能泄露。应用完成后建议在 Flomo 中重新生成 Webhook，并只把新地址写入部署平台的服务端环境变量。

---

## 9. 目录规划

```text
timeFri/
├── plan.md
├── package.json
├── package-lock.json
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── .gitignore
├── .env.example
├── app/
│   ├── api/
│   │   └── flomo/
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Clock.tsx
│   ├── StartDialog.tsx
│   ├── EndDialog.tsx
│   ├── TimerControls.tsx
│   └── StatusToast.tsx
├── hooks/
│   ├── useClock.ts
│   └── useActiveSession.ts
├── lib/
│   ├── flomo.ts
│   ├── storage.ts
│   ├── time.ts
│   └── validation.ts
├── types/
│   └── session.ts
├── tests/
│   ├── unit/
│   │   ├── flomo.test.ts
│   │   ├── storage.test.ts
│   │   ├── time.test.ts
│   │   └── validation.test.ts
│   ├── components/
│   │   ├── StartDialog.test.tsx
│   │   └── EndDialog.test.tsx
│   └── e2e/
│       └── timer-flow.spec.ts
└── README.md
```

职责边界：

- `app/page.tsx`：页面状态机和组件组合，不承载格式化与校验细节。
- `app/api/flomo/route.ts`：HTTP 边界、输入校验、调用 Flomo、响应映射。
- `components/*`：只处理展示和用户输入。
- `hooks/useClock.ts`：提供当前时间，每秒更新。
- `hooks/useActiveSession.ts`：管理运行会话及本地恢复。
- `lib/time.ts`：纯时间格式与持续时间计算。
- `lib/flomo.ts`：生成 Markdown 和调用上游 Webhook。
- `lib/storage.ts`：封装 `localStorage` 读写与损坏数据处理。
- `lib/validation.ts`：共享校验规则。
- `types/session.ts`：前后端共享的数据类型。

---

## 10. 实施任务

### Task 1：项目骨架与质量工具

**文件：**

- 创建：`timeFri/package.json`
- 创建：`timeFri/tsconfig.json`
- 创建：`timeFri/next.config.ts`
- 创建：`timeFri/eslint.config.mjs`
- 创建：`timeFri/vitest.config.ts`
- 创建：`timeFri/playwright.config.ts`
- 创建：`timeFri/app/layout.tsx`
- 创建：`timeFri/app/page.tsx`
- 创建：`timeFri/app/globals.css`
- 创建：`timeFri/.gitignore`
- 创建：`timeFri/.env.example`

**产出接口：**

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`

- [ ] 使用官方 Next.js TypeScript 模板初始化当前 `timeFri/` 目录，不再创建嵌套项目目录。
- [ ] 配置 Vitest 使用 `jsdom` 环境和 `@testing-library/jest-dom`。
- [ ] 配置 Playwright 使用本地 Next.js 开发服务器。
- [ ] 在 `.gitignore` 中排除 `.env.local`、`.next/`、`node_modules/`、测试报告。
- [ ] 在 `.env.example` 中只放占位 Webhook。
- [ ] 运行 `npm run lint`，预期退出码 0。
- [ ] 运行 `npm run typecheck`，预期退出码 0。
- [ ] 提交：`chore: initialize timeFri web app`。

### Task 2：时间与格式化纯函数

**文件：**

- 创建：`timeFri/lib/time.ts`
- 创建：`timeFri/tests/unit/time.test.ts`

**接口：**

```ts
export function formatClock(date: Date): string;
export function formatLocalDate(date: Date, locale?: string): string;
export function formatDuration(milliseconds: number): string;
export function formatMemoDate(timestamp: number, timezone: string): string;
```

- [ ] 先写失败测试，覆盖 `09:05:08` 固定两位数字。
- [ ] 覆盖 59 秒、1 分钟、1 小时、1 天以上持续时间。
- [ ] 覆盖负持续时间抛出错误。
- [ ] 覆盖指定时区下的 memo 日期格式。
- [ ] 实现最小纯函数使测试通过。
- [ ] 运行 `npm run test -- tests/unit/time.test.ts`，预期全部通过。
- [ ] 提交：`feat: add time formatting utilities`。

### Task 3：数据类型与输入校验

**文件：**

- 创建：`timeFri/types/session.ts`
- 创建：`timeFri/lib/validation.ts`
- 创建：`timeFri/tests/unit/validation.test.ts`

**接口：**

```ts
export interface ActiveSession {
  id: string;
  eventName: string;
  startAt: number;
}

export interface CreateFlomoMemoRequest {
  sessionId: string;
  eventName: string;
  summary: string;
  startAt: number;
  endAt: number;
  timezone: string;
}

export function normalizeEventName(value: string): string;
export function normalizeSummary(value: string): string;
export function validateCreateMemoRequest(
  value: unknown,
): CreateFlomoMemoRequest;
```

- [ ] 测试事件名称空白、超长、正常值。
- [ ] 测试总结空白、超长、多行正常值。
- [ ] 测试无效时间戳和结束时间早于开始时间。
- [ ] 测试无效时区。
- [ ] 实现校验并返回规范化对象；失败抛出可识别的输入错误。
- [ ] 运行单元测试，预期全部通过。
- [ ] 提交：`feat: validate timer session input`。

### Task 4：本地会话持久化

**文件：**

- 创建：`timeFri/lib/storage.ts`
- 创建：`timeFri/hooks/useActiveSession.ts`
- 创建：`timeFri/tests/unit/storage.test.ts`

**接口：**

```ts
export const ACTIVE_SESSION_KEY = "timeFri.activeSession.v1";
export function loadActiveSession(): ActiveSession | null;
export function saveActiveSession(session: ActiveSession): void;
export function clearActiveSession(): void;
```

Hook 接口：

```ts
export function useActiveSession(): {
  session: ActiveSession | null;
  startSession(eventName: string): ActiveSession;
  clearSession(): void;
  hydrated: boolean;
};
```

- [ ] 测试正常保存和恢复。
- [ ] 测试损坏 JSON 被删除并返回 `null`。
- [ ] 测试字段缺失或类型错误被删除。
- [ ] 测试 `startSession` 使用 `crypto.randomUUID()` 和 `Date.now()`。
- [ ] 实现客户端环境保护，服务端渲染阶段不访问 `window`。
- [ ] 运行测试，预期全部通过。
- [ ] 提交：`feat: persist active timer session`。

### Task 5：时钟和基础视觉组件

**文件：**

- 创建：`timeFri/hooks/useClock.ts`
- 创建：`timeFri/components/Clock.tsx`
- 创建：`timeFri/components/TimerControls.tsx`
- 修改：`timeFri/app/globals.css`

**接口：**

```ts
export function useClock(intervalMs?: number): Date;

export interface TimerControlsProps {
  isRunning: boolean;
  onStart: () => void;
  onEnd: () => void;
}
```

- [ ] 为 `useClock` 编写 fake timer 测试，验证每秒更新时间。
- [ ] 实现中央时钟、日期、当前事件和持续时间区域。
- [ ] 使用系统字体、低饱和背景、单一强调色、最大内容宽度 640px。
- [ ] 为数字启用等宽排版，避免秒数变化导致布局抖动。
- [ ] 确保 320px 宽屏幕无水平滚动。
- [ ] 确保按钮具备键盘焦点样式和 `disabled` 状态。
- [ ] 运行组件测试与 lint。
- [ ] 提交：`feat: add minimal clock interface`。

### Task 6：启动和结束对话框

**文件：**

- 创建：`timeFri/components/StartDialog.tsx`
- 创建：`timeFri/components/EndDialog.tsx`
- 创建：`timeFri/tests/components/StartDialog.test.tsx`
- 创建：`timeFri/tests/components/EndDialog.test.tsx`

**接口：**

```ts
export interface StartDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (eventName: string) => void;
}

export interface EndDialogProps {
  open: boolean;
  eventName: string;
  durationText: string;
  initialSummary: string;
  saving: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: (summary: string) => void;
}
```

- [ ] 测试打开时输入框自动聚焦。
- [ ] 测试空白事件不能提交。
- [ ] 测试 Enter 确认启动、Escape 取消。
- [ ] 测试总结支持多行，`Ctrl/Cmd+Enter` 提交。
- [ ] 测试保存中按钮禁用且不会重复回调。
- [ ] 对话框使用原生 `<dialog>` 或带完整 ARIA 属性的自定义实现。
- [ ] 实现错误信息的 `aria-live="polite"`。
- [ ] 运行组件测试。
- [ ] 提交：`feat: add start and finish dialogs`。

### Task 7：Flomo Markdown 生成器

**文件：**

- 创建：`timeFri/lib/flomo.ts`
- 创建：`timeFri/tests/unit/flomo.test.ts`

**接口：**

```ts
export function buildFlomoMarkdown(
  request: CreateFlomoMemoRequest,
): string;

export async function postToFlomo(
  webhookUrl: string,
  content: string,
  signal?: AbortSignal,
): Promise<void>;
```

- [ ] 测试 Markdown 包含事件、`#timeFri`、开始、结束、持续和总结。
- [ ] 测试事件名称与总结中的 Markdown 字符不会破坏整体结构；至少对事件标题中的换行进行替换。
- [ ] 测试请求体固定使用 `content_type: "markdown"`。
- [ ] 测试非 2xx 响应抛出上游错误。
- [ ] 使用 10 秒 `AbortController` 超时。
- [ ] 不在异常文本中包含 Webhook URL。
- [ ] 运行单元测试。
- [ ] 提交：`feat: format and send flomo memo`。

### Task 8：服务端 Flomo API

**文件：**

- 创建：`timeFri/app/api/flomo/route.ts`
- 创建：`timeFri/tests/unit/flomo-route.test.ts`

**接口：**

```text
POST /api/flomo
Content-Type: application/json
```

成功：

```json
{ "ok": true }
```

失败示例：

```json
{
  "ok": false,
  "code": "INVALID_INPUT",
  "message": "提交内容无效。"
}
```

- [ ] 测试无效 JSON 返回 HTTP 400。
- [ ] 测试字段校验失败返回 HTTP 400。
- [ ] 测试缺少 `FLOMO_WEBHOOK_URL` 返回 HTTP 500 和 `NOT_CONFIGURED`。
- [ ] 测试 Flomo 非 2xx 返回 HTTP 502 和 `UPSTREAM_ERROR`。
- [ ] 测试网络或超时错误返回 HTTP 502 和 `NETWORK_ERROR`。
- [ ] 测试成功返回 HTTP 200。
- [ ] 实现服务端日志脱敏。
- [ ] 运行 API 测试。
- [ ] 提交：`feat: add secure flomo proxy route`。

### Task 9：页面状态机与完整流程

**文件：**

- 修改：`timeFri/app/page.tsx`
- 创建：`timeFri/components/StatusToast.tsx`
- 创建：`timeFri/tests/components/page.test.tsx`

**状态：**

```ts
export type AppPhase =
  | "idle"
  | "startDialog"
  | "running"
  | "endDialog"
  | "saving"
  | "saveError";
```

- [ ] 测试空闲状态只允许启动。
- [ ] 测试确认启动后记录事件并进入运行状态。
- [ ] 测试刷新恢复的会话直接进入运行状态。
- [ ] 测试结束对话框取消后继续运行。
- [ ] 测试提交请求中的 `startAt` 保持原值、`endAt` 只生成一次。
- [ ] 测试提交成功后清除本地会话并回到空闲状态。
- [ ] 测试提交失败后保留会话和总结。
- [ ] 测试错误状态重试不会重新生成开始时间。
- [ ] 成功提示显示约 1.5 秒，但不阻塞下一次启动。
- [ ] 运行页面测试。
- [ ] 提交：`feat: complete timer recording flow`。

### Task 10：端到端测试

**文件：**

- 创建：`timeFri/tests/e2e/timer-flow.spec.ts`

- [ ] Mock `/api/flomo` 成功响应。
- [ ] 验证打开页面显示当前时钟和启用的“启动”。
- [ ] 输入事件名称并启动。
- [ ] 验证事件名称和持续时间出现。
- [ ] 输入总结并结束。
- [ ] 验证发送请求包含完整字段。
- [ ] 验证成功后页面恢复空闲状态。
- [ ] Mock API 失败，验证记录仍处于运行状态且可以重试。
- [ ] 通过 Playwright 注入 `localStorage`，验证刷新恢复。
- [ ] 在 Chromium 桌面和移动视口运行。
- [ ] 提交：`test: cover timeFri end-to-end flow`。

### Task 11：文档与最终验证

**文件：**

- 创建：`timeFri/README.md`

README 必须包含：

- 功能说明。
- Node.js 和 npm 前置条件。
- 安装与运行命令。
- `.env.local` 配置方法，但不得包含真实 Webhook。
- 测试、lint、typecheck、构建命令。
- 部署要求：必须使用支持 Next.js 服务端函数的平台，不能纯静态导出。
- Webhook 轮换和保密提醒。

最终命令：

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

预期：所有命令退出码均为 0；构建结果包含 `/` 页面和 `/api/flomo` 服务端路由。

- [ ] 完成 README。
- [ ] 使用真实 `.env.local` 在本机进行一次人工 Flomo 写入验证。
- [ ] 确认 memo 内容顺序、换行和时区正确。
- [ ] 确认提交成功后恢复初始界面。
- [ ] 确认浏览器源代码与网络响应中不出现 Webhook URL。
- [ ] 运行全部最终命令。
- [ ] 提交：`docs: add timeFri setup and verification guide`。

---

## 11. 验收标准

### 功能验收

- [ ] 打开页面后可看到每秒更新的本地时钟。
- [ ] 不输入事件名称不能启动。
- [ ] 确认启动后开始时间准确记录。
- [ ] 运行期间刷新页面不会丢失事件和开始时间。
- [ ] 不输入总结不能结束。
- [ ] 结束确认后生成准确结束时间和持续时间。
- [ ] Flomo 收到 Markdown 格式的完整记录。
- [ ] 成功后页面恢复初始状态。
- [ ] 失败后记录不丢失，并可以重试。

### 安全验收

- [ ] 真实 Webhook 不存在于 Git 跟踪文件。
- [ ] 浏览器 JavaScript 包中不存在真实 Webhook。
- [ ] 服务端错误响应不返回真实 Webhook。
- [ ] 服务端日志不记录总结全文或 Webhook。

### 体验验收

- [ ] 首屏没有历史列表、导航栏或非必要设置。
- [ ] 桌面和手机上时钟均保持视觉居中。
- [ ] 所有操作可使用键盘完成。
- [ ] 保存期间有明确状态且不能重复点击。
- [ ] 错误信息清晰，不丢失用户输入。

### 质量验收

- [ ] lint、typecheck、unit test、E2E test、build 全部通过。
- [ ] 时间与持续时间核心逻辑由纯函数测试覆盖。
- [ ] API 的成功、输入错误、未配置、上游失败和网络失败均有测试。

---

## 12. 推荐实施顺序

```text
项目骨架
  → 时间工具
  → 类型与校验
  → 本地会话恢复
  → 时钟界面
  → 启动/结束对话框
  → Flomo 格式化与请求
  → 服务端 API
  → 页面状态机
  → E2E 测试
  → README 与真实环境验证
```

该顺序确保每一步都有可独立测试的产出，并在接入真实 Flomo 前先完成绝大多数本地逻辑验证。
