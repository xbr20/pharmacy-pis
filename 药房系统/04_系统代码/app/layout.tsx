import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "药房信息系统（PIS）",
  description: "药房信息系统——系统分析与设计课程作业配套可运行系统（模拟数据）"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
