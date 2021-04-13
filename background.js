let tab_info = new Map();

function extract(url, id) {
    for (let extractor of extractors) {
        const result = extractor.url_regexp.exec(url);
        console.log(extractor.url_regexp, result);
        if (result) {
            let content_id, media_type;
            if (tab_info.has(id)) {
                [content_id, media_type] = tab_info.get(id);
            } else if (extractor.url_extractor) {
                [content_id, media_type] = extractor.url_extractor?.(result);
            }

            return {
                name: extractor.name,
                channel_id: extractor.channel_id,
                content_id: content_id,
                media_type: media_type
            }
        }
    }
}

function set_title(url, tabId) {
    const info = extract(url, tabId);
    if (info) {
        browser.pageAction.setTitle({
            tabId: tabId,
            title: `${info.content_id ? `Play this ${info.media_type ? info.media_type + " " : ""}on your Roku's ${info.name} app` : `Open ${info.name} on your Roku`}`
        });
    }
}

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "loading" && await browser.pageAction.isShown({ tabId: tabId })) {
        set_title(changeInfo.url, tabId);
        tab_info.delete(tabId);
    }
}, {
    properties: ["status"]
});

browser.tabs.onRemoved.addListener((tabId) => {
    tab_info.delete(tabId)
});

let utf8decoder = new TextDecoder();
browser.webRequest.onBeforeRequest.addListener(
    (details) => {
        const raw = details.requestBody?.raw?.[0]?.bytes;
        if (raw) {
            const info = utf8decoder.decode(raw);
            if (info) {
                const title_id = /"asin":"(\w+)"/.exec(info)?.[1];
                if (title_id) {
                    tab_info.set(details.tabId, [title_id, "episode"]);
                    set_title(details.documentUrl, details.tabId);
                }
            }
        }
    },
    {
        urls: ["*://fls-na.amazon.com/1/aiv-web-player/1/OE"]
    },
    ["requestBody"]
);

browser.pageAction.onClicked.addListener(async (tab, on_click_data) => {
    const info = extract(tab.url, tab.id);
    const roku_ip = browser.storage.local.get("roku_ip");

    if (!roku_ip) return;

    let qs = [];
    if (info.content_id) qs.push(`contentId=${info.content_id}`);
    if (info.media_type) qs.push(`mediaType=${info.media_type}`);
    qs = qs.join("&");

    const response = await fetch(`http://${roku_ip}:8060/launch/${info.channel_id}${qs ? "?" + qs : ""}`,
        {
            headers: {
                "cache-control": "no-cache"
            },
            method: "POST",
        }
    );
});