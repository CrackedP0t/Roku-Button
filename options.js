const ip_rx = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/;
const timeout = 3000;

function $(q) {
    return document.querySelector(q);
}

function setStatus(message) {
    $("#status").textContent = message;
}

let abort;
async function resetStatus(roku_ip) {
    if (abort) abort.abort();

    let status = false;
    $("#status").style.outlineColor = "orange";

    if (!roku_ip) {
        setStatus("This extension needs your Roku's IP address");
    } else if (!ip_rx.test(roku_ip)) {
        setStatus("That's not a valid IP address");
    } else if (!await browser.permissions.contains({ origins: [`*://${roku_ip}/*`] })) {
        setStatus(`Please grant permission to access ${roku_ip}`);
    } else {
        setStatus("Testing connection...");
        try {
            abort = new AbortController();
            const id = setTimeout(() => abort.abort(), timeout);
            let resp = await fetch(`http://${roku_ip}:8060/`, { signal: abort.signal });
            clearTimeout(id);
            if (resp.ok) {
                setStatus("Looks good!");
                status = true;
            } else {
                setStatus(`Got error status ${resp.status} from ${roku_ip}`);
            }
        } catch (error) {
            if (error instanceof TypeError) setStatus(`Error when attempting to contact ${roku_ip}`);
            else if (error instanceof DOMException && error.name === "AbortError") setStatus(`Timed out when attempting to contact ${roku_ip}`);
            else setStatus(`Unknown error: ${error}`);
        }
    }

    if (status) {
        $("#status").style.outlineColor = "green";
    } else {
        $("#status").style.outlineColor = "red";
    }

    return status;
}

async function saveOptions(e) {
    e.preventDefault();
    const roku_ip = $("#roku_ip").value;
    const context_menus = $("#context_menus").checked;
    const bookmark_menus = $("#bookmark_menus").checked;

    let perms = { origins: [`*://${roku_ip}/*`], permissions: [] };

    let success = await browser.permissions.request(perms);
    let status = await resetStatus(roku_ip);

    let storage = {context_menus, bookmark_menus};
    if (success && status) storage.roku_ip = roku_ip;
    await browser.storage.local.set(storage);
    browser.runtime.sendMessage("redo_menus");
}

async function restoreOptions() {
    const options = await browser.storage.local.get(["roku_ip", "context_menus", "bookmark_menus"]);
    $("#roku_ip").value = options.roku_ip || "";
    $("#context_menus").checked = options.context_menus || false;
    $("#bookmark_menus").checked = options.bookmark_menus || false;

    await resetStatus(options.roku_ip);
}

$("#roku_ip").addEventListener("invalid", (event) => {
    if (event.target.validity.patternMismatch) {
        setStatus("Please enter a valid IP address");
        $("#status").style.outlineColor = "red";
    } else if (event.target.validity.valueMissing) {
        setStatus("Please enter the IP address of your Roku");
        $("#status").style.outlineColor = "red";
    }
});

document.addEventListener("DOMContentLoaded", restoreOptions);
$("form").addEventListener("submit", saveOptions);