/**
 * Базовый URL CMS (apps/cms) для серверных вызовов её REST-endpoint'ов
 * (в отличие от GraphQL-клиентов в graphql-client.ts / api.ts).
 *
 * Намеренно не заводим отдельную переменную окружения: и так уже есть
 * GRAPHQL_API_URL / NEXT_PUBLIC_GRAPHQL_API_URL, указывающие на
 * `<cms>/api/graphql` — просто отрезаем это окончание, чтобы получить
 * origin CMS. Так одна переменная, а не две, могут разъехаться.
 */

const GRAPHQL_SUFFIX_RE = /\/api\/graphql\/?$/

const graphqlEndpoint =
  process.env.GRAPHQL_API_URL ??
  process.env.NEXT_PUBLIC_GRAPHQL_API_URL ??
  "http://localhost:4000/api/graphql";

export const cmsBaseUrl = graphqlEndpoint.replace(GRAPHQL_SUFFIX_RE, "");

/** Полный URL endpoint'а формы обратной связи на CMS. */
export const contactMessageEndpointUrl = `${cmsBaseUrl}/api/contact-message`;
