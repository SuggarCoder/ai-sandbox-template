import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerSupabase } from "@/lib/supabase/server";

type Platform = "Costco_US" | "Microcenter";

type DbRow = {
  id: string;
  model: string;
  platform: Platform;
  title: string;
  price: number;
  price_usd: number;
  currency: "USD" | "CAD";
  in_stock: boolean;
  url: string;
  scraped_at: string;
};

const platformLabel: Record<Platform, string> = {
  Costco_US: "Costco US",
  Microcenter: "Microcenter"
};

const priceFormatter = (value: number, currency: "USD" | "CAD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);

export const config = {
  title: "MacBook Pro 价格监控（实时数据）",
  description: "当前展示来自 Supabase 的真实抓取数据（平台：Costco US、Microcenter）。"
};

function getLatestByPlatform(rows: DbRow[]) {
  const latest = new Map<Platform, DbRow>();
  for (const row of rows) {
    if (!latest.has(row.platform)) {
      latest.set(row.platform, row);
    }
  }

  return [latest.get("Costco_US"), latest.get("Microcenter")].filter(Boolean) as DbRow[];
}

export default async function ThreadPage_1772722183_532409() {
  const supabase = getServerSupabase({ useServiceRole: true });

  const { data, error } = await supabase
    .from("price_records")
    .select("id,model,platform,title,price,price_usd,currency,in_stock,url,scraped_at")
    .in("platform", ["Costco_US", "Microcenter"])
    .order("scraped_at", { ascending: false })
    .limit(300);

  const rows = ((data ?? []) as DbRow[]).filter((row) => row.platform === "Costco_US" || row.platform === "Microcenter");
  const latestRows = getLatestByPlatform(rows);

  const lowest = latestRows.length
    ? [...latestRows].sort((a, b) => a.price_usd - b.price_usd)[0]
    : null;

  return (
    <div className="space-y-6 pb-10">
      <header className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Thread 1772722183-532409</Badge>
          <Badge variant="outline">Live Supabase</Badge>
          <Badge variant="outline">Platforms: 2</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{config.title}</h1>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </header>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>数据读取失败</CardTitle>
            <CardDescription>请检查 `NEXT_PUBLIC_SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`。</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{error.message}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>当前最低价（USD）</CardDescription>
            <CardTitle className="text-lg">{lowest ? priceFormatter(lowest.price_usd, "USD") : "-"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {lowest ? `${platformLabel[lowest.platform]} | ${lowest.model}` : "暂无数据"}
          </CardContent>
        </Card>

        {latestRows.map((row) => (
          <Card key={row.platform}>
            <CardHeader className="pb-3">
              <CardDescription>{platformLabel[row.platform]}</CardDescription>
              <CardTitle className="text-lg">{priceFormatter(row.price, row.currency)}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {row.in_stock ? "In Stock" : "Out of Stock"}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近抓取记录</CardTitle>
          <CardDescription>展示最新 20 条真实记录。</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无数据，等待下一次抓取任务写入。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2">时间</th>
                    <th className="px-2 py-2">平台</th>
                    <th className="px-2 py-2">型号</th>
                    <th className="px-2 py-2">价格</th>
                    <th className="px-2 py-2">状态</th>
                    <th className="px-2 py-2">链接</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row) => (
                    <tr className="border-b" key={row.id}>
                      <td className="px-2 py-2">{new Date(row.scraped_at).toLocaleString("zh-CN", { hour12: false })}</td>
                      <td className="px-2 py-2">{platformLabel[row.platform]}</td>
                      <td className="px-2 py-2">{row.model}</td>
                      <td className="px-2 py-2">{priceFormatter(row.price, row.currency)}</td>
                      <td className="px-2 py-2">{row.in_stock ? "In" : "Out"}</td>
                      <td className="px-2 py-2">
                        <a className="text-primary underline-offset-4 hover:underline" href={row.url} target="_blank" rel="noreferrer">
                          打开
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
