"use client";
import Link from "next/link";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { badgeClass, downloadCsv, formatValue } from "@/lib/report-format";
function renderCell(column, row) {
  const value = row[column.key];
  const text = formatValue(value, column.format);
  if (column.format === "badge" && value !== null && value !== undefined) {
    return (
      <Badge variant="outline" className={badgeClass(value)}>
        {text}
      </Badge>
    );
  }
  if (column.format === "json") {
    return (
      <span
        className="block max-w-[240px] truncate font-mono text-xs"
        title={text}
      >
        {text}
      </span>
    );
  }
  return text;
}
export function ReportTable({ def, rows, filename }) {
  return (
    <Card className="print:break-inside-avoid-page print:shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          {def.title}{" "}
          <span className="font-normal text-muted-foreground">
            ({rows.length})
          </span>
        </CardTitle>
        {rows.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="print:hidden"
            onClick={() => downloadCsv(filename, def.columns, rows)}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No records found for the selected filters.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {def.columns.map((c) => (
                  <TableHead key={c.key}>{c.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={row.id ?? i}>
                  {def.columns.map((column, colIndex) => (
                    <TableCell key={column.key}>
                      {colIndex === 0 && def.rowHref ? (
                        <Link
                          href={def.rowHref(row)}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {renderCell(column, row)}
                        </Link>
                      ) : (
                        renderCell(column, row)
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
