const defaultSettings = {
	aiEndpoint: "http://localhost:5000/api/generate",
	aiKey: "AIzaSyAFLeHoCxPct0K6Rv5BtX57cM88UIA_oNg",
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
		const pill = document.createElement("span");
		pill.className = "pill";
		pill.textContent = p.title;
		pill.title = p.source || "";
		dom.papersList.appendChild(pill);
	});
}

function renderSummary(text) {
	dom.summary.textContent = text;
	dom.summary.classList.remove("placeholder");
}

function renderExtractions(items) {
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
}

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
	url.searchParams.set("retmax", "5");
	if (key) url.searchParams.set("api_key", key);
	const res = await fetch(url.toString());
	const data = await res.json();
	const ids = data.esearchresult?.idlist || [];
	return ids.map((id) => ({ title: `PubMed article ${id}`, source: "PubMed" }));
}

async function fetchArxiv(query) {
	// Use backend proxy to avoid CORS
	const res = await fetch("http://localhost:5000/api/papers", {
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
				body: JSON.stringify({ prompt, maxTokens: 1000, model }),
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

async function buildExtraction(summary) {
	const endpoint = state.settings.aiEndpoint.trim();
	const model = state.settings.aiModel || "";
	if (!endpoint) {
		return [
			"• Methods: Mock extraction pending live AI.",
			"• Results: Mock extraction pending live AI.",
		"• Data: Mock extraction pending live AI.",
		"• Conclusions: Mock extraction pending live AI.",
	];
	}
	const prompt = `You are extracting key information from a research literature summary. Analyze the following summary and extract specific details in bullet-point format.

RESEARCH SUMMARY:
${summary}

EXTRACT THE FOLLOWING (use bullet points starting with •):

**Methods & Techniques:**
- List specific methodologies, algorithms, frameworks, or experimental approaches mentioned
- Include technical details like model types, tools, or protocols

**Results & Findings:**
- Extract quantitative results: accuracy percentages, sample sizes, statistical measures, performance metrics
- Include qualitative findings and key discoveries

**Data & Measurements:**
- Report datasets used, patient cohorts, sample sizes, timeframes
- Include any measurements, biomarkers, or variables studied

**Conclusions & Implications:**
- Summarize main conclusions drawn by researchers
- Note clinical applications, future directions, or practical impact

Format: Start each point with • and be specific with numbers/names when available.`;
	const isBackendProxy = endpoint.includes("/api/generate") || endpoint.startsWith("/api/");
	const isGemini = endpoint.includes("generativelanguage.googleapis.com");
	try {
		if (isBackendProxy) {
			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt, maxTokens: 800, model }),
			});
			const data = await res.json();
			if (!res.ok || data.error) {
				const msg = data.error ? `${data.error}: ${data.details || data.payload || ""}` : res.statusText;
				setStatus(`AI error: ${msg}`);
				throw new Error(msg || "AI error");
			}
			const text = data.text || data.output || "";
			if (text) {
				let lines = text.split(/\n+/).filter(line => {
				const trimmed = line.trim();
				// Filter out empty lines and section headers
				return trimmed && !trimmed.match(/^\*\*.*\*\*:?$/) && trimmed.length > 3;
			});
			// Ensure bullet points
			lines = lines.map(line => {
				const trimmed = line.trim();
				return trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')
					? (trimmed.startsWith('•') ? trimmed : '• ' + trimmed.substring(1).trim())
					: '• ' + trimmed;
			});
			return lines.slice(0, 12);
			}
		}
		if (isGemini) {
			const url = `${endpoint}?key=${encodeURIComponent(key)}`;
			const res = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: { maxOutputTokens: 400 },
				}),
			});
			const data = await res.json();
			const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
			if (text) return text.split(/\n+/).filter(Boolean).slice(0, 6);
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
				max_tokens: 400,
			}),
		});
		const data = await res.json();
		const text = data.choices?.[0]?.message?.content || "";
		if (text) return text.split(/\n+/).filter(Boolean).slice(0, 6);
	} catch (e) {
		console.warn("Extraction failed; using mock", e);
	}
	return [
		"• Methods: Mock extraction pending live AI.",
		"• Results: Mock extraction pending live AI.",
		"• Data: Mock extraction pending live AI.",
		"• Conclusions: Mock extraction pending live AI.",
	];
}

async function handleSearch(event) {
	event.preventDefault();
	const query = dom.queryInput.value.trim();
	if (!query) return;
	showResultsBubble();
	setStatus("Searching databases...");
	dom.resultsBubble?.scrollIntoView({ behavior: "smooth", block: "start" });
	renderSummary("Searching...");
	renderExtractions([]);
	renderPapers([]);
	try {
		const papers = await getPapers(query);
		renderPapers(papers);
		setStatus("Running AI summary...");
		const joined = papers.map((p) => p.title).join("\n- ");
		const summary = await callAI(`You are a research literature review assistant. Analyze these actual research papers about "${query}" and provide a detailed academic summary.

Research Papers:
- ${joined}

Provide a comprehensive summary that includes:
1. **Research Focus**: What specific aspects of ${query} do these papers investigate?
2. **Methodologies**: What research methods, techniques, or approaches are employed (e.g., machine learning models, clinical trials, computational frameworks)?
3. **Key Findings**: What are the specific discoveries, innovations, or results? Include any numerical data, accuracy metrics, or statistical findings mentioned in titles.
4. **Impact & Applications**: What are the clinical, practical, or theoretical implications?

Write in a professional academic tone. Be specific and substantive, not generic.`);
		renderSummary(summary);
		setStatus("Extracting key fields...");
		const extractions = await buildExtraction(summary);
		renderExtractions(extractions);
		setStatus("Done");
	} catch (e) {
		console.error(e);
		setStatus("Something went wrong. Showing mock data.");
		renderPapers(mockPapers(query));
		renderSummary("Mock summary. Connect an AI API to enable live results.");
		renderExtractions([
			"• Methods: Not available in mock mode.",
			"• Results: Not available in mock mode.",
			"• Data: Not available in mock mode.",
			"• Conclusions: Not available in mock mode.",
		]);
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
}

document.addEventListener("DOMContentLoaded", init);
