let tab_info = new Map();

function extract(url, id) {
    let cached = tab_info.get(id);
    if (cached) return cached;

    for (let extractor of extractors) {
        const result = extractor.url_regexp.exec(url);
        console.log(url, extractor, result);
        if (result) {
            let content_id, media_type;
            let pair = extractor.url_extractor?.(result);
            if (pair) [content_id, media_type] = pair;

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

const amazon_rx = new RegExp("^https?://(?:\\w+\\.)?amazon\\.com/.*?/(\w+)/?(?:\\?.*|$)", "i");
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    console.log(changeInfo.status, changeInfo, tab);
    if (changeInfo.status === "loading") {
        set_title(changeInfo.url, tabId);
        tab_info.delete(tabId);
    } else if (changeInfo.status == "complete" && !extract(tab.url, tabId)) {
        browser.pageAction.hide(tabId);
    }
}, {
    properties: ["status"]
});

browser.tabs.onRemoved.addListener((tabId) => {
    tab_info.delete(tabId)
});

browser.webRequest.onBeforeRequest.addListener((details) => {
    const id_rx = /.*?\/(\w+)\/?(?:\?.*|$)/i;
    tab_info.set(details.tabId, {
        name: "Prime Video",
        channel_id: 13,
        content_id: id_rx.exec(details.documentUrl)[1],
        media_type: "season"
    });
    set_title(details.documentUrl, details.tabId);
    browser.pageAction.show(details.tabId);
},
    { urls: ["*://js-assets.aiv-cdn.net/playback/web_player/WebLoader.js"] }
);

browser.webRequest.onBeforeRequest.addListener((details) => {
        const raw = details.requestBody?.raw?.[0]?.bytes;
        if (raw) {
        let utf8decoder = new TextDecoder();
            const info = utf8decoder.decode(raw);
            if (info) {
                const title_id = /"asin":"(\w+)"/.exec(info)?.[1];
                if (title_id) {
                tab_info.set(details.tabId, {
                    name: "Prime Video",
                    channel_id: 13,
                    content_id: rx.exec(details.documentUrl)[1],
                    media_type: "season"
                });
                    set_title(details.documentUrl, details.tabId);
                }
            }
        }
    },
    { urls: ["*://fls-na.amazon.com/1/aiv-web-player/1/OE"] },
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