const launch_init = {
    headers: { "cache-control": "no-cache" },
    method: "POST",
};

function $(q) {
    return document.querySelector(q);
}

document.addEventListener("DOMContentLoaded", async () => {
    const roku_ip = (await browser.storage.local.get("roku_ip")).roku_ip;
    if (!await browser.permissions.contains({ origins: [`*://${roku_ip}/*`] })) {
        console.error(`We don't have permission for ${roku_ip}`);
        await browser.runtime.openOptionsPage();
        window.close();
        return;
    }

    const res = await fetch(`http://${roku_ip}:8060/query/apps`);

    const parser = new DOMParser();
    const doc = parser.parseFromString(await res.text(), "application/xml");

    const channel_list = $("#channels");

    for (const app of doc.documentElement.children) {
        if (app.getAttribute("type") == "appl") {
            const button = document.createElement("img");
            button.classList.add("channel");
            button.src = `http://${roku_ip}:8060/query/icon/${app.id}`;
            button.innerHTML = app.innerHTML;
            button.onclick = () => {
                fetch(`http://${roku_ip}:8060/launch/${app.id}`, launch_init);
            }
            channel_list.appendChild(button);
        }
    }

    for (const el of document.getElementsByClassName("control")) {
        const ds = el.dataset;
        const key = ds.key;
        if (key) {
            el.title = el.title || key.replace(/(\w)([A-Z])/, "$1 $2");
            if (ds.repeat) {
                let repeat_on = async (ev) => {
                    if (!ds.repeating && ev.buttons & 1) {
                        ds.repeating = true;
                        (async () => {
                            while (ds.repeating) {
                                await fetch(`http://${roku_ip}:8060/keypress/${key}`, launch_init);
                            }
                        })();
                    }
                };
                el.onmousedown = repeat_on;
                el.onmouseup = () => delete ds.repeating;
                el.onmouseenter = repeat_on;
                el.onmouseleave = () => delete ds.repeating;
            } else {
                el.onclick = () => fetch(`http://${roku_ip}:8060/keypress/${key}`, launch_init);
            }
        } else if (el.dataset.launch) {
            el.onclick = () => fetch(`http://${roku_ip}:8060/launch/${el.dataset.launch}`, launch_init);
        } else {
            el.disabled = true;
        }
    }
});