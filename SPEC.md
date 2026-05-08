# 家庭点菜网站 — 技术规范文档 (SPEC)

## 1. 产品概述

一个面向家庭场景的点菜协作网站。管理端上传和维护菜品库，用户端以房间形式协作点单、实时同步，最终导出为分页带图的 PDF 菜单。

| 属性   | 值                                   |
| ---- | ----------------------------------- |
| 目标用户 | 家庭成员（3-10 人）                        |
| 核心场景 | 周末聚餐、节日家宴的点菜协作                      |
| 使用模式 | 各自手机点单 + 大屏投屏只读讨论                   |
| 部署约束 | 零成本纯云（Supabase Free + Vercel Hobby） |

---

## 2. 技术选型

| 技术     | 选型                                          | 用途           |
| ------ | ------------------------------------------- | ------------ |
| 前端框架   | Next.js 15 (App Router) + TypeScript        | 页面路由、静态生成、部署 |
| UI     | Tailwind CSS + shadcn/ui                    | 组件库与样式       |
| 数据库    | Supabase PostgreSQL                         | 房间、菜品、点单记录   |
| 实时同步   | Supabase Realtime (Broadcast + Presence)    | 多设备点单同步、在线成员 |
| 文件存储   | Supabase Storage                            | 菜品照片         |
| 认证     | Supabase Anonymous Auth                     | 房间内昵称+密码身份   |
| PDF 导出 | 浏览器原生 `window.print()` + CSS `@media print` | 分页菜单导出       |
| 部署     | Vercel          | 前端托管         |
| 测试     | Vitest + React Testing Library + Playwright | 单元/组件/集成测试   |

### 选型理由

- **Supabase 胜于 Firebase**：Supabase 在国内网络环境下更稳定，数据在 PostgreSQL 中可随时导出备份，免费额度（500MB DB / 1GB Storage / 200 并发连接）对家庭场景足够。
- **CSS Print 胜于 html2canvas+jsPDF**：浏览器原生打印完美支持中文，不需要内嵌 5-10MB 字体文件，不存在分页截断和 canvas 跨域污染问题。
- **Next.js 胜于 Vite SPA**：虽然该项目高度依赖客户端交互，Next.js App Router 仍提供更好的路由和部署体验（Vercel 一键部署）。

---

## 3. 路由设计

| 路由                 | 名称   | 功能                              | 渲染模式 |
| ------------------ | ---- | ------------------------------- | ---- |
| `/`                | 首页   | 创建房间 / 输入房间码加入已存在的房间            | 客户端  |
| `/manage`          | 菜谱管理 | 全局菜谱库：增删改查菜品、上传照片、分类筛选          | 客户端  |
| `/room/[id]`       | 点单房间 | 浏览候选菜、勾选点单、查看已选汇总、触发导出          | 客户端  |
| `/room/[id]/cast`  | 投屏模式 | 大屏只读视图，实时同步菜品状态 + 在线成员          | 客户端  |
| `/room/[id]/print` | 打印页面 | 隐藏所有 UI 控件，纯菜单内容，CSS Print 分页布局 | 客户端  |
| `/auth/callback`   | 认证回调 | Supabase Anonymous Auth 回调处理    | 客户端  |

---

## 4. 数据模型

### 4.1 数据库表结构

```sql
-- 房间表
CREATE TABLE rooms (
  id            TEXT PRIMARY KEY,          -- 随机 6 位 alphanumeric 房间码
  name          TEXT NOT NULL,             -- 房间名（如"周末聚餐"）
  password_hash TEXT,                      -- bcrypt 哈希，NULL 表示无密码
  status        TEXT DEFAULT 'active',     -- 'active' | 'expired'
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 全局菜谱库
CREATE TABLE dishes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,               -- 菜名（≤30 字符）
  description TEXT DEFAULT '',             -- 描述（≤200 字符，可选）
  image_url   TEXT DEFAULT '',             -- Supabase Storage 公开 URL
  category    TEXT DEFAULT '家常',          -- 分类标签
  created_by  TEXT,                        -- 创建者昵称
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 房间-菜品关联（本次菜单候选）
CREATE TABLE room_dishes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  dish_id       UUID REFERENCES dishes(id) ON DELETE CASCADE,
  is_temporary  BOOLEAN DEFAULT false,     -- 是否为本次临时新增（已录入全局库）
  added_by      TEXT NOT NULL,
  added_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, dish_id)                -- 同一菜品不会重复加入同一房间
);

-- 点单记录
CREATE TABLE selections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  dish_id       UUID REFERENCES dishes(id) ON DELETE CASCADE,
  user_nickname TEXT NOT NULL,             -- 点单人的昵称
  quantity      SMALLINT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  note          TEXT DEFAULT '',           -- 个性化备注（如"少辣"）
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, dish_id, user_nickname)  -- 同一人同一菜只有一条记录
);
```

### 4.2 实体关系

```
rooms ──1:N── room_dishes ──N:1── dishes
rooms ──1:N── selections ──N:1── dishes
```

- `selections` 的 UNIQUE(room_id, dish_id, user_nickname) 保证同一人在同一房间对同一道菜只有一条记录，并发 +1 即 UPDATE quantity + 1。
- `room_dishes` 的 UNIQUE(room_id, dish_id) 避免重复加入同一菜品。

### 4.3 行级安全 (RLS)

```sql
-- selections: 同一房间内所有人可读可写
ALTER TABLE selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room_members_can_rw" ON selections
  USING (room_id = current_setting('app.current_room_id'));

-- dishes: 全局可读可写（家庭信任模型）
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_can_rw" ON dishes
  USING (true);

-- rooms: 仅知道房间码的人可读
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
```

---

## 5. 实时同步

### 5.1 通道设计

| 通道            | 类型                       | 订阅内容                                        | 触发时机       |
| ------------- | ------------------------ | ------------------------------------------- | ---------- |
| `selections`  | `table-db-changes`       | 当前房间 selections 表的 INSERT / UPDATE / DELETE | 任何人加减菜、改数量 |
| `room_dishes` | `table-db-changes`       | 当前房间 room_dishes 表的 INSERT                  | 任何人新增候选菜   |
| `presence`    | `broadcast` + `presence` | 在线成员列表（昵称 + 加入时间）                           | 加入房间、离开房间  |

### 5.2 数据流

```
用户A 点 "宫保鸡丁 +1"
  → 前端乐观更新 (本地状态 +1)
  → SUPABASE: INSERT INTO selections (...) VALUES (...)
                  ON CONFLICT (room_id, dish_id, user_nickname)
                  DO UPDATE SET quantity = quantity + 1
  → Supabase Realtime 广播变更到同房间所有客户端
  → 用户B/C/大屏收到变更 → 更新 UI

并发场景：
  用户A (quantity: 1→2)  用户B (quantity: 1→2)
  各自 UPDATE 行级锁保护 → 最终两行记录 quantity 各为 2
  前端 SUM(quantity) = 4 → 显示"宫保鸡丁 x4"
```

### 5.3 在线成员 (Presence)

```
用户加入房间 → channel.track({ nickname: "爸爸", joined_at: now })
用户离开 → channel.untrack()
大屏 cast 页同步显示在线成员列表 → "当前在线: 爸爸, 妈妈, 儿子"
```

---

## 6. 核心交互流程

### 6.1 创建房间

```
首页 → 输入房间名 → 输入昵称 → 输入密码（可选）→ 创建
  → 系统生成 6 位房间码
  → 写入 rooms 表
  → 当前用户作为第一个成员加入
  → 跳转 /room/[id]
```

### 6.2 加入房间

```
首页 → 输入房间码 → 输入昵称 → 输入密码（若有）
  → 验证房间码存在 + 密码匹配
  → 查询已有 selection 数据（如同昵称+匹配记录则恢复）
  → 加入实时通道
  → 展示当前候选菜和已有点单
```

### 6.3 点单交互

```
菜品卡片网格展示（每张卡片：图片 + 菜名 + 简介2行截断 + [-][数量][+]）

[+] → 乐观本地 +1 → UPSERT selections (quantity + 1)
[-] → 乐观本地 -1 → UPSERT selections (quantity - 1)
  若 quantity 降为 0 → DELETE 该 selection 记录

删除整道菜：
  - 查询该菜品的所有 selection 用户列表
  - 若仅自己点了 → 允许删除（-1 到 0）
  - 若还有其他人点了 → 弹窗提示"这道菜也是 [妈妈, 儿子] 点的，确定取消自己的吗？"
  - 明确确认后才 DELETE 自己的记录

底部固定栏：
  "已选 8 道菜 · 共 15 份" + [导出菜单] 按钮
```

### 6.4 管理候选菜

```
[从菜谱库选择]
  → 弹窗/侧栏展示全局菜谱（搜索 + 分类筛选）
  → 勾选多道 → 批量写入 room_dishes
  → 实时广播 → 全员可见新候选菜

[临时新增]
  → 快速表单：菜名（必填）+ 照片（可选）+ 描述（可选）+ 分类
  → 写入 dishes 表（全局库）+ room_dishes 表（当前房间）
  → 实时广播 → 全员可见
```

### 6.5 投屏模式

```
房间内点击"投屏"图标 → /room/[id]/cast

cast 页面特征：
  - 无任何可操作控件（无加减按钮、无输入框、无删除按钮）
  - 深色主题背景，大字体 2-3 米外可读
  - 菜品卡片仅展示：图片 + 菜名 + 已点总数量 + 点单人昵称列表
  - 右上角：在线成员昵称列表（实时 Presence）
  - 底部：已选统计
  - 实时监听 selections 变更，自动更新
```

### 6.6 导出 PDF

```
点击"导出菜单" → 新标签页打开 /room/[id]/print

print 页面行为：
  1. 页面加载 → 隐藏所有 UI 控件 → 仅显示纯菜单内容
  2. 预加载所有菜品图片（Promise.allSettled）
  3. 1000ms 后自动调用 window.print()
  4. 用户在弹出的打印对话框中选择"另存为 PDF"
  5. 打印完成后触发 afterprint 事件 → 提示"导出完成"→ 关闭页面

移动端跳板：
  ┌─ Android / iOS Chrome → 调用系统打印（效果有限）
  └─ 移动端 WebView / 部分浏览器不支持 → 显示"请在电脑端打开此页面导出"
```

---

## 7. PDF 排版规格

### 7.1 页面参数

| 参数      | 值                       |
| ------- | ----------------------- |
| 纸张      | A4 竖版 (210mm × 297mm)   |
| 上边距     | 15mm                    |
| 下边距     | 20mm                    |
| 左右边距    | 12mm                    |
| 内容区可用高度 | ~227mm（扣除标题 + 统计行）      |
| 每道菜卡片高度 | ~42mm（图片 30mm + 文字 2 行） |
| 每页菜品数   | 4–5 道（动态，最后一页允许不满）      |

### 7.2 每页布局

```
┌──────────────────────────────────────────┐
│  家庭菜单 — 周末聚餐                📅 2026/05/07  │  ← 标题行（14mm）
│──────────────────────────────────────────│
│                                            │
│  [图] 宫保鸡丁 x3                          │
│  [片] 鸡肉 · 花生 · 干辣椒 · 微辣           │
│       📌 爸爸 妈妈 儿子                    │
│                                            │
│  [图] 红烧排骨 x2                          │
│  [...]                                     │
│                                            │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │  ← 分隔线
│                                            │
│  共 8 道菜 · 15 份 · 6 人用餐              │  ← 底部统计（18mm）
│──────────────────────────────────────────│
│  第 1/3 页                                │  ← 页码（10mm）
└──────────────────────────────────────────┘
```

### 7.3 CSS Print 关键规则

```css
@media print {
  @page {
    size: A4 portrait;
    margin: 15mm 12mm 20mm 12mm;
  }
  .no-print { display: none !important; }
  .dish-card { page-break-inside: avoid; }
  .page-break { page-break-after: always; }
  .page-break:last-child { page-break-after: avoid; }
  img {
    max-width: 100%;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

### 7.4 分页逻辑

- 用 CSS `page-break-inside: avoid` 保护单道菜不被截断
- 当内容超出一页时，浏览器自动在 `page-break` 处断页
- 无人点的菜（quantity = 0）不放入打印页
- 无菜品时显示"暂无已点菜品"占位

### 7.5 浏览器兼容性

| 浏览器         | 状态            | 说明                       |
| ----------- | ------------- | ------------------------ |
| Chrome/Edge | 完美            | 建议首选                     |
| Firefox     | 良好            | `@page size` 可能不生效，不影响内容 |
| Safari      | 图片需手动勾选"打印背景" | Print 页面顶部文字提示           |
| 移动端         | 不可用           | Print 页面检测并显示电脑端引导       |

---

## 8. 图片管理

### 8.1 上传压缩

| 参数    | 值                        |
| ----- | ------------------------ |
| 允许格式  | JPEG / PNG / WebP / HEIC |
| 原始上限  | 10MB                     |
| 压缩后大小 | ≤ 500KB                  |
| 压缩尺寸  | 短边 400px，长边等比例           |
| 输出格式  | WebP (quality 80%)       |
| 压缩位置  | 前端 Canvas API            |

### 8.2 存储结构

```
Supabase Storage
  └─ bucket: dishes/
       └─ {dish_id}.webp   (单一压缩后文件)
```

- 公共访问桶，配置 CORS 头 `Access-Control-Allow-Origin: *`
- 存储配额 1GB（约可存 2000+ 道菜品图片）

### 8.3 上传失败处理

| 情况           | 处理                                 |
| ------------ | ---------------------------------- |
| 文件 > 10MB    | 前端拦截，toast "图片不能超过10MB"            |
| 格式不支持        | 前端拦截，toast "仅支持 JPG/PNG/WebP/HEIC" |
| 上传网络中断       | 加载态 + 最多 3 次重试 → 失败提示              |
| Storage 配额耗尽 | 413 响应 → "存储空间已满，请清理旧菜品"           |

---

## 9. 并发与冲突处理

| 操作       | 规则                                                |
| -------- | ------------------------------------------------- |
| 多人点同一道菜  | 各自独立 selection 记录，UNIQUE 约束保证不冲突，前端 SUM 显示总数      |
| 同一人多次 +1 | UPSERT ON CONFLICT → quantity + 1，PostgreSQL 行锁保护 |
| 删菜（仅自己）  | quantity -1 到 0 → DELETE 自己的记录                    |
| 删菜（有共点人） | 弹窗提示"这也是 [昵称列表] 点的"→ 确认后只删自己的                     |
| 管理员移除候选菜 | 仅当该菜品的 selections 总数 = 0 时允许，否则按钮禁用并提示            |
| 断网恢复     | 不持久化离线操作；显示黄色重连条 → 恢复后全量 refetch                  |

---

## 10. 边界与错误处理

| 场景           | 处理                          |
| ------------ | --------------------------- |
| 空菜谱库         | `/manage` 显示空状态插画 + 引导文字    |
| 房间内无候选菜      | 显示"从菜谱库选菜或临时新增"引导，隐藏导出按钮    |
| 全员未点单        | 所有菜品数量 = 0，导出按钮禁用 + tooltip |
| 房间码不存在       | 错误提示 + 列出最近活跃房间             |
| 密码错误         | toast "密码错误"（不透露其他信息）       |
| 重复昵称（同房间第二次） | 提示"该昵称已在线，是否换一个？"           |
| 文件上传过大       | 前端直接拦截                      |
| 网络断开         | 顶部黄色条"网络异常，正在重连…"，恢复后自动刷新数据 |

---

## 11. 安全

| 层面   | 策略                                    |
| ---- | ------------------------------------- |
| 密码存储 | bcrypt 哈希（数据库），SHA-256 传输             |
| 输入消毒 | 菜名/描述/昵称 max 200 字符，过滤 HTML 标签        |
| 房间码  | 字母数字 + 连字符，max 20 字符                  |
| RLS  | selections / room_dishes 按 room_id 隔离 |
| XSS  | React 默认转义 + DOMPurify（如有富文本）         |
| CSRF | Next.js Server Actions 自带保护           |

---

## 12. 非功能需求

### 12.1 性能

| 指标           | 目标           |
| ------------ | ------------ |
| 首屏 LCP       | < 2.5s       |
| 实时同步延迟       | < 500ms      |
| 单图加载         | < 1s         |
| PDF 打印触发     | < 2s（含图片预加载） |
| 首屏 JS (gzip) | < 200KB      |

### 12.2 排除范围 (YAGNI)

- 不做服务端渲染 PDF（违背零成本约束）
- 不做 Web Worker 图片压缩
- 不做虚拟滚动 / 无限加载
- 不做 i18n 国际化
- 不做 PWA / Service Worker 离线
- 不做后台定时清理任务（手动清理即可）
- 不做复杂权限模型（家庭信任模型，公开菜谱库）

### 12.3 房间生命周期

- 创建后 7 天自动标记 `status = 'expired'`
- 首页默认不列出过期房间
- 数据不自动删除（手动清理）

---

## 13. 测试策略

| 层级   | 覆盖范围                                          | 工具                    |
| ---- | --------------------------------------------- | --------------------- |
| 单元测试 | 图片压缩、分页算法、房间码生成、输入验证                          | Vitest                |
| 组件测试 | DishCard、SelectionPanel、MemberList、PrintPage  | React Testing Library |
| 集成测试 | 完整流程：创建房间 → 选菜 → 点单 → 导出（mock Supabase）       | Playwright            |
| 真机测试 | iPhone Safari + Android Chrome + 桌面 Chrome 打印 | 手动                    |

### 关键测试用例

1. 同一菜品多人 +1 后总数计算正确
2. 删除有共点人的菜品时弹出提示
3. Safari 打印页显示提示文字
4. 上传超限文件被前端拦截
5. 房间码不存在时给出错误提示
6. 重复昵称检测 + 提示
7. 断网重连后数据正确恢复
8. 候选菜移除检测（有人点 vs 没人点）
9. 空状态页面渲染（无菜谱库、无候选菜）
10. 打印页图片预加载 + `window.print()` 触发

---

## 14. 项目结构（建议）

```
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # 首页（创建/加入房间）
│   │   ├── manage/
│   │   │   └── page.tsx              # 菜谱管理
│   │   ├── room/
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # 点单房间
│   │   │       ├── cast/
│   │   │       │   └── page.tsx      # 投屏模式
│   │   │       └── print/
│   │   │           └── page.tsx      # 打印页面
│   │   └── auth/
│   │       └── callback/
│   │           └── route.ts          # Auth 回调
│   ├── components/
│   │   ├── ui/                       # shadcn/ui 组件
│   │   ├── CreateRoomForm.tsx
│   │   ├── JoinRoomForm.tsx
│   │   ├── DishCard.tsx
│   │   ├── DishGrid.tsx
│   │   ├── SelectionPanel.tsx
│   │   ├── DishSelector.tsx          # 从菜谱库选菜弹窗
│   │   ├── QuickAddDish.tsx          # 临时新增表单
│   │   ├── MemberList.tsx            # 在线成员
│   │   ├── PrintLayout.tsx           # 打印页布局
│   │   └── ConnectionStatus.tsx      # 连接状态提示
│   ├── lib/
│   │   ├── supabase.ts               # Supabase 客户端
│   │   ├── compress.ts               # 图片压缩
│   │   └── utils.ts                  # 房间码生成、验证等
│   └── hooks/
│       ├── useRealtimeRoom.ts        # 实时同步 Hook
│       ├── useSelections.ts          # 点单状态管理
│       └── usePresence.ts            # 在线成员 Hook
├── public/
├── tailwind.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## 15. 里程碑建议

| 阶段          | 内容                                                       | 估时       |
| ----------- | -------------------------------------------------------- | -------- |
| M1: 数据与基础设施 | Supabase 配置、数据库表创建、RLS 策略、Next.js 初始化、Supabase Client 封装 | 1 天      |
| M2: 菜谱管理    | `/manage` 页面、菜品 CRUD、图片上传与压缩、菜品列表与搜索                     | 2 天      |
| M3: 房间与身份   | 创建/加入房间、房间码生成、密码哈希、匿名认证、昵称管理                             | 1.5 天    |
| M4: 点单核心    | 菜品选择（从库 / 临时新增）、加减点单、Selections 同步、底部汇总                  | 2 天      |
| M5: 实时同步    | Supabase Realtime 集成、Presence 在线成员、投屏只读页、并发冲突处理          | 2 天      |
| M6: PDF 导出  | Print 页面布局、CSS Print 分页、图片预加载、浏览器兼容适配、引导提示               | 1.5 天    |
| M7: 边界与测试   | 错误处理、空状态、断网重连、关键测试用例、真机验证                                | 2 天      |
| **合计**      |                                                          | **12 天** |

---

*文档版本: 1.0 | 日期: 2026-05-07 | 状态: 待审查*
