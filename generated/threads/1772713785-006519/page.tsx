"use client";

import { useMemo, useState } from "react";
import { Bot, CalendarClock, Database, ShieldCheck, ShoppingCart, Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const config = {
  title: "M4 Pro / M5 Pro 价格自动化监控系统",
  description: "TypeScript + Playwright + Supabase + Next.js 的自动采集与可视化方案。"
};

type Model = "M4_Pro" | "M5_Pro";
type Platform = "Amazon" | "Costco_US" | "Costco_CA";
type Currency = "USD" | "CAD";

interface PriceRecord {
  id: string;
  model: Model;
  platform: Platform;
  price: number;
  currency: Currency;
  url: string;
  stock: "In Stock" | "Low Stock";
  createdAt: string;
}

const platformMeta: Record<Platform, { label: string; color: string; currency: Currency; icon: typeof Store }> = {
  Amazon: { label: "Amazon", color: "#f59e0b", currency: "USD", icon: ShoppingCart },
  Costco_US: { label: "Costco US", color: "#2563eb", currency: "USD", icon: Store },
  Costco_CA: { label: "Costco CA", color: "#16a34a", currency: "CAD", icon: Store }
};

function generateHistory(model: Model) {
  const now = new Date("2026-03-05T04:30:00");
  const baseByPlatform: Record<Platform, number> =
    model === "M4_Pro"
      ? { Amazon: 2199, Costco_US: 2149, Costco_CA: 2999 }
      : { Amazon: 2499, Costco_US: 2449, Costco_CA: 3399 };

  return Array.from({ length: 30 }, (_, dayIndex) => {
    const d = new Date(now);
    const reverse = 29 - dayIndex;
    d.setDate(now.getDate() - reverse);
    const createdAt = d.toISOString();
    const label = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const records = (Object.keys(baseByPlatform) as Platform[]).map((platform, platformIdx) => {
      const base = baseByPlatform[platform];
      const wave = Math.sin((dayIndex + platformIdx * 2) / 2.4) * (platform === "Costco_CA" ? 28 : 22);
      const trend = (dayIndex - 15) * (platform === "Amazon" ? -1.1 : -0.9);
      const price = Math.max(base + wave + trend, base * 0.88);
      return {
        id: `${model}-${platform}-${dayIndex}`,
        model,
        platform,
        price: Number(price.toFixed(2)),
        currency: platformMeta[platform].currency,
        url: `https://example.com/${platform.toLowerCase()}/${model.toLowerCase()}`,
        stock: (dayIndex + platformIdx) % 8 === 0 ? "Low Stock" : "In Stock",
        createdAt
      } satisfies PriceRecord;
    });

    return { label, createdAt, records };
  });
}

function LineChart({
  points,
  activePlatforms
}: {
  points: ReturnType<typeof generateHistory>;
  activePlatforms: Platform[];
}) {
  const width = 900;
  const height = 320;
  const padX = 40;
  const padY = 28;

  const plotted = points.map((entry, xIndex) => ({
    xIndex,
    label: entry.label,
    records: entry.records.filter((r) => activePlatforms.includes(r.platform))
  }));

  const allValues = plotted.flatMap((p) => p.records.map((r) => r.price));
  if (allValues.length === 0) {
    return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">未选择平台</div>;
  }

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = Math.max(max - min, 1);
  const xStep = (width - padX * 2) / Math.max(plotted.length - 1, 1);

  const yOf = (value: number) => {
    const ratio = (value - min) / span;
    return height - padY - ratio * (height - padY * 2);
  };

  return (
    <div className="overflow-x-auto rounded-xl border bg-card/40 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[680px]">
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="hsl(var(--border))" />
        <line x1={padX} y1={padY} x2={padX} y2={height - padY} stroke="hsl(var(--border))" />
        {(Object.keys(platformMeta) as Platform[])
          .filter((platform) => activePlatforms.includes(platform))
          .map((platform) => {
            const coords = plotted
              .map((p) => {
                const found = p.records.find((record) => record.platform === platform);
                if (!found) {
                  return null;
                }
                return `${padX + p.xIndex * xStep},${yOf(found.price)}`;
              })
              .filter(Boolean)
              .join(" ");

            const latest = plotted[plotted.length - 1]?.records.find((r) => r.platform === platform);
            const iconColor = platformMeta[platform].color;
            return (
              <g key={platform}>
                <polyline fill="none" stroke={iconColor} strokeWidth="2.5" points={coords} />
                {latest ? (
                  <circle
                    cx={padX + (plotted.length - 1) * xStep}
                    cy={yOf(latest.price)}
                    r="4"
                    fill={iconColor}
                    stroke="white"
                    strokeWidth="1"
                  />
                ) : null}
              </g>
            );
          })}
        {[0, 0.5, 1].map((ratio) => {
          const value = min + span * ratio;
          const y = yOf(value);
          return (
            <g key={ratio}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="hsl(var(--border))" strokeDasharray="4 6" />
              <text x={8} y={y + 4} className="fill-muted-foreground text-[11px]">
                {Math.round(value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function ThreadPage_1772713785_006519() {
  const [model, setModel] = useState<Model>("M4_Pro");
  const [days, setDays] = useState<7 | 30>(30);
  const [activePlatforms, setActivePlatforms] = useState<Platform[]>(["Amazon", "Costco_US", "Costco_CA"]);

  const fullSeries = useMemo(() => generateHistory(model), [model]);
  const points = useMemo(() => fullSeries.slice(-days), [days, fullSeries]);
  const latest = points[points.length - 1];

  const currentRecords = useMemo(
    () => latest.records.filter((record) => activePlatforms.includes(record.platform)),
    [activePlatforms, latest.records]
  );

  const lowestUsd = currentRecords.filter((r) => r.currency === "USD").sort((a, b) => a.price - b.price)[0];
  const lowestCad = currentRecords.filter((r) => r.currency === "CAD").sort((a, b) => a.price - b.price)[0];

  const togglePlatform = (platform: Platform) => {
    setActivePlatforms((prev) =>
      prev.includes(platform) ? prev.filter((item) => item !== platform) : [...prev, platform]
    );
  };

  return (
    <div className="space-y-6 pb-10">
      <header className="space-y-2">
        <Badge>Thread 1772713785-006519</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">{config.title}</h1>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>实时最低价（当前快照）</CardDescription>
            <CardTitle>{lowestUsd ? `${lowestUsd.currency} ${lowestUsd.price}` : "N/A"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {lowestUsd ? `来源: ${platformMeta[lowestUsd.platform].label} | 库存: ${lowestUsd.stock}` : "暂无 USD 平台数据"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>CAD 最低价</CardDescription>
            <CardTitle>{lowestCad ? `${lowestCad.currency} ${lowestCad.price}` : "N/A"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {lowestCad ? `来源: ${platformMeta[lowestCad.platform].label}` : "未启用 Costco CA"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>调度频率</CardDescription>
            <CardTitle>每日 4 次</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">00:10 / 06:10 / 12:10 / 18:10 (UTC)</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>价格走势仪表盘（最近 {days} 天）</CardTitle>
          <CardDescription>按型号与平台对比 Amazon / Costco US / Costco CA 的价格变化</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant={model === "M4_Pro" ? "default" : "outline"} onClick={() => setModel("M4_Pro")}>
              M4 Pro
            </Button>
            <Button variant={model === "M5_Pro" ? "default" : "outline"} onClick={() => setModel("M5_Pro")}>
              M5 Pro
            </Button>
            <Button variant={days === 7 ? "secondary" : "outline"} onClick={() => setDays(7)}>
              7 天
            </Button>
            <Button variant={days === 30 ? "secondary" : "outline"} onClick={() => setDays(30)}>
              30 天
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(platformMeta) as Platform[]).map((platform) => {
              const meta = platformMeta[platform];
              const Icon = meta.icon;
              const isActive = activePlatforms.includes(platform);
              return (
                <Button
                  key={platform}
                  variant={isActive ? "secondary" : "outline"}
                  onClick={() => togglePlatform(platform)}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" style={{ color: meta.color }} />
                  {meta.label}
                </Button>
              );
            })}
          </div>
          <LineChart points={points} activePlatforms={activePlatforms} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4" />
              1. 架构概述
            </CardTitle>
            <CardDescription>采集层 / 调度层 / 存储层 / 展示层分离</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>采集层：TypeScript + Playwright，针对 Amazon ASIN 与 Costco 动态页面。</p>
            <p>调度层：GitHub Actions 或 Node Cron，固定每天 4 次任务。</p>
            <p>存储层：Supabase 记录价格、库存、时间戳、来源链接。</p>
            <p>展示层：Next.js + Tailwind + shadcn，支持趋势和低价识别。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              2. 抓取策略
            </CardTitle>
            <CardDescription>反爬应对与站点差异化处理</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Amazon：按 ASIN 直连，检测验证码并指数退避重试。</p>
            <p>Costco US：预设 ZipCode = 95014 后再抓取价格与库存。</p>
            <p>Costco CA：预设 PostalCode = M4Y0G7，统一商品字段输出。</p>
            <p>Stealth：浏览器指纹伪装、真实 UA、随机等待与节流并行。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              3. 数据模型（Supabase）
            </CardTitle>
            <CardDescription>核心结构 PriceRecord</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
{`interface PriceRecord {
  id: string;
  model: "M4_Pro" | "M5_Pro";
  platform: "Amazon" | "Costco_US" | "Costco_CA";
  price: number;
  currency: "USD" | "CAD";
  url: string;
  createdAt: Date;
}`}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4" />
              4. 前端展示能力
            </CardTitle>
            <CardDescription>30 天价格波动 + 最低买入点识别</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>状态卡片：当前最低价、来源平台、库存状态。</p>
            <p>历史曲线：按型号对比 Amazon / Costco US / Costco CA。</p>
            <p>筛选能力：7/30 天切换、平台开关、M4/M5 型号切换。</p>
            <p>扩展能力：可接入告警阈值与 Slack / 邮件通知。</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
