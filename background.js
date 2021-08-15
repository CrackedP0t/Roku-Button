const app_match_patterns = [
    "*://*.netflix.com/*",
    "*://*.amazon.com/Amazon-Video/*",
    "*://*.amazon.com/gp/video/detail/*",
    "*://*.pandora.com/*",
    "*://*.youtube.com/*",
    "*://*.funimation.com/*",
    "*://*.hulu.com/*",
    "*://*.crunchyroll.com/*",
    "*://*.plex.tv/*",
    "*://*.vudu.com/*",
    "*://*.hbomax.com/*",
    "*://*.vrv.co/*",
    "*://*.disneyplus.com/*",
    "*://*.twitch.tv/*",
    "*://*.peacocktv.com/*"
];

let tab_info = new Map();

function extract(url, tab_id) {
    if (tab_id) {
        let cached = tab_info.get(tab_id);
        if (cached) return cached;
    }

    for (let extractor of extractors) {
        const result = extractor.url_regexp.exec(url);
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

function get_title(url, tab_id) {
    const info = extract(url, tab_id);
    return `${info.content_id ? `Play this ${info.media_type ? info.media_type + " " : ""}on your Roku's ${info.name} app` : `Open ${info.name} on your Roku`}`;
}

function set_title(url, tab_id) {
    browser.pageAction.setTitle({
        tabId: tab_id,
        title: get_title(url, tab_id)
    });
}

async function open_on_roku(url, tab_id) {
    if (typeof (url) != "string") throw `URL is ${url}`;
    const roku_ip = (await browser.storage.local.get("roku_ip")).roku_ip;
    if (!await browser.permissions.contains({ origins: [`*://${roku_ip}/*`] })) {
        console.error(`We don't have permission for ${roku_ip}`);
        browser.runtime.openOptionsPage();
        return;
    }

    const info = extract(url, tab_id);

    let qs = [];
    if (info.content_id) qs.push(`contentId=${info.content_id}`);
    if (info.media_type) qs.push(`mediaType=${info.media_type}`);
    qs = qs.join("&");

    const roku_url = `http://${roku_ip}:8060/launch/${info.channel_id}${qs ? "?" + qs : ""}`;

    const response = await fetch(roku_url, fetch_init);
    // Sometimes when the Roku is off, it'll just open to the home screen instead of the app, and respond with 503.
    // However, now that it's on, we can send it again.
    if (response.status == 503) await fetch(roku_url, fetch_init);
}

async function redo_menus() {
    console.log("redo_menus");
    let options = await browser.storage.local.get(["context_menus", "bookmark_menus"]);
    browser.menus.removeAll();
    if (options.context_menus) {
        browser.menus.create({
            contexts: ["page_action"],
            id: "open_options",
            title: "Options"
        });
        let contexts = ["link"];
        if (options.bookmark_menus) contexts.push("bookmark");
        browser.menus.create({
            contexts,
            id: "app_link",
            title: "Open on your Roku",
            targetUrlPatterns: app_match_patterns
        });

        browser.menus.onClicked.addListener(async (info, tab) => {
            if (info.menuItemId == "open_options") {
                browser.runtime.openOptionsPage();
            } else if (info.menuItemId == "app_link") {
                if (info.linkUrl) {
                    open_on_roku(info.linkUrl);
                } else if (info.bookmarkId) {
                    let url = (await browser.bookmarks.get(info.bookmarkId))?.[0]?.url;
                    if (url) {
                        open_on_roku(url);
                    }
                }
            }
        });
    }
}

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "loading") {
        tab_info.delete(tabId);
        set_title(tab.url, tabId);
    } else if (changeInfo.status == "complete" && !extract(tab.url, tabId)) {
        browser.pageAction.hide(tabId);
    }
}, { properties: ["status"] });

browser.tabs.onRemoved.addListener((tabId) => tab_info.delete(tabId));

const amazon_url_rx = /.*?\/(\w+)\/?(?:\?.*|$)/i;
browser.webRequest.onBeforeRequest.addListener((details) => {
    tab_info.set(details.tabId, {
        name: "Prime Video",
        channel_id: 13,
        content_id: amazon_url_rx.exec(details.documentUrl)[1],
        media_type: "season"
    });
    set_title(details.documentUrl, details.tabId);
    browser.pageAction.show(details.tabId);
},
    { urls: ["*://js-assets.aiv-cdn.net/playback/web_player/WebLoader.js"] }
);

const utf8decoder = new TextDecoder();
const title_id_rx = /"asin":"(\w+)"/i;
browser.webRequest.onBeforeRequest.addListener((details) => {
    const raw = details.requestBody?.raw?.[0]?.bytes;
    if (raw) {
        const info = utf8decoder.decode(raw);
        if (info) {
            const title_id = title_id_rx.exec(info)?.[1];
            if (title_id) {
                tab_info.set(details.tabId, {
                    name: "Prime Video",
                    channel_id: 13,
                    content_id: amazon_url_rx.exec(details.documentUrl)[1],
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

const fetch_init = {
    headers: { "cache-control": "no-cache" },
    method: "POST",
};
browser.pageAction.onClicked.addListener((tab, on_click_data) => {
    open_on_roku(tab.url, tab.id);
});

browser.runtime.onInstalled.addListener(async (info, tab) => {
    const relevant = await browser.tabs.query({ url: app_match_patterns });
    for (const tab of relevant) {
        set_title(tab.url, tab.id);
    }
    redo_menus();
});

browser.runtime.onMessage.addListener(async (message) => {
    if (message == "redo_menus") redo_menus();
});