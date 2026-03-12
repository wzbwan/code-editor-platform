## Linux 使用说明

1. 先确认电脑里已经安装 Python 3。
2. 解压老师发给你的 `tar.gz` 压缩包。
3. 打开终端，进入解压后的目录。
4. 执行 `chmod +x start-local-runner.sh local-runner`。
5. 执行 `./start-local-runner.sh`。
6. 保持这个终端窗口不要关闭，然后再打开作业网页。

说明：

- 本程序只监听本机 `127.0.0.1:18423`，不会对外网开放。
- 关闭终端或按 `Ctrl+C`，本地运行器也会停止。
- 如果启动失败，优先检查终端输出里是否出现 `python not found`。
