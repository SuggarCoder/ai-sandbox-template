"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Model = "M4_Pro" | "M5_Pro";
type Platform = "Amazon" | "Costco_US" | "Costco_CA";
type Currency = "USD" | "CAD";
type DisplayMode = "native" | "usd_normalized";

type PriceRecord = {
  id: string;
  model: Model;
  platform: Platform;
  price: number;
  currency: Currency;
  url: string;
  inStock: boolean;
  createdAt: string;
};

type DailyPoint = {
  date: string;
  values: Record<Platform, number>;
};

const platformLabel: Record<Platform, string> = {
  Amazon: "Amazon",
  Costco_US: "Costco US",
  Costco_CA: "Costco CA"
};

const platformColor: Record<Platform, string> = {
  Amazon: "#ef4444",
  Costco_US: "#0ea5e9",
  Costco_CA: "#22c55e"
};

const fxCadToUsd = 0.74;

export const config = {
  title: "M4 Pro / M5 Pro MacBook Pro 价格自动化监控系统",
  description: "采集层 + 调度层 + Supabase 存储层 + Next.js 可视化展示层。"
};

const dayFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit"
});

function pseudoNoise(seed: number) {
  return Math.sin(seed * 2.17) * 8 + Math.cos(seed * 1.13) * 5;
}

function buildHistory(model: Model): DailyPoint[] {
  const baseMap: Record<Model, Record<Platform, number>> = {
    M4_Pro: {
      Amazon: 2199,
      Costco_US: 2149,
      Costco_CA: 2899
    },
    M5_Pro: {
      Amazon: 2399,
      Costco_US: 2349,
      Costco_CA: 3099
    }
  };

  const points: DailyPoint[] = [];
  const now = new Date();

  for (let i = 59; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const daySeed = i + (model === "M5_Pro" ? 13 : 7);

    const amazon = Math.max(1699, baseMap[model].Amazon + pseudoNoise(daySeed) - (i % 11 === 0 ? 35 : 0));
    const costcoUs = Math.max(1649, baseMap[model].Costco_US + pseudoNoise(daySeed + 5) - (i % 9 === 0 ? 28 : 0));
    const costcoCa = Math.max(2299, baseMap[model].Costco_CA + pseudoNoise(daySeed + 9) - (i % 10 === 0 ? 40 : 0));

    points.push({
      date: d.toISOString(),
      values: {
        Amazon: Number(amazon.toFixed(2)),
        Costco_US: Number(costcoUs.toFixed(2)),
        Costco_CA: Number(costcoCa.toFixed(2))
      }
    });
  }

  return points;
}

function toDisplayPrice(price: number, currency: Currency, mode: DisplayMode) {
  if (mode === "native") {
    return price;
  }

  if (currency === "CAD") {
    return Number((price * fxCadToUsd).toFixed(2));
  }

  return price;
}

function formatPrice(price: number, currency: Currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(price);
}

function buildLatestRecords(history: DailyPoint[], model: Model): PriceRecord[] {
  const latest = history.at(-1);
  if (!latest) {
    return [];
  }

  const now = new Date().toISOString();
  return (Object.keys(latest.values) as Platform[]).map((platform) => ({
    id: `${platform}_${model}_${now}`,
    model,
    platform,
    price: latest.values[platform],
    currency: platform === "Costco_CA" ? "CAD" : "USD",
    url:
      platform === "Amazon"
        ? "https://www.amazon.com/"
        : platform === "Costco_US"
          ? "https://www.costco.com/"
          : "https://www.costco.ca/",
    inStock: platform !== "Amazon" || Number(now.slice(17, 19)) % 2 === 0,
    createdAt: now
  }));
}

function PriceTrendChart({
  points,
  mode
}: {
  points: DailyPoint[];
  mode: DisplayMode;
}) {
  const width = 860;
  const height = 290;
  const left = 46;
  const right = 18;
  const top = 18;
  const bottom = 34;

  const innerW = width - left - right;
  const innerH = height - top - bottom;

  const chartValues = points.flatMap((point) =>
    (Object.keys(point.values) as Platform[]).map((platform) => {
      const currency: Currency = platform === "Costco_CA" ? "CAD" : "USD";
      return toDisplayPrice(point.values[platform], currency, mode);
    })
  );

  const min = Math.min(...chartValues);
  const max = Math.max(...chartValues);
  const span = Math.max(max - min, 1);

  const x = (index: number) => left + (index / Math.max(points.length - 1, 1)) * innerW;
  const y = (value: number) => top + ((max - value) / span) * innerH;

  const gridLevels = 4;
  const gridLines = Array.from({ length: gridLevels + 1 }, (_, i) => {
    const value = min + (span / gridLevels) * i;
    return {
      value,
      y: y(value)
    };
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg className="h-[300px] min-w-[720px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="price trend">
        <rect x={0} y={0} width={width} height={height} rx={12} fill="hsl(var(--card))" />

        {gridLines.map((line) => (
          <g key={line.y}>
            <line x1={left} y1={line.y} x2={width - right} y2={line.y} stroke="hsl(var(--border))" strokeDasharray="4 6" />
            <text x={6} y={line.y + 4} fontSize="11" fill="hsl(var(--muted-foreground))">
              {mode === "native" ? Math.round(line.value) : Math.round(line.value)}
            </text>
          </g>
        ))}

        {(Object.keys(platformColor) as Platform[]).map((platform) => {
          const polyline = points
            .map((point, idx) => {
              const currency: Currency = platform === "Costco_CA" ? "CAD" : "USD";
              const value = toDisplayPrice(point.values[platform], currency, mode);
              return `${x(idx)},${y(value)}`;
            })
            .join(" ");

          return (
            <polyline
              key={platform}
              points={polyline}
              fill="none"
              stroke={platformColor[platform]}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {points.map((point, idx) => {
          if (idx % 12 !== 0 && idx !== points.length - 1) {
            return null;
          }

          return (
            <text key={point.date} x={x(idx) - 14} y={height - 10} fontSize="10" fill="hsl(var(--muted-foreground))">
              {dayFormatter.format(new Date(point.date))}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function ThreadPage_1772722183_532409() {
  const [model, setModel] = useState<Model>("M4_Pro");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("native");

  const history = useMemo(() => buildHistory(model), [model]);
  const latestRecords = useMemo(() => buildLatestRecords(history, model), [history, model]);

  const lowestNow = useMemo(() => {
    if (!latestRecords.length) {
      return null;
    }

    return latestRecords
      .map((record) => ({
        ...record,
        normalizedUsd: toDisplayPrice(record.price, record.currency, "usd_normalized")
      }))
      .sort((a, b) => a.normalizedUsd - b.normalizedUsd)[0];
  }, [latestRecords]);

  const lastUpdated = latestRecords[0]?.createdAt;

  return (
    <div className="space-y-6 pb-12">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Thread 1772722183-532409</Badge>
          <Badge variant="outline">每天 4 次自动采集</Badge>
          <Badge variant="outline">Supabase + Next.js</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{config.title}</h1>
        <p className="max-w-4xl text-sm text-muted-foreground">{config.description}</p>
      </header>

      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle>实时状态卡片</CardTitle>
          <CardDescription>按当前抓取结果计算最低价来源，并支持 M4 Pro / M5 Pro 切换。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={model === "M4_Pro" ? "default" : "outline"}
              onClick={() => setModel("M4_Pro")}
            >
              M4 Pro
            </Button>
            <Button
              size="sm"
              variant={model === "M5_Pro" ? "default" : "outline"}
              onClick={() => setModel("M5_Pro")}
            >
              M5 Pro
            </Button>
            <Button
              size="sm"
              variant={displayMode === "native" ? "secondary" : "outline"}
              onClick={() => setDisplayMode("native")}
            >
              原币种显示
            </Button>
            <Button
              size="sm"
              variant={displayMode === "usd_normalized" ? "secondary" : "outline"}
              onClick={() => setDisplayMode("usd_normalized")}
            >
              统一折算 USD
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>当前最低价来源</CardDescription>
                <CardTitle className="text-lg">{lowestNow ? platformLabel[lowestNow.platform] : "-"}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {lowestNow
                  ? `约 ${formatPrice(lowestNow.normalizedUsd, "USD")}（标准化比较）`
                  : "暂无数据"}
              </CardContent>
            </Card>
            {latestRecords.map((record) => {
              const displayCurrency: Currency =
                displayMode === "usd_normalized" ? "USD" : record.currency;
              const displayValue =
                displayMode === "usd_normalized"
                  ? toDisplayPrice(record.price, record.currency, "usd_normalized")
                  : record.price;

              return (
                <Card key={record.platform}>
                  <CardHeader className="pb-3">
                    <CardDescription>{platformLabel[record.platform]}</CardDescription>
                    <CardTitle className="text-lg">{formatPrice(displayValue, displayCurrency)}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    {record.inStock ? "有货" : "库存波动 / 需重试"}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            最近更新时间：
            {lastUpdated
              ? new Date(lastUpdated).toLocaleString("zh-CN", { hour12: false })
              : "-"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>过去 60 天价格走势</CardTitle>
          <CardDescription>三平台对比折线图，可识别历史低点和价格波动区间。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {(Object.keys(platformLabel) as Platform[]).map((platform) => (
              <div className="flex items-center gap-1" key={platform}>
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: platformColor[platform] }}
                />
                {platformLabel[platform]}
              </div>
            ))}
            <span className="rounded bg-secondary px-2 py-1">
              {displayMode === "native" ? "展示币种: 原币种" : `展示币种: USD (1 CAD = ${fxCadToUsd} USD)`}
            </span>
          </div>
          <PriceTrendChart points={history} mode={displayMode} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>1. 架构概述</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">采集层 (Scraper)</p>
              <p>TypeScript + Playwright 执行浏览器级抓取，处理动态页面和反爬挑战。</p>
            </div>
            <div>
              <p className="font-medium text-foreground">调度层 (Scheduler)</p>
              <p>GitHub Actions Cron 每天 4 次触发，例如 UTC: 01:00 / 07:00 / 13:00 / 19:00。</p>
            </div>
            <div>
              <p className="font-medium text-foreground">存储层 (Database)</p>
              <p>Supabase Postgres 存储历史价格，使用 RLS 和只读视图供前端查询。</p>
            </div>
            <div>
              <p className="font-medium text-foreground">展示层 (Frontend)</p>
              <p>Next.js + Tailwind + shadcn/ui 构建价格监控面板与趋势分析。</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. 抓取策略</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Amazon</p>
            <p>按 ASIN 直达商品页。检测验证码/异常模板时走指数退避重试，并更换 session 指纹。</p>
            <p className="font-medium text-foreground">Costco US / CA</p>
            <p>进入页面后优先设置地区：US `95014`、CA `M4Y0G7`，等待价格节点稳定后再提取。</p>
            <p className="font-medium text-foreground">关键字段</p>
            <p>商品名、现价、原价、库存状态、来源站点、抓取时间戳、URL。</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>3. Supabase Schema / API</CardTitle>
            <CardDescription>前端通过 Supabase 查询 `price_records` 视图。</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-4 text-xs leading-5">
              <code>
                {`interface PriceRecord {\n  id: string;\n  model: 'M4_Pro' | 'M5_Pro';\n  platform: 'Amazon' | 'Costco_US' | 'Costco_CA';\n  price: number;\n  currency: 'USD' | 'CAD';\n  url: string;\n  createdAt: Date;\n}\n\n-- 推荐索引\ncreate index idx_price_records_model_time\n  on price_records(model, created_at desc);`}
              </code>
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. 自动化任务流程</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {["Scheduler 触发任务", "Playwright 抓取三平台", "清洗并写入 Supabase", "前端实时读取并刷新看板"].map(
              (step, idx) => (
                <div className={cn("rounded-md border p-3", idx === 2 ? "border-primary/40" : "border-border")} key={step}>
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs text-foreground">
                    {idx + 1}
                  </span>
                  {step}
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
