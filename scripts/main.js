import {
    generateElectronConfiguration,
    generateShorthandConfiguration,
    loadElements,
    SUBLIMATION_POINTS_K
} from "./processElementData.js";
import {
    generateSpectrumImage,
    loadSpectrumData
} from "./processSpectra.js";

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
        this.spectrumRequestId = 0;
        this.spectrumAbortController = null;

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
        this.detailsSummary = this.tableElement.querySelector(".details-summary");
        this.detailsSummarySource = this.tableElement.querySelector(".details-summary-source");
        this.detailsSummarySourceLabel = this.tableElement.querySelector(".details-summary-source-label");
        this.detailsMass = this.tableElement.querySelector(".details-mass");
        this.radioactiveNote = this.tableElement.querySelector(".radioactive-note");
        this.detailsDensity = this.tableElement.querySelector(".details-density");
        this.detailsElectronegativity = this.tableElement.querySelector(".details-electronegativity");
        this.detailsAffinity = this.tableElement.querySelector(".details-affinity");
        this.detailsIonization = this.tableElement.querySelector(".details-ionization");
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
        this.spectrumCanvas = this.tableElement.querySelector("#spectrum-canvas");
        this.spectrumStatus = this.tableElement.querySelector(".spectrum-status");
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
                "No elements are available."
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
            this.spectrumRequestId++;
            this.spectrumAbortController?.abort();
            this.spectrumAbortController = null;

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
        this.detailsSummary.textContent = element.summary || "Not provided";

        const summarySource = element.source;
        const hasValidSummarySource =
            typeof summarySource === "string" &&
            /^https?:\/\/\S+$/i.test(summarySource);
        this.detailsSummarySourceLabel.hidden = !hasValidSummarySource;
        if (hasValidSummarySource) {
            this.detailsSummarySource.href = summarySource;
        } else {
            this.detailsSummarySource.removeAttribute("href");
        }

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
            const densityText = density.toLocaleString(undefined, {
                useGrouping: false,
                maximumSignificantDigits: 6
            });
            this.detailsDensity.textContent = `${densityText} g/cm³`;
        }

        const electronegativity = Number(element.electronegativity);
        if (
            element.electronegativity === null ||
            element.electronegativity === undefined ||
            element.electronegativity === ""
        ) {
            this.detailsElectronegativity.textContent = "Not provided";
        } else if (this.isUnknown(element.electronegativity) || !Number.isFinite(electronegativity)) {
            this.detailsElectronegativity.textContent = "Unknown";
        } else {
            this.detailsElectronegativity.textContent = String(electronegativity);
        }

        const electronAffinity = Number(element.electronAffinity);
        if (
            element.electronAffinity === null ||
            element.electronAffinity === undefined ||
            element.electronAffinity === ""
        ) {
            this.detailsAffinity.textContent = "Not provided";
        } else if (this.isUnknown(element.electronAffinity) || !Number.isFinite(electronAffinity)) {
            this.detailsAffinity.textContent = "Unknown";
        } else {
            this.detailsAffinity.textContent = `${electronAffinity.toLocaleString(undefined, {
                maximumSignificantDigits: 6
            })} kJ/mol`;
        }

        const ionizationEnergies = Array.isArray(element.ionizationEnergies)
            ? element.ionizationEnergies
                .filter(energy => energy !== null && energy !== "")
                .map(Number)
                .filter(Number.isFinite)
            : [];
        this.detailsIonization.replaceChildren();

        if (ionizationEnergies.length === 0) {
            const row = this.createElement("tr");
            const cell = this.createElement("td", "ionization-empty", "Not provided");
            cell.colSpan = 2;
            row.append(cell);
            this.detailsIonization.append(row);
        } else {
            ionizationEnergies.forEach((energy, index) => {
                const row = this.createElement("tr");
                const stage = this.createElement("th", "", `#${index + 1}`);
                stage.scope = "row";
                const value = this.createElement("td", "", energy.toLocaleString());
                row.append(stage, value);
                this.detailsIonization.append(row);
            });
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
        const hasStandardPressureSublimationPoint =
            SUBLIMATION_POINTS_K[element.number] !== undefined;
        const useSublimationCard = hasSublimationPoint &&
            (freezingPoint == null || hasStandardPressureSublimationPoint);

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
        this.updateSpectrum(element);
    }

    async updateSpectrum(element) {
        this.spectrumAbortController?.abort();
        const abortController = new AbortController();
        this.spectrumAbortController = abortController;
        const requestId = ++this.spectrumRequestId;
        this.spectrumCanvas.hidden = true;
        this.spectrumCanvas.getContext("2d").clearRect(
            0,
            0,
            this.spectrumCanvas.width,
            this.spectrumCanvas.height
        );
        this.spectrumStatus.textContent = "Loading observed spectral lines from NIST...";

        try {
            const { spectrum } = await loadSpectrumData(element, abortController.signal);

            if (
                requestId !== this.spectrumRequestId ||
                this.selectedElement?.number !== element.number
            ) {
                return;
            }

            if (spectrum.length === 0) {
                this.spectrumStatus.textContent =
                    "No observed spectral lines found";
                return;
            }

            generateSpectrumImage(this.spectrumCanvas, spectrum);
            this.spectrumCanvas.setAttribute(
                "aria-label",
                `Observed visible emission spectrum for ${element.name}`
            );
            this.spectrumCanvas.hidden = false;

            const intensityCount = spectrum.filter(line =>
                Number.isFinite(line.intensity) && line.intensity > 0
            ).length;
            this.spectrumStatus.textContent = intensityCount > 0
                ? `${spectrum.length} observed lines from NIST ASD. Log relative intensity shown.`
                : `${spectrum.length} observed lines found, but no relative intensities were reported.`;
        } catch (error) {
            if (
                requestId !== this.spectrumRequestId ||
                this.selectedElement?.number !== element.number
            ) {
                return;
            }

            console.error(`Failed to load spectrum for ${element.symbol}:`, error);
            this.spectrumStatus.textContent =
                "Unable to load spectral data from NIST. Please try selecting the element again.";
        } finally {
            if (this.spectrumAbortController === abortController) {
                this.spectrumAbortController = null;
            }
        }
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

        // Prefer the complete configurations supplied by the dataset.
        const fullConfiguration = element.electronConfiguration ||
            generateElectronConfiguration(element.number);
        const shorthandConfiguration = element.electronConfigurationSemantic ||
            generateShorthandConfiguration(element.number, fullConfiguration);

        const configuration = this.configurationFormat === "full"
            ? fullConfiguration
            : shorthandConfiguration;

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

    updateElectronConfiguration() {
        if (!this.selectedElement) return;

        this.detailsConfiguration.replaceChildren(
            this.createElectronConfigurationContent(this.selectedElement)
        );
    }

    getShellDistribution(atomicNumber, elementShells = []) {
        if (Array.isArray(elementShells) && elementShells.length > 0) {
            return Object.fromEntries(
                elementShells
                    .map((electrons, index) => [index + 1, Number(electrons)])
                    .filter(([, electrons]) => Number.isFinite(electrons) && electrons > 0)
            );
        }

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

        const shells = this.getShellDistribution(element.number, element.shells);

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

// Ctrl+H toggles the table footer.
document.addEventListener("keydown", event => {
    if (event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === "h") {
        event.preventDefault();
        document.querySelector(".table-footer")?.classList.toggle("footer-hidden");
    }
});

async function initialize() {
    const tableElement = document.getElementById("table-wrap");
    const loadStatus = document.querySelector(".table-load-status");
    let elements;

    try {
        elements = await loadElements();
    } catch (error) {
        console.error("Failed to load element data:", error);
        new PeriodicTable(tableElement, []);
        tableElement.querySelector(".empty-state")?.remove();
        loadStatus.textContent =
            "Unable to load element data. Check your connection and reload the page.";
        loadStatus.hidden = false;
        return;
    }

    if (elements.length !== 118) {
        console.warn("Expected 118 elements, got", elements.length);
    }

    new PeriodicTable(tableElement, elements);
}

initialize();