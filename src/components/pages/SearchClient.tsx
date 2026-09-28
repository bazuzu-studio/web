"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, X, Inbox } from "lucide-react";
import { gqlClient } from "@/lib/graphql-client";
import { SearchContentDocument, GetContentDocument } from "@/generated/graphql";
import { EmptyState } from "@/components/ui/States";
import { ContentGrid } from "@/components/content/ContentGrid";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { mapSearchResultToItem, mapContentToItem, type RawContent } from "@/lib/content-mapper";

/**
 * Поиск через коллекцию search-results (плагин @payloadcms/plugin-search),
 * а не через фильтрацию всего каталога на клиенте (прошлая версия получала
 * ВЕСЬ список items пропом и фильтровала в памяти — не масштабируется).
 *
 * Debounce 400мс — не долбим сервер запросом на каждое нажатие клавиши.
 * Текущий запрос синхронизируется с URL (?q=...) через router.replace,
 * чтобы результаты поиска можно было передать по ссылке и работала
 * кнопка "назад" в браузере.
 *
 * TODO:
 * - На Postgres plugin-search не даёт полнотекстового ранжирования
 *   "из коробки" — это по сути contains-фильтр по денормализованной
 *   коллекции. Если понадобится релевантность/опечатки — потребуется
 *   отдельный tsvector + GIN-индекс поверх search-results.
 */
export function SearchClient({ initialQuery }: { initialQuery: string }) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebouncedValue(query, 400);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedQuery.trim()) {
      params.set("q", debouncedQuery);
    } else {
      params.delete("q");
    }
    // history.replaceState вместо router.replace: тот заново запрашивал
    // страницу у сервера на каждый ввод и мигал скелетоном загрузки.
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/search?${qs}` : "/search");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const trimmedQuery = debouncedQuery.trim();

const { data, isLoading, isFetching } = useQuery({
  queryKey: ["search-content", trimmedQuery],
  queryFn: () =>
    gqlClient.request(SearchContentDocument, {
      where: {
        OR: [
          { title: { contains: trimmedQuery } },
          { titleEn: { contains: trimmedQuery } },
        ],
      },
    }),
  enabled: trimmedQuery.length > 0,
  staleTime: 10_000,
});
  // SearchResults.docs — документы плагина поиска, а не Content: в них нет
  // ageRating, а id — это id поискового документа, не контента (с ним «в
  // избранное» из поиска сохраняло бы не тот id). Поэтому по slug'ам найденного
  // добираем полные записи из Content и отдаём их, сохраняя порядок поиска.
  const searchItems = useMemo(
    () => (data?.SearchResults?.docs ?? []).map(mapSearchResultToItem),
    [data]
  );
  const slugs = useMemo(
    () => searchItems.map((i) => i.slug).filter(Boolean),
    [searchItems]
  );
  const { data: full } = useQuery({
    queryKey: ["search-content-full", slugs],
    queryFn: () =>
      gqlClient.request(GetContentDocument, { limit: 50, where: { slug: { in: slugs } } }),
    enabled: slugs.length > 0,
    staleTime: 60_000,
  });
  const results = useMemo(() => {
    const bySlug = new Map(
      (full?.Contents?.docs ?? []).map((d) => {
        const item = mapContentToItem(d as RawContent);
        return [item.slug, item] as const;
      })
    );
    return searchItems.map((i) => bySlug.get(i.slug) ?? i);
  }, [searchItems, full]);
  const showLoading = isLoading || (isFetching && trimmedQuery !== query.trim());

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
      <h1 className="text-3xl font-black tracking-tight text-white mb-6">Поиск</h1>

      <div className="relative mb-8">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8E8E98]" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск фильмов и сериалов..."
          className="w-full bg-white/5 border border-white/8 rounded-2xl pl-12 pr-5 py-4 text-base text-white placeholder:text-[#8E8E98] outline-none focus:border-[#EF4A4F]/40 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-[#8E8E98] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {trimmedQuery ? (
        showLoading ? (
          <p className="text-sm text-[#8E8E98]">Ищем...</p>
        ) : (
          <>
            <p className="text-sm text-[#8E8E98] mb-5">
              По запросу <span className="text-white font-semibold">«{trimmedQuery}»</span> найдено:{" "}
              <span className="text-white font-semibold">{results.length}</span>
            </p>
            {results.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Ничего не найдено"
                subtitle="Попробуйте изменить запрос или параметры фильтрации"
              />
            ) : (
              <ContentGrid items={results} />
            )}
          </>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <SearchIcon className="w-12 h-12 text-[#6B6B75]" />
          <p className="text-[#8E8E98]">Введите название фильма или сериала</p>
        </div>
      )}
    </div>
  );
}