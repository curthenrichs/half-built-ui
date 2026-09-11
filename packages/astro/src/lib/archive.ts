import { slugifyCategory } from "./slug";

interface PostLike {
  data: { date: Date; categories: string[] };
}

export function groupByMonth(posts: PostLike[], locale = "en-US") {
  const map = new Map<string, number>();

  for (const p of posts) {
    const d = p.data.date;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, count]) => {
      const [year, month] = key.split("-");

      const label = new Date(
        Date.UTC(Number(year), Number(month) - 1),
      ).toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });

      return { year, month, label, count };
    });
}

export function countByCategory(posts: PostLike[]) {
  const map = new Map<string, number>();
  for (const p of posts)
    for (const c of p.data.categories) map.set(c, (map.get(c) ?? 0) + 1);
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, slug: slugifyCategory(name), count }));
}
