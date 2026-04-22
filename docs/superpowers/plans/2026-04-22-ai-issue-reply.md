# AI Issue Reply Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建 GitHub Actions workflow，当收到 `/ai` 命令时使用 OpenRouter 免费模型自动回复 issue

**Architecture:** 使用 `issue_comment` 事件触发 workflow，通过 OpenRouter API 调用免费模型，将回复以 bot 身份评论到 issue

**Tech Stack:** GitHub Actions, GitHub CLI (gh), OpenRouter API

---

### Task 1: 创建 AI 回复 Workflow 文件

**Files:**
- Create: `.github/workflows/ai-issue-reply.yml`

- [ ] **Step 1: 创建 workflow 文件**

```yaml
name: AI Issue Reply
on:
  issue_comment:
    types: [created]

jobs:
  ai-reply:
    if: ${{ contains(github.event.comment.body, '/ai') && !github.event.issue.pull_request }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Get issue content
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
        run: |
          ISSUE_TITLE=$(gh issue view $ISSUE_NUMBER --json title -q '.title')
          ISSUE_BODY=$(gh issue view $ISSUE_NUMBER --json body -q '.body')
          echo "ISSUE_TITLE=$ISSUE_TITLE" >> $GITHUB_ENV
          echo "ISSUE_BODY=$ISSUE_BODY" >> $GITHUB_ENV

      - name: Call OpenRouter API
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          ISSUE_TITLE: ${{ env.ISSUE_TITLE }}
          ISSUE_BODY: ${{ env.ISSUE_BODY }}
          COMMENT_BODY: ${{ github.event.comment.body }}
        run: |
         RESPONSE=$(curl -s https://openrouter.ai/api/v1/chat/completions \
            -H "Authorization: Bearer $OPENROUTER_API_KEY" \
            -H "Content-Type: application/json" \
            -H "HTTP-Referer: https://github.com/${{ github.repository }}" \
            -H "X-Title: AI Issue Reply" \
            -d '{
              "models": ["free"],
              "messages": [
                {"role": "system", "content": "You are a helpful assistant that helps answer GitHub issue questions. Keep responses concise and helpful."},
                {"role": "user", "content": "Issue Title: '"$ISSUE_TITLE"'\n\nIssue Body:\n'"$ISSUE_BODY"'\n\nUser Question:\n'"$COMMENT_BODY"'"}
              ]
            }')
          
          AI_REPLY=$(echo $RESPONSE | jq -r '.choices[0].message.content')
          echo "AI_REPLY=$AI_REPLY" >> $GITHUB_ENV

      - name: Reply to issue
        if: ${{ env.AI_REPLY != '' && env.AI_REPLY != 'null' }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
          ACTOR: ${{ github.event.comment.user.login }}
        run: |
          gh issue comment $ISSUE_NUMBER --body "@$ACTOR $AI_REPLY"
```

- [ ] **Step 2: 提交到 git**

```bash
git add .github/workflows/ai-issue-reply.yml
git commit -m "feat: add AI issue reply workflow"
```

---

### Task 2: 设置 Secrets（用户自行完成）

用户需要在 GitHub 仓库设置以下 secrets：

1. **OPENROUTER_API_KEY** - 从 openrouter.ai 获取的 API key

操作步骤：
- 访问 https://openrouter.ai/keys 创建 API key
- 在仓库 Settings → Secrets and variables → Actions 中添加

---

### Task 3: 测试 Workflow

**Files:**
- Modify: `.github/workflows/ai-issue-reply.yml` (如需调整)

- [ ] **Step 1: 创建测试 Issue**

在仓库创建一个测试 issue，标题如 "测试 AI 回复"

- [ ] **Step 2: 发送 /ai 命令**

在 issue 下评论 `/ai 你好，请介绍一下你自己`

- [ ] **Step 3: 检查 Actions 运行**

查看 workflow 是否触发，检查日志输出

- [ ] **Step 4: 验证回复**

检查 issue 是否收到 bot 回复

---

**Plan 验证清单：**

- [x] Issue 评论包含 `/ai` 时触发 workflow
- [x] 获取 issue 标题和内容
- [x] 调用 OpenRouter `free` 模型
- [x] Bot 以 @用户 格式回复
- [x] 防止 PR comment 触发