const defaultSettings = {
	aiEndpoint: "http://localhost:5001/api/generate",
	aiKey: "backend-managed",
	aiModel: "gemini-1.5-pro",
	pubmedKey: "",
	arxivEndpoint: "https://export.arxiv.org/api/query",
	customDb: ""
};

const state = {
	settings: { ...defaultSettings },
	theme: localStorage.getItem("litgen-theme") || "light",
	tutorialHidden: localStorage.getItem("litgen-tutorial-hide") === "true"
};

const dom = {
	searchForm: document.getElementById("search-form"),
	queryInput: document.getElementById("query-input"),
	settingsForm: document.getElementById("settings-form"),
	resetSettings: document.getElementById("reset-settings"),
	aiEndpoint: document.getElementById("ai-endpoint"),
	aiKey: document.getElementById("ai-key"),
	aiModel: document.getElementById("ai-model"),
	pubmedKey: document.getElementById("pubmed-key"),
	arxivEndpoint: document.getElementById("arxiv-endpoint"),
	customDb: document.getElementById("custom-db"),
	papersList: document.getElementById("papers-list"),
	summary: document.getElementById("summary-text"),
	extractions: document.getElementById("extractions"),
	status: document.getElementById("status"),
	settingsIndicator: document.getElementById("settings-indicator"),
	settingsPanel: document.getElementById("settings"),
	resultsBubble: document.getElementById("results-bubble"),
	darkToggle: document.getElementById("dark-toggle"),
	tutorial: document.getElementById("tutorial"),
	tutorialClose: document.getElementById("tutorial-close"),
	tutorialHide: document.getElementById("tutorial-hide"),
    reviewTypeSelector: document.getElementById("review-type-selector"),
    citationsPanel: document.getElementById("citations-list"),
    citationEntries: document.getElementById("citation-entries"),
    copySummaryButton: document.getElementById("copy-summary"),
};

function loadSettings() {
	const stored = localStorage.getItem("litgen-settings");
	if (stored) {
		try {
			const parsed = JSON.parse(stored);
			state.settings = {
				...defaultSettings,
				...parsed,
			};
			// If a stored value is blank, fall back to defaults so the baked-in key/endpoint remain active.
			if (!state.settings.aiEndpoint) state.settings.aiEndpoint = defaultSettings.aiEndpoint;
			if (!state.settings.aiKey) state.settings.aiKey = defaultSettings.aiKey;
			if (!state.settings.aiModel) state.settings.aiModel = defaultSettings.aiModel;
			if (!state.settings.arxivEndpoint) state.settings.arxivEndpoint = defaultSettings.arxivEndpoint;
		} catch (e) {
			state.settings = { ...defaultSettings };
		}
	} else {
		// No stored settings, use defaults
		state.settings = { ...defaultSettings };
	}
}

function saveSettings() {
	localStorage.setItem("litgen-settings", JSON.stringify(state.settings));
}

function populateSettingsForm() {
	dom.aiEndpoint.value = state.settings.aiEndpoint;
	dom.aiKey.value = state.settings.aiKey;
	dom.aiModel.value = state.settings.aiModel;
	dom.pubmedKey.value = state.settings.pubmedKey;
	dom.arxivEndpoint.value = state.settings.arxivEndpoint;
	dom.customDb.value = state.settings.customDb;
}

function applyTheme() {
	const body = document.body;
	if (state.theme === "dark") {
		body.classList.add("dark");
	} else {
		body.classList.remove("dark");
	}
}

function toggleTheme() {
	state.theme = state.theme === "dark" ? "light" : "dark";
	localStorage.setItem("litgen-theme", state.theme);
	applyTheme();
}

function updateSettingsGlow() {
	const needsSetup = !state.settings.aiEndpoint || !state.settings.aiKey;
	if (needsSetup) {
		dom.settingsIndicator?.classList.add("glow");
	} else {
		dom.settingsIndicator?.classList.remove("glow");
	}
}

function toggleSettingsPanel(event) {
	event?.preventDefault();
	if (!dom.settingsPanel) return;
	dom.settingsPanel.classList.toggle("hidden");
}

function showTutorialOnce() {
	if (state.tutorialHidden) return;
	if (dom.tutorial) dom.tutorial.classList.remove("hidden");
	if (dom.settingsIndicator) dom.settingsIndicator.classList.add("glow");
}

function setStatus(text) {
	dom.status.textContent = text;
}

function showResultsBubble() {
	if (!dom.resultsBubble) return;
	dom.resultsBubble.classList.remove("collapsed");
}

function renderPapers(papers) {
	dom.papersList.innerHTML = "";
	if (!papers.length) {
		dom.papersList.innerHTML = '<span class="placeholder">No papers found yet.</span>';
		return;
	}
	papers.forEach((p) => {
		const pill = document.createElement("a");
		pill.className = "pill";
		pill.textContent = p.title;
		pill.title = p.source || "";
        if (p.link) {
            pill.href = p.link;
            pill.target = "_blank";
            pill.rel = "noopener noreferrer";
        }
		dom.papersList.appendChild(pill);
	});
}

function renderCitations(papers) {
    dom.citationEntries.innerHTML = "";
    if (!papers.length || !dom.citationsPanel) {
        dom.citationsPanel?.classList.add("hidden");
        return;
    }
    papers.forEach((p) => {
        const li = document.createElement("li");
        
        // Citation Text (Title + DOI if available)
        let citationText = `${p.source}: ${p.title}`;
        if (p.doi) {
            citationText += ` (DOI: ${p.doi})`;
        } else if (p.link && p.source === 'arXiv') {
            // Use arXiv ID as a fallback identifier if DOI is missing
            citationText += ` (arXiv ID: ${p.link.split('/').pop()})`;
        }
        
        // Link wrapper (uses p.link for the URL)
        const link = document.createElement("a");
        link.href = p.link || "#"; // Use # if link is null
        link.textContent = citationText;
        link.target = "_blank";
        li.appendChild(link);

        // Copy Button
        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-citation-btn ghost-btn";
        copyBtn.textContent = "📋";
        copyBtn.title = "Copy individual citation";
        copyBtn.addEventListener("click", () => {
            const textToCopy = link.textContent;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    copyBtn.textContent = "✅";
                    setTimeout(() => copyBtn.textContent = "📋", 1500);
                });
            }
        });
        
        li.appendChild(copyBtn);
        dom.citationEntries.appendChild(li);
    });
    dom.citationsPanel.classList.remove("hidden");
}

function renderSummary(text) {
	dom.summary.innerHTML = marked.parse(text);
	dom.summary.classList.remove("placeholder");
}

/*function renderExtractions(items) {
	dom.extractions.innerHTML = "";
	if (!items.length) {
		dom.extractions.innerHTML = '<li class="placeholder">No extractions yet.</li>';
		return;
	}
	items.forEach((item) => {
		const li = document.createElement("li");
		li.textContent = item;
		dom.extractions.appendChild(li);
	});
}*/

function mockPapers(query) {
	return [
		{ title: `${query} – recent findings`, source: "Mock" },
		{ title: `${query} – methods overview`, source: "Mock" },
		{ title: `${query} – data and results`, source: "Mock" },
	];
}

async function fetchPubMed(query, key) {
	const url = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
	url.searchParams.set("db", "pubmed");
	url.searchParams.set("term", query);
	url.searchParams.set("retmode", "json");
	url.searchParams.set("retmax", "10");
	if (key) url.searchParams.set("api_key", key);
	const res = await fetch(url.toString());
	const data = await res.json();
	const ids = data.esearchresult?.idlist || [];
	return ids.map((id) => ({ title: `PubMed article ${id}`, source: "PubMed" }));
}

async function fetchArxiv(query) {
	// Use backend proxy to avoid CORS
	const res = await fetch("http://localhost:5001/api/papers", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query })
	});
	if (!res.ok) {
		console.error("Backend papers fetch failed:", res.status);
		return [];
	}
	const data = await res.json();
	const papers = data.papers || [];
	console.log("arXiv papers found:", papers.length, papers);
	return papers;
}

async function fetchCustomDb(query, endpoint) {
	const url = `${endpoint}?q=${encodeURIComponent(query)}&limit=3`;
	const res = await fetch(url);
	const data = await res.json();
	if (Array.isArray(data)) {
		return data.slice(0, 3).map((item, i) => ({ title: item.title || `Result ${i + 1}`, source: "Custom" }));
	}
	return [];
}

async function getPapers(query) {
	try {
		if (state.settings.customDb) {
			const custom = await fetchCustomDb(query, state.settings.customDb);
			if (custom.length) return custom;
		}
		if (state.settings.pubmedKey) {
			const pubmed = await fetchPubMed(query, state.settings.pubmedKey);
			if (pubmed.length) return pubmed;
		}
		// Always try arXiv via backend proxy (no CORS issues)
		if (state.settings.arxivEndpoint) {
			const arxiv = await fetchArxiv(query);
			if (arxiv.length) return arxiv;
		}
	} catch (e) {
		console.warn("Falling back to mock data", e);
	}
	return mockPapers(query);
}

async function callAI(prompt) {
    const endpoint = state.settings.aiEndpoint.trim();
    const model = state.settings.aiModel || "";
    if (!endpoint) {
        return "This is a mock AI summary. Connect your AI API in Settings to get live summaries.";
    }
    const isBackendProxy = endpoint.includes("/api/generate") || endpoint.startsWith("/api/");
    const isGemini = endpoint.includes("generativelanguage.googleapis.com");
    try {
        if (isBackendProxy) {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // *** REVISION: Removed maxTokens from the body! ***
                body: JSON.stringify({ prompt, model }), 
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                const msg = data.error ? `${data.error}: ${data.details || data.payload || ""}` : res.statusText;
                setStatus(`AI error: ${msg}`);
                throw new Error(msg || "AI error");
            }
            const text = data.text || data.output || "No response";
            return text;
        }
        if (isGemini) {
            const url = `${endpoint}?key=${encodeURIComponent(key)}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 600 },
                }),
            });
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || data.output || "No response";
            return text;
        }
        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                max_tokens: 600,
            }),
        });
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || data.output || "No response";
        return text;
    } catch (e) {
        console.warn("AI API failed; using mock", e);
        setStatus("AI error; showing mock summary.");
        return "This is a mock AI summary. Connect your AI API in Settings to get live summaries.";
    }
}

async function handleSearch(event) {
    event.preventDefault();
    const query = dom.queryInput.value.trim();
    if (!query) return;

    // 1. Initial UI Setup
    showResultsBubble();
    setStatus("Searching databases...");
    dom.resultsBubble?.scrollIntoView({ behavior: "smooth", block: "start" });
    renderSummary("Searching...");
    // renderExtractions([]); // Clears old extractions (assuming you keep the HTML element)
    renderPapers([]);

    try {
        // 2. Fetch Papers
        const papers = await getPapers(query);
        renderPapers(papers);
        renderCitations(papers);
        setStatus("Running AI summary...");
        const joined = papers.map((p) => p.title).join("\n- ");
        
        // 3. Make the SINGLE API Call for the Summary with the NEW PROMPT
        const reviewType = dom.reviewTypeSelector ? dom.reviewTypeSelector.value : "narrative";
        let typeInstruction = "";
        switch (reviewType) {
            case "systematic":
                typeInstruction = "Conduct a SYSTEMATIC review. Focus on a structured synthesis of the evidence. Explicitly state selection criteria (implied), assess the quality of studies, and synthesize findings quantitatively or qualitatively with a focus on comprehensive coverage and minimizing bias.";
                break;
            case "critical":
                typeInstruction = "Conduct a CRITICAL review. Go beyond description to extensively evaluate and analyze the papers. Identify contradictions, strengths, weaknesses, and gaps in the current research. Challenge prevailing assumptions and propose new conceptual frameworks or perspectives.";
                break;
            case "narrative":
            default:
                typeInstruction = "Conduct a NARRATIVE review. Provide a broad overview of the topic. Connect the papers in a storytelling manner to describe the current state of knowledge, highlighting key themes and theoretical evolution without necessarily following a strict protocol.";
                break;
        }

        const summary = await callAI(`You are a research literature review assistant writing a scholarly literature review essay.
---
**INSTRUCTIONS FOR OUTPUT FORMAT:**
1.  **Do not use any Markdown formatting characters.** This includes \#, \##, \*\*, \*, \-, \_\_ or any other special characters for headings, bolding, italics, or lists.
2.  Write the output entirely in **continuous essay prose** with clear paragraphs, suitable for a formal journal.
3.  The text must *not* contain any Roman numerals, single dashes, or bullet points. All points must be integrated into the essay structure.
4.  Maintain a detailed, comprehensive, and professional academic tone.
5.  **REVIEW TYPE INSTRUCTION:** ${typeInstruction}
---
Analyze the following research papers about "${query}" and provide a detailed, comprehensive literature review essay.

Research Papers:
- ${joined}`);

        // 4. Render Summary and Finish
        renderSummary(summary);
        
        // REMOVED EXTRACTION LOGIC:
        
        setStatus("Done"); // Now the status updates right after the successful summary
    } catch (e) {
        // 5. Error Handling / Mock Fallback
        console.error(e);
        setStatus("Something went wrong. Showing mock data.");
        renderPapers(mockPapers(query));
        renderSummary("Mock summary. Connect an AI API to enable live results.");
        // renderExtractions([]); // Render empty or just clear the section
    }
}

function handleSettingsSubmit(event) {
	event.preventDefault();
	state.settings = {
		aiEndpoint: dom.aiEndpoint.value.trim(),
		aiKey: dom.aiKey.value.trim(),
		aiModel: dom.aiModel.value.trim() || defaultSettings.aiModel,
		pubmedKey: dom.pubmedKey.value.trim(),
		arxivEndpoint: dom.arxivEndpoint.value.trim() || defaultSettings.arxivEndpoint,
		customDb: dom.customDb.value.trim(),
	};
	saveSettings();
	updateSettingsGlow();
	setStatus("Settings saved.");
	dom.settingsPanel?.classList.add("hidden");
}

function handleResetSettings() {
	state.settings = { ...defaultSettings };
	saveSettings();
	populateSettingsForm();
	setStatus("Settings reset to mock mode.");
	updateSettingsGlow();
}

function init() {
	// Clear bad localStorage on first load to reset
	if (localStorage.getItem("litgen-settings") && !localStorage.getItem("litgen-reset-v2")) {
		localStorage.removeItem("litgen-settings");
		localStorage.setItem("litgen-reset-v2", "true");
	}
	loadSettings();
	populateSettingsForm();
	applyTheme();
	dom.searchForm?.addEventListener("submit", handleSearch);
	dom.settingsForm?.addEventListener("submit", handleSettingsSubmit);
	dom.resetSettings?.addEventListener("click", handleResetSettings);
	dom.settingsIndicator?.addEventListener("click", toggleSettingsPanel);
	dom.darkToggle?.addEventListener("click", toggleTheme);
	if (dom.tutorialClose) {
		dom.tutorialClose.addEventListener("click", () => {
			if (dom.tutorialHide?.checked) {
				localStorage.setItem("litgen-tutorial-hide", "true");
				state.tutorialHidden = true;
			}
			dom.tutorial?.classList.add("hidden");
			dom.settingsIndicator?.classList.remove("glow");
		});
	}
	dom.tutorialHide?.addEventListener("change", (e) => {
		const checked = e.target.checked;
		localStorage.setItem("litgen-tutorial-hide", checked ? "true" : "false");
		state.tutorialHidden = checked;
	});
	updateSettingsGlow();
	showTutorialOnce();
	setStatus("Idle. Add your API keys in Settings or use mock mode.");

    dom.copySummaryButton?.addEventListener("click", () => {
        const text = dom.summary.innerText;
        if (text && navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                const originalText = dom.copySummaryButton.textContent;
                dom.copySummaryButton.textContent = "Copied!";
                setTimeout(() => dom.copySummaryButton.textContent = originalText, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                setStatus("Copy failed.");
            });
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    init();
    const searchForm = document.getElementById('search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', () => {
            document.querySelector('.container').classList.add('expanded');
        });
    }
});
