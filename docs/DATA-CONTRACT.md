# Data Contract v1

## Exam

每场考试独立保存。重要字段：

- `name`, `date`, `type`, `status`, `dataStatus`
- `context`: 当时的年级/班级/学校快照，不能只引用“当前资料”
- `overall.officialScore`: 学校公布总分
- `overall.calculatedScore`: 六科按 final/raw 计算出的合计，只用于核对
- `overall.rankings[]`: 任意排名口径数组
- `subjects`: 语数英物化生
- `notes`: 家庭内部备注
- `revision`: 乐观冲突版本

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

排名和参与人数必须同时出现。不同 `scope/label/basis` 不应直接描述为“上升/下降多少名”。

## Score Mode

- `raw`: 原始分直接计入
- `converted`: 只记录转换/赋分结果
- `raw_and_converted`: 同时记录原始分与赋分结果

## Missing Data

缺失使用 `null`，禁止用 `0` 表示“学校未公布”。`dataStatus=partial` 允许先保存不完整成绩，稍后补录。

## Share Grant

- `kind`: `secret` / `public`
- `mode`: `live` / `snapshot`
- `fields`: allow-list 字段选择
- `expiresAt`: 可选
- `locator`: secret 为 token hash，public 为 slug

`notes` 不属于 v1 可分享字段。
