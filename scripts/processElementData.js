function normalizeElement(element) {
    function kelvinToCelsius(value) {
        return value == null ? null : value - 273.15;
    }

    const categoryMap = {
        "alkali metal": "alkali-metal",
        "alkaline earth metal": "alkaline-earth-metal",
        "transition metal": "transition-metal",
        "post-transition metal": "post-transition-metal",
        "metalloid": "metalloid",
        "diatomic nonmetal": "reactive-nonmetal",
        "polyatomic nonmetal": "reactive-nonmetal",
        "reactive nonmetal": "reactive-nonmetal",
        "halogen": "halogen",
        "noble gas": "noble-gas",
        "lanthanide": "lanthanide",
        "actinide": "actinide"
    };

    const halogens = [9, 17, 35, 53, 85];
    let category;

    switch (true) {
        case element.number === 1:
            category = "hydrogen";
            break;

        case halogens.includes(element.number):
            category = "halogen";
            break;

        case element.number >= 109:
            category = "unknown";
            break;

        default:
            category = categoryMap[element.category] ?? "unknown";
    }

    let series = null;
    let seriesPosition = null;

    if (element.number >= 57 && element.number <= 71) {
        series = "lanthanide";
        seriesPosition = element.number - 56;
    } else if (element.number >= 89 && element.number <= 103) {
        series = "actinide";
        seriesPosition = element.number - 88;
    }

    const radioactive =
        element.number === 43 ||
        element.number === 61 ||
        element.number >= 83;

    return {
        number: element.number,
        symbol: element.symbol,
        name: element.name,
        summary: element.summary ?? "",
        source: element.source ?? "",

        mass: element.atomic_mass,
        electronegativity: element.electronegativity_pauling ?? null,
        electronAffinity: element.electron_affinity ?? null,
        ionizationEnergies: element.ionization_energies ?? [],

        period: element.period,
        group: element.group ?? null,

        category,
        series,
        seriesPosition,
        radioactive,

        phase: element.phase ?? null,

        density: element.density_g_cm3 ??
            (element.density == null
                ? null
                : element.density_unit === "g/L"
                    ? element.density / 1000
                    : element.density),

        boiling: kelvinToCelsius(element.boil),
        melting: kelvinToCelsius(element.melt),
        sublimation: kelvinToCelsius(
            element.sublimation ??
            element.sublimate
        ),

        shells: element.shells ?? [],
        electronConfiguration: element.electron_configuration ?? "",
        electronConfigurationSemantic:
            element.electron_configuration_semantic ?? ""
    };
}

async function loadElements() {
    const [sourceResponse, overridesResponse] = await Promise.all([
        fetch("./data/elements/elements.json"),
        fetch("./data/elements/data.json")
    ]);

    if (!sourceResponse.ok) {
        throw new Error(`Unable to load source element data (HTTP ${sourceResponse.status}).`);
    }

    if (!overridesResponse.ok) {
        throw new Error(`Unable to load element overrides (HTTP ${overridesResponse.status}).`);
    }

    const [sourceData, overrideData] = await Promise.all([
        sourceResponse.json(),
        overridesResponse.json()
    ]);

    if (!Array.isArray(sourceData.elements)) {
        throw new Error("Source element data has no valid elements array.");
    }

    if (!Array.isArray(overrideData.elements)) {
        throw new Error("Element override data has no valid elements array.");
    }

    const sourceElements = sourceData.elements
        .filter(element => element.number >= 1 && element.number <= 118);
    const sourceByNumber = new Map(
        sourceElements.map(element => [element.number, element])
    );
    const sourceByName = new Map(
        sourceElements.map(element => [element.name.trim().toLowerCase(), element])
    );
    const overridesByNumber = new Map();

    for (const override of overrideData.elements) {
        if (!override || typeof override !== "object" || Array.isArray(override)) {
            throw new Error("Element override entries must be objects.");
        }

        const sourceElement = Number.isInteger(override.number)
            ? sourceByNumber.get(override.number)
            : typeof override.name === "string"
                ? sourceByName.get(override.name.trim().toLowerCase())
                : undefined;

        if (!sourceElement) {
            throw new Error(
                `Element override does not match a source element: ${override.name ?? override.number ?? "unknown"}.`
            );
        }

        if (overridesByNumber.has(sourceElement.number)) {
            throw new Error(`Multiple overrides found for element ${sourceElement.number}.`);
        }

        overridesByNumber.set(sourceElement.number, override);
    }

    return sourceElements
        .map(element => ({
            ...element,
            ...overridesByNumber.get(element.number)
        }))
        .map(normalizeElement);
}

const orbitalOrder = [
    { name: "1s", capacity: 2 },
    { name: "2s", capacity: 2 },
    { name: "2p", capacity: 6 },
    { name: "3s", capacity: 2 },
    { name: "3p", capacity: 6 },
    { name: "4s", capacity: 2 },
    { name: "3d", capacity: 10 },
    { name: "4p", capacity: 6 },
    { name: "5s", capacity: 2 },
    { name: "4d", capacity: 10 },
    { name: "5p", capacity: 6 },
    { name: "6s", capacity: 2 },
    { name: "4f", capacity: 14 },
    { name: "5d", capacity: 10 },
    { name: "6p", capacity: 6 },
    { name: "7s", capacity: 2 },
    { name: "5f", capacity: 14 },
    { name: "6d", capacity: 10 },
    { name: "7p", capacity: 6 }
];

function generateElectronConfiguration(atomicNumber) {
    atomicNumber = Number(atomicNumber);
    if (!Number.isInteger(atomicNumber) || atomicNumber < 1 || atomicNumber > 118) {
        throw new Error(`Invalid atomic number: ${atomicNumber}`);
    }

    let remainingElectrons = atomicNumber;
    const configuration = {};

    for (const orbital of orbitalOrder) {
        const electrons = Math.min(remainingElectrons, orbital.capacity);

        configuration[orbital.name] = electrons;
        remainingElectrons -= electrons;

        if (remainingElectrons === 0) break;
    }

    const exceptions = {
        24: { "4s": 1, "3d": 5 },
        29: { "4s": 1, "3d": 10 },

        41: { "5s": 1, "4d": 4 },
        42: { "5s": 1, "4d": 5 },
        44: { "5s": 1, "4d": 7 },
        45: { "5s": 1, "4d": 8 },
        46: { "5s": 0, "4d": 10 },
        47: { "5s": 1, "4d": 10 },

        57: { "4f": 0, "5d": 1 },
        58: { "4f": 1, "5d": 1 },
        64: { "4f": 7, "5d": 1 },

        78: { "6s": 1, "5d": 9 },
        79: { "6s": 1, "5d": 10 },

        89: { "5f": 0, "6d": 1 },
        90: { "5f": 0, "6d": 2 },
        91: { "5f": 2, "6d": 1 },
        92: { "5f": 3, "6d": 1 },
        93: { "5f": 4, "6d": 1 },
        96: { "5f": 7, "6d": 1 }
    };

    const correction = exceptions[atomicNumber];

    if (correction) {
        Object.assign(configuration, correction);
    }

    return orbitalOrder
        .filter(orbital => configuration[orbital.name] > 0)
        .map(orbital => `${orbital.name}${configuration[orbital.name]}`)
        .join(" ");
}

const nobleGases = [
    { number: 2, symbol: "He" },
    { number: 10, symbol: "Ne" },
    { number: 18, symbol: "Ar" },
    { number: 36, symbol: "Kr" },
    { number: 54, symbol: "Xe" },
    { number: 86, symbol: "Rn" }
];

function generateShorthandConfiguration(atomicNumber, fullConfiguration) {
    const core = [...nobleGases]
        .reverse()
        .find(element => element.number < atomicNumber);

    if (!core) return fullConfiguration;

    const coreConfiguration = generateElectronConfiguration(core.number);

    const fullOrbitals = fullConfiguration.match(/\d+[spdf]\d+/g) || [];
    const coreOrbitals = coreConfiguration.match(/\d+[spdf]\d+/g) || [];

    const matchesCore = coreOrbitals.every(
        (orbital, index) => fullOrbitals[index] === orbital
    );

    if (!matchesCore) return fullConfiguration;

    const remainingOrbitals = fullOrbitals.slice(coreOrbitals.length);

    return `[${core.symbol}] ${remainingOrbitals.join(" ")}`;
}

export {
    generateElectronConfiguration,
    generateShorthandConfiguration,
    loadElements
};