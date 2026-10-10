You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

## Product sources

Use this section when adding a catalog, or when a catalog's JSON API or HTML page changed and products or metadata come back empty or wrong. Types live in `src/app.d.ts` as `ProductsData` and `Metadata`. Each source returns `Promise<ProductsData>` from `getProducts` / `getNextProducts` (`src/lib/product_sources/types.d.ts`).

Search is GET `/?q=`. Each checked source then POSTs `/api/getNewProducts` with `{ sourceID, code, maxItems }`. Load-more POSTs `/api/getNextProducts` with the previous `meta`. The route passes `meta.page` (the page already loaded). `getNextProducts` must request `page + 1`. Returning `undefined` makes that route respond 500. Codes match `/^[\w.\-/]{3,32}$/`. `maxItems` is an integer from 1 to 1000. Test with query `1111`. MANN is the reliable JSON control.

When you add or update a source, map every `Product` property in `src/app.d.ts` that the response can support. When you finish, report the origin, the queries, and the first products of page 1 and of page 2, as in **Report when finished**. The user reviews those products and will request changes when a mapping is wrong.

### Choose a transport

Prefer a JSON, GraphQL, or XHR body. Use HTML only when the rows exist only in a document.

1. In the catalog's own search page, find the request that returns the cross-reference rows. Prefer `application/json` or a GraphQL payload.
2. Call `getJsonToProducts` when `response.data` is the object that contains the rows. The source passes `rowsIterator(responseData)`, and optionally `nPages(responseData)`, `totalItems(responseData)`, and `pagination` (a number or `(responseData) => pageSize`).
3. Call `getHtmlToProducts` when the rows are HTML. linkedom parses the body. The source passes `tableRows(document)` and `rowsIterator(rows)`, and optionally `nPages(document)`, `totalItems(document, page, nProducts, nPages)`, and a numeric `pagination` argument (the page size the catalog already knows). That argument becomes `meta.maxItemsPagination`.
4. If the HTTP body is JSON and the rows are an HTML string inside it, still use `getHtmlToProducts` and set `documentToHtml`. Filtration Group does this with `response.template`.
5. Build `ProductsData` by hand only when the shared axios client is not enough (Baldwin's cookie jar and retries) or a remote service already returns `ProductsData` (Fleetguard, Argo-Hytos, Ikron).
6. `scrapingType` on the source card is the UI label: `'JSON API'` or `'HTML parser'`. Filtration Group is `'HTML parser'` because the rows are parsed from HTML. Baldwin is `'JSON API'` and does not call the JSON helper.

Both helpers live in `src/lib/product_sources/getJsonToProductsData.server.ts` and `getHtmlToProductsData.server.ts`. They use the shared axios client (`src/lib/product_sources/axios.server.ts`, `cache: 'no-store'`). Spread `headers` from `src/lib/product_sources/constants.ts` and add the catalog's own headers. A thrown error goes through `failSourceRequest` (`src/lib/product_sources/sourceError.server.ts`): the real error is logged and the client receives HTTP 500 `'Source request failed'`. Some sources catch that and return a 500 `ProductsData` instead.

On HTTP status 400 or above, both helpers skip parsing and return `{ meta: { status, currentItemsDisplayed: 0, page: 0 }, products: [] }`. Fix the request before changing selectors when the status is 400 or above.

### Metadata

The helpers write `meta` after a successful parse:

- `status` — axios status.
- `currentItemsDisplayed` — `products.length` for this response. `mergeNextPage` in `src/lib/queryCache.svelte.ts` adds this across pages.
- `page` — the page argument. The JSON helper uses `page ?? 1`. The HTML helper defaults the parameter to `1`. Error payloads use `0`.
- `totalItems` — the source's `totalItems` function, or omitted. Use a number when the catalog states an exact count. Use a string such as `"36+"` when only a lower bound is known. `/api/getNextProducts` skips the numeric "already past the total" check when `totalItems` is a string.
- `pages` — the source's `nPages` function, or omitted. Load-more stops when the loaded `page` is greater than or equal to `pages`.
- `maxItemsPagination` — JSON: the `pagination` number or function. HTML: the `pagination` argument. Omit it when the catalog has a single response.
- `performanceTimings.proxyToSource` — milliseconds around `axios.request`, set when the route passes `showPerfReqProxyToSource: true`. Both product routes do. Hand-built sources should set the same field when they time the upstream call.

`performanceTimings.clientToProxy` is on the type and nothing assigns it. Leave it unset.

`/api/getNextProducts` reads `meta.page`, `meta.pages`, `meta.totalItems`, and `meta.currentItemsDisplayed`. A wrong `pages` or `totalItems` stops load-more early or lets it run forever. `asProductsData` accepts a payload when `meta` is an object, `products` is an array, and `meta.status` and `meta.page` are numbers.

Required `Metadata`: `status`, `currentItemsDisplayed`, `page`. Optional: `totalItems?: number | string`, `maxItemsPagination?: number`, `pages?: number`, `performanceTimings?: { proxyToSource?: number; clientToProxy?: number }`.

Required `ProductsData`: `meta`, `products`.

### Product

`rowsIterator` (or the hand-built loop, or the remote service) creates every `Product`. The helpers do not rename fields. The table copies `manufacturer_code` to Manufacturer Code, `source_reference_code` to Cross Code, and `manufacturer` to Manufacturer Name, plus `detailsUrl`, `thumbnails`, and `cachedAt`. Description, category, dimensions, specs, and packaging are stored on `Product` and in the cache. The table does not render them yet. Map them anyway.

On every source you add or update, read one live response and `ResponseSchema.d.ts`, then set every `Product` property that response can fill. The per-source "unmapped" notes below are the current gaps. Fill a gap when the value's meaning is clear. Omit a property only when the source has no value for it, and list those omitted keys in the finish report. Do not invent a number or a label. Leave a single unlabeled dimension string unparsed. Leave `cachedAt` unset. `stampProducts` adds it when the browser cache stores the page.

Required: `manufacturer`, `manufacturer_code` (the searched part as that catalog prints it), `source_reference_code` (that catalog's equivalent).

Optional: `detailsUrl`, `description`, `longDescription`, `category`, `thumbnails?: string[]`, `cachedAt`.

Optional groups:

- `dimensions`: `externalDiameter`, `internalDiameter`, `height` (each optional, numbers).
- `specs`: `mediaType`, `efficiency` (filtration grade), `flowDirection`.
- `packaging`: include it only when `width`, `length`, and `height` are all numbers.

Run every details URL and thumbnail through `catalogHttpsUrl(value, base)` in `src/lib/safeCatalogUrl.ts`. Add a new https host suffix to `ALLOWED_HOST_SUFFIXES` before using it. CSP `img-src` is derived from that list. Relative URLs need the catalog origin as `base`.

### Add or repair a source

Files: `src/lib/product_sources/<sourceID>/index.ts` (`descriptors` and `getters`), `getData.server.ts`, logo or banner, and `ResponseSchema.d.ts` for a JSON body. Register both exports in `src/lib/product_sources/index.ts`. `sourceID` must match the `sourcesGetters` key. `isLoggedIn: undefined` means public. A boolean means the card shows `SrcSessionForm`. FBN uses `false` until login. The session cookie name ends in `SessionToken`. `src/hooks.server.ts` copies it into `locals.srcSessions`, and the product routes pass `opts.sessionToken`.

When a source that used to work returns no rows:

1. Read that folder's `getData.server.ts` and `ResponseSchema.d.ts`.
2. Replay the same method, URL, params, and headers with code `1111`.
3. Status 400 or above: the helper never calls `rowsIterator`. Fix headers, cookies, or body.
4. Status 200 with empty products or a thrown read of `undefined`: the JSON path or CSS selector moved. Save one response, update `ResponseSchema.d.ts`, then update `rowsIterator` or `tableRows`. Keep the three required strings, and set every other `Product` property the new body can fill.
5. Rows look right but load-more is wrong: fix `totalItems`, `pages`, and `maxItemsPagination` using the per-source notes below.
6. Details links or thumbnails disappear while the codes are present: `catalogHttpsUrl` rejected the host. Add the suffix.

Parker `api-key` and Baldwin `ocpApimSubscriptionKey` are public vendor keys already in those `getData.server.ts` files. Leave them unless the user asks to change them.

### Report when finished

End every source add or update with this report. The user reviews the products and will request changes when a field is wrong. Paste the `Product` objects. Do not replace them with a summary.

- **Origin.** The upstream catalog origin the source called (scheme and host, plus the request URL). When the check went through this app, also the app origin, for example `http://127.0.0.1:5174`.
- **Queries.** Every product code you sent. Include `1111` when that catalog returns rows for it.
- **Page 1.** `meta.status`, `meta.page`, `meta.pages`, `meta.totalItems`, and `meta.currentItemsDisplayed`, then the first 8 `Product` objects. If the page has fewer than 8, include all of them.
- **Page 2.** When `getNextProducts` returns a second page (`pages` greater than 1, or a second response with `products.length` greater than 0), the same meta fields and the first 8 `Product` objects of that page. When the source has no second page, say so.
- **Omitted properties.** The `Product` keys you left unset because this source has no value for them.

Call `getProducts` for page 1 and `getNextProducts` for page 2 (it requests `page + 1`). A browser check against `/api/getNewProducts` and `/api/getNextProducts` is the same contract.

### JSON sources (`getJsonToProducts`)

**mann** — `GET https://www.mann-filter.com/api/graphql/catalog-prod`. Variables `search`, `currentPage`, `pageSize: min(maxItems, 100)`. Rows: `data.catalogSearch.crossReference.items`. Product: `manufacturer`, `externalProductName` → `manufacturer_code`, `product.name` → `source_reference_code`, `detailsUrl` from `product.urlKey` on `www.mann-filter.com`. Meta: `pages = ceil(totalCount / pageSize)`, `maxItemsPagination = pageSize`, `totalItems = totalCount`. Next page: `page + 1`. Also in the payload and currently unmapped: `product.attributes`, `customTables` where `code` is `dimension_table`. A thrown error is caught in `getProducts` and returned as status 500, `totalItems: 0`, `page: 0`.

**donaldson** — `GET https://shop.donaldson.com/store/en-it/search` with `Accept: application/json`. Page size `min(maxItems, 20)`. `No` is the offset `pageSize * (page - 1)`. The search term strips non-alphanumeric characters. Rows: `contents[0].MainContent[0].competitorProductDetailDTOList` (absent means no products). Product: `manufactureName`, `manufacturerPartNumber`, `donaldsonPartNumber`, `detailsUrl` from `pdpURL`, `thumbnails` from `thumbnailImage`, `description`, `category` from `productLine`. URLs go through `catalogHttpsUrl` on `shop.donaldson.com`. Meta: `pages = ceil(competitorPartsCount / customerPartsPerPage)`, `maxItemsPagination = customerPartsPerPage`, `totalItems = competitorPartsCount`. Next page: `page + 1`. Catch returns status 500 with `totalItems: 0`, `maxItemsPagination: 0`, `page: 0`.

**sf** — `GET https://www.sf-filter.com/api/cross-reference/product-search` with `limit = maxItems`, `offset: 0`, `query`. The `page` argument is stored on `meta.page` and is not sent upstream. Rows: `payload.data`. Product: `brand`, `originalNumber`, `item.link.title`, `detailsUrl` from `item.link.url`. Meta: `maxItemsPagination = maxItems` only. `payload.itemsTotal` is unused, so `totalItems` and `pages` stay unset. `getNextProducts` is `undefined`. Also unmapped: `item.image.defaultUrl` and `defaultUrlHiRes` (`sf-filter.com` is allowlisted).

**ufiam** — `POST https://shop.ufi-aftermarket.com/it/s/sfsites/aura` as `application/x-www-form-urlencoded`. Salesforce Aura action `B2B_CompetitorController.getCompetitorsTable` with `searchKey`, `nLimit: min(maxItems, 1000)`, `offset: (page - 1) * nLimit`. The `aura.context` `fwuid` is brittle and breaks when the shop redeploys. Rows: `actions[0].returnValue.returnValue.hits[i]._source`, skipped when missing. Product: `manufacturer`, `cross_code`, `filter`, with placeholder strings when a field is missing. Meta: `pages = ceil(total.value / nLimit)`, `totalItems = total.value`. `maxItemsPagination` stays unset. Next page: `page + 1`. Also unmapped: `description`, `application.en_EN` (a category label). Catch returns status 500, `totalItems: 0`, `page: 0`.

**parker** — `GET https://crossref.search.windows.net/indexes/partcrossreference-prod-search-view-index/docs` (`api-version=2019-05-06`, `$top = min(maxItems, 100)`, `$count=true`). Header `api-key` is the public vendor key. Rows: `value[]`, dropping rows whose `ToPartNumber` matches `/possible alternatives|no CRossover/i`. Product: `FromManufacturerName`, `FromPartNumber`, `ToPartNumber`. No `detailsUrl`. Meta: `totalItems = value.length` (the page length before that filter, so it can exceed `currentItemsDisplayed`). `pages` and `maxItemsPagination` stay unset. `getNextProducts` is `undefined`. Catch returns status 500, `totalItems: 0`, `page: 0`.

**hifi** — `POST https://catalog.hifi-filter.com/api/cross-reference/search` with query `q` and `p` (page) and body `[]`. Header `X-Api-Locale: en-GB`. Rows: `results`. Product: `brand.name`, `reference`, `products[0].reference` or `'No compatible HF reference'`, `detailsUrl` `https://catalog.hifi-filter.com/en-GB/product/<reference>/<id>`, `thumbnails` `https://data.hifi-filter.com/media/product/photo/md-<photo.id>` from `products[0].photos`. Meta: `pages = paging.lastPage`, `maxItemsPagination = paging.pageSize`, `totalItems = paging.totalFetched` (`paging.total` is a different count and is unused). Next page: `page + 1`. Also unmapped: `designation` (description), `family` (category), `attributes` (`DECIMAL` plus unit `mm` — map to `dimensions` only after a live sample shows which `code` is height or diameter), `drawings`.

**mahleam** — `POST https://webservice.tecalliance.services/pegasus-3-0/services/TecdocToCatDLB.jsonEndpoint` body `getArticles` (`provider: 22620`, `searchQuery`, `searchMatchType: prefix_or_suffix`, `searchType: 10`, `page`, `perPage: min(maxItems, 100)`). Rows: `articles`. Product: `mfrName`, `gtins[0]` or `'no code'` as `manufacturer_code` (this is a GTIN, not the OEM number), `articleNumber`. Meta: `pages = maxAllowedPage`, `maxItemsPagination = perPage`, `totalItems = totalMatchingArticles`. Next page: `page + 1`. Also unmapped: `oemNumbers`, `images[].imageURL800`, `articleText`, `genericArticles[].genericArticleDescription`, `articleCriteria` (unit `mm`). TecDoc image hosts are not allowlisted; add the real suffix before setting `thumbnails`. Catch returns status 500, `totalItems: 0`, `maxItemsPagination: 0`, `page: 0`.

**filtrec** — `GET https://cross-navigator.filtrec.com/api/cross-reference/search` with `code`, `page`, `locale=it`. `maxItems` is unused. Rows: `data`. Product: `manufacturer`, `code`, `productCode`, `detailsUrl` `https://cross-navigator.filtrec.com/product/<productCode with / replaced by ->/pdf`. Meta: `pages = meta.pageCount`, `maxItemsPagination = meta.numItemsPerPage`, `totalItems = meta.totalCount`. The helper sets `currentItemsDisplayed` from the array length. `meta.current` and `meta.currentItemCount` are unused. Next page: `page + 1`. Also unmapped on `data[].product`: `image.url`, `diameter1`, `diameter2`, `height1` → `dimensions`, `beta.media` / `beta.mediaEng` → `specs.mediaType`. Catch returns status 500, `totalItems: 0`, `maxItemsPagination: 0`, `page: 0`.

**hydac** — `GET https://www.hydac.com/en/e-tools/betterfit/betterfitSearch/` with `query`. One response. Rows: `relation`, capped at `maxItems`. Product: `competitor.manufacturer.title`, `competitor.title`, `hydac.title`, `thumbnails` from `hydac.image.src` via `catalogHttpsUrl`. Meta: status, `currentItemsDisplayed`, and `page: 1` only. `resultCount` is unused, so `totalItems`, `pages`, and `maxItemsPagination` stay unset. `getNextProducts` is `undefined`. Query `1111` can return zero rows. Also unmapped: `competitor.image`, `hydac.image.description`. Catch returns status 500, `totalItems: 0`, `maxItemsPagination: 0`, `page: 0`.

### HTML sources (`getHtmlToProducts`)

**wix** — `GET https://www2.wixfilters.com/Lookup/NewCompetitor.aspx` with `PartNo`. Rows: `#gvPL > tr:not(:first-child)`, capped at `maxItems`. Product: column 3 is `manufacturer`, `#lblCompetitor` is `manufacturer_code`, `#hlPartNumber` text is `source_reference_code`, `detailsUrl` is `PartDetails.aspx?Part=` from the href regex `/Part=([^']*)'/`. Meta: status, `currentItemsDisplayed`, `page: 1` only. `getNextProducts` is `undefined`.

**wixeu** — `GET https://wixeurope.com/en//find-a-filter` with params `filtronNumber`, `action=showFiltersByNumber`, `formType=1`. The `url` string also contains the characters `${codeEncoded}`, which JavaScript does not interpolate. Rows: `#secondTable .tr:not(.thead)`, capped at `maxItems`. Product: `.td` columns 2, 1, and 3. No `detailsUrl`. Meta: `totalItems` calls `document.querySelector('')`, so the value is `NaN`. `pages` and `maxItemsPagination` stay unset. `getNextProducts` is `undefined`. A 404 here often starts at that URL.

**hengst** — `GET https://catalog.hengst.com/en/online-catalog/search-results/ajax.api` (HTML, cookie `catalog=it`, `request[arguments][freetext]`, `request[arguments][page]`). Rows: `.result-table__table-mobile-row`. Product: mobile row item 1 is `manufacturer`, item 0 is `manufacturer_code`, `.result-table__linkbtn` text is `source_reference_code`, `detailsUrl` is that link's `href` via `catalogHttpsUrl`. Meta: `pages` is the text of `.result-table__pagination__paging` at index 2. `maxItemsPagination` is the argument `50`. `totalItems` is set only when `pages === 2`: page 1 returns `"<row count>+"`, a later page returns `50 * (page - 1) + row count`. One page, or three or more pages, leaves `totalItems` unset. Next page: `page + 1`. Hengst often answers 403. The outer catch calls `failSourceRequest`.

**faifiltri** — `GET https://www.faifiltri.it/elenco_risultati_cross.php` with `idlingua=318` and `codice_costruttore`. The request ignores `page`. Rows: `.table > tbody > tr`, capped at `maxItems`. Product: `th > div`, `:nth-child(2) > div`, `:nth-child(3) > div`. No `detailsUrl`. Host `faifiltri.it` is not allowlisted. Meta: `totalItems = parseInt(.my-auto > span)`, which is `NaN` when the node is missing. `pages` and `maxItemsPagination` stay unset. `getNextProducts` is `undefined`.

**filtrationgroup** — `GET https://shopindustrial.filtrationgroup.com/competitor/product/search` with `search_query` and `Accept: application/json`. `documentToHtml` returns `template` (`ResponseSchema`: `{ success, template }`). Rows: `.data.table > tbody > tr`, capped at `maxItems`. Product: column 3, column 1, `.fg_additional_product_info`, `thumbnails` from `img[src]` via `catalogHttpsUrl`. Meta: status, `currentItemsDisplayed`, `page: 1` only. `getNextProducts` is `undefined`.

**mpfiltriusa** — `POST https://www.mpfiltriusa.com/tools/interchange-filter-elements.html` as `application/x-www-form-urlencoded` with `OEMSEARCH=<code>*` and a hardcoded `mpfiltri` cookie. The request ignores `page`. Rows: `#myTable > tbody > tr`, capped at `maxItems`. Product: columns 2, 1, and 3. No `detailsUrl`. Host is not allowlisted. Meta: status, `currentItemsDisplayed`, `page` (the argument, usually 1). `getNextProducts` is `undefined`.

**stauff** — `GET https://www.filterinterchange.com/en/filter-interchange/results.html`. Offset is `maxItems * (page - 1)` in `--stauff_filtersuche-results[offset]`. `tableRows` selects cells, `.filterliste.desktop > tbody > td`, and each product is five cells. Product: cell 1 with the `Manufacturer:` prefix removed, the first line of cell 1 as `manufacturer_code`, cell 2 as `source_reference_code`. Meta: `totalItems` and the numerator of `pages` are `.numresults`; `pages = ceil(numresults / maxItems)`; `maxItemsPagination = maxItems` (the route caps `maxItems` at 1000). Next page: `page + 1`.

**ufihyd** — `GET https://crossreference.ufihyd.com/` with `s`. Rows: elements with class `codice`, capped at `maxItems`. Product: `.manufacturer-code span` is copied into both `manufacturer` and `manufacturer_code`, `.ufi-code a span` is `source_reference_code`, `detailsUrl` is the anchor `href` via `catalogHttpsUrl`. Meta: status, `currentItemsDisplayed`, `page: 1` only. `getNextProducts` is `undefined`.

**fbn** — Login required (`isLoggedIn: false`). Search is `GET https://www.fbn.it/Apps/WebObjects/FBN.woa/1/wa/CRAction/search` with `batchIndex` (page), `originale`, empty `marca` and `fbn`. Send cookie `wosid=<sessionToken>; woinst=1` and the PJAX headers in `getData.server.ts`. A missing or malformed token is HTTP 400. Call `https://www.fbn.it` directly. Login is a separate multipart POST and stores httpOnly cookie `fbnSessionToken`. Rows: `.table > tbody > tr` (about 9). Product: `td` columns 1, 2, and 3. No `detailsUrl`. Meta: `pages` is the last `[name=batchIndex] option` value. `maxItemsPagination` is `9`. `totalItems` is `"< (pages - 1) * 9 >+"` until the last page, then `pages * rowsOnThisPage` (a short last page undercounts). Next page: `page + 1`, forwarding `opts`.

### Sources that build `ProductsData` themselves

**baldwin** (`JSON API`, no helper) — `createAxios` plus `axios-cookiejar-support`. After a 600ms delay it GETs the cross-reference HTML to collect Akamai cookies, then POSTs `/content/baldwin-filters/us/en/cross-reference-result-page.data.json`. The JSON query uppercases the code and strips non-word characters. `ocpApimSubscriptionKey` is the public vendor key. Product: `manufacturer_s`, `partNumber_s`, `code_si`, `detailsUrl` on `ph.baldwinfilters.com` from `urlKeyword_si`, `thumbnails` on `www.parker.com` from `psURLKeyword_si` and `code_si`. Success meta: `status`, `currentItemsDisplayed`, `totalItems = doclist.numFound`, `page`. `pages`, `maxItemsPagination`, and `proxyToSource` stay unset (`config` is unused). Two retries with a 2s delay. After that, status 500, `totalItems: 0`, `maxItemsPagination: 0`, `page: 0`. `getNextProducts` is `undefined`. A 403 here is Akamai, not a bad parser.

**fleetguard** — `POST https://fden-express.vercel.app/api/fleetguard` with `{ code, maxItems }` and `cache: 'no-store'`. The JSON body is already `ProductsData`. `ResponseSchema.d.ts` describes the upstream Salesforce payload (`items`, `pageNumber`, `pageSize`, `totalRecords`, `imageUrl`, `longDescription`, `shortDescription`, `productFamilyName`), which this function does not read. A non-OK response or a throw returns status 500, `totalItems: 0`, `page: 0`. `getNextProducts` is `undefined`.

**argohytos** — `POST https://fden-express.vercel.app/api/argohytos` with `{ code, page }`. The JSON body is already `ProductsData`. `ResponseSchema.d.ts` describes the upstream rows (`description`, `dimension` as one string, `imagePath`, `referenceNumber`, `referenceName`). Leave `dimensions` unset unless that string splits into real numbers. Next page: `page + 1`. Failure matches Fleetguard's 500 payload.

**ikron** — `GET https://vercpupp-ff.vercel.app/api/ikron?code=`. The JSON body is cast to `ProductsData`. `maxItems`, `config`, and `page` are ignored. `ResponseSchema.d.ts` is the raw site object (`codice`, `concorrente`, `ikron`, `link`), which this function does not map. A throw calls `failSourceRequest`. `getNextProducts` is `undefined`.
