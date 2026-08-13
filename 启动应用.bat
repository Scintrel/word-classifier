@echo off
chcp 65001 >nul
cd /d "d:\虚拟C盘\vsdesk\单词分类app"
echo 正在构建应用（请稍候）...
npm run build
echo 正在启动应用...
npx electron .
