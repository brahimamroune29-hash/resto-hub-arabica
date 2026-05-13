import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type DailyRow = { date: string; total: number };
type ItemRow = { name: string; qty: number; revenue: number };
type Kpis = {
  ordersToday: number;
  salesToday: number;
  avgOrderWeek: number;
  salesMonth: number;
};

export type AnalyticsExport = {
  restaurantName: string;
  kpis: Kpis;
  daily: DailyRow[];
  topItems: ItemRow[];
  bottomItems: ItemRow[];
};

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function exportAnalyticsExcel(data: AnalyticsExport) {
  const wb = XLSX.utils.book_new();

  const kpiSheet = XLSX.utils.aoa_to_sheet([
    ["Restaurant", data.restaurantName],
    ["Generated", new Date().toLocaleString()],
    [],
    ["Metric", "Value"],
    ["Orders Today", data.kpis.ordersToday],
    ["Sales Today (DZD)", data.kpis.salesToday],
    ["Avg Order (Week, DZD)", Math.round(data.kpis.avgOrderWeek)],
    ["Sales This Month (DZD)", data.kpis.salesMonth],
  ]);
  XLSX.utils.book_append_sheet(wb, kpiSheet, "KPIs");

  const dailySheet = XLSX.utils.json_to_sheet(
    data.daily.map((d) => ({ Date: d.date, "Total (DZD)": d.total })),
  );
  XLSX.utils.book_append_sheet(wb, dailySheet, "Daily Sales");

  const topSheet = XLSX.utils.json_to_sheet(
    data.topItems.map((r) => ({ Item: r.name, Qty: r.qty, "Revenue (DZD)": r.revenue })),
  );
  XLSX.utils.book_append_sheet(wb, topSheet, "Top Items");

  const bottomSheet = XLSX.utils.json_to_sheet(
    data.bottomItems.map((r) => ({ Item: r.name, Qty: r.qty, "Revenue (DZD)": r.revenue })),
  );
  XLSX.utils.book_append_sheet(wb, bottomSheet, "Bottom Items");

  XLSX.writeFile(wb, `analytics_${todayStamp()}.xlsx`);
}

export function exportAnalyticsPDF(data: AnalyticsExport) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(data.restaurantName || "Restaurant", 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Analytics Report - ${new Date().toLocaleString()}`, 14, 26);

  autoTable(doc, {
    startY: 34,
    head: [["Metric", "Value"]],
    body: [
      ["Orders Today", String(data.kpis.ordersToday)],
      ["Sales Today (DZD)", data.kpis.salesToday.toLocaleString()],
      ["Avg Order (Week, DZD)", Math.round(data.kpis.avgOrderWeek).toLocaleString()],
      ["Sales This Month (DZD)", data.kpis.salesMonth.toLocaleString()],
    ],
    theme: "grid",
    headStyles: { fillColor: [230, 57, 70] },
  });

  if (data.topItems.length) {
    autoTable(doc, {
      head: [["Top Items", "Qty", "Revenue (DZD)"]],
      body: data.topItems.map((r) => [r.name, String(r.qty), r.revenue.toLocaleString()]),
      theme: "striped",
      headStyles: { fillColor: [230, 57, 70] },
    });
  }

  if (data.bottomItems.length) {
    autoTable(doc, {
      head: [["Least Selling", "Qty", "Revenue (DZD)"]],
      body: data.bottomItems.map((r) => [r.name, String(r.qty), r.revenue.toLocaleString()]),
      theme: "striped",
      headStyles: { fillColor: [100, 100, 100] },
    });
  }

  if (data.daily.length) {
    autoTable(doc, {
      head: [["Date", "Total (DZD)"]],
      body: data.daily.map((d) => [d.date, d.total.toLocaleString()]),
      theme: "grid",
      headStyles: { fillColor: [230, 57, 70] },
    });
  }

  doc.save(`analytics_${todayStamp()}.pdf`);
}