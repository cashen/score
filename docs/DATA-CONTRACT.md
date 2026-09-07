# Data Contract v1

## Exam

每场考试独立保存。重要字段：

- `name`, `date`, `type`, `status`, `dataStatus`
- `context`: 当时的年级/班级/学校快照，不能只引用“当前资料”
- `comparison`: 可选的考试系列/层级元数据；不改变 schemaVersion 1
- `overall.officialScore`: 学校公布总分
- `overall.calculatedScore`: 六科按 final/raw 计算出的合计，只用于核对
- `overall.rankings[]`: 任意排名口径数组
- `subjects`: 语数英物化生
- `notes`: 家庭内部备注
- `revision`: 乐观冲突版本

`type=school` 表示校考；`type=joint` 表示联考。

## Ranking

```json
{
  "scope": "school",
  "label": "校物理类",
  "rank": 128,
  "participants": 1320,
  "basis": "final_score"
}
```

`rank` 与 `participants` 都可以独立缺失。实际常见情况是学校只公布名次、不公布总人数；此时必须保留名次，不能因为人数未知而丢弃排名。只有两者同时存在且合法时才能计算百分位。

联考总位次使用同一个 rankings 结构：

```json
{
  "scope": "joint",
  "label": "联考",
  "rank": 326,
  "participants": null,
  "basis": "final_score"
}
```

联考人数同样不是必填项。没有总人数时只展示“第 326 名”，不推算联考百分位。

不同 `scope/label/basis` 不应直接描述为“上升/下降多少名”。

## Trend Comparison Category

趋势判断先经过考试类别门槛，类别不一致不能进入同一个趋势结论：

- `monthly`：只和月考比较；不与联考、校考合并。
- `joint` + `school`：统一视为“联考/校考”类别，可以合并观察。
- `mock1` + `mock2` + `mock3`：统一视为“模考”类别。
- `weekly`、`midterm`、`final`、`other`：默认只与各自同类别比较。

单科历史页面仍然保留所有考试记录。类别门槛只决定哪些考试进入趋势计算，不会把其他历史考试隐藏掉。

对于联考与校考混合的趋势，只比较两场考试共有且口径一致的位置指标，例如校排名/校百分位；联考位次是联考自身的额外位置字段，不能与校考校排名直接混算。

## Exam Series / Level Metadata

v0.3.0 保留可选字段：

```json
{
  "comparison": {
    "series": "2027届辽宁模考",
    "level": "province"
  }
}
```

- `series`: 同类别考试可标记为同一系列。
- `level`: `school` / `alliance` / `district` / `city` / `province` / `other`。
- 两个字段都可为空；旧考试无需迁移。
- 趋势首先要求类别兼容；同类别中至少有两次相同 `series` 时，可以优先使用该系列。
- 更新旧记录时，如果请求没有提供 `comparison`，服务端保留已有值；显式提交空对象才表示清除。

## Score Mode

- `raw`: 原始分直接计入
- `converted`: 只记录转换/赋分结果
- `raw_and_converted`: 同时记录原始分与赋分结果

## Missing Data

缺失使用 `null`，禁止用 `0` 表示“学校未公布”。`dataStatus=partial` 允许先保存不完整成绩，稍后补录。

## Share Grant

- `kind`: `secret` / `public`
- `mode`: `live` / `snapshot`
- `scope`: `single` / `trajectory`
- `examId`: 单次考试分享时钉住具体考试
- `fields`: allow-list 字段选择
- `expiresAt`: 可选
- `locator`: secret 为 token hash，public 为 slug

轨迹分享可以携带公开安全的考试类型、`comparison` 元数据和已勾选的排名字段，包括联考位次；它不包含账户信息或家庭备注。

`notes` 永远不属于可分享字段。
