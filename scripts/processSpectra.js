const SPECTRUM_CACHE_DB = "periodic-table-spectra";
const SPECTRUM_CACHE_VERSION = 1;
const SPECTRUM_CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const spectrumMemoryCache = new Map();
const spectrumRequests = new Map();

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];

        if (inQuotes) {
            if (character === '"' && text[index + 1] === '"') {
                field += '"';
                index++;
            } else if (character === '"') {
                inQuotes = false;
            } else {
                field += character;
            }
        } else if (character === '"' && field.length === 0) {
            inQuotes = true;
        } else if (character === ",") {
            row.push(field);
            field = "";
        } else if (character === "\n" || character === "\r") {
            row.push(field);
            if (row.some(value => value.trim() !== "")) {
                rows.push(row);
            }
            row = [];
            field = "";
            if (character === "\r" && text[index + 1] === "\n") {
                index++;
            }
        } else {
            field += character;
        }
    }

    row.push(field);
    if (row.some(value => value.trim() !== "")) {
        rows.push(row);
    }

    return rows;
}

function parseNistNumber(value) {
    const normalized = value.trim().replace(/^=\s*/, "").replace(/^"|"$/g, "");
    const match = normalized.match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    const number = match ? Number(match[0]) : NaN;
    return Number.isFinite(number) ? number : null;
}

function parseSpectrumData(rawText) {
    const rows = parseCsv(rawText);
    const headers = rows[0]?.map(value => value.trim().replace(/^\uFEFF/, "").toLowerCase());
    const wavelengthIndex = headers?.findIndex(header =>
        /^obs_wl_(?:air|vac)\(nm\)$/.test(header)
    );
    const intensityIndex = headers?.indexOf("intens");

    if (!Number.isInteger(wavelengthIndex) || !Number.isInteger(intensityIndex)) {
        throw new Error("NIST returned data in an unexpected format.");
    }

    return rows.slice(1).flatMap(columns => {
        const wavelength = parseNistNumber(columns[wavelengthIndex] ?? "");
        if (wavelength === null || wavelength < 380 || wavelength > 780) {
            return [];
        }

        return [{
            wavelength,
            intensity: parseNistNumber(columns[intensityIndex] ?? "")
        }];
    });
}

function buildSpectrumRequestUrl(symbol) {
    const url = new URL("https://pml.nist.gov/cgi-bin/ASD/lines1.pl");
    const parameters = {
        spectra: `${symbol} I`,
        output_type: "0",
        low_w: "380",
        upp_w: "780",
        unit: "1",
        submit: "Retrieve Data",
        de: "0",
        plot_out: "0",
        format: "2",
        line_out: "0",
        en_unit: "0",
        output: "0",
        page_size: "15",
        show_obs_wl: "1",
        unc_out: "1",
        order_out: "0",
        show_av: "2",
        tsb_value: "0",
        A_out: "0",
        intens_out: "on",
        allowed_out: "1",
        forbid_out: "1",
        conf_out: "on",
        term_out: "on",
        enrg_out: "on",
        J_out: "on"
    };

    for (const [name, value] of Object.entries(parameters)) {
        url.searchParams.set(name, value);
    }

    return url;
}

function openSpectrumCache() {
    return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            reject(new Error("IndexedDB is unavailable."));
            return;
        }

        const request = indexedDB.open(SPECTRUM_CACHE_DB, SPECTRUM_CACHE_VERSION);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains("spectra")) {
                request.result.createObjectStore("spectra", { keyPath: "key" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Unable to open spectrum cache."));
    });
}

async function readSpectrumCache(key) {
    const database = await openSpectrumCache();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction("spectra", "readonly");
        const request = transaction.objectStore("spectra").get(key);

        request.onsuccess = () => {
            const entry = request.result;
            const age = Date.now() - entry?.fetchedAt;
            resolve(
                entry?.spectrum &&
                    Number.isFinite(entry.fetchedAt) &&
                    age >= 0 &&
                    age < SPECTRUM_CACHE_MAX_AGE
                    ? entry
                    : null
            );
        };
        request.onerror = () => reject(request.error || new Error("Unable to read spectrum cache."));
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
            database.close();
            reject(transaction.error || new Error("Unable to read spectrum cache."));
        };
        transaction.onabort = () => {
            database.close();
            reject(transaction.error || new Error("Spectrum cache read was aborted."));
        };
    });
}

async function writeSpectrumCache(key, spectrum, fetchedAt) {
    const database = await openSpectrumCache();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction("spectra", "readwrite");
        transaction.objectStore("spectra").put({ key, spectrum, fetchedAt });

        transaction.oncomplete = () => {
            database.close();
            resolve();
        };
        transaction.onerror = () => {
            database.close();
            reject(transaction.error || new Error("Unable to write spectrum cache."));
        };
        transaction.onabort = () => {
            database.close();
            reject(transaction.error || new Error("Spectrum cache write was aborted."));
        };
    });
}

async function loadSpectrumData(element, signal) {
    const cacheKey = `v${SPECTRUM_CACHE_VERSION}:${element.symbol}`;

    if (spectrumMemoryCache.has(cacheKey)) {
        const entry = spectrumMemoryCache.get(cacheKey);
        const age = Date.now() - entry.fetchedAt;
        if (age >= 0 && age < SPECTRUM_CACHE_MAX_AGE) {
            return { spectrum: entry.spectrum, cached: true };
        }

        spectrumMemoryCache.delete(cacheKey);
    }

    if (spectrumRequests.has(cacheKey)) {
        return spectrumRequests.get(cacheKey);
    }

    const request = (async () => {
        try {
            const cachedEntry = await readSpectrumCache(cacheKey);
            if (cachedEntry !== null) {
                spectrumMemoryCache.set(cacheKey, cachedEntry);
                return { spectrum: cachedEntry.spectrum, cached: true };
            }
        } catch (error) {
            console.warn("Unable to read cached spectral data:", error);
        }

        const controller = new AbortController();
        const abortRequest = () => controller.abort();
        if (signal?.aborted) {
            controller.abort();
        } else {
            signal?.addEventListener("abort", abortRequest, { once: true });
        }

        const timeoutId = setTimeout(() => controller.abort(), 60000);
        let responseText;

        try {
            const response = await fetch(buildSpectrumRequestUrl(element.symbol), {
                signal: controller.signal
            });
            if (!response.ok) {
                throw new Error(`NIST request failed with HTTP ${response.status}.`);
            }
            responseText = await response.text();
        } finally {
            clearTimeout(timeoutId);
            signal?.removeEventListener("abort", abortRequest);
        }

        const spectrum = parseSpectrumData(responseText);
        const fetchedAt = Date.now();
        const cacheEntry = { spectrum, fetchedAt };
        spectrumMemoryCache.set(cacheKey, cacheEntry);

        try {
            await writeSpectrumCache(cacheKey, spectrum, fetchedAt);
        } catch (error) {
            console.warn("Unable to save spectral data to the local cache:", error);
        }

        return { spectrum, cached: false };
    })();

    spectrumRequests.set(cacheKey, request);
    signal?.addEventListener("abort", () => {
        if (spectrumRequests.get(cacheKey) === request) {
            spectrumRequests.delete(cacheKey);
        }
    }, { once: true });

    try {
        return await request;
    } finally {
        if (spectrumRequests.get(cacheKey) === request) {
            spectrumRequests.delete(cacheKey);
        }
    }
}

function wavelengthToColor(wavelength) {
    let r = 0;
    let g = 0;
    let b = 0;

    if (wavelength >= 380 && wavelength < 440) {
        r = -(wavelength - 440) / 60;
        b = 1;
    } else if (wavelength < 490) {
        g = (wavelength - 440) / 50;
        b = 1;
    } else if (wavelength < 510) {
        g = 1;
        b = -(wavelength - 510) / 20;
    } else if (wavelength < 580) {
        r = (wavelength - 510) / 70;
        g = 1;
    } else if (wavelength < 645) {
        r = 1;
        g = -(wavelength - 645) / 65;
    } else if (wavelength <= 780) {
        r = 1;
    }

    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

function generateSpectrumImage(canvas, spectrum) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#080b12";
    ctx.fillRect(0, 0, width, height);

    const plot = { left: 58, right: width - 18, top: 16, bottom: height - 38 };
    const plotWidth = plot.right - plot.left;
    const plotHeight = plot.bottom - plot.top;
    const minWavelength = 380;
    const maxWavelength = 780;
    const visibleLines = spectrum.filter(line =>
        Number.isFinite(line.intensity) && line.intensity > 0
    );

    if (visibleLines.length === 0) {
        ctx.fillStyle = "#9ca3af";
        ctx.font = "14px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No relative intensity data available.", width / 2, height / 2);
        return;
    }

    const logIntensities = visibleLines.map(line => Math.log10(line.intensity));
    let minLogIntensity = logIntensities.reduce((minimum, intensity) =>
        Math.min(minimum, intensity), Infinity);
    let maxLogIntensity = logIntensities.reduce((maximum, intensity) =>
        Math.max(maximum, intensity), -Infinity);
    if (minLogIntensity === maxLogIntensity) {
        minLogIntensity -= 1;
        maxLogIntensity += 1;
    }

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#9ca3af";
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    ctx.textAlign = "center";

    for (let index = 0; index <= 4; index++) {
        const wavelength = minWavelength + index * 100;
        const x = plot.left + (index / 4) * plotWidth;
        ctx.beginPath();
        ctx.moveTo(x, plot.top);
        ctx.lineTo(x, plot.bottom);
        ctx.stroke();
        ctx.fillText(String(wavelength), x, height - 20);
    }

    for (let index = 0; index <= 2; index++) {
        const logIntensity = minLogIntensity +
            (index / 2) * (maxLogIntensity - minLogIntensity);
        const y = plot.bottom - (index / 2) * plotHeight;
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(plot.right, y);
        ctx.stroke();
        ctx.textAlign = "right";
        ctx.fillText(logIntensity.toFixed(1), plot.left - 7, y + 4);
    }

    ctx.fillStyle = "#d1d5db";
    ctx.textAlign = "center";
    ctx.fillText("Wavelength (nm)", (plot.left + plot.right) / 2, height - 4);
    ctx.save();
    ctx.translate(13, (plot.top + plot.bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("log₁₀(relative intensity)", 0, 0);
    ctx.restore();

    for (const line of visibleLines) {
        const x = plot.left +
            ((line.wavelength - minWavelength) /
                (maxWavelength - minWavelength)) * plotWidth;
        const logIntensity = Math.log10(line.intensity);
        const normalized = (logIntensity - minLogIntensity) /
            (maxLogIntensity - minLogIntensity);
        const y = plot.bottom - Math.max(2, normalized * plotHeight);

        ctx.strokeStyle = wavelengthToColor(line.wavelength);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, plot.bottom);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
}

export {
    generateSpectrumImage,
    loadSpectrumData
};