import type { ReactNode } from "react";

export type Column = {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
  // 行数据来自 Prisma 查询结果，字段类型由调用方保证
  render?: (row: Record<string, any>) => ReactNode;
};

export default function DataTable({
  columns,
  rows,
  empty = "暂无数据"
}: {
  columns: Column[];
  rows: Record<string, any>[];
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  ...(c.width ? { width: c.width } : {}),
                  ...(c.align ? { textAlign: c.align } : {})
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-slate-400">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key} style={c.align ? { textAlign: c.align } : undefined}>
                    {c.render ? c.render(r) : (r[c.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
