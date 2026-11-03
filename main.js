const RADIOACTIVE_MESSAGE = "This element has no stable isotopes; the mass of the isotope with the longest half-life is used";

const RADIOACTIVE_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true">
  <g fill="currentColor">
	  <path class="st0" d="M477.672,128C432.031,49,347.031,0.047,255.563,0.031c-44.688,0.016-88.797,11.844-127.625,34.266
	  	c-40.969,23.656-73.031,57.109-94.75,95.641C11.453,168.484,0,212.141,0,256.406c-0.031,43.391,11.031,87.422,34.25,127.609
	  	C79.891,463,164.859,511.953,256.344,511.969c44.703-0.016,88.781-11.844,127.609-34.266c29.516-17.031,54.922-39.391,75.141-65.75
	  	c20.188-26.359,35.219-56.719,44.047-89.719c5.906-22.078,8.859-44.516,8.859-66.797C512,211.078,500.344,167.281,477.672,128z
	  	 M469.219,313.141c-7.672,28.609-20.625,54.75-38.031,77.453c-17.375,22.688-39.234,41.938-64.797,56.703
	  	c-33.469,19.328-71.563,29.547-110.047,29.547c-78.875,0.031-152.438-42.375-191.688-110.391
	  	c-20.047-34.734-29.531-72.594-29.547-110.047c0-38.203,9.922-75.953,28.672-109.219s46.313-62.016,81.719-82.469
	  	c33.484-19.344,71.578-29.578,110.063-29.563C334.438,35.125,408,77.531,447.25,145.563
	  	c19.625,34.016,29.609,71.641,29.609,109.875C476.859,274.656,474.344,294.016,469.219,313.141z"/>
	  <path class="st0" d="M232.016,269.828c4.922,8.531,14.094,13.828,23.953,13.828c4.828,0,9.609-1.281,13.797-3.703
	  	c13.219-7.625,17.766-24.578,10.141-37.781c-4.938-8.531-14.109-13.828-23.984-13.828c-4.813,0-9.594,1.281-13.797,3.703
	  	C228.922,239.688,224.391,256.625,232.016,269.828z"/>
	  <path class="st0" d="M231.031,212.844L162.609,94.328C102.891,128.813,69.422,191.531,69.313,256h136.828
	  	C206.188,238.797,215.094,222.047,231.031,212.844z"/>
	  <path class="st0" d="M349.281,94.359l-68.422,118.5c7.453,4.313,13.813,10.531,18.25,18.219c4.438,7.703,6.703,16.25,6.656,24.922
	  	h136.828c0.063-31.766-7.969-63.922-24.969-93.344C400.656,133.234,376.797,110.188,349.281,94.359z"/>
	  <path class="st0" d="M280.859,299.156c-7.547,4.375-16.172,6.688-24.891,6.688c-8.875,0-17.469-2.391-24.922-6.703l-68.422,118.5
	  	c55.875,32.141,126.953,34.531,186.672,0.047l-68.406-118.531H280.859z"/>
  </g>
</svg>`;

function normalizeElement(element) {
    function kelvinToCelsius(value) {
        return value == null ? null : value - 273.15;
    }

    // Map the categories from the dataset to the category names used here
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

    const category = categoryMap[element.category] ?? "unknown";

    // f block
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

        mass: element.atomic_mass,

        period: element.period,
        group: element.group ?? null,

        category,
        series,
        seriesPosition,
        radioactive,

        phase: element.phase ?? null,

        // Use the g/cm^3 when possible
        density: element.density_g_cm3 ??
            (element.density == null
                ? null
                : element.density_unit === "g/L"
                    ? element.density / 1000
                    : element.density),

        boiling: kelvinToCelsius(element.boil),
        melting: kelvinToCelsius(element.melt),

        // Electron information
        shells: element.shells ?? [],
        electronConfiguration: element.electron_configuration ?? "",
        electronConfigurationSemantic:
            element.electron_configuration_semantic ?? ""
    };
}

async function loadElements() {
    try {
        const response = await fetch("./data/elements.json");

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        console.log("Loaded element data:", data.elements.filter(element => element.number >= 1 && element.number <= 118).map(normalizeElement));
        return data.elements
            .filter(element => element.number >= 1 && element.number <= 118)
            .map(normalizeElement);

    } catch (error) {
        console.error("Failed to load element data:", error);
        return [];
    }
}

class PeriodicTable {
    constructor(tableElement, elements = []) {
        this.tableElement = tableElement;
        this.elements = elements;

        this.categories = {
            "hydrogen": {
                name: "Hydrogen",
                color: "var(--hydrogen-border)"
            },
            "alkali-metal": {
                name: "Alkali Metal",
                color: "var(--alkali-border)"
            },
            "alkaline-earth-metal": {
                name: "Alkaline Earth Metal",
                color: "var(--alkaline-border)"
            },
            "transition-metal": {
                name: "Transition Metal",
                color: "var(--transition-border)"
            },
            "post-transition-metal": {
                name: "Post-Transition Metal",
                color: "var(--post-transition-border)"
            },
            "metalloid": {
                name: "Metalloid",
                color: "var(--metalloid-border)"
            },
            "reactive-nonmetal": {
                name: "Reactive Nonmetal",
                color: "var(--nonmetal-border)"
            },
            "halogen": {
                name: "Halogen",
                color: "var(--halogen-border)"
            },
            "noble-gas": {
                name: "Noble Gas",
                color: "var(--noble-border)"
            },
            "lanthanide": {
                name: "Lanthanide",
                color: "var(--lanthanide-border)"
            },
            "actinide": {
                name: "Actinide",
                color: "var(--actinide-border)"
            },
            "unknown": {
                name: "Unknown",
                color: "var(--unknown-border)"
            }
        };

        if (!this.tableElement) {
            throw new Error("A table container element is required.");
        }

        this.activeCategory = null;
        this.configurationFormat = "full";

        this.tableElement.addEventListener("click", event => {
            const legendItem = event.target.closest(".legend-item");
            if (legendItem && this.tableElement.contains(legendItem)) {
                this.filterByCategory(legendItem.dataset.category);
            }
        });

        this.cacheElements();
        this.refresh();
    }

    /* ===== Main table generation ===== */
    cacheElements() {
        this.legend = this.tableElement.querySelector(".legend");
        this.mainGrid = this.tableElement.querySelector(".main-grid");
        this.seriesSection = this.tableElement.querySelector(".series-section");
        this.detailsEmpty = this.tableElement.querySelector(".details-empty");
        this.detailsContent = this.tableElement.querySelector(".details-content");
        this.electronDiagram = this.tableElement.querySelector(".electron-diagram-svg");
        this.detailsSymbol = this.tableElement.querySelector(".details-symbol");
        this.detailsSymbolNumber = this.tableElement.querySelector(".details-symbol-number");
        this.detailsSymbolText = this.tableElement.querySelector(".details-symbol-text");
        this.detailsRadioactiveIcon = this.tableElement.querySelector(".details-symbol .element-radioactive-icon");
        this.detailsName = this.tableElement.querySelector(".details-name");
        this.detailsMass = this.tableElement.querySelector(".details-mass");
        this.radioactiveNote = this.tableElement.querySelector(".radioactive-note");
        this.detailsDensity = this.tableElement.querySelector(".details-density");
        this.detailsCategory = this.tableElement.querySelector(".details-category");
        this.detailsPeriodLabel = this.tableElement.querySelector(".details-period-label");
        this.detailsPeriod = this.tableElement.querySelector(".details-period");
        this.detailsGroupLabel = this.tableElement.querySelector(".details-group-label");
        this.detailsGroup = this.tableElement.querySelector(".details-group");
        this.detailsConfiguration = this.tableElement.querySelector(".details-configuration");
        this.detailsPhase = this.tableElement.querySelector(".details-phase");
        this.detailsBoiling = this.tableElement.querySelector(".details-boiling");
        this.detailsFreezing = this.tableElement.querySelector(".details-freezing");
        this.detailsSublimation = this.tableElement.querySelector(".details-sublimation");
        this.sublimationCard = this.tableElement.querySelector(".sublimation-card");
        this.boilingCard = this.tableElement.querySelector(".boiling-card");
        this.freezingCard = this.tableElement.querySelector(".freezing-card");
    }

    refresh() {
        this.selectedElement = null;

        this.detailsEmpty.hidden = false;
        this.detailsContent.hidden = true;

        this.renderElements();
        this.updateCategoryFilter();
    }

    /* ===== General DOM helper ===== */
    createElement(tag, className, text = "") {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== "") {
            element.textContent = text;
        }

        return element;
    }

    /* ===== Element cards ===== */
    createElementCard(element) {
        const card = this.createElement(
            "button",
            "element"
        );

        card.type = "button";
        card.dataset.category = element.category || "unknown";
        card.dataset.atomicNumber = element.number;

        card.style.gridColumn = element.group;
        card.style.gridRow = element.period;

        card.title = `${element.name} (${element.symbol})`;

        const number = this.createElement(
            "span",
            "element-number",
            element.number
        );

        const radioIcon = this.createElement(
            "span",
            "element-radioactive-icon"
        );
        if (element.radioactive) {
            radioIcon.innerHTML = RADIOACTIVE_ICON;
            radioIcon.setAttribute("aria-label", "Radioactive");
        }

        const symbol = this.createElement(
            "span",
            "element-symbol",
            element.symbol
        );

        const name = this.createElement(
            "span",
            "element-name"
        );
        const nameTrack = this.createElement(
            "span",
            "element-name-track"
        );
        const nameText = this.createElement("span", "", element.name);
        const repeatedName = this.createElement("span", "", element.name);
        repeatedName.setAttribute("aria-hidden", "true");
        nameTrack.append(nameText, repeatedName);
        name.append(nameTrack);

        const updateNameOverflow = () => {
            const overflows = nameText.scrollWidth > name.clientWidth;
            name.classList.toggle("overflowing", overflows);

            if (!overflows) {
                name.classList.remove("scrolling");
            }

            return overflows;
        };
        const startNameScrolling = () => {
            const overflows = updateNameOverflow();
            const canAnimate = !window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches;
            name.classList.toggle("scrolling", overflows && canAnimate);
        };
        requestAnimationFrame(updateNameOverflow);
        card.addEventListener("pointerenter", startNameScrolling);
        card.addEventListener("focus", startNameScrolling);
        card.addEventListener("pointerleave", () => {
            if (!card.matches(":focus")) {
                name.classList.remove("scrolling");
            }
        });
        card.addEventListener("blur", () => {
            if (!card.matches(":hover")) {
                name.classList.remove("scrolling");
            }
        });

        let massValue = "";
        if (element.mass !== null && element.mass !== undefined && element.mass !== "") {
            const numericMass = Number(element.mass);
            massValue = Number.isFinite(numericMass)
                ? Number.isInteger(numericMass)
                    ? `(${numericMass})`
                    : numericMass.toFixed(3)
                : String(element.mass);
        }
        const mass = this.createElement(
            "span",
            "element-mass",
            massValue
        );

        card.append(number, radioIcon, symbol, name, mass);

        card.addEventListener("click", () => {
            this.selectElement(element);
        });

        return card;
    }

    /* Series element cards */
    createSeriesCard(element, position) {
        const card = this.createElementCard(element);

        card.style.gridColumn = position;
        card.style.gridRow = "1";

        return card;
    }

    /* ===== Element validation ===== */
    validateElements() {
        const valid = [];
        const atomicNumbers = new Set();
        const positions = new Set();

        for (const element of this.elements) {
            if (
                !element.symbol ||
                !element.name ||
                !Number.isInteger(Number(element.number))
            ) {
                console.warn("Invalid element data:", element);
                continue;
            }

            const number = Number(element.number);

            if (number < 1 || number > 118) {
                console.warn("Invalid atomic number:", element);
                continue;
            }

            if (atomicNumbers.has(number)) {
                console.warn("Duplicate atomic number:", element);
                continue;
            }

            const isSeries =
                element.series === "lanthanide" ||
                element.series === "actinide";

            if (isSeries) {
                const position = Number(element.seriesPosition);

                if (
                    !Number.isInteger(position) ||
                    position < 1 ||
                    position > 15
                ) {
                    console.warn("Invalid series position:", element);
                    continue;
                }

                const key = `${element.series}-${position}`;

                if (positions.has(key)) {
                    console.warn("Duplicate series position:", element);
                    continue;
                }

                positions.add(key);
            } else {
                const period = Number(element.period);
                const group = Number(element.group);

                if (
                    !Number.isInteger(period) ||
                    period < 1 ||
                    period > 7 ||
                    !Number.isInteger(group) ||
                    group < 1 ||
                    group > 18
                ) {
                    console.warn("Invalid period/group:", element);
                    continue;
                }

                const key = `${period}-${group}`;

                if (positions.has(key)) {
                    console.warn("Duplicate table position:", element);
                    continue;
                }

                positions.add(key);
            }

            atomicNumbers.add(number);

            valid.push(element);
        }

        return valid;
    }

    /* ===== Render all elements ===== */
    renderElements() {
        this.mainGrid.querySelectorAll(".element, .empty-state").forEach(node => node.remove());
        this.seriesSection.querySelectorAll(".element").forEach(node => node.remove());

        const elements = this.validateElements();

        const mainElements = elements.filter(
            element => !element.series
        );

        const lanthanides = elements.filter(
            element => element.series === "lanthanide"
        );

        const actinides = elements.filter(
            element => element.series === "actinide"
        );

        // Main table elements
        for (const element of mainElements) {
            this.mainGrid.append(
                this.createElementCard(element)
            );
        }

        // Add series elements to their hardcoded rows.
        const lanthanideRow = this.seriesSection.querySelector('[data-series="lanthanide"]');

        for (const element of lanthanides) {
            lanthanideRow.append(
                this.createSeriesCard(
                    element,
                    Number(element.seriesPosition) + 3
                )
            );
        }

        const actinideRow = this.seriesSection.querySelector('[data-series="actinide"]');

        for (const element of actinides) {
            actinideRow.append(
                this.createSeriesCard(
                    element,
                    Number(element.seriesPosition) + 3
                )
            );
        }

        // Show empty-state message when no data exists
        if (elements.length === 0) {
            const empty = this.createElement(
                "div",
                "empty-state",
                "No elements have been added yet."
            );

            this.mainGrid.append(empty);
        }
    }

    filterByCategory(category) {
        // Clicking the active category resets the filter
        this.activeCategory = this.activeCategory === category ? null : category;
        this.updateCategoryFilter();
    }

    updateCategoryFilter() {
        const filterableItems = this.tableElement.querySelectorAll(".element, .series-placeholder");

        filterableItems.forEach(item => {
            const inactive = this.activeCategory !== null && item.dataset.category !== this.activeCategory;
            item.classList.toggle("inactive", inactive);
        });

        // Update active button
        this.legend.querySelectorAll(".legend-item").forEach(item => {
            const active = item.dataset.category === this.activeCategory;
            item.classList.toggle("active", active);
            item.setAttribute("aria-pressed", String(active));
        });
    }

    /* ===== Element selection handlers ===== */
    isUnknown(value) {
        return typeof value === "string" && value.trim().toLowerCase() === "unknown";
    }

    formatTemperature(value) {
        if (value === null || value === undefined || value === "") {
            return "Not provided";
        }

        if (this.isUnknown(value)) {
            return "Unknown";
        }

        const temperature = Number(value);
        if (!Number.isFinite(temperature)) {
            return "Unknown";
        }

        const fahrenheit = temperature * 9 / 5 + 32;
        return `${temperature.toFixed(2)}℃ (${fahrenheit.toFixed(2)}℉)`;
    }

    selectElement(element) {
        if (
            this.selectedElement &&
            Number(this.selectedElement.number) === Number(element.number)
        ) {
            this.selectedElement = null;

            this.mainGrid
                .querySelectorAll(".element.selected")
                .forEach(card => card.classList.remove("selected"));

            this.seriesSection
                .querySelectorAll(".element.selected")
                .forEach(card => card.classList.remove("selected"));

            this.detailsEmpty.hidden = false;
            this.detailsContent.hidden = true;
            return;
        }

        this.selectedElement = element;

        // Remove previous selection
        this.mainGrid
            .querySelectorAll(".element.selected")
            .forEach(card => card.classList.remove("selected"));

        this.seriesSection
            .querySelectorAll(".element.selected")
            .forEach(card => card.classList.remove("selected"));

        // Highlight selected element
        const cards = [
            ...this.mainGrid.querySelectorAll(".element"),
            ...this.seriesSection.querySelectorAll(".element")
        ];

        const selectedCard = cards.find(
            card => Number(card.dataset.atomicNumber) ===
                Number(element.number)
        );

        selectedCard?.classList.add("selected");

        // Update details panel
        this.detailsEmpty.hidden = true;
        this.detailsContent.hidden = false;

        this.detailsSymbol.dataset.category =
            element.category || "unknown";

        this.detailsSymbol.style.setProperty(
            "--card-bg",
            `var(--${this.getCategoryPrefix(element.category)}-bg)`
        );

        this.detailsSymbol.style.setProperty(
            "--card-border",
            `var(--${this.getCategoryPrefix(element.category)}-border)`
        );

        this.detailsSymbol.style.setProperty(
            "--card-text",
            `var(--${this.getCategoryPrefix(element.category)}-text-1)`
        );

        this.detailsSymbol.style.setProperty(
            "--card-text-2",
            `var(--${this.getCategoryPrefix(element.category)}-text-2)`
        );

        this.detailsSymbolNumber.textContent = element.number;
        this.detailsSymbolText.textContent = element.symbol;
        this.detailsRadioactiveIcon.replaceChildren();
        this.detailsRadioactiveIcon.removeAttribute("aria-label");
        if (element.radioactive) {
            this.detailsRadioactiveIcon.innerHTML = RADIOACTIVE_ICON;
            this.detailsRadioactiveIcon.setAttribute("aria-label", "Radioactive");
        }

        this.detailsName.textContent = element.name;

        this.updateElectronDiagram(element);

        // Atomic mass
        const mass = Number(element.mass);

        if (element.mass === null || element.mass === undefined || element.mass === "") {
            this.detailsMass.textContent = "Not provided";
        } else if (this.isUnknown(element.mass)) {
            this.detailsMass.textContent = "Unknown";
        } else if (Number.isFinite(mass)) {
            this.detailsMass.textContent = Number.isInteger(mass)
                ? `${mass} u`
                : `${mass.toFixed(3)} u`;
        } else {
            this.detailsMass.textContent = "Unknown";
        }

        this.radioactiveNote.textContent = RADIOACTIVE_MESSAGE;
        this.radioactiveNote.hidden = !element.radioactive;

        const density = Number(element.density);
        if (element.density === null || element.density === undefined || element.density === "") {
            this.detailsDensity.textContent = "Not provided";
        } else if (this.isUnknown(element.density) || !Number.isFinite(density)) {
            this.detailsDensity.textContent = "Unknown";
        } else {
            const densityText = String(element.density);
            const [integerPart, decimalPart = ""] = densityText.split(".");
            this.detailsDensity.textContent =
                `${integerPart}.${decimalPart.padEnd(3, "0")} g/cm³`;
        }

        // Category
        const categoryName =
            this.categories[element.category]?.name || "Unknown";

        this.detailsCategory.textContent = categoryName;

        // Period and group
        if (element.series) {
            const seriesPosition = Number(element.seriesPosition);

            this.detailsPeriodLabel.textContent = "Series";
            this.detailsPeriod.textContent =
                element.series.replace(/\b\w/g, char => char.toUpperCase());
            this.detailsGroupLabel.textContent = "Position";
            this.detailsGroup.textContent = seriesPosition;
        } else {
            this.detailsPeriodLabel.textContent = "Period";
            this.detailsGroupLabel.textContent = "Group";
            this.detailsPeriod.textContent =
                element.period ?? "Not provided";

            this.detailsGroup.textContent =
                element.group ?? "Not provided";
        }

        // Electron configuration
        this.detailsConfiguration.replaceChildren(
            this.createElectronConfigurationContent(element)
        );

        this.detailsPhase.textContent =
            element.phase !== null && element.phase !== undefined && element.phase !== ""
                ? element.phase
                : "Not provided";

        const freezingPoint = element.freezing ?? element.melting;
        const hasSublimationPoint = element.sublimation !== null &&
            element.sublimation !== undefined && element.sublimation !== "";
        const useSublimationCard = element.boiling == null &&
            freezingPoint == null && hasSublimationPoint;

        this.sublimationCard.hidden = !useSublimationCard;
        this.boilingCard.hidden = useSublimationCard;
        this.freezingCard.hidden = useSublimationCard;

        if (useSublimationCard) {
            this.detailsSublimation.textContent =
                this.formatTemperature(element.sublimation);
        } else {
            this.detailsSublimation.textContent = "";
        }

        this.detailsBoiling.textContent = this.formatTemperature(element.boiling);
        this.detailsFreezing.textContent = this.formatTemperature(freezingPoint);
    }

    createLabel(label, value) {
        const fragment = document.createDocumentFragment();

        const strong = this.createElement(
            "strong",
            "",
            `${label}: `
        );

        fragment.append(
            strong,
            document.createTextNode(String(value))
        );

        return fragment;
    }

    getCategoryPrefix(category) {
        const prefixes = {
            "hydrogen": "hydrogen",
            "alkali-metal": "alkali",
            "alkaline-earth-metal": "alkaline",
            "transition-metal": "transition",
            "post-transition-metal": "post-transition",
            "metalloid": "metalloid",
            "reactive-nonmetal": "nonmetal",
            "halogen": "halogen",
            "noble-gas": "noble",
            "lanthanide": "lanthanide",
            "actinide": "actinide"
        };

        return prefixes[category] || "unknown";
    }

    // Can be used to update the dataset
    setElements(elements) {
        this.elements = elements;
        this.refresh();
    }

    addElement(element) {
        this.elements.push(element);
        this.refresh();
    }

    createElectronConfigurationContent(element) {
        const fragment = document.createDocumentFragment();

        // Create the clickable format toggle.
        const label = this.createElement(
            "button",
            "configuration-toggle",
            this.configurationFormat === "full" ? "Full" : "Shorthand"
        );

        label.type = "button";
        label.title = "Click to switch configuration format";

        label.addEventListener("click", () => {
            this.configurationFormat =
                this.configurationFormat === "full" ? "shorthand" : "full";

            this.updateElectronConfiguration();
        });

        fragment.append(label, document.createTextNode(": "));

        // Get the element's configuration.
        const fullConfiguration = element.configuration ||
            generateElectronConfiguration(element.number);

        const configuration = this.configurationFormat === "full"
            ? fullConfiguration
            : generateShorthandConfiguration(element.number, fullConfiguration);

        // Format the orbital exponents.
        const orbitals = configuration.match(/\d+[spdf]\d+|\s+|\S+/g) || [];

        for (const orbital of orbitals) {
            const match = orbital.match(/^(\d+[spdf])(\d+)$/);

            if (!match) {
                fragment.append(document.createTextNode(orbital));
                continue;
            }

            fragment.append(document.createTextNode(match[1]));

            const exponent = this.createElement("sup", "", match[2]);
            fragment.append(exponent);
        }

        return fragment;
    }

    getElectronConfiguration(element) {
        if (element.configuration) {
            return element.configuration;
        }

        return generateElectronConfiguration(element.number);
    }

    updateElectronConfiguration() {
        if (!this.selectedElement) return;

        this.detailsConfiguration.replaceChildren(
            this.createElectronConfigurationContent(this.selectedElement)
        );
    }

    getShellDistribution(atomicNumber) {
        const configuration = generateElectronConfiguration(atomicNumber);

        const shells = {};

        // Convert superscript digits to ordinary digits,
        // in case your configuration generator uses them.
        const normalized = configuration.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, digit => {
            return "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(digit);
        });

        const orbitals = normalized.matchAll(/(\d+)[spdf](\d+)/g);

        for (const orbital of orbitals) {
            const shell = Number(orbital[1]);
            const electrons = Number(orbital[2]);

            shells[shell] = (shells[shell] || 0) + electrons;
        }

        return shells;
    }

    updateElectronDiagram(element) {
        const svg = this.electronDiagram;

        if (!svg) return;

        svg.replaceChildren();

        const namespace = "http://www.w3.org/2000/svg";

        const createSVGElement = (tag, attributes = {}) => {
            const node = document.createElementNS(namespace, tag);

            for (const [key, value] of Object.entries(attributes)) {
                node.setAttribute(key, value);
            }

            return node;
        };

        const shells = this.getShellDistribution(element.number);

        const shellNumbers = Object.keys(shells)
            .map(Number)
            .sort((a, b) => a - b);

        const center = 100;
        const maxRadius = 78;
        const minRadius = 25;

        // Distribute shells between the minimum and maximum radii.
        const shellCount = shellNumbers.length;

        const radiusSpacing = shellCount > 1
            ? (maxRadius - minRadius) / (shellCount - 1)
            : 0;

        // Draw each shell.
        for (const shell of shellNumbers) {
            const shellIndex = shellNumbers.indexOf(shell);

            const radius = shellCount > 1
                ? minRadius + shellIndex * radiusSpacing
                : maxRadius;

            const electronCount = shells[shell];

            // Shell orbit.
            const orbit = createSVGElement("circle", {
                cx: center,
                cy: center,
                r: radius,
                fill: "none",
                stroke: "currentColor",
                "stroke-opacity": 0.35,
                "stroke-width": 1
            });

            svg.appendChild(orbit);

            // Rotating group.
            const electronGroup = createSVGElement("g", {
                class: "electron-orbit"
            });

            // Give each shell a slightly different speed.
            electronGroup.style.setProperty(
                "--orbit-duration",
                `${4 + shell * 1.5}s`
            );

            // Electrons.
            for (let i = 0; i < electronCount; i++) {
                const angle = (2 * Math.PI * i) / electronCount;

                const x = center + radius * Math.cos(angle);
                const y = center + radius * Math.sin(angle);

                // Calculate darkness based on the shell's position.
                const darkness = shellCount > 1
                    ? 1 - ((shellCount - 1 - shellIndex) / (shellCount - 1)) * 0.45
                    : 1;

                // Interpolate between the accent color and a darker version.
                const electron = createSVGElement("circle", {
                    cx: x,
                    cy: y,
                    r: 3,
                    fill: `color-mix(in srgb, var(--accent) ${darkness * 100}%, black)`
                });

                electronGroup.appendChild(electron);
            }

            svg.appendChild(electronGroup);
        }

        // Draw the nucleus last so it appears above the electrons.
        const nucleus = createSVGElement("circle", {
            cx: center,
            cy: center,
            r: 13,
            fill: `var(--${this.getCategoryPrefix(element.category)}-border)`
        });

        svg.appendChild(nucleus);

        const symbol = createSVGElement("text", {
            x: center,
            y: center + 4,
            "text-anchor": "middle",
            "font-size": 11,
            "font-weight": "bold",
            fill: "#ffffff"
        });

        symbol.textContent = element.symbol;
        svg.appendChild(symbol);
    }

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

    // Fill orbitals using the Aufbau principle
    let remainingElectrons = atomicNumber;
    const configuration = {};

    for (const orbital of orbitalOrder) {
        const electrons = Math.min(remainingElectrons, orbital.capacity);

        configuration[orbital.name] = electrons;
        remainingElectrons -= electrons;

        if (remainingElectrons === 0) break;
    }

    // Correct exceptions to the normal filling order
    const exceptions = {
        24: { "4s": 1, "3d": 5 },  // Chromium
        29: { "4s": 1, "3d": 10 }, // Copper

        41: { "5s": 1, "4d": 4 },  // Niobium
        42: { "5s": 1, "4d": 5 },  // Molybdenum
        44: { "5s": 1, "4d": 7 },  // Ruthenium
        45: { "5s": 1, "4d": 8 },  // Rhodium
        46: { "5s": 0, "4d": 10 }, // Palladium
        47: { "5s": 1, "4d": 10 }, // Silver

        57: { "4f": 0, "5d": 1 },  // Lanthanum
        58: { "4f": 1, "5d": 1 },  // Cerium
        64: { "4f": 7, "5d": 1 },  // Gadolinium

        78: { "6s": 1, "5d": 9 },  // Platinum
        79: { "6s": 1, "5d": 10 }, // Gold

        89: { "5f": 0, "6d": 1 },  // Actinium
        90: { "5f": 0, "6d": 2 },  // Thorium
        91: { "5f": 2, "6d": 1 },  // Protactinium
        92: { "5f": 3, "6d": 1 },  // Uranium
        93: { "5f": 4, "6d": 1 },  // Neptunium
        96: { "5f": 7, "6d": 1 }   // Curium
    };

    const correction = exceptions[atomicNumber];

    if (correction) {
        Object.assign(configuration, correction);
    }

    // Convert the orbital data into a string.
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
    // Find the nearest preceding noble gas.
    const core = [...nobleGases]
        .reverse()
        .find(element => element.number < atomicNumber);

    if (!core) return fullConfiguration;

    // Generate the noble gas's full configuration.
    const coreConfiguration = generateElectronConfiguration(core.number);

    const fullOrbitals = fullConfiguration.match(/\d+[spdf]\d+/g) || [];
    const coreOrbitals = coreConfiguration.match(/\d+[spdf]\d+/g) || [];

    // Make sure the core configuration matches the beginning.
    const matchesCore = coreOrbitals.every(
        (orbital, index) => fullOrbitals[index] === orbital
    );

    if (!matchesCore) return fullConfiguration;

    // Remove the core orbitals and replace them with the noble gas symbol.
    const remainingOrbitals = fullOrbitals.slice(coreOrbitals.length);

    return `[${core.symbol}] ${remainingOrbitals.join(" ")}`;
}

// Initialize the table
let elements = [];

async function initialize() {
    elements = await loadElements();

    if (elements.length !== 118) {
        console.error("Expected 118 elements, got", elements.length);
        return;
    }

    const periodicTable = new PeriodicTable(
        document.getElementById("table-wrap"),
        elements
    );
}

initialize();