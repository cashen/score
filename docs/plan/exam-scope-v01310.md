# v0.13.1.0 — Exam Scope & Lifecycle Consolidation

一次考试统一为一个 Exam；subjectSet 表达本次实际考试科目。单科、多科、六科不形成三套业务模式。deletedAt 继续用于恢复，但删除考试不进入正常阅读链路。

保存成功自动关闭编辑窗口并恢复原阅读上下文；校验、网络或 revision 冲突保持窗口。移动端编辑器全屏滚动、底部 sticky 操作区、软键盘可用。schemaVersion 1、KV key、Share v2 URL 均不变。
