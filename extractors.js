function url_rxn(base, optional) {
    optional = optional || "";
    return new RegExp(`^https?://(?:\\w+\\.)?${base}(?:${optional})?`, "i");
}

function url_rx(base, optional) {
    return url_rxn(base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), optional);
}

function extractor(media_type) {
    return (result) => [result[1], media_type]
}

const extractors = [
    {
        channel_id: 12,
        name: "Netflix",
        url_regexp: url_rx("netflix.com", "/(title|watch)/(\\d+)"),
        url_extractor: (result) => {
            const media_type = result[1] == "title" ? "season" : "episode";
            return [result[2], media_type];
        }
    },
    {
        channel_id: 13,
        name: "Prime Video",
        url_regexp: url_rxn("amazon\\.com/(?:Amazon-Video|gp/video/detail/(\\w+))"),
        url_extractor: extractor("season"),
    },
    {
        channel_id: 28,
        name: "Pandora",
        url_regexp: url_rx("pandora.com", "/station/play/(\\d+)"),
        url_extractor: extractor("live")
    },
    {
        channel_id: 837,
        name: "YouTube",
        url_regexp: url_rx("youtube.com", "/watch\\?v=([\\w-]+)"),
        url_extractor: extractor("episode")
    },
    {
        channel_id: 2285, name: "Hulu", url_regexp: url_rx("hulu.com"),
    },
    {
        channel_id: 2595, name: "Crunchyroll", url_regexp: url_rx("crunchyroll.com"),
    },
    {
        channel_id: 13535, name: "Plex", url_regexp: url_rx("plex.tv"),
    },
    {
        channel_id: 13842,
        name: "VUDU",
        url_regexp: url_rx("vudu.com", "/.+/(\\d+)"),
        url_extractor: extractor("movie")
    },
    {
        channel_id: 143105, name: "VRV", url_regexp: url_rx("vrv.co")
    },
    {
        channel_id: 291097, name: "Disney Plus", url_regexp: url_rx("disneyplus.com"),
    },
    {
        channel_id: 591927, name: "Twoku", url_regexp: url_rx("twitch.tv")
    },
    {
        channel_id: 593099,
        name: "Peacock",
        url_regexp: url_rx("peacocktv.com", "/watch/playback/vod/\\w+/([\\w-]+)"),
        url_extractor: extractor("episode")
    }
];