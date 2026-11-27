@echo off
chcp 65001 > nul
title أداة سحب وتحميل فيديوهات الكورسات كاملة MP4
cd /d "D:\data\edunova-apps-platform"
node download-runner.cjs
pause
