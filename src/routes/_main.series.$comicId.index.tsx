import { getChapterList, getComicDetail } from "@/api/shinigami";
import { ChapterList } from "@/features/chapter/ChapterList";
import { ComicDetail } from "@/features/comic/ComicDetail";
import ComicDetailSkeleton from "@/features/comic/ComicDetailSkeleton";
import { ServerErrorPanel } from "@/common/components/ServerError";
import { ensureQueryDataSafe } from "@/common/utils/query";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { JsonLd } from "@/common/components/JsonLd";

type ChapterSearch = {
  page: number;
};

const SITE_URL = "https://komik-reader.my.id";

const comicDetailQuery = (comicId: string) =>
  queryOptions({
    queryKey: ["comic", comicId],
    queryFn: () => getComicDetail({ data: { comicId } }),
    staleTime: 1000 * 60 * 30,
  });

const chapterPageQuery = (comicId: string, page: number) =>
  queryOptions({
    queryKey: ["chapter-list", comicId, page],
    queryFn: () => getChapterList({ data: { comicId, page, pageSize: 24 } }),
    staleTime: 1000 * 60 * 10,
  });

export const Route = createFileRoute("/_main/series/$comicId/")({
  component: RouteComponent,
  validateSearch: (search: Record<string, string>): ChapterSearch => ({
    page: Math.max(1, Math.floor(Number(search.page) || 1)),
  }),
  loaderDeps: ({ search: { page } }) => ({
    page,
  }),
  loader: async ({ context, params, deps: { page } }) => {
    const [comicDetail, chapterResult] = await Promise.all([
      ensureQueryDataSafe(context.queryClient, comicDetailQuery(params.comicId)),
      ensureQueryDataSafe(
        context.queryClient,
        chapterPageQuery(params.comicId, page)
      ),
    ]);

    let chapterList = chapterResult;
    let effectivePage = page;

    const totalPages = chapterList?.data?.meta?.total_page || 1;
    if (chapterList && page > totalPages && totalPages >= 1) {
      effectivePage = totalPages;
      chapterList =
        (await ensureQueryDataSafe(
          context.queryClient,
          chapterPageQuery(params.comicId, effectivePage)
        )) ?? chapterList;
    }

    return {
      comicDetail,
      chapterList,
      effectivePage,
    };
  },
  pendingComponent: ComicDetailSkeleton,
  head: ({ loaderData, params }) => {
    const comic = loaderData?.comicDetail?.data?.data;
    if (!comic) {
      return {
        meta: [],
        links: [],
        title: "KOMIK READER",
      };
    }

    const title = `${comic.title} - Baca KOMIK Online | KOMIK READER`;
    const description =
      comic.description?.slice(0, 160) ||
      `Baca KOMIK ${comic.title} online gratis. Chapter terbaru, update setiap hari.`;
    const genres =
      comic.taxonomy?.Genre?.map((g: { name: string }) => g.name) ?? [];
    const keywords = [
      comic.title,
      comic.alternative_title,
      ...genres,
      "komik",
      "baca komik",
      "komik online",
    ]
      .filter(Boolean)
      .join(", ");

    return {
      meta: [
        { name: "description", content: description },
        { name: "keywords", content: keywords },
        { property: "og:title", content: `${comic.title} - KOMIK READER` },
        { property: "og:description", content: description },
        { property: "og:url", content: `${SITE_URL}/series/${params.comicId}` },
        ...(comic.cover_image_url
          ? [{ property: "og:image" as const, content: comic.cover_image_url }]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: `${comic.title} - KOMIK READER` },
        { name: "twitter:description", content: description },
        ...(comic.cover_image_url
          ? [{ name: "twitter:image" as const, content: comic.cover_image_url }]
          : []),
      ],
      links: [
        { rel: "canonical", href: `${SITE_URL}/series/${params.comicId}` },
      ],
      title,
    };
  },
});

function RouteComponent() {
  const {
    comicDetail: initialComic,
    chapterList: initialChapters,
    effectivePage,
  } = Route.useLoaderData();
  const { comicId } = Route.useParams();
  const { page } = Route.useSearch();

  const {
    data: comicDetail,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    ...comicDetailQuery(comicId),
    initialData: initialComic ?? undefined,
  });

  const { data: chapterList } = useQuery({
    ...chapterPageQuery(comicId, effectivePage ?? page),
    initialData: initialChapters ?? undefined,
  });

  const comic = comicDetail?.data?.data;

  if (isLoading) {
    return <ComicDetailSkeleton />;
  }

  if (isError || !comic) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <ServerErrorPanel error={error} reset={() => void refetch()} />
      </main>
    );
  }

  const activePage = effectivePage ?? page;

  const genres = comic.taxonomy?.Genre?.map((g) => g.name) ?? [];
  const authors = comic.taxonomy?.Author?.map((a) => a.name) ?? [];
  const artists = comic.taxonomy?.Artist?.map((a) => a.name) ?? [];

  return (
    <main>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ComicSeries",
          inLanguage: "id-ID",
          publisher: {
            "@type": "Organization",
            name: "KOMIK READER",
            url: SITE_URL,
          },
          name: comic.title,
          alternateName: comic.alternative_title || undefined,
          description: comic.description?.slice(0, 500),
          image: comic.cover_image_url,
          ...(genres.length > 0 && { genre: genres }),
          ...(authors.length > 0 && {
            author: authors.map((a) => ({ "@type": "Person", name: a })),
          }),
          ...(artists.length > 0 && {
            illustrator: artists.map((a) => ({ "@type": "Person", name: a })),
          }),
          datePublished: comic.release_year || undefined,
          url: `${SITE_URL}/series/${comicId}`,
          ...(comic.user_rate > 0 && {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: comic.user_rate,
              bestRating: 5,
              ratingCount: comic.view_count || 0,
            },
          }),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              item: { "@id": SITE_URL, name: "Beranda" },
            },
            {
              "@type": "ListItem",
              position: 2,
              item: {
                "@id": `${SITE_URL}/series/${comicId}`,
                name: comic.title,
              },
            },
          ],
        }}
      />
      <ComicDetail comic={comic} />
      <ChapterList
        comicId={comicId}
        meta={chapterList?.data?.meta}
        page={activePage}
        chapters={chapterList?.data?.data ?? []}
        latestChapterNumber={comic.latest_chapter_number}
      />
    </main>
  );
}
