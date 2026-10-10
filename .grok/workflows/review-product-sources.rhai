let meta = #{
    name: "review-product-sources",
    description: "Review every catalog source, prefer JSON over HTML, and fill optional Product and Metadata fields",
    when_to_use: "Repair or enrich src/lib/product-sources. /review-product-sources. Optional args.sources (array of source ids), args.code (default 1111), args.max_items (default 20). The review panel is sized from the agent budget, leaving two calls for Apply and Check.",
    phases: [
        #{ title: "Review", detail: "one agent per catalog source" },
        #{ title: "Apply", detail: "host suffixes and AGENTS.md notes" },
        #{ title: "Check", detail: "working tree stays inside those sources" },
    ],
};

let source_schema = #{
    "type": "object",
    "required": ["source_id", "status", "changed", "report_md"],
    "properties": #{
        "source_id": #{ "type": "string" },
        "status": #{ "type": "string", "enum": ["working", "enriched", "repaired", "blocked", "failed"] },
        "changed": #{ "type": "boolean" },
        "transport_before": #{ "type": "string" },
        "transport_after": #{ "type": "string" },
        "changed_files": #{ "type": "array", "items": #{ "type": "string" } },
        "host_suffixes": #{ "type": "array", "items": #{ "type": "string" } },
        "agents_md_note": #{ "type": "string" },
        "summary": #{ "type": "string" },
        "report_md": #{ "type": "string" },
    },
};

let check_schema = #{
    "type": "object",
    "required": ["out_of_scope", "notes"],
    "properties": #{
        "out_of_scope": #{ "type": "array", "items": #{ "type": "string" } },
        "notes": #{ "type": "string" },
    },
};

fn trimmed(s) {
    if type_of(s) == "string" {
        s.trim();
        s
    } else {
        ""
    }
}

fn is_html_source(id) {
    let html_ids = [
        "faifiltri", "wix", "wixeu", "hengst", "filtrationgroup",
        "mpfiltriusa", "stauff", "ufihyd", "fbn"
    ];
    let found = false;
    for h in html_ids {
        if h == id { found = true; }
    }
    found
}

fn budget_remaining() {
    let limits = budget();
    if type_of(limits) == "map" && type_of(limits.remaining) == "i64" {
        limits.remaining
    } else {
        log("agent budget unread; defaulting the review panel to 128");
        128
    }
}

fn known_source(id, all_sources) {
    let found = false;
    for s in all_sources {
        if s == id { found = true; }
    }
    found
}

fn review_prompt(source_id, code, max_items) {
    let html = is_html_source(source_id);
    let p = "";
    p += "You are repairing one product source in the fden repo at /home/oskar/WORK/fden1. ";
    p += "Your source id is `" + source_id + "`. ";
    p += "Edit only files under src/lib/product-sources/" + source_id + "/. ";
    p += "Do not edit AGENTS.md, src/lib/product-sources/index.ts, src/lib/safe-catalog-url.ts, or any other source folder. ";
    p += "Do not commit, push, format the repo, start a dev server, or run git checkout, git reset, or git clean.\n\n";
    p += "Use read_file before you decide anything. Read these files first:\n";
    p += "- AGENTS.md from the heading `## Product sources` through the end of the file. Follow it. The per-source note for `" + source_id + "` is the current behavior.\n";
    p += "- src/app.d.ts interfaces ProductsData, Metadata, and Product.\n";
    p += "- src/lib/product-sources/" + source_id + "/get-data.server.ts and index.ts.\n";
    p += "- src/lib/product-sources/" + source_id + "/response-schema.d.ts when that file exists.\n";
    p += "- src/lib/safe-catalog-url.ts (ALLOWED_HOST_SUFFIXES) and the helpers get-json-to-products-data.server.ts and get-html-to-products-data.server.ts.\n\n";
    p += "Test code: `" + code + "`. maxItems: " + max_items.to_string() + ".\n\n";
    p += "Live-check the current request with run_terminal_command (curl or the existing client). ";
    p += "Replay the same method, URL, params, and headers the source uses. ";
    p += "On HTTP status 400 or above, fix the request before changing selectors. ";
    p += "A zero-row body for `" + code + "` is a failure only when this catalog should return rows for that code. ";
    p += "Read the AGENTS.md note first. Hydac, for example, can return zero rows for 1111. ";
    p += "If 1111 is empty and the note does not say that is expected, find one real code on the catalog and test that too. List every code you sent.\n\n";
    if html {
        p += "This source is documented as HTML scraping. ";
        p += "Before you keep HTML, use open_page and web_search on the catalog's own search page and find the request that returns the cross-reference rows. ";
        p += "Prefer application/json or a GraphQL payload. ";
        p += "Switch to getJsonToProducts only when a live JSON, GraphQL, or XHR body returns the rows for your test code. ";
        p += "Keep getHtmlToProducts only when those rows exist only in a document. ";
        p += "A JSON envelope whose rows are an HTML string still uses getHtmlToProducts with documentToHtml, as Filtration Group does.\n\n";
    } else {
        p += "This source is documented as JSON, GraphQL, XHR, or a hand-built client. ";
        p += "Keep that transport while it returns rows. ";
        p += "Do not replace it with HTML. ";
        p += "A different JSON endpoint is allowed when the live body fills Product or Metadata fields the current body does not.\n\n";
    }
    p += "Whether the source already works or not, map every Product property the live response can support. ";
    p += "Required: manufacturer, manufacturer_code (the searched part as that catalog prints it), source_reference_code (that catalog's equivalent). ";
    p += "Optional: detailsUrl, description, longDescription, category, thumbnails. ";
    p += "dimensions: externalDiameter, internalDiameter, height (numbers), threadSize (string), gasketExternalDiameter, gasketInternalDiameter (numbers). ";
    p += "specs: mediaType, efficiency, flowDirection. ";
    p += "packaging only when width, length, and height are all numbers. ";
    p += "Leave cachedAt unset. Leave performanceTimings.clientToProxy unset. ";
    p += "Do not invent a number or a label. Leave a single unlabeled dimension string unparsed. ";
    p += "Omit a property only when the source has no value for it.\n\n";
    p += "Fill optional Metadata when the catalog states it: totalItems (number when exact, string such as \"36+\" when only a lower bound is known), pages, maxItemsPagination, and performanceTimings.proxyToSource when you time the upstream call. ";
    p += "A wrong pages or totalItems stops load-more early or lets it run forever. ";
    p += "Do not rewrite a working quirk unless the live response shows the current meta is wrong.\n\n";
    p += "Cheap extra JSON, GraphQL, or XHR fetches are allowed when they fill fields the search row lacks, the way argohytos, fleetguard, and ikron already do (search, then a details call). ";
    p += "Skip the extra call when one response already has the field. ";
    p += "A cookie jar via axios-cookiejar-support, as Baldwin does, is allowed only when the catalog refuses the shared axios client without cookies. ";
    p += "Do not add a cookie jar to a source that already returns rows. ";
    p += "Parker api-key and Baldwin ocpApimSubscriptionKey stay as they are.\n\n";
    p += "Run details URLs and thumbnails through catalogHttpsUrl. ";
    p += "Do not edit the allowlist yourself. ";
    p += "If a host is missing, add its https suffix (registrable host, for example `example.com`) to host_suffixes and still call catalogHttpsUrl. ";
    p += "The Apply phase adds suffixes after every source agent finishes, so a thumbnail may still be dropped in this run. Paste the URL you would have kept.\n\n";
    p += "Update response-schema.d.ts when the JSON shape you parse changes. Keep scrapingType accurate (`JSON API` or `HTML parser`). ";
    p += "getNextProducts must request page + 1. Returning undefined makes /api/get-next-products respond 500. ";
    p += "Leave getNextProducts undefined only when the catalog has a single response, and then say there is no second page.\n\n";
    p += "Call getProducts for page 1 and getNextProducts for page 2. ";
    p += "Do not start vite. Port 5173 is often a different app. Port 5174 is often fden. ";
    p += "If a server is already listening, confirm it is this repo before you POST. ";
    p += "POST /api/get-new-products with { sourceID, code, maxItems } and /api/get-next-products with the previous meta. ";
    p += "If no fden server is up, replay the edited request and build the Product objects from that live body, and say the app origin was not used. ";
    p += "If a JSON experiment returns worse rows than the code you started from, put that previous behavior back by editing. Do not revert unrelated dirty files.\n\n";
    p += "FBN needs a real session token. Do not invent credentials. ";
    p += "With no token, set status to blocked. Implement a public JSON alternative only after a live call returns rows without a login.\n\n";
    p += "Set status to working when you made no code change because the source already returns rows and already maps every field the body supports. ";
    p += "enriched when it worked and you filled fields or metadata. ";
    p += "repaired when it was broken, or when you replaced HTML with a verified JSON body. ";
    p += "blocked when you cannot test it. failed when it is still broken after your attempt. ";
    p += "changed is true only when you edited files under this source.\n\n";
    p += "report_md is markdown the user will review. Paste Product objects. Do not summarize them. Use these sections:\n";
    p += "- Origin. Upstream scheme, host, and request URL. If the check went through this app, also the app origin.\n";
    p += "- Queries. Every product code you sent.\n";
    p += "- Page 1. meta.status, meta.page, meta.pages, meta.totalItems, meta.currentItemsDisplayed, then the first 8 Product objects as JSON. If the page has fewer than 8, include all of them.\n";
    p += "- Page 2. The same meta fields and the first 8 Product objects when a second page exists. Otherwise say there is no second page.\n";
    p += "- Omitted properties. The Product keys left unset because this source has no value for them.\n\n";
    p += "If changed is true, agents_md_note is one AGENTS.md bullet in the existing style, starting with `**" + source_id + "**`, covering the request, the row path, the Product mapping, meta, the next page, and any fields that are still unmapped. ";
    p += "If changed is false, agents_md_note is an empty string. ";
    p += "summary is one sentence. source_id must be exactly `" + source_id + "`.\n";
    p
}

// Registered getters in src/lib/product-sources/index.ts. Shared helpers are not sources.
let all_sources = [
    "filtrec", "ufihyd", "ufiam", "hifi", "faifiltri", "wix", "wixeu", "parker",
    "hydac", "fleetguard", "donaldson", "mann", "sf", "baldwin", "ikron", "stauff",
    "mpfiltriusa", "filtrationgroup", "mahleam", "hengst", "fbn", "argohytos"
];

if args != () && type_of(args) != "map" {
    pause("verification", "args must be an object. Optional fields: sources (array of source ids), code (default 1111), max_items (default 20).");
}

let code = "1111";
let max_items = 20;
if args != () && args.code != () && type_of(args.code) == "string" {
    let next_code = trimmed(args.code);
    if next_code != "" { code = next_code; }
}
if args != () && args.max_items != () && type_of(args.max_items) == "i64" && args.max_items >= 1 && args.max_items <= 1000 {
    max_items = args.max_items;
}

let picked = [];
if args != () && args.sources != () {
    if type_of(args.sources) != "array" {
        pause("verification", "args.sources must be an array of source ids.");
    }
    for id in args.sources {
        if type_of(id) == "string" && known_source(id, all_sources) {
            picked.push(id);
        } else {
            log("dropped unknown source " + json_encode(id));
        }
    }
    if picked.len() == 0 {
        pause("verification", "args.sources contained no known source ids.");
    }
} else {
    for s in all_sources { picked.push(s); }
}

// A parallel panel is admitted all at once. Leave two calls for Apply and Check.
let room = budget_remaining();
let reserve = 2;
if room <= reserve { reserve = 0; }
let review_n = room - reserve;
if review_n > picked.len() { review_n = picked.len(); }
if review_n < 1 {
    pause("verification", "Agent budget has no room for a source review. Resume this run with a higher agent_budget.");
}
let review_ids = [];
let skipped = [];
let seen = 0;
for source_id in picked {
    if seen < review_n {
        review_ids.push(source_id);
    } else {
        skipped.push(source_id);
    }
    seen += 1;
}

log("Reviewing " + review_ids.len().to_string() + " of " + picked.len().to_string() + " sources with code " + code + " and maxItems " + max_items.to_string());
if skipped.len() > 0 {
    let skipped_list = "";
    let first_skip = true;
    for name in skipped {
        if !first_skip { skipped_list += ", "; }
        skipped_list += name;
        first_skip = false;
    }
    log("Not reviewed in this run: " + skipped_list);
}

phase("Review");
let jobs = [];
for source_id in review_ids {
    jobs.push(#{
        prompt: review_prompt(source_id, code, max_items),
        label: "source:" + source_id,
        capability_mode: "execute",
        output_schema: source_schema,
    });
}
let results = parallel(jobs);

let kept = [];
let missing = [];
let i = 0;
for r in results {
    let expected = review_ids[i];
    let accepted = false;
    if r != () && r.success && type_of(r.output) == "map" {
        if r.output.source_id == expected && type_of(r.output.report_md) == "string" {
            kept.push(r.output);
            accepted = true;
        }
    }
    if !accepted {
        missing.push(expected);
        log("no usable report for " + expected);
    }
    i += 1;
}

phase("Apply");
let compact = [];
for rep in kept {
    let suffixes = [];
    if type_of(rep.host_suffixes) == "array" {
        for sfx in rep.host_suffixes {
            if type_of(sfx) == "string" && sfx != "" { suffixes.push(sfx); }
        }
    }
    let note = "";
    if rep.changed == true && type_of(rep.agents_md_note) == "string" { note = rep.agents_md_note; }
    if suffixes.len() > 0 || note != "" {
        compact.push(#{
            source_id: rep.source_id,
            host_suffixes: suffixes,
            agents_md_note: note,
        });
    }
}

let apply_note = "no shared-file updates";
if compact.len() > 0 {
    let apply_prompt = "";
    apply_prompt += "You are updating two shared files in /home/oskar/WORK/fden1 after a product-source review. ";
    apply_prompt += "Edit only src/lib/safe-catalog-url.ts and AGENTS.md. Do not commit, format the repo, or edit source folders.\n\n";
    apply_prompt += "Read src/lib/safe-catalog-url.ts. For each host_suffixes entry below, append a missing https host suffix to ALLOWED_HOST_SUFFIXES. ";
    apply_prompt += "A suffix is a host such as `example.com`, not a URL and not a path. Skip a suffix that is already covered. ";
    apply_prompt += "CSP img-src is derived from that list, so add only hosts whose images or detail pages the sources actually requested.\n\n";
    apply_prompt += "Read AGENTS.md. For each non-empty agents_md_note, replace only the existing bullet whose bold label is that source id. ";
    apply_prompt += "Keep the Svelte MCP section and every other source bullet. ";
    apply_prompt += "If you cannot find the bullet, append the note under the matching JSON, HTML, or hand-built section and say so.\n\n";
    apply_prompt += "Proposed updates as JSON:\n";
    apply_prompt += json_encode(compact);
    apply_prompt += "\n\nWhen you finish, reply with one short paragraph listing the suffixes you added and the source bullets you replaced.";
    let applied = agent(apply_prompt, #{
        label: "apply-shared",
        capability_mode: "read-write",
        phase: "Apply",
    });
    if applied != () && applied.success && type_of(applied.output) == "string" {
        apply_note = applied.output;
    } else {
        apply_note = "shared-file update failed";
        log(apply_note);
    }
} else {
    log(apply_note);
}

phase("Check");
let check_prompt = "";
check_prompt += "Read-only scope check in /home/oskar/WORK/fden1. Use run_terminal_command for `git status --short` and `git diff --name-only`. Do not edit files.\n";
check_prompt += "Allowed dirty paths are AGENTS.md, src/lib/safe-catalog-url.ts, and files under these directories:\n";
for source_id in review_ids {
    check_prompt += "- src/lib/product-sources/" + source_id + "/\n";
}
check_prompt += "\nPut every other dirty path in out_of_scope. ";
check_prompt += "notes is one sentence. An empty out_of_scope array is valid when every dirty path is allowed, including a clean tree.";
let scope = ();
if budget_remaining() >= 1 {
    scope = agent(check_prompt, #{
        label: "scope-check",
        capability_mode: "execute",
        output_schema: check_schema,
        phase: "Check",
    });
} else {
    log("no budget left for the scope check");
}

let out_of_scope = [];
let scope_notes = "scope check missing";
if scope != () && scope.success && type_of(scope.output) == "map" {
    if type_of(scope.output.out_of_scope) == "array" {
        for path in scope.output.out_of_scope {
            if type_of(path) == "string" && path != "" { out_of_scope.push(path); }
        }
    }
    if type_of(scope.output.notes) == "string" && scope.output.notes != "" {
        scope_notes = scope.output.notes;
    }
}
if out_of_scope.len() > 0 {
    log("out of scope files: " + out_of_scope.len().to_string());
}

let changed_n = 0;
for rep in kept {
    if rep.changed == true { changed_n += 1; }
}

let report = "# Product source review\n\n";
report += "Code: `" + code + "`. maxItems: " + max_items.to_string() + ".\n\n";
report += "Reports: " + kept.len().to_string() + "/" + review_ids.len().to_string() + " reviewed (" + picked.len().to_string() + " selected). Changed: " + changed_n.to_string() + ".\n\n";
if skipped.len() > 0 {
    report += "Not reviewed (agent budget): ";
    let first_skip = true;
    for name in skipped {
        if !first_skip { report += ", "; }
        report += name;
        first_skip = false;
    }
    report += ".\n\n";
}
if missing.len() > 0 {
    report += "Missing reports: ";
    let first = true;
    for name in missing {
        if !first { report += ", "; }
        report += name;
        first = false;
    }
    report += ".\n\n";
}
report += "## Shared files\n\n" + apply_note + "\n\n";
report += "## Scope\n\n" + scope_notes + "\n\n";
if out_of_scope.len() > 0 {
    for path in out_of_scope {
        report += "- `" + path + "`\n";
    }
    report += "\n";
}
for rep in kept {
    report += "## " + rep.source_id + "\n\n";
    let status = trimmed(rep.status);
    if status == "" { status = "unknown"; }
    report += "Status: " + status + ".";
    if rep.changed == true { report += " Files were edited."; }
    report += "\n\n";
    let summary = trimmed(rep.summary);
    if summary != "" { report += summary + "\n\n"; }
    let body = trimmed(rep.report_md);
    if body != "" { report += body + "\n\n"; }
}

let summary = kept.len().to_string() + "/" + review_ids.len().to_string() + " sources reported, " + changed_n.to_string() + " changed";
if skipped.len() > 0 {
    summary += ", " + skipped.len().to_string() + " not reviewed";
}
if missing.len() > 0 {
    summary += ", " + missing.len().to_string() + " missing";
}
log(summary);
let report_path = write_scratch_file("report.md", report);
complete(#{
    path: report_path,
    summary: summary,
    report: report,
});
