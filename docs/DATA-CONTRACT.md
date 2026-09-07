# Data Contract v1

## Exam

每场考试独立保存。重要字段：

- `name`, `date`, `type`, `status`, `dataStatus`
- `context`: 当时的年级/班级/学校快照，不能只引用“当前资料”
- `comparison`: 可选的考试可比性元数据；不改变 schemaVersion 1
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

`rank` 与 `participants` 都可以独立缺失。实际常见情况是学校只公布名次、不公布总人数；此时必须保留名次，不能因为人数未知而丢弃排名。只有两者同时存在且合法时才能计算百分位。

不同 `scope/label/basis` 不应直接描述为“上升/下降多少名”。跨考试比较时还需要结合考试可比性元数据和具体考试口径。

## Exam Comparison Metadata

v0.3.0 增加可选字段：

```json
{
  "comparison": {
    "series": "2027届辽宁模考",
    "level": "province"
  }
}
```

- `series`: 同一可比组使用同一个文本，例如一模、二模、三模都可标为 `2027届辽宁模考`。
- `level`: `school` / `alliance` / `district` / `city` / `province` / `other`。
- 两个字段都可为空；旧考试无需迁移。
- 更新旧记录时，如果请求没有提供 `comparison`，服务端保留已有值；显式提交空对象才表示清除。
- 分析优先使用同一 `series`；没有足够同系列数据时降级到同考试类型或最近考试，并明确提示可比性边界。

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

轨迹分享可以携带公开安全的 `comparison` 元数据，用于解释考试口径；它不包含账户信息或家庭备注。

`notes` 永远不属于可分享字段。