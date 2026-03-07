import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerSupabase } from "@/lib/supabase/server";

type TargetKey = "m4_pro_24_512" | "m5_16_512" | "m5_pro_24_1tb";

type ProductRow = {
  id: string;
  model: string;
  specs: string;
  platform: string;
  region: string;
  url: string;
  created_at: string;
};

type PriceHistoryRow = {
  id: number;
  product_id: string;
  price: number;
  captured_at: string;
};

type EnrichedProduct = ProductRow & {
  targetKey: TargetKey;
  label: string;
  history: PriceHistoryRow[];
};

type ChartPoint = {
  timestamp: string;
  prices: Partial<Record<TargetKey, number>>;
};

const targetDefinitions: Array<{
  key: TargetKey;
  displayLabel: string;
  model: string;
  specs: string;
  color: string;
}> = [
  {
    key: "m4_pro_24_512",
    displayLabel: "MacBook Pro (14), M4 Pro, 24GB RAM, 512GB SSD",
    model: "MacBook Pro M4 Pro",
    specs: "24GB/512GB",
    color: "#0ea5e9"
  },
  {
    key: "m5_16_512",
    displayLabel: "MacBook Pro (14), M5, 16GB RAM, 512GB SSD",
    model: "MacBook Pro M5",
    specs: "16GB/512GB",
    color: "#f97316"
  },
  {
    key: "m5_pro_24_1tb",
    displayLabel: "MacBook Pro (14), M5 Pro, 24GB RAM, 1TB SSD",
    model: "MacBook Pro M5 Pro",
    specs: "24GB/1TB",
    color: "#22c55e"
  }
];

export const config = {
  title: "MacBook Pro 历史价格 Dashboard",
  description: "Supabase 实时读取 products 与 price_history，展示 3 个指定型号的历史价格。"
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function normalizeValue(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function getTargetDefinition(product: ProductRow) {
  const model = normalizeValue(product.model);
  const specs = normalizeValue(product.specs);

  return (
    targetDefinitions.find(
      (target) =>
        normalizeValue(target.model) === model &&
        normalizeValue(target.specs) === specs
    ) ?? null
  );
}

function buildChartPoints(products: EnrichedProduct[]): ChartPoint[] {
  const byTimestamp = new Map<string, ChartPoint>();

  for (const product of products) {
    for (const entry of product.history) {
      const existing = byTimestamp.get(entry.captured_at) ?? {
        timestamp: entry.captured_at,
        prices: {}
      };

      existing.prices[product.targetKey] = Number(entry.price);
      byTimestamp.set(entry.captured_at, existing);
    }
  }

  return [...byTimestamp.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function PriceChart({ points }: { points: ChartPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无历史价格数据。</p>;
  }

  const width = 920;
  const height = 320;
  const left = 52;
  const right = 20;
  const top = 20;
  const bottom = 44;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;

  const values = points.flatMap((point) =>
    Object.values(point.prices).filter((value): value is number => typeof value === "number")
  );

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);

  const xForIndex = (index: number) =>
    left + (index / Math.max(points.length - 1, 1)) * innerWidth;
  const yForValue = (value: number) =>
    top + ((max - value) / span) * innerHeight;

  const yGrid = Array.from({ length: 4 }, (_, index) => {
    const value = min + (span / 3) * index;
    return { value, y: yForValue(value) };
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg
        className="h-[320px] min-w-[760px] w-full"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="MacBook Pro historical price chart"
      >
        <rect x={0} y={0} width={width} height={height} rx={16} fill="hsl(var(--card))" />

        {yGrid.map((grid) => (
          <g key={grid.y}>
            <line
              x1={left}
              y1={grid.y}
              x2={width - right}
              y2={grid.y}
              stroke="hsl(var(--border))"
              strokeDasharray="4 6"
            />
            <text x={6} y={grid.y + 4} fontSize="11" fill="hsl(var(--muted-foreground))">
              {Math.round(grid.value)}
            </text>
          </g>
        ))}

        {targetDefinitions.map((target) => {
          const polyline = points
            .map((point, index) => {
              const value = point.prices[target.key];
              if (typeof value !== "number") {
                return null;
              }

              return `${xForIndex(index)},${yForValue(value)}`;
            })
            .filter(Boolean)
            .join(" ");

          if (!polyline) {
            return null;
          }

          return (
            <polyline
              key={target.key}
              points={polyline}
              fill="none"
              stroke={target.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {points.map((point, index) => {
          if (index !== 0 && index !== points.length - 1 && index % Math.ceil(points.length / 4) !== 0) {
            return null;
          }

          return (
            <text
              key={point.timestamp}
              x={xForIndex(index) - 18}
              y={height - 12}
              fontSize="10"
              fill="hsl(var(--muted-foreground))"
            >
              {dateFormatter.format(new Date(point.timestamp))}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default async function ThreadPage_1772722183_532409() {
  const supabase = getServerSupabase({ useServiceRole: true });

  const { data: productsData, error: productsError } = await supabase
    .from("products")
    .select("id,model,specs,platform,region,url,created_at")
    .order("created_at", { ascending: false });

  if (productsError) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <Badge variant="secondary">Thread 1772722183-532409</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">{config.title}</h1>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>读取 products 失败</CardTitle>
            <CardDescription>当前页面依赖 Supabase 实时查询。</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {productsError.message}
          </CardContent>
        </Card>
      </div>
    );
  }

  const matchedProducts = ((productsData ?? []) as ProductRow[])
    .map((product) => {
      const target = getTargetDefinition(product);
      if (!target) {
        return null;
      }

      return {
        ...product,
        targetKey: target.key,
        label: target.displayLabel
      };
    })
    .filter(
      (
        product
      ): product is ProductRow & { targetKey: TargetKey; label: string } => Boolean(product)
    );

  const productIds = matchedProducts.map((product) => product.id);

  const { data: historyData, error: historyError } = productIds.length
    ? await supabase
        .from("price_history")
        .select("id,product_id,price,captured_at")
        .in("product_id", productIds)
        .order("captured_at", { ascending: true })
    : { data: [], error: null };

  const historyByProductId = new Map<string, PriceHistoryRow[]>();
  for (const item of ((historyData ?? []) as PriceHistoryRow[])) {
    const list = historyByProductId.get(item.product_id) ?? [];
    list.push(item);
    historyByProductId.set(item.product_id, list);
  }

  const products = matchedProducts.map((product) => ({
    ...product,
    history: historyByProductId.get(product.id) ?? []
  })) as EnrichedProduct[];

  const groupedByTarget = targetDefinitions.map((target) => {
    const variants = products.filter((product) => product.targetKey === target.key);
    const latest = [...variants]
      .flatMap((product) => product.history.map((entry) => ({ product, entry })))
      .sort((a, b) => b.entry.captured_at.localeCompare(a.entry.captured_at))[0];

    const lowest = [...variants]
      .flatMap((product) => product.history.map((entry) => entry.price))
      .sort((a, b) => a - b)[0];

    return {
      ...target,
      variants,
      latest,
      lowest
    };
  });

  const chartPoints = buildChartPoints(products);
  const latestRecords = groupedByTarget
    .map((target) => target.latest)
    .filter(Boolean)
    .sort((a, b) => a.entry.price - b.entry.price);
  const overallLowest = latestRecords[0] ?? null;

  return (
    <div className="space-y-6 pb-10">
      <header className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Thread 1772722183-532409</Badge>
          <Badge variant="outline">Live Supabase</Badge>
          <Badge variant="outline">Models: 3</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{config.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{config.description}</p>
      </header>

      {historyError ? (
        <Card>
          <CardHeader>
            <CardTitle>读取 price_history 失败</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {historyError.message}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <CardDescription>当前最低价</CardDescription>
            <CardTitle className="text-lg">
              {overallLowest ? currencyFormatter.format(overallLowest.entry.price) : "-"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {overallLowest
              ? `${overallLowest.product.label} | ${overallLowest.product.platform}`
              : "暂无实时记录"}
          </CardContent>
        </Card>

        {groupedByTarget.map((target) => (
          <Card key={target.key}>
            <CardHeader className="pb-3">
              <CardDescription>{target.displayLabel}</CardDescription>
              <CardTitle className="text-lg">
                {target.latest ? currencyFormatter.format(target.latest.entry.price) : "-"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <div>历史最低: {typeof target.lowest === "number" ? currencyFormatter.format(target.lowest) : "-"}</div>
              <div>平台数: {target.variants.length}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>历史价格走势</CardTitle>
          <CardDescription>每条线代表一个型号，基于 `price_history` 实时渲染。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {targetDefinitions.map((target) => (
              <div className="flex items-center gap-2" key={target.key}>
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: target.color }}
                />
                {target.displayLabel}
              </div>
            ))}
          </div>
          <PriceChart points={chartPoints} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>产品与最近记录</CardTitle>
          <CardDescription>当前匹配到的产品主数据，以及每个产品最近一次价格记录。</CardDescription>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">没有匹配到这 3 个目标型号的产品数据。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2">型号</th>
                    <th className="px-2 py-2">平台</th>
                    <th className="px-2 py-2">地区</th>
                    <th className="px-2 py-2">最近价格</th>
                    <th className="px-2 py-2">最近时间</th>
                    <th className="px-2 py-2">链接</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const latest = [...product.history].sort((a, b) =>
                      b.captured_at.localeCompare(a.captured_at)
                    )[0];

                    return (
                      <tr className="border-b" key={product.id}>
                        <td className="px-2 py-2">{product.label}</td>
                        <td className="px-2 py-2">{product.platform}</td>
                        <td className="px-2 py-2">{product.region}</td>
                        <td className="px-2 py-2">
                          {latest ? currencyFormatter.format(latest.price) : "-"}
                        </td>
                        <td className="px-2 py-2">
                          {latest ? dateFormatter.format(new Date(latest.captured_at)) : "-"}
                        </td>
                        <td className="px-2 py-2">
                          <a
                            className="text-primary underline-offset-4 hover:underline"
                            href={product.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            打开
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
