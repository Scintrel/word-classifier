---
name: git-commit
description: 执行 git 提交：检查改动、确认无用户数据、生成中文提交信息并提交。质量门 Hook 会在提交时自动复核两张质量通行证。
---

# git-commit 技能

只做一件事：把当前改动提交到本地 git 仓库。

## 执行步骤

1. **看清改动**：
   ```bash
   git status --short
   git diff --stat
   ```
   快速浏览改动文件清单，理解这次改了什么。

2. **安全确认**（重要）：
   - 确认没有用户数据被加入：`*.db`、`resources/ecdict*.csv/json`（大词典）、`shots/` 等已被 .gitignore 排除，如 status 里出现这些文件，**停止并提醒用户**。
   - 确认没有敏感信息（密钥、密码、Token）混入改动。

3. **提交**（提交时质量门 Hook 会自动复核两张通行证）：
   ```bash
   git add -A
   git commit -m "$(cat << 'EOF'
   <中文提交信息>
   <要点列表，每条一行，简明说明改动>
   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```
   - 提交信息用中文，第一行是概括性标题，之后是"- "要点列表，最后固定带 `Co-Authored-By: Claude <noreply@anthropic.com>`。
   - 参考本仓库历史风格（如"移除纯单词模式与 AI 智能补全"）。

4. **汇报**：提交成功后输出提交号（`git log --oneline -1`）和改动统计。

## 注意

- 不 push（用户明确要求推送时才执行 `git push`）。
- 若 `git commit` 被质量门拦截（提示缺通行证/测试未过），把拦截原因原样转述给用户，不要绕过。
- 不要使用 `--no-verify` 或任何绕过机制。
