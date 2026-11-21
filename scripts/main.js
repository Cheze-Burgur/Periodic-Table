import {
    generateElectronConfiguration,
    generateShorthandConfiguration,
    loadElements
} from "./processElementData.js";
import {
    generateSpectrumImage,
    loadSpectrumData
} from "./processSpectra.js";

const RADIOACTIVE_MESSAGE = "This element has no stable isotopes; the mass of the isotope with the longest half-life is used";
const UNSPECIFIED_VALUE_LABEL = "Unknown";

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
        this.orbitalNotationVisible = true;
        this.spectrumRequestId = 0;
        this.spectrumAbortController = null;

        document.addEventListener("keydown", event => {
            if (
                event.key === "Escape" &&
                this.detailsPanel.getAttribute("aria-hidden") === "false"
            ) {
                event.preventDefault();
                this.clearSelection();
            }
        });

        this.tableElement.addEventListener("click", event => {
            const closeButton = event.target.closest("#details-close");
            if (closeButton && this.tableElement.contains(closeButton)) {
                this.clearSelection();
                return;
            }

            const legendItem = event.target.closest(".legend-item");
            if (legendItem && this.tableElement.contains(legendItem)) {
                this.filterByCategory(legendItem.dataset.category);
            }
        });

        this.tableElement.addEventListener("pointerover", event => {
            const card = event.target.closest(".element");
            if (!card || card.contains(event.relatedTarget)) {
                return;
            }

            const element = this.elements.find(
                item => Number(item.number) === Number(card.dataset.atomicNumber)
            );
            if (element) {
                this.showElementPreview(element);
            }
        });

        this.tableElement.addEventListener("pointerout", event => {
            const card = event.target.closest(".element");
            if (card && !card.contains(event.relatedTarget)) {
                this.hideElementPreview();
            }
        });

        this.tableElement.addEventListener("focusin", event => {
            const card = event.target.closest(".element");
            if (!card) {
                return;
            }

            const element = this.elements.find(
                item => Number(item.number) === Number(card.dataset.atomicNumber)
            );
            if (element) {
                this.showElementPreview(element);
            }
        });

        this.tableElement.addEventListener("focusout", event => {
            const card = event.target.closest(".element");
            if (card && !card.contains(event.relatedTarget)) {
                this.hideElementPreview();
            }
        });

        this.cacheElements();
        this.refresh();
    }

    /* ===== Main table generation ===== */
    cacheElements() {
        this.legend = document.getElementById("legend");
        this.mainGrid = document.getElementById("main-grid");
        this.seriesSection = document.getElementById("series-section");
        this.elementPreview = document.getElementById("element-preview");
        this.previewContent = document.getElementById("preview-content");
        this.previewSymbol = document.getElementById("preview-symbol");
        this.previewSymbolNumber = document.getElementById("preview-symbol-number");
        this.previewSymbolText = document.getElementById("preview-symbol-text");
        this.previewRadioactiveIcon = document.getElementById("preview-radioactive-icon");
        this.previewName = document.getElementById("preview-name");
        this.previewCategory = document.getElementById("preview-category");
        this.previewMass = document.getElementById("preview-mass");
        this.previewDensity = document.getElementById("preview-density");
        this.detailsPanel = document.getElementById("details-panel");
        this.detailsClose = document.getElementById("details-close");
        this.detailsEmpty = document.getElementById("details-empty");
        this.detailsContent = document.getElementById("details-content");
        this.electronDiagram = document.getElementById("electron-diagram");
        this.detailsSymbol = document.getElementById("details-symbol");
        this.detailsSymbolNumber = document.getElementById("details-symbol-number");
        this.detailsSymbolText = document.getElementById("details-symbol-text");
        this.detailsRadioactiveIcon = document.getElementById("details-radioactive-icon");
        this.detailsName = document.getElementById("details-name");
        this.detailsSummary = document.getElementById("details-summary");
        this.detailsSummarySource = document.getElementById("details-summary-source");
        this.detailsSummarySourceLabel = document.getElementById("details-summary-source-label");
        this.detailsMass = document.getElementById("details-mass");
        this.radioactiveNote = document.getElementById("radioactive-note");
        this.detailsDensity = document.getElementById("details-density");
        this.detailsElectronegativity = document.getElementById("details-electronegativity");
        this.detailsAffinity = document.getElementById("details-affinity");
        this.detailsIonization = document.getElementById("details-ionization");
        this.detailsCategory = document.getElementById("details-category");
        this.detailsPeriodLabel = document.getElementById("details-period-label");
        this.detailsPeriod = document.getElementById("details-period");
        this.detailsGroupLabel = document.getElementById("details-group-label");
        this.detailsGroup = document.getElementById("details-group");
        this.detailsConfiguration = document.getElementById("details-configuration");
        this.detailsPhase = document.getElementById("details-phase");
        this.detailsBoiling = document.getElementById("details-boiling");
        this.detailsFreezing = document.getElementById("details-freezing");
        this.detailsSublimation = document.getElementById("details-sublimation");
        this.sublimationCard = document.getElementById("sublimation-card");
        this.boilingCard = document.getElementById("boiling-card");
        this.freezingCard = document.getElementById("freezing-card");
        this.spectrumCanvas = document.getElementById("spectrum-canvas");
        this.spectrumStatus = document.getElementById("spectrum-status");
    }

    refresh() {
        this.selectedElement = null;

        this.detailsEmpty.hidden = false;
        this.detailsContent.hidden = true;
        this.detailsPanel.setAttribute("aria-hidden", "true");
        this.detailsPanel.setAttribute("inert", "");
        this.hideElementPreview();

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

        const numericMass = Number(element.mass);
        const unspecifiedMass = this.formatUnspecifiedValue(element.mass);
        const massValue = unspecifiedMass !== null
            ? UNSPECIFIED_VALUE_LABEL
            : Number.isFinite(numericMass)
                ? Number.isInteger(numericMass)
                    ? `(${numericMass})`
                    : numericMass.toFixed(3)
                : UNSPECIFIED_VALUE_LABEL;
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
        const lanthanideRow = document.getElementById("lanthanide-elements");

        for (const element of lanthanides) {
            lanthanideRow.append(
                this.createSeriesCard(
                    element,
                    Number(element.seriesPosition) + 3
                )
            );
        }

        const actinideRow = document.getElementById("actinide-elements");

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
            empty.id = "empty-state";

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

    formatUnspecifiedValue(value) {
        if (
            value === null ||
            value === undefined ||
            (typeof value === "string" &&
                (value.trim() === "" || this.isUnknown(value)))
        ) {
            return UNSPECIFIED_VALUE_LABEL;
        }

        return null;
    }

    formatTemperature(value) {
        const unspecifiedValue = this.formatUnspecifiedValue(value);
        if (unspecifiedValue !== null) {
            return unspecifiedValue;
        }

        const temperature = Number(value);
        if (!Number.isFinite(temperature)) {
            return UNSPECIFIED_VALUE_LABEL;
        }

        const fahrenheit = temperature * 9 / 5 + 32;
        return `${temperature.toFixed(2)}℃ (${fahrenheit.toFixed(2)}℉)`;
    }

    showElementPreview(element) {
        if (this.detailsPanel.getAttribute("aria-hidden") === "false") {
            return;
        }

        this.setElementSymbolCategory(this.previewSymbol, element.category);
        this.previewSymbolNumber.textContent = element.number;
        this.previewSymbolText.textContent = element.symbol;
        this.previewRadioactiveIcon.replaceChildren();
        this.previewRadioactiveIcon.removeAttribute("aria-label");
        if (element.radioactive) {
            this.previewRadioactiveIcon.innerHTML = RADIOACTIVE_ICON;
            this.previewRadioactiveIcon.setAttribute("aria-label", "Radioactive");
        }

        this.previewName.textContent = element.name;
        this.previewCategory.textContent =
            this.categories[element.category]?.name || "Unknown";

        const mass = Number(element.mass);
        const unspecifiedMass = this.formatUnspecifiedValue(element.mass);
        if (unspecifiedMass !== null) {
            this.previewMass.textContent = unspecifiedMass;
        } else if (!Number.isFinite(mass)) {
            this.previewMass.textContent = UNSPECIFIED_VALUE_LABEL;
        } else {
            this.previewMass.textContent = `${Number.isInteger(mass) ? mass : mass.toFixed(3)} u`;
        }

        const density = Number(element.density);
        const unspecifiedDensity = this.formatUnspecifiedValue(element.density);
        if (unspecifiedDensity !== null) {
            this.previewDensity.textContent = unspecifiedDensity;
        } else if (!Number.isFinite(density)) {
            this.previewDensity.textContent = UNSPECIFIED_VALUE_LABEL;
        } else {
            this.previewDensity.textContent = `${density} g/cm³`;
        }
        this.elementPreview.dataset.active = "true";
        this.previewContent.setAttribute("aria-hidden", "false");
    }

    setElementSymbolCategory(symbol, category) {
        const categoryName = category || "unknown";
        const prefix = this.getCategoryPrefix(categoryName);

        symbol.dataset.category = categoryName;
        symbol.style.setProperty("--card-bg", `var(--${prefix}-bg)`);
        symbol.style.setProperty("--card-border", `var(--${prefix}-border)`);
        symbol.style.setProperty("--card-text", `var(--${prefix}-text-1)`);
        symbol.style.setProperty("--card-text-2", `var(--${prefix}-text-2)`);
    }

    hideElementPreview() {
        if (!this.elementPreview.hasAttribute("data-active")) {
            return;
        }

        this.elementPreview.removeAttribute("data-active");
        this.previewContent.setAttribute("aria-hidden", "true");
    }

    clearSelection() {
        const selectedCard = this.mainGrid.querySelector(".element.selected") ||
            this.seriesSection.querySelector(".element.selected");
        const selectedElement = this.selectedElement;

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
        this.detailsPanel.setAttribute("aria-hidden", "true");
        this.detailsPanel.setAttribute("inert", "");
        selectedCard?.focus();

        if (
            !this.elementPreview.hasAttribute("data-active") &&
            selectedElement &&
            selectedCard?.matches(":hover, :focus")
        ) {
            this.showElementPreview(selectedElement);
        }
    }

    selectElement(element) {
        this.hideElementPreview();

        if (
            this.selectedElement &&
            Number(this.selectedElement.number) === Number(element.number)
        ) {
            this.clearSelection();
            return;
        }

        const panelWasOpen = this.detailsPanel.getAttribute("aria-hidden") === "false";
        this.detailsPanel.scrollTop = 0;
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
        this.detailsPanel.removeAttribute("inert");
        this.detailsPanel.setAttribute("aria-hidden", "false");

        this.setElementSymbolCategory(this.detailsSymbol, element.category);

        this.detailsSymbolNumber.textContent = element.number;
        this.detailsSymbolText.textContent = element.symbol;
        this.detailsRadioactiveIcon.replaceChildren();
        this.detailsRadioactiveIcon.removeAttribute("aria-label");
        if (element.radioactive) {
            this.detailsRadioactiveIcon.innerHTML = RADIOACTIVE_ICON;
            this.detailsRadioactiveIcon.setAttribute("aria-label", "Radioactive");
        }

        this.detailsName.textContent = element.name;
        this.detailsSummary.textContent =
            this.formatUnspecifiedValue(element.summary) || element.summary;

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
        const unspecifiedMass = this.formatUnspecifiedValue(element.mass);
        if (unspecifiedMass !== null) {
            this.detailsMass.textContent = unspecifiedMass;
        } else if (Number.isFinite(mass)) {
            this.detailsMass.textContent = Number.isInteger(mass)
                ? `${mass} u`
                : `${mass.toFixed(3)} u`;
        } else {
            this.detailsMass.textContent = UNSPECIFIED_VALUE_LABEL;
        }

        this.radioactiveNote.textContent = RADIOACTIVE_MESSAGE;
        this.radioactiveNote.hidden = !element.radioactive;

        const density = Number(element.density);
        const unspecifiedDensity = this.formatUnspecifiedValue(element.density);
        if (unspecifiedDensity !== null) {
            this.detailsDensity.textContent = unspecifiedDensity;
        } else if (!Number.isFinite(density)) {
            this.detailsDensity.textContent = UNSPECIFIED_VALUE_LABEL;
        } else {
            const densityText = density.toLocaleString(undefined, {
                useGrouping: false,
                maximumSignificantDigits: 6
            });
            this.detailsDensity.textContent = `${densityText} g/cm³`;
        }

        const electronegativity = Number(element.electronegativity);
        const unspecifiedElectronegativity =
            this.formatUnspecifiedValue(element.electronegativity);
        if (unspecifiedElectronegativity !== null) {
            this.detailsElectronegativity.textContent = unspecifiedElectronegativity;
        } else if (!Number.isFinite(electronegativity)) {
            this.detailsElectronegativity.textContent = UNSPECIFIED_VALUE_LABEL;
        } else {
            this.detailsElectronegativity.textContent = String(electronegativity);
        }

        const electronAffinity = Number(element.electronAffinity);
        const unspecifiedAffinity =
            this.formatUnspecifiedValue(element.electronAffinity);
        if (unspecifiedAffinity !== null) {
            this.detailsAffinity.textContent = unspecifiedAffinity;
        } else if (!Number.isFinite(electronAffinity)) {
            this.detailsAffinity.textContent = UNSPECIFIED_VALUE_LABEL;
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
            const cell = this.createElement("td", "ionization-empty", UNSPECIFIED_VALUE_LABEL);
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
                this.formatUnspecifiedValue(element.period) ?? element.period;
            this.detailsGroup.textContent =
                this.formatUnspecifiedValue(element.group) ?? element.group;
        }

        // Electron configuration
        this.detailsConfiguration.replaceChildren(
            this.createElectronConfigurationContent(element)
        );

        this.detailsPhase.textContent =
            this.formatUnspecifiedValue(element.phase) ?? element.phase;

        const freezingPoint = element.freezing ?? element.melting;
        const hasSublimationPoint = element.sublimation !== null &&
            element.sublimation !== undefined && element.sublimation !== "";
        const useSublimationCard = hasSublimationPoint;

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

        if (!panelWasOpen) {
            this.detailsClose.focus();
        }
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

        fragment.append(this.createOrbitalNotation(fullConfiguration));

        return fragment;
    }

    createOrbitalNotation(configuration) {
        const notation = this.createElement("div", "configuration-orbital-notation");
        const label = this.createElement(
            "button",
            "configuration-toggle orbital-notation-toggle",
            "Orbital notation"
        );
        const orbitals = this.createElement("div", "orbital-notation-orbitals");
        const capacities = { s: 2, p: 6, d: 10, f: 14 };
        const matches = configuration.matchAll(/(\d+)([spdf])(\d+)/g);

        label.type = "button";
        label.setAttribute("aria-expanded", String(this.orbitalNotationVisible));
        label.addEventListener("click", () => {
            this.orbitalNotationVisible = !this.orbitalNotationVisible;
            label.setAttribute("aria-expanded", String(this.orbitalNotationVisible));
            orbitals.hidden = !this.orbitalNotationVisible;
        });

        for (const match of matches) {
            const subshell = match[2];
            const electrons = Number(match[3]);
            const orbitalCount = capacities[subshell] / 2;
            const group = this.createElement("span", "orbital-notation-group");
            const name = this.createElement("span", "orbital-notation-name", `${match[1]}${subshell}`);
            const boxes = this.createElement("span", "orbital-notation-boxes");

            group.setAttribute(
                "aria-label",
                `${match[1]}${subshell}: ${electrons} electron${electrons === 1 ? "" : "s"}`
            );

            for (let index = 0; index < orbitalCount; index += 1) {
                const box = this.createElement("span", "orbital-notation-box");
                const arrows = [
                    electrons > index ? "↑" : "",
                    electrons > orbitalCount + index ? "↓" : ""
                ].join("");

                box.textContent = arrows;
                box.setAttribute("aria-hidden", "true");
                boxes.append(box);
            }

            group.append(name, boxes);
            orbitals.append(group);
        }

        orbitals.hidden = !this.orbitalNotationVisible;
        notation.append(label, orbitals);
        return notation;
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
        document.getElementById("table-footer")?.classList.toggle("footer-hidden");
    }
});

async function initialize() {
    const tableElement = document.getElementById("table-wrap");
    const loadStatus = document.getElementById("table-load-status");
    let elements;

    try {
        elements = await loadElements();
    } catch (error) {
        console.error("Failed to load element data:", error);
        new PeriodicTable(tableElement, []);
        document.getElementById("empty-state")?.remove();
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