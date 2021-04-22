const ip_rx = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/;

function $(q) {
    return document.querySelector(q);
}

function setStatus(message) {
    $("#status").textContent = message;
}

let abort;
async function resetStatus(roku_ip) {
    if (abort) abort.abort();

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
            let resp = await fetch(`http://${roku_ip}:8060/`, { signal: abort.signal });
            if (resp.ok) {
                setStatus("Looks good!");
                return true;
            } else {
                setStatus(`Got error status ${resp.status} from ${roku_ip}`);
            }
        } catch (error) {
            if (error instanceof TypeError) setStatus(`Error when attempting to contact ${roku_ip}`);
        }
    }

    return false;
}

async function saveOptions(e) {
    e.preventDefault();
    const roku_ip = $("#roku_ip").value;

    let success = await browser.permissions.request({ origins: [`*://${roku_ip}/*`] });

    if (await resetStatus(roku_ip) && success) {
        await browser.storage.local.set({ roku_ip: roku_ip });
    }
}

async function restoreOptions() {
    const roku_ip = (await browser.storage.local.get("roku_ip")).roku_ip;
    $("#roku_ip").value = roku_ip || "";

    await resetStatus(roku_ip);
}

$("#roku_ip").addEventListener("invalid", (event) => {
    if (event.target.validity.patternMismatch) {
        setStatus("Please enter a valid IP address");
    } else if (event.target.validity.valueMissing) {
        setStatus("Please enter the IP address of your Roku");
    }
});

document.addEventListener("DOMContentLoaded", restoreOptions);
$("form").addEventListener("submit", saveOptions);