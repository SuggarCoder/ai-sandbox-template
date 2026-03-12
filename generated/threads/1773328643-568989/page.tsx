import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type HNStoryItem = {
  id: number;
  by?: string;
  descendants?: number;
  deleted?: boolean;
  dead?: boolean;
  score?: number;
  time?: number;
  title?: string;
  type?: string;
  url?: string;
};

type StoryLabel = "高赞低评" | "低赞高评" | "双高" | "均衡";

type RankedStory = {
  author: string;
  comments: number;
  discussionRatio: number;
  discussionUrl: string;
  domain: string;
  engagementScore: number;
  id: number;
  label: StoryLabel;
  publishedAt: string;
  score: number;
  title: string;
  url: string;
};

type WeeklyDataset = {
  cutoffDate: string;
  fetchedCount: number;
  scannedCount: number;
  stories: RankedStory[];
};

type SyncResult = {
  error?: string;
  syncedCount: number;
  tableName: string;
};

export const config = {
  title: "Hack News Weekly Top 30",
  description:
    "基于 Hacker News 当前 topstories 前 500 条，筛过去 7 天并按 score 主导、comments 辅助排序，再同步到 Supabase 的 HNtop30。"
};

const HN_TABLE_NAME = "HNtop30";
const TOP_STORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json";
const MAX_SOURCE_IDS = 500;
const MAX_WEEKLY_STORIES = 30;
const WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const scoreFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function formatNumber(value: number) {
  return scoreFormatter.format(value);
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function getDiscussionUrl(id: number) {
  return `https://news.ycombinator.com/item?id=${id}`;
}

function getStoryUrl(item: HNStoryItem) {
  return item.url ?? getDiscussionUrl(item.id);
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "news.ycombinator.com";
  }
}

function calculateEngagement(score: number, comments: number) {
  return score * 3 + comments;
}

function classifyStory(score: number, comments: number): StoryLabel {
  if (score >= 140 && comments >= 50) {
    return "双高";
  }

  const safeComments = Math.max(comments, 1);
  const ratio = score / safeComments;

  if (ratio > 3) {
    return "高赞低评";
  }

  if (ratio < 1.5 && comments >= 15) {
    return "低赞高评";
  }

  return "均衡";
}

function getLabelClassName(label: StoryLabel) {
  switch (label) {
    case "双高":
      return "border-orange-300 bg-orange-100 text-orange-900";
    case "高赞低评":
      return "border-emerald-300 bg-emerald-100 text-emerald-900";
    case "低赞高评":
      return "border-sky-300 bg-sky-100 text-sky-900";
    default:
      return "border-zinc-300 bg-zinc-100 text-zinc-900";
  }
}

function getLabelDescription(label: StoryLabel) {
  switch (label) {
    case "双高":
      return "顶级新闻，赞和讨论都高。";
    case "高赞低评":
      return "社区一致认可，争议较少。";
    case "低赞高评":
      return "讨论密度高，评论区价值更强。";
    default:
      return "认可度和讨论度比较平衡。";
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function getWeeklyTopStories(): Promise<WeeklyDataset> {
  const topIds = await fetchJson<number[]>(TOP_STORIES_URL);
  const sourceIds = topIds.slice(0, MAX_SOURCE_IDS);
  const cutoffMs = Date.now() - WEEK_WINDOW_MS;
  const cutoffSeconds = Math.floor(cutoffMs / 1000);

  const items = await Promise.all(
    sourceIds.map(async (id) => {
      try {
        return await fetchJson<HNStoryItem>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      } catch {
        return null;
      }
    })
  );

  const rankedStories = items
    .filter((item): item is HNStoryItem => Boolean(item))
    .filter((item) => item.type === "story" && !item.deleted && !item.dead)
    .filter((item) => Boolean(item.title) && typeof item.time === "number" && item.time >= cutoffSeconds)
    .map((item) => {
      const score = item.score ?? 0;
      const comments = item.descendants ?? 0;
      const url = getStoryUrl(item);

      return {
        author: item.by ?? "unknown",
        comments,
        discussionRatio: Number((score / Math.max(comments, 1)).toFixed(2)),
        discussionUrl: getDiscussionUrl(item.id),
        domain: getDomain(url),
        engagementScore: calculateEngagement(score, comments),
        id: item.id,
        label: classifyStory(score, comments),
        publishedAt: new Date(item.time! * 1000).toISOString(),
        score,
        title: item.title!,
        url
      } satisfies RankedStory;
    })
    .sort((left, right) => {
      if (left.engagementScore !== right.engagementScore) {
        return right.engagementScore - left.engagementScore;
      }

      if (left.score !== right.score) {
        return right.score - left.score;
      }

      if (left.comments !== right.comments) {
        return right.comments - left.comments;
      }

      return right.publishedAt.localeCompare(left.publishedAt);
    })
    .slice(0, MAX_WEEKLY_STORIES);

  return {
    cutoffDate: new Date(cutoffMs).toISOString(),
    fetchedCount: items.filter(Boolean).length,
    scannedCount: sourceIds.length,
    stories: rankedStories
  };
}

async function syncStoriesToSupabase(stories: RankedStory[], cutoffDate: string): Promise<SyncResult> {
  try {
    const supabase = getServerSupabase({ useServiceRole: true });
    const syncedAt = new Date().toISOString();

    const { error: deactivateError } = await supabase
      .from(HN_TABLE_NAME)
      .update({ is_current: false })
      .eq("is_current", true);

    if (deactivateError) {
      throw new Error(deactivateError.message);
    }

    const rows = stories.map((story) => ({
      story_id: story.id,
      url: story.url,
      title: story.title,
      score: story.score,
      descendants: story.comments,
      engagement_score: story.engagementScore,
      discussion_ratio: story.discussionRatio,
      value_label: story.label,
      author: story.author,
      domain: story.domain,
      story_time: story.publishedAt,
      window_start: cutoffDate,
      window_end: syncedAt,
      is_current: true,
      collected_at: syncedAt
    }));

    const { error: upsertError } = await supabase
      .from(HN_TABLE_NAME)
      .upsert(rows, { onConflict: "url" });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    return {
      syncedCount: rows.length,
      tableName: HN_TABLE_NAME
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown Supabase sync error",
      syncedCount: 0,
      tableName: HN_TABLE_NAME
    };
  }
}

function StoryMetric({
  label,
  value,
  detail
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-zinc-200/80 bg-white/85 backdrop-blur">
      <CardHeader className="pb-3">
        <CardDescription className="text-zinc-600">{label}</CardDescription>
        <CardTitle className="text-2xl text-zinc-950">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-zinc-600">{detail}</CardContent>
    </Card>
  );
}

export default async function ThreadPage_1773328643_568989() {
  let dataset: WeeklyDataset;

  try {
    dataset = await getWeeklyTopStories();
  } catch (error) {
    return (
      <div className="space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Thread 1773328643-568989</Badge>
            <Badge variant="outline">HN API</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{config.title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{config.description}</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Hacker News 抓取失败</CardTitle>
            <CardDescription>页面依赖实时读取 HN Firebase API。</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown fetch error"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const syncResult = await syncStoriesToSupabase(dataset.stories, dataset.cutoffDate);
  const highestScoreStory = [...dataset.stories].sort((left, right) => right.score - left.score)[0] ?? null;
  const mostDiscussedStory =
    [...dataset.stories].sort((left, right) => right.comments - left.comments)[0] ?? null;
  const featuredStories = dataset.stories.slice(0, 3);
  const remainingStories = dataset.stories.slice(3);
  const averageScore = dataset.stories.length
    ? Math.round(dataset.stories.reduce((sum, story) => sum + story.score, 0) / dataset.stories.length)
    : 0;

  return (
    <div className="space-y-6 pb-12">
      <section className="overflow-hidden rounded-[28px] border border-orange-200/70 bg-gradient-to-br from-orange-50 via-white to-amber-50 shadow-sm">
        <div className="space-y-5 px-6 py-8 md:px-8">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-orange-500 text-white hover:bg-orange-500">Thread 1773328643-568989</Badge>
            <Badge variant="outline" className="border-orange-300 bg-white/80 text-orange-900">
              Live HN Snapshot
            </Badge>
            <Badge variant="outline" className="border-orange-300 bg-white/80 text-orange-900">
              Supabase {syncResult.error ? "Sync Error" : "Synced"}
            </Badge>
          </div>

          <div className="space-y-3">
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-zinc-950 md:text-4xl">
              {config.title}
            </h1>
            <p className="max-w-4xl text-sm leading-6 text-zinc-700">{config.description}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <StoryMetric
              label="过去 7 天 Top 30"
              value={formatNumber(dataset.stories.length)}
              detail={`从当前 topstories 的前 ${formatNumber(dataset.scannedCount)} 条里筛出。`}
            />
            <StoryMetric
              label="抓取成功数"
              value={formatNumber(dataset.fetchedCount)}
              detail="并发拉取 item 详情，失败条目会自动跳过。"
            />
            <StoryMetric
              label="平均 Score"
              value={formatNumber(averageScore)}
              detail="排序以 score 为主，comments 为辅。"
            />
            <StoryMetric
              label="Supabase"
              value={syncResult.error ? "Failed" : formatNumber(syncResult.syncedCount)}
              detail={
                syncResult.error
                  ? syncResult.error
                  : `已写入表 ${syncResult.tableName}，按 url 去重 upsert。`
              }
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.3fr,0.7fr]">
        <Card className="border-orange-200/70">
          <CardHeader>
            <CardTitle>榜单解释</CardTitle>
            <CardDescription>
              这里不是 HN 历史归档，而是基于当前 `topstories` 前 500 条做 7 天窗口回看。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-zinc-700">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Window</p>
                <p className="mt-2 font-medium text-zinc-950">
                  {formatDate(dataset.cutoffDate)} {"->"} {formatDate(new Date().toISOString())}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Ranking</p>
                <p className="mt-2 font-medium text-zinc-950">engagement = score * 3 + comments</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Storage</p>
                <p className="mt-2 font-medium text-zinc-950">{HN_TABLE_NAME} on conflict `url`</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {(["双高", "高赞低评", "低赞高评", "均衡"] as StoryLabel[]).map((label) => (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4" key={label}>
                  <Badge className={getLabelClassName(label)} variant="outline">
                    {label}
                  </Badge>
                  <p className="mt-3 text-xs leading-5 text-zinc-600">{getLabelDescription(label)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle>快照摘要</CardTitle>
            <CardDescription>用来快速看这周 HN 最有穿透力的内容。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Top Story</p>
              {dataset.stories[0] ? (
                <a
                  className="mt-2 block font-medium text-zinc-950 underline-offset-4 hover:underline"
                  href={dataset.stories[0].url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {dataset.stories[0].title}
                </a>
              ) : (
                <p className="mt-2 text-zinc-600">No story found.</p>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Highest Score</p>
              {highestScoreStory ? (
                <div className="mt-2 space-y-1">
                  <a
                    className="block font-medium text-zinc-950 underline-offset-4 hover:underline"
                    href={highestScoreStory.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {highestScoreStory.title}
                  </a>
                  <p className="text-xs text-zinc-600">score {formatNumber(highestScoreStory.score)}</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Most Discussed</p>
              {mostDiscussedStory ? (
                <div className="mt-2 space-y-1">
                  <a
                    className="block font-medium text-zinc-950 underline-offset-4 hover:underline"
                    href={mostDiscussedStory.discussionUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {mostDiscussedStory.title}
                  </a>
                  <p className="text-xs text-zinc-600">
                    comments {formatNumber(mostDiscussedStory.comments)}
                  </p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {featuredStories.map((story, index) => (
          <Card
            className={index === 0 ? "border-orange-300 bg-orange-50/60" : "border-zinc-200"}
            key={story.id}
          >
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-4xl font-semibold tracking-tight text-zinc-300">#{index + 1}</div>
                <Badge className={getLabelClassName(story.label)} variant="outline">
                  {story.label}
                </Badge>
              </div>
              <div className="space-y-2">
                <CardTitle className="text-xl leading-7">
                  <a href={story.url} rel="noreferrer" target="_blank">
                    {story.title}
                  </a>
                </CardTitle>
                <CardDescription className="leading-6">
                  {story.domain} | by {story.author} | {formatDate(story.publishedAt)}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">score {formatNumber(story.score)}</Badge>
                <Badge variant="secondary">comments {formatNumber(story.comments)}</Badge>
                <Badge variant="secondary">heat {formatNumber(story.engagementScore)}</Badge>
                <Badge variant="outline">ratio {story.discussionRatio}</Badge>
              </div>
              <p className="text-zinc-600">{getLabelDescription(story.label)}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <a
                  className="font-medium text-zinc-950 underline-offset-4 hover:underline"
                  href={story.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open article
                </a>
                <a
                  className="text-zinc-600 underline-offset-4 hover:underline"
                  href={story.discussionUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open HN thread
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {remainingStories.length > 0 ? (
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle>Full Rank List</CardTitle>
            <CardDescription>#1-3 已在上方高亮，这里继续列出 #4-30。</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {remainingStories.map((story, index) => (
                <li
                  className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 md:flex-row md:items-start md:justify-between"
                  key={story.id}
                >
                  <div className="flex gap-4">
                    <div className="min-w-12 text-2xl font-semibold tracking-tight text-zinc-300">
                      #{index + 4}
                    </div>
                    <div className="space-y-2">
                      <a
                        className="block text-base font-medium leading-6 text-zinc-950 underline-offset-4 hover:underline"
                        href={story.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {story.title}
                      </a>
                      <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
                        <span>{story.domain}</span>
                        <span>by {story.author}</span>
                        <span>{formatDate(story.publishedAt)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={getLabelClassName(story.label)} variant="outline">
                          {story.label}
                        </Badge>
                        <Badge variant="secondary">score {formatNumber(story.score)}</Badge>
                        <Badge variant="secondary">comments {formatNumber(story.comments)}</Badge>
                        <Badge variant="outline">heat {formatNumber(story.engagementScore)}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-4 text-sm md:justify-end">
                    <a
                      className="font-medium text-zinc-950 underline-offset-4 hover:underline"
                      href={story.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Article
                    </a>
                    <a
                      className="text-zinc-600 underline-offset-4 hover:underline"
                      href={story.discussionUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      HN
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
